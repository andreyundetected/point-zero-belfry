import * as THREE from 'three';
import { M } from '../render/materials';
import { Batcher, mtx } from './batch';
import { world } from './colliders';
import { PropField } from './props';
import { floorY, SITES, loc } from '../sim/sites';
import { groundH, hash } from './terrain';
import { putGroup } from './city';
import { addInteract, makeDoor, roomLights } from './interiors';

// Foma's pawnshop and its neighbour D8: intact shells (22:00-22:39) and charred ruins (22:40+) that you can walk through (spec 6.4).
export const groups: Record<string, THREE.Object3D> = {};
export const FOMA_SPOT = () => loc('foma', 2.2, -6.8);
const charM = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 1 }), ashM = new THREE.MeshStandardMaterial({ color: 0x0e0d0c, roughness: 1 });

function ruin(scene: THREE.Scene, tag: string, cx: number, zFront: number, w: number, d: number, floorYv: number, seed: number, partition = false) {
  const g = new THREE.Group(); const bt = new Batcher(); const i0 = world.boxes.length;
  const seg = (x0: number, z0: number, x1: number, z1: number, hMax: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.1));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, h = 0.6 + hash(seed + i, tag.length) * hMax, l = len / n + 0.04, ang = Math.atan2(z1 - z0, x1 - x0);
      bt.box(i % 2 ? M.brickD : charM, l, h, 0.45, mtx(x, floorYv + h / 2 - 0.1, z, -ang), 1.8); world.add(x, z, l / 2, 0.22, -ang, floorYv - 0.1, floorYv + h - 0.1, 'building'); }
  };
  const x0 = cx - w / 2, x1 = cx + w / 2, zb = zFront - d;
  seg(x0, zFront, cx - 0.9, zFront, 1.4); seg(cx + 0.9, zFront, x1, zFront, 1.4);       // front wall, door gap in the middle
  seg(x0, zFront, x0, zb, 2.4); seg(x1, zFront, x1, zb, 2.4); seg(x0, zb, x1, zb, 1.6);   // side + back walls
  if (partition) { seg(x0, zFront - d * 0.62, cx + 0.8, zFront - d * 0.62, 0.9); }
  bt.box(ashM, w - 0.4, 0.3, d - 0.4, mtx(cx, floorYv - 0.2, zFront - d / 2, 0), 1.4); world.add(cx, zFront - d / 2, w / 2 - 0.2, d / 2 - 0.2, 0, floorYv - 0.8, floorYv - 0.05, 'building');
  for (let i = 0; i < 14; i++) { const x = x0 + 0.5 + hash(seed, i) * (w - 1), z = zFront - 0.5 - hash(i, seed) * (d - 1); bt.box(charM, 0.3 + hash(i, 2) * 0.9, 0.08, 0.1, mtx(x, floorYv + 0.05, z, hash(i, 9) * 3), 1); } // fallen beams
  bt.flush(g); scene.add(g); world.tagFrom(i0, tag); g.visible = false; groups[tag] = g;
}

