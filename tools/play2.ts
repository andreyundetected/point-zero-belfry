import { Session } from '../src/sim/session';
import * as P from '../src/sim/plans';
let S = new Session(1); P.lesson(S);
const c = S.carryOf2(); const f = [...S.facts];
S = Session.fromState(1, f, S.sealed, c);
P.observe(S); console.log('after observe', S.facts.join(','), S.w.fire.started);
S.threadReturn(); console.log('thread', S.facts.join(','));
