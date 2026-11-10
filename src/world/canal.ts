import * as THREE from 'three';
import { M } from '../render/materials';
import { Batcher, mtx } from './batch';
import { BARGE, BED_Y, BRIDGE, bridgeTop, CANAL, DECK_Y, PIER3, PIER7, PierSpec, QUAY_Z, WATER_Y } from './layout';
import { world } from './colliders';
import { groundH } from './terrain';
import { lamp } from './lamps';

const RAIL_H = 1.1;    // visible parapet height
const RAIL_COL = 1.45; // collider is taller: jump peak 0.86 + step 0.42 must not clear it

function wallRun(bt: Batcher, ax: number, az: number, bx: number, bz: number, topFn: (x: number, z: number) => number, thick = 1.2, rail = true) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 4)), rot = Math.atan2(bx - ax, bz - az) + Math.PI / 2; // local x along the run
  const ry = Math.atan2(bz - az, bx - ax);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, cx = ax + (bx - ax) * t, cz = az + (bz - az) * t, top = topFn(cx, cz), l = len / n + 0.04;
    const h = top - BED_Y;
    bt.box(M.stone, l, h, thick, mtx(cx, BED_Y + h / 2, cz, -ry), 1.6);
    if (rail) {
      bt.box(M.cornice, l, 0.16, thick + 0.3, mtx(cx, top + 0.04, cz, -ry), 1.2);
      world.add(cx, cz, l / 2, 0.22, -ry, top - 0.2, top + RAIL_COL, 'rail');
    }
  }
  void rot;
}

