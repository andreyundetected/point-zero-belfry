import { createWorld, step } from '../src/sim/world';
import { P } from '../src/sim/params';
import { clock } from '../src/sim/map';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')).map(([k, v]) => [k, Number(v)]));
Object.assign(P, args);
function run(mode: string, seed = 1) {
  const w = createWorld(seed, { sealed: false });
  if (mode === 'nopass2') { w.items.pass.loc = { k: 'npc', id: 'tilda' }; w.npcs.tilda.inv.push('pass'); }
  while (w.t < 2400) {
    if (mode === 'A' && Math.abs(w.t - 560) < 0.2) { w.ks1Open = true; w.w = 1; w.ks1Open = false; w.ks1Locked = true; }
    if (mode === 'A' && w.t === 1300) { w.ks1Open = false; }
    step(w);
  }
  const ig = w.fire.started ? clock(w.fire.ignitedAt) + '(' + w.fire.ignitedAt + ')' : '-';
  return `${mode.padEnd(8)} ignite=${ig} S=${w.gas.S.toFixed(2)} K=${w.gas.K.toFixed(2)} H=${w.gas.H.toFixed(2)} P=${w.P.toFixed(2)} leak=${w.events.find(e => e.type === 'JOINT_LEAK')?.t ?? '-'} spike=${w.events.find(e => e.type === 'PRESSURE_SPIKE')?.t ?? '-'}`;
}
for (const m of ['base', 'nopass2', 'A']) console.log(run(m));
