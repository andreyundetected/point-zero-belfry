import * as THREE from 'three';
import { M } from '../render/materials';
import { BED_Y, BOUNDS, CANAL_BED_Y } from './layout';
import { groundH, hash, surfaceAt, Surface, vnoise } from './terrain';
import { world } from './colliders';

function noiseTex(base: [number, number, number], vary: number, seed: number) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const n = 0.5 * vnoise(x / 9 + seed, y / 9) + 0.3 * vnoise(x / 3 + seed, y / 3) + 0.2 * hash(x + seed, y), i = (y * 256 + x) * 4;
    for (let k = 0; k < 3; k++) im.data[i + k] = Math.max(0, Math.min(255, base[k] * (1 - vary + n * vary * 2)));
    im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const yardMat = new THREE.MeshStandardMaterial({ map: noiseTex([70, 62, 52], 0.45, 3), roughness: 1 });
const grassMat = new THREE.MeshStandardMaterial({ map: noiseTex([52, 66, 44], 0.5, 11), roughness: 1 });

/** ground mesh in 0.5 m cells, one merged mesh per surface material; cells under buildings or water are skipped */
export function buildGround(scene: THREE.Scene) {
  const CS = 0.5, x0 = Math.floor(BOUNDS.x0 - 4), x1 = Math.ceil(BOUNDS.x1 + 4), z0 = Math.floor(BOUNDS.z0 - 4), z1 = 62;
  const nx = Math.round((x1 - x0) / CS), nz = Math.round((z1 - z0) / CS);
  const H = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) H[j * (nx + 1) + i] = groundH(x0 + i * CS, z0 + j * CS);
  const MAT: Record<string, { mat: THREE.Material; tile: number }> = { road: { mat: M.setts, tile: 3.2 }, plaza: { mat: M.setts, tile: 3.2 }, walk: { mat: M.flags, tile: 2.4 }, flags: { mat: M.flags, tile: 2.4 }, yard: { mat: yardMat, tile: 3 }, grass: { mat: grassMat, tile: 3 } };
  const mats: Record<string, { mat: THREE.Material; tile: number; pos: number[]; uv: number[] }> = {}; // one bucket per material and 32 m chunk (frustum culling)
  const bucket = (k: string, cx: number, cz: number) => { const key = k + '|' + Math.floor(cx / 32) + '|' + Math.floor(cz / 32); return mats[key] ??= { ...MAT[k], pos: [], uv: [] }; };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = x0 + (i + 0.5) * CS, cz = z0 + (j + 0.5) * CS;
    let s: Surface = surfaceAt(cx, cz); if (s === 'water') continue;
    if (world.inside(cx, cz, ['building'], -0.3)) continue;
    const key = s === 'yard' && H[j * (nx + 1) + i] > 1.2 ? 'grass' : s;
    const m = bucket(key, cx, cz), a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    const xa = x0 + i * CS, xb = xa + CS, za = z0 + j * CS, zb = za + CS;
    const t = m.tile;
    m.pos.push(xa, H[a], za, xa, H[c], zb, xb, H[b], za, xb, H[b], za, xa, H[c], zb, xb, H[d], zb);
    m.uv.push(xa / t, za / t, xa / t, zb / t, xb / t, za / t, xb / t, za / t, xa / t, zb / t, xb / t, zb / t);
  }
  for (const k in mats) {
    const m = mats[k]; if (!m.pos.length) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(m.uv, 2));
    g.computeVertexNormals(); const mesh = new THREE.Mesh(g, m.mat); mesh.receiveShadow = true; scene.add(mesh);
  }
  // dark bed under canal and harbour so the water reads as deep
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 1 }));
  bed.rotation.x = -Math.PI / 2; bed.position.set(0, CANAL_BED_Y - 0.05, 0); scene.add(bed); void BED_Y;
}
