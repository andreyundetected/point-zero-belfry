import * as THREE from 'three';
import { groundH } from './terrain';
import { M, StaticBatch, mtx, canvasPlane, worldUV } from '../render/materials';

export interface BuildingOpts {
  x: number;
  z: number;
  ry: number;
  w: number;
  depth?: number;
  floors: number;
  wall: THREE.Material;
  lit?: number;            // доля горящих окон
  shop?: boolean;
  sign?: string;
  roof?: 'gable' | 'flat';
  seed?: number;
  redDoor?: boolean;
  doorPos?: number;        // 0..1 по фасаду
  enterable?: boolean;
  interiorH?: number;
  name?: string;
  facadeOnly?: boolean;
  base?: number;
  step?: boolean;
}

export interface Rect { x: number; z: number; hw: number; hd: number; ry: number; yMin?: number; yMax?: number; }

export interface Built {
  x: number; z: number; ry: number; w: number; depth: number;
  rects: Rect[];
  door?: { x: number; z: number; ry: number; w: number; name?: string };
  interior?: { cx: number; cz: number; w: number; d: number; floorY: number; h: number; ry: number };
  sign?: THREE.Object3D;
}

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Процедурный дом. Фасад — локальная плоскость z=0, корпус уходит в −z. */
export function buildBuilding(batch: StaticBatch, o: BuildingOpts): Built {
  const depth = o.depth ?? 9;
  const w = o.w;
  const floors = o.floors;
  const FH = 3.1;
  const seed = o.seed ?? 1;
  const R = (a: number, b = 7.7) => hash(seed * 13.1 + a, b);
  const base = (o.base ?? groundH(o.x, o.z)) - 0.3;
  const H = floors * FH + 0.6;
  const ry = o.ry;
  const cos = Math.cos(ry), sin = Math.sin(ry);
  const P = (lx: number, ly: number, lz: number): [number, number, number] => {
    const X = o.x + lx * cos + lz * sin;
    const Z = o.z - lx * sin + lz * cos;
    return [X, base + ly, Z];
  };
  const box = (mat: THREE.Material, bw: number, bh: number, bd: number, lx: number, ly: number, lz: number, tile = 1.8) => {
    const [X, Y, Z] = P(lx, ly, lz);
    batch.box(mat, bw, bh, bd, mtx(X, Y, Z, ry), tile);
  };
  const rect = (lx: number, lz: number, hw: number, hd: number): Rect => ({
    x: o.x + lx * cos + lz * sin,
    z: o.z - lx * sin + lz * cos,
    hw, hd, ry,
  });

  const rects: Rect[] = [];
  const doorX = (o.doorPos ?? 0.5) * w - w / 2;
  const gap = 1.35;
  const enterable = !!o.enterable;
  const intH = o.interiorH ?? 3.0;
  const floorY = base + 0.3 + 0.06;

  // --- корпус -------------------------------------------------------------
  if (enterable) {
    const wallT = 0.42;
    const frontL = doorX - gap / 2 + w / 2;
    const frontR = w / 2 - (doorX + gap / 2);
    // фасад по бокам от двери
    box(o.wall, frontL, intH, wallT, -w / 2 + frontL / 2, intH / 2, -wallT / 2 + 0.02);
    box(o.wall, frontR, intH, wallT, w / 2 - frontR / 2, intH / 2, -wallT / 2 + 0.02);
    // перемычка над дверью
    box(o.wall, gap + 0.1, intH - 2.3, wallT, doorX, 2.3 + (intH - 2.3) / 2, -wallT / 2 + 0.02);
    // боковые и задняя стены
    box(o.wall, wallT, intH, depth, -w / 2 + wallT / 2, intH / 2, -depth / 2);
    box(o.wall, wallT, intH, depth, w / 2 - wallT / 2, intH / 2, -depth / 2);
    box(o.wall, w, intH, wallT, 0, intH / 2, -depth + wallT / 2);
    // пол и потолок
    box(M.dark, w - 0.5, 0.14, depth - 0.5, 0, 0.05, -depth / 2, 3);
    box(M.plaster3, w, 0.24, depth, 0, intH + 0.12, -depth / 2, 1.6);
    // верхние этажи — монолит
    if (floors > 1) box(o.wall, w, H - intH, depth, 0, intH + (H - intH) / 2, -depth / 2);
    rects.push(rect(-w / 2 + wallT / 2, -depth / 2, wallT / 2, depth / 2));
    rects.push(rect(w / 2 - wallT / 2, -depth / 2, wallT / 2, depth / 2));
    rects.push(rect(0, -depth + wallT / 2, w / 2, wallT / 2));
    const lw = Math.max(0.01, (w / 2 + doorX - gap / 2) / 2);
    const rw = Math.max(0.01, (w / 2 - doorX - gap / 2) / 2);
    rects.push(rect(-w / 2 + lw, 0, lw, wallT / 2));
    rects.push(rect(w / 2 - rw, 0, rw, wallT / 2));
  } else {
    box(o.wall, w, H, depth, 0, H / 2, -depth / 2);
    rects.push(rect(0, -depth / 2, w / 2, depth / 2));
  }

  // цоколь и карнизы
  box(M.stone, w + 0.05, enterable ? 0.6 : 1.25, 0.13, 0, enterable ? 0.3 : 0.62, 0.06, 1.6);
  for (let f = 1; f < floors; f++) box(M.cornice, w + 0.1, 0.16, 0.24, 0, f * FH + 0.35, 0.1, 1.2);
  box(M.cornice, w + 0.3, 0.32, 0.52, 0, H - 0.1, 0.22, 1.2);
  box(M.cornice, w + 0.36, 0.12, 0.62, 0, H + 0.12, 0.28, 1.2);

  // --- окна ---------------------------------------------------------------
  const bays = Math.max(2, Math.round(w / 2.3));
  const bw = w / bays;
  for (let f = 0; f < floors; f++) {
    for (let b = 0; b < bays; b++) {
      const cx = -w / 2 + bw * (b + 0.5);
      const y0 = f * FH + 0.35;
      const isDoorBay = f === 0 && Math.abs(cx - doorX) < bw * 0.5;

      if (isDoorBay) {
        if (!o.facadeOnly || enterable) {
          // каменное обрамление и ступень
          box(M.stone, gap + 0.55, 2.7, 0.18, doorX, 1.35, 0.08, 1.2);
          box(M.stone, gap + 0.9, 0.17, 0.85, doorX, 0.02, 0.38, 1.2);
          if (!enterable) {
            if (o.redDoor) box(M.RED, gap - 0.06, 2.42, 0.2, doorX, 1.28, 0.12, 1);
            else box(M.wood, gap - 0.06, 2.42, 0.2, doorX, 1.28, 0.12, 1);
            box(M.lit2, gap - 0.18, 0.34, 0.03, doorX, 2.42, 0.16);
          }
        }
        continue;
      }

      if (f === 0 && o.shop && !enterable) {
        const ww = bw * 0.82, wh = 2.2;
        box(M.frame, ww + 0.18, wh + 0.18, 0.1, cx, y0 + 0.55 + wh / 2, 0.06);
        box(R(b + 9) < 0.6 ? M.lit2 : M.glass, ww, wh, 0.03, cx, y0 + 0.55 + wh / 2, 0.12);
        box(M.frame, 0.05, wh, 0.07, cx, y0 + 0.55 + wh / 2, 0.14);
        // маркиза
        const awn = new THREE.BoxGeometry(ww + 0.3, 0.06, 0.9);
        awn.applyMatrix4(mtx(...P(cx, y0 + wh + 0.9, 0.42), ry));
        batch.add(M.cloth, awn);
        continue;
      }

      if (f === 0 && !o.shop && R(b + 3) < 0.16) continue;

      const ww = Math.min(1.05, bw * 0.48);
      const wh = f === 0 ? 1.6 : 1.75;
      const wy = y0 + 1.0 + wh / 2;
      const isLit = R(f * 10 + b) < (o.lit ?? 0.25);
      box(M.frame, ww + 0.2, wh + 0.2, 0.07, cx, wy, 0.03);
      box(isLit ? M.lit : M.glass, ww, wh, 0.02, cx, wy, 0.07);
      box(M.frame, ww, 0.05, 0.055, cx, wy + wh * 0.18, 0.09);
      box(M.frame, 0.05, wh, 0.055, cx, wy, 0.09);
      box(M.cornice, ww + 0.36, 0.08, 0.24, cx, wy - wh / 2 - 0.12, 0.11, 1.2);
      box(M.cornice, ww + 0.3, 0.14, 0.09, cx, wy + wh / 2 + 0.15, 0.06, 1.2);
      // занавеска в горящем окне
      if (isLit && R(b * 3 + f) < 0.5) box(M.dark, ww * 0.42, wh * 0.8, 0.012, cx - ww * 0.26, wy, 0.085);
      // ставни
      if (!isLit && R(f + b * 5) < 0.32) {
        box(M.wood, ww * 0.5, wh + 0.1, 0.04, cx - ww * 0.82, wy, 0.09, 1);
        box(M.wood, ww * 0.5, wh + 0.1, 0.04, cx + ww * 0.82, wy, 0.09, 1);
      }
      // балкон
      if (f >= 1 && R(f * 3 + b) < 0.11) {
        box(M.stone, ww + 0.9, 0.12, 0.8, cx, y0 + 0.95, 0.42, 1.2);
        for (let k = 0; k < 7; k++) {
          box(M.iron, 0.025, 0.85, 0.025, cx - (ww + 0.8) / 2 + k * ((ww + 0.8) / 6), y0 + 1.42, 0.8);
        }
        box(M.iron, ww + 0.9, 0.04, 0.04, cx, y0 + 1.85, 0.8);
      }
    }
  }

  // водосточная труба
  box(M.iron, 0.1, H, 0.1, w / 2 - 0.28, H / 2, 0.13);
  box(M.iron, 0.16, 0.1, 0.32, w / 2 - 0.28, H - 0.1, 0.2);

  // --- крыша --------------------------------------------------------------
  if (o.roof === 'flat') {
    box(o.wall, w, 0.9, 0.26, 0, H + 0.45, 0.06);
    box(M.brickD, 0.8, 1.3, 0.7, w / 3, H + 0.65, -depth / 2, 1.8);
    box(M.cornice, w + 0.2, 0.1, depth + 0.2, 0, H + 0.62, -depth / 2, 1.6);
  } else {
    const hw = w / 2 + 0.25;
    const rh = 2.6 + R(2) * 1.2;
    const d0 = 0.5, d1 = -depth - 0.3;
    const pos: number[] = [];
    const quad = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    const A1 = [-hw, 0, d0], B1 = [hw, 0, d0], C1 = [hw, rh, (d0 + d1) / 2], D1 = [-hw, rh, (d0 + d1) / 2];
    const A2 = [hw, 0, d1], B2 = [-hw, 0, d1];
    quad(A1, B1, C1, D1);
    quad(A2, B2, D1, C1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const uv: number[] = [];
    for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / 2.2, (pos[i + 1] + Math.abs(pos[i + 2])) / 2.2);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const [X, Y, Z] = P(0, H + 0.15, 0);
    g.applyMatrix4(mtx(X, Y, Z, ry));
    batch.add(M.roof, g);
    for (let c = 0; c < 1 + (w > 7 ? 1 : 0); c++) {
      box(M.brickD, 0.7, 1.6, 0.6, -w / 4 + c * w / 2, H + rh * 0.6, -depth / 2 + 0.8, 1.8);
    }
  }

  // --- вывеска ------------------------------------------------------------
  let signMesh: THREE.Object3D | undefined;
  if (o.sign) {
    const sw = Math.min(w * 0.7, 5);
    const sg = canvasPlane(o.sign, sw, 0.6);
    const [X, Y, Z] = P(0, 3.2, 0.24);
    sg.position.set(X, Y, Z);
    sg.rotation.y = ry;
    sg.castShadow = true;
    signMesh = sg;
  }

  const door = enterable
    ? (() => {
        const [X, , Z] = P(doorX, 0, 0.05);
        return { x: X, z: Z, ry, w: gap, name: o.name };
      })()
    : undefined;

  const interior = enterable
    ? (() => {
        const [cx, , cz] = P(0, 0, -depth / 2);
        return { cx, cz, w: w - 0.9, d: depth - 0.9, floorY, h: intH, ry };
      })()
    : undefined;

  return {
    x: o.x, z: o.z, ry, w, depth,
    rects,
    door,
    interior,
    sign: signMesh,
  };
}

/** Тротуарная плита/мостовая полоса, повторяющая рельеф. */
export function groundStrip(
  x0: number, x1: number, z0: number, z1: number,
  mat: THREE.Material, lift: number, tile: number, seg = 0.6, uvFromWorld = true
): THREE.Mesh {
  const nx = Math.max(1, Math.round((x1 - x0) / seg));
  const nz = Math.max(1, Math.round((z1 - z0) / seg));
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = g.attributes.position;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, groundH(x, z) + lift);
    if (uvFromWorld) uv.setXY(i, x / tile, z / tile);
  }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  if (uvFromWorld === false) worldUV(g, tile);
  return mesh;
}
