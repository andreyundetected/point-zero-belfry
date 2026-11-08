// sim:hash - determinism: the same interventions give the same world, 10 seeds (spec 15.2)
import { Flags, FlagName } from '../src/sim/flags';
import { SimWorld } from '../src/sim/world';
import { rng, at } from '../src/sim/time';
import { NPCS } from '../src/sim/npcs';
const NAMES: FlagName[] = ['jetonStolen', 'tapCut', 'nedSaved', 'wagonPinPulled', 'tildaWarned', 'annaWarned', 'tikhonTurned', 'tikhonThreatened', 'tikhonHurt', 'ignatDead', 'sternScared', 'fomaWarned', 'gaylWarned'];
function world(seed: number) { const r = rng(seed), f = new Flags(); for (const n of NAMES) if (r() < 0.35) f.set(n, Math.floor(r() * 3000)); return f; }
function digest(f: Flags) { const w = new SimWorld(f); let h = 2166136261; for (let t = 0; t <= 3600; t += 20) for (const d of NPCS) { const p = w.pose(d.id, t); const s = `${d.id}|${t}|${p.hidden ? 'H' : p.x.toFixed(3) + ',' + p.z.toFixed(3) + ',' + p.y.toFixed(3)}|${p.a}`; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } if (!p.hidden && (!isFinite(p.x) || !isFinite(p.z))) throw new Error('NaN pose ' + d.id); }
  const c = w.city(at(22, 31)); const cs = JSON.stringify(c); for (let i = 0; i < cs.length; i++) { h ^= cs.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
let fails = 0; const seen = new Set<string>();
for (let seed = 1; seed <= 10; seed++) { const a = digest(world(seed)), b = digest(world(seed)); seen.add(a); if (a !== b) { fails++; console.log('NONDETERMINISTIC seed', seed, a, b); } else console.log('seed', seed, 'hash', a, world(seed).hash()); }
if (seen.size < 5) { fails++; console.log('different interventions should change the world; distinct hashes:', seen.size); }
console.log(fails ? 'sim:hash FAILED' : `sim:hash ok (${seen.size} distinct worlds, all reproducible)`); process.exit(fails ? 1 : 0);
