import * as THREE from 'three';
import type { RenderSetup } from '../render/setup';
import { City } from '../world/city';
import { People } from '../world/people';
import { Player } from './player';
import { Input } from '../core/input';
import { Hud, DeviceUI, DialogUI, Screens, itemText, type Tab } from '../ui/ui';
import { createSim, fmtMin, learn, setFlag, has, flag, journal, message, min, WINDOW, type Sim, type ItemId } from '../sim/types';
import { currentThread, nearestNpc, timeline, npcViews, branchState, type NpcView } from '../sim/sim';
import { SCENES, scene, type Scene, type Node, type Choice } from '../content/dialogues';
import { NPCS } from '../content/schedule';
import { tr, type Lang } from '../content/i18n';
import { groundH, isWater } from '../world/terrain';
import { PLACES } from '../content/places';

type Mode = 'intro' | 'play' | 'dialog' | 'device' | 'end';

const PLACE_RU = (id: string) => PLACES[id]?.ru ?? id;

export class Game {
  rs: RenderSetup;
  city: City;
  people: People;
  player: Player;
  input: Input;
  hud = new Hud();
  device = new DeviceUI();
  dlg = new DialogUI();
  screens = new Screens();

  sim: Sim = createSim();
  lang: Lang = 'ru';
  mode: Mode = 'intro';
  scene: Scene | null = null;
  nodeId: string | null = null;
  bookmarks = new Set<number>();
  dead = new Set<string>();
  hostiles = new Set<string>();
  hp = 2;
  private lastEnemyShot = 0;
  private lastBarkAt = -99;
  private clock = new THREE.Clock();
  private ran = false;
  private waiting = false;
  private previewSaved: Sim | null = null;
  private previewLabel: HTMLDivElement | null = null;
  private deviceTarget = 0;
  private booted = false;
  private lastInteract = '';

  constructor(rs: RenderSetup, city: City, people: People) {
    this.rs = rs;
    this.city = city;
    this.people = people;
    this.player = new Player(rs.camera);
    this.input = new Input(rs.renderer.domElement);

    this.device.onJump = (t) => this.jumpTo(t);
    this.device.onClose = () => this.closeDevice();
    this.device.onBookmark = () => this.addBookmark();
    this.device.onPreviewStart = (t) => this.beginPreview(t);
    this.device.onPreviewEnd = () => this.endPreview();
    this.dlg.onChoose = (i) => this.choose(i);
    this.dlg.onNext = () => this.advance();
  }

  // --- запуск -------------------------------------------------------------
  start() {
    this.setupMouse();
    this.hud.hideBoot();
    this.screens.showIntro(this.lang, () => this.begin());
  }

  private begin() {
    this.sim = createSim(1947);
    this.sim.t = min(3); // пролог начинается в 22:03, чтобы прыжок «на три минуты назад» шёл в 22:00
    this.player.teleport(-71.4, -57.2);
    this.screens.hide();
    this.mode = 'play';
    this.hud.setThread('Орвен, ключник. Переулок Ключников');
    this.startScene('prologue');
    if (!this.ran) {
      this.ran = true;
      this.clock.start();
      requestAnimationFrame(this.frame);
    }
  }

  private frame = () => {
    requestAnimationFrame(this.frame);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.step(dt);
    this.render();
    this.input.endFrame();
  };

  private render() {
    this.rs.grade.uniforms.time.value += 0.016;
    this.rs.composer.render();
  }

  // --- шаг ----------------------------------------------------------------
  private step(dt: number) {
    if (this.mode === 'intro' || this.mode === 'end') return;

    if (this.mode === 'play' || this.mode === 'dialog') {
      const nearEnemy = [...this.hostiles].some((id) => {
        const v = npcViews(this.sim).find((n) => n.id === id);
        return v && (v.x - this.player.pos.x) ** 2 + (v.z - this.player.pos.z) ** 2 < 8 * 8;
      });
      this.waiting = this.input.down('KeyT') && !nearEnemy && this.mode === 'play';
      const scale = this.waiting ? 16 : 4;
      const prev = this.sim.t;
      this.sim.t = Math.min(WINDOW, this.sim.t + dt * scale);
      this.crossMinutes(prev, this.sim.t);
      if (this.sim.t >= WINDOW && !this.sim.finale) {
        this.finish('empty');
        return;
      }
    }

    if (this.mode === 'play') this.player.update(dt, this.input, this.city, false);
    else this.player.update(dt, this.input, this.city, true);

    this.people.update(dt, this.sim, this.rs.camera.position, this.dead);
    this.city.update(this.sim, performance.now() / 1000);
    this.rs.rainUpdate(performance.now() / 1000, this.rs.camera);
    this.rs.updateLamps(this.rs.camera.position, performance.now() / 1000, this.sim.flags.tapCut === undefined && this.sim.t / 60 > 5);
    this.rs.grade.uniforms.time.value = performance.now() / 1000;

    this.hud.setClock(this.sim.t);
    this.hud.setThread(currentThread(this.sim).ru);

    if (this.mode === 'play') {
      this.handleKeys();
      this.updateInteract();
      this.enemyFire();
    } else if (this.mode === 'device') {
      this.device.render(this.deviceState());
    }
    this.input.takeMouse();
  }

