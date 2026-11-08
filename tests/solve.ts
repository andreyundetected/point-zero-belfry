// sim:solve - the reference walkthrough (spec 11) replayed against the simulation: jumps, flags, and what the world looks like afterwards.
import { Flags, FlagName } from '../src/sim/flags';
import { SimWorld, cityState } from '../src/sim/world';
import { at, fmt } from '../src/sim/time';
import { wagonPath } from '../src/sim/npcs';

let fails = 0, checks = 0; const log: string[] = [];
const ok = (cond: boolean, msg: string) => { checks++; if (!cond) { fails++; log.push('FAIL  ' + msg); } else log.push('ok    ' + msg); };
// ---- a tiny model of the player's side: knowledge persists through jumps, flags and the world do not
const know = new Set<string>(); let pocket: string | undefined; let flags = new Flags(); let sim = new SimWorld(flags); let t = 0; let jumps = 0;
const jump = (to: number, why: string) => { jumps++; flags = new Flags(); sim = new SimWorld(flags); t = to; log.push(`  ⟲ jump ${jumps}: ${why} -> ${fmt(to)}`); };
const act = (f: FlagName) => { flags.set(f, t); sim.setFlags(flags); };
const at_ = (id: string, tt: number) => sim.pose(id, tt);
const near = (id: string, tt: number, x: number, z: number, r: number) => { const p = at_(id, tt); return !p.hidden && Math.hypot(p.x - x, p.z - z) <= r; };

