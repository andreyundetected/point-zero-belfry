import * as THREE from 'three';
import { A, M } from '../render/materials';
import { Batcher } from './batch';
import { groundH } from './terrain';
import { world } from './colliders';

const haloTex = new THREE.TextureLoader().load(A + 'textures/procedural/lamp_halo.png');
export function halo(scene: THREE.Scene, x: number, y: number, z: number, s: number, c = 0xffb070, o = 0.75) {
  const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: o, fog: false }));
  h.scale.setScalar(s); h.position.set(x, y, z); scene.add(h); return h;
}
export interface LampRec { x: number; y: number; z: number; on: boolean; i: number; color: number; intensity: number; dist: number; }
export const lamps: LampRec[] = [];
// All gas lamps are drawn with 3 draw calls in total: merged poles, one instanced mesh of bulbs, one Points cloud of halos.
const lb = new Batcher(); const bulbPos: THREE.Vector3[] = [];
let bulbs: THREE.InstancedMesh | undefined, panes: THREE.InstancedMesh | undefined, halos: THREE.Points | undefined, haloCol: Float32Array | undefined; const paneM: THREE.Matrix4[] = [];
// iron: pole, foot, the lantern's six corner ribs and the cap. The glass panes between the ribs are a separate instanced mesh that glows (and goes dark when the lamp is out)
const PARTS: [() => THREE.BufferGeometry, number][] = [[() => new THREE.CylinderGeometry(0.05, 0.09, 3.6, 10), 1.8], [() => new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10), 0.25], [() => new THREE.TorusGeometry(0.13, 0.015, 6, 6), 3.63], [() => new THREE.TorusGeometry(0.21, 0.015, 6, 6), 4.07], [() => new THREE.ConeGeometry(0.28, 0.25, 6), 4.2]];
/** cast-iron gas lamp built from code. Real PointLights are pooled (LampPool); each lamp is merged geometry + a bulb + a halo. */
export function lamp(scene: THREE.Scene, x: number, z: number, y0 = groundH(x, z), tilt = 0) {
  void scene; const rx = Math.sin(x * 12.9 + z) * 0.012, rz = tilt || Math.sin(z * 7.1 + x) * 0.012;
  const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x, y0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1));
  for (const [mk, y] of PARTS) { const g = mk(); if (g instanceof THREE.TorusGeometry) g.rotateX(Math.PI / 2); g.translate(0, y, 0); g.applyMatrix4(m4); lb.geo(M.iron, g); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; const rib = new THREE.BoxGeometry(0.02, 0.46, 0.02); rib.translate(Math.cos(a) * 0.17, 3.85, Math.sin(a) * 0.17); rib.applyMatrix4(m4); lb.geo(M.iron, rib); }
  paneM.push(new THREE.Matrix4().makeTranslation(0, 3.85, 0).premultiply(m4));
  const top = new THREE.Vector3(0, 3.85, 0).applyMatrix4(m4); bulbPos.push(top);
  world.add(x, z, 0.2, 0.2, 0, y0, y0 + 4.4, 'solid');
  const rec: LampRec = { x, y: y0 + 3.65, z, on: true, i: lamps.length, color: 0xffb070, intensity: 13, dist: 15 }; lamps.push(rec); return rec;
}
/** call once after every lamp() */
export function finalizeLamps(scene: THREE.Scene) {
  lb.flush(scene);
  bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd090).multiplyScalar(5) }), lamps.length); bulbs.frustumCulled = false;
  // frosted glass panes: a warm self-lit shell, slightly see-through, so the lantern head itself is what glows
  panes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.125, 0.44, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb878, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false }), lamps.length); panes.frustumCulled = false;
  paneM.forEach((m, i) => { panes!.setMatrixAt(i, m); panes!.setColorAt(i, new THREE.Color(1, 1, 1)); }); scene.add(panes);
  const m = new THREE.Matrix4(); bulbPos.forEach((p, i) => bulbs!.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z))); scene.add(bulbs);
  const pos = new Float32Array(lamps.length * 3); haloCol = new Float32Array(lamps.length * 3).fill(1); bulbPos.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(haloCol, 3));
  halos = new THREE.Points(g, new THREE.PointsMaterial({ map: haloTex, size: 2.6, sizeAttenuation: true, color: 0xffb070, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, fog: false })); halos.frustumCulled = false; scene.add(halos);
}
const mtmp = new THREE.Matrix4();
export function setLamp(l: LampRec, on: boolean) {
  l.on = on; if (!bulbs || !halos || !haloCol) return; const p = bulbPos[l.i];
  bulbs.setMatrixAt(l.i, on ? mtmp.makeTranslation(p.x, p.y, p.z) : mtmp.makeScale(0, 0, 0)); bulbs.instanceMatrix.needsUpdate = true;
  haloCol[l.i * 3] = haloCol[l.i * 3 + 1] = haloCol[l.i * 3 + 2] = on ? 1 : 0; (halos.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  if (panes) { panes.setColorAt(l.i, on ? new THREE.Color(1, 1, 1) : new THREE.Color(0.08, 0.08, 0.09)); panes.instanceColor!.needsUpdate = true; }
}

/** keeps a fixed number of real lights on the nearest lit lamps */
export class LampPool {
  lights: THREE.PointLight[] = [];
  constructor(scene: THREE.Scene, n = 10) {
    for (let i = 0; i < n; i++) { const L = new THREE.PointLight(0xffb070, 0, 15, 1.6); scene.add(L); this.lights.push(L); }
  }
  update(px: number, pz: number, extra: { x: number; y: number; z: number; color: number; intensity: number; dist: number }[] = [], inside = false) {
    const cand = (inside ? [] : lamps.filter(l => l.on)).map(l => ({ x: l.x, y: l.y, z: l.z, color: l.color, intensity: l.intensity, dist: l.dist, d: (l.x - px) ** 2 + (l.z - pz) ** 2 }));
    for (const e of extra) cand.push({ ...e, d: (e.x - px) ** 2 + (e.z - pz) ** 2 - 400 });
    cand.sort((a, b) => a.d - b.d);
    this.lights.forEach((L, i) => {
      const c = cand[i]; if (!c) { L.intensity = 0; return; }
      L.position.set(c.x, c.y, c.z); L.color.setHex(c.color); L.intensity = c.intensity; L.distance = c.dist;
    });
  }
}