  private crossMinutes(prev: number, now: number) {
    const a = Math.floor(prev / 60), b = Math.floor(now / 60);
    for (let m = a + 1; m <= b; m++) {
      if (m < 0 || m > 60) continue;
      const t = m * 60;
      if (m === 12 && has(this.sim, 'explosion') === false) {
        if (Math.hypot(this.player.pos.x - 66, this.player.pos.z - 33) < 130) learn(this.sim, 'explosion');
      }
      if (m === 35 && this.sim.t / 60 >= 35) {
        if (Math.hypot(this.player.pos.x + 42, this.player.pos.z - 60) < 22) learn(this.sim, 'jan');
      }
      if (m === 33 && this.sim.flags.tildaWarned === undefined) {
        if (Math.hypot(this.player.pos.x + 9, this.player.pos.z - 64) < 26) learn(this.sim, 'tildaShot');
      }
      if (m === 5 && this.sim.flags.tapCut === undefined && !this.sim.fired.has('flicker_said')) {
        this.sim.fired.add('flicker_said');
        this.bark('Весь город мигает. Не к добру.');
      }
      if (m === 12 && !this.sim.fired.has('boom')) {
        this.sim.fired.add('boom');
        this.hud.subtitle('Склад…');
        this.rs.bloom.strength = 1.6;
        setTimeout(() => (this.rs.bloom.strength = 0.65), 240);
      }
      if (m === 22 && this.sim.flags.tapCut === undefined) this.hud.subtitle('Колокол молчит.');
      if (m === 30 && this.sim.flags.tapCut === undefined) {
        learn(this.sim, 'fomaFire');
        this.hud.subtitle('Рыночная горит.');
      }
      if (m === 35) this.hud.subtitle('Катер у пристани №3.');
      if (m === 38 && has(this.sim, 'tikhon')) this.hud.subtitle('Тихон у штурвала.');
      if (m === 40) this.hud.subtitle('Пора на пристань.');
      if (m === 44 && flag(this.sim, 'wagonPinPulled')) this.hud.subtitle('Колесо повозки слетело на мосту.');
    }
  }

  // --- ввод ---------------------------------------------------------------
  private handleKeys() {
    const p = this.input;
    if (p.took('Tab')) {
      this.openDevice();
      return;
    }
    if (p.took('KeyE')) this.interact();
    if (p.took('KeyB')) this.addBookmark();
    if (p.took('KeyR')) this.reload();
    if (p.took('Escape') && this.device.open) this.closeDevice();
    if (p.took('KeyF')) this.toggleLang();
    if (p.took('KeyT') && this.waiting) this.bark('Подожду.');
  }

  private setupMouse() {
    this.input.onMouseDown = (b) => {
      if (b === 0 && this.mode === 'play') this.shoot();
    };
  }

  private toggleLang() {
    this.lang = this.lang === 'ru' ? 'en' : 'ru';
    this.hud.hint(this.lang === 'ru' ? 'Русский' : 'English');
  }

  private openDevice() {
    if (this.mode !== 'play') return;
    this.mode = 'device';
    this.deviceTarget = this.sim.t;
    this.device.toggle(true);
    this.device.render(this.deviceState());
    this.input.release();
  }

  private closeDevice() {
    if (this.device.open) this.device.toggle(false);
    this.mode = 'play';
    this.deviceTarget = this.sim.t;
  }

  private addBookmark() {
    const t = Math.round(this.sim.t / 10) * 10;
    if (this.bookmarks.has(t)) this.bookmarks.delete(t);
    else this.bookmarks.add(t);
    this.hud.hint(`Закладка ${fmtMin(t)}`);
    if (this.device.open) this.device.render(this.deviceState());
  }

  // --- взаимодействие -----------------------------------------------------
  private updateInteract() {
    const p = this.player.pos;
    const npc = nearestNpc(this.sim, p.x, p.z, 2.6);
    const item = this.city.nearestItem(p.x, p.z, 1.8);
    const point = this.city.nearestUse(p.x, p.z, 2.4);
    const door = this.city.nearestDoor(p.x, p.z, 2.2);
    let label = '';
    if (npc) label = `${tr('action.talk', this.lang)} · ${NPCS.find((n) => n.id === npc.id)?.ru ?? npc.id}`;
    else if (item) label = `${tr('action.take', this.lang)} · ${this.lang === 'ru' ? item.ru : item.en}`;
    else if (point) label = `${tr('action.use', this.lang)} · ${this.lang === 'ru' ? point.ru : point.en}`;
    else if (door) label = `${door.open ? tr('action.close', this.lang) : tr('action.open', this.lang)} · ${door.ru}`;
    if (label !== this.lastInteract) {
      this.hud.interact(label || null);
      this.lastInteract = label;
    }
  }

  private interact() {
    const p = this.player.pos;
    const item = this.city.nearestItem(p.x, p.z, 1.8);
    if (item) return this.takeItem(item);
    const npc = nearestNpc(this.sim, p.x, p.z, 2.6);
    if (npc) return this.talk(npc.id);
    const point = this.city.nearestUse(p.x, p.z, 2.4);
    if (point) return this.usePoint(point.id);
    const door = this.city.nearestDoor(p.x, p.z, 2.2);
    if (door) return this.useDoor(door.id);
  }

