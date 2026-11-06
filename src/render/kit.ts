import * as THREE from 'three';
import { StaticBatcher, spawn, loadModel, Place } from './assets';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const W = 1.4;           // модуль Kenney town_kit → метры
export const HEX = 2.3;         // hex-здания
export const ROW = W;           // высота ряда стены
export const STOREY = 2 * W;    // этаж = 2 ряда (2.8 м)

export interface Box { x0: number; z0: number; x1: number; z1: number; y0?: number; y1?: number }
export interface Collider extends Box { door?: boolean }
export interface Ctx {
  scene: THREE.Scene; batcher: StaticBatcher; colliders: Collider[];
  pending: Promise<unknown>[];
  /** обычный (не инстансный) объект: нужен для прозрачнеющих оболочек и интерактива */
  real(path: string, p: Place, parent?: THREE.Object3D, shadows?: boolean): Promise<THREE.Object3D>;
}

export function makeCtx(scene: THREE.Scene): Ctx {
  const ctx: Ctx = {
    scene, batcher: new StaticBatcher(), colliders: [], pending: [],
    real(path, p, parent = scene, shadows = true) {
      const pr = spawn(path, p, shadows).then((s) => { parent.add(s.obj); return s.obj; });
      ctx.pending.push(pr); return pr;
    },
  };
  return ctx;
}

const outward = (nx: number, nz: number) => Math.atan2(-nz, nx);

export interface HouseOpts {
  cx: number; cz: number; w: number; d: number;       // размеры в МОДУЛЯХ
  floors: number; ry?: number;                         // фасад-«перед» направлен на +z (юг) при ry=0
  wall: 'stone' | 'wood' | 'mixed'; roof: 'gable' | 'high' | 'flat' | 'point';
  win?: 'glass' | 'shutters' | 'round' | 'small'; door?: number; doorSide?: 'N' | 'S' | 'E' | 'W';
  chimney?: boolean; tint?: number; roofColor?: number; enterable?: boolean; overhang?: boolean; arch?: boolean; banner?: 'red' | 'green';
  rowsFirst?: number; extra?: { side: 'N' | 'S' | 'E' | 'W'; i: number }[];
}
export interface WinSpot { x: number; y: number; z: number; nx: number; nz: number }
export interface House { group: THREE.Group; shell: THREE.Group; winSpots: WinSpot[]; door: { x: number; z: number; nx: number; nz: number } | null; bounds: Box; height: number }

const wallName = (mat: 'stone' | 'wood', kind: string) => `town_kit/${mat === 'wood' ? 'wall_wood' : 'wall'}${kind ? '_' + kind : ''}`;

