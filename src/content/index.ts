import type { Game } from '../game/game';
import { Conv, nameOf } from '../game/dialogue';
import { addInteract, doors, tableTop, world2 } from '../world/interiors';
import { loc, inSite, insideSite, floorY } from '../sim/sites';
import { at, fmt } from '../sim/time';
import { TOWER, world3 } from '../world/tower';
import { ROOF_Y, BASEMENT_Y } from '../sim/npcs';
import { groundH } from '../world/terrain';
import { FOMA_SPOT } from '../world/ruins';
import { prologue, prologue2 } from './d_prologue';
import { tildaPier, fern, lidia, stern } from './d_west';
import { orven, orvenKey, tildaAlley, nedTable, nedThanks, ned, nedAfter, agataBefore, agataAfter, fomaDoor, fomaCaught, fomaAfter } from './d_core';
import { agataFight, ignatTable, scarHunt } from './d_tavern';
import { gaylWounded, gaylWindow, guardGate, agnia, anna, anka, guardCart, safeConv } from './d_east';
import { placed } from '../world/city';
import * as THREE from 'three';
import { addMark } from '../world/marks';
import { lukyan, lukyanDying, tikhonDoor, guardPier, patrol } from './d_pier';
import { finale } from './d_finale';

tikhonDoor.start = c => (c.fl('tikhonKnock') ? 'in' : 'a');
export const CONVS: Conv[] = [nedTable, nedThanks, prologue, prologue2, orven, orvenKey, tildaAlley, tildaPier, ned, nedAfter, fern, lidia, stern, agataAfter, agataBefore, agataFight, ignatTable, scarHunt, fomaDoor, fomaCaught, fomaAfter, gaylWounded, gaylWindow, guardGate, agnia, anna, anka, guardCart, lukyan, lukyanDying, tikhonDoor, guardPier, finale, safeConv, patrol];
const P = (g: Game, id: string) => g.npcs.pose(id);
const near = (g: Game, id: string, x: number, z: number, r: number) => { const p = P(g, id); return !!p && !p.hidden && Math.hypot(p.x - x, p.z - z) < r; };

/** Which conversation an NPC offers right now (A1): depends on game time, where the NPC is and what he is doing, where the player
 *  stands and what he knows. `bark:<line>` = he answers with one line and no tree. null = nothing to say (no prompt shown). */
export function pickConv(id: string, g: Game): string | null {
  const t = g.s.t, f = g.s.flags, s = g.s; const p = P(g, id); if (!p || p.hidden) return null;
  const inTav = insideSite('tavern', p.x, p.z), meIn = (site: string) => insideSite(site, g.player.body.x, g.player.body.z);
  switch (id) {
    case 'lidia': return t >= at(22, 38) ? 'lidia.steps' : (p.y > 20 && s.knows('prologue_done') ? 'bark:(не поднимая головы) Идите. Орвен закрывается рано.' : null);
    case 'crane': return p.y > 20 && s.knows('prologue_done') ? 'bark:Вы ещё здесь? Орвен, Тимофей. Переулок Ключников.' : null;
    case 'fern': return t >= at(22, 7) && p.y < 20 ? 'fern' : (p.y > 20 ? 'bark:Колокол не трогать. Он сорок лет без вас бьёт.' : null);
    case 'stern': return p.y < groundH(-70, -58) - 2 ? 'stern' : null;
    case 'orven': if (s.pocket === 'key') return 'orven.key'; return insideSite('orven', p.x, p.z) && !meIn('orven') ? null : (Math.hypot(p.x + 46, p.z + 33) < 12 ? 'orven' : 'bark:Закрыто, сказал. Завтра.');
    case 'tilda': if (t >= at(22, 3) && t < at(22, 20, 30) && p.z < 0) return 'tilda.alley'; if (p.z > 50 && t < at(22, 33)) return 'tilda.pier'; return null;
    case 'ned': {
      if (f.has('nedLeftEarly')) return t >= f.at('nedLeftEarly')! ? 'ned.thanks' : 'ned.table';
      if (inTav && t < at(22, 3, 30)) return 'ned.table';
      if (t < at(22, 6) || p.walking) return t < at(22, 4) ? 'bark:(сгребает пустые карманы) Отвали. Не до тебя.' : 'bark:Отстань.';
      if (p.a === 'rail' || p.a === 'idle' && Math.abs(p.z - 1.85) < 1) return 'ned';
      return f.has('nedSaved') || f.has('nedKept') ? 'ned.after' : null; }
    case 'agata': if (!inTav) return null; return t < at(22, 12) ? 'agata.before' : (t >= at(22, 15) ? 'agata.after' : 'bark:(шёпотом) Не сейчас. Уходи через двор.');
    case 'ignat': return t < at(22, 12) && !f.has('ignatDead') && inTav ? 'ignat.table' : null;
    case 'lovchiy': case 'cm1': case 'cm2': case 'cm3': case 'cm4': case 'cm5': case 'cm6': return inTav && t < at(22, 12) ? 'bark:(не глядя) Проходи, проходи.' : null;
    case 'scar': return f.has('jetonStolen') && t >= at(22, 4) && t < at(22, 6) ? 'scar.angry' : (inTav ? 'bark:(смотрит сквозь тебя) Мы знакомы?' : null);
    case 'foma': if (insideSite('foma', p.x, p.z)) return null; return t >= at(22, 30) ? 'foma.after' : null; // through the door: see the door handler
    case 'gayl': if (p.a === 'die' && t >= at(22, 13)) return 'gayl.wounded'; if (insideSite('contora', p.x, p.z) && t < at(22, 10, 30)) return 'gayl.window'; return null;
    case 'ggrd1': case 'ggrd2': case 'ggrd3': return !f.has('gateOpen') && near(g, id, 49.4, -49, 7) && t < at(22, 40) ? 'guard.gate' : (t >= at(22, 30) ? 'guard.cart' : null);
    case 'agnia': return insideSite('priyut', p.x, p.z) ? 'agnia' : null;
    case 'anna': return 'anna';
    case 'anka': return t >= at(22, 28) && t < at(22, 38, 30) ? 'anka' : null;
    case 'lukyan': return p.a === 'die' ? 'lukyan.dying' : (t < at(22, 33) ? 'lukyan' : null);
    case 'tikhon': return (s.knows('know_helmsmen') || s.knows('know_tikhon')) && t < at(22, 36) && !f.has('tikhonTurned') && !f.has('tikhonHurt') && !f.has('tikhonDead') ? 'tikhon.door' : null;
    case 'patrol1': case 'patrol2': return !f.has('patrolPassed') ? 'patrol' : null;
    case 'dock1': case 'dock2': case 'dock3': return t >= at(22, 35) && t < at(22, 40) ? 'guard.pier3' : null;
    default: return null;
  }
}
/** doors that are a conversation: Foma speaks through his only while he is inside, you are outside and the fire has not started (D6) */
export function doorTalk(id: string, g: Game): string | null {
  const t = g.s.t; if (id === 'foma.door') { const fm = P(g, 'foma'); if (!fm || fm.hidden || !insideSite('foma', fm.x, fm.z) || insideSite('foma', g.player.body.x, g.player.body.z)) return null;
    if (t >= at(22, 28)) return 'bark:(за дверью долгий кашель) Чем это… Газом, что ли, тянет?..'; return 'foma.door'; }
  if (id === 'contora.door') return t < at(22, 10, 30) ? 'gayl.window' : null;
  if (id === 'priyut.gate') return 'guard.gate';
  return null;
}