  private takeItem(item: { id: string; item: ItemId; ru: string; en: string; taken?: boolean }) {
    if (item.taken) return;
    if (this.sim.pocket && this.sim.pocket !== item.item) {
      this.hud.hint('В Кармане уже вещь. Одна — больше не перенести.');
      return;
    }
    item.taken = true;
    this.sim.pocket = item.item;
    this.sim.knowledge['item_' + item.item] = this.sim.t;
    this.hud.hint(`${item.ru} — в Кармане`);
    this.bark('Взял.');
    if (item.item === 'key') this.bark('Ключ точёный. На заказ.');
  }

  private useDoor(id: string) {
    const d = this.city.doors.find((x) => x.id === id);
    if (!d) return;
    const minute = this.sim.t / 60;
    if (d.id === 'orven' && minute >= 9.5 && !d.open) {
      learn(this.sim, 'orvenLate');
      this.hud.hint('Заперто. Опоздал минут на пять.');
      this.bark('Заперто.');
      return;
    }
    if (d.id === 'foma' && !d.open) {
      this.startScene('foma');
      return;
    }
    if (d.id === 'tikhon' && !d.open) {
      this.startScene('tikhon');
      return;
    }
    d.open = !d.open;
    if (d.panel) d.panel.visible = !d.open;
    if (d.open && d.id === 'tavern') {
      if (!has(this.sim, 'tavern')) {
        learn(this.sim, 'tavern');
        journal(this.sim, 'agata', 'Агата', 'tavern', undefined, 'Таверна после взрыва: пусто');
      }
      if (minute >= 15 && !has(this.sim, 'tavernSeen')) {
        learn(this.sim, 'tavernSeen');
        learn(this.sim, 'gun');
        message(this.sim, 'krayn1');
      }
    }
    if (d.open && d.id === 'office' && !has(this.sim, 'officeSeen')) learn(this.sim, 'officeSeen');
    if (d.open && d.id === 'shelter' && !has(this.sim, 'shelter')) learn(this.sim, 'shelter');
  }

  private usePoint(id: string) {
    const minute = this.sim.t / 60;
    switch (id) {
      case 'hatch_roof':
        this.player.teleport(-70, -52.8);
        this.hud.hint('Вниз по лестнице.');
        break;
      case 'fuse':
        if (minute <= 4) {
          setFlag(this.sim, 'tapCut');
          learn(this.sim, 'tapDone');
          this.hud.subtitle('Предохранитель в кармане. Город дышит ровнее.');
        } else {
          this.hud.hint('Техник уже ушёл. Нужно вернуться на 22:00.');
        }
        break;
      case 'safe':
        if (has(this.sim, 'safeOpened')) this.hud.hint('Сейф пуст.');
        else if (this.sim.pocket === 'key') this.effect('open_safe');
        else this.hud.hint('Заперт. Нужен ключ — или Гейл.');
        break;
      case 'coat':
        learn(this.sim, 'gun');
        learn(this.sim, 'tavernSeen');
        journal(this.sim, 'agata', 'Агата', 'tavern', undefined, 'Пальто «В.Х.» наверху — пустые карманы');
        message(this.sim, 'krayn1');
        this.hud.subtitle('Пальто с монограммой. Харроу тут бывает. Не сегодня.');
        break;
      case 'book':
        learn(this.sim, 'agniaBook');
        journal(this.sim, 'agnia', 'Матушка Агния', 'shelter_office', undefined, 'Книга «отложенных»: Тимофей, 7 лет');
        if (!has(this.sim, 'book')) {
          learn(this.sim, 'book');
          this.hud.subtitle('«Тимофей, 7 лет — отложен». Чужой рукой: «сбежал».');
        }
        break;
      case 'window':
        this.bark('Тут я вылезал. Двадцать лет назад.');
        break;
      case 'wagon_pin':
        if (!flag(this.sim, 'wagonPinPulled')) {
          setFlag(this.sim, 'wagonPinPulled');
          learn(this.sim, 'wagonPin');
          this.hud.subtitle('Чека выбита. Повозка не доедет.');
        } else this.hud.hint('Чеки нет.');
        break;
      case 'foma_floor':
        if (minute >= 30) {
          learn(this.sim, 'fomaHint');
          this.hud.hint('Здесь стоял ящик. Половица сорвана. Если вернуться назад…');
          this.bark('Здесь была кладовка.');
        } else if (minute >= 14 && minute < 30) {
          if (!flag(this.sim, 'gunTaken')) {
            this.sim.weapon = true;
            this.sim.ammo = 18;
            this.sim.rounds = 6;
            setFlag(this.sim, 'gunTaken');
            learn(this.sim, 'gunTaken');
            this.hud.subtitle('Револьвер и коробка патронов. В барабане шесть.');
            const it = this.city.items.find((i) => i.id === 'gun');
            if (it) it.taken = true;
          }
        } else this.hud.hint('Пусто.');
        break;
      case 'pier3':
        if (has(this.sim, 'tikhon') && minute >= 34) this.startFinale();
        else if (minute < 34) this.hud.hint('Катер придёт к 22:35.');
        else this.hud.hint('Нужна кепка рулевого.');
        break;
      case 'pier7':
        if (minute >= 50) this.hud.hint('Крайн будет здесь к 22:52.');
        else this.hud.hint('Пирс 7. Сюда привезут груз.');
        break;
      case 'helm':
        if (minute >= 44) this.startFinale();
        else this.hud.hint('Катер ещё не отошёл.');
        break;
      case 'warehouse':
        this.hud.hint(minute >= 12 ? 'Ворота сорваны. Внутри огонь.' : 'Заперто.');
        break;
      case 'shelter_gate':
        this.hud.hint('Ворота приюта. Внутрь — через двор.');
        break;
    }
  }

