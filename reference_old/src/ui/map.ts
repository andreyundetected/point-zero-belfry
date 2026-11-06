import type { Sim } from '../sim/sim';
import { locName, npcName } from '../i18n';

const SKIP = new Set(['street', 'booth', 'crossing', 'billboard', 'tower_hall', 'tower_office']);
/** Top-down map: radius<=0 draws the whole city. */
export function drawMap(c: HTMLCanvasElement, sim: Sim, px: number, py: number, facing: number, radius: number, names: boolean, known: Set<string> = new Set()) {
  const W = c.width, H = c.height, g = c.getContext('2d')!;
  const bx0 = -200, bx1 = 3900, by0 = -1600, by1 = 2000;
  const sc = radius > 0 ? Math.min(W, H) / (radius * 2) : Math.min(W / (bx1 - bx0), H / (by1 - by0));
  const cx = radius > 0 ? px : (bx0 + bx1) / 2, cy = radius > 0 ? py : (by0 + by1) / 2;
  const X = (x: number) => W / 2 + (x - cx) * sc, Y = (y: number) => H / 2 + (y - cy) * sc;
  g.fillStyle = 'rgba(4,6,12,0.92)'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(30,70,110,0.5)'; g.fillRect(X(2490), 0, 220 * sc, H); // river
  g.strokeStyle = 'rgba(53,242,230,0.55)'; g.lineWidth = 2; g.beginPath(); // tram line 7
  sim.def.tram.stops.forEach((s, i) => { const l = sim.locs[s]; i ? g.lineTo(X(l.x), Y(l.y)) : g.moveTo(X(l.x), Y(l.y)); }); g.stroke();
  g.font = `${radius > 0 ? 10 : 12}px "JetBrains Mono", monospace`;
  for (const l of Object.values(sim.locs)) {
    if (SKIP.has(l.id) || l.id.startsWith('h_') || l.id.startsWith('w_')) continue;
    if (l.id.startsWith('k_')) { g.fillStyle = '#ff8a3d'; g.beginPath(); g.arc(X(l.x), Y(l.y), 2.5, 0, 7); g.fill(); continue; }
    g.fillStyle = '#ffe14a'; g.fillRect(X(l.x) - 3, Y(l.y) - 3, 6, 6);
    if (names) { g.fillStyle = '#cfe3ff'; g.fillText(locName(l.id), X(l.x) + 7, Y(l.y) + 3); }
  }
  for (const n of Object.values(sim.world.npcs)) {
    if (!known.has(n.id)) continue; // you only know where people are once you have met them
    const key = !n.id.startsWith('c_');
    g.fillStyle = key ? '#35f2e6' : 'rgba(150,170,210,0.5)'; g.beginPath(); g.arc(X(n.pos.x), Y(n.pos.y), key ? 3 : 1.5, 0, 7); g.fill();
    if (names && (radius <= 0 || Math.hypot(n.pos.x - px, n.pos.y - py) < radius * 0.55)) { g.fillStyle = '#9fe'; g.fillText(npcName(n.id), X(n.pos.x) + 5, Y(n.pos.y) - 4); }
  }
  for (const it of sim.world.ground) { const l = sim.locs[it.loc]; g.fillStyle = '#ff4fd8'; g.beginPath(); g.arc(X(l.x + 2), Y(l.y + 3), 3.5, 0, 7); g.fill(); }
  g.save(); g.translate(X(px), Y(py)); g.rotate(facing); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, 5); g.lineTo(-5, -5); g.closePath(); g.fill(); g.restore();
  g.strokeStyle = 'rgba(53,242,230,0.5)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, W - 1, H - 1);
}
