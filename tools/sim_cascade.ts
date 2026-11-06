// sim:cascade — каскад «проездной → пожар» не скриптован, а вытекает из общих правил (спека §8, §10).
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, step } from '../src/sim/world';
import { Session } from '../src/sim/session';
import { World } from '../src/sim/core';
import { clock, T1, hm } from '../src/sim/map';

let fails = 0;
const check = (name: string, ok: boolean, info = '') => { console.log(ok ? 'OK  ' : 'FAIL', name, info); if (!ok) fails++; };
const run = (w: World) => { while (w.t < T1) step(w); return w; };
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

// 1. baseline: пожар к ~21:58, причинная цепочка от IGNITION до PICKUP проездного
const ALLOWED = new Set(['PICKUP', 'SEARCH_FAILED', 'BOARD_DENIED', 'WALK_STARTED', 'REST', 'FLAG_DELIVERED', 'SIGNAL_RAISED', 'DOCK_DECISION', 'OBSTACLE_PLACED', 'PATH_REPLANNED', 'PLAN_COMPRESSED', 'PRESSURE_SPIKE', 'JOINT_LEAK', 'GAS_THRESHOLD', 'IGNITION', 'KEY_HANDED', 'WAIT_FLAG', 'VALVE_OPENED']);
function chain(w: World): number[] | null {
  const ig = w.events.find((e) => e.type === 'IGNITION'); if (!ig) return null;
  const root = w.events.find((e) => e.type === 'PICKUP' && e.actors.includes('pip')); if (!root) return null;
  // BFS по причинам
  const prev = new Map<number, number>(); const q = [ig.id]; prev.set(ig.id, -1);
  while (q.length) { const id = q.shift()!; if (id === root.id) break; for (const c of w.events[id].cause) if (!prev.has(c)) { prev.set(c, id); q.push(c); } }
  if (!prev.has(root.id)) return null;
  const out: number[] = []; let cur = root.id; while (cur !== -1) { out.push(cur); cur = prev.get(cur)!; }
  return out; // от корня к поджогу
}
let chainStr = '';
for (const seed of SEEDS) {
  const w = run(createWorld(seed, { sealed: false }));
  const c = chain(w);
  check(`seed ${seed}: baseline → пожар`, w.fire.started && w.fire.ignitedAt > 2200, `ignition ${clock(w.fire.ignitedAt)}`);
  check(`seed ${seed}: цепочка PICKUP→…→IGNITION из общих типов`, !!c && c.every((id) => ALLOWED.has(w.events[id].type)), c ? c.map((id) => w.events[id].type).join('→') : 'нет пути');
  if (c && !chainStr) chainStr = c.map((id) => `${clock(w.events[id].t)} ${w.events[id].type}`).join('\n   → ');
}
console.log('   → ' + chainStr);

// 2. убрать причину: проездной у Тильды с самого начала
for (const seed of SEEDS) {
  const w = createWorld(seed, { sealed: false });
  w.items.pass.loc = { k: 'npc', id: 'tilda' }; w.npcs.tilda.inv.push('pass'); run(w);
  check(`seed ${seed}: проездной у Тильды → пожара нет`, !w.fire.started, `лампы ${w.lampsDone ? 'зажжены' : '—'}, S=${w.gas.S.toFixed(1)}`);
}
// 3. игрок вернул проездной Тильде до 21:27 (без прыжков): забрал со скамьи раньше Пип
for (const seed of [1, 2, 3]) {
  const S = new Session(seed, { sealed: false });
  S.gotoObj('bench'); S.take('pass'); S.wait(5);
  S.waitUntil(hm('21:25') + 20); S.gotoNpc('tilda'); S.give('tilda');
  S.advanceTo(T1);
  check(`seed ${seed}: игрок вернул проездной до 21:27 → пожара нет`, !S.w.fire.started, `исход ${S.ending}`);
}
// 4. игрок рядом со скамьёй — «взрослые смотрят», Пип не берёт
for (const seed of [1, 2]) {
  const S = new Session(seed, { sealed: false });
  S.gotoObj('bench'); S.waitUntil(hm('21:28')); S.advanceTo(T1);
  check(`seed ${seed}: присутствие игрока у скамьи → Пип не берёт → пожара нет`, !S.w.fire.started && !S.w.events.some((e) => e.type === 'PICKUP' && e.actors.includes('pip')));
}
// 5. grep: в src/sim нет связей «проездной → пожар», нет Math.random/Date.now
const dir = path.resolve('src/sim');
const skip = new Set(['plans.ts', 'solver.ts', 'dialogData.ts']);
let bad = 0;
for (const f of fs.readdirSync(dir)) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  if (/Math\.random|Date\.now|performance\.now/.test(src.replace(/\/\/.*$/gm, ''))) { console.log('   недопустимо в', f); bad++; }
  if (skip.has(f)) continue;
  src.split('\n').forEach((ln, i) => {
    const code = ln.replace(/\/\/.*$/, '');
    if (/pass/i.test(code) && /(fire|ignit|поджог|пожар)/i.test(code) && !/ALLOWED|passenger|pax/i.test(code)) { console.log(`   подозрительная связь ${f}:${i + 1}: ${ln.trim()}`); bad++; }
    if (/if\s*\(.*pass.*\)\s*\{?\s*(ignite|fire)/i.test(code)) { console.log('   if(pass)…fire', f, i + 1); bad++; }
  });
}
check('grep src/sim: нет Math.random/Date.now и связок pass→fire', bad === 0);
console.log(fails ? `\n${fails} проверок провалено` : '\nsim:cascade — зелёный');
process.exit(fails ? 1 : 0);
