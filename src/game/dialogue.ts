import { GameState, ItemId } from './state';
import { FlagName } from '../sim/flags';
import { getLang, tr } from './strings';
import { EN } from '../content/en';
const en = (ru: string, e?: string) => (getLang() === 'en' ? (e ?? EN[ru] ?? ru) : ru);

// ---------- content types
export interface Line { who: string; ru: string; en?: string; act?: boolean; }
export interface Choice {
  ru: string; en?: string; next?: string; if?: (c: Ctx) => boolean; fx?: (c: Ctx) => void;
  know?: string; kt?: string;       // pressure-by-knowledge: needs know[id]; shows the Stvorka glyph and the time the knowledge comes from
  hide?: boolean;                   // hide once taken
}
export interface Node { say?: Line[]; choices?: Choice[]; next?: string; fx?: (c: Ctx) => void; end?: boolean; }
export interface Conv { id: string; start: string | ((c: Ctx) => string); nodes: Record<string, Node>; }

/** what dialogues may do to the game */
export interface Ctx {
  s: GameState; advance(sec: number): void; bark(ru: string, force?: boolean): boolean | void; thread(key: string): void;
  flag(n: FlagName): void; give(i: ItemId): void; take(i: ItemId): void; learn(id: string): void;
  note(id: string, ru: string, en: string, who?: string, red?: boolean): void; message(ru: string, en: string): void;
  npcAct(npc: string, act: string): void; end(ending: string): void; has(i: ItemId): boolean; knows(id: string): boolean;
  fl(n: FlagName): boolean; t(): number; money(d: number): void; gun(): boolean; jumpedFrom?: string; conv(id: string): void; fomaRuinOn(): boolean; hurt(v: number): void; jumpRel(sec: number): void; openDoor(id: string, open?: boolean): void; setPocketHeld(): void;
}
export const L = (who: string, ru: string, en?: string): Line => ({ who, ru, en });
export const A = (ru: string, en?: string): Line => ({ who: '', ru, en, act: true });

// ---------- runner + DOM UI
const NAMES: Record<string, { ru: string; en: string }> = {
  tik: { ru: 'Тик', en: 'Tik' }, lidia: { ru: 'Лидия', en: 'Lidia' }, crane: { ru: 'Крайн', en: 'Crane' }, orven: { ru: 'Орвен', en: 'Orven' },
  tilda: { ru: 'Тильда', en: 'Tilda' }, ned: { ru: 'Нед', en: 'Ned' }, agata: { ru: 'Агата', en: 'Agata' }, ignat: { ru: 'Игнат', en: 'Ignat' },
  lovchiy: { ru: 'Ловчий', en: 'Lovchiy' }, scar: { ru: 'Шрам', en: 'Scar' }, foma: { ru: 'Фома', en: 'Foma' }, gayl: { ru: 'Гейл', en: 'Gayl' },
  anna: { ru: 'Анна', en: 'Anna' }, agnia: { ru: 'Матушка Агния', en: 'Mother Agnia' }, anka: { ru: 'Анка', en: 'Anka' }, lukyan: { ru: 'Лукьян', en: 'Lukyan' },
  tikhon: { ru: 'Тихон', en: 'Tikhon' }, pip: { ru: 'Пип', en: 'Pip' }, yan: { ru: 'Ян', en: 'Yan' }, harrow: { ru: 'Харроу', en: 'Harrow' }, fern: { ru: 'Ферн', en: 'Fern' },
  stern: { ru: 'Штерн', en: 'Stern' }, guard: { ru: 'Охранник', en: 'Guard' }, guard1: { ru: 'Охранник 1', en: 'Guard 1' }, guard2: { ru: 'Охранник 2', en: 'Guard 2' },
  cord: { ru: 'Корд', en: 'Cord' }, device: { ru: 'Створка', en: 'The Device' }, mitya: { ru: 'Митя', en: 'Mitya' }, '': { ru: '', en: '' },
};
/** until the player has learned a person's name, he is only a description (spec 1: you only use what you know) */
export const DESC: Record<string, { ru: string; en: string }> = {
  ned: { ru: 'Рыжий курьер', en: 'Red-haired courier' }, tilda: { ru: 'Женщина в платке', en: 'Woman in a kerchief' }, agata: { ru: 'Хозяйка таверны', en: 'The landlady' },
  ignat: { ru: 'Человек в жилете', en: 'Man in a waistcoat' }, lovchiy: { ru: 'Человек Корда', en: "Cord's man" }, scar: { ru: 'Человек со шрамом', en: 'Man with a scar' }, foma: { ru: 'Голос за дверью', en: 'A voice behind the door' },
  gayl: { ru: 'Человек в очках', en: 'Man in spectacles' }, anna: { ru: 'Сестра в чепце', en: 'A nurse in a cap' }, agnia: { ru: 'Старая монахиня', en: 'An old nun' }, anka: { ru: 'Девочка с красной лентой', en: 'Girl with a red ribbon' },
  tikhon: { ru: 'Человек за дверью', en: 'A man behind the door' }, pip: { ru: 'Спящая девочка', en: 'A sleeping girl' }, yan: { ru: 'Старый рулевой', en: 'Old helmsman' }, harrow: { ru: 'Седой господин', en: 'Grey-haired gentleman' },
  fern: { ru: 'Старик с фонарём', en: 'Old man with a lantern' }, stern: { ru: 'Человек с чемоданом', en: 'Man with a suitcase' }, orven: { ru: 'Ключник', en: 'The locksmith' }, lukyan: { ru: 'Баржевщик', en: 'The bargeman' },
  cord: { ru: 'Человек в длинном пальто', en: 'Man in a long coat' }, guard: { ru: 'Охранник', en: 'Guard' },
};
export let nameKnown: (id: string) => boolean = () => true; export const setNameKnown = (f: (id: string) => boolean) => { nameKnown = f; };
export const nameOf = (id: string) => (id && !nameKnown(id) && DESC[id] ? DESC[id][getLang()] : NAMES[id]?.[getLang()] ?? id);

