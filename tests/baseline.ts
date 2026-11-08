// sim:baseline - the chronology of the night without the player (spec 10 / 16)
import { Flags } from '../src/sim/flags';
import { SimWorld, cityState } from '../src/sim/world';
import { EVENTS } from '../src/sim/events';
import { fmt, at } from '../src/sim/time';
const w = new SimWorld(new Flags());
console.log('== events'); for (const e of EVENTS) console.log(fmt(e.t, true), e.id.padEnd(16), e.ru);
const watch = ['crane', 'lidia', 'fern', 'stern', 'orven', 'tilda', 'ned', 'scar', 'ignat', 'cm1', 'gayl', 'foma', 'tikhon', 'lukyan', 'yan', 'cord', 'anna', 'agnia', 'ggrd1'];
console.log('== positions every 2 min (x,z / anim / H=hidden)');
for (let t = 0; t <= 3600; t += 120) {
  const row = watch.map(id => { const p = w.pose(id, t); return `${id}:${p.hidden ? 'H' : p.x.toFixed(0) + ',' + p.z.toFixed(0) + '/' + p.a}`; }).join(' ');
  console.log(fmt(t), row);
}
const c = cityState(at(22, 31), new Flags()); console.log('== city 22:31', JSON.stringify({ rynokBurning: c.rynokBurning, tram: c.tramStuck, bell: c.bellSilent, fires: c.fires.map(f => f.id) }));
// sanity: every NPC position stays inside the map and never in the canal (except bridge)
import { inCanal } from '../src/world/terrain';
import { BOUNDS } from '../src/world/layout';
let bad = 0;
for (const d of w.defs.values()) for (let t = 0; t <= 3600; t += 10) { const p = w.pose(d.id, t); if (p.hidden) continue;
  const onBridge = Math.abs(p.z) < 3 && Math.abs(p.x) < 9, onPier = p.z > 57;
  if ((inCanal(p.x, p.z) && !onBridge) || p.x < BOUNDS.x0 - 1 || p.x > BOUNDS.x1 + 1) { if (bad++ < 12) console.log('BAD', d.id, fmt(t), p.x.toFixed(1), p.z.toFixed(1)); } void onPier; }
console.log('out-of-world samples:', bad);
