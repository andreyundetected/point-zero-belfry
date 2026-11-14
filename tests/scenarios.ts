// sim:scenarios - the story stays passable in the awkward cases: the player is late, stands around, comes at the wrong time, skips a step.
// Two layers: (1) what each conversation tree can teach (every reachable fx executed against a recording Ctx), (2) when each key NPC is where the player needs them.
import { Conv } from '../src/game/dialogue';
import * as W from '../src/content/d_west'; import * as T from '../src/content/d_tavern'; import * as E from '../src/content/d_east'; import * as P from '../src/content/d_pier'; import * as C from '../src/content/d_core';
import { prologue, prologue2 } from '../src/content/d_prologue'; import { finale } from '../src/content/d_finale';
import { Flags, FlagName } from '../src/sim/flags'; import { SimWorld } from '../src/sim/world'; import { at, fmt } from '../src/sim/time';
import { insideSite } from '../src/sim/sites';
let fails = 0, checks = 0;
const ok = (c: boolean, m: string) => { checks++; if (!c) { fails++; console.log('FAIL  ' + m); } else console.log('ok    ' + m); };
const all = [prologue, prologue2, ...Object.values(W), ...Object.values(T), ...Object.values(E), ...Object.values(P), ...Object.values(C), finale].filter((c): c is Conv => !!c && typeof (c as Conv).id === 'string');
const byId = new Map(all.map(c => [c.id, c]));
/** everything a tree can teach when the player knows everything already asked for (upper bound) and when he knows nothing (lower bound) */
function teaches(c: Conv, knowsAll: boolean) {
  const learned = new Set<string>(), threads = new Set<string>(), flags = new Set<string>(), given = new Set<string>(); let ends = 0;
  const ctx: any = { s: { knownAt: new Map(), t: 0, pocket: undefined }, advance() {}, bark() {}, thread: (k: string) => threads.add(k), flag: (n: string) => flags.add(n), give: (i: string) => given.add(i), take() {}, learn: (id: string) => learned.add(id), note() {}, message() {}, npcAct() {}, end() { ends++; }, has: () => knowsAll, knows: () => knowsAll, count: () => 0, ever: () => 0, talked: () => false, topic() {}, place: () => 'street', npcAt: () => ({ x: 0, z: 0, y: 0, a: 'idle', hidden: false }), fl: () => knowsAll, t: () => at(22, 10), money() {}, gun: () => knowsAll, conv() {}, fomaRuinOn: () => false, hurt() {}, jumpRel() {}, openDoor() {}, item: () => knowsAll };
  const starts = new Set<string>(); if (typeof c.start === 'string') starts.add(c.start); else for (const n of [0, 1, 2]) for (const e of [0, 1]) { try { starts.add((c.start as any)({ ...ctx, count: () => n, ever: () => e })); } catch { /* */ } }
  for (const it of c.interrupts ?? []) starts.add(it.node);
  const seen = new Set<string>(); const q = [...starts];
  while (q.length) { const id = q.pop()!; if (seen.has(id)) continue; seen.add(id); const n = c.nodes[id]; if (!n) continue; try { n.fx?.(ctx); } catch { /* */ }
    if (n.next) q.push(n.next); for (const ch of n.choices ?? []) { if (!knowsAll && (ch.know || (ch.if && !safe(() => ch.if!(ctx))))) continue; try { ch.fx?.(ctx); } catch { /* */ } if (ch.next) q.push(ch.next); } }
  return { learned, threads, flags, given };
}
const safe = (f: () => boolean) => { try { return f(); } catch { return false; } };
const need = (conv: string, what: string, where: 'learned' | 'threads' | 'flags' | 'given', minimal = true) => { const c = byId.get(conv); if (!c) { ok(false, `${conv} exists`); return; } const r = teaches(c, !minimal); ok(r[where].has(what), `${conv} ${minimal ? 'without any prior knowledge' : 'at best'} gives ${where}:${what}`); };
console.log('== what the trees teach');
need('orven', 'know_ned', 'learned'); need('orven', 'know_anchor', 'learned'); need('orven', 'ned', 'threads');
need('ned', 'know_foma_guns', 'learned'); need('ned', 'gun', 'threads'); need('ned', 'nedKept', 'flags', false);
need('agata.after', 'gun', 'threads'); need('agata.after', 'know_foma_guns', 'learned');                       // missed Ned entirely: Agata still points at Foma
need('orven.key', 'know_safe', 'learned');
need('gayl.window', 'safeOpened', 'flags', false); need('gayl.wounded', 'know_gayl_wife', 'learned'); need('gayl.wounded', 'anna', 'threads');
need('agnia', 'know_crane_orders', 'learned', false); need('anna', 'annaWarned', 'flags', false); need('anka', 'ribbon', 'given', false);
need('tilda.pier', 'tildaWarned', 'flags', false); need('lukyan', 'know_envelope', 'learned', false);
need('tikhon.door', 'tikhonTurned', 'flags', false); need('tikhon.door', 'cap', 'given', false);
need('guard.pier3', 'helm_ok', 'learned', false);
need('fern', 'know_tap_man', 'learned'); need('lidia.steps', 'know_fuse', 'learned', false); need('stern', 'tapCut', 'flags', false);
need('foma.door', 'foma_door', 'learned', false); need('foma.caught', 'fomaAlarmed', 'flags', false);
// ---- (2) timing windows, every key branch
console.log('== windows');
const SCEN: Record<string, [FlagName, number][]> = { base: [], saved: [['nedKept', 700], ['talk_ned', 690]], early: [['nedLeftEarly', 200], ['jetonStolen', 190]], tilda: [['tildaWarned', 1330], ['annaWarned', 1300]], tap: [['tapCut', 40], ['tikhonTurned', 1500], ['wagonPinPulled', 1500]], warned: [['gaylWarned', 330], ['fomaWarned', 1300], ['talk_orven', 100], ['talk_foma', 1200], ['prologueOver', 200]], late: [['prologueOver', 400], ['talk_orven', 420]] };
for (const [sn, fl] of Object.entries(SCEN)) { const F = new Flags(); for (const [k, t] of fl) F.put(k, t); const sim = new SimWorld(F); const p = (id: string, t: number) => sim.pose(id, t);
  const span = (id: string, t0: number, t1: number, test: (q: ReturnType<typeof p>) => boolean, step = 5) => { for (let t = t0; t <= t1; t += step) if (!test(p(id, t))) return fmt(t); return null; };
  // Orven can be met from 22:00 until he leaves (22:02:10, or after the talk if you spoke to him)
  const orvenGone = fl.find(f => f[0] === 'talk_orven') ? Math.max(at(22, 6), fl.find(f => f[0] === 'talk_orven')![1] + 20) : at(22, 2, 10);
  ok(!span('orven', at(22, 0), orvenGone - 1, q => !q.hidden && Math.hypot(q.x + 46, q.z + 33) < 12), `[${sn}] Orven reachable 22:00..${fmt(orvenGone)}`);
  ok(p('orven', orvenGone + 100).hidden || Math.hypot(p('orven', orvenGone + 100).x + 46, p('orven', orvenGone + 100).z + 33) > 5, `[${sn}] Orven gone after ${fmt(orvenGone)}`);
  // Tilda stands at the alley mouth 22:03..22:20 (unless already warned)
  if (!fl.find(f => f[0] === 'tildaWarned')) ok(!span('tilda', at(22, 3, 10), at(22, 19, 50), q => !q.hidden && !q.walking && q.z < -25), `[${sn}] Tilda waits at the alley 22:03..22:20`);
  // Ned at the rail 22:06..22:14 unless he left early
  if (!fl.find(f => f[0] === 'nedLeftEarly')) ok(!span('ned', at(22, 6, 5), at(22, 13, 55), q => !q.hidden && Math.abs(q.z - 1.85) < 0.6 && Math.abs(q.x - 0.6) < 0.6), `[${sn}] Ned at the rail 22:06..22:14`);
  // Agata is behind the bar all night (tavern is always a fallback)
  ok(!span('agata', at(22, 0), at(23, 0), q => !q.hidden && insideSite('tavern', q.x, q.z), 30), `[${sn}] Agata in the Anchor all night`);
  // Foma inside until the fire, then in the street
  if (!fl.find(f => f[0] === 'fomaWarned')) ok(!span('foma', at(22, 0), at(22, 27, 50), q => !q.hidden && insideSite('foma', q.x, q.z), 10), `[${sn}] Foma in his shop until the gas`);
  ok(!span('foma', at(22, 31), at(23, 0), q => !q.hidden && !insideSite('foma', q.x, q.z), 30), `[${sn}] Foma in the street after the fire`);
  // Gayl: in the office before the raid; wounded in the yard after (unless warned)
  if (!fl.find(f => f[0] === 'gaylWarned')) ok(!span('gayl', at(22, 0), at(22, 10, 20), q => !q.hidden && insideSite('contora', q.x, q.z), 10), `[${sn}] Gayl in his office before 22:10`);
  if (!fl.find(f => f[0] === 'gaylWarned' || f[0] === 'annaWarned' || f[0] === 'jetonStolen' || f[0] === 'nedLeftEarly')) ok(!span('gayl', at(22, 14), at(23, 0), q => !q.hidden && q.a === 'die', 30), `[${sn}] wounded Gayl lies in the yard till the end`);
  // Tikhon at home until 22:28, Lukyan on the pier until the shot, the launch guards at pier 3 at 22:35
  if (!fl.find(f => f[0] === 'tikhonTurned')) ok(!span('tikhon', at(22, 0), at(22, 27, 50), q => !q.hidden && insideSite('tikhon', q.x, q.z), 10), `[${sn}] Tikhon at home until 22:28`);
  ok(!span('lukyan', at(22, 0), at(22, 32, 50), q => !q.hidden && q.z > 55, 10), `[${sn}] Lukyan on pier 7 until the shot`);
  ok(!span('dock1', at(22, 35), at(22, 39, 50), q => !q.hidden && q.z > 55 && q.x < -30, 10), `[${sn}] pier-3 guards present 22:35..22:40`);
  ok(!span('anna', at(22, 0), at(22, 29), q => !q.hidden && insideSite('priyut', q.x, q.z), 10), `[${sn}] Anna in the orphanage before 22:30`);
}
console.log(`${checks - fails}/${checks} scenario checks passed`); process.exit(fails ? 1 : 0);
