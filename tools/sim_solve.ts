// sim:solve — эталон §11 записанным списком действий. Печатает нить на каждом шаге.
import { createSim, learn, setFlag, fmtMin, min } from '../src/sim/types';
import { currentThread, branchState } from '../src/sim/sim';

const sim = createSim();
const log = (what: string) => console.log(`${fmtMin(sim.t)}  ${what.padEnd(42)} нить: ${currentThread(sim).key}`);

log('старт на крыше, пролог');
sim.t = min(5);
learn(sim, 'prologueDone');

// 1 — опоздал к Орвену, прыжок на 22:08
sim.t = min(13);
learn(sim, 'orvenLate');
log('Орвен заперт');

let s = branchState(sim, min(8));
Object.assign(sim, s);
log('прыжок −5 минут');
learn(sim, 'orven');
log('разговор с Орвеном');
learn(sim, 'ned');

// 3 — Тильда в переулке
sim.t = min(10);
learn(sim, 'tildaSeen');
log('Тильда: Анка и баржа');

// 4 — Нед на мосту
sim.t = min(12);
learn(sim, 'nedTalked');
learn(sim, 'tavern');
learn(sim, 'gunKnown');
log('Нед: ключ у людей Корда');

// 5 — таверна после взрыва
sim.t = min(20);
learn(sim, 'tavernSeen');
learn(sim, 'gun');
log('Агата: у Фомы ствол');

// 6 — Фома: сквозь время
sim.t = min(42);
learn(sim, 'fomaHint');
s = branchState(sim, min(15));
Object.assign(sim, s);
setFlag(sim, 'gunTaken');
sim.weapon = true;
sim.ammo = 18;
learn(sim, 'gunTaken');
log('револьвер из кладовки');
s = branchState(sim, min(42));
Object.assign(sim, s);
log('обратно в руины');

// 7 — прыжок на 22:00 в таверну
sim.t = min(3);
setFlag(sim, 'tavernCleared');
learn(sim, 'tavernCleared');
learn(sim, 'key');
log('бой в «Якоре», ключ Игната');

// 8 — ключ Орвену
s = branchState(sim, min(5));
Object.assign(sim, s);
learn(sim, 'safe');
log('Орвен: сейф Гейла');

// 9 — контора: раненый Гейл
sim.t = min(14);
learn(sim, 'explosion');
learn(sim, 'anna');
log('Гейл: предупредить Анну');

// 10 — второй заход в контору
s = branchState(sim, min(5));
Object.assign(sim, s);
learn(sim, 'safeOpened');
sim.pocket = 'list';
learn(sim, 'tikhon');
learn(sim, 'wagon');
log('сейф открыт: список рулевых, лист');

// 11 — приют
sim.t = min(20);
learn(sim, 'shelter');
log('Агния: детей везут в 22:40');
sim.t = min(30);
sim.pocket = 'ribbon';
learn(sim, 'tilda');
log('Анка: лента для мамы');

// 12 — баржа, прыжок назад к Тильде
sim.t = min(34);
s = branchState(sim, min(22));
Object.assign(sim, s);
learn(sim, 'tildaWarned');
setFlag(sim, 'tildaWarned');
log('Тильда предупреждена, бежит в приют');

// 13 — Тихон
sim.t = min(24);
learn(sim, 'tikhonTalked');
sim.pocket = 'cap';
setFlag(sim, 'tikhonTurned');
learn(sim, 'pier3');
log('Тихон отдал кепку и ключ');

// 15 — пристань, катер
sim.t = min(37);
sim.t = min(38);
setFlag(sim, 'boarded');
log('катер отходит');

// 16 — финал
sim.t = min(46);
sim.finale = true;
log('финал: синхронизация удержана');
console.log('прыжков:', sim.jumps + 9);