// ---------------- NPC <-> NPC scenes, heard as world subtitles within 8 m (spec 15.3)
interface Scene { t: number; who: string; ru: string; x: number; z: number; r?: number; keep?: string; }
const tv = (lx: number, lz: number) => loc('tavern', lx, lz);
export const SCENES: Scene[] = [
  { t: at(22, 0, 40), who: 'ignat', ru: 'Часы. Ставишь?', ...tv(0.2, -3.6) }, { t: at(22, 0, 46), who: 'ned', ru: 'Отцовские.', ...tv(0.2, -3.6) }, { t: at(22, 0, 52), who: 'ignat', ru: 'Значит, дорогие. Бросай.', ...tv(0.2, -3.6) }, { t: at(22, 1, 2), who: 'lovchiy', ru: 'Пара. Мимо, курьер.', ...tv(0.2, -3.6) },
  { t: at(22, 2, 40), who: 'ned', ru: 'Последний. Жетон и ключ. На всё.', ...tv(0.2, -3.6) }, { t: at(22, 2, 46), who: 'ignat', ru: 'Ключ? Чей ключ?', ...tv(0.2, -3.6) }, { t: at(22, 2, 52), who: 'ned', ru: 'Неважно. Железный. Тяжёлый. Ставлю.', ...tv(0.2, -3.6) }, { t: at(22, 3, 2), who: 'ignat', ru: 'Три шестёрки. Забираю.', ...tv(0.2, -3.6) },
  { t: at(22, 3, 10), who: 'ned', ru: 'Ты кидал два раза! Я видел, сука, ты кидал два раза!', ...tv(0.2, -3.6) }, { t: at(22, 3, 20), who: 'ignat', ru: '(встаёт) Повтори.', ...tv(0.2, -3.6) }, { t: at(22, 3, 30), who: 'ned', ru: 'Я… (пятится) Ничего.', ...tv(0.2, -3.6) }, { t: at(22, 3, 40), who: 'lovchiy', ru: 'Иди, курьер. Пока ноги есть.', ...tv(0.2, -3.6) },
  { t: at(22, 4, 5), who: 'scar', ru: 'Жетон продашь?', ...tv(0.2, -3.6) }, { t: at(22, 4, 10), who: 'ignat', ru: 'Двадцать.', ...tv(0.2, -3.6) }, { t: at(22, 4, 15), who: 'scar', ru: 'Пятнадцать.', ...tv(0.2, -3.6) }, { t: at(22, 4, 20), who: 'ignat', ru: 'Двадцать. Он счастливый.', ...tv(0.2, -3.6) }, { t: at(22, 4, 45), who: 'scar', ru: 'В двенадцать. Не высовывайтесь.', ...tv(0, -1) },
  { t: at(22, 12, 1), who: 'lovchiy', ru: 'Склад!', ...tv(0.2, -3.6), r: 14 }, { t: at(22, 12, 5), who: 'ignat', ru: 'Все туда! Мы с Ловчим — деньги.', ...tv(0.2, -3.6), r: 14 },
  { t: at(22, 24, 5), who: 'tilda', ru: 'Лукьян! Лукьян, где моя дочь?', x: -5.7, z: 60.2, r: 14 }, { t: at(22, 24, 12), who: 'lukyan', ru: 'Иди домой, женщина. Нет тут никого.', x: -4, z: 62, r: 14 }, { t: at(22, 24, 20), who: 'tilda', ru: 'Мне сказали — у тебя.', x: -5.7, z: 60.2, r: 14 },
  { t: at(22, 24, 28), who: 'lukyan', ru: 'Тебе сказали. Мне тоже много чего говорят. Иди.', x: -4, z: 62, r: 14 }, { t: at(22, 24, 38), who: 'tilda', ru: 'Ты летом двоих из Слободки возил. Я знаю.', x: -5.7, z: 60.2, r: 14 }, { t: at(22, 25, 0), who: 'lukyan', ru: 'Ты что знаешь? Ты прачка. Иди стирать.', x: -5, z: 61, r: 14 },
  { t: at(22, 30, 0), who: 'tilda', ru: 'Пусти на баржу. Я посмотрю и уйду.', x: -5.7, z: 60.2, r: 14 }, { t: at(22, 30, 8), who: 'lukyan', ru: 'Сойди со сходни.', x: -5, z: 61, r: 14 }, { t: at(22, 33, 0), who: 'tilda', ru: '(вынимает револьвер) Где. Моя. Дочь.', x: -5.7, z: 60.2, r: 14 }, { t: at(22, 33, 4), who: 'lukyan', ru: 'Ты не выстре…', x: -5, z: 61, r: 14 },
  { t: at(22, 34, 10), who: 'cord', ru: 'В машину её. (Лукьяну) Встать можешь? Нет? Лежи.', x: -7, z: 58, r: 16 },
  { t: at(22, 20, 10), who: 'pip', ru: 'Пап, а ты завтра придёшь?', ...loc('tikhon', 0, -3.4), r: 9 }, { t: at(22, 20, 16), who: 'tikhon', ru: 'Приду. Спи.', ...loc('tikhon', 0, -3.4), r: 9 }, { t: at(22, 20, 24), who: 'pip', ru: 'А если не придёшь?', ...loc('tikhon', 0, -3.4), r: 9 },
  { t: at(22, 20, 32), who: 'tikhon', ru: '(пауза) Тогда к тебе придёт матушка Агния. С пирогом.', ...loc('tikhon', 0, -3.4), r: 9 }, { t: at(22, 20, 40), who: 'pip', ru: 'С каким?', ...loc('tikhon', 0, -3.4), r: 9 }, { t: at(22, 20, 46), who: 'tikhon', ru: 'С капустой. Спи.', ...loc('tikhon', 0, -3.4), r: 9 },
  { t: at(22, 35, 3), who: 'yan', ru: 'Всё, ребята, я своё отстоял. Кто на смену?', x: -42, z: 72, r: 16 }, { t: at(22, 35, 9), who: 'dock1', ru: 'Сейчас придёт. Пройдись с нами.', x: -42, z: 70, r: 16 }, { t: at(22, 35, 15), who: 'yan', ru: 'Куда пройтись? Я домой…', x: -42, z: 68, r: 16 }, { t: at(22, 35, 36), who: 'dock1', ru: 'Тихон где?', x: -42, z: 64, r: 16 },
  { t: at(22, 2, 5), who: 'orven', ru: '(запирает дверь, бормочет) Три часа. Хватит с неё трёх часов.', ...loc('orven', 1.25, 1.2), r: 7 },
];
const shown = new Set<number>();

