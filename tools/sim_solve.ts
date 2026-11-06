import { solve } from '../src/sim/solver';
const seed = Number(process.argv[2] ?? 1);
const r = solve(seed);
const brief = { ...r, solutions: r.solutions.map((s) => ({ класс: s.cls, прыжков: s.jumps, информированный: s.informed, финал: s.ending, заголовок: s.headline, хэш: s.hash, путь: s.path })) };
console.log(JSON.stringify(brief, null, 1));
console.log('\nmin_jumps(информированный игрок) =', r.minJumpsInformed, '| min_jumps(физически, без знаний) =', r.minJumpsPhysical, '| классы =', r.classes.join(','));
for (const [k, v] of Object.entries(r.assertions)) console.log(v ? 'OK  ' : 'FAIL', k);
process.exit(r.ok ? 0 : 1);
