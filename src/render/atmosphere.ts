import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { A } from './materials';
import { hash } from '../world/terrain';

export const FOG = 0x0b0f15;
export function setupAtmosphere(scene: THREE.Scene) {
  scene.background = new THREE.Color(FOG); scene.fog = new THREE.FogExp2(FOG, 0.035);
  scene.add(new THREE.HemisphereLight(0x5f7590, 0x1d1a17, 0.7));
  const moon = new THREE.DirectionalLight(0xb0c4e8, 1.0); moon.position.set(-18, 30, -12); moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 100 });
  moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.03; scene.add(moon); scene.add(moon.target);
  new EXRLoader().load(A + 'hdri/night_512.exr', t => { t.mapping = THREE.EquirectangularReflectionMapping; scene.environment = t; scene.environmentIntensity = 0.35; });
  return moon;
}
/** Rain follows the camera. */
export function makeRain(scene: THREE.Scene) {
  const N = 3000, rp = new Float32Array(N * 6), seed = new Float32Array(N * 3), bx = { x: 30, y: 16, z: 40 };
  for (let i = 0; i < N; i++) { seed[i * 3] = (hash(i, 30) - .5) * bx.x; seed[i * 3 + 1] = hash(i, 31) * bx.y; seed[i * 3 + 2] = (hash(i, 32) - .5) * bx.z; }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaec4ee, transparent: true, opacity: 0.16 })); rain.frustumCulled = false; scene.add(rain);
  return (t: number, cx: number, cz: number) => {
    for (let i = 0; i < N; i++) {
      const x = cx + seed[i * 3], z = cz + seed[i * 3 + 2]; const y = ((seed[i * 3 + 1] - t * 16) % bx.y + bx.y) % bx.y - 2; const k = i * 6;
      rp[k] = x; rp[k + 1] = y; rp[k + 2] = z; rp[k + 3] = x - 0.04; rp[k + 4] = y + 0.6; rp[k + 5] = z;
    }
    rg.attributes.position.needsUpdate = true;
  };
}