/** Собирает здание из модулей town_kit по периметру; крыша — код (призма). Возвращает группу, которую можно прозрачнить. */
export function house(ctx: Ctx, o: HouseOpts): House {
  const group = new THREE.Group(); const shell = new THREE.Group();
  group.add(shell); ctx.scene.add(group);
  const rot = o.ry ?? 0;
  group.position.set(o.cx, 0, o.cz); group.rotation.y = rot; group.scale.setScalar(W);
  const w = o.w, d = o.d, rows = o.floors * 2;
  const hw = w / 2, hd = d / 2;
  const sides: { n: [number, number]; len: number; side: 'N' | 'S' | 'E' | 'W' }[] = [
    { n: [0, 1], len: w, side: 'S' }, { n: [0, -1], len: w, side: 'N' }, { n: [1, 0], len: d, side: 'E' }, { n: [-1, 0], len: d, side: 'W' },
  ];
  const doorSide = o.doorSide ?? 'S';
  let doorInfo: House['door'] = null;
  const mixed = o.wall === 'mixed';
  const winKind = o.win ?? 'glass';
  const mats: THREE.Material[] = [];
  const local: Promise<unknown>[] = [];
  const winSpots: WinSpot[] = [];
  for (const sd of sides) {
    const [nx, nz] = sd.n;
    for (let i = 0; i < sd.len; i++) {
      // позиция модуля вдоль стороны (локально, в модулях)
      const t = -sd.len / 2 + i + 0.5;
      const px = nz !== 0 ? t : nx * hw, pz = nz !== 0 ? nz * hd : t;
      const isDoor = (sd.side === doorSide && i === (o.door ?? Math.floor(sd.len / 2))) || !!o.extra?.some((e) => e.side === sd.side && e.i === i);
      const isMainDoor = sd.side === doorSide && i === (o.door ?? Math.floor(sd.len / 2));
      for (let r = 0; r < rows; r++) {
        const mat: 'stone' | 'wood' = o.wall === 'stone' ? 'stone' : o.wall === 'wood' ? 'wood' : (r < 2 ? 'stone' : 'wood');
        let kind = '';
        let sy = 1, y = r;
        if (isDoor && r === 0) { kind = 'door'; sy = 1.5; }
        else if (isDoor && r === 1) { kind = ''; sy = 0.5; y = 1.5; }
        else if (r === 0 && o.arch && i % 3 === 1) kind = 'arch_top';
        else {
          const wi = (i % 2 === 1) && ((r % 2 === 0 && o.floors === 1) || r % 2 === 1 || (r === 0 && o.floors > 1 && i % 4 === 1));
          const edge = i === 0 || i === sd.len - 1;
          if (wi && !edge && !(r === 0 && o.floors > 1 && sd.side !== 'S' && sd.side !== 'N')) kind = `window_${winKind}`;
        }
        if (kind.startsWith('window_')) winSpots.push({ x: px, y: y + 0.5, z: pz, nx, nz });
        const place: Place = { x: px, y: y * 1, z: pz, ry: outward(nx, nz), sy };
        const name = kind === 'arch_top' ? wallName(mat, 'arch_top') : wallName(mat, kind);
        const target = (o.enterable && (r >= 1 || isDoor || true)) ? true : false;
        if (target) {
          const pr = spawn(name, { ...place }, true).then((s) => {
            s.obj.traverse((m) => { const mesh = m as THREE.Mesh; if (mesh.isMesh) { mesh.material = (mesh.material as THREE.Material).clone(); mats.push(mesh.material as THREE.Material); if (o.tint) { (mesh.material as THREE.MeshStandardMaterial).color.multiply(new THREE.Color(o.tint)); } } });
            s.obj.userData.normal = [nx, nz];
            shell.add(s.obj);
          });
          ctx.pending.push(pr); local.push(pr);
        } else {
          // инстансно — в мировых координатах
          const c = Math.cos(rot), s = Math.sin(rot);
          const wx = o.cx + (px * c + pz * s) * W, wz = o.cz + (-px * s + pz * c) * W;
          ctx.batcher.add(name, { x: wx, y: y * W, z: wz, ry: outward(nx, nz) + rot, sy: sy * W, sx: W, sz: W });
        }
      }
      // коллайдер по модулю (кроме двери)
      const c = Math.cos(rot), s = Math.sin(rot);
      const wx = o.cx + (px * c + pz * s) * W, wz = o.cz + (-px * s + pz * c) * W;
      if (isDoor) {
        if (!isMainDoor) continue;
        const dn = [nx * c + nz * s, -nx * s + nz * c];
        doorInfo = { x: wx, z: wz, nx: dn[0], nz: dn[1] };
      } else {
        const hx = (nz !== 0 ? 0.5 * W : 0.12 * W), hz = (nz !== 0 ? 0.12 * W : 0.5 * W);
        const ex = Math.abs(c) > 0.7 ? [hx, hz] : [hz, hx];
        ctx.colliders.push({ x0: wx - ex[0], z0: wz - ex[1], x1: wx + ex[0], z1: wz + ex[1] });
      }
    }
  }
  // крыша (код): призма вдоль длинной стороны
  const topY = rows * ROW / W; // в модулях
  const roofMat = new THREE.MeshStandardMaterial({ color: o.roofColor ?? 0x5b2f2a, roughness: 0.7, envMapIntensity: 1.2 });
  const roof = new THREE.Group(); roof.position.y = topY;
  const ridgeAlongX = w >= d;
  const L = (ridgeAlongX ? w : d) + 0.5, B = (ridgeAlongX ? d : w) + 0.7;
  const hgt = o.roof === 'flat' ? 0.15 : o.roof === 'high' ? 1.1 : o.roof === 'point' ? 0.9 : 0.75;
  if (o.roof === 'flat') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.15, d + 0.4), roofMat); m.position.y = 0.07; roof.add(m);
  } else if (o.roof === 'point') {
    const m = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, hgt * 1.6, 4), roofMat); m.rotation.y = Math.PI / 4; m.position.y = hgt * 0.8; roof.add(m);
  } else {
    const sh = new THREE.Shape(); sh.moveTo(-B / 2, 0); sh.lineTo(B / 2, 0); sh.lineTo(0, hgt); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false }); g.translate(0, 0, -L / 2);
    const m = new THREE.Mesh(g, roofMat); m.castShadow = true; m.receiveShadow = true;
    if (ridgeAlongX) m.rotation.y = Math.PI / 2; roof.add(m);
  }
  roof.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  roof.userData.isRoof = true; shell.add(roof); mats.push(roofMat);
  if (o.chimney) { ctx.pending.push(spawn('town_kit/chimney', { x: hw * 0.5, y: topY + 0.2, z: 0, sx: 1, sy: 1.4, sz: 1 }).then((s) => { s.obj.userData.isRoof = true; shell.add(s.obj); })); }
  if (o.enterable) ctx.pending.push(Promise.all(local).then(() => mergeShell(shell)));
  const ang = rot; const bounds: Box = { x0: o.cx - (Math.abs(Math.cos(ang)) > 0.7 ? hw : hd) * W, z0: o.cz - (Math.abs(Math.cos(ang)) > 0.7 ? hd : hw) * W, x1: o.cx + (Math.abs(Math.cos(ang)) > 0.7 ? hw : hd) * W, z1: o.cz + (Math.abs(Math.cos(ang)) > 0.7 ? hd : hw) * W };
  const handle = { group, shell, winSpots, door: doorInfo, bounds, height: rows * ROW, mats } as House & { mats: THREE.Material[] };
  return handle;
}

