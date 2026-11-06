import type { WorldDef } from './types';

export function buildGraph(def: WorldDef): Map<string, Set<string>> {
  const g = new Map<string, Set<string>>();
  for (const n of def.npcs) g.set(n.id, new Set());
  for (const n of def.npcs) for (const [o, ] of n.rel) { g.get(n.id)!.add(o); g.get(o)?.add(n.id); }
  return g;
}
export function pathLens(g: Map<string, Set<string>>, from: string): Map<string, number> {
  const d = new Map([[from, 0]]); const q = [from];
  while (q.length) { const c = q.shift()!; for (const o of g.get(c) ?? []) if (!d.has(o)) { d.set(o, d.get(c)! + 1); q.push(o); } }
  return d;
}
export function validateGraph(def: WorldDef, target = 'lash') {
  const g = buildGraph(def); const errs: string[] = []; const dist = pathLens(g, target);
  for (const [id, set] of g) {
    if (set.size < 2) errs.push(`${id}: <2 links`);
    const d = dist.get(id);
    if (d === undefined || d > 4) errs.push(`${id}: path to ${target} = ${d}`);
  }
  for (const n of def.npcs) for (const [o] of n.rel) if (!g.has(o)) errs.push(`${n.id}: unknown rel ${o}`);
  return errs;
}