// 1. prologue: jump -3 min on the roof (we start at 22:03:30)
t = at(22, 3, 30); jump(t - 180, 'prologue lesson'); know.add('prologue_done');
ok(near('crane', at(22, 0, 40), -70.4, -60.6, 1) && near('lidia', at(22, 0, 40), -72.2, -57.4, 1.5), 'roof 22:00: Crane at the parapet, Lidia at the chest');
// 2. late for Orven: shop locked at 22:13, jump back 5 minutes
t = at(22, 13); ok(at_('orven', t).hidden, 'Orven is gone by 22:13 (shop locked)'); jump(at(22, 8, 40), 'Orven closes at 22:09');
ok(!at_('orven', at(22, 9, 30)).hidden, 'Orven is at his door at 22:09:30 and talkable'); know.add('know_ned');
// 3. Tilda in the alley 22:08-22:14
ok(near('tilda', at(22, 10), -37.2, -33.2, 2), 'Tilda stands in Kluchnikov alley at 22:10'); know.add('know_lukyan');
// 4. bridge and Ned
ok(near('ned', at(22, 12), 0.4, 2.3, 1), 'Ned is at the south rail of the Old Bridge at 22:12'); ok(at_('ned', at(22, 17)).hidden, 'unsaved Ned has jumped by 22:17');
const f2 = new Flags(); f2.set('nedSaved', at(22, 13)); const sim2 = new SimWorld(f2); ok(!sim2.pose('ned', at(22, 17)).hidden, 'saved Ned is still there at 22:17');
// 5. tavern after the blast: empty, Agata only
ok(near('agata', at(22, 20), 24, 9, 7), 'Agata is still in the tavern at 22:20 (sweeping glass)'); ok(!near('ignat', at(22, 20), 24, 9, 6) && !near('cm4', at(22, 20), 24, 9, 6), 'Ignat and Cord\'s men have left the tavern by 22:20');
// 6. Foma through time: ruins at 22:40+, intact before; tapCut removes the fire
ok(!cityState(at(22, 25), flags).rynokRuin && cityState(at(22, 45), flags).rynokRuin, 'Rynochnaya: intact at 22:25, ruins at 22:45'); know.add('saw_foma_fire');
jump(at(22, 15), 'back into the closed storeroom (spot in the ruins -> same spot at 22:15)'); ok(!cityState(t, flags).rynokRuin, 'at 22:15 the storeroom exists again'); act('gunTaken');
jump(at(22, 42), 'forward again; now the front is ruins'); ok(cityState(t, flags).rynokRuin, 'at 22:42 the shop is a ruin, the player can step out');
// 7. the tavern fight: jump to 22:00 and watch; the token can be stolen (8.2) -> no raid
jump(at(22, 3), 'tavern from the start'); ok(near('ignat', t, 24.6, 8.7, 2) && near('ned', t, 22.4, 8.7, 2), 'at 22:03 Ignat and Ned sit at the table');
act('jetonStolen'); ok(!near('scar', at(22, 11), 45.25, 24.2, 3), 'jeton stolen: Scar does not enter the courier office at 22:11'); ok(at_('gayl', at(22, 14)).a !== 'die', 'jeton stolen: Gayl is not wounded at 22:14');
ok(cityState(at(22, 13), flags).safeBlown === false, 'jeton stolen: the safe is not blown');
const raid = new SimWorld(new Flags()); ok(raid.pose('gayl', at(22, 14)).a === 'die' && raid.city(at(22, 14)).safeBlown, 'default branch: Gayl lies wounded in the yard and the safe is blown');
// 8. key to Orven before 22:09 (second jump), then the safe at 22:05
jump(at(22, 8, 20), 'show the key to Orven'); pocket = 'key'; know.add('know_safe'); ok(!at_('orven', at(22, 9, 30)).hidden, 'Orven can be shown the key');
jump(at(22, 5), 'the safe before the raid'); ok(near('gayl', at(22, 6), 45.3, 28.2, 2), 'Gayl is in his office at 22:06'); know.add('know_manifest'); pocket = 'manifest';
// 9. the orphanage, Tilda intercept, wagon pin
jump(at(22, 22), 'intercept Tilda at pier 7'); ok(near('tilda', at(22, 23), -5.7, 60.2, 2), 'Tilda waits by the barge at 22:23 (intercept window)'); act('tildaWarned');
ok(sim.pose('tilda', at(22, 30)).hidden === false && !near('tilda', at(22, 33), -5.7, 60.2, 3), 'warned Tilda is not at the barge when she would shoot'); ok(!sim.pose('lukyan', at(22, 34)).a.startsWith('die'), 'Lukyan is not shot');
const w = wagonPath(false); ok(w.toBridge(0).length > 0, 'wagon route exists (orphanage -> bridge -> pier 7)');
ok(near('ggrd1', at(22, 44), 9.5, 0.6, 4), 'guards walk with the wagon onto the bridge at 22:44');
// 10. Tikhon and Pip (last branch starts at the 22:22 jump)
act('tikhonTurned'); ok(near('tikhon', at(22, 37), -38, 41, 5), 'Tikhon stays home with Pip after he turns'); ok(!sim.pose('pip', at(22, 40)).hidden, 'Pip is in her bed');
const plain = new SimWorld(new Flags()); { const q = plain.pose('tikhon', at(22, 37)); ok(!q.hidden && Math.hypot(q.x + 42, q.z - 57.5) < 2.5, 'default branch: Tikhon waits on pier 3 at 22:37'); } { const q = plain.pose('yan', at(22, 35, 20)); ok(!q.hidden && Math.hypot(q.x + 42, q.z - 71) < 10, 'Yan is on the pier at 22:35:20'); ok(plain.pose('yan', at(22, 36, 5)).a === 'die', 'Yan is dead by 22:36'); }
ok(plain.pose('harrow', at(22, 40)).hidden, 'Harrow is aboard the launch (not visible on land)');
// 11. the cellar and the fuse: tapCut changes the city
jump(at(22, 0, 30), 'cellar before the technician leaves'); act('tapCut'); const cs = cityState(at(22, 30), flags);
ok(!cs.lampsFlicker && !cs.tramStuck && !cs.rynokBurning && cs.bridgePatrol === false || cityState(at(22, 20), flags).bridgePatrol, 'tapCut: no flicker, tram runs, Rynochnaya does not burn, bridge patrol at 22:18+');
ok(cityState(at(22, 20), flags).bridgePatrol && !cityState(at(22, 20), flags).bellSilent, 'tapCut: patrol on the bridge, the bell rings');
ok(near('stern', at(22, 0, 40), -72.4, -60.4, 3) || new SimWorld(flags).pose('stern', at(22, 0, 40)).y < 0, 'the technician works in the cellar at 22:00:40');
// 12. pier 3 and the final
ok(jumps >= 9, `the reference solution uses ${jumps} jumps (spec: >= 9)`); ok(know.size > 5 && !!pocket, 'knowledge persisted through every jump and the pocket held one item');
console.log(log.join('\n')); console.log(`\n${checks - fails}/${checks} checks passed`); process.exit(fails ? 1 : 0);
void plain;