  // --- диалоги ------------------------------------------------------------
  private startScene(id: string, nodeId?: string) {
    const sc = scene(id);
    if (!sc) return;
    this.mode = 'dialog';
    this.scene = sc;
    this.input.release();
    this.showNode(nodeId ?? sc.start);
  }

  private showNode(id: string) {
    if (!this.scene) return;
    const node: Node | undefined = this.scene.nodes[id];
    if (!node) return this.closeDialog();
    this.nodeId = id;
    if (node.effect) this.effect(node.effect);
    this.renderNode(node);
  }

  private renderNode(node: Node) {
    const choices = (node.choices ?? []).filter((c) => this.choiceVisible(c));
    const who = this.whoName(node.who);
    const text = this.lang === 'ru' ? node.ru : node.en;
    const views = choices.map((c, i) => ({
      label: this.lang === 'ru' ? c.ru : c.en,
      hint: this.choiceHint(c),
      index: i + 1,
    }));
    this.pendingChoices = choices;
    this.dlg.show(who, text, views, !!node.next, this.lang);
  }

  private pendingChoices: Choice[] = [];

  private choiceVisible(c: Choice) {
    if (c.ifKnow && !has(this.sim, c.ifKnow)) return false;
    if (c.ifNot && has(this.sim, c.ifNot)) return false;
    if (c.ifItem && this.sim.pocket !== c.ifItem) return false;
    if (c.ifFlag) {
      if (c.ifFlag === 'weapon') { if (!this.sim.weapon) return false; }
      else if (!flag(this.sim, c.ifFlag)) return false;
    }
    return true;
  }

  private choiceHint(c: Choice) {
    if (c.ifKnow) return `⟲ ${fmtMin(this.sim.knowledge[c.ifKnow])}`;
    if (c.ifItem) return `[${itemText(c.ifItem, this.lang).name}]`;
    if (c.ifFlag === 'weapon') return `[${this.lang === 'ru' ? 'револьвер' : 'revolver'}]`;
    if (c.ifFlag) return `[${c.ifFlag}]`;
    return '';
  }

  private whoName(id: string) {
    if (id === 'tik') return this.lang === 'ru' ? 'Тик' : 'Tik';
    if (id === 'krayn') return this.lang === 'ru' ? 'Крайн' : 'Krain';
    if (id === 'device') return this.lang === 'ru' ? 'Створка' : 'Shutter';
    if (id === 'harrow') return this.lang === 'ru' ? 'Харроу' : 'Harrow';
    const n = NPCS.find((x) => x.id === id);
    return n ? (this.lang === 'ru' ? n.ru : n.en) : id;
  }

  private advance() {
    if (!this.scene || !this.nodeId) return this.closeDialog();
    const node = this.scene.nodes[this.nodeId];
    if (!node) return this.closeDialog();
    if (this.pendingChoices.length) return; // ждём выбора
    if (node.next) this.showNode(node.next);
    else this.closeDialog();
  }

  private choose(index: number) {
    const c = this.pendingChoices[index - 1];
    if (!c) return;
    if (c.setKnow) learn(this.sim, c.setKnow);
    if (c.setFlag) setFlag(this.sim, c.setFlag);
    if (c.give) {
      if (!this.sim.pocket || this.sim.pocket === c.give) this.sim.pocket = c.give;
    }
    if (c.take && this.sim.pocket === c.take) this.sim.pocket = null;
    if (c.effect) this.effect(c.effect);
    if (c.goto && this.scene?.nodes[c.goto]) this.showNode(c.goto);
    else if (!c.close) this.closeDialog();
    else this.closeDialog();
  }

  private closeDialog() {
    this.dlg.hide();
    this.scene = null;
    this.nodeId = null;
    this.pendingChoices = [];
    if (this.mode === 'dialog') this.mode = 'play';
  }

