import { Session } from '../src/sim/session';
import * as P from '../src/sim/plans';
import { clock } from '../src/sim/map';
function prep(carry: 'key' | 'coin') {
  const S = new Session(1);
  P.lesson(S); P.observe(S); S.threadReturn();
  (carry === 'key' ? P.carryKey : P.carryCoin)(S);
  return S;
}
const rep = (tag: string, S: Session) => console.log(tag.padEnd(34), 'ending', S.ending, 'news', S.headline, 'fire', S.w.fire.started, 'P', S.w.P.toFixed(2), 'lamps', S.w.lampsDone, 'jumps', S.jumps);
for (const keyTo of ['none', 'matvey'] as const) for (const bleedAt of [480, 540]) for (const keyAt of [1100, 1900, 2000, 2100]) {
  if (keyTo === 'none' && keyAt !== 1100) continue;
  const S = prep('key'); P.finalA({ bleedAt, keyTo, keyAt })(S); rep(`A ${keyTo} bleed${bleedAt} keyAt${keyAt}`, S);
}
{ const S = prep('coin'); P.finalC({ releaseAt: 1900 })(S); rep('C release1900', S); }
{ const S = prep('coin'); P.finalC({ releaseAt: 1900 })(S); rep('C r1900b', S); }
{ const S = prep('coin'); P.finalC({ releaseAt: 2100 })(S); rep('C r2100', S); }
{ const S = prep('coin'); P.finalB(S); rep('B', S); }
