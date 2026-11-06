import { dist2d, NODES, OBJS } from './map';
import { hrand } from './rng';

// ---------- типы ----------
export type Loc = { k: 'npc'; id: string } | { k: 'node'; id: string } | { k: 'player' } | { k: 'chest' } | { k: 'tram' } | { k: 'gone' };
export interface Item { id: string; kind: string; loc: Loc; owner?: string; double?: boolean; real?: boolean; origVanishT?: number; shiny?: boolean; takenAt?: number; vanished?: boolean }
export type Task = { k: 'walk'; to: string } | { k: 'wait'; until: number } | { k: 'act'; until: number; what: string };
export interface Npc {
  id: string; x: number; z: number; node: string; floor: number; face: number;
  route: string[]; speed: number; task: Task | null; ph: string; m: Record<string, number | string | boolean>;
  inv: string[]; inTram: boolean; hurt: number; safe: boolean; mood: string; seed: number;
}
export interface Player {
  x: number; z: number; floor: number; st: number; hands: string | null; pocket: string | null;
  facts: string[]; trust: Record<string, number>; escort: string | null; spotted: number; onTram: boolean;
}
export interface Ev { id: number; t: number; type: string; actors: string[]; cause: number[]; w: boolean; d?: Record<string, string | number> }
export interface Tram { x: number; at: string | null; state: 'wait' | 'run'; to: string; from: string; trip: number; departT: number; pax: string[]; denied: Record<string, number> }
export interface Dock { x: number; z: number; state: 'far' | 'approach' | 'avoid' | 'moored' | 'unloaded'; decidedAt: number; barrels: number }
export interface Gas { S: number; K: number; H: number; leakOn: boolean; thresholdEv: boolean }
export interface Fire { zones: Record<string, number>; since: number; started: boolean; ignitedAt: number; alarm: boolean; source: string }
export interface World {
  t: number; tick: number; seed: number;
  npcs: Record<string, Npc>; items: Record<string, Item>; player: Player;
  v: number; w: number; P: number; // подача, стравливание, давление
  tavValve: number; tavLocked: boolean; ks1Open: boolean; ks1Locked: boolean;
  kitWindow: boolean; hood: boolean; stove: boolean; hearth: boolean; rugMoved: boolean; frontDoor: 'open' | 'closed';
  gas: Gas; fire: Fire; tram: Tram; dock: Dock;
  sem: { closed: boolean; raisedAt: number };
  towerOpen: boolean; kioskOpen: boolean; lampsLit: number; lampsDone: boolean; flicker: boolean;
  blocked: string[]; events: Ev[]; tail: Record<string, number>; flags: Record<string, number | string | boolean>;
  sealed: boolean; // Окно запечатано до урока ключа (мета-флаг сессии)
  alarm: boolean; evac: boolean; newsId: string;
}
export type Iv =
  | { t: number; k: 'move'; x: number; z: number; floor?: number; st?: number }
  | { t: number; k: 'take'; item: string }
  | { t: number; k: 'drop' }
  | { t: number; k: 'give'; npc: string }
  | { t: number; k: 'use'; obj: string; arg?: number | string }
  | { t: number; k: 'say'; npc: string; node: string; choice: string }
  | { t: number; k: 'inspect'; obj: string }
  | { t: number; k: 'escort'; npc: string; on: boolean }
  | { t: number; k: 'buy'; what: string };

// ---------- события и причинность ----------
export function emit(w: World, type: string, actors: string[], causeKeys: string[] = [], d?: Record<string, string | number>, touch: string[] = []): number {
  const id = w.events.length;
  const cause: number[] = [];
  for (const k of causeKeys) { const e = w.tail[k]; if (e !== undefined && !cause.includes(e)) cause.push(e); }
  // свидетельство: игрок рядом (≤14 м, тот же «внутри/снаружи»)
  const wit = actors.some((a) => {
    const n = w.npcs[a]; if (!n) return false;
    return dist2d(n.x, n.z, w.player.x, w.player.z) < 14 && n.floor === w.player.floor;
  });
  const ev: Ev = { id, t: w.t, type, actors, cause, w: wit };
  if (d) ev.d = d;
  w.events.push(ev);
  for (const a of actors) w.tail[a] = id;
  for (const a of touch) w.tail[a] = id;
  return id;
}
export const hasFact = (w: World, f: string) => w.player.facts.includes(f);
export function learn(w: World, f: string) {
  if (!w.player.facts.includes(f)) { w.player.facts.push(f); w.player.facts.sort(); emit(w, 'LEARN', ['player'], [], { fact: f }); }
}

export function itemPos(w: World, it: Item): { x: number; z: number; floor: number } | null {
  switch (it.loc.k) {
    case 'npc': { const n = w.npcs[it.loc.id]; return n ? { x: n.x, z: n.z, floor: n.floor } : null; }
    case 'node': { const n = NODES[it.loc.id]; return { x: n.x, z: n.z, floor: n.floor ?? 0 }; }
    case 'chest': { const o = OBJS.chest; return { x: o.x, z: o.z, floor: -1 }; }
    case 'player': return { x: w.player.x, z: w.player.z, floor: w.player.floor };
    default: return null;
  }
}
export function moveItem(w: World, id: string, loc: Loc) { w.items[id].loc = loc; }
export function npcHas(w: World, npcId: string, kind: string): Item | null {
  for (const id of w.npcs[npcId].inv) { const it = w.items[id]; if (it && it.kind === kind) return it; }
  return null;
}
export function giveNpc(w: World, itemId: string, npcId: string) {
  const it = w.items[itemId];
  const old = it.loc;
  if (old.k === 'npc') { const o = w.npcs[old.id]; o.inv = o.inv.filter((x) => x !== itemId); }
  it.loc = { k: 'npc', id: npcId }; w.npcs[npcId].inv.push(itemId);
}
export const jit = (w: World, id: string, range: number) => (hrand(w.seed, 'jit', id) - 0.5) * 2 * range;
export const sk = (w: World) => w;

/** Шум игрока по стойке: 0 ходьба, 1 крадётся, 2 бег. */
export const noiseRadius = (st: number) => (st === 1 ? 3 : st === 2 ? 12 : 7);
export const rainMask = 0.7;

/** Покупка (киоск/стойка): монеты = предмет «coinstack» (2 монеты). */
export function buyItem(w: World, what: string): boolean {
  const p = w.player; const h = p.hands ? w.items[p.hands] : null;
  if (!h || h.kind !== 'coinstack' || (h.double && !h.real)) return false;
  h.loc = { k: 'gone' };
  if (what === 'ticket') { w.items.ticket = { id: 'ticket', kind: 'ticket', loc: { k: 'player' } }; p.hands = 'ticket'; emit(w, 'BUY_TICKET', ['player', 'mira', 'item:ticket'], [], {}, ['item:ticket']); }
  else { w.items.mug = { id: 'mug', kind: 'mug', loc: { k: 'player' } }; p.hands = 'mug'; emit(w, 'BUY_MUG', ['player', 'agata', 'item:mug'], [], {}, ['item:mug']); }
  return true;
}
