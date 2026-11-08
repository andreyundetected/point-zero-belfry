import * as THREE from 'three';
import { M } from '../render/materials';
import { Batcher, mtx } from './batch';
import { groundH, hash } from './terrain';

export interface BuildingOpts {
  x: number; z: number; ry: number; w: number; floors: number; wall: THREE.Material;
  lit?: number; shop?: boolean; door?: number; roof?: 'gable' | 'flat'; seed?: number;
  redDoor?: boolean; sign?: string | null; depth?: number;
}
export function signMesh(text: string, w: number, h: number) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const g = c.getContext('2d')!;
  g.fillStyle = '#1a1714'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = '#8a7a5a'; g.lineWidth = 6; g.strokeRect(6, 6, c.width - 12, c.height - 12);
  g.fillStyle = '#d8c9a0'; g.font = `bold ${Math.round(c.height * 0.5)}px Georgia,serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })); m.castShadow = true; return m;
}
const UP = new THREE.Vector3(0, 1, 0);
/** Procedural facade generator. Facade faces local +z. */
export function building(bt: Batcher, scene: THREE.Scene, o: BuildingOpts) {
  const { x, z, ry, w, floors, wall, lit = 0.25, shop = false, door = 0.5, roof = 'gable', seed = 1, redDoor = false, sign = null, depth = 9 } = o;
  const R = (a: number) => hash(seed * 13.1, a * 7.7);
  const FH = 3.1, H = floors * FH + 0.6, base = groundH(x, z) - 0.3;
  const P = (lx: number, ly: number, lz: number): [number, number, number] => { const v = new THREE.Vector3(lx, ly, lz).applyAxisAngle(UP, ry); return [x + v.x, base + ly, z + v.z]; };
  const box = (mat: THREE.Material, w_: number, h_: number, d_: number, lx: number, ly: number, lz: number, tile?: number) => { const [X, Y, Z] = P(lx, ly, lz); bt.box(mat, w_, h_, d_, mtx(X, Y, Z, ry), tile); };
  box(wall, w, H, depth, 0, H / 2, -depth / 2);
  box(M.stone, w + 0.04, 1.25, 0.12, 0, 0.62, 0.05, 1.6);
  for (let f = 1; f < floors; f++) box(M.cornice, w + 0.1, 0.16, 0.22, 0, f * FH + 0.35, 0.08, 1.2);
  box(M.cornice, w + 0.3, 0.32, 0.5, 0, H - 0.1, 0.2, 1.2); box(M.cornice, w + 0.36, 0.12, 0.6, 0, H + 0.12, 0.26, 1.2);
  const bays = Math.max(2, Math.round(w / 2.3)), bw = w / bays;
  for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
    const cx = -w / 2 + bw * (b + 0.5), y0 = f * FH + 0.35;
    const isDoor = f === 0 && b === Math.floor(bays * door);
    if (f === 0 && shop && !isDoor) {
      const ww = bw * 0.82, wh = 2.2; box(M.frame, ww + 0.16, wh + 0.16, 0.08, cx, y0 + 0.55 + wh / 2, 0.04); const lt = R(b + 9) < 0.6;
      box(lt ? M.lit2 : M.glass, ww, wh, 0.02, cx, y0 + 0.55 + wh / 2, 0.09); box(M.frame, 0.05, wh, 0.06, cx, y0 + 0.55 + wh / 2, 0.11); continue;
    }
    if (isDoor) {
      const dw = 1.15, dh = 2.35; box(M.stone, dw + 0.5, dh + 0.35, 0.16, cx, y0 + (dh + 0.35) / 2 - 0.05, 0.06, 1.2); box(M.dark, dw, dh, 0.05, cx, y0 + dh / 2, 0.1);
      box(redDoor ? M.RED : M.wood, dw - 0.08, dh - 0.55, 0.06, cx, y0 + (dh - 0.55) / 2, 0.13, 1.0);
      box(M.lit2, dw - 0.14, 0.38, 0.02, cx, y0 + dh - 0.25, 0.12); box(M.frame, dw + 0.1, 0.06, 0.1, cx, y0 + dh - 0.47, 0.14);
      box(M.stone, dw + 0.7, 0.16, 0.7, cx, y0 - 0.27, 0.35, 1.2); continue;
    }
    if (f === 0 && !shop && R(b) < 0.15) continue;
    const ww = Math.min(1.05, bw * 0.48), wh = f === 0 ? 1.6 : 1.75, wy = y0 + 1.0 + wh / 2; const L_ = R(f * 10 + b) < lit;
    box(M.frame, ww + 0.2, wh + 0.2, 0.06, cx, wy, 0.03);
    box(L_ ? M.lit : M.glass, ww, wh, 0.02, cx, wy, 0.065);
    box(M.frame, ww, 0.05, 0.05, cx, wy + wh * 0.18, 0.08); box(M.frame, 0.05, wh, 0.05, cx, wy, 0.08);
    box(M.cornice, ww + 0.36, 0.08, 0.22, cx, wy - wh / 2 - 0.12, 0.1, 1.2);
    box(M.cornice, ww + 0.3, 0.14, 0.08, cx, wy + wh / 2 + 0.15, 0.05, 1.2);
    if (L_ && R(b * 3 + f) < 0.5) box(M.dark, ww * 0.45, wh * 0.8, 0.01, cx - ww * 0.27, wy, 0.078);
    if (R(f + b * 5) < 0.35 && !L_) { box(M.wood, ww * 0.55, wh + 0.1, 0.04, cx - ww * 0.8, wy, 0.08, 1); box(M.wood, ww * 0.55, wh + 0.1, 0.04, cx + ww * 0.8, wy, 0.08, 1); }
    if (f >= 1 && R(f * 3 + b) < 0.12) { box(M.stone, ww + 0.9, 0.12, 0.8, cx, y0 + 0.95, 0.4, 1.2); for (let k = 0; k < 7; k++) box(M.iron, 0.025, 0.85, 0.025, cx - (ww + 0.8) / 2 + k * (ww + 0.8) / 6, y0 + 1.42, 0.78); box(M.iron, ww + 0.9, 0.04, 0.04, cx, y0 + 1.85, 0.78); }
  }
  if (sign) { const sg = signMesh(sign, Math.min(w * 0.7, 5), 0.6); const [X, Y, Z] = P(0, 3.25, 0.18); sg.position.set(X, Y, Z); sg.rotation.y = ry; scene.add(sg); }
  box(M.iron, 0.09, H, 0.09, w / 2 - 0.25, H / 2, 0.12);
  if (roof === 'gable') {
    const hw = w / 2 + 0.25, rh = 2.6 + R(2) * 1.2, d0 = 0.5, d1 = -depth - 0.3, pos: number[] = [];
    const qd = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    const A1 = [-hw, 0, d0], B1 = [hw, 0, d0], C1 = [hw, rh, (d0 + d1) / 2], D1 = [-hw, rh, (d0 + d1) / 2], A2 = [hw, 0, d1], B2 = [-hw, 0, d1];
    qd(A1, B1, C1, D1); qd(A2, B2, D1, C1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const uv: number[] = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / 2.2, (pos[i + 1] + Math.abs(pos[i + 2])) / 2.2);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.applyMatrix4(mtx(...P(0, H + 0.15, 0), ry)); bt.geo(M.roof, g);
    for (let c = 0; c < 1 + (w > 7 ? 1 : 0); c++) box(M.brickD, 0.7, 1.6, 0.6, -w / 4 + c * w / 2, H + rh * 0.6, -depth / 2 + 0.8, 1.8);
  } else { box(wall, w, 0.9, 0.25, 0, H + 0.45, 0.05); box(M.brickD, 0.8, 1.3, 0.7, w / 3, H + 0.65, -depth / 2, 1.8); }
}