  private effect(key: string) {
    const s = this.sim;
    switch (key) {
      case 'give_device': this.hud.subtitle('Створка в левой руке. Красные цифры: 22:03.'); break;
      case 'tutorial_jump':
        this.jumpTo(0);
        setTimeout(() => this.startScene('prologue', 'l4'), 350);
        break;
      case 'prologue_done':
        learn(s, 'prologueDone');
        learn(s, 'orven');
        this.hud.hint('Нить обновилась: Орвен, переулок Ключников.');
        journal(s, 'lydia', 'Лидия', 'tower_roof', undefined, 'Собрала Створку');
        journal(s, 'krayn', 'Эвелина Крайн', 'tower_roof', { ru: 'Он нужен мне живым. На пирсе семь. До без десяти одиннадцать.', en: 'I need him alive. Pier seven. Before ten to eleven.' }, 'Наняла Тика');
        break;
      case 'meet_orven':
        journal(s, 'orven', 'Орвен', 'orven', undefined, 'Ключник порта, должен Крайн');
        break;
      case 'orven_done':
        learn(s, 'orven');
        learn(s, 'ned');
        journal(s, 'orven', 'Орвен', 'orven', { ru: 'Нед, курьер. Рыжий, фуражка с медной бляхой. Ключ он забрал.', en: 'Ned the courier. Red-haired, brass badge. He took the key.' }, 'Отправил к Неду');
        this.hud.hint('Нить: Нед, «Якорь» за мостом.');
        break;
      case 'orven_leave':
        journal(s, 'orven', 'Орвен', 'orven', undefined, 'Ушёл домой');
        break;
      case 'safe_known':
        learn(s, 'safe');
        journal(s, 'orven', 'Орвен', 'orven', { ru: 'Моя бородка. Сейф Гейла. Курьерская контора при складе.', en: 'My bit. Gale’s safe. The courier office by the warehouse.' }, 'Определил ключ');
        break;
      case 'tilda_seen':
        journal(s, 'tilda', 'Тильда', 'alley', { ru: 'Вы девочку не видели? Восемь лет. Анка.', en: 'Have you seen a girl? Eight. Anka.' }, 'Ищет дочь');
        learn(s, 'tildaMet');
        break;
      case 'tilda_done':
        learn(s, 'lukyan');
        journal(s, 'tilda', 'Тильда', 'alley', { ru: 'Детей грузят на баржу. К Лукьяну, на «Веру».', en: 'They’re loading children onto the barge. Lukyan’s Vera.' }, 'Рассказала про приют и баржу');
        break;
      case 'meet_ned':
        journal(s, 'ned', 'Нед', 'bridge_ned', { ru: 'Иди, куда шёл.', en: 'Go where you were going.' }, 'Курьер у перил');
        break;
      case 'ned_talked':
        learn(s, 'ned');
        learn(s, 'tavern');
        journal(s, 'ned', 'Нед', 'bridge_ned', { ru: 'Проиграл выручку, часы, жетон и ключ людям Корда. Всё на столе в «Якоре».', en: 'Lost the takings, my watch, the tag and the key to Kord’s men. All on the Anchor’s table.' }, 'Проиграл ключ');
        this.hud.hint('Нить: таверна «Якорь».');
        break;
      case 'ned_saved':
        setFlag(s, 'nedSaved');
        learn(s, 'nedSaved');
        journal(s, 'ned', 'Нед', 'bridge_ned', { ru: 'Я не прыгнул.', en: 'I didn’t jump.' }, 'Остался жив');
        break;
      case 'ned_gone':
        setFlag(s, 'nedGone');
        break;
      case 'foma_refused':
        learn(s, 'fomaClosed');
        break;
      case 'foma_hint':
        learn(s, 'fomaHint');
        this.hud.hint('Половица в кладовке. Вернуться туда, где стены уже нет.');
        break;
      case 'gale_ring':
        this.giveItem('ring');
        learn(s, 'anna');
        journal(s, 'gale', 'Гейл', 'office_yard', { ru: 'Анна. Жена. Сестрой в приюте на Лукии. Скажи ей — пусть уходит.', en: 'Anna. My wife. A sister at St Lucia. Tell her to leave.' }, 'Ранен, просил предупредить Анну');
        break;
      case 'open_safe':
        learn(s, 'safeOpened');
        learn(s, 'tikhon');
        learn(s, 'wagon');
        this.giveItem('list');
        journal(s, 'gale', 'Гейл', 'office', { ru: 'Подпись моя. Печать склада. Я подписываю, что везут. Не что внутри.', en: 'My signature. The warehouse seal. I sign what’s shipped. Not what’s inside.' }, 'Открыл сейф');
        this.hud.hint('Список рулевых, запасной ключ, перевозочный лист.');
        break;
      case 'anna_warned_gale':
        setFlag(s, 'annaWarned');
        learn(s, 'annaWarned');
        break;
      case 'anna_met':
        journal(s, 'anna', 'Анна', 'shelter_dorm', undefined, 'Сестра милосердия, жена Гейла');
        learn(s, 'annaMet');
        break;
      case 'anna_warned':
        setFlag(s, 'annaWarned');
        learn(s, 'annaWarned');
        journal(s, 'anna', 'Анна', 'shelter_dorm', { ru: 'Задняя калитка. Если двор будет пустой хоть минуту.', en: 'The back gate. If the yard is empty for even a minute.' }, 'Готова вывести детей');
        break;
      case 'anna_guard_count':
        learn(s, 'guards3');
        break;
      case 'anka_ribbon':
        this.giveItem('ribbon');
        learn(s, 'tilda');
        journal(s, 'anka', 'Анка', 'shelter_yard', { ru: 'Передайте ей. Чтобы не волновалась.', en: 'Give her this. So she won’t worry.' }, 'Отдала ленту');
        break;
      case 'agnia_book':
        learn(s, 'agniaBook');
        break;
      case 'book_seen':
        learn(s, 'book');
        journal(s, 'agnia', 'Матушка Агния', 'shelter_office', { ru: 'Ты сбежал за два дня. Я тогда думала — к лучшему.', en: 'You ran two days later. I thought it was for the best.' }, 'Показала книгу «отложенных»');
        break;
      case 'guard_tag':
        learn(s, 'warehouseTag');
        journal(s, 'guard1', 'Охранник', 'shelter_yard', { ru: 'Видишь печать? Вот чьи.', en: 'See the seal? That’s whose.' }, 'Бирка «Склад №2» на кобуре');
        break;
      case 'lukyan_talked':
        learn(s, 'lukyanPaid');
        journal(s, 'lukyan', 'Лукьян', 'barge', { ru: 'Человек от приюта. Конверт с печатью совета.', en: 'A man from the shelter. Envelope with the board seal.' }, 'Возит груз по конверту');
        break;
      case 'tilda_warned':
        setFlag(s, 'tildaWarned');
        learn(s, 'tildaWarned');
        journal(s, 'tilda', 'Тильда', 'pier7', { ru: 'Задняя калитка. Я там стирала.', en: 'The back gate. I washed there.' }, 'Бежит в приют за Анкой');
        break;
      case 'tikhon_turned':
        this.giveItem('cap');
        setFlag(s, 'tikhonTurned');
        learn(s, 'tikhon');
        journal(s, 'tikhon', 'Тихон', 'tikhon', { ru: 'Скажи «Я». И не смотри им в лицо.', en: 'Say “I am.” And don’t look at their faces.' }, 'Отдал кепку и ключ');
        break;
      case 'tikhon_threatened':
        this.giveItem('cap');
        setFlag(s, 'tikhonThreatened');
        learn(s, 'tikhon');
        journal(s, 'tikhon', 'Тихон', 'tikhon', undefined, 'Отдал кепку под стволом');
        break;
      case 'tap_known':
        learn(s, 'tapKnown');
        break;
      case 'tap_cut':
        setFlag(s, 'tapCut');
        learn(s, 'tapDone');
        this.hud.subtitle('Отвод снят. Город дышит ровнее.');
        break;
      case 'fern_talked':
        learn(s, 'fernTalked');
        journal(s, 'fern', 'Ферн', 'square', { ru: 'Колокол молчит. Сорок лет не молчал.', en: 'The bell is silent. First time in forty years.' }, 'Ищет причину');
        break;
      case 'lydia_talked':
        learn(s, 'lydiaTalked');
        learn(s, 'tapKnown');
        journal(s, 'lydia', 'Лидия', 'tower', { ru: 'Впустить техника в 21:55. После — брат дома.', en: 'Let the technician in at 21:55. After that, brother comes home.' }, 'Призналась про подвал');
        break;
      case 'sync_locked':
        learn(s, 'syncLocked');
        message(s, 'krayn4');
        this.hud.subtitle(tr('sync.locked', this.lang));
        break;
      case 'believe':
        learn(s, 'believe');
        this.finish('morning');
        break;
      case 'disbelieve':
        learn(s, 'disbelieve');
        this.finish('postponed');
        break;
      case 'meet_agata':
        journal(s, 'agata', 'Агата', 'tavern', undefined, 'Хозяйка «Якоря»');
        break;
    }
  }

