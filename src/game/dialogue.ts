import { GameState, ItemId } from './state';
import { FlagName } from '../sim/flags';
import { getLang, tr } from './strings';
import { EN } from '../content/en';
const en = (ru: string, e?: string) => (getLang() === 'en' ? (e ?? EN[ru] ?? ru) : ru);

// ---------- content types
export interface Line { who: string; ru: string; en?: string; act?: boolean; if?: (c: Ctx) => boolean; }
export interface Choice {
  ru: string; en?: string; next?: string; if?: (c: Ctx) => boolean; fx?: (c: Ctx) => void;
  know?: string; kt?: string;       // pressure-by-knowledge: needs know[id]; shows the Stvorka glyph and the time the knowledge comes from
  hide?: boolean;                   // hide once taken (within this conversation)
  once?: string;                    // topic key: hidden once discussed with this NPC in this branch (A4)
  sys?: boolean;                    // a system button (leave / continue): not a line Tik says (A6)
}
export interface Node { say?: Line[]; choices?: Choice[]; next?: string; fx?: (c: Ctx) => void; end?: boolean; }
export interface Conv { id: string; start: string | ((c: Ctx) => string); nodes: Record<string, Node>; interrupts?: { when: (c: Ctx) => boolean; node: string; once: string }[]; }

