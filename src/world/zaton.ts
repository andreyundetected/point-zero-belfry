import * as THREE from 'three';
import { M } from '../render/materials';
import { Batcher, mtx } from './batch';
import { buildCanal, buildPiers, buildWater, BRIDGE } from './canal';
import { blocks, initCity, placed, put, row } from './city';
import { world } from './colliders';
import { buildGround } from './ground';
import { lamp } from './lamps';
import { BOUNDS, QUAY_Z, ROADS } from './layout';
import { PropField } from './props';
import { groundH, hash } from './terrain';

const RAD = Math.PI;
export interface Zaton { props: PropField; ready: Promise<void>; }

export function buildZaton(scene: THREE.Scene): Zaton {
  const bt = new Batcher(); initCity(scene, bt);
  buildCanal(scene, bt); buildPiers(scene, bt);

  // ---------- named places (spec 4.2 / 5.3). Front centre, facing direction -> ry
  put('tower', { x: -70, z: -54, ry: 0, w: 8, floors: 9, wall: M.stone, lit: 0.1, roof: 'flat', seed: 901, depth: 8, door: 0.5 });
  put('orven', { x: -46, z: -33.3, ry: RAD, w: 5, floors: 2, wall: M.brickD, lit: 0.0, shop: true, sign: 'КЛЮЧИ И ЗАМКИ', seed: 902, depth: 4, door: 0.5 });
  put('D4', { x: -46, z: -36.7, ry: 0, w: 5, floors: 2, wall: M.plaster3, lit: 0, seed: 903, depth: 6 });
  put('foma', { x: -40, z: -14.4, ry: 0, w: 6.5, floors: 2, wall: M.brickD, lit: 0.1, shop: true, sign: 'ЗАЛОГИ · ФОМА', seed: 904, depth: 6, door: 0.5 });
  put('D8', { x: -33.2, z: -14.4, ry: 0, w: 6.5, floors: 2, wall: M.plaster2, lit: 0.3, seed: 905, depth: 6 });
  put('post', { x: -22, z: -14.4, ry: 0, w: 8, floors: 2, wall: M.plaster, lit: 0.3, shop: true, sign: 'ПОЧТА · ТЕЛЕГРАФ', seed: 906, depth: 7, door: 0.5 });
  put('tavern', { x: 19.9, z: 9, ry: -RAD / 2, w: 12, floors: 2, wall: M.brick, lit: 0.6, shop: false, sign: '«ЯКОРЬ»', seed: 907, depth: 9, door: 0.5 });
  put('contora', { x: 44, z: 23.2, ry: RAD, w: 10, floors: 2, wall: M.plaster2, lit: 0.3, sign: 'КУРЬЕРСКАЯ КОНТОРА', shop: true, seed: 908, depth: 8, door: 0.3 });
  put('warehouse', { x: 66, z: 23.2, ry: RAD, w: 32, floors: 3, wall: M.brickD, lit: 0.05, roof: 'flat', sign: 'СКЛАД №2 ХАРРОУ И К°', seed: 909, depth: 20, door: 0.5 });
  put('priyut', { x: 50, z: -66, ry: 0, w: 24, floors: 3, wall: M.plaster, lit: 0.12, sign: 'ПРИЮТ СВ. ЛУКИИ', seed: 910, depth: 9, door: 0.5 });
  put('chapel', { x: 43, z: -60, ry: RAD / 2, w: 8, floors: 2, wall: M.stone, lit: 0.0, seed: 911, depth: 5, door: 0.5 });
  put('tikhon', { x: -38, z: 40.1, ry: RAD, w: 6, floors: 1, wall: M.plaster3, lit: 0.9, seed: 912, depth: 6, door: 0.5 });

  // ---------- rows of closed houses (D1..D20 and the second line)
  row({ id: 'rynok:s', a: [-88, -8], b: [-14, -8], side: 1, seed: 1, fmin: 2, fmax: 3, shopP: 0.35, signs: { 3: 'ПЕКАРНЯ', 6: 'АПТЕКА' } });
  row({ id: 'rynok:n', a: [-88, -8], b: [-14, -8], side: -1, seed: 2, fmin: 2, fmax: 3, shopP: 0.3, signs: {} });
  row({ id: 'bashn:w', a: [-68, -30], b: [-68, -8], side: 1, seed: 3, fmin: 2, fmax: 3, wmin: 5, wmax: 7 });
  row({ id: 'bashn:e', a: [-68, -30], b: [-68, -8], side: -1, seed: 4, fmin: 2, fmax: 3, wmin: 5, wmax: 7 });
  row({ id: 'tower_sq:n', a: [-83, -52.6], b: [-53, -52.6], side: 1, off: 0.6, seed: 5, fmin: 3, fmax: 3, wmin: 7, wmax: 9 }); // D1-D3 (+ tower fills its lot)
  row({ id: 'tower_sq:w', a: [-83.6, -52], b: [-83.6, -30], side: 1, off: 0.2, seed: 6, fmin: 2, fmax: 3, wmin: 6, wmax: 8 });
  row({ id: 'klyuch:1', a: [-53, -38], b: [-46, -35], side: 1, off: 2.6, seed: 7, fmin: 2, fmax: 2, wmin: 4, wmax: 5 });
  row({ id: 'klyuch:2', a: [-38, -33], b: [-30, -30], side: 1, off: 2.6, seed: 8, fmin: 2, fmax: 3, wmin: 4, wmax: 6 });
  row({ id: 'klyuch:3', a: [-38, -33], b: [-30, -30], side: -1, off: 2.6, seed: 9, fmin: 2, fmax: 3, wmin: 4, wmax: 6 });
  row({ id: 'klyuch:4', a: [-30, -30], b: [-16, -28], side: 1, off: 2.6, seed: 10, fmin: 2, fmax: 3, wmin: 4, wmax: 6 });
  row({ id: 'klyuch:5', a: [-30, -30], b: [-16, -28], side: -1, off: 2.6, seed: 11, fmin: 2, fmax: 3, wmin: 4, wmax: 6 });
  row({ id: 'bereg:w', a: [-14, -80], b: [-14, 54], side: 1, seed: 12, fmin: 2, fmax: 3 });
  row({ id: 'kanat:n', a: [-62, 36], b: [-16, 36], side: -1, seed: 13, fmin: 1, fmax: 2, wmin: 5, wmax: 7, depth: 7 });
  row({ id: 'kanat:s', a: [-62, 36], b: [-16, 36], side: 1, seed: 14, fmin: 1, fmax: 2, wmin: 5, wmax: 7, depth: 6, skip: [[19, 29]] });
  row({ id: 'lodoch:w', a: [-45, 38], b: [-45, 50], side: 1, off: 2.2, seed: 15, fmin: 1, fmax: 2, wmin: 4, wmax: 5, depth: 5 });
  row({ id: 'lodoch:e', a: [-45, 38], b: [-45, 50], side: -1, off: 2.2, seed: 16, fmin: 1, fmax: 2, wmin: 4, wmax: 5, depth: 5 });
  row({ id: 'gavan:n', a: [-62, 51], b: [-16, 51], side: -1, seed: 17, fmin: 1, fmax: 2, wmin: 5, wmax: 8, depth: 6 });
  row({ id: 'nab:e', a: [14, -78], b: [14, 50], side: -1, seed: 18, fmin: 2, fmax: 3, skip: [[84, 99], [-60, -48]] });
  row({ id: 'sklad:n', a: [16, 18], b: [86, 18], side: -1, seed: 19, fmin: 1, fmax: 2, wmin: 7, wmax: 10, skip: [[0, 26]] });
  row({ id: 'sklad:s', a: [16, 18], b: [32, 18], side: 1, seed: 20, fmin: 1, fmax: 2, wmin: 6, wmax: 8 });
  row({ id: 'priyut:a', a: [20, -5], b: [38, -44], side: 1, seed: 21, fmin: 2, fmax: 2, wmin: 6, wmax: 8 });
  row({ id: 'priyut:b', a: [20, -5], b: [38, -44], side: -1, seed: 22, fmin: 2, fmax: 2, wmin: 6, wmax: 8 });
  row({ id: 'gavanE:n', a: [16, 51], b: [80, 51], side: -1, seed: 23, fmin: 1, fmax: 2, wmin: 6, wmax: 9, depth: 6 });
  row({ id: 'eastS:w', a: [62, 20], b: [62, 50], side: 1, seed: 24, fmin: 1, fmax: 2, wmin: 6, wmax: 8, depth: 6 });
  row({ id: 'eastS:e', a: [62, 20], b: [62, 50], side: -1, seed: 25, fmin: 1, fmax: 2, wmin: 6, wmax: 8, depth: 6 });
  row({ id: 'eastN:w', a: [62, 16], b: [62, -20], side: -1, seed: 26, fmin: 2, fmax: 3, wmin: 6, wmax: 8 });
  row({ id: 'eastN:e', a: [62, 16], b: [62, -20], side: 1, seed: 27, fmin: 2, fmax: 3, wmin: 6, wmax: 8 });
  row({ id: 'westS:w', a: [-90, -6], b: [-90, 34], side: -1, seed: 28, fmin: 2, fmax: 3, wmin: 6, wmax: 8 });
  row({ id: 'westS:e', a: [-90, -6], b: [-90, 34], side: 1, seed: 29, fmin: 2, fmax: 3, wmin: 6, wmax: 8 });
  // second line + skyline beyond the map edge (low-detail silhouettes in the fog)
  blocks(-104, 104, -100, 56, 10, 3);

  // ---------- compound fences and walls
  const fence = (ax: number, az: number, bx: number, bz: number, h = 1.7) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 1.4)), ry = -Math.atan2(bz - az, bx - ax);
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n, y = groundH(x, z); bt.box(M.iron, 0.06, h, 0.06, mtx(x, y + h / 2, z, 0), 1); }
    const cx = (ax + bx) / 2, cz = (az + bz) / 2, y = groundH(cx, cz);
    for (const hh of [h - 0.15, 0.5]) bt.box(M.iron, len, 0.05, 0.05, mtx(cx, y + hh, cz, ry), 1);
    bt.box(M.stone, len, 0.5, 0.3, mtx(cx, y + 0.25, cz, ry), 1.2);
    world.add(cx, cz, len / 2, 0.15, ry, y - 0.5, y + h, 'rail');
  };
  fence(36, -50, 47, -50); fence(53, -50, 64, -50); fence(36, -76, 36, -50); fence(64, -76, 64, -50);
  fence(29, 3, 40, 3, 1.6); fence(29, 15, 40, 15, 1.6); fence(40, 3, 40, 3.1); // tavern yard (gate to the alley at x=40)

  // ---------- lamps: 18-22 m apart, alternating sides, every junction and doorway
  const lampLine = (id: string, start = 0, step = 20) => {
    const r = ROADS.find(q => q.id === id)!; let acc = start, side = 1, k = 0;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
      for (let t = acc; t < len; t += step + (hash(k, 3) - 0.5) * 3, k++) {
        const off = r.w / 2 + 0.5, x = ax + dx * t - dz * off * side, z = az + dz * t + dx * off * side; side = -side;
        if (z > QUAY_Z - 1 || (Math.abs(x) < 7 && Math.abs(z) < 4)) continue; lamp(scene, x, z);
      }
      acc = Math.max(0, acc - len);
    }
  };
  for (const id of ['bereg', 'rynok', 'nab', 'sklad', 'priyut', 'kanat', 'gavan', 'gavanE', 'bashn']) lampLine(id, 6, 20);
  for (const [x, z] of [[-76, -45], [-60, -45], [-76, -35], [-60, -35], [-14.6, 36], [-20, 2], [-46, -31.6], [20.5, 15], [19.5, 3]] as [number, number][]) lamp(scene, x, z);

  // ---------- props (instanced, with colliders)
  const props = new PropField();
  const cluster = (path: string, cx: number, cz: number, n: number, spread: number, opts: { h?: number; l?: number; collide?: boolean }, seed = 1) => {
    for (let i = 0; i < n; i++) { const a = hash(seed, i) * 6.28, r = hash(i, seed) * spread; props.add(path, cx + Math.cos(a) * r, cz + Math.sin(a) * r, { ry: hash(i, i) * 6, ...opts }); }
  };
  // tavern: two barrel-bins at the door, firewood and crates in the yard
  props.add('dungeon/barrel_small', 19.3, 6.5, { h: 0.9, collide: true }); props.add('dungeon/barrel_small', 19.3, 11.5, { h: 0.9, collide: true });
  cluster('dungeon/box_small', 35, 12, 4, 1.5, { h: 0.7, collide: true }, 2); cluster('dungeon/barrel_small', 38, 5, 3, 1, { h: 0.9, collide: true }, 3);
  // warehouse and pier crates in groups of 3-6
  cluster('dungeon/box_small', 58, 21, 5, 2, { h: 0.9, collide: true }, 4); cluster('dungeon/barrel_small', 74, 21, 4, 1.5, { h: 0.9, collide: true }, 5);
  cluster('dungeon/box_small', 42, 36, 5, 2.5, { h: 0.9, collide: true }, 6); cluster('dungeon/crates_stacked', 46, 38, 1, 0, { h: 1.9, collide: true }, 7);
  cluster('dungeon/barrel_small', -5, 55, 4, 1.5, { h: 0.9, collide: true }, 8); cluster('dungeon/box_small', -12, 54, 4, 1.8, { h: 0.9, collide: true }, 9);
  cluster('dungeon/barrel_small', -40, 54, 3, 1.2, { h: 0.9, collide: true }, 10);
  // Rynok: market carts, benches only where people wait
  props.add('village_q/bench_1', -50, -3.2, { ry: 0, h: 0.9, collide: true });
  props.add('village_q/bench_1', -68, -45, { ry: -RAD / 2, h: 0.9, collide: true }); props.add('village_q/bench_1', -68, -35, { ry: RAD / 2, h: 0.9, collide: true });
  props.add('village_q/bench_1', 11.5, -20, { ry: -RAD / 2, h: 0.9, collide: true }); props.add('village_q/bench_1', 11.5, 22, { ry: -RAD / 2, h: 0.9, collide: true });
  props.add('village_q/cart', -58, -3, { ry: 0.3, l: 3.2, collide: true }); props.add('village_q/cart', -30, -2.6, { ry: -0.2, l: 3.2, collide: true });
  // pebbles, along walls and gutters rather than mid-street
  for (let i = 0; i < 160; i++) {
    const x = (hash(i, 31) - 0.5) * 180, z = -84 + hash(i, 32) * 136, rd = hash(i, 33);
    props.add('village_q/rock_' + (1 + (i % 3)), x, z, { ry: hash(i, 34) * 6, s: 0.06 + hash(i, 35) * 0.1 });
    void rd;
  }
  bt.flush(scene);
  buildGround(scene); buildWater(scene);
  const ready = props.build(scene);
  void BOUNDS; void BRIDGE; void placed;
  return { props, ready };
}
