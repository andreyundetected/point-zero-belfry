import * as THREE from 'three';
import { M, A } from '../render/materials';
import { BOUNDS, CANAL, ROADS } from './layout';
import { groundH, hash, roadDist } from './terrain';
import { placed, Placed } from './city';

/** the city does not stop at the map edge: ground, streets' worth of blocks and a skyline out to ~300 m (instanced, cheap) */
export function buildOutskirts(scene: THREE.Scene) {
  const ix0 = BOUNDS.x0 - 4, ix1 = BOUNDS.x1 + 4, iz0 = BOUNDS.z0 - 4, iz1 = 62, CS = 4, X0 = -300, X1 = 300, Z0 = -300, Z1 = 58;
  const pos: number[] = [], uv: number[] = [];
  for (let z = Z0; z < Z1; z += CS) for (let x = X0; x < X1; x += CS) { if (x + CS > ix0 && x < ix1 && z + CS > iz0 && z < iz1) continue; if (Math.abs(x) < 8 && z < CANAL.z0) { /* canal continues as a dark ditch: skip */ continue; }
    const ha = groundH(x, z), hb = groundH(x + CS, z), hc = groundH(x, z + CS), hd = groundH(x + CS, z + CS), y = (h: number) => Math.max(h, -1.5);
    pos.push(x, y(ha), z, x, y(hc), z + CS, x + CS, y(hb), z, x + CS, y(hb), z, x, y(hc), z + CS, x + CS, y(hd), z + CS); uv.push(x / 3, z / 3, x / 3, (z + CS) / 3, (x + CS) / 3, z / 3, (x + CS) / 3, z / 3, x / 3, (z + CS) / 3, (x + CS) / 3, (z + CS) / 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const gm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: M.setts.map, color: 0x666666, roughness: 1 })); gm.receiveShadow = false; scene.add(gm);
  // blocks along a street grid (gaps every 36 m), taller toward the horizon
  const blocks: { x: number; z: number; w: number; d: number; h: number; ry: number }[] = [];
  for (let z = -296; z < 56; z += 12) for (let x = -296; x < 296; x += 12) {
    if (x > ix0 - 6 && x < ix1 + 6 && z > iz0 - 6 && z < iz1) continue; if (Math.abs(x) < 10 && z < CANAL.z0 + 4) continue;
    const mx = ((x % 36) + 36) % 36, mz = ((z % 36) + 36) % 36; if (mx < 6 || mz < 6) continue;
    const R = (a: number) => hash(x * 0.31 + a, z * 0.47 - a), r = Math.hypot(x, z + 40), h = 8 + R(1) * 14 + Math.min(26, r / 12) * R(2);
    if (R(9) < 0.12) continue; blocks.push({ x: x + (R(3) - 0.5) * 3, z: z + (R(4) - 0.5) * 3, w: 8 + R(5) * 4, d: 8 + R(6) * 4, h, ry: Math.floor(R(7) * 2) * Math.PI / 2 });
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 1 }), blocks.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); const wp: number[] = [];
  blocks.forEach((b, i) => { const gy = groundH(b.x, b.z); m4.compose(new THREE.Vector3(b.x, gy + b.h / 2 - 1, b.z), q.setFromEuler(new THREE.Euler(0, b.ry, 0)), new THREE.Vector3(b.w, b.h + 2, b.d)); im.setMatrixAt(i, m4);
    const floors = Math.floor(b.h / 3.1); for (let f = 0; f < floors; f++) for (let k = 0; k < 3; k++) if (hash(b.x + f * 3.1, b.z + k) < 0.16) { const face = Math.floor(hash(f, k + b.x) * 4), a = b.ry + face * Math.PI / 2, off = face % 2 ? b.d / 2 : b.w / 2, t = (hash(k, b.z + f) - 0.5) * (face % 2 ? b.w : b.d) * 0.8; wp.push(b.x + Math.sin(a) * (off + 0.1) + Math.cos(a) * t, gy + 2.4 + f * 3.1, b.z + Math.cos(a) * (off + 0.1) - Math.sin(a) * t); }
    placed.push({ id: 'ob', x: b.x, z: b.z, ry: b.ry, w: b.w, depth: b.d, H: b.h, floors, base: gy - 0.3, door: { x: b.x, z: b.z, ry: b.ry } } as Placed); });
  im.frustumCulled = false; scene.add(im);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ map: new THREE.TextureLoader().load(A + 'textures/procedural/lamp_halo.png'), size: 2.2, color: 0xffb870, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })));
  void ROADS; void roadDist;
}
