import * as THREE from 'three';
import { hrand } from '../sim/util';
import type { Loc } from '../sim/types';
import { CELL, ROAD_HALF, LOT_OFF, BOUNDS } from '../sim/grid';
import { makeFacades, makeShops, makeSigns, makeAds, makeRoad, makeConcrete, makePuddles, makeGlow, FACADE_W, FACADE_H, SHOP_W, SHOP_H, NEON } from './textures';

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export const colliders: Rect[] = [];
const grid = new Map<string, Rect[]>();
const GK = (x: number, y: number) => `${Math.floor(x / 50)},${Math.floor(y / 50)}`;
function addCollider(r: Rect) {
  colliders.push(r);
  for (let x = Math.floor(r.x0 / 50); x <= Math.floor(r.x1 / 50); x++) for (let y = Math.floor(r.y0 / 50); y <= Math.floor(r.y1 / 50); y++) {
    const k = `${x},${y}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(r);
  }
}
export function inCollider(x: number, y: number, pad = 0.3) {
  for (const c of grid.get(GK(x, y)) ?? []) if (x > c.x0 - pad && x < c.x1 + pad && y > c.y0 - pad && y < c.y1 + pad) return true;
  return false;
}
export function collide(x: number, y: number, r = 0.45): { x: number; y: number } {
  for (const c of grid.get(GK(x, y)) ?? []) {
    if (x + r > c.x0 && x - r < c.x1 && y + r > c.y0 && y - r < c.y1) {
      const dx = Math.min(x + r - c.x0, c.x1 - (x - r)), dy = Math.min(y + r - c.y0, c.y1 - (y - r));
      if (dx < dy) x += x < (c.x0 + c.x1) / 2 ? -dx : dx; else y += y < (c.y0 + c.y1) / 2 ? -dy : dy;
    }
  }
  // map boundary: beyond it the Window is unstable
  x = Math.max(-140, Math.min(3690, x)); y = Math.max(-1540, Math.min(1790, y));
  if (x > 2492 && x < 2708 && !(y > 583 && y < 617) && !(x > 2625 && x < 2695 && y > 535 && y < 585) && !(x > 2525 && x < 2595 && y > 615 && y < 672)) x = x < 2600 ? 2492 : 2708;
  return { x, y };
}

/** Quad-based geometry builder, bucketed by material and 400 m chunk for culling. */
class Builder {
  b = new Map<string, { p: number[]; n: number[]; u: number[]; c: number[] }>();
  get(mat: string, x: number, z: number) {
    const k = `${mat}|${Math.floor(x / 400)}|${Math.floor(z / 400)}`;
    let v = this.b.get(k); if (!v) { v = { p: [], n: [], u: [], c: [] }; this.b.set(k, v); } return v;
  }
  /** origin a, edge U (width), edge V (height) -> normal = U x V. uv rectangle (u0,v0)-(u1,v1) */
  quad(mat: string, a: number[], U: number[], V: number[], u0: number, v0: number, u1: number, v1: number, col = [1, 1, 1]) {
    const bk = this.get(mat, a[0], a[2]);
    const p1 = [a[0] + U[0], a[1] + U[1], a[2] + U[2]], p2 = [p1[0] + V[0], p1[1] + V[1], p1[2] + V[2]], p3 = [a[0] + V[0], a[1] + V[1], a[2] + V[2]];
    const nx = U[1] * V[2] - U[2] * V[1], ny = U[2] * V[0] - U[0] * V[2], nz = U[0] * V[1] - U[1] * V[0], l = Math.hypot(nx, ny, nz) || 1;
    const P = [a, p1, p2, a, p2, p3], UV = [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
    for (let i = 0; i < 6; i++) { bk.p.push(...P[i]); bk.n.push(nx / l, ny / l, nz / l); bk.u.push(...UV[i]); bk.c.push(...col); }
  }
  /** axis-aligned box (sim coords x,y -> three x,z); sides use mat, top uses top */
  box(mat: string, top: string | null, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, tile = 4, col = [1, 1, 1], bottom = false) {
    const w = x1 - x0, d = z1 - z0, h = y1 - y0;
    this.quad(mat, [x0, y0, z1], [w, 0, 0], [0, h, 0], x0 / tile, y0 / tile, x1 / tile, y1 / tile, col);
    this.quad(mat, [x1, y0, z0], [-w, 0, 0], [0, h, 0], -x1 / tile, y0 / tile, -x0 / tile, y1 / tile, col);
    this.quad(mat, [x1, y0, z1], [0, 0, -d], [0, h, 0], z1 / tile, y0 / tile, z0 / tile, y1 / tile, col);
    this.quad(mat, [x0, y0, z0], [0, 0, d], [0, h, 0], z0 / tile, y0 / tile, z1 / tile, y1 / tile, col);
    if (top) this.quad(top, [x0, y1, z1], [w, 0, 0], [0, 0, -d], x0 / tile, z1 / tile, x1 / tile, z0 / tile, col);
    if (bottom) this.quad(mat, [x0, y0, z0], [w, 0, 0], [0, 0, d], 0, 0, 1, 1, col);
  }
  build(mats: Record<string, THREE.Material>, group: THREE.Group) {
    for (const [k, v] of this.b) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(v.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(v.u, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(v.c, 3));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mats[k.split('|')[0]]); m.matrixAutoUpdate = false; group.add(m);
    }
  }
}

type District = 'river' | 'downtown' | 'industrial' | 'center' | 'north' | 'residential';
function district(x: number, y: number): District {
  if (x > 2470 && x < 2730) return 'river';
  if (Math.hypot(x - 3380, y - 1100) < 620 && x > 2730) return 'downtown';
  if ((x > 2730 && y < 560) || Math.hypot(x - 200, y - 200) < 330) return 'industrial';
  if (y < -350) return 'north';
  if (Math.hypot(x - 1200, y - 650) < 650) return 'center';
  return 'residential';
}

/** instanced helper: collects transforms then creates one InstancedMesh */
class Inst {
  m: THREE.Matrix4[] = []; c: THREE.Color[] = [];
  add(x: number, y: number, z: number, ry = 0, s: number | [number, number, number] = 1, col?: THREE.Color) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)); const sc = Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s);
    this.m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, sc)); if (col) this.c.push(col);
  }
  build(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D) {
    if (!this.m.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, this.m.length);
    this.m.forEach((mm, i) => im.setMatrixAt(i, mm));
    if (this.c.length === this.m.length) this.c.forEach((cc, i) => im.setColorAt(i, cc));
    im.computeBoundingSphere(); parent.add(im); return im;
  }
}

export interface CityHandles {
  group: THREE.Group; setPower: (on: boolean) => void; update: (t: number, px: number, py: number, now: number) => void;
  refreshText: () => void; tramLine: { x: number; y: number }[]; spots: { x: number; y: number; z: number; c: number }[];
}

export function buildCity(scene: THREE.Scene, locs: Loc[], quality: string): CityHandles {
  colliders.length = 0; grid.clear();
  const group = new THREE.Group(); scene.add(group);
  const L = (id: string) => locs.find(l => l.id === id)!;
  const B = new Builder();
  const facades = makeFacades(), shops = makeShops(), signs = makeSigns(), ads = makeAds();
  const roof = makeConcrete(true), side = makeConcrete(false), puddles = makePuddles();
  const mats: Record<string, THREE.Material> = {};
  facades.forEach((f, i) => {
    mats['f' + i] = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissive, emissive: 0xffffff, emissiveIntensity: 1.0, roughness: f.rough, metalness: f.metal, vertexColors: true, envMapIntensity: 0.9 });
  });
  mats.shop = new THREE.MeshStandardMaterial({ map: shops.map, emissiveMap: shops.emissive, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.2 });
  mats.roof = new THREE.MeshStandardMaterial({ map: roof, color: 0x8a8f9c, roughness: 0.9, vertexColors: true });
  mats.concrete = new THREE.MeshStandardMaterial({ map: side, color: 0x9aa0b0, roughness: 0.85, vertexColors: true });
  mats.metal = new THREE.MeshStandardMaterial({ color: 0x2a2f3c, roughness: 0.45, metalness: 0.8, vertexColors: true });
  mats.dark = new THREE.MeshStandardMaterial({ color: 0x14161e, roughness: 0.7, metalness: 0.3, vertexColors: true });
  mats.signs = new THREE.MeshBasicMaterial({ map: signs.map, side: THREE.DoubleSide, transparent: true, toneMapped: false });
  mats.ads = new THREE.MeshBasicMaterial({ map: ads.map, side: THREE.DoubleSide, toneMapped: false });
  mats.neon = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  mats.glass = new THREE.MeshStandardMaterial({ color: 0x1a3550, roughness: 0.05, metalness: 0.9, emissive: 0x0a2440, emissiveIntensity: 0.8, vertexColors: true, transparent: true, opacity: 0.85 });
  const neonCol = (i: number) => { const c = new THREE.Color(NEON[i % NEON.length]); return [c.r * 2.2, c.g * 2.2, c.b * 2.2]; };

  const spinners: THREE.Object3D[] = []; const powerStrips: THREE.MeshBasicMaterial[] = []; let edgeMat: THREE.MeshBasicMaterial | null = null;
  // ---------------- clearing zones ----------------
  const plaza: { x: number; y: number; r: number }[] = [];
  const PR: Record<string, number> = { market: 58, school: 30, kolco: 70, bar: 24, pawn: 10, clinic: 34, dispatch: 30, bridge: 0, booth: 0, substation: 62, crossing: 26, tower_front: 70, tower_hall: 0, tower_office: 0, garage: 30, tunnel: 50, residence: 70, taxi: 18, depot: 70, billboard: 0 };
  for (const l of locs) if (PR[l.id]) plaza.push({ x: l.x, y: l.y, r: PR[l.id] });
  for (const sh of Object.values(SHOPS)) plaza.push({ x: sh.x, y: sh.y, r: Math.max(sh.w, sh.d) * 0.7 });
  const PARK = { x: 700, y: 1000, r: 120 }, TOWERS = [{ x: 3350, y: 150 }, { x: 3520, y: 160 }];
  plaza.push(PARK); for (const c of TOWERS) plaza.push({ x: c.x, y: c.y, r: 60 });
  const tramStops = ['depot', 'market', 'bridge', 'tower_front'].map(L);
  const tramLine = tramStops.map(s => ({ x: s.x, y: s.y + 6 }));
  const nearTram = (x: number, y: number, pad: number) => {
    for (let i = 1; i < tramLine.length; i++) {
      const a = tramLine[i - 1], b = tramLine[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
      if (Math.hypot(a.x + dx * t - x, a.y + dy * t - y) < pad) return true;
    } return false;
  };
  const blocked = (x0: number, y0: number, x1: number, y1: number) => {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hr = Math.hypot(x1 - x0, y1 - y0) / 2;
    if (plaza.some(p => Math.hypot(p.x - cx, p.y - cy) < p.r + hr * 0.75)) return true;
    for (let k = 0; k <= 4; k++) for (let m = 0; m <= 4; m++) if (nearTram(x0 + (x1 - x0) * k / 4, y0 + (y1 - y0) * m / 4, 9)) return true;
    return false;
  };

  // ---------------- ground: blocks (sidewalk slabs), roads, intersections ----------------
  const slab = new Inst(), road = new Inst(), inter = new Inst(), park = new Inst();
  const parks = new Set<string>();
  for (let gx = BOUNDS.x0; gx < BOUNDS.x1; gx += CELL) for (let gy = BOUNDS.y0; gy < BOUNDS.y1; gy += CELL) {
    const cx = gx + CELL / 2, cy = gy + CELL / 2, d = district(cx, cy);
    if (d === 'river') continue;
    slab.add(cx, 0.08, cy, 0, [CELL - ROAD_HALF * 2, 0.16, CELL - ROAD_HALF * 2]);
    if ((d === 'residential' || d === 'center') && hrand(70, gx, gy) < 0.07) { parks.add(`${gx},${gy}`); park.add(cx, 0.17, cy, 0, [CELL - LOT_OFF * 2, 0.02, CELL - LOT_OFF * 2]); }
  }
  for (let gx = BOUNDS.x0; gx <= BOUNDS.x1; gx += CELL) for (let gy = BOUNDS.y0; gy <= BOUNDS.y1; gy += CELL) {
    const rv = (x: number) => x > 2480 && x < 2720;
    if (!rv(gx)) inter.add(gx, 0.015, gy, 0, [ROAD_HALF * 2, 1, ROAD_HALF * 2]);
    if (gy + CELL <= BOUNDS.y1 && !rv(gx)) road.add(gx, 0.02, gy + CELL / 2, Math.PI / 2, 1);   // vertical street (along y)
    if (gx + CELL <= BOUNDS.x1 && !(rv(gx + CELL / 2) && gy !== 600)) road.add(gx + CELL / 2, 0.02, gy, 0, 1); // horizontal street
  }
  const roadTex = makeRoad();
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughnessMap: puddles, roughness: 0.55, metalness: 0.25, color: 0xb0b4c0, envMapIntensity: 1.6 });
  const roadGeo = new THREE.PlaneGeometry(CELL - ROAD_HALF * 2, ROAD_HALF * 2).rotateX(-Math.PI / 2);
  road.build(roadGeo, roadMat, group);
  const interMat = new THREE.MeshStandardMaterial({ color: 0x1a1b21, roughnessMap: puddles, roughness: 0.5, metalness: 0.3, envMapIntensity: 1.6 });
  inter.build(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), interMat, group);
  const sideTex = makeConcrete(false); sideTex.repeat.set(20, 20);
  const slabMat = new THREE.MeshStandardMaterial({ map: sideTex, roughnessMap: puddles, roughness: 0.6, metalness: 0.15, color: 0x8a90a0, envMapIntensity: 1.2 });
  slab.build(new THREE.BoxGeometry(1, 1, 1), slabMat, group);
  park.build(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x0f2018, roughness: 0.95 }), group);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.9 }));
  under.position.set(1800, -0.05, 200); group.add(under);

  // ---------------- buildings ----------------
  const blades: { x: number; y: number; z: number; ry: number; h: number; cell: number }[] = [];
  const wallAds: { x: number; y: number; z: number; ry: number; w: number; h: number; cell: number }[] = [];
  const roofProps = { ac: new Inst(), tank: new Inst(), ant: new Inst(), red: new Inst() };
  const cables: number[] = [];
  const awn = new Inst();
  let shopShift = 0;
  const building = (x0: number, z0: number, x1: number, z1: number, h: number, style: number, opts: { shops?: boolean; crown?: number; setback?: boolean; seed: number; round?: boolean; edges?: number; escape?: boolean }) => {
    const s = opts.seed, tint = 0.75 + hrand(80, s) * 0.4, col = [tint, tint * (0.95 + hrand(81, s) * 0.1), tint * (0.95 + hrand(82, s) * 0.12)];
    const fmat = 'f' + style, uo = hrand(83, s) * 16, vo = Math.floor(hrand(84, s) * 12) / 16;
    const sh = opts.shops ? SHOP_H : 0;
    const face = (a: number[], U: number[], len: number, y0: number, y1: number, offU: number) => {
      if (sh > 0 && y0 === 0) {
        const so = (shopShift++ % 16) * 6;
        B.quad('shop', a, U, [0, sh, 0], (so + offU) / SHOP_W, 0, (so + offU + len) / SHOP_W, 1);
        if (hrand(85, s, offU) < 0.5) {
          const ux = U[0] / len, uz = U[2] / len, nx = uz, nz = -ux; // outward normal for our winding
          awn.add(a[0] + U[0] / 2 + nx * 1.2, sh - 0.2, a[2] + U[2] / 2 + nz * 1.2, Math.atan2(-uz, ux), [len * 0.9, 0.15, 2.4], new THREE.Color(NEON[Math.floor(hrand(86, s, offU) * NEON.length)]).multiplyScalar(0.5));
        }
        y0 = sh;
      }
      B.quad(fmat, [a[0], a[1] + y0, a[2]], U, [0, y1 - y0, 0], uo + offU / FACADE_W, vo + y0 / FACADE_H, uo + (offU + len) / FACADE_W, vo + y1 / FACADE_H, col);
    };
    const tier = (ax0: number, az0: number, ax1: number, az1: number, y0: number, y1: number) => {
      const w = ax1 - ax0, d = az1 - az0;
      face([ax0, 0, az1], [w, 0, 0], w, y0, y1, 0);
      face([ax1, 0, az0], [-w, 0, 0], w, y0, y1, w);
      face([ax1, 0, az1], [0, 0, -d], d, y0, y1, 2 * w);
      face([ax0, 0, az0], [0, 0, d], d, y0, y1, 2 * w + d);
      B.quad('roof', [ax0, y1, az1], [w, 0, 0], [0, 0, -d], ax0 / 8, az1 / 8, ax1 / 8, az0 / 8, [0.6, 0.6, 0.65]);
      // parapet
      B.box('dark', 'dark', ax0, az0, ax1, az0 + 0.4, y1, y1 + 1); B.box('dark', 'dark', ax0, az1 - 0.4, ax1, az1, y1, y1 + 1);
    };
    if (opts.round) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = Math.min(x1 - x0, z1 - z0) / 2, seg = 20;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        const xa = cx + Math.cos(a0) * r, za = cz + Math.sin(a0) * r, xb = cx + Math.cos(a1) * r, zb = cz + Math.sin(a1) * r, len = Math.hypot(xb - xa, zb - za);
        B.quad(fmat, [xb, 0, zb], [xa - xb, 0, za - zb], [0, h, 0], uo + i * len / FACADE_W, vo, uo + (i + 1) * len / FACADE_W, vo + h / FACADE_H, col);
        B.quad('roof', [cx, h, cz], [xb - cx, 0, zb - cz], [xa - xb, 0, za - zb], 0, 0, 1, 1, [0.6, 0.6, 0.65]);
        if (opts.crown !== undefined && i % 2 === 0) B.box('neon', null, xa - 0.4, za - 0.4, xa + 0.4, za + 0.4, h * 0.3, h, 4, neonCol(opts.crown));
      }
      roofProps.ant.add(cx, h + 10, cz, 0, [0.4, 20, 0.4]); roofProps.red.add(cx, h + 20.3, cz, 0, 0.5);
      addCollider({ x0, y0: z0, x1, y1: z1 }); return;
    }
    if (opts.edges !== undefined) { const c = neonCol(opts.edges); for (const [ex, ez] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) B.box('neon', null, ex - 0.25, ez - 0.25, ex + 0.25, ez + 0.25, sh + 1, h, 4, c); }
    if (opts.escape && h > 15) {
      const fx0 = x0 + (x1 - x0) * 0.3, fx1 = fx0 + 5, zf = z1;
      for (let y = 7.2; y < h - 3; y += 3.6) {
        B.box('metal', 'metal', fx0, zf, fx1, zf + 1.3, y, y + 0.12);
        B.box('metal', null, fx0, zf + 1.25, fx1, zf + 1.3, y + 0.12, y + 1.05);
        const flip = Math.round(y / 3.6) % 2 ? 1 : 0;
        B.quad('metal', [flip ? fx1 - 0.2 : fx0 + 0.2, y + 0.12, zf + 0.7], [flip ? -4.4 : 4.4, 3.48, 0], [0, 0, 0.5], 0, 0, 1, 1);
      }
    }
    if (opts.setback && h > 50) {
      const h1 = 14 + Math.floor(hrand(87, s) * 4) * 4;
      tier(x0, z0, x1, z1, 0, h1);
      const ins = 3 + hrand(88, s) * 5;
      const tx0 = x0 + ins, tz0 = z0 + ins, tx1 = x1 - ins, tz1 = z1 - ins;
      // the upper tier starts at h1: draw faces from h1 to h with uv continuing
      const w = tx1 - tx0, d = tz1 - tz0, fm = 'f' + (hrand(89, s) < 0.5 ? style : (style + 4) % 5);
      const q = (a: number[], U: number[], len: number, off: number) => B.quad(fm, [a[0], h1, a[2]], U, [0, h - h1, 0], uo + off / FACADE_W, vo + h1 / FACADE_H, uo + (off + len) / FACADE_W, vo + h / FACADE_H, col);
      q([tx0, 0, tz1], [w, 0, 0], w, 0); q([tx1, 0, tz0], [-w, 0, 0], w, w); q([tx1, 0, tz1], [0, 0, -d], d, 2 * w); q([tx0, 0, tz0], [0, 0, d], d, 2 * w + d);
      B.quad('roof', [tx0, h, tz1], [w, 0, 0], [0, 0, -d], 0, 0, w / 8, d / 8, [0.6, 0.6, 0.65]);
      if (opts.crown !== undefined) { const c = neonCol(opts.crown); B.box('neon', null, tx0 - 0.3, tz0 - 0.3, tx1 + 0.3, tz1 + 0.3, h - 1.2, h - 0.6, 4, c); }
      roofProps.ant.add((tx0 + tx1) / 2, h + 12, (tz0 + tz1) / 2, 0, [0.5, 24, 0.5]); roofProps.red.add((tx0 + tx1) / 2, h + 24.5, (tz0 + tz1) / 2, 0, 0.6);
    } else {
      tier(x0, z0, x1, z1, 0, h);
      if (opts.crown !== undefined) { const c = neonCol(opts.crown); B.box('neon', null, x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, h - 1.2, h - 0.7, 4, c); }
      const n = 1 + Math.floor(hrand(90, s) * 4);
      for (let i = 0; i < n; i++) roofProps.ac.add(x0 + 3 + hrand(91, s, i) * (x1 - x0 - 6), h + 0.9, z0 + 3 + hrand(92, s, i) * (z1 - z0 - 6), hrand(93, s, i) * 3, [2.4, 1.8, 1.6]);
      if (style === 1 || style === 2) if (hrand(94, s) < 0.4) roofProps.tank.add(x0 + 5, h + 2.5, z0 + 5, 0, [2.2, 4, 2.2]);
      if (h > 40 && hrand(95, s) < 0.35) { roofProps.ant.add(x1 - 3, h + 6, z1 - 3, 0, [0.3, 12, 0.3]); roofProps.red.add(x1 - 3, h + 12.3, z1 - 3, 0, 0.4); }
    }
    addCollider({ x0, y0: z0, x1, y1: z1 });
  };

  let seed = 0;
  for (let gx = BOUNDS.x0; gx < BOUNDS.x1; gx += CELL) for (let gy = BOUNDS.y0; gy < BOUNDS.y1; gy += CELL) {
    const cx = gx + CELL / 2, cy = gy + CELL / 2, d = district(cx, cy);
    if (d === 'river' || parks.has(`${gx},${gy}`)) continue;
    const bx0 = gx + LOT_OFF, by0 = gy + LOT_OFF, bx1 = gx + CELL - LOT_OFF, by1 = gy + CELL - LOT_OFF;
    const r = (k: number) => hrand(100 + k, gx, gy);
    const far = cx < -150 || cx > 3750 || cy < -1550 || cy > 1950;
    // lot split
    const split = d === 'downtown' ? (r(1) < 0.6 ? 1 : 2) : d === 'industrial' ? (r(1) < 0.5 ? 1 : 2) : d === 'north' ? 4 : r(1) < 0.2 ? 1 : r(1) < 0.55 ? 2 : 4;
    const lots: Rect[] = [];
    if (split === 1) lots.push({ x0: bx0, y0: by0, x1: bx1, y1: by1 });
    else if (split === 2) { if (r(2) < 0.5) { const m = bx0 + (bx1 - bx0) * (0.4 + r(3) * 0.2); lots.push({ x0: bx0, y0: by0, x1: m - 1, y1: by1 }, { x0: m + 1, y0: by0, x1: bx1, y1: by1 }); } else { const m = by0 + (by1 - by0) * (0.4 + r(3) * 0.2); lots.push({ x0: bx0, y0: by0, x1: bx1, y1: m - 1 }, { x0: bx0, y0: m + 1, x1: bx1, y1: by1 }); } }
    else { const mx = (bx0 + bx1) / 2, my = (by0 + by1) / 2; lots.push({ x0: bx0, y0: by0, x1: mx - 1, y1: my - 1 }, { x0: mx + 1, y0: by0, x1: bx1, y1: my - 1 }, { x0: bx0, y0: my + 1, x1: mx - 1, y1: by1 }, { x0: mx + 1, y0: my + 1, x1: bx1, y1: by1 }); }
    lots.forEach((lot, li) => {
      if (blocked(lot.x0, lot.y0, lot.x1, lot.y1)) return;
      const rr = (k: number) => hrand(200 + k, gx, gy, li);
      if (d === 'north' && rr(0) < 0.55) return;
      seed++;
      let h: number, style: number, shopsOn = false, setback = false, crown: number | undefined;
      if (d === 'downtown') { h = 70 + rr(1) * rr(2) * 230; style = rr(3) < 0.6 ? 0 : 4; shopsOn = true; setback = rr(4) < 0.7; crown = rr(5) < 0.6 ? Math.floor(rr(6) * 8) : undefined; }
      else if (d === 'center') { h = 18 + rr(1) * 55 + (rr(2) < 0.12 ? 60 : 0); style = rr(3) < 0.45 ? 1 : rr(3) < 0.8 ? 2 : 4; shopsOn = rr(4) < 0.9; setback = h > 55 && rr(5) < 0.5; crown = rr(6) < 0.2 ? Math.floor(rr(7) * 8) : undefined; }
      else if (d === 'industrial') { h = 8 + rr(1) * 16; style = 3; }
      else if (d === 'north') { h = 9 + rr(1) * 14; style = 1; }
      else { h = 30 + rr(1) * 70 + (rr(2) < 0.1 ? 50 : 0); style = rr(3) < 0.7 ? 2 : 1; shopsOn = rr(4) < 0.55; setback = h > 70 && rr(5) < 0.3; crown = rr(6) < 0.12 ? Math.floor(rr(7) * 8) : undefined; }
      if (far) { shopsOn = false; crown = undefined; }
      h = Math.round(h / 3.6) * 3.6;
      const inset = d === 'industrial' ? 3 : 0.5;
      const b = { x0: lot.x0 + inset, y0: lot.y0 + inset, x1: lot.x1 - inset, y1: lot.y1 - inset };
      const round = d === 'downtown' && split === 1 && rr(20) < 0.3 && !far;
      const edges = (d === 'downtown' || d === 'center') && rr(21) < 0.14 && !far ? Math.floor(rr(22) * 8) : undefined;
      const escape = (d === 'center' || d === 'residential') && rr(23) < 0.22 && !far;
      building(b.x0, b.y0, b.x1, b.y1, h, style, { shops: shopsOn && !round, setback, crown, seed: seed * 7 + gx, round, edges, escape });
      if (far) return;
      // blade signs on street-facing corners
      if ((d === 'center' || d === 'downtown' || d === 'residential') && rr(8) < (d === 'center' ? 0.85 : 0.45)) {
        const nS = 1 + Math.floor(rr(9) * (d === 'center' ? 3 : 2));
        for (let k = 0; k < nS; k++) {
          const sideK = Math.floor(hrand(300, seed, k) * 4), along = 0.15 + hrand(301, seed, k) * 0.7, sh2 = 5 + hrand(302, seed, k) * 8, y = SHOP_H + 2 + hrand(303, seed, k) * Math.min(18, h - sh2 - 6);
          if (y + sh2 > h - 1) continue;
          const cell = Math.floor(hrand(304, seed, k) * 16);
          if (sideK === 0) blades.push({ x: b.x0 + (b.x1 - b.x0) * along, z: b.y1 + 1.3, y: y + sh2 / 2, ry: Math.PI / 2, h: sh2, cell });
          if (sideK === 1) blades.push({ x: b.x0 + (b.x1 - b.x0) * along, z: b.y0 - 1.3, y: y + sh2 / 2, ry: Math.PI / 2, h: sh2, cell });
          if (sideK === 2) blades.push({ x: b.x1 + 1.3, z: b.y0 + (b.y1 - b.y0) * along, y: y + sh2 / 2, ry: 0, h: sh2, cell });
          if (sideK === 3) blades.push({ x: b.x0 - 1.3, z: b.y0 + (b.y1 - b.y0) * along, y: y + sh2 / 2, ry: 0, h: sh2, cell });
        }
      }
      // big wall ads
      if ((d === 'downtown' || d === 'center') && h > 30 && rr(10) < 0.35) {
        const w = Math.min(b.x1 - b.x0 - 4, 22), hh = w * 0.5, y = h * (0.45 + rr(11) * 0.35);
        const front = rr(12) < 0.5;
        wallAds.push({ x: (b.x0 + b.x1) / 2, z: front ? b.y1 + 0.4 : b.y0 - 0.4, y, ry: front ? 0 : Math.PI, w, h: hh, cell: Math.floor(rr(13) * 8) });
      }
      // overhead cables to the building across the street (center/residential)
      if ((d === 'center' || d === 'residential') && rr(14) < 0.5) {
        const x = b.x0 + (b.x1 - b.x0) * rr(15), y0 = 7 + rr(16) * 14, z0 = b.y1, z1 = b.y1 + LOT_OFF * 2 - 1, sag = 1.5 + rr(17) * 2;
        for (let k = 0; k < 8; k++) { const t0 = k / 8, t1 = (k + 1) / 8; cables.push(x, y0 - Math.sin(t0 * Math.PI) * sag, z0 + (z1 - z0) * t0, x, y0 - Math.sin(t1 * Math.PI) * sag, z0 + (z1 - z0) * t1); }
      }
    });
  }

  // ---------------- landmarks ----------------
  const LM = landmarks(B, L, neonCol, addCollider);
  group.add(LM.extra);
  B.build(mats, group);
  const box = new THREE.BoxGeometry(1, 1, 1);
  roofProps.ac.build(box, new THREE.MeshStandardMaterial({ color: 0x4a4f5a, roughness: 0.6, metalness: 0.5 }), group);
  roofProps.tank.build(new THREE.CylinderGeometry(1, 1, 1, 12), new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.8 }), group);
  roofProps.ant.build(box, new THREE.MeshStandardMaterial({ color: 0x30343e, metalness: 0.8, roughness: 0.4 }), group);
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false });
  roofProps.red.build(new THREE.SphereGeometry(1, 8, 6), redMat, group);
  const awnMat = new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.15 });
  awn.build(box, awnMat, group);

  // blade signs (atlas 8x4; vertical words in cells 0..15)
  const signGeo = (() => {
    const p: number[] = [], u: number[] = [];
    for (const b of blades) {
      const cx = b.cell % 8, cy = Math.floor(b.cell / 8), u0 = cx / 8, u1 = (cx + 1) / 8, v1 = 1 - cy / 4, v0 = 1 - (cy + 1) / 4;
      const w = 1.8, hh = b.h, dx = Math.cos(b.ry) * w / 2, dz = -Math.sin(b.ry) * w / 2;
      const A = [b.x - dx, b.y - hh / 2, b.z - dz], Bq = [b.x + dx, b.y - hh / 2, b.z + dz], C = [b.x + dx, b.y + hh / 2, b.z + dz], D = [b.x - dx, b.y + hh / 2, b.z - dz];
      p.push(...A, ...Bq, ...C, ...A, ...C, ...D); u.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); g.computeBoundingSphere(); return g;
  })();
  group.add(new THREE.Mesh(signGeo, mats.signs));
  const adGeo = (() => {
    const p: number[] = [], u: number[] = [];
    for (const a of wallAds) {
      const cx = a.cell % 2, cy = Math.floor(a.cell / 2), u0 = cx / 2, u1 = (cx + 1) / 2, v1 = 1 - cy / 4, v0 = 1 - (cy + 1) / 4;
      const s = a.ry === 0 ? 1 : -1, dx = s * a.w / 2;
      const A = [a.x - dx, a.y - a.h / 2, a.z], Bq = [a.x + dx, a.y - a.h / 2, a.z], C = [a.x + dx, a.y + a.h / 2, a.z], D = [a.x - dx, a.y + a.h / 2, a.z];
      p.push(...A, ...Bq, ...C, ...A, ...C, ...D); u.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); g.computeBoundingSphere(); return g;
  })();
  group.add(new THREE.Mesh(adGeo, mats.ads));
  const cableGeo = new THREE.BufferGeometry(); cableGeo.setAttribute('position', new THREE.Float32BufferAttribute(cables, 3));
  group.add(new THREE.LineSegments(cableGeo, new THREE.LineBasicMaterial({ color: 0x07080c })));

  // ---------------- street furniture ----------------
  const F = { pole: new Inst(), head: new Inst(), pool: new Inst(), bench: new Inst(), bin: new Inst(), bollard: new Inst(), vend: new Inst(), vendFace: new Inst(), trunk: new Inst(), crown: new Inst(), planter: new Inst(), tlPole: new Inst(), tlHead: new Inst(), hydrant: new Inst(), kiosk: new Inst(), table: new Inst(), chair: new Inst(), parasol: new Inst(), ppole: new Inst(), cart: new Inst(), cartTop: new Inst() };
  const signals: { x: number; y: number; z: number; ry: number; ns: boolean }[] = [];
  const ACT = { x0: -150, x1: 3750, y0: -1550, y1: 1950 };
  const onSide = (x: number, y: number) => !blocked(x - 1, y - 1, x + 1, y + 1) || plaza.some(p => Math.hypot(p.x - x, p.y - y) < p.r && Math.hypot(p.x - x, p.y - y) > p.r - 30);
  for (let gx = BOUNDS.x0; gx <= BOUNDS.x1; gx += CELL) for (let gy = BOUNDS.y0; gy <= BOUNDS.y1; gy += CELL) {
    if (gx < ACT.x0 || gx > ACT.x1 || gy < ACT.y0 || gy > ACT.y1) continue;
    if (gx > 2470 && gx < 2730) continue;
    const r = (k: number) => hrand(400 + k, gx, gy);
    // lamps along both streets leaving this intersection (east and south), both sides
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      if (dx && gx + CELL > BOUNDS.x1) continue; if (dy && gy + CELL > BOUNDS.y1) continue;
      if (dx && gx + 50 > 2470 && gx + 50 < 2730 && gy !== 600) continue;
      for (const sideS of [-1, 1]) for (const f of [0.3, 0.75]) {
        const x = gx + dx * CELL * f + dy * sideS * (ROAD_HALF + 0.9), y = gy + dy * CELL * f + dx * sideS * (ROAD_HALF + 0.9);
        const ry = dx ? (sideS > 0 ? Math.PI : 0) : (sideS > 0 ? Math.PI / 2 : -Math.PI / 2);
        if (f === 0.3 || hrand(410, gx, gy, sideS) < 0.6) {
          F.pole.add(x, 4.5, y, ry); F.head.add(x - dy * sideS * -1.4 * 0 + (dx ? 0 : -sideS * 1.6), 8.6, y + (dx ? -sideS * 1.6 : 0), ry);
          F.pool.add(x + (dx ? 0 : -sideS * 2.5), 0.19, y + (dx ? -sideS * 2.5 : 0), 0, 1);
        }
        // misc props on sidewalk
        const k = hrand(420, gx, gy, sideS, f);
        const px = gx + dx * CELL * (f + 0.12) + dy * sideS * (ROAD_HALF + 2.6), py = gy + dy * CELL * (f + 0.12) + dx * sideS * (ROAD_HALF + 2.6);
        if (!onSide(px, py)) continue;
        if (k < 0.18) F.bench.add(px, 0.62, py, dx ? 0 : Math.PI / 2);
        else if (k < 0.3) F.bin.add(px, 0.66, py);
        else if (k < 0.4) { F.vend.add(px, 1.18, py, ry); F.vendFace.add(px + (dx ? 0 : sideS * -0.45) * 0, 1.3, py, ry, 1, new THREE.Color(NEON[Math.floor(k * 80) % NEON.length])); }
        else if (k < 0.55) { F.planter.add(px, 0.5, py); F.trunk.add(px, 2, py); F.crown.add(px, 4.2, py, k * 10, 1.4 + k); }
        else if (k < 0.62) F.hydrant.add(px, 0.55, py);
        else if (k < 0.66) F.kiosk.add(px, 1.4, py, ry);
        else if (k < 0.74 && district(px, py) === 'center') { // cafe terrace: tables, chairs, neon parasols
          for (let q = 0; q < 2; q++) { const tx = px + (dx ? (q - 0.5) * 3 : 0), ty = py + (dy ? (q - 0.5) * 3 : 0);
            F.table.add(tx, 0.75, ty); F.chair.add(tx + 0.7, 0.45, ty, 0); F.chair.add(tx - 0.7, 0.45, ty, 0);
            F.parasol.add(tx, 2.4, ty, 0, 1, new THREE.Color(NEON[Math.floor(k * 97 + q) % NEON.length]).multiplyScalar(0.6)); F.ppole.add(tx, 1.2, ty); }
        } else if (k < 0.78) { F.cart.add(px, 0.8, py, ry); F.cartTop.add(px, 2.0, py, ry, 1, new THREE.Color(NEON[Math.floor(k * 131) % NEON.length]).multiplyScalar(0.8)); }
      }
    }
    // traffic lights at intersections (skip some for variety)
    if (r(1) < 0.75) {
      for (const [sx, sy, ns] of [[1, 1, true], [-1, -1, true], [1, -1, false], [-1, 1, false]] as [number, number, boolean][]) {
        const x = gx + sx * (ROAD_HALF + 1.2), y = gy + sy * (ROAD_HALF + 1.2);
        F.tlPole.add(x, 2.8, y);
        const ry = ns ? (sy > 0 ? 0 : Math.PI) : (sx > 0 ? -Math.PI / 2 : Math.PI / 2);
        F.tlHead.add(x, 4.8, y, ry);
        signals.push({ x, y: 4.8, z: y, ry, ns });
      }
    }
    // bollards near plazas
    if (r(2) < 0.15) for (let i = 0; i < 4; i++) F.bollard.add(gx + ROAD_HALF + 0.6, 0.5, gy - 6 + i * 4);
  }
  const lampPole = new THREE.CylinderGeometry(0.11, 0.15, 9, 4);
  const metal = new THREE.MeshStandardMaterial({ color: 0x252a35, roughness: 0.5, metalness: 0.8 });
  F.pole.build(lampPole, metal, group);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false });
  F.head.build(new THREE.BoxGeometry(0.7, 0.18, 1.8), headMat, group);
  const poolMat = new THREE.MeshBasicMaterial({ map: makeGlow('rgba(255,214,160,1)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.22, color: 0xffffff });
  F.pool.build(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), poolMat, group);
  F.bench.build(new THREE.BoxGeometry(2.2, 0.18, 0.6), new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.7 }), group);
  F.bin.build(new THREE.CylinderGeometry(0.35, 0.3, 1.0, 8), metal, group);
  F.vend.build(new THREE.BoxGeometry(1.0, 2.0, 0.8), new THREE.MeshStandardMaterial({ color: 0x1a1d28, roughness: 0.4, metalness: 0.6 }), group);
  const vendFaceMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  F.vendFace.build(new THREE.BoxGeometry(0.85, 1.4, 0.82), vendFaceMat, group);
  F.planter.build(new THREE.BoxGeometry(1.6, 0.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x30333c, roughness: 0.8 }), group);
  F.trunk.build(new THREE.CylinderGeometry(0.12, 0.18, 3.2, 5), new THREE.MeshStandardMaterial({ color: 0x2a2018 }), group);
  F.crown.build(new THREE.IcosahedronGeometry(1.4, 0), new THREE.MeshStandardMaterial({ color: 0x18402e, roughness: 0.9, flatShading: true, emissive: 0x05140c }), group);
  F.hydrant.build(new THREE.CylinderGeometry(0.2, 0.25, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.5 }), group);
  F.kiosk.build(new THREE.BoxGeometry(2.4, 2.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x1c2030, emissive: 0x35f2e6, emissiveIntensity: 0.12 }), group);
  F.table.build(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 10), new THREE.MeshStandardMaterial({ color: 0x3a3d48, metalness: 0.6, roughness: 0.3 }), group);
  F.chair.build(new THREE.BoxGeometry(0.45, 0.9, 0.45), new THREE.MeshStandardMaterial({ color: 0x24262e, roughness: 0.6 }), group);
  F.parasol.build(new THREE.ConeGeometry(1.4, 0.5, 8, 1, true), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.4 }), group);
  F.ppole.build(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4), metal, group);
  F.cart.build(new THREE.BoxGeometry(2.0, 1.1, 1.0), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.6 }), group);
  F.cartTop.build(new THREE.BoxGeometry(2.3, 0.12, 1.4), new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.5 }), group);
  F.tlPole.build(new THREE.CylinderGeometry(0.1, 0.12, 5.6, 4), metal, group);
  F.tlHead.build(new THREE.BoxGeometry(0.5, 1.4, 0.4), new THREE.MeshStandardMaterial({ color: 0x0a0b10, roughness: 0.6 }), group);
  // signal lights: 3 per head; colors updated by state
  const sig = new THREE.InstancedMesh(new THREE.CircleGeometry(0.15, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), signals.length * 3);
  const m4 = new THREE.Matrix4();
  signals.forEach((s, i) => {
    for (let k = 0; k < 3; k++) {
      const off = new THREE.Vector3(0, 0.42 - k * 0.42, 0.22).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.ry);
      m4.makeRotationY(s.ry).setPosition(s.x + off.x, s.y + off.y, s.z + off.z); sig.setMatrixAt(i * 3 + k, m4); sig.setColorAt(i * 3 + k, new THREE.Color(0x111111));
    }
  });
  group.add(sig);

  // ---------------- river, embankments, bridge ----------------
  const water = new THREE.Mesh(new THREE.PlaneGeometry(236, 9000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x03060c, roughness: 0.04, metalness: 1.0, envMapIntensity: 2.2, emissive: 0x020812 }));
  water.position.set(2600, -6, 200); group.add(water);
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.9 });
  for (const x of [2483, 2717]) { const w = new THREE.Mesh(new THREE.BoxGeometry(6, 6.2, 9000), bankMat); w.position.set(x, -3, 200); group.add(w); }
  // railings with small lights along embankments
  const rail = new Inst(), railLights = new Inst();
  for (let y = BOUNDS.y0; y < BOUNDS.y1; y += 4) for (const x of [2486, 2714]) { if (Math.abs(y - 600) < 18) continue; rail.add(x, 0.6, y, 0, [0.1, 1.2, 0.1]); if (y % 24 === 0) railLights.add(x, 1.25, y, 0, 0.12); }
  rail.build(box, metal, group); railLights.build(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, toneMapped: false }), group);
  const deckMat = new THREE.MeshStandardMaterial({ map: roadTex, roughnessMap: puddles, roughness: 0.5, metalness: 0.3, color: 0xa0a4b0, envMapIntensity: 1.5 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(240, 1.4, 30), [bankMat, bankMat, deckMat, bankMat, bankMat, bankMat]); deck.position.set(2600, -0.7, 600); group.add(deck);
  for (const [x0, z0, x1, z1] of [[2625, 535, 2695, 585], [2525, 615, 2595, 672]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 1.2, z1 - z0), bankMat); p.position.set((x0 + x1) / 2, -0.6, (z0 + z1) / 2); group.add(p); }
  for (const x of [2540, 2600, 2660]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 30), bankMat); pil.position.set(x, -4, 600); group.add(pil); }
  // cable-stay pylons with neon edges
  for (const x of [2545, 2655]) {
    for (const z of [585, 615]) {
      const py = new THREE.Mesh(new THREE.BoxGeometry(2, 46, 2), new THREE.MeshStandardMaterial({ color: 0x2a3040, metalness: 0.7, roughness: 0.3, emissive: 0x35f2e6, emissiveIntensity: 0.25 })); py.position.set(x, 23, z); group.add(py);
      const pts: number[] = [];
      for (let k = -6; k <= 6; k++) if (k) pts.push(x, 44 - Math.abs(k) * 1.2, z, x + k * 9, 1.2, z);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x5ff0ff, transparent: true, opacity: 0.55 })));
    }
  }
  const bridgeRail = new Inst();
  for (let x = 2482; x < 2720; x += 3) for (const z of [585.3, 614.7]) bridgeRail.add(x, 0.6, z, 0, [0.12, 1.2, 0.12]);
  bridgeRail.build(box, metal, group);
  const bp = new Inst(), bh = new Inst(), bpool = new Inst();
  for (let x = 2490; x <= 2710; x += 22) for (const z of [586.5, 613.5]) { bp.add(x, 4.5, z); bh.add(x, 8.6, z + (z < 600 ? 1.4 : -1.4)); bpool.add(x, 0.05, z + (z < 600 ? 3 : -3)); }
  for (const [x, z] of [[2640, 560], [2680, 545], [2545, 640], [2580, 660]]) { bp.add(x, 4.5, z); bh.add(x, 8.6, z); bpool.add(x, 0.05, z); }
  bp.build(lampPole, metal, group); bh.build(new THREE.BoxGeometry(0.7, 0.18, 1.8), headMat, group); bpool.build(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), poolMat, group);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(240, 0.1, 0.25), new THREE.MeshBasicMaterial({ color: 0x35f2e6, toneMapped: false }));
  for (const z of [585.4, 614.6]) { const s = strip.clone(); s.position.set(2600, 1.25, z); group.add(s); }

  // ---------------- big set pieces: elevated highway, central park with a pond, cooling towers, the unstable edge ----------------
  { const HY = 1300, H = 12;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(BOUNDS.x1 - BOUNDS.x0 + 400, 1.2, 24), [mats.concrete, mats.concrete, roadMat, mats.dark, mats.concrete, mats.concrete]);
    deck.position.set((BOUNDS.x0 + BOUNDS.x1) / 2, H, HY); group.add(deck);
    const pil = new Inst(), hl = new Inst();
    for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += 50) { pil.add(x, H / 2, HY, 0, [2.4, H, 6]); if (x % 100 === 0) for (const z of [-11.5, 11.5]) hl.add(x, H + 1.2, HY + z, 0, [0.3, 1.6, 0.3]); }
    pil.build(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x3a3e4a, roughness: 0.8 }), group);
    hl.build(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff8a3d, toneMapped: false }), group);
    for (const z of [-12, 12]) { const g = new THREE.Mesh(new THREE.BoxGeometry(BOUNDS.x1 - BOUNDS.x0 + 400, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: 0x35f2e6, toneMapped: false })); g.position.set((BOUNDS.x0 + BOUNDS.x1) / 2, H + 1, HY + z); group.add(g); powerStrips.push(g.material as THREE.MeshBasicMaterial); }
  }
  { const p = PARK;
    const grass = new THREE.Mesh(new THREE.CircleGeometry(p.r - 5, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x10261a, roughness: 0.95 })); grass.position.set(p.x, 0.2, p.y); group.add(grass);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(38, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x02060c, roughness: 0.03, metalness: 1, envMapIntensity: 2.4 })); pond.position.set(p.x + 10, 0.24, p.y - 5); group.add(pond);
    const tr = new Inst(), cr = new Inst(), bn = new Inst(), lp = new Inst(), lh = new Inst(), path = new Inst();
    for (let i = 0; i < 70; i++) { const a = hrand(900, i) * Math.PI * 2, r = 46 + hrand(901, i) * (p.r - 55), x = p.x + Math.cos(a) * r, z = p.y + Math.sin(a) * r; tr.add(x, 2.2, z, 0, [1, 1 + hrand(902, i) * 0.6, 1]); cr.add(x, 5 + hrand(903, i) * 2, z, a, 2 + hrand(904, i) * 1.6, new THREE.Color().setHSL(0.38 + hrand(905, i) * 0.12, 0.5, 0.12 + hrand(906, i) * 0.08)); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, x = p.x + Math.cos(a) * 44, z = p.y + Math.sin(a) * 44; path.add(x, 0.23, z, -a, [3.2, 0.04, 12]); if (i % 3 === 0) { bn.add(x + Math.cos(a) * 3, 0.6, z + Math.sin(a) * 3, -a + Math.PI / 2, [2.2, 0.18, 0.6]); lp.add(x - Math.cos(a) * 3, 2.2, z - Math.sin(a) * 3, 0, [0.12, 4.4, 0.12]); lh.add(x - Math.cos(a) * 3, 4.5, z - Math.sin(a) * 3, 0, 0.35, new THREE.Color(NEON[i % NEON.length]).multiplyScalar(2)); } }
    tr.build(new THREE.CylinderGeometry(0.18, 0.28, 4.4, 5), new THREE.MeshStandardMaterial({ color: 0x2a2018 }), group);
    cr.build(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true, emissive: 0x041a0c }), group);
    path.build(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.7 }), group);
    bn.build(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x4a3a30 }), group);
    lp.build(new THREE.BoxGeometry(1, 1, 1), metal, group);
    const lhm = new THREE.MeshBasicMaterial({ toneMapped: false }); lh.build(new THREE.SphereGeometry(1, 8, 6), lhm, group);
    // a hologram koi over the pond
    const koi = new THREE.Mesh(new THREE.TorusKnotGeometry(5, 0.6, 90, 8, 2, 3), new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    koi.position.set(p.x + 10, 9, p.y - 5); group.add(koi); spinners.push(koi);
  }
  for (const c of TOWERS) {
    const pts: THREE.Vector2[] = []; for (let i = 0; i <= 12; i++) { const y = i / 12; pts.push(new THREE.Vector2(26 - Math.sin(y * Math.PI * 0.85) * 9 + (y > 0.85 ? (y - 0.85) * 20 : 0), y * 90)); }
    const tw = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), new THREE.MeshStandardMaterial({ color: 0x6a6e78, roughness: 0.9, side: THREE.DoubleSide }));
    tw.position.set(c.x, 0, c.y); group.add(tw); addCollider({ x0: c.x - 25, y0: c.y - 25, x1: c.x + 25, y1: c.y + 25 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(19, 0.4, 6, 48), new THREE.MeshBasicMaterial({ color: 0xff3b5c, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.set(c.x, 88, c.y); group.add(ring);
  }
  { const W = new THREE.MeshBasicMaterial({ color: 0x35f2e6, transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const mk = (w: number, x: number, z: number, ry: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 60), W); m.position.set(x, 30, z); m.rotation.y = ry; group.add(m); };
    mk(3850, 1775, -1545, 0); mk(3850, 1775, 1795, 0); mk(3350, -145, 125, Math.PI / 2); mk(3350, 3695, 125, Math.PI / 2);
    edgeMat = W; }

  // ---------------- tram rails & catenary ----------------
  const sleepers = new Inst(), cat = new Inst(); const wires: number[] = [];
  for (let i = 1; i < tramLine.length; i++) {
    const a = tramLine[i - 1], b = tramLine[i], len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    for (let s = 0; s < len; s += 1.2) { const x = a.x + (b.x - a.x) * s / len, y = a.y + (b.y - a.y) * s / len; sleepers.add(x, 0.2, y, -ang + Math.PI / 2, [2.6, 0.08, 0.3]); }
    for (const off of [-0.72, 0.72]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.08), new THREE.MeshStandardMaterial({ color: 0x8a90a0, metalness: 1, roughness: 0.2 }));
      r.position.set((a.x + b.x) / 2 - Math.sin(ang) * off, 0.27, (a.y + b.y) / 2 + Math.cos(ang) * off); r.rotation.y = -ang; group.add(r);
    }
    for (let s = 0; s < len; s += 35) { const x = a.x + (b.x - a.x) * s / len - Math.sin(ang) * 3.2, y = a.y + (b.y - a.y) * s / len + Math.cos(ang) * 3.2; cat.add(x, 3.5, y, 0, [0.15, 7, 0.15]); }
    wires.push(a.x, 6.6, a.y, b.x, 6.6, b.y);
  }
  sleepers.build(box, new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.9 }), group);
  cat.build(box, metal, group);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x0c0e14 })));

  // ---------------- power / dynamic state ----------------
  const facadeMats = Object.keys(mats).filter(k => k[0] === 'f' && k.length === 2).map(k => mats[k] as THREE.MeshStandardMaterial);
  let powered = true; let blinkT = 0;
  const setPower = (on: boolean) => {
    if (on === powered) return; powered = on;
    for (const m of facadeMats) { m.emissiveIntensity = on ? 1.0 : 0.04; m.color.setScalar(on ? 1 : 0.3); }
    (mats.shop as THREE.MeshStandardMaterial).color.setScalar(on ? 1 : 0.12);
    (mats.shop as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.55 : 0.03;
    (mats.signs as THREE.MeshBasicMaterial).color.setScalar(on ? 1 : 0.06);
    (mats.ads as THREE.MeshBasicMaterial).color.setScalar(on ? 1 : 0.05);
    (mats.neon as THREE.MeshBasicMaterial).color.setScalar(on ? 1 : 0.08);
    headMat.color.setHex(on ? 0xffe2b0 : 0x111111); poolMat.opacity = on ? 0.22 : 0;
    vendFaceMat.color.setScalar(on ? 1 : 0.05); LM.setPower(on); for (const m of powerStrips) m.color.setScalar(on ? 1 : 0.05);
  };
  const update = (t: number, px: number, py: number, now: number) => {
    for (const sp of spinners) { sp.rotation.y = now * 0.4; sp.rotation.x = Math.sin(now * 0.3) * 0.3; }
    if (edgeMat) edgeMat.opacity = 0.08 + Math.abs(Math.sin(now * 3)) * 0.06 + (Math.random() < 0.02 ? 0.2 : 0);
    // traffic signal cycle: 60 s; NS green 0-26, yellow 26-30, red 30-60
    if (now - blinkT > 0.3) {
      blinkT = now; const ph = t % 60; const c = new THREE.Color();
      signals.forEach((s, i) => {
        if (Math.abs(s.x - px) > 400 || Math.abs(s.z - py) > 400) return;
        const p = s.ns ? ph : (ph + 30) % 60;
        const st = !powered ? -1 : p < 26 ? 2 : p < 30 ? 1 : 0;
        for (let k = 0; k < 3; k++) { const on = st === k || (!powered && k === 1 && Math.floor(now * 2) % 2 === 0 && false); sig.setColorAt(i * 3 + k, c.setHex(on ? [0xff2030, 0xffc020, 0x30ff70][k] : 0x101010)); }
      });
      if (sig.instanceColor) sig.instanceColor.needsUpdate = true;
    }
    LM.update(now);
  };
  const refreshText = () => { shops.redraw(); shops.map.needsUpdate = true; shops.emissive.needsUpdate = true; signs.redraw(); ads.redraw(); LM.refreshText(); };
  void quality; void side;
  const spots = blades.map(b => ({ x: b.x, y: b.z, z: b.y, c: new THREE.Color(NEON[b.cell % NEON.length]).getHex() }));
  for (const l of locs) { if (['tower_hall', 'tower_office', 'pawn'].includes(l.id)) continue; spots.push({ x: l.x, y: l.y, z: 7, c: new THREE.Color(NEON[l.id.length % NEON.length]).getHex() }); }
  { const m = L('market'); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; spots.push({ x: m.x + Math.cos(a) * 28, y: m.y + Math.sin(a) * 28, z: 6, c: new THREE.Color(NEON[k]).getHex() }); } }
  return { group, setPower, update, refreshText, tramLine, spots };
}

// =============================== landmarks ===============================
import { makeTextTexture } from './textures';
import shopsData from '../data/shops.json';
export const SHOPS = shopsData as unknown as Record<string, { loc: string; x: number; y: number; w: number; d: number; door: string; color: string; keeper: string | null; sell: [string, number][]; buy: Record<string, number> }>;
import { t as tr } from '../i18n';

function landmarks(B: Builder, L: (id: string) => Loc, neonCol: (i: number) => number[], addCol: (r: Rect) => void) {
  const texts: { m: ReturnType<typeof makeTextTexture>; key: string }[] = [];
  const dyn: THREE.Object3D[] = []; const powerMats: { m: THREE.MeshBasicMaterial; base: number }[] = [];
  const sign = (key: string, color: string, x: number, y: number, z: number, w: number, ry = 0, parent?: THREE.Object3D) => {
    const m = makeTextTexture(tr(key), color); texts.push({ m, key });
    const mat = new THREE.MeshBasicMaterial({ map: m.map, transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false });
    powerMats.push({ m: mat, base: 1 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat); mesh.position.set(x, y, z); mesh.rotation.y = ry; (parent ?? extra).add(mesh); return mesh;
  };
  const extra = new THREE.Group();
  const solid = (mat: string, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, col?: number[], collide = true) => { B.box(mat, mat === 'neon' ? null : 'roof', x0, z0, x1, z1, y0, y1, 4, col); if (collide && y0 < 2) addCol({ x0, y0: z0, x1, y1: z1 }); };
  const facadeBox = (x0: number, z0: number, x1: number, z1: number, h: number, style: number, crown?: number, y0 = 0) => {
    const w = x1 - x0, d = z1 - z0, fm = 'f' + style;
    const q = (a: number[], U: number[], len: number, off: number) => B.quad(fm, [a[0], y0, a[2]], U, [0, h - y0, 0], off / FACADE_W, y0 / FACADE_H, (off + len) / FACADE_W, h / FACADE_H);
    q([x0, 0, z1], [w, 0, 0], w, 0); q([x1, 0, z0], [-w, 0, 0], w, w); q([x1, 0, z1], [0, 0, -d], d, 2 * w); q([x0, 0, z0], [0, 0, d], d, 2 * w + d);
    B.quad('roof', [x0, h, z1], [w, 0, 0], [0, 0, -d], 0, 0, w / 8, d / 8, [0.6, 0.6, 0.65]);
    if (crown !== undefined) B.box('neon', null, x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, h - 1.4, h - 0.6, 4, neonCol(crown));
    if (y0 < 2) addCol({ x0, y0: z0, x1, y1: z1 }); else B.quad('dark', [x0, y0, z0], [w, 0, 0], [0, 0, d], 0, 0, 1, 1);
  };

  // Helion Tower: a 320 m spire with neon crown and glass lobby
  { const p = L('tower_front'); const x = p.x + 20, z = p.y + 58; // tower raised on columns over an open glass lobby (hall + office inside)
    facadeBox(x - 32, z - 30, x + 32, z + 30, 140, 0, 0, 16);
    facadeBox(x - 24, z - 22, x + 24, z + 22, 250, 4, 0, 140);
    facadeBox(x - 14, z - 13, x + 14, z + 13, 320, 0, 1, 250);
    B.box('metal', 'metal', x - 1, z - 1, x + 1, z + 1, 320, 370);
    for (const [cx2, cz2] of [[x - 30, z - 28], [x + 30, z - 28], [x - 30, z + 28], [x + 30, z + 28]]) solid('metal', cx2 - 1.5, cz2 - 1.5, cx2 + 1.5, cz2 + 1.5, 0, 16);
    B.box('glass', null, x - 28, z - 26, x + 28, z + 26, 0, 15.5);
    B.box('neon', null, x - 32.4, z - 30.4, x + 32.4, z - 30.1, 15.6, 16.2, 4, neonCol(0));
    const lobby = new THREE.PointLight(0x9fe8ff, 400, 60, 2); lobby.position.set(x, 10, z); extra.add(lobby);
    sign('loc.tower_front', '#35f2e6', x, 150, z - 30.5, 60, Math.PI);
    sign('loc.tower_hall', '#cfe8ff', x - 10, 12, z - 26.3, 14, Math.PI);
    // launch stage on the plaza
    solid('dark', x - 18, p.y + 22, x + 18, p.y + 32, 0, 1.2);
    for (const k of [-1, 1]) { const scr = new THREE.Mesh(new THREE.PlaneGeometry(12, 7), new THREE.MeshBasicMaterial({ color: 0x35f2e6, toneMapped: false })); scr.position.set(x + k * 22, 6, p.y + 30); powerMats.push({ m: scr.material as THREE.MeshBasicMaterial, base: 1 }); extra.add(scr); }
    for (let k = -3; k <= 3; k++) { B.box('metal', null, x + k * 9 - 0.15, p.y + 8 - 0.15, x + k * 9 + 0.15, p.y + 8 + 0.15, 0, 12); B.box('neon', null, x + k * 9 - 0.8, p.y + 7.9, x + k * 9 + 0.8, p.y + 8.1, 9, 12, 4, neonCol(k + 3)); }
  }
  // garage entrance
  { const p = L('garage'); facadeBox(p.x - 30, p.y + 6, p.x + 30, p.y + 40, 12, 3, 2); sign('loc.garage', '#ffe14a', p.x, 9, p.y + 5.6, 24, Math.PI);
    B.box('dark', null, p.x - 8, p.y + 2, p.x + 8, p.y + 6, 0, 5); B.box('neon', null, p.x - 8, p.y + 1.9, p.x + 8, p.y + 2.1, 4.8, 5.1, 4, neonCol(2)); }
  // clinic
  { const p = L('clinic'); facadeBox(p.x - 30, p.y - 60, p.x + 30, p.y - 14, 42, 4, 6); sign('loc.clinic', '#7dff9b', p.x, 30, p.y - 13.6, 30);
    B.box('neon', null, p.x - 1.5, p.y - 13.8, p.x + 1.5, p.y - 13.5, 34, 44, 4, neonCol(6)); B.box('neon', null, p.x - 5, p.y - 13.8, p.x + 5, p.y - 13.5, 37.5, 40.5, 4, neonCol(6));
    solid('concrete', p.x - 12, p.y - 14, p.x + 12, p.y - 6, 4.5, 5.2, undefined, false); }
  // bar Red Lift + pawn
  { const p = L('bar'); facadeBox(p.x - 22, p.y + 8, p.x + 18, p.y + 40, 22, 1, undefined, 6); sign('loc.bar', '#ff3b5c', p.x - 2, 7.6, p.y + 7.6, 16, Math.PI);
    B.box('neon', null, p.x - 8, p.y + 7.6, p.x - 7.6, p.y + 7.9, 0, 5, 4, neonCol(4)); B.box('neon', null, p.x + 3.6, p.y + 7.6, p.x + 4, p.y + 7.9, 0, 5, 4, neonCol(4));
    const q = L('pawn'); facadeBox(q.x - 3, q.y + 8, q.x + 14, q.y + 30, 16, 3, undefined, 6); sign('loc.pawn', '#9b6bff', q.x + 5.5, 7.4, q.y + 7.6, 12, Math.PI); }
  // dispatch Center-112 with antenna mast
  { const p = L('dispatch'); facadeBox(p.x - 22, p.y - 52, p.x + 22, p.y - 12, 28, 4, 5); sign('loc.dispatch', '#6aa0ff', p.x, 22, p.y - 11.6, 22);
    B.box('metal', 'metal', p.x - 0.6, p.y - 33, p.x + 0.6, p.y - 31, 28, 70); }
  // school
  { const p = L('school'); facadeBox(p.x - 26, p.y + 12, p.x + 26, p.y + 40, 16, 1); sign('loc.school', '#ffe14a', p.x, 13, p.y + 11.6, 16, Math.PI); }
  // Kolco hive: giant ring megablock
  { const p = L('kolco'); const cx = p.x, cz = p.y - 95, R1 = 58, R2 = 34, H = 150;
    const seg = 32;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      for (const [r, out] of [[R1, true], [R2, false]] as [number, boolean][]) {
        const x0 = cx + Math.cos(a0) * r, z0 = cz + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, z1 = cz + Math.sin(a1) * r;
        const U = out ? [x0 - x1, 0, z0 - z1] : [x1 - x0, 0, z1 - z0], A = out ? [x1, 0, z1] : [x0, 0, z0], len = Math.hypot(x1 - x0, z1 - z0);
        B.quad('f2', A, U, [0, H, 0], i * len / FACADE_W, 0, (i + 1) * len / FACADE_W, H / FACADE_H);
      }
      const p0 = [cx + Math.cos(a0) * R2, H, cz + Math.sin(a0) * R2], p1 = [cx + Math.cos(a0) * R1, H, cz + Math.sin(a0) * R1], p2 = [cx + Math.cos(a1) * R1, H, cz + Math.sin(a1) * R1];
      B.quad('roof', p0, [p1[0] - p0[0], 0, p1[2] - p0[2]], [p2[0] - p1[0], 0, p2[2] - p1[2]], 0, 0, 1, 1);
    }
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; B.box('neon', null, cx + Math.cos(a) * (R1 + 0.4) - 0.4, cz + Math.sin(a) * (R1 + 0.4) - 0.4, cx + Math.cos(a) * (R1 + 0.4) + 0.4, cz + Math.sin(a) * (R1 + 0.4) + 0.4, 4, H, 4, neonCol(3 + (i % 2))); }
    addCol({ x0: cx - R1, y0: cz - R1, x1: cx + R1, y1: cz + R1 });
    sign('loc.kolco', '#9b6bff', cx, 20, cz + R1 + 0.6, 40); }
  // substation: fenced yard with transformers, pylons
  { const p = L('substation'); facadeBox(p.x - 20, p.y - 48, p.x + 20, p.y - 22, 14, 3); sign('loc.substation', '#ffe14a', p.x, 11, p.y - 21.6, 22);
    for (let i = 0; i < 6; i++) { const x = p.x - 34 + i * 13; solid('metal', x - 3, p.y + 18, x + 3, p.y + 24, 0, 5); B.box('neon', null, x - 3.1, p.y + 17.9, x + 3.1, p.y + 18.1, 4.4, 4.7, 4, neonCol(2)); }
    for (const x of [p.x - 45, p.x + 45]) { B.box('metal', null, x - 0.5, p.y + 30 - 0.5, x + 0.5, p.y + 30 + 0.5, 0, 30); B.box('metal', null, x - 6, p.y + 29.6, x + 6, p.y + 30.4, 26, 27); }
    for (const [x0, z0, x1, z1] of [[p.x - 55, p.y + 40, p.x + 55, p.y + 40.3], [p.x - 55, p.y - 20, p.x - 54.7, p.y + 40], [p.x + 54.7, p.y - 20, p.x + 55, p.y + 40]]) { B.box('metal', null, x0, z0, x1, z1, 0, 3); addCol({ x0, y0: z0, x1, y1: z1 }); }
    const pc = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 0.8), new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false })); pc.position.set(p.x, 2, p.y - 21.5); extra.add(pc); powerMats.push({ m: pc.material as THREE.MeshBasicMaterial, base: 1 }); }
  // tram depot: long shed with arched lights
  { const p = L('depot'); facadeBox(p.x - 60, p.y - 60, p.x + 60, p.y - 18, 16, 3, 5); sign('loc.depot', '#6aa0ff', p.x, 12, p.y - 17.6, 26); }
  // tunnel portal
  { const p = L('tunnel'); solid('concrete', p.x - 40, p.y + 20, p.x + 40, p.y + 60, 0, 22); B.box('dark', null, p.x - 12, p.y + 19, p.x + 12, p.y + 20, 0, 9);
    for (let i = 0; i < 6; i++) B.box('neon', null, p.x - 11 + i * 4.4, p.y + 18.8, p.x - 10 + i * 4.4, p.y + 19, 8.5, 8.8, 4, neonCol(0));
    sign('loc.tunnel', '#35f2e6', p.x, 14, p.y + 18.6, 26, Math.PI); }
  // residence: walled villa
  { const p = L('residence'); facadeBox(p.x - 25, p.y - 70, p.x + 25, p.y - 30, 18, 4, 1);
    for (const [x0, z0, x1, z1] of [[p.x - 60, p.y - 80, p.x + 60, p.y - 79], [p.x - 60, p.y - 80, p.x - 59, p.y - 10], [p.x + 59, p.y - 80, p.x + 60, p.y - 10], [p.x - 60, p.y - 11, p.x - 12, p.y - 10], [p.x + 12, p.y - 11, p.x + 60, p.y - 10]]) solid('concrete', x0, z0, x1, z1, 0, 4);
    sign('loc.residence', '#ff4fd8', p.x, 7, p.y - 9.4, 18); }
  // market: canopy over the square, stalls with lanterns
  { const p = L('market'); const counter = new Inst(), shelf = new Inst(), awnI = new Inst(), lantern = new Inst(), goods = new Inst(), post = new Inst();
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + hrand(5, i) * 0.2, r = 22 + hrand(6, i) * 18, x = p.x + Math.cos(a) * r, z = p.y + Math.sin(a) * r;
      const ry = -a + Math.PI / 2, fx = Math.cos(a), fz = Math.sin(a); // stall faces the centre
      counter.add(x - fx * 0.2, 0.55, z - fz * 0.2, ry, [3.2, 1.1, 1.0], new THREE.Color().setHSL(hrand(7, i), 0.25, 0.22));
      shelf.add(x + fx * 0.9, 1.3, z + fz * 0.9, ry, [3.2, 2.6, 0.35]);
      for (const sx of [-1.5, 1.5]) for (const sz of [-0.6, 1.0]) post.add(x + Math.cos(ry) * sx + fx * sz * 0.0 + (-fx) * (sz < 0 ? 0.9 : -0.9), 1.4, z - Math.sin(ry) * sx + (-fz) * (sz < 0 ? 0.9 : -0.9), 0, [0.08, 2.8, 0.08]);
      awnI.add(x, 2.85, z, ry, [3.8, 0.12, 2.8], new THREE.Color(NEON[i % NEON.length]).multiplyScalar(0.7));
      for (let k = 0; k < 6; k++) goods.add(x - fx * 0.2 + Math.cos(ry) * (-1.3 + k * 0.52), 1.18, z - fz * 0.2 - Math.sin(ry) * (-1.3 + k * 0.52), k, [0.3, 0.16 + hrand(8, i, k) * 0.2, 0.3], new THREE.Color().setHSL(hrand(9, i, k), 0.7, 0.5));
      for (const sx of [-1.4, 0, 1.4]) lantern.add(x + Math.cos(ry) * sx - fx * 1.3, 2.55, z - Math.sin(ry) * sx - fz * 1.3, 0, 0.16, new THREE.Color(NEON[(i + 2) % NEON.length]).multiplyScalar(1.6));
      addCol({ x0: x - 1.6, y0: z - 1.6, x1: x + 1.6, y1: z + 1.6 });
    }
    counter.build(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), extra);
    shelf.build(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x1c1f2c, roughness: 0.7, emissive: 0x30203a, emissiveIntensity: 0.6 }), extra);
    post.build(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x30343e, metalness: 0.8, roughness: 0.4 }), extra);
    goods.build(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.08 }), extra);
    awnI.build(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.35, transparent: true, opacity: 0.9 }), extra);
    const lm = new THREE.MeshBasicMaterial({ toneMapped: false }); lantern.build(new THREE.SphereGeometry(1, 8, 6), lm, extra); powerMats.push({ m: lm, base: 1 });
    // canopy frame
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; B.box('metal', null, p.x + Math.cos(a) * 46 - 0.3, p.y + Math.sin(a) * 46 - 0.3, p.x + Math.cos(a) * 46 + 0.3, p.y + Math.sin(a) * 46 + 0.3, 0, 12); }
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(52, 52, 0.4, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.25, side: THREE.DoubleSide, toneMapped: false })); canopy.position.set(p.x, 12, p.y); extra.add(canopy);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(46, 0.25, 6, 48), new THREE.MeshBasicMaterial({ color: 0x35f2e6, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.set(p.x, 12, p.y); extra.add(ring);
    powerMats.push({ m: ring.material as THREE.MeshBasicMaterial, base: 1 });
    // string lights
    const pts: number[] = [];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, b = ((k + 3) / 8) * Math.PI * 2; for (let s = 0; s <= 20; s++) { const tt = s / 20, x = p.x + Math.cos(a) * 46 * (1 - tt) + Math.cos(b) * 46 * tt, z = p.y + Math.sin(a) * 46 * (1 - tt) + Math.sin(b) * 46 * tt; pts.push(x, 11 - Math.sin(tt * Math.PI) * 3, z); } }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const sm = new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.5, toneMapped: false }); extra.add(new THREE.Points(sg, sm));
    sign('loc.market', '#ffe14a', p.x, 15, p.y - 47, 30); }
  // taxi stand
  { const p = L('taxi'); B.box('metal', null, p.x - 0.2, p.y - 0.2, p.x + 0.2, p.y + 0.2, 0, 4); sign('loc.taxi', '#ffe14a', p.x, 4.6, p.y, 6); }
  // camera booth on the bridge + billboard frame at pillar 3
  { const p = L('booth'); solid('dark', p.x - 3, p.y - 4, p.x + 3, p.y + 2, 0, 3.2);
    B.box('glass', null, p.x - 3.05, p.y + 1.9, p.x + 3.05, p.y + 2.1, 1.2, 2.8);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), new THREE.MeshBasicMaterial({ color: 0x6aa0ff, toneMapped: false })); scr.position.set(p.x, 2, p.y + 2.2); extra.add(scr); powerMats.push({ m: scr.material as THREE.MeshBasicMaterial, base: 1 });
    const q = L('billboard'); B.box('metal', null, q.x - 0.4, q.y - 0.4, q.x + 0.4, q.y + 0.4, 0, 9); B.box('metal', null, q.x - 8, q.y - 0.3, q.x + 8, q.y + 0.3, 9, 9.4);
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide }));
    const tx = makeTextTexture(tr('ads.helion'), '#35f2e6', 1024, 256); texts.push({ m: tx, key: 'ads.helion' }); (ad.material as THREE.MeshBasicMaterial).map = tx.map; ad.position.set(q.x, 13, q.y); ad.rotation.y = Math.PI; extra.add(ad);
    powerMats.push({ m: ad.material as THREE.MeshBasicMaterial, base: 1 }); }

  // ---- seamless walk-in interiors (shops / bar / pawn) ----
  const goodsI = new Inst(), shelfI = new Inst();
  for (const [id, sh] of Object.entries(SHOPS)) {
    const x0 = sh.x - sh.w / 2, x1 = sh.x + sh.w / 2, z0 = sh.y - sh.d / 2, z1 = sh.y + sh.d / 2, H = 5.6, T = 0.35, gap = 3.2;
    const col = new THREE.Color(sh.color), nc = [col.r * 2.2, col.g * 2.2, col.b * 2.2];
    const wall = (ax0: number, az0: number, ax1: number, az1: number) => { B.box('concrete', 'dark', ax0, az0, ax1, az1, 0, H, 4, [0.55, 0.55, 0.62]); addCol({ x0: ax0, y0: az0, x1: ax1, y1: az1 }); };
    const side = (d: string, a0: number, a1: number, fixed: number, vertical: boolean) => {
      const m = (a0 + a1) / 2;
      const seg = (b0: number, b1: number) => vertical ? wall(fixed - T / 2, b0, fixed + T / 2, b1) : wall(b0, fixed - T / 2, b1, fixed + T / 2);
      if (sh.door === d) { seg(a0, m - gap / 2); seg(m + gap / 2, a1); B.box('concrete', null, vertical ? fixed - T / 2 : m - gap / 2, vertical ? m - gap / 2 : fixed - T / 2, vertical ? fixed + T / 2 : m + gap / 2, vertical ? m + gap / 2 : fixed + T / 2, 3.4, H, 4, [0.5, 0.5, 0.55]);
        B.box('neon', null, vertical ? fixed - T : m - gap / 2, vertical ? m - gap / 2 : fixed - T, vertical ? fixed + T : m + gap / 2, vertical ? m + gap / 2 : fixed + T, 3.3, 3.45, 4, nc); }
      else seg(a0, a1);
    };
    side('n', x0, x1, z0, false); side('s', x0, x1, z1, false); side('w', z0, z1, x0, true); side('e', z0, z1, x1, true);
    B.quad('dark', [x0, H, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], 0, 0, 1, 1); // ceiling (faces down)
    B.box('roof', 'roof', x0 - 0.2, z0 - 0.2, x1 + 0.2, z1 + 0.2, H, H + 0.4, 4, [0.5, 0.5, 0.55]);
    B.quad('glass', [x0 + 0.2, 0.2, z1 - 0.2], [x1 - x0 - 0.4, 0, 0], [0, 0, -(z1 - z0 - 0.4)], 0, 0, 1, 1, [0.3, 0.25, 0.35]); // glossy floor
    // ceiling light strips + wall neon
    for (let k = 1; k < 4; k++) { const zz = z0 + (z1 - z0) * k / 4; B.box('neon', null, x0 + 1.5, zz - 0.15, x1 - 1.5, zz + 0.15, H - 0.12, H - 0.02, 4, [1.6, 1.5, 1.4]); }
    B.box('neon', null, x0 + T, z0 + T, x0 + T + 0.08, z1 - T, 2.4, 2.55, 4, nc); B.box('neon', null, x1 - T - 0.08, z0 + T, x1 - T, z1 - T, 2.4, 2.55, 4, nc);
    // counter facing the door + shelves along the back wall
    const back = { n: z1, s: z0, w: x1, e: x0 }[sh.door] ?? z1;
    if (sh.door === 'n' || sh.door === 's') {
      const cz = sh.door === 'n' ? z1 - 4 : z0 + 4, bz = sh.door === 'n' ? z1 - 0.8 : z0 + 0.8;
      B.box('metal', 'metal', sh.x - sh.w * 0.3, cz - 0.5, sh.x + sh.w * 0.3, cz + 0.5, 0, 1.1); addCol({ x0: sh.x - sh.w * 0.3, y0: cz - 0.5, x1: sh.x + sh.w * 0.3, y1: cz + 0.5 });
      B.box('neon', null, sh.x - sh.w * 0.3, cz - 0.52, sh.x + sh.w * 0.3, cz + 0.52, 1.1, 1.16, 4, nc);
      for (let k = 0; k < 3; k++) { shelfI.add(sh.x, 0.9 + k * 1.2, bz, 0, [sh.w - 2, 0.08, 0.6]); for (let g2 = 0; g2 < 10; g2++) goodsI.add(sh.x - sh.w / 2 + 1.5 + g2 * (sh.w - 3) / 10, 1.1 + k * 1.2, bz, g2, [0.35, 0.3 + hrand(1, id, k, g2) * 0.25, 0.3], new THREE.Color(NEON[(g2 + k) % NEON.length])); }
    } else {
      const cx = sh.door === 'w' ? x1 - 4 : x0 + 4, bx = sh.door === 'w' ? x1 - 0.8 : x0 + 0.8;
      B.box('metal', 'metal', cx - 0.5, sh.y - sh.d * 0.3, cx + 0.5, sh.y + sh.d * 0.3, 0, 1.1); addCol({ x0: cx - 0.5, y0: sh.y - sh.d * 0.3, x1: cx + 0.5, y1: sh.y + sh.d * 0.3 });
      B.box('neon', null, cx - 0.52, sh.y - sh.d * 0.3, cx + 0.52, sh.y + sh.d * 0.3, 1.1, 1.16, 4, nc);
      for (let k = 0; k < 3; k++) { shelfI.add(bx, 0.9 + k * 1.2, sh.y, Math.PI / 2, [sh.d - 2, 0.08, 0.6]); for (let g2 = 0; g2 < 8; g2++) goodsI.add(bx, 1.1 + k * 1.2, sh.y - sh.d / 2 + 1.5 + g2 * (sh.d - 3) / 8, g2, [0.3, 0.3 + hrand(2, id, k, g2) * 0.3, 0.35], new THREE.Color(NEON[(g2 + k + 3) % NEON.length])); }
    }
    void back;
    const sx = sh.door === 'w' ? x0 - 0.5 : sh.door === 'e' ? x1 + 0.5 : sh.x, sz = sh.door === 'n' ? z0 - 0.5 : sh.door === 's' ? z1 + 0.5 : sh.y;
    const ry = sh.door === 'n' ? Math.PI : sh.door === 's' ? 0 : sh.door === 'w' ? -Math.PI / 2 : Math.PI / 2;
    sign('ui.shop.' + id, sh.color, sx, H + 1.4, sz, Math.min(14, Math.max(sh.w, sh.d)), ry);
  }
  shelfI.build(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2a2d38, metalness: 0.6, roughness: 0.4 }), extra);
  goodsI.build(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.45 }), extra);

  return {
    setPower: (on: boolean) => { for (const p of powerMats) p.m.color.setScalar(on ? p.base : 0.06); },
    update: (now: number) => { void now; },
    refreshText: () => { for (const x of texts) x.m.set(tr(x.key)); },
    extra, dyn,
    attach: (g: THREE.Group) => g.add(extra),
  };
}