export function buildCanal(scene: THREE.Scene, bt: Batcher) {
  const topAt = (xs: number) => (x: number, z: number) => groundH(xs, z) - 0.04;
  const gaps = (z0: number, z1: number, gz: [number, number][]): [number, number][] => { // split [z0,z1] around stair gaps
    const out: [number, number][] = []; let c = z0;
    for (const [a, b] of gz.sort((p, q) => p[0] - q[0])) { if (a > c) out.push([c, a]); c = Math.max(c, b); }
    if (c < z1) out.push([c, z1]); return out;
  };
  // stairs down to the water on both banks, either side of the bridge (z=+6.. and z=-12..)
  const STAIRS: { side: number; z: number; dir: number }[] = [{ side: -1, z: 6, dir: 1 }, { side: 1, z: -6, dir: -1 }, { side: 1, z: 6, dir: 1 }, { side: -1, z: -6, dir: -1 }];
  for (const s of STAIRS) {
    const x = s.side * 5.3;
    for (let k = 0; k < 10; k++) {
      const top = groundH(s.side * 6.8, s.z) - 0.04 - 0.3 * k, cz = s.z + s.dir * (0.25 + 0.5 * k);
      bt.box(M.stone, 1.5, top - BED_Y, 0.52, mtx(x, BED_Y + (top - BED_Y) / 2, cz, 0), 1.2);
      world.add(x, cz, 0.75, 0.26, 0, BED_Y, top, 'stair');
    }
  }
  const stairGaps = (side: number) => STAIRS.filter(s => s.side === side).map(s => (s.dir > 0 ? [s.z - 0.6, s.z + 5.6] : [s.z - 5.6, s.z + 0.6]) as [number, number]);
  for (const side of [-1, 1]) {
    for (const [a, b] of gaps(CANAL.z0, QUAY_Z, stairGaps(side))) {
      const xs = side * (CANAL.x1 + 0.6);
      // the bridge crosses here: no parapet on the bridge approach itself
      for (const [c0, c1, r] of [[a, Math.min(b, -3.6), true], [Math.max(a, -3.6), Math.min(b, 3.6), false], [Math.max(a, 3.6), b, true]] as [number, number, boolean][])
        if (c1 - c0 > 0.1) wallRun(bt, xs, c0, xs, c1, topAt(xs), 1.2, r);
    }
    // stair gaps still get plain walls on the water side below the stair so you can't walk into the water except via stairs
  }
  // north end of the canal: closed by a wall with the (closed) footbridge fence
  bt.box(M.stone, 12.4, 6, 1.2, mtx(0, BED_Y + 3, CANAL.z0 - 0.6), 1.6);
  world.add(0, CANAL.z0 - 0.6, 6.2, 0.6, 0, BED_Y, 3, 'solid');
  // closed footbridge z=-84: boards across the entrance and a sign
  for (const side of [-1, 1]) {
    const x = side * 8.3, z = -82.5;
    for (let k = 0; k < 6; k++) bt.box(M.wood, 0.12, 0.28, 3.6, mtx(x + side * k * 0.0, groundH(x, z) + 0.4 + k * 0.25, z - 0.5 + (k % 2) * 0.2, 0), 1);
    world.add(x, z, 0.2, 2.0, 0, groundH(x, z), groundH(x, z) + 1.9, 'solid');
  }
  // harbour quay wall (with the canal mouth open)
  for (const [a, b] of [[-106, -6], [6, 106]] as [number, number][]) {
    const topY = (x: number) => groundH(x, QUAY_Z - 1) - 0.04;
    const n = Math.round((b - a) / 4);
    for (let i = 0; i < n; i++) {
      const cx = a + (i + 0.5) * (b - a) / n, l = (b - a) / n + 0.04, top = topY(cx), h = top - BED_Y;
      bt.box(M.stone, l, h, 1.2, mtx(cx, BED_Y + h / 2, QUAY_Z + 0.6, 0), 1.6);
      bt.box(M.cornice, l, 0.16, 1.5, mtx(cx, top + 0.04, QUAY_Z + 0.6, 0), 1.2);
      const gapHere = (cx > -48 && cx < -36) || (cx > -14 && cx < -6) ; // piers 3 and 7 are open
      if (!gapHere) world.add(cx, QUAY_Z + 0.3, l / 2, 0.22, 0, top - 0.2, top + RAIL_COL, 'rail');
    }
  }
  // iron posts + chain along the quay edge (decor over the collider)
  for (let x = -104; x < 104; x += 3) {
    if (x > -48 && x < -36) continue; if (x > -14 && x < 14) continue;
    const top = groundH(x, QUAY_Z - 0.4);
    bt.box(M.iron, 0.12, 0.9, 0.12, mtx(x, top + 0.45, QUAY_Z + 0.35, 0), 1);
    bt.box(M.iron, 3, 0.03, 0.03, mtx(x + 1.5, top + 0.75, QUAY_Z + 0.35, 0), 1);
  }
  // ---- Old Bridge: arched deck in 0.75 m slabs, parapets with cornice, 3 lamps
  const seg = 0.75, nseg = Math.round(18 / seg);
  for (let i = 0; i < nseg; i++) {
    const x = BRIDGE.x0 + (i + 0.5) * seg, top = bridgeTop(x), th = 1.0;
    bt.box(M.stone, seg + 0.02, th, 6, mtx(x, top - th / 2, 0, 0), 1.6);
    bt.box(M.setts, seg + 0.02, 0.04, 5, mtx(x, top + 0.0, 0, 0), 3.2);
    world.add(x, 0, seg / 2 + 0.01, 3, 0, top - th, top, 'deck');
    for (const sz of [-1, 1]) {
      const pz = sz * 2.75, h = RAIL_H;
      bt.box(M.stone, seg + 0.02, h, 0.5, mtx(x, top + h / 2, pz, 0), 1.2);
      bt.box(M.cornice, seg + 0.04, 0.12, 0.64, mtx(x, top + h + 0.04, pz, 0), 1.2);
      world.add(x, pz, seg / 2 + 0.01, 0.25, 0, top, top + RAIL_COL, 'rail');
    }
    // arch soffit under the deck, so the underside is stone and not hollow
    const arch = th + 1.3 * (1 - Math.abs(x / 9) ** 2.2);
    bt.box(M.stone, seg + 0.02, arch, 5.6, mtx(x, top - th - arch / 2 + 0.02, 0, 0), 1.6);
  }
  // D4: repairs on the north half of the bridge (sawhorses, planks, barrels): the walkway in the middle is 3 m wide and Ned stands on it
  for (let x = -4.2; x <= 4.2; x += 1.4) { const top = bridgeTop(x); bt.box(M.wood, 0.1, 0.9, 1.8, mtx(x, top + 0.45, -1.6, 0), 1); }
  { const top = bridgeTop(0); bt.box(M.wood, 8.8, 0.08, 0.3, mtx(0, top + 0.95, -0.85, 0), 1); bt.box(M.wood, 8.8, 0.08, 0.3, mtx(0, top + 0.55, -0.85, 0), 1);
    for (let i = 0; i < 5; i++) bt.box(M.wood, 3.2, 0.06, 0.25, mtx(-2.5 + i * 1.2, top + 0.2 + i * 0.06, -1.9 + (i % 2) * 0.3, 0.2 * (i - 2)), 1);
    for (const x of [-3.8, -1.6, 2.4]) world.add(x, -1.6, 0.75, 0.95, 0, bridgeTop(x), bridgeTop(x) + 1.5, 'rail'); }
  for (const x of [-8.3, 0, 8.3]) for (const sz of [-1, 1]) lamp(scene, x, sz * 2.75, bridgeTop(x) + RAIL_H);
}