export function buildFomaAndD8(scene: THREE.Scene) {
  const S = SITES.foma;
  // ---- intact Foma (shell + interior) in its own group so it can be swapped for the ruin
  const gi = new THREE.Group(); scene.add(gi); const bF = new Batcher(); const i0 = world.boxes.length;
  const P = putGroup('foma', { x: S.x, z: S.z, ry: 0, w: S.w, floors: 2, wall: M.brickD, lit: 0.1, shop: true, sign: 'ЗАЛОГИ · ФОМА', seed: 904, depth: S.d, door: 0.5, hollow: true, floorMat: M.wood }, bF);
  const f = (id: string, ...a: any[]) => id; void f;
  const fy = floorY('foma'), L = (lx: number, lz: number) => loc('foma', lx, lz);
  const box = (mat: THREE.Material, w: number, h: number, d: number, lx: number, lz: number, ly = 0, col = true) => { const p = L(lx, lz); bF.box(mat, w, h, d, mtx(p.x, fy + ly + h / 2, p.z, 0), 1.2); if (col) world.add(p.x, p.z, w / 2, d / 2, 0, fy + ly, fy + ly + h, 'furn'); };
  box(M.wood, 5.2, 1.0, 0.5, -0.4, -2.6); for (let k = 0; k < 14; k++) box(M.iron, 0.03, 1.2, 0.03, -2.9 + k * 0.4, -2.6, 1.0, false); box(M.iron, 5.2, 0.03, 0.03, -0.4, -2.6, 2.1, false);  // counter with the grille
  box(M.plaster, 3.9, 3.0, 0.25, -1.1, -5.15); box(M.plaster, 1.1, 3.0, 0.25, 2.8, -5.15);                                                               // partition, doorway at lx 1.35..2.25
  for (const lx of [-2.6, -0.8, 1.0]) box(M.wood, 1.5, 2.0, 0.4, lx, -4.8, 0); box(M.wood, 0.9, 0.5, 0.6, 2.8, -7.2); box(M.wood, 0.8, 1.7, 0.4, 0.2, -7.4);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.4), new THREE.MeshStandardMaterial({ color: 0x6a5a40, roughness: 1 })); const bp = FOMA_SPOT(); board.position.set(bp.x, fy + 0.03, bp.z); gi.add(board);
  roomLights.push({ room: 'foma', x: L(0, -2.2).x, y: fy + 2.4, z: L(0, -2.2).z, color: 0xffc080, intensity: 6, dist: 8, on: (t: number, fl: any) => t < 29 * 60 && !fl.has('lampsShot') });
  bF.flush(gi); world.tagFrom(i0, 'fomaIntact');
  const pf = new PropField(); const sh = (p: string, lx: number, lz: number, o: any) => { const q = L(lx, lz); pf.add(p, q.x, q.z, { collide: false, ...o }); };
  for (let k = 0; k < 6; k++) { sh('dungeon/candle', -2.8 + k * 0.9, -4.55, { s: 0.35, y: fy + 1.0 + (k % 2) * 0.9 }); sh('dungeon/plate', -2.5 + k * 0.8, -4.6, { s: 0.25, y: fy + 0.5 }); }
  sh('dungeon/chest', 0.2, -7.4, { h: 0.65, collide: false }); pf.build(gi);
  makeDoor(scene, 'foma.door', 'foma', P.dcx!, -0.15, { locked: () => 'Заперто наглухо. Ставни закрыты.' });
  // shutters (outside, closed 22:00)
  const shut = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.2, 0.06), M.wood); const sp = L(-2.1, 0.12); shut.position.set(sp.x, fy + 1.9, sp.z); shut.castShadow = true; gi.add(shut);
  const shut2 = shut.clone(); const sp2 = L(2.1, 0.12); shut2.position.set(sp2.x, fy + 1.9, sp2.z); gi.add(shut2);
  groups.fomaIntact = gi;
  ruin(scene, 'fomaRuin', S.x, S.z, S.w, S.d, fy, 11, true);
  // ---- D8 (intact: plain closed house; ruin variant)
  const gd = new THREE.Group(); scene.add(gd); const bD = new Batcher(); const j0 = world.boxes.length;
  putGroup('D8', { x: -33.2, z: -14.4, ry: 0, w: 6.5, floors: 2, wall: M.plaster2, lit: 0.3, seed: 905, depth: 6 }, bD); bD.flush(gd); world.tagFrom(j0, 'd8Intact'); groups.d8Intact = gd;
  ruin(scene, 'd8Ruin', -33.2, -14.4, 6.5, 6, groundH(-33.2, -14.4) - 0.3 + 0.35, 5);
  addInteract({ id: 'foma.spot', x: FOMA_SPOT().x, y: fy, z: FOMA_SPOT().z, r: 1.3, label: c => c.fomaRuinOn() ? 'Осмотреть' : null, use: c => { c.bark('Здесь была кладовка.', true); c.learn('saw_foma_ruin'); } });
}
/** swap intact <-> ruin */
export function setFomaState(ruinOn: boolean) {
  groups.fomaIntact.visible = !ruinOn; groups.d8Intact.visible = !ruinOn; groups.fomaRuin.visible = ruinOn; groups.d8Ruin.visible = ruinOn;
  world.setOff('fomaIntact', ruinOn); world.setOff('d8Intact', ruinOn); world.setOff('fomaRuin', !ruinOn); world.setOff('d8Ruin', !ruinOn);
}
