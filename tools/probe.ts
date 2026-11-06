import { createWorld, step } from '../src/sim/world';
import { clock } from '../src/sim/map';
import { ending } from '../src/sim/news';
const seed = Number(process.argv[2] ?? 1);
const mode = process.argv[3] ?? 'base';
const w = createWorld(seed, { sealed: false });
if (mode === 'nopass') w.items.pass.loc = { k: 'gone' };
if (mode === 'nopass2') { w.items.pass.loc = { k: 'npc', id: 'tilda' }; w.npcs.tilda.inv.push('pass'); }
const verbose = process.argv[4] === 'v';
while (w.t < 2400) { step(w); if (verbose && w.tick % 60 === 0 && w.t > 1700) console.log(clock(w.t), 'P=', w.P.toFixed(2), 'S/K/H', w.gas.S.toFixed(2), w.gas.K.toFixed(2), w.gas.H.toFixed(2), 'v', w.v, 'matvey', w.npcs.matvey.ph, w.npcs.matvey.node); }
for (const e of w.events) if (!['LEARN', 'DIALOG', 'INSPECT', 'REST', 'TRAM_DEPART', 'DOOR_BARRED', 'KIOSK_CLOSED'].includes(e.type)) console.log(clock(e.t), Math.round(e.t), e.id, e.type, e.actors.join(','), '<-', e.cause.join(','), JSON.stringify(e.d ?? {}));
console.log('ENDING', ending(w), 'fire', w.fire.started, w.fire.ignitedAt, 'news', w.newsId, 'gas', w.gas.S.toFixed(2), w.gas.K.toFixed(2), 'P', w.P.toFixed(2));
