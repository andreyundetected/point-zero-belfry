import { World, emit, hasFact, learn, npcHas, giveNpc } from './core';
import { OBJS, TIMES, dist2d } from './map';
import { DIALOGS, INSPECT, type DChoice, type DNode } from './dialogData';
import { tavernZone } from './systems';

export const SKILLS = ['obs', 'tech', 'pers', 'emp', 'cool', 'hand', 'mem', 'auth'] as const;
export type Skill = typeof SKILLS[number];
const BASE: Record<Skill, number> = { obs: 6, tech: 5, pers: 5, emp: 4, cool: 6, hand: 5, mem: 6, auth: 4 };
const BONUS: Record<string, Partial<Record<Skill, number>>> = {
  K1: { tech: 2 }, K3: { tech: 1 }, K5: { pers: 1 }, K6: { emp: 1 }, K8: { emp: 1 }, K9: { tech: 1 }, K4: { obs: 1 },
};
export function skillValue(w: World, s: Skill): number {
  let v = BASE[s];
  for (const f of w.player.facts) v += BONUS[f]?.[s] ?? 0;
  return v;
}

export function dialogStart(w: World, npc: string): string {
  const d = DIALOGS[npc]; if (!d) return '';
  for (const s of d.start) if (!s.c || s.c(w)) return s.node;
  return d.start[d.start.length - 1].node;
}
export interface ChoiceView { id: string; k: string; enabled: boolean; check?: { skill: Skill; dc: number; have: number; ok: boolean }; cost: number }
export interface NodeView { id: string; lines: { who: string; k: string }[]; choices: ChoiceView[]; }
export function dialogView(w: World, npc: string, nodeId: string): NodeView | null {
  const n = DIALOGS[npc]?.nodes[nodeId]; if (!n) return null;
  const skillOk = (l: { min?: [Skill, number] }) => !l.min || skillValue(w, l.min[0]) >= l.min[1];
  return {
    id: nodeId,
    lines: n.lines.filter(skillOk).map((l) => ({ who: l.who, k: l.k })),
    choices: n.choices.filter((c) => !c.c || c.c(w)).map((c) => {
      const have = c.check ? skillValue(w, c.check[0]) : 0;
      return { id: c.id, k: c.k, enabled: true, cost: 15 + (c.check ? 10 : 0), check: c.check ? { skill: c.check[0], dc: c.check[1], have, ok: have >= c.check[1] } : undefined };
    }),
  };
}
export function resolveChoice(w: World, npc: string, nodeId: string, choiceId: string): { next: string | null; ok: boolean; cost: number } {
  const n = DIALOGS[npc]?.nodes[nodeId]; const c = n?.choices.find((x) => x.id === choiceId);
  if (!n || !c) return { next: null, ok: true, cost: 0 };
  let ok = true;
  if (c.check) ok = skillValue(w, c.check[0]) >= c.check[1];
  const next = ok ? (c.to ?? null) : (c.fail ?? null);
  const tn = next ? DIALOGS[npc].nodes[next] : null;
  return { next, ok, cost: 15 + (c.check ? 10 : 0) + (tn ? 6 * tn.lines.length : 0) };
}
export function applyDialog(w: World, npc: string, nodeId: string, choiceId: string) {
  const n = DIALOGS[npc]?.nodes[nodeId]; const c = n?.choices.find((x) => x.id === choiceId);
  if (!n || !c) return;
  const npcObj = w.npcs[npc]; if (!npcObj || dist2d(npcObj.x, npcObj.z, w.player.x, w.player.z) > 5) return;
  const r = resolveChoice(w, npc, nodeId, choiceId);
  emit(w, 'DIALOG', ['player', npc], [], { node: nodeId, choice: choiceId, ok: r.ok ? 1 : 0 }, []);
  if (c.check && !r.ok) { w.player.trust[npc] = (w.player.trust[npc] ?? 0); w.flags['fail:' + npc + ':' + choiceId] = true; }
  if (r.ok && c.fx) c.fx(w);
  if (!r.ok && c.failFx) c.failFx(w);
  if (r.next) { const tn = DIALOGS[npc].nodes[r.next]; tn?.fx?.(w); }
}

// ---------- осмотр объектов ----------
export interface InspectView { name: string; desc: string; voices: { skill: Skill; k: string }[]; facts: string[] }
export function inspectView(w: World, obj: string): InspectView | null {
  const d = INSPECT[obj]; if (!d) return null;
  const descKey = d.desc(w);
  return { name: d.name, desc: descKey, voices: (d.voices ?? []).filter((v) => skillValue(w, v.skill) >= v.dc && (!v.c || v.c(w))).map((v) => ({ skill: v.skill, k: v.k })), facts: d.learn ? d.learn(w) : [] };
}
export function applyInspect(w: World, obj: string) {
  const o = OBJS[obj]; if (!o) return;
  if (dist2d(w.player.x, w.player.z, o.x, o.z) > o.r + 1.2) return;
  const v = inspectView(w, obj); if (!v) return;
  emit(w, 'INSPECT', ['player'], [], { obj }, []);
  for (const f of v.facts) learn(w, f);
}
export { npcHas, giveNpc, hasFact, TIMES, tavernZone };
export type { DChoice, DNode };
