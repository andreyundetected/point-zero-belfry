// sim:baseline — хронология ночи без игрока, по минутам.
import { createSim, fmtMin, min } from '../src/sim/types';
import { npcViews } from '../src/sim/sim';
import { eventsAt } from '../src/content/schedule';

const sim = createSim();
console.log('— ЗАТОН, НОЧЬ БЕЗ ИГРОКА —');
for (let m = 0; m <= 60; m++) {
  sim.t = min(m);
  const evs = eventsAt(m, sim.flags);
  if (evs.length) {
    for (const e of evs) console.log(`${fmtMin(sim.t)}  ${e.ru}`);
  }
  if (m % 10 === 0) {
    const people = npcViews(sim).map((v) => v.id).join(', ');
    console.log(`${fmtMin(sim.t)}  на улицах: ${people}`);
  }
}
console.log('— конец окна —');