export class DialogueUI {
  root = document.getElementById('dlg')!; open = false;
  private resolve?: () => void; private choiceFn?: (i: number) => void; private nChoices = 0; private sel = 0;
  private free() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* ignore */ } this.root.style.cursor = 'pointer'; document.body.style.cursor = 'default'; }
  private paint() { this.root.querySelectorAll('.opt').forEach((el, i) => el.classList.toggle('sel', i === this.sel)); }
  constructor() {
    addEventListener('keydown', e => {
      if (!this.open) return;
      if (/^(Digit|Numpad)[1-9]$/.test(e.code)) { const i = +e.code.slice(-1) - 1; if (this.choiceFn && i < this.nChoices) { this.choiceFn(i); e.preventDefault(); } }
      else if (this.choiceFn && (e.code === 'ArrowDown' || e.code === 'KeyS')) { this.sel = (this.sel + 1) % this.nChoices; this.paint(); e.preventDefault(); }
      else if (this.choiceFn && (e.code === 'ArrowUp' || e.code === 'KeyW')) { this.sel = (this.sel + this.nChoices - 1) % this.nChoices; this.paint(); e.preventDefault(); }
      else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { if (this.choiceFn) { this.choiceFn(this.sel); e.preventDefault(); } else if (this.resolve) { const r = this.resolve; this.resolve = undefined; r(); e.preventDefault(); } }
    });
    this.root.addEventListener('click', e => { const t = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null; if (t && this.choiceFn) this.choiceFn(+t.dataset.i!); else if (this.resolve) { const r = this.resolve; this.resolve = undefined; r(); } });
  }
  show(l: Line): Promise<void> {
    this.open = true; this.root.style.display = 'block'; this.free();
    const who = l.act ? '' : `<div class="who">${nameOf(l.who)}</div>`;
    this.root.innerHTML = `${who}<div class="txt${l.act ? ' act' : ''}">${en(l.ru, l.en)}</div><div class="more">${tr('continue')} ▸</div>`;
    return new Promise(r => { this.resolve = r; });
  }
  choose(cs: { text: string; glyph?: string }[]): Promise<number> {
    this.open = true; this.root.style.display = 'block'; this.nChoices = cs.length; this.sel = 0; this.free();
    this.root.innerHTML = '<div class="opts">' + cs.map((c, i) => `<div class="opt" data-i="${i}"><b>${i + 1}.</b> ${c.glyph ? `<span class="glyph">⟲ ${c.glyph}</span> ` : ''}${c.text}</div>`).join('') + '</div>';
    const done = new Promise<number>(r => { this.choiceFn = i => { this.choiceFn = undefined; r(i); }; }); this.paint(); return done;
  }
  hide() { this.open = false; this.root.style.display = 'none'; this.root.innerHTML = ''; }
  /** the dialogue box stays up with a free cursor until the conversation is over; then the game asks for the mouse back */
}
export class DialogueRunner {
  convs = new Map<string, Conv>(); active = false; cur?: string; onEnd?: () => void;
  constructor(public ui: DialogueUI, public ctx: Ctx) {}
  register(...cs: Conv[]) { for (const c of cs) this.convs.set(c.id, c); }
  async start(id: string) {
    const conv = this.convs.get(id); if (!conv || this.active) return; this.active = true; this.cur = id;
    let node: string | undefined = typeof conv.start === 'string' ? conv.start : conv.start(this.ctx);
    const used = new Set<string>();
    while (node) {
      const n: Node | undefined = conv.nodes[node]; if (!n) break;
      n.fx?.(this.ctx);
      for (const l of n.say ?? []) { await this.ui.show(l); if (!l.act) this.ctx.advance(5); }
      if (n.choices && n.choices.length) {
        const vis: Choice[] = n.choices.filter(c => !(c.hide && used.has(node + ':' + c.ru)) && (!c.if || c.if(this.ctx)) && (!c.know || this.ctx.knows(c.know)));
        if (!vis.length) break;
        const i: number = await this.ui.choose(vis.map((c: Choice) => ({ text: en(c.ru, c.en), glyph: c.know ? c.kt ?? '' : undefined })));
        const c: Choice = vis[i]; used.add(node + ':' + c.ru); c.fx?.(this.ctx);
        // the player's own line is spoken aloud
        await this.ui.show({ who: 'tik', ru: c.ru, en: c.en }); this.ctx.advance(3);
        node = c.next;
      } else node = n.end ? undefined : n.next;
    }
    this.ui.hide(); this.active = false; this.cur = undefined; this.onEnd?.();
  }
}
