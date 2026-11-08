import * as THREE from 'three';
import { A, M } from '../render/materials';
import { groundH } from './terrain';

const haloTex = new THREE.TextureLoader().load(A + 'textures/procedural/lamp_halo.png');
export function halo(scene: THREE.Scene, x: number, y: number, z: number, s: number, c = 0xffb070, o = 0.75) {
  const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: o, fog: false }));
  h.scale.setScalar(s); h.position.set(x, y, z); scene.add(h);
}
/** Cast-iron gas lamp built from code. */
export function lamp(scene: THREE.Scene, x: number, z: number) {
  const y0 = groundH(x, z); const g = new THREE.Group(); g.position.set(x, y0, z);
  ([[new THREE.CylinderGeometry(0.05, 0.09, 3.6, 10), 1.8], [new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10), 0.25], [new THREE.CylinderGeometry(0.2, 0.12, 0.45, 6, 1, true), 3.85], [new THREE.ConeGeometry(0.28, 0.25, 6), 4.2]] as [THREE.BufferGeometry, number][])
    .forEach(([geo, y]) => { const m = new THREE.Mesh(geo, M.iron); m.position.y = y; m.castShadow = true; g.add(m); });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc080).multiplyScalar(4) })); bulb.position.y = 3.85; g.add(bulb); scene.add(g);
  const L = new THREE.PointLight(0xffb070, 13, 15, 1.6); L.position.set(x, y0 + 3.65, z); scene.add(L); halo(scene, x, y0 + 3.85, z, 2.4);
  return L;
}
