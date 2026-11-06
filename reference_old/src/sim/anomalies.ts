import type { Ev } from './types';
import { Sim } from './sim';

export interface Anomaly {
  kind: 'new' | 'missing' | 'shifted' | 'moved';
  ev: Ev; base?: Ev; chain: number[]; root: number; score: number;
}
const sig = (e: Ev) => `${e.type}|${[...e.actors].sort().join(',')}|${e.loc}`;
const sigNoLoc = (e: Ev) => `${e.type}|${[...e.actors].sort().join(',')}`;
const THRESH = 300;
const SKIP = new Set(['depart', 'arrive']);

export function baselineOf(make: () => Sim): Ev[] {
  const s = make(); s.advanceTo(s.t1); return s.events;
}

/** Walk causes up to the player's root actions */
export function chainOf(events: Ev[], id: number): { chain: number[]; root: number } {
  const chain: number[] = []; let cur = id; let root = id; const seen = new Set<number>();
  while (cur >= 0 && !seen.has(cur)) {
    seen.add(cur); chain.push(cur); root = cur;
    const c = events[cur].causes; if (!c.length) break;
    cur = c[0];
  }
  return { chain: chain.reverse(), root };
}

export function diff(base: Ev[], cur: Ev[], now: number, storyWeight = 3): Anomaly[] {
  const used = new Set<number>(); const out: Anomaly[] = [];
  const bySig = new Map<string, Ev[]>();
  for (const b of base) { const k = sig(b); (bySig.get(k) ?? bySig.set(k, []).get(k)!).push(b); }
  for (const e of cur) {
    if (e.tags.includes('player')) continue;
    const near = (bySig.get(sig(e)) ?? []).find(b => !used.has(b.id) && Math.abs(b.t - e.t) <= THRESH);
    if (near) { used.add(near.id); continue; }
    if (SKIP.has(e.type) && !e.tags.includes('story')) {
      // movement noise: only flag if the same actors never went there in baseline at all
      const any = (base).find(b => b.type === e.type && b.loc === e.loc && b.actors[0] === e.actors[0] && Math.abs(b.t - e.t) <= 1800);
      if (any) continue;
    }
    const far = base.find(b => !used.has(b.id) && sig(b) === sig(e));
    const moved = base.find(b => !used.has(b.id) && sigNoLoc(b) === sigNoLoc(e) && b.loc !== e.loc);
    const kind: Anomaly['kind'] = far ? 'shifted' : moved ? 'moved' : 'new';
    const { chain, root } = chainOf(cur, e.id);
    out.push({ kind, ev: e, base: far ?? moved, chain, root, score: 0 });
  }
  for (const b of base) if (b.t <= now && !used.has(b.id) && !SKIP.has(b.type) && !cur.some(e => sigNoLoc(e) === sigNoLoc(b) && Math.abs(e.t - b.t) <= THRESH))
    out.push({ kind: 'missing', ev: b, base: b, chain: [], root: -1, score: 0 });
  for (const a of out) a.score = (a.ev.tags.includes('story') ? storyWeight : 0) + Math.min(a.chain.length, 6) * 0.3 + (SKIP.has(a.ev.type) ? -1 : 1) + (a.ev.actors.length > 1 ? 0.5 : 0);
  return out.sort((x, y) => y.score - x.score || x.ev.t - y.ev.t);
}