/** harbour + canal water */
export function buildWater(scene: THREE.Scene) {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x03060a, roughness: 0.06, clearcoat: 1, envMapIntensity: 2 });
  const w = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), mat); w.rotation.x = -Math.PI / 2; w.position.set(0, WATER_Y, 0); scene.add(w);
}

export function buildPiers(scene: THREE.Scene, bt: Batcher) {
  for (const p of [PIER3, PIER7]) {
    const len = p.z1 - p.z0, cz = (p.z0 + p.z1) / 2;
    bt.box(M.wood, p.w, 0.25, len, mtx(p.x, DECK_Y - 0.125, cz, 0), 1.4);
    world.add(p.x, cz, p.w / 2, len / 2, 0, BED_Y, DECK_Y, 'deck');
    for (let z = p.z0 + 1; z < p.z1; z += 3) for (const s of [-1, 1]) {
      bt.box(M.wood, 0.3, DECK_Y - BED_Y, 0.3, mtx(p.x + s * (p.w / 2 - 0.2), BED_Y + (DECK_Y - BED_Y) / 2, z, 0), 1);
      if (Math.floor(z) % 2 === 0) { bt.box(M.iron, 0.22, 0.4, 0.22, mtx(p.x + s * (p.w / 2 - 0.2), DECK_Y + 0.2, z, 0), 1); world.add(p.x + s * (p.w / 2 - 0.2), z, 0.13, 0.13, 0, DECK_Y, DECK_Y + 0.4, 'solid'); }
    }
    // end buffer
    bt.box(M.wood, p.w + 0.2, 0.5, 0.3, mtx(p.x, DECK_Y + 0.25, p.z1, 0), 1);
    world.add(p.x, p.z1, p.w / 2, 0.15, 0, DECK_Y, DECK_Y + RAIL_COL, 'rail');
  }
  // Barge "Vera" moored on the east side of pier 7: flat deck 16x5, cabin, hatch, rusty hull
  const bx = BARGE.x, bz = BARGE.z, top = BARGE.top;
  bt.box(M.dark, 5, top - (WATER_Y - 0.9), 16, mtx(bx, (top + WATER_Y - 0.9) / 2, bz, 0), 1.4);
  bt.box(M.wood, 4.8, 0.08, 15.8, mtx(bx, top + 0.04, bz, 0), 1.4);
  world.add(bx, bz, 2.5, 8, 0, WATER_Y - 0.9, top, 'deck');
  bt.box(M.brickD, 3, 2.3, 3.4, mtx(bx, top + 1.2, bz + 5.4, 0), 1.8); world.add(bx, bz + 5.4, 1.5, 1.7, 0, top, top + 2.4, 'solid');
  bt.box(M.dark, 1.4, 0.35, 1.8, mtx(bx, top + 0.2, bz - 3, 0), 1); world.add(bx, bz - 3, 0.7, 0.9, 0, top, top + 0.38, 'solid');
  bt.box(M.dark, 4.9, 0.9, 0.2, mtx(bx, top + 0.45, bz - 7.9, 0), 1);
  // gangplank + hatch light positions are used later by the barge scene
}
