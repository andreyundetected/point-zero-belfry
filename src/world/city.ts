import * as THREE from 'three';
import { M, WALLS } from '../render/materials';
import { Batcher } from './batch';
import { building, BuildingInfo, BuildingOpts } from './building';
import { world } from './colliders';
import { RECTS, ROADS, V2 } from './layout';
import { groundH, hash, roadDist, inCanal } from './terrain';

export interface Placed extends BuildingInfo { id: string; }
export const placed: Placed[] = [];
const rects: { cx: number; cz: number; hx: number; hz: number; ry: number }[] = [];

function obbSamples(cx: number, cz: number, w: number, d: number, ry: number): V2[] {
  // facade centre is (cx,cz); body extends toward local -z by d
  const s = Math.sin(ry), c = Math.cos(ry), pts: V2[] = [];
  for (const lx of [-w / 2, -w / 4, 0, w / 4, w / 2]) for (const lz of [0, -d / 2, -d]) pts.push([cx + lx * c + lz * s, cz - lx * s + lz * c]);
  return pts;
}
/** does a house fit here: not on roads/walks, not in water, not overlapping other houses */
export function fits(cx: number, cz: number, w: number, d: number, ry: number, margin = 0.2): boolean {
  for (const [x, z] of obbSamples(cx, cz, w + margin * 2, d, ry)) {
    if (inCanal(x, z) || z > 56) return false;
    const rd = roadDist(x, z); if (rd.d < 0.4) return false;
    for (const r of RECTS) if (r.kind !== 'yard' && x > r.x0 - 0.3 && x < r.x1 + 0.3 && z > r.z0 - 0.3 && z < r.z1 + 0.3) return false; // squares, quays and yards stay open
    if (world.inside(x, z, ['building'], 0.15)) return false;
  }
  // corners of existing neighbours inside this one
  const s = Math.sin(ry), c = Math.cos(ry);
  for (const p of placed) {
    for (const [x, z] of obbSamples(p.x, p.z, p.w, p.depth, p.ry)) {
      const dx = x - cx, dz = z - cz, lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < w / 2 + margin && lz < 0.3 && lz > -d - 0.3) return false;
    }
  }
  return true;
}

let bt: Batcher, scn: THREE.Scene;
export function initCity(scene: THREE.Scene, batcher: Batcher) { scn = scene; bt = batcher; }

export function put(id: string, o: BuildingOpts, into?: Batcher): Placed {
  const info = building(into ?? bt, scn, o); const p = { ...info, id }; placed.push(p); return p;
}
/** like put() but into another batcher and without registering for the row layout fit tests twice */
export function putGroup(id: string, o: BuildingOpts, into: Batcher): Placed { return put(id, o, into); }
const facing = (fx: number, fz: number) => Math.atan2(fx, fz);

interface RowOpts {
  id: string; a: V2; b: V2; side: 1 | -1; off?: number; wmin?: number; wmax?: number; fmin?: number; fmax?: number; seed: number;
  shopP?: number; depth?: number; skip?: [number, number][]; signs?: Record<number, string>; litP?: [number, number]; low?: boolean; gap?: number;
}
/** a row of different houses along a street segment; skips lots that don't fit */
export function row(o: RowOpts): Placed[] {
  const out: Placed[] = []; const [ax, az] = o.a, [bx, bz] = o.b, len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
  const nx = -dz * o.side, nz = dx * o.side; // from road toward the buildings
  const road = ROADS.find(r => r.id === o.id.split(':')[0]); const hw = (road?.w ?? 5) / 2, walk = road?.walk ?? 2;
  const off = o.off ?? hw + walk + 0.4; let t = 0, k = 0;
  while (t < len - 3) {
    const R = (a: number) => hash(o.seed * 3.3 + k, a * 5.1);
    let w = (o.wmin ?? 6) + R(1) * ((o.wmax ?? 9) - (o.wmin ?? 6)); w = Math.round(w * 2) / 2;
    if (t + w > len) w = len - t;
    const skip = o.skip?.find(([s0, s1]) => t + w > s0 && t < s1);
    if (skip) { t = skip[1] + 0.3; k++; continue; }
    const mid = t + w / 2, setb = (R(2) - 0.5) * 0.5, floors = Math.round((o.fmin ?? 2) + R(3) * ((o.fmax ?? 4) - (o.fmin ?? 2)));
    const cx = ax + dx * mid + nx * (off + setb), cz = az + dz * mid + nz * (off + setb), ry = facing(-nx, -nz);
    const depth = (o.depth ?? 9) + R(4) * 2 - 1;
    k++;
    if (!fits(cx, cz, w, depth, ry)) { t += 1.5; continue; }
    const shop = R(5) < (o.shopP ?? 0.2), lit = (o.litP?.[0] ?? 0.12) + R(6) * ((o.litP?.[1] ?? 0.4) - (o.litP?.[0] ?? 0.12));
    out.push(put(`${o.id}#${k}`, { x: cx, z: cz, ry, w, floors, wall: WALLS[Math.floor(R(7) * 5)], lit, shop, sign: shop ? (o.signs?.[k] ?? null) : null, seed: Math.floor(o.seed * 17 + k * 3 + 1), roof: R(8) < 0.3 ? 'flat' : 'gable', depth, door: 0.2 + R(9) * 0.6 }));
    t += w + 0.05 + R(10) * 0.25;
  }
  return out;
}
/** low-detail silhouette blocks (second line and beyond the map edge) */
export function blocks(minX: number, maxX: number, minZ: number, maxZ: number, step: number, seed: number, hMin = 9, hMax = 26) {
  for (let x = minX; x < maxX; x += step) for (let z = minZ; z < maxZ; z += step) {
    const R = (a: number) => hash(x * 0.37 + seed, z * 0.53 + a);
    const w = 7 + R(1) * 6, d = 7 + R(2) * 6, h = hMin + R(3) * (hMax - hMin), cx = x + (R(4) - 0.5) * 3, cz = z + (R(5) - 0.5) * 3, ry = Math.floor(R(6) * 4) * Math.PI / 2 + (R(7) - 0.5) * 0.12;
    if (!fits(cx, cz, w, d, ry, 0.5)) continue;
    const base = groundH(cx, cz) - 1.5, floors = Math.max(2, Math.round(h / 3.1));
    const H = floors * 3.1;
    const wall = WALLS[Math.floor(R(8) * 5)];
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(cx - Math.sin(ry) * d / 2, base + H / 2 + 0.75, cz - Math.cos(ry) * d / 2);
    bt.box(wall, w, H + 1.5, d, m, 2.2);
    world.add(cx - Math.sin(ry) * d / 2, cz - Math.cos(ry) * d / 2, w / 2, d / 2, ry, base, base + H, 'building');
    placed.push({ id: 'blk', x: cx, z: cz, ry, w, depth: d, H, floors, base, door: { x: cx, z: cz, ry } });
    // lit windows as a dotted band so silhouettes don't read as black slabs
    for (let f = 0; f < floors; f++) for (let b = 0; b < Math.floor(w / 2.4); b++) if (R(20 + f * 7 + b) < 0.2) {
      const lx = -w / 2 + 1.2 + b * 2.4, ly = f * 3.1 + 2.3;
      const px = cx + lx * Math.cos(ry) + 0.06 * Math.sin(ry), pz = cz - lx * Math.sin(ry) + 0.06 * Math.cos(ry);
      bt.box(M.lit, 0.9, 1.2, 0.04, new THREE.Matrix4().makeRotationY(ry).setPosition(px, base + ly + 0.75, pz), 1);
    }
  }
}
