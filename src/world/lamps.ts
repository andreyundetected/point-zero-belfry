import * as THREE from 'three';
import { A, M } from '../render/materials';
import { groundH } from './terrain';
import { world } from './colliders';

const haloTex = new THREE.TextureLoader().load(A + 'textures/procedural/lamp_halo.png');
export function halo(scene: THREE.Scene, x: number, y: number, z: number, s: number, c = 0xffb070, o = 0.75) {
  const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: o, fog: false }));
  h.scale.setScalar(s); h.position.set(x, y, z); scene.add(h); return h;
}
export interface LampRec { x: number; y: number; z: number; on: boolean; halo: THREE.Sprite; bulb: THREE.Mesh; color: number; intensity: number; dist: number; }
export const lamps: LampRec[] = [];
const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc080).multiplyScalar(4) });
const lampGeo: [THREE.BufferGeometry, number][] = [[new THREE.CylinderGeometry(0.05, 0.09, 3.6, 10), 1.8], [new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10), 0.25], [new THREE.CylinderGeometry(0.2, 0.12, 0.45, 6, 1, true), 3.85], [new THREE.ConeGeometry(0.28, 0.25, 6), 4.2]];
/** Cast-iron gas lamp built from code. Real PointLights are pooled (see LampPool); each lamp is a bulb + halo. */
export function lamp(scene: THREE.Scene, x: number, z: number, y0 = groundH(x, z), tilt = 0) {
  const g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.set((Math.sin(x * 12.9 + z) * 0.012), 0, tilt || Math.sin(z * 7.1 + x) * 0.012);
  lampGeo.forEach(([geo, y]) => { const m = new THREE.Mesh(geo, M.iron); m.position.y = y; m.castShadow = true; g.add(m); });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), bulbMat); bulb.position.y = 3.85; g.add(bulb); scene.add(g);
  const h = halo(scene, x, y0 + 3.85, z, 2.4);
  world.add(x, z, 0.2, 0.2, 0, y0, y0 + 4.4, 'solid');
  const rec: LampRec = { x, y: y0 + 3.65, z, on: true, halo: h, bulb, color: 0xffb070, intensity: 13, dist: 15 };
  lamps.push(rec); return rec;
}
export function setLamp(l: LampRec, on: boolean) { l.on = on; l.halo.visible = on; l.bulb.visible = on; }

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