  private giveItem(id: string) {
    if (this.sim.pocket && this.sim.pocket !== id) {
      this.hud.hint('В Кармане уже вещь. Новая заняла её место — прежняя осталась в этом мире.');
    }
    this.sim.pocket = id as ItemId;
  }

  // --- разговоры ----------------------------------------------------------
  private talk(id: string) {
    const minute = this.sim.t / 60;
    switch (id) {
      case 'orven':
        if (this.sim.pocket === 'key' && has(this.sim, 'ned')) return this.startScene('orven_key');
        if (minute >= 9.5) {
          learn(this.sim, 'orvenLate');
          this.hud.hint('Заперто. Опоздал минут на пять.');
          this.bark('Заперто.');
          return;
        }
        return this.startScene('orven');
      case 'ned':
        return this.startScene('ned');
      case 'tilda':
        if (minute >= 20) return this.startScene('tilda_pier');
        return this.startScene('tilda');
      case 'foma':
        if (minute >= 30) return this.startScene('foma_ruin');
        return this.startScene('foma');
      case 'gale':
        if (flag(this.sim, 'jetonStolen') || minute < 14) return this.startScene('gale_healthy');
        return this.startScene('gale_wounded');
      case 'agnia':
        return this.startScene('agnia');
      case 'anna':
        return this.startScene('anna');
      case 'anka':
        return this.startScene('anka');
      case 'lukyan':
        return this.startScene('lukyan');
      case 'tikhon':
        return this.startScene('tikhon');
      case 'fern':
        return this.startScene('fern');
      case 'lydia':
        if (minute >= 40 || has(this.sim, 'tapKnown')) return this.startScene('lydia');
        this.hud.subtitle('Лидия: «Работает? Хорошо. Хоть что-то».');
        return;
      case 'stern':
        return this.startScene('stern');
      case 'guard1':
        if (minute >= 34) return this.startScene('pier3_guard');
        return this.startScene('guard_wagon');
      case 'agata': {
        learn(this.sim, 'tavern');
        if (minute >= 15) {
          learn(this.sim, 'gun');
          learn(this.sim, 'tavernSeen');
          message(this.sim, 'krayn1');
          this.hud.subtitle('Агата: «Восемь человек сидели с вечера. Как бахнуло — все туда. Деньги сгребли».');
          this.hud.hint('Нить: ствол. Лавка Фомы, Рыночная.');
        } else {
          this.hud.subtitle('Агата: «Сиди у стойки. Эти не любят, когда стоят».');
          learn(this.sim, 'gun');
        }
        return;
      }
      case 'krayn':
        this.hud.subtitle('Крайн: «Пирс семь. До без десяти одиннадцать. Не подведите».');
        return;
      default:
        this.hud.subtitle(`${this.whoName(id)}: «Некогда».`);
    }
  }

