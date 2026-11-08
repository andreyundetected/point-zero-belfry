import * as THREE from 'three';
import { M, WALLS } from '../render/materials';
import { Batcher, mtx } from './batch';
import { building } from './building';
import { lamp } from './lamps';
import { groundH, hash, vnoise, setGroundFn } from './terrain';

// Stage-1 reference street (from tools/style_test/noir.html). Stage 2 replaces it with the real map.
export const ST = 4.4, WALK = 2.0, CURB = 0.15, CANAL_Z = -34, CANAL_W = 12, WATER = -2.4, AL0 = -5, AL1 = 1;
const L = -(ST + WALK), Rr = ST + WALK;
setGroundFn((x, z) => {
  let h = -z * 0.012; const ax = Math.abs(x);
  if (ax < ST) { h += 0.08 * (1 - (ax / ST) ** 2); h -= 0.03 * Math.exp(-((ax - 1.2) ** 2) * 6); }
  else if (!(x < -ST - WALK && z > AL0 && z < AL1)) h += CURB + 0.015 * vnoise(x * 0.6, z * 0.6);
  return h + 0.04 * vnoise(x * 0.8, z * 0.8) + 0.018 * vnoise(x * 3, z * 3);
});
function strip(scene: THREE.Scene, x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, lift: number, tile: number, seg = 0.25) {
  const nx = Math.max(1, Math.round((x1 - x0) / seg)), nz = Math.max(1, Math.round((z1 - z0) / seg));
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, groundH(x, z) + lift); uv.setXY(i, x / tile, z / tile); }
  g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m);
}
export function buildTestStreet(scene: THREE.Scene) {
  const bt = new Batcher();
  strip(scene, -ST, ST, -27.2, 40, M.setts, 0, 3.2); strip(scene, L, -ST, -27.2, 40, M.flags, 0, 2.4, 0.5); strip(scene, ST, Rr, -27.2, 40, M.flags, 0, 2.4, 0.5);
  strip(scene, -Rr, Rr, -75, -40.8, M.setts, 0, 3.2); strip(scene, -30, L, AL0, AL1, M.setts, 0, 3.2);
  const tmp = new THREE.Object3D();
  for (const s of [-1, 1]) for (let z = -27; z < 40; z += 0.97) {
    if (s < 0 && z > AL0 - 0.5 && z < AL1) continue; const x = s * (ST + 0.1) + (hash(z, s) - .5) * 0.03;
    tmp.position.set(x, groundH(s * (ST + 0.6), z) - 0.1, z); tmp.rotation.set((hash(z, 1) - .5) * 0.03, (hash(s, z) - .5) * 0.04, (hash(z, z) - .5) * 0.04); tmp.updateMatrix();
    bt.box(M.stone, 0.22, 0.24, 0.95, tmp.matrix.clone(), 1.0);
  }
  for (const rx of [-1.6, -0.5]) for (let z = -27; z < 40; z += 2) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 2.0), M.iron); m.position.set(rx, groundH(rx, z + 1) - 0.008, z + 1); scene.add(m); }
  const pud = new THREE.MeshPhysicalMaterial({ color: 0x020306, roughness: 0.02, clearcoat: 1, envMapIntensity: 1.6, transparent: true, opacity: 0.88 });
  for (let i = 0; i < 16; i++) {
    const x = (i % 2 ? 1.25 : -1.2) + (hash(i, 20) - .5) * 0.5, z = -26 + i * 4.2 + hash(i, 21) * 2;
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), pud); m.scale.set(0.5 + hash(i, 22) * 1.0, 0.35 + hash(i, 23) * 0.5, 1); m.rotation.x = -Math.PI / 2; m.rotation.z = hash(i, 24) * 3; m.position.set(x, groundH(x, z) + 0.012, z); scene.add(m);
  }
  { // canal + bridge
    const water = new THREE.Mesh(new THREE.PlaneGeometry(200, CANAL_W + 2), new THREE.MeshPhysicalMaterial({ color: 0x03060a, roughness: 0.06, clearcoat: 1, envMapIntensity: 2 })); water.rotation.x = -Math.PI / 2; water.position.set(0, WATER, CANAL_Z); scene.add(water);
    for (const s of [-1, 1]) { const zz = CANAL_Z + s * (CANAL_W / 2 + 0.6); bt.box(M.stone, 200, 3.0, 1.2, mtx(0, WATER + 1.2, zz), 1.6);
      for (const sx of [-1, 1]) bt.box(M.stone, (100 - Rr), 0.55, 0.45, mtx(sx * (Rr + (100 - Rr) / 2), groundH(0, zz) + 0.25, zz - s * 0.3), 1.2); }
    const bz0 = CANAL_Z - CANAL_W / 2 - 1.2, bz1 = CANAL_Z + CANAL_W / 2 + 1.2, bw = 2 * Rr;
    for (let k = 0; k < 14; k++) { const t = k / 13, zz = bz0 + 0.6 + (bz1 - bz0 - 1.2) * t, y = Math.sin(t * Math.PI) * 1.5; bt.box(M.stone, bw, 1.0, (bz1 - bz0) / 13 + 0.05, mtx(0, WATER + 0.55 + y, zz), 1.6); }
    for (let k = 0; k < 14; k++) { const t = k / 13, zz = bz0 + 0.6 + (bz1 - bz0 - 1.2) * t, y = Math.sin(t * Math.PI) * 1.5; bt.box(M.stone, bw, groundH(0, zz) - (WATER + 1.05 + y), (bz1 - bz0) / 13 + 0.05, mtx(0, (groundH(0, zz) + WATER + 1.05 + y) / 2 - 0.1, zz), 1.6); }
    for (const s of [-1, 1]) { bt.box(M.stone, 0.5, 0.95, bz1 - bz0, mtx(s * (bw / 2 - 0.25), groundH(0, CANAL_Z) + 0.45, CANAL_Z), 1.2); bt.box(M.cornice, 0.62, 0.12, bz1 - bz0 + 0.2, mtx(s * (bw / 2 - 0.25), groundH(0, CANAL_Z) + 0.98, CANAL_Z), 1.2); }
    strip(scene, -bw / 2 + 0.5, bw / 2 - 0.5, bz0, bz1, M.setts, 0.01, 3.2);
  }
  // buildings
  type S = [number, number?, number?, boolean?, (string | null)?, number?];
  let zL = -26.6; ([[8, 3, 0.2, true, 'ЗАЛОГИ · ФОМА'], [6, 4, 0.3, false], [7.5, 3, 0.15, false], [0], [9, 3, 0.35, true, '«ЯКОРЬ»', 1], [6.5, 4, 0.25, false], [8, 2, 0.2, true, 'ПОЧТА · ТЕЛЕГРАФ'], [7, 3, 0.3, false]] as S[]).forEach((s, i) => {
    if (s[0] === 0) { zL += 6; return; }
    building(bt, scene, { x: L, z: zL + s[0] / 2, ry: Math.PI / 2, w: s[0], floors: s[1]!, lit: s[2], shop: s[3], sign: s[4], wall: WALLS[i % 5], seed: i + 1, redDoor: s[5] === 1, roof: i % 3 === 2 ? 'flat' : 'gable' }); zL += s[0] + 0.02; });
  let zR = -26.6; ([[7, 4, 0.25, false], [9, 3, 0.2, true, 'КЛЮЧИ И ЗАМКИ'], [6, 3, 0.3, false], [8.5, 4, 0.2, false], [7, 3, 0.1, true, 'АПТЕКА'], [9, 3, 0.25, false], [7, 2, 0.3, false], [8, 3, 0.2, false]] as S[]).forEach((s, i) => {
    building(bt, scene, { x: Rr, z: zR + s[0] / 2, ry: -Math.PI / 2, w: s[0], floors: s[1]!, lit: s[2], shop: s[3], sign: s[4], wall: WALLS[(i + 2) % 5], seed: i + 20, roof: i % 3 === 1 ? 'flat' : 'gable' }); zR += s[0] + 0.02; });
  ([[-24, 3], [-15.8, 4], [-7.6, 3], [7.6, 4], [15.8, 3], [24, 4]] as [number, number][]).forEach(([x, f], i) => building(bt, scene, { x, z: -41.2, ry: 0, w: 8, floors: f, lit: 0.3, wall: WALLS[(i + 1) % 5], seed: 40 + i, shop: i === 2, sign: i === 2 ? 'ПЕКАРНЯ' : null }));
  building(bt, scene, { x: -12, z: AL0 - 0.2, ry: 0, w: 11.6, floors: 3, lit: 0.2, wall: M.plaster3, seed: 60 }); building(bt, scene, { x: -12, z: AL1 + 0.2, ry: Math.PI, w: 11.6, floors: 3, lit: 0.3, wall: M.brickD, seed: 61 });
  building(bt, scene, { x: -22, z: AL0 - 0.2, ry: 0, w: 8, floors: 2, lit: 0.3, wall: M.brick, seed: 62 }); building(bt, scene, { x: -22, z: AL1 + 0.2, ry: Math.PI, w: 8, floors: 3, lit: 0.2, wall: M.plaster, seed: 63 });
  building(bt, scene, { x: -30.2, z: -2, ry: Math.PI / 2, w: 6.4, floors: 3, lit: 0.4, wall: M.plaster2, seed: 64 });
  bt.flush(scene);
  ([[-ST - 0.5, -20], [ST + 0.5, -12], [-ST - 0.5, -8], [ST + 0.5, 6], [-ST - 0.5, 15], [ST + 0.5, 24], [-ST - 0.5, 33], [-Rr + 0.4, -27.6], [Rr - 0.4, -40.4], [-ST - 0.5, -50]] as [number, number][]).forEach(p => lamp(scene, ...p));
}
