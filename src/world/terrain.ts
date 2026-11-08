// Single source of truth for ground height. Everything stands on groundH(x,z).
import { BARGE, BED_Y, bridgeTop, CANAL, DECK_Y, PIER3, PIER7, QUAY_Z, RECTS, ROADS, V2 } from './layout';

export function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function vnoise(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function segDist(px: number, pz: number, a: V2, b: V2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2)) : 0;
  return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz);
}
/** distance to nearest road centreline minus its half-width (<0 = on the carriageway), with road index */
export function roadDist(x: number, z: number): { d: number; road: number; dc: number; hw: number } {
  let best = 1e9, bi = -1, bdc = 1e9, bhw = 0;
  for (let i = 0; i < ROADS.length; i++) {
    const r = ROADS[i], hw = r.w / 2;
    for (let k = 0; k < r.pts.length - 1; k++) {
      const dc = segDist(x, z, r.pts[k], r.pts[k + 1]), d = dc - hw;
      if (d < best) { best = d; bi = i; bdc = dc; bhw = hw; }
    }
  }
  return { d: best, road: bi, dc: bdc, hw: bhw };
}
export function inCanal(x: number, z: number) { return x > CANAL.x0 && x < CANAL.x1 && z > CANAL.z0 && z < QUAY_Z + 0.01; }
export function inHarbour(z: number) { return z >= QUAY_Z; }
export type Surface = 'water' | 'road' | 'walk' | 'plaza' | 'flags' | 'yard';
export function surfaceAt(x: number, z: number): Surface {
  if (inCanal(x, z) || inHarbour(z)) return 'water';
  for (const r of RECTS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.kind === 'setts' ? 'plaza' : r.kind === 'flags' ? 'flags' : 'yard';
  const rd = roadDist(x, z);
  if (rd.d <= 0) return 'road';
  const walk = ROADS[rd.road]?.walk ?? 2;
  return rd.d <= walk ? 'walk' : 'yard';
}
const SLOPE = 0.0107;
export function hillH(x: number, z: number) {
  const g = sm(0, 1, (-z - 5) / 50) * sm(0, 1, (x - 14) / 26);
  return 6 * g;
}
export function groundH(x: number, z: number): number {
  if (inCanal(x, z) || inHarbour(z)) return BED_Y;
  let h = -z * SLOPE + hillH(x, z);
  const rd = roadDist(x, z);
  let inRect = false;
  for (const r of RECTS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) { inRect = true; break; }
  const noise = 0.035 * vnoise(x * 0.8, z * 0.8) + 0.015 * vnoise(x * 3, z * 3);
  if (rd.d <= 0 && !inRect) {
    const t = rd.dc / rd.hw;
    h += 0.07 * (1 - t * t) - 0.025 * Math.exp(-((rd.dc - rd.hw * 0.3) ** 2) * 6);
  } else h += 0.14 * (inRect ? 1 : sm(0, 0.3, rd.d)) + 0.012 * vnoise(x * 0.6, z * 0.6);
  return h + noise;
}

/** where an NPC's feet stand: terrain, or the bridge deck / pier / barge when over them */
export function walkY(x: number, z: number): number {
  if (Math.abs(z) < 3 && Math.abs(x) < 9) return bridgeTop(x);
  if (Math.abs(x - PIER3.x) < PIER3.w / 2 && z > PIER3.z0 && z < PIER3.z1) return DECK_Y;
  if (Math.abs(x - PIER7.x) < PIER7.w / 2 && z > PIER7.z0 && z < PIER7.z1) return DECK_Y;
  if (Math.abs(x - BARGE.x) < BARGE.w / 2 && Math.abs(z - BARGE.z) < BARGE.l / 2) return BARGE.top;
  return groundH(x, z);
}