  // --- прыжок -------------------------------------------------------------
  private jumpBlocked(target: number): string | null {
    const p = this.player.pos;
    if (isWater(p.x, p.z)) return 'Там вода';
    const minute = target / 60;
    if (minute >= 12 && Math.hypot(p.x - 66, p.z - 33) < 14) return 'Там горит';
    if (minute >= 30 && this.sim.flags.tapCut === undefined && Math.hypot(p.x + 40, p.z + 13) < 12) return 'Там горит';
    if (minute >= 12 && Math.hypot(p.x - 66, p.z - 28) < 12) return 'Там горит';
    return null;
  }

  private jumpTo(target: number) {
    if (this.sim.finale) {
      this.hud.subtitle(tr('sync.locked', this.lang));
      return;
    }
    const t = Math.max(0, Math.min(WINDOW, Math.round(target / 10) * 10));
    const why = this.jumpBlocked(t);
    if (why) {
      this.hud.hint(why);
      return;
    }
    const prev = this.sim;
    this.sim = branchState(prev, t);
    this.sim.t = t;
    this.resetWorld();
    this.closeDevice();
    this.dlg.hide();
    if (this.mode === 'dialog') this.mode = 'play';
    this.hud.subtitle(`Прыжок. ${fmtMin(t)}`);
    this.player.update(0.016, this.input, this.city, true);
  }

  private resetWorld() {
    this.dead.clear();
    this.hostiles.clear();
    this.hp = 2;
    for (const d of this.city.doors) {
      d.open = false;
      if (d.panel) d.panel.visible = true;
    }
    for (const it of this.city.items) it.taken = false;
    const fomaDoor = this.city.doors.find((d) => d.id === 'foma');
    if (fomaDoor && this.sim.t / 60 >= 30 && this.sim.flags.tapCut === undefined) {
      fomaDoor.open = true;
      if (fomaDoor.panel) fomaDoor.panel.visible = false;
    }
  }

  private beginPreview(target: number) {
    this.previewSaved = this.sim;
    this.sim = branchState(this.sim, target);
    this.sim.jumps = Math.max(0, this.sim.jumps - 1);
    this.device.el.style.visibility = 'hidden';
    this.showPreviewLabel(target);
  }

  private endPreview() {
    if (this.previewSaved) this.sim = this.previewSaved;
    this.previewSaved = null;
    this.device.el.style.visibility = '';
    this.hidePreviewLabel();
  }

  private showPreviewLabel(t: number) {
    this.hidePreviewLabel();
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:50%;top:44%;transform:translate(-50%,-50%);z-index:21;font:64px "Courier New",monospace;color:#ff3b2f;letter-spacing:.1em;text-shadow:0 0 24px #000;opacity:.92;pointer-events:none';
    d.textContent = fmtMin(t);
    document.body.appendChild(d);
    const cap = document.createElement('div');
    cap.style.cssText = 'position:fixed;left:50%;top:52%;transform:translateX(-50%);z-index:21;font:12px "Courier New",monospace;color:#cfc7b4;letter-spacing:.24em;opacity:.8;pointer-events:none';
    cap.textContent = this.lang === 'ru' ? 'ПРЕДПРОСМОТР' : 'PREVIEW';
    document.body.appendChild(cap);
    this.previewLabel = d;
    d.dataset.cap = '1';
    d.appendChild(cap);
  }

  private hidePreviewLabel() {
    document.querySelectorAll('div[data-cap="1"]').forEach((n) => n.remove());
    this.previewLabel = null;
  }