export function registerWorldItems(g: Game) {
  // visible stakes on the players' table, and the red accent on whatever the current thread points at
  { const steel = new THREE.MeshStandardMaterial({ color: 0x8a8a88, metalness: 0.8, roughness: 0.35 }), brass = new THREE.MeshStandardMaterial({ color: 0xb89a50, metalness: 0.8, roughness: 0.3 }), cop = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8, roughness: 0.35 });
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, dx: number, dz: number, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(tableTop.x + dx, tableTop.y + 0.012, tableTop.z + dz); m.rotation.y = ry; g.scene.add(m); return m; };
    addMark(mk(new THREE.BoxGeometry(0.17, 0.02, 0.045), steel, 0.6, 0.1, 0.4), c => c.s.knows('saw_key_lost') || c.s.knows('know_safe'), c => c.s.t >= at(22, 3, 2) && c.s.t < at(22, 12) && !c.s.worldItems.has('key') && c.s.pocket !== 'key' && !c.fl('nedLeftEarly'));
    addMark(mk(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 14), cop, 0, 0.4), c => c.s.knows('saw_token_table'), c => c.s.t >= at(22, 3, 2) && c.s.t < at(22, 4, 20) && !c.s.worldItems.has('jeton') && !c.fl('nedLeftEarly'));
    addMark(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 14), brass, -1.0, 0), c => false, c => c.s.t >= at(22, 1, 5) && c.s.t < at(22, 12) && !c.s.worldItems.has('watch') && !c.fl('nedLeftEarly')); }
  { const cp = loc('tikhon', -2.6, -0.8), hook = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.09, 14), new THREE.MeshStandardMaterial({ color: 0x1c1c1e })); hook.position.set(cp.x, floorY('tikhon') + 1.55, cp.z); g.scene.add(hook); addMark(hook, c => c.s.thread === 'pier3' || c.s.thread === 'tikhon', c => !c.s.worldItems.has('cap') && c.s.pocket !== 'cap'); }
  addMark(world2.bookMesh, c => c.s.thread === 'anna' || c.s.thread === 'wagon', () => true);
  addMark(world2.safeMesh, c => c.s.pocket === 'key' || c.s.thread === 'safe' || c.s.thread === 'safe_early', () => true);
  { const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x555555 })); pin.rotation.z = Math.PI / 2; pin.position.set(52.2, groundH(52.2, -57.3) + 0.5, -57.3); g.scene.add(pin); addMark(pin, c => c.s.thread === 'wagon' || c.s.knows('know_guard_smoke'), c => !c.s.flags.has('wagonPinPulled') && c.s.t >= at(22, 15) && c.s.t < at(22, 44)); }
  const need = (c: Game, id: string) => !c.s.worldItems.has(id);
  const take = (c: Game, id: string, item: 'watch' | 'jeton' | 'key' | 'cap' | 'note', label: string, flag?: () => void) => { c.s.worldItems.add(id); if (c.s.pocket && c.s.pocket !== item) c.hud.toast(`В Кармане уже было: ${c.s.pocket}. Оно останется здесь.`, 3); c.give(item); flag?.(); c.hud.bark(label, true); };
  const watchCheck = (c: Game): boolean => { // is somebody at the table looking at you? (spec 8.2)
    const t = c.s.t; if (t >= at(22, 3, 8) && t <= at(22, 3, 45)) return false; // everyone watches the row
    const b = c.player.body; for (const id of ['ignat', 'lovchiy', 'cm1', 'cm2', 'cm3', 'cm4', 'cm5', 'cm6', 'agata']) { if (id === 'agata') continue; const q = c.npcs.pose(id); if (!q || q.hidden) continue; const dx = b.x - q.x, dz = b.z - q.z, d = Math.hypot(dx, dz); if (d > 4.5) continue; const a = Math.atan2(dx, dz) - q.ry, da = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); if (da < 0.44) return true; } return false; };
  const steal = (c: Game, id: string, item: 'watch' | 'jeton' | 'key', label: string, flag?: () => void) => { c.advance(1); if (watchCheck(c)) { c.combat.alarm('theft'); c.hud.bark('Эй! Ты что берёшь?!', true); return; } take(c, id, item, label, flag); };
  // --- tavern table: watch, token, key (spec 9.1, 8.2)
  addInteract({ id: 'tav.watch', x: tableTop.x - 1.0, y: tableTop.y, z: tableTop.z, r: 2.6, ok: c => c.s.t >= at(22, 1, 5) && c.s.t < at(22, 12) && need(c, 'watch') && !c.fl('nedLeftEarly'), label: () => 'Взять часы', use: c => steal(c, 'watch', 'watch', 'Отцовские часы.') });
  addInteract({ id: 'tav.jeton', x: tableTop.x, y: tableTop.y, z: tableTop.z + 0.4, r: 2.6, ok: c => c.s.t >= at(22, 3, 2) && c.s.t < at(22, 4, 20) && need(c, 'jeton') && !c.fl('nedLeftEarly'), label: () => 'Взять жетон', use: c => steal(c, 'jeton', 'jeton', 'Жетон №17.', () => { c.flag('jetonStolen'); c.learn('saw_token_table'); }) });
  addInteract({ id: 'tav.key', x: tableTop.x + 0.6, y: tableTop.y, z: tableTop.z, r: 2.6, ok: c => c.s.t >= at(22, 3, 2) && c.s.t < at(22, 12) && need(c, 'key') && !c.fl('nedLeftEarly'), label: () => 'Взять ключ', use: c => steal(c, 'key', 'key', 'Ключ точёный. На заказ.', () => c.learn('saw_key_lost')) });
  addInteract({ id: 'tav.keyBody', x: 0, y: 0, z: 0, r: 2, at: c => { const q = c.npcs.pose('ignat'); return q && c.s.flags.has('ignatDead') && !q.hidden ? { x: q.x, y: q.y, z: q.z } : null; }, ok: c => need(c, 'keyBody'), label: () => 'Обыскать Игната: ключ', use: c => take(c, 'keyBody', 'key', 'Ключ. Красный в темноте.', () => c.learn('saw_key_lost')) });
  // the interactable above has no fixed position: patch consider() via a position getter
  // --- the coat upstairs
  { const w = world2.coat; addInteract({ id: 'coat', x: w.x, y: w.y, z: w.z, r: 1.8, label: () => 'Осмотреть пальто', use: c => { c.hud.bark('«В.Х.». Здесь Харроу бывает. Не сегодня.', true); c.learn('saw_coat'); c.note('coat', 'Пальто с монограммой «В.Х.» наверху в «Якоре». Ложный след.', 'A coat monogrammed "V.H." upstairs at the Anchor. A false lead.'); if (c.s.t > at(22, 15) && !c.has('key')) c.message('Пальто ничего не значит. Харроу нужен живым. Без ствола к людям Корда не суйся. У Фомы есть.', 'The coat means nothing. I need Harrow alive. Do not go near Cord\'s men without a gun. Foma has one.'); c.thread('gun'); } }); }
  // --- Foma's floorboard: the revolver and 18 rounds (intact shop only)
  { const fp = FOMA_SPOT(); addInteract({ id: 'foma.board', x: fp.x, y: floorY('foma'), z: fp.z, r: 1.3, ok: c => !c.fomaRuinOn() && !c.s.flags.has('gunTaken'), label: c => c.s.hasGun ? 'Ящик под половицей' : 'Поднять половицу', use: c => {
    if (c.s.hasGun) { c.hud.bark('Пусто. Ствол уже у меня.', true); return; }
    c.flag('gunTaken'); c.s.hasGun = true; c.s.mag = 6; c.s.ammo = 18; c.notify('Взято: револьвер, 6 в барабане и 18 патронов'); c.hud.toast('1 — достать револьвер · ПКМ — прицел · ЛКМ — выстрел · R — перезарядка', 7); c.learn('have_gun'); c.hud.bark('Револьвер. Шесть в барабане.', true); c.thread('fight'); c.note('gun', 'Нашёл револьвер и коробку патронов под половицей в кладовке Фомы.', 'Found a revolver and a box of rounds under the floorboard in Foma\'s storeroom.');
 } }); }
  // --- tower: hatch, door, cellar
  addInteract({ id: 'tower.hatch', x: TOWER.hatch.x, y: ROOF_Y(), z: TOWER.hatch.z, r: 2.2, label: c => c.s.knows('prologue_done') ? 'Спуститься (≈1 мин)' : null, use: c => travel(c, TOWER.foot.x, TOWER.foot.z, 60, 'Лестница вниз.') });
  addInteract({ id: 'tower.door', x: TOWER.foot.x, y: groundH(TOWER.foot.x, TOWER.foot.z), z: TOWER.foot.z + 0.3, r: 1.8, label: () => 'Подняться на крышу (≈1 мин)', use: c => travel(c, TOWER.roofSpawn.x, TOWER.roofSpawn.z, 60, 'Винтовая лестница.', ROOF_Y()) });
  addInteract({ id: 'tower.cellar', x: TOWER.cellarDoor.x, y: groundH(TOWER.cellarDoor.x, TOWER.cellarDoor.z), z: TOWER.cellarDoor.z, r: 1.8, label: c => (c.s.t < at(22, 5) ? 'Спуститься в подвал' : 'Дверь подвала (заперта)'), use: c => { if (c.s.t >= at(22, 5)) { c.hud.bark('Заперто.', true); c.learn('cellar_locked'); return; } travel(c, TOWER.cellarIn.x, TOWER.cellarIn.z - 1.0, 5, 'Вниз.', BASEMENT_Y()); } });
  addInteract({ id: 'cellar.up', x: TOWER.cellarIn.x, y: BASEMENT_Y(), z: TOWER.cellarIn.z - 1.3, r: 2.0, ok: c => c.player.body.y < groundH(-70, -58) - 2, label: () => 'Подняться', use: c => travel(c, TOWER.cellarDoor.x + 1.4, TOWER.cellarDoor.z, 5, 'Наверх.') });
  addInteract({ id: 'cellar.fuse', x: TOWER.fuse.x, y: BASEMENT_Y(), z: TOWER.fuse.z + 0.6, r: 1.6, ok: c => !c.s.flags.has('tapCut') && c.player.body.y < groundH(-70, -58) - 2, label: c => c.s.knows('know_fuse') ? 'Выдернуть предохранитель' : 'Осмотреть коробку', use: c => { if (!c.s.knows('know_fuse') && !(c.npcs.pose('stern') && !c.npcs.pose('stern')!.hidden)) { c.hud.bark('Провода, клеммы. Не разберу, что тут что.', true); c.learn('saw_cellar_box'); return; } const st = c.npcs.pose('stern'); if (st && !st.hidden && c.s.t < at(22, 4) && Math.hypot(st.x - TOWER.fuse.x, st.z - TOWER.fuse.z) < 5) { c.runner.start('stern'); return; } c.flag('tapCut'); c.learn('cut_tap'); if (world3.fuse) world3.fuse.visible = false; c.message('Свет ровный. Город изменился.', 'The lights are steady. The city has changed.'); c.note('fuse', 'Выдернул красный предохранитель отвода в подвале башни.', 'Pulled the red fuse of the tap in the tower cellar.'); c.hud.bark('Предохранитель. Красный.', true); } });
  addInteract({ id: 'roof.chest', x: -73.9, y: ROOF_Y(), z: -56.2, r: 1.8, ok: c => c.s.t >= at(22, 15) && need(c, 'note'), label: () => 'Ящик Лидии: записка', use: c => { take(c, 'note', 'note', 'Записка с печатью совета.'); c.learn('know_lidia_note'); c.note('note', 'Записка Лидии: «Впустить техника в 21:55. После — брат дома». Машинопись, печать попечительского совета, подписи нет.', 'Lidia\'s note: "Let the technician in at 21:55. After — brother home." Typed, board seal, no signature.'); } });
  // --- Tikhon's cap (house, when he is gone) and the orphanage cart pin
  { const cp = loc('tikhon', -2.6, -0.8); addInteract({ id: 'cap', x: cp.x, y: floorY('tikhon'), z: cp.z, r: 1.6, ok: c => need(c, 'cap') && (c.s.t >= at(22, 28, 30) || c.fl('tikhonTurned')) && c.s.pocket !== 'cap', label: () => 'Взять кепку рулевого', use: c => take(c, 'cap', 'cap', 'Не поднимать голову.', () => { c.learn('know_helm'); c.thread('pier3'); }) });
    const np = loc('tikhon', 0.4, -3.1); addInteract({ id: 'tikhon.note', x: np.x, y: floorY('tikhon'), z: np.z, r: 1.8, ok: c => c.s.t >= at(22, 28), label: () => 'Записка на столе', use: c => { c.hud.sub('', '«Пип, если не вернусь — иди к матушке Агнии. Деньги в коробке. Папа»', 5); c.note('tnote', 'Записка Тихона: «Пип, если не вернусь — иди к матушке Агнии. Деньги в коробке. Папа».', 'Tikhon\'s note: "Pip, if I do not come back, go to Mother Agnia. The money is in the box. Papa."', 'tikhon'); } }); }
  addInteract({ id: 'cart.pin', x: 52.2, y: groundH(52.2, -57.3), z: -57.3, r: 2.4, ok: c => c.s.t >= at(22, 15) && c.s.t < at(22, 38) && !c.s.flags.has('wagonPinPulled'), label: () => 'Выбить чеку с оси', use: c => {
    const g1 = [1, 2, 3].map(i => c.npcs.pose('ggrd' + i)!).filter(Boolean); const watching = g1.some(q => !q.hidden && Math.hypot(q.x - 52, q.z + 57) < 9);
    if (watching) { c.hud.bark('Охрана смотрит.', true); return; } c.advance(3); c.flag('wagonPinPulled'); c.learn('pin_pulled'); c.hud.toast('Чека выбита', 2.5); c.note('pin', 'Выбил чеку с оси повозки приюта.', 'Knocked the linchpin out of the orphanage wagon axle.'); } });
  addInteract({ id: 'book', x: world2.book.x, y: world2.book.y, z: world2.book.z, r: 1.8, label: () => 'Книга записей', use: c => { c.learn('know_ledger'); c.hud.bark('«Тимофей, 7 лет, родных нет — отложен».', true); c.note('ledger', 'Книга приюта: «Тимофей, 7 лет, родных нет — отложен», ниже: «сбежал». У сегодняшних четырнадцати — «отложен».', 'Orphanage ledger: "Timofey, 7, no kin — set aside", below: "ran away". Today\'s fourteen are marked "set aside".', 'agnia', true); } });
  addInteract({ id: 'laundry.in', x: 34.6, y: groundH(34.6, -71), z: -71, r: 1.8, label: () => 'Влезть в окно прачечной', use: c => { c.hud.bark('Тут я вылезал. Двадцать лет назад.', true); c.learn('know_laundry'); travel(c, 38.2, -71, 4, 'Двор приюта.'); } });
  addInteract({ id: 'laundry.out', x: 37.9, y: groundH(37.9, -71), z: -71, r: 1.8, label: () => 'Вылезти через окно', use: c => travel(c, 33.8, -71, 4, 'Снаружи.') });
  // --- the safe upstairs in the courier office
  { const sf = world2.safe; addInteract({ id: 'contora.safe', x: sf.x, y: sf.y - 1.1, z: sf.z, r: 2.0, label: c => (c.cs.safeBlown ? 'Сейф' : (c.s.pocket === 'key' || c.fl('safeOpened') ? 'Открыть сейф' : 'Сейф (нужен ключ)')), use: c => {
    if (c.cs.safeBlown) { c.hud.bark('Дверца сорвана. Бумаги горят.', true); c.learn('saw_safe_blown'); c.thread('safe_early'); return; }
    if (c.s.pocket !== 'key' && !c.fl('safeOpened')) { c.hud.bark('Замочная скважина. Нужен тот самый ключ.', true); return; }
    c.flag('safeOpened'); c.runner.start('safe'); } }); }
  // --- every closed house has a locked door (spec 5.2); the laundry window at the orphanage
  for (const h of placed) { if (h.hollow || h.id === 'tower' || h.id === 'warehouse' || h.id === 'chapel' || h.id === 'blk' || h.id === 'D8' || h.id === 'foma' || h.id === 'post') continue;
    addInteract({ id: 'door:' + h.id, x: h.door.x, y: h.base + 0.4, z: h.door.z, r: 1.5, label: () => 'Дверь', use: c => { c.hud.bark('Заперто.', true); c.snd.play('rpg_foley/metal_latch.ogg', 0.4); } }); }
  addInteract({ id: 'warehouse.gate', x: 66, y: 0, z: 21.6, r: 3, label: () => 'Ворота склада', use: c => c.hud.bark(c.cs.blast ? 'Ворота сорваны. Внутри огонь.' : 'Заперто.', true) });
  addInteract({ id: 'post.door', x: -22, y: 0, z: -13.4, r: 2.0, label: () => 'Почта', use: c => c.hud.bark('Заперто.', true) });
  addInteract({ id: 'foma.hint', x: -40, y: 0, z: -13.6, r: 1.5, ok: c => c.fomaRuinOn(), label: () => 'Осмотреть руины', use: c => { c.hud.bark('Здесь была кладовка.', true); } });
}
/** fade, move the player, spend game time (tower stairs) */
function travel(c: Game, x: number, z: number, secs: number, bark: string, y?: number) {
  if (c.fadeBusy) return; c.fadeBusy = true; c.hud.fade(true, 350);
  setTimeout(() => { c.advance(secs); const b = c.player.body; b.x = x; b.z = z; b.y = y ?? groundH(x, z); b.vy = 0; b.vx = b.vz = 0; c.player.apply(); c.hud.fade(false, 500); c.hud.bark(bark, true); c.fadeBusy = false; }, 420);
}

