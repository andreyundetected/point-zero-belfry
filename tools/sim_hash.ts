// sim:hash — детерминизм: 10 сидов, одинаковый хэш при одинаковых вмешательствах.
import { createSim, learn, setFlag, min } from '../src/sim/types';
import { npcViews } from '../src/sim/sim';
import { eventsAt } from '../src/content/schedule';

function fnv(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function run(seed: number) {
  const sim = createSim(seed);
  const out: string[] = [];
  for (let m = 0; m <= 60; m += 3) {
    sim.t = min(m);
    if (m === 12) learn(sim, 'explosion');
    if (m === 30) setFlag(sim, 'wagonPinPulled');
    out.push(`${m}:${npcViews(sim).map((v) => `${v.id}@${v.x.toFixed(2)},${v.z.toFixed(2)}`).join(';')}`);
    out.push(eventsAt(m, sim.flags).map((e) => e.id).join(','));
  }
  return fnv(out.join('|'));
}

const hashes = Array.from({ length: 10 }, (_, i) => run(i + 1));
console.log(hashes.join('\n'));
const unique = new Set(hashes);
console.log(unique.size === 1 ? 'OK: одинаковый хэш на 10 сидах' : `FAIL: ${unique.size} разных хэшей`);