  // --- оружие и смерть ----------------------------------------------------
  private shoot() {
    if (this.sim.finale) return;
    if (!this.sim.weapon) return;
    if (this.sim.rounds <= 0) {
      this.hud.hint('Пусто. R — перезарядить.');
      return;
    }
    this.sim.rounds--;
    const cam = this.rs.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const p = this.player.pos;
    let hit: NpcView | null = null;
    let best = 0.86;
    const hostileIds = ['ignat', 'lovchiy', 'shram', 'kord', 'guard1', 'guard2', 'guard3'];
    for (const v of npcViews(this.sim)) {
      if (hostileIds.includes(v.id) || this.hostiles.has(v.id)) {
        if (this.dead.has(v.id)) continue;
        const dx = v.x - p.x, dz = v.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 22) continue;
        const dot = (dx / d) * dir.x + (dz / d) * dir.z;
        if (dot > best) { best = dot; hit = v; }
      }
    }
    if (hit) {
      this.dead.add(hit.id);
      this.hostiles.delete(hit.id);
      this.sim.ammo = Math.max(0, this.sim.ammo - 1);
      this.hud.subtitle('Попал.');
      this.learnKill(hit.id);
    } else {
      this.hud.subtitle('Мимо.');
      // выстрел слышно: люди Корда рядом становятся врагами
      for (const v of npcViews(this.sim)) {
        if (hostileIds.includes(v.id) && Math.hypot(v.x - p.x, v.z - p.z) < 20) this.hostiles.add(v.id);
      }
    }
    if (this.hostiles.size) this.lastEnemyShot = this.sim.t;
  }

  private learnKill(id: string) {
    if (id === 'ignat') {
      learn(this.sim, 'key');
      setFlag(this.sim, 'ignatDead');
      this.sim.pocket = this.sim.pocket ?? 'key';
      learn(this.sim, 'tavernCleared');
      this.hud.hint('У Игната в жилете — ключ. Красный.');
    }
    if (id === 'lovchiy') setFlag(this.sim, 'lovchiyDead');
    if (id === 'shram') setFlag(this.sim, 'shramDead');
    journal(this.sim, id, this.whoName(id), 'tavern', undefined, 'Убит');
  }

  private reload() {
    if (!this.sim.weapon) return;
    const need = 6 - this.sim.rounds;
    const take = Math.min(need, this.sim.ammo);
    if (take <= 0) return;
    this.sim.rounds += take;
    this.sim.ammo -= take;
    this.hud.hint('Перезарядил.');
  }

  private enemyFire() {
    if (!this.hostiles.size) return;
    if (this.sim.t - this.lastEnemyShot < 2.2 * 60) return;
    this.lastEnemyShot = this.sim.t;
    const p = this.player.pos;
    let near: NpcView | null = null;
    for (const v of npcViews(this.sim)) {
      if (!this.hostiles.has(v.id) || this.dead.has(v.id)) continue;
      if (Math.hypot(v.x - p.x, v.z - p.z) < 15) near = v;
    }
    if (!near) return;
    if (Math.random() < 0.32) {
      this.hp--;
      this.hud.hurt();
      this.hud.subtitle(this.lang === 'ru' ? 'Попадание.' : 'Hit.');
      if (this.hp <= 0) this.finish('death', `${this.whoName(near.id)} · ${PLACE_RU('tavern')}`);
    }
  }

  private die(by: string) {
    this.finish('death', by);
  }

  private bark(text: string) {
    if (this.sim.t - this.lastBarkAt < 30) return;
    this.lastBarkAt = this.sim.t;
    this.hud.subtitle(text);
  }

  // --- финал --------------------------------------------------------------
  private startFinale() {
    if (this.sim.finale) return;
    this.sim.finale = true;
    this.sim.t = Math.max(this.sim.t, min(46));
    learn(this.sim, 'pier3');
    message(this.sim, 'krayn3');
    this.player.teleport(-40, 64.2);
    this.startScene('finale');
    this.hud.subtitle('Катер идёт вдоль берега.');
  }

  private finish(kind: 'empty' | 'death' | 'postponed' | 'morning', detail = '') {
    if (this.mode === 'end') return;
    this.mode = 'end';
    this.input.release();
    this.dlg.hide();
    this.device.toggle(false);
    this.hud.interact(null);
    const facts = this.facts();
    this.screens.showEnd(kind, this.lang, facts, detail, () => location.reload());
  }

  private facts(): string[] {
    const s = this.sim;
    const f: string[] = [];
    const ru = this.lang === 'ru';
    f.push(flag(s, 'nedSaved')
      ? (ru ? 'Нед: жив, ушёл с моста' : 'Ned: alive, left the bridge')
      : (ru ? 'Нед: погиб на Старом мосту в 22:16' : 'Ned: died on the Old bridge at 22:16'));
    f.push(flag(s, 'annaWarned')
      ? (ru ? 'Гейл: предупреждён, ушёл к жене' : 'Gale: warned, went to his wife')
      : (ru ? 'Гейл: ранен, во дворе склада' : 'Gale: wounded in the warehouse yard'));
    f.push(flag(s, 'tikhonTurned')
      ? (ru ? 'Тихон: дома с Пип' : 'Tikhon: home with Pip')
      : (ru ? 'Тихон: на пристани, за штурвалом' : 'Tikhon: at the pier, at the wheel'));
    f.push(flag(s, 'wagonPinPulled')
      ? (ru ? 'Дети приюта: остались в приюте' : 'Shelter children: stayed at the shelter')
      : (ru ? 'Дети приюта: повозка ушла на пирс 7' : 'Shelter children: the wagon left for pier 7'));
    f.push(flag(s, 'tildaWarned')
      ? (ru ? 'Тильда и Анка: вместе' : 'Tilda and Anka: together')
      : (ru ? 'Тильда: у Корда, Анка на барже' : 'Tilda: taken by Kord, Anka on the barge'));
    f.push(flag(s, 'tapCut')
      ? (ru ? 'Рыночная: цела. Колокол: бил' : 'Market street: intact. The bell: rang')
      : (ru ? 'Рыночная: сгорела. Колокол: молчал' : 'Market street: burned. The bell: silent'));
    if (flag(s, 'jetonStolen')) f.push(ru ? 'Жетон: украден. Налёта на контору не было' : 'Tag: stolen. The office was not raided');
    if (flag(s, 'book')) f.push(ru ? 'Книга приюта: «Тимофей, 7 лет — отложен»' : 'Shelter registry: “Timofey, age 7 — postponed”');
    return f;
  }

  // --- состояние для Створки ---------------------------------------------
  private deviceState() {
    return {
      sim: this.sim,
      thread: currentThread(this.sim),
      lang: this.lang,
      tab: this.device.tab as Tab,
      target: this.deviceTarget || this.sim.t,
      bookmarks: [...this.bookmarks],
      events: timeline(this.sim),
      px: this.player.pos.x,
      pz: this.player.pos.z,
      portrait: (id: string) => this.portrait(id),
      itemName: (id: string) => itemText(id, this.lang),
      names: Object.fromEntries(NPCS.map((n) => [n.id, { ru: n.ru, en: n.en }])),
    };
  }

  private portraits = new Map<string, string | null>();

  private portrait(id: string): string | null {
    if (this.portraits.has(id)) return this.portraits.get(id) ?? null;
    const c = this.people.portrait(id);
    const url = c ? c.toDataURL('image/png') : null;
    this.portraits.set(id, url);
    return url;
  }
}