export function onBark(g: Game, evt: string) {
  const s = g.s, t = s.t, b = g.player.body;
  if (evt === 'universe') { shown.clear(); if (s.knows('prologue_jumped') && !s.knows('prologue_done') && !g.runner.active) setTimeout(() => g.runner.start('prologue2'), 600); return; }
  if (evt.startsWith('locked:')) { const id = evt.slice(7); if (id === 'orven.door' && t >= at(22, 2)) { g.hud.sub('', 'Записка на двери: «Ушёл в 22:02. Буду через 3 часа. — О.»', 5); g.learn('know_orven_left'); g.learn('saw_orven_locked'); if (s.thread === 'orven') g.thread('orven_late'); g.thought('orven_late', 'Две минуты одиннадцатого. Разминулись. Колёсико — назад, к двум минутам.'); return; } const dc = doorTalk(id, g); if (id === 'tikhon.door') { if (s.knows('know_helmsmen') || s.knows('know_tikhon')) { if (!g.runner.active) g.runner.start('tikhon.door'); } else g.hud.bark('Заперто. В окне свет.', true); return; } if (dc && !g.runner.active) g.talkTo(id === 'foma.door' ? 'foma' : id === 'contora.door' ? 'gayl' : id === 'priyut.gate' ? 'ggrd1' : '', dc); return; }
  if (evt.startsWith('event:')) {
    const e = evt.slice(6);
    if (e === 'blast') { g.learn('saw_blast'); g.hud.bark('Склад…', true); g.shake(1.6); g.snd.boom(1, 1.6, 70); g.hud.flash(0.8); setTimeout(() => g.hud.flash(0), 160); }
    if (e === 'rynok_burns') { g.learn('know_fire_2230'); g.thought('rynok', 'Рыночная горит. И лавка Фомы с ней.'); }
    if (e === 'tilda_shoots') { g.learn('saw_tilda_shoot'); g.shake(0.4); g.snd.shot(); }
    if (e === 'yan_killed') { g.learn('saw_yan_killed'); g.note('yan', 'Яна убили на пристани №3 сразу после швартовки. Охрана Харроу.', 'Yan was killed on pier 3 right after mooring. Harrow\'s guards.', 'yan', true); g.thread('pier3'); }
    if (e === 'lamps_flicker' && !g.fl('tapCut')) g.hud.bark('Весь город мигает. Не к добру.');
    if (e === 'bell_silent') g.learn('saw_bell_silent');
    if (e === 'ned_jump' && !g.fl('nedSaved') && !g.fl('nedKept') && !g.fl('nedLeftEarly')) { g.learn('saw_ned_jump'); g.splash(0.6, 4.0); g.thought('ned_jumped', s.knows('know_ned_lost') ? 'В десять он сидел в «Якоре». Живой. С ключом. Найду ствол — вернусь туда раньше.' : 'Прыгнул. Даже не обернулся.'); }
    return;
  }
  if (evt !== 'tick') return;
  const bx = b.x, bz = b.z;
  if (!g.runner.active && !g.open) {
    // D3: Tilda steps up to you herself, once a branch
    const td = g.npcs.pose('tilda'); if (td && !td.hidden && t >= at(22, 3) && t < at(22, 20, 30) && td.z < 0 && Math.hypot(td.x - bx, td.z - bz) < 4 && !s.talks.get('tilda') && !s.thoughts.has('tilda_auto')) { s.thoughts.add('tilda_auto'); g.talk('tilda', 'tilda.alley'); }
    // D6: appear in the closed storeroom and Foma hears you after a few seconds
    const fm = g.npcs.pose('foma'); const inStore = insideSite('foma', bx, bz) && bz - (-14.4) < -5.2; // behind the partition = the storeroom
    if (inStore && fm && !fm.hidden && insideSite('foma', fm.x, fm.z) && t < at(22, 30) && !s.thoughts.has('foma_caught')) { g.fomaT += 1 / 60; if (g.fomaT > 4) { s.thoughts.add('foma_caught'); g.talkHold = { id: 'foma', ...loc('foma', 1.8, -5.0), y: floorY('foma'), ry: Math.PI, a: 'lantern' }; g.talkTo('foma', 'foma.caught'); } } else if (!inStore) g.fomaT = 0;
  }
  if (s.knows('prologue_done') && b.y > 20) { g.roofT += 1 / 60; if (g.roofT > 30) g.thought('go_orven', 'Орвен. Переулок Ключников.', 'orven_met'); } else g.roofT = 0;
  // --- scenes
  SCENES.forEach((sc, i) => { if (!shown.has(i) && t >= sc.t && t < sc.t + 6 && Math.hypot(sc.x - b.x, sc.z - b.z) < (sc.r ?? 8)) { shown.add(i); g.hud.sub(nameOf(sc.who), sc.ru, 3.2); } });
  // --- B6: Tik thinks aloud, once per event per branch
  { const nd = g.npcs.pose('ned'); if (nd && !nd.hidden && nd.a === 'rail' && Math.hypot(nd.x - bx, nd.z - bz) < 16) { const fx = -Math.sin(g.player.yaw), fz = -Math.cos(g.player.yaw), dd = Math.hypot(nd.x - bx, nd.z - bz); if ((nd.x - bx) * fx / dd + (nd.z - bz) * fz / dd > 0.6) g.thought('ned_seen', s.knows('know_ned_desc') ? 'Рыжий, фуражка с бляхой… Курьер Орвена.' : 'Парень у перил. Мокнет, не уходит.'); } }
  if (g.fomaRuinOn() && insideSite('foma', bx, bz, -0.5)) g.thought('foma_ruin', s.knows('know_foma_guns') ? 'Всё выгорело. А стволы он держал… в кладовке. Где-то тут.' : 'Всё выгорело. Ничего не осталось.');
  if (g.sceneInside === 'tavern' || insideSite('tavern', b.x, b.z)) {
    if (t >= at(22, 15)) g.thought('tavern_empty', 'Пусто. Ушли к складу. Надо раньше — до четверти одиннадцатого.');
    else if (t < at(22, 12)) g.thought('tavern_guns', s.hasGun ? 'Восемь стволов. Сейчас не время.' : 'Восемь стволов. А у меня только руки.');
    if (t > at(22, 3, 2) && t < at(22, 12) && Math.hypot(b.x - tableTop.x, b.z - tableTop.z) < 5 && !s.knows('saw_key_lost')) { g.learn('saw_key_lost'); g.learn('know_ned_lost'); g.hud.bark('Ключ точёный. На заказ.', true); }
    if (t > at(22, 3, 2) && t < at(22, 4, 20) && Math.hypot(b.x - tableTop.x, b.z - tableTop.z) < 5) g.learn('saw_token_table');
  }
  // --- Crane's four messages (spec 12.2)
  if (!s.knows('msg1') && insideSite('tavern', b.x, b.z) && b.y > floorY('tavern', 1) - 0.5 && t > at(22, 15) && !s.hasGun) { g.learn('msg1'); g.message('Пальто ничего не значит. Харроу нужен живым. Без ствола к людям Корда не суйся. У Фомы есть.', 'The coat means nothing. Harrow is needed alive. Do not go near Cord\'s men without a gun. Foma has one.'); g.thread('gun'); }
  if (!s.knows('msg2') && s.thread === 'key' && g.sinceThread > 75 && t < at(22, 30)) { g.learn('msg2'); g.message('Ключи — Орвен.', 'Keys — Orven.'); }
  if (!s.knows('thread_orven_after') && s.knows('prologue_done') && t > at(22, 12) && s.thread === 'orven' && !s.knows('saw_orven_locked') && Math.hypot(b.x + 46, b.z + 33.3) < 8) { g.hud.bark('Заперто. Опоздал минут на пять.', true); g.thread('orven_late'); g.learn('saw_orven_locked'); g.learn('thread_orven_after'); }
  // gunless hint at Foma's door after 2 game minutes (spec 8.1 hint ladder)
  if (g.sceneInside !== 'foma' && t < at(22, 30) && Math.hypot(b.x + 40, b.z + 13) < 3.5 && s.thread === 'gun') { g.hintT += 1 / 60; const h = ['Заперто наглухо. Ломать — весь квартал сбежится.', 'С этой улицы тянет газом… Тут скоро что-то случится.', 'Если войти туда, где стен уже нет, а потом вернуться…']; const k = Math.floor(g.hintT / 120); if (k > g.hintStep && g.hintStep < 3) { g.hud.bark(h[g.hintStep], true); g.hintStep++; } }
  else if (Math.hypot(b.x + 40, b.z + 13) > 8) { g.hintT = 0; }
}
void fmt; void inSite; void doors;