/** what dialogues may do to the game */
export interface Ctx {
  s: GameState; advance(sec: number): void; bark(ru: string, force?: boolean): boolean | void; thread(key: string): void;
  flag(n: FlagName): void; give(i: ItemId): void; take(i: ItemId): void; learn(id: string): void;
  note(id: string, ru: string, en: string, who?: string, red?: boolean): void; message(ru: string, en: string): void;
  npcAct(npc: string, act: string): void; end(ending: string): void; has(i: ItemId): boolean; knows(id: string): boolean;
  npc?: string; count(): number; ever(): number; talked(topic: string): boolean; topic(topic: string): void; place(): string; npcAt(id: string): { x: number; z: number; y: number; a: string; hidden: boolean } | null;
  fl(n: FlagName): boolean; t(): number; money(d: number): void; gun(): boolean; jumpedFrom?: string; conv(id: string): void; fomaRuinOn(): boolean; hurt(v: number): void; jumpRel(sec: number): void; openDoor(id: string, open?: boolean): void; setPocketHeld(): void;
}
export const L = (who: string, ru: string, en?: string): Line => ({ who, ru, en });
/** a line that is spoken only when the player has learned something (spec 1.4: you only use what you know) */
export const W = (cond: (c: Ctx) => boolean, who: string, ru: string, en?: string): Line => ({ who, ru, en, if: cond });
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
  private pick(k: number) { if (!this.choiceFn) return; const mainN = this.root.querySelectorAll('.opt').length; if (k < mainN) this.choiceFn(this.order[k]); }
  constructor() {
    addEventListener('keydown', e => {
      if (!this.open) return;
      const mainN = this.root.querySelectorAll('.opt').length;
      if (/^(Digit|Numpad)[1-9]$/.test(e.code)) { const i = +e.code.slice(-1) - 1; if (this.choiceFn && i < mainN) { this.pick(i); e.preventDefault(); } }
      else if (e.code === 'Escape') { if (this.choiceFn && this.sysIdx >= 0) { this.choiceFn(this.sysIdx); e.preventDefault(); } else if (this.resolve) { const r = this.resolve; this.resolve = undefined; r(); e.preventDefault(); } }
      else if (this.choiceFn && mainN && (e.code === 'ArrowDown' || e.code === 'KeyS')) { this.sel = (this.sel + 1) % mainN; this.paint(); e.preventDefault(); }
      else if (this.choiceFn && mainN && (e.code === 'ArrowUp' || e.code === 'KeyW')) { this.sel = (this.sel + mainN - 1) % mainN; this.paint(); e.preventDefault(); }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyE') { if (this.choiceFn && mainN) { this.pick(this.sel); e.preventDefault(); } else if (this.resolve) { const r = this.resolve; this.resolve = undefined; r(); e.preventDefault(); } }
      else if (e.code === 'Space') { if (!this.choiceFn && this.resolve) { const r = this.resolve; this.resolve = undefined; r(); } e.preventDefault(); }
    });
    this.root.addEventListener('click', e => { const t = (e.target as HTMLElement).closest('.opt,.sys') as HTMLElement | null; if (t && this.choiceFn) this.choiceFn(+t.dataset.i!); else if (this.resolve) { const r = this.resolve; this.resolve = undefined; r(); } });
  }
  show(l: Line): Promise<void> {
    this.open = true; this.root.style.display = 'block'; this.free();
    const who = l.act ? '' : `<div class="who">${nameOf(l.who)}</div>`;
    const isTik = l.who === 'tik' && !l.act; const body = isTik ? `«${en(l.ru, l.en)}»` : en(l.ru, l.en);
    this.root.innerHTML = `${who}<div class="txt${l.act ? ' act' : ''}">${body}</div><div class="more">▸ <kbd>Пробел</kbd></div>`;
    return new Promise(r => { this.resolve = r; });
  }
  private sysIdx = -1;
  /** spoken lines in quotes, actions in italics in brackets, system buttons small and grey at the bottom (A6) */
  choose(cs: { text: string; glyph?: string; kind: 'say' | 'act' | 'sys' }[]): Promise<number> {
    this.open = true; this.root.style.display = 'block'; this.nChoices = cs.length; this.sel = 0; this.free();
    const main = cs.map((c, i) => ({ c, i })).filter(x => x.c.kind !== 'sys'), sys = cs.map((c, i) => ({ c, i })).filter(x => x.c.kind === 'sys');
    this.sysIdx = sys.length ? sys[0].i : -1; let n = 0;
    const row = (x: { c: { text: string; glyph?: string; kind: string }; i: number }) => { n++; const t = x.c.kind === 'act' ? `<i>${x.c.text}</i>` : `«${x.c.text.replace(/^«|»$/g, '')}»`; return `<div class="opt" data-i="${x.i}"><b>${n}.</b> ${x.c.glyph ? `<span class="glyph">⟲ ${x.c.glyph}</span> ` : ''}${t}</div>`; };
    this.order = [...main.map(x => x.i), ...sys.map(x => x.i)];
    this.root.innerHTML = '<div class="opts">' + main.map(row).join('') + '</div>' + (sys.length ? `<div class="sysrow">${sys.map(x => `<span class="sys" data-i="${x.i}">▸ ${x.c.text.replace(/^\(|\)$/g, '')} <kbd>Esc</kbd></span>`).join('')}</div>` : '');
    const done = new Promise<number>(r => { this.choiceFn = i => { this.choiceFn = undefined; r(i); }; }); this.paint(); return done;
  }
  private order: number[] = [];
  hide() { this.open = false; this.root.style.display = 'none'; this.root.innerHTML = ''; }
  /** the dialogue box stays up with a free cursor until the conversation is over; then the game asks for the mouse back */
}
export const SYS = new Set(['(Уйти)', '(Отойти)', '(Дальше)', '(Молча уйти)', '(Оставить её)', '(Уйти молча)', '(Закончить)']);
export class DialogueRunner {
  convs = new Map<string, Conv>(); active = false; cur?: string; npc?: string; onEnd?: (npc: string | undefined, finished: boolean) => void;
  constructor(public ui: DialogueUI, public ctx: Ctx) {}
  register(...cs: Conv[]) { for (const c of cs) this.convs.set(c.id, c); }
  /** one-line answer when the NPC has nothing to talk about right now (A1) */
  async quick(npc: string, ru: string) { if (this.active) return; this.active = true; this.npc = npc; await this.ui.show({ who: npc, ru }); this.ui.hide(); this.active = false; this.npc = undefined; this.onEnd?.(npc, false); }
  async start(id: string, npc?: string) {
    const conv = this.convs.get(id); if (!conv || this.active) return; this.active = true; this.cur = id; this.npc = npc; this.ctx.npc = npc;
    let node: string | undefined = typeof conv.start === 'string' ? conv.start : conv.start(this.ctx);
    const used = new Set<string>(); let finished = false;
    while (node) {
      const n: Node | undefined = conv.nodes[node]; if (!n) break;
      n.fx?.(this.ctx);
      // game time keeps running during a conversation (A7): lines take real reading time, no clock jumps
      for (const l of n.say ?? []) { if (l.if && !l.if(this.ctx)) continue; await this.ui.show(l); }
      if (n.choices && n.choices.length) {
        const vis: Choice[] = n.choices.filter(c => !(c.hide && used.has(node + ':' + c.ru)) && !(c.once && this.ctx.talked(c.once)) && (!c.if || c.if(this.ctx)) && (!c.know || this.ctx.knows(c.know)));
        if (!vis.length) { finished = true; break; }
        const kind = (c: Choice): 'say' | 'act' | 'sys' => (c.sys || SYS.has(c.ru) ? 'sys' : c.ru.startsWith('(') ? 'act' : 'say');
        const i: number = await this.ui.choose(vis.map((c: Choice) => ({ text: en(c.ru, c.en), glyph: c.know ? c.kt ?? '' : undefined, kind: kind(c) })));
        const c: Choice = vis[i]; used.add(node + ':' + c.ru); if (c.once) this.ctx.topic(c.once); c.fx?.(this.ctx);
        // only real words are spoken aloud; actions and system buttons are not
        if (kind(c) === 'say') await this.ui.show({ who: 'tik', ru: c.ru, en: c.en });
        node = c.next; if (!node) finished = true;
        for (const it of conv.interrupts ?? []) if (node && it.when(this.ctx) && !this.ctx.talked(it.once)) { this.ctx.topic(it.once); node = it.node; break; }
      } else { if (n.end || !n.next) finished = true; node = n.end ? undefined : n.next; }
    }
    this.ui.hide(); this.active = false; this.cur = undefined; const who = this.npc; this.npc = undefined; this.ctx.npc = undefined; this.onEnd?.(who, finished);
  }
}
