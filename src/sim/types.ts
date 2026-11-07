// Состояние мира. src/sim — чистый TS: без THREE, без Math.random, без Date.now.

export const WINDOW = 3600; // 22:00..23:00 в игровых секундах
export const TIME_SCALE = 4; // ×4 к реальному

export type ItemId = 'key' | 'jeton' | 'ribbon' | 'list' | 'ring' | 'cap' | 'letter' | 'fuse' | 'revolver';

export interface Quote { t: number; ru: string; en: string; }
export interface JournalEntry {
  id: string;
  place: string;
  firstSeen: number;
  lastSeen: number;
  quotes: Quote[];
  acts: string[];
}

export interface Sim {
  t: number;
  branch: number;
  flags: Record<string, number>;     // изменения этого мира
  branchChanges: { key: string; t: number }[];
  knowledge: Record<string, number>; // знания Тика: живут между прыжками
  seenPlaces: Record<string, number>;
  journal: Record<string, JournalEntry>;
  messages: { t: number; key: string }[];
  pocket: ItemId | null;
  weapon: boolean;                   // револьвер не занимает Карман
  ammo: number;
  rounds: number;
  fired: Set<string>;
  ended: null | 'empty' | 'death' | 'postponed' | 'morning';
  deathBy: string;
  deathPlace: string;
  savedChildren: number;
  parent: number;
  jumps: number;
  finale: boolean;                   // финал начат — прыжки заблокированы
  finaleChoice: null | 'believe' | 'disbelieve';
  notes: string[];                   // нейтральные факты финального экрана
  seed: number;
}

export const min = (m: number) => m * 60;

export function createSim(seed = 1947): Sim {
  return {
    t: 0,
    branch: 0,
    flags: {},
    branchChanges: [],
    knowledge: {},
    seenPlaces: {},
    journal: {},
    messages: [],
    pocket: null,
    weapon: false,
    ammo: 0,
    rounds: 6,
    fired: new Set(),
    ended: null,
    deathBy: '',
    deathPlace: '',
    savedChildren: 0,
    parent: 0,
    jumps: 0,
    finale: false,
    finaleChoice: null,
    notes: [],
    seed,
  };
}

export function fmt(t: number): string {
  const s = Math.max(0, Math.min(WINDOW, Math.floor(t)));
  const h = 22 + Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function fmtMin(t: number): string {
  return fmt(t).slice(0, 5);
}

export function has(sim: Sim, key: string): boolean {
  return sim.knowledge[key] !== undefined;
}

export function flag(sim: Sim, key: string): boolean {
  return sim.flags[key] !== undefined;
}

export function learn(sim: Sim, key: string): boolean {
  if (sim.knowledge[key] !== undefined) return false;
  sim.knowledge[key] = sim.t;
  return true;
}

export function setFlag(sim: Sim, key: string): void {
  if (sim.flags[key] === undefined) {
    sim.flags[key] = sim.t;
    sim.branchChanges.push({ key, t: sim.t });
  }
}

export function learnTime(sim: Sim, key: string): string {
  const t = sim.knowledge[key];
  return t === undefined ? '' : fmtMin(t);
}

export function note(sim: Sim, line: string) {
  if (!sim.notes.includes(line)) sim.notes.push(line);
}

export interface NpcLine {
  id: string;
  ru: string;
  nameRu: string;
  en: string;
  nameEn: string;
}

/** Запись в журнал: кто, где, когда, что сказал/сделал. Без выводов. */
export function journal(sim: Sim, npcId: string, nameRu: string, placeId: string, quote?: { ru: string; en: string }, act?: string) {
  let e = sim.journal[npcId];
  if (!e) {
    e = sim.journal[npcId] = {
      id: npcId, place: placeId, firstSeen: sim.t, lastSeen: sim.t, quotes: [], acts: [],
    };
  }
  e.place = placeId;
  e.lastSeen = sim.t;
  if (quote) {
    const last = e.quotes[e.quotes.length - 1];
    if (!last || last.ru !== quote.ru) e.quotes.push({ t: sim.t, ...quote });
    if (e.quotes.length > 8) e.quotes.shift();
  }
  if (act && !e.acts.includes(act)) e.acts.push(act);
}

export function message(sim: Sim, key: string) {
  if (sim.messages.some((m) => m.key === key)) return;
  sim.messages.push({ t: sim.t, key });
}

export function timeOf(sim: Sim, m: number) {
  return min(m);
}