/** Плавное исчезновение оболочки (крыша и стены, повёрнутые к камере). */
export function fadeShell(h: House & { mats?: THREE.Material[] }, target: number, camDirX: number, camDirZ: number, dt: number) {
  const k = Math.min(1, dt / 0.25);
  h.shell.traverse((o) => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.Material & { opacity: number; transparent: boolean };
    let want = 1;
    if (target < 1) {
      // крыша и стены, смотрящие на камеру (по нормали), растворяются
      let p: THREE.Object3D | null = mesh; let roof = false; let n: number[] | undefined;
      while (p && p !== h.shell) { if (p.userData.isRoof) roof = true; if (p.userData.normal) n = p.userData.normal; p = p.parent; }
      if (roof) want = 0; else if (n && (n[0] * camDirX + n[1] * camDirZ) > 0.15) want = 0.0;
    }
    if (Math.abs(mat.opacity - want) > 0.01) { mat.opacity += (want - mat.opacity) * k; mat.transparent = mat.opacity < 0.99; mat.depthWrite = mat.opacity > 0.5; mesh.castShadow = mat.opacity > 0.5; mesh.visible = mat.opacity > 0.03; }
    else { mat.opacity = want; mat.transparent = want < 0.99; mesh.visible = want > 0.03; }
  });
}
export { loadModel };

/** Склеивает кусочки стен оболочки по (сторона, материал): сотни мешей → десятки draw calls. */
function mergeShell(shell: THREE.Group) {
  shell.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(shell.matrixWorld).invert();
  const groups = new Map<string, { geoms: THREE.BufferGeometry[]; mat: THREE.MeshStandardMaterial; normal: number[] }>();
  const remove: THREE.Object3D[] = [];
  for (const child of [...shell.children]) {
    const normal = child.userData.normal as number[] | undefined; if (!normal) continue;
    child.updateMatrixWorld(true);
    child.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      let g = m.geometry.clone(); if (g.index) g = g.toNonIndexed();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) return;
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const mat = m.material as THREE.MeshStandardMaterial; const key = `${normal.join(',')}|${mat.map?.uuid}|${mat.color.getHex()}|${mat.roughness}`;
      let grp = groups.get(key); if (!grp) { grp = { geoms: [], mat, normal }; groups.set(key, grp); }
      grp.geoms.push(g);
    });
    remove.push(child);
  }
  for (const c of remove) shell.remove(c);
  for (const grp of groups.values()) {
    const geo = mergeGeometries(grp.geoms, false); if (!geo) continue;
    const mesh = new THREE.Mesh(geo, grp.mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.normal = grp.normal; shell.add(mesh);
  }
}
