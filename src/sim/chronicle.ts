// Хроника Окна: граф причин, baseline-diff, значимость = охват × глубина × вес типа.
import { createWorld, step } from './world';
import { Ev, World } from './core';
import { T1 } from './map';

const NOISE = new Set(['LEARN', 'DIALOG', 'INSPECT', 'TRAM_DEPART', 'DOOR_BARRED', 'KIOSK_CLOSED', 'TOWER_CORDON', 'WAIT_FLAG', 'ALIGHT', 'WINDOW', 'ESCORT_START', 'ESCORT_END', 'DROP', 'RUG_MOVED']);
const WEIGHT: Record<string, number> = { IGNITION: 12, ALARM: 6, EVACUATE: 4, PRESSURE_SPIKE: 5, JOINT_LEAK: 5, GAS_THRESHOLD: 4, PIP_HIDES: 5, DOCK_DECISION: 3, OBSTACLE_PLACED: 3, SIGNAL_RAISED: 2, BOARD_DENIED: 3, PICKUP: 2, WALK_STARTED: 2, PLAN_COMPRESSED: 3, PATH_REPLANNED: 2, KEY_MISSING: 4, ORIGINAL_VANISHED: 3, LAMPS_LIT: 3, LAMPS_STUCK: 4, VALVE_SET: 3, VALVE_CLOSED: 3, VALVE_OPENED: 2, TAV_VALVE: 4, SEARCH_FAILED: 2, FLAG_DELIVERED: 2 };

const baselineCache = new Map<number, Ev[]>();
export function baselineEvents(seed: number): Ev[] {
  let b = baselineCache.get(seed);
  if (!b) { const w = createWorld(seed, { sealed: false }); while (w.t < T1) step(w); b = w.events; baselineCache.set(seed, b); }
  return b;
}
const sig = (e: Ev) => `${e.type}|${e.actors.filter((a) => a !== 'player').join(',')}|${Math.round(e.t / 60)}`;

export interface ChronItem { ev: Ev; significance: number; witnessed: boolean; novel: boolean; chain: number[] }
export interface Chronicle { items: ChronItem[]; prevented: Ev[]; all: ChronItem[] }

export function chronicle(w: World, seed: number): Chronicle {
  const base = baselineEvents(seed); const baseSigs = new Set(base.map(sig)); const curSigs = new Set(w.events.map(sig));
  const children = new Map<number, number[]>();
  for (const e of w.events) for (const c of e.cause) { const a = children.get(c) ?? []; a.push(e.id); children.set(c, a); }
  const memo = new Map<number, { actors: Set<string>; depth: number }>();
  const dfs = (id: number): { actors: Set<string>; depth: number } => {
    const m = memo.get(id); if (m) return m;
    const e = w.events[id]; const actors = new Set(e.actors); let depth = 0;
    for (const ch of children.get(id) ?? []) { const r = dfs(ch); r.actors.forEach((a) => actors.add(a)); depth = Math.max(depth, r.depth + 1); }
    const out = { actors, depth }; memo.set(id, out); return out;
  };
  const chainOf = (id: number): number[] => { const out: number[] = []; const seen = new Set<number>(); const walk = (x: number) => { if (seen.has(x)) return; seen.add(x); out.push(x); for (const c of w.events[x].cause) walk(c); }; walk(id); return out.sort((a, b) => a - b); };
  const all: ChronItem[] = w.events.filter((e) => !NOISE.has(e.type)).map((ev) => {
    const r = dfs(ev.id);
    return { ev, significance: Math.round(r.actors.size * (1 + r.depth) * (WEIGHT[ev.type] ?? 1) * 10) / 10, witnessed: ev.w || ev.type === 'IGNITION' && w.fire.started && false, novel: !baseSigs.has(sig(ev)), chain: chainOf(ev.id) };
  });
  const items = all.filter((i) => i.novel).sort((a, b) => b.significance - a.significance).slice(0, 14);
  const prevented = base.filter((e) => !NOISE.has(e.type) && !curSigs.has(sig(e)) && (WEIGHT[e.type] ?? 0) >= 4).slice(0, 8);
  return { items, prevented, all };
}
