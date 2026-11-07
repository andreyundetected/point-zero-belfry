import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Материалы по рецепту tools/style_test/noir.html: PBR-текстуры города,
// UV от мировых координат, всё статичное сливается по материалу.

const tl = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();

export function loadTexture(path: string, srgb = false): THREE.Texture {
  const key = path + (srgb ? '|s' : '');
  let t = texCache.get(key);
  if (!t) {
    t = tl.load('/' + path.replace(/^\/+/, ''));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, t);
  }
  return t;
}

export function pbr(name: string, o: { rough?: number; tint?: number; nrm?: string; ns?: number } = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: loadTexture(`textures/city/${name}_albedo.png`, true),
    normalMap: loadTexture(`textures/city/${o.nrm ?? name}_normal.png`),
    color: o.tint ?? 0xffffff,
    roughness: o.rough ?? 0.85,
    envMapIntensity: 0.6,
  });
  m.normalScale.set(o.ns ?? 1, o.ns ?? 1);
  return m;
}

export const M = (() => {
  const brick = pbr('brick_red');
  const brickD = pbr('brick_dark');
  const stone = pbr('stone_base');
  const plaster = pbr('plaster');
  const plaster2 = pbr('plaster2', { nrm: 'plaster' });
  const plaster3 = pbr('plaster3', { nrm: 'plaster' });
  const roof = pbr('roof', { rough: 0.6 });
  const wood = pbr('wood', { rough: 0.7 });
  const flags = pbr('flags', { rough: 0.45 });
  const setts = new THREE.MeshStandardMaterial({
    map: loadTexture('textures/city/setts_albedo.png', true),
    normalMap: loadTexture('textures/city/setts_normal.png'),
    roughnessMap: loadTexture('textures/city/setts_rough.png'),
    roughness: 1,
    envMapIntensity: 1.6,
  });
  setts.normalScale.set(1, 1);

  return {
    brick, brickD, stone, plaster, plaster2, plaster3, roof, wood, flags, setts,
    wall: [brick, plaster, brickD, plaster2, plaster3],
    frame: new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.6 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.5, metalness: 0.6 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x05070a, roughness: 0.05, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.4 }),
    lit: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb065).multiplyScalar(0.5) }),
    lit2: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc890).multiplyScalar(0.45) }),
    fire: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff7a22).multiplyScalar(1.6) }),
    cornice: pbr('stone_base', { tint: 0xbbbbbb }),
    dark: new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.9 }),
    RED: new THREE.MeshStandardMaterial({ color: 0xa00a0a, roughness: 0.45, emissive: 0x2a0000 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 1, side: THREE.DoubleSide }),
    paper: new THREE.MeshStandardMaterial({ color: 0xcfc7b4, roughness: 1 }),
    water: new THREE.MeshPhysicalMaterial({
      color: 0x03060a, roughness: 0.06, clearcoat: 1, envMapIntensity: 2,
    }),
  };
})();

// --- world-space UV -------------------------------------------------------
export function worldUV(g: THREE.BufferGeometry, tile: number, ox = 0, oy = 0) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv as THREE.BufferAttribute;
  if (!uv) return g;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ay > 0.5) uv.setXY(i, (x + ox) / tile, (z + oy) / tile);
    else if (ax > 0.5) uv.setXY(i, (z + ox) / tile, (y + oy) / tile);
    else uv.setXY(i, (x + ox) / tile, (y + oy) / tile);
  }
  uv.needsUpdate = true;
  return g;
}

// --- static batching ------------------------------------------------------
export class StaticBatch {
  private map = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(mat: THREE.Material, g: THREE.BufferGeometry) {
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat)!.push(g);
  }

  box(mat: THREE.Material, w: number, h: number, d: number, m4: THREE.Matrix4, tile = 1.8, jitter = true) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.applyMatrix4(m4);
    if (jitter) worldUV(g, tile, (w * 7.13) % 3, (h * 5.31) % 3);
    else worldUV(g, tile, 0, 0);
    this.add(mat, g);
  }

  flush(scene: THREE.Scene) {
    for (const [mat, gs] of this.map) {
      const geos = gs.map((g) => (g.index ? g.toNonIndexed() : g));
      if (!geos.length) continue;
      try {
        const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
        const noShadow = mat === M.lit || mat === M.lit2 || mat === M.fire;
        mesh.castShadow = !noShadow;
        mesh.receiveShadow = !noShadow;
        scene.add(mesh);
      } catch (e) {
        console.warn('batch merge failed', e);
      }
    }
    this.map.clear();
  }
}

const tmp = new THREE.Object3D();
export function mtx(x: number, y: number, z: number, ry = 0) {
  tmp.position.set(x, y, z);
  tmp.rotation.set(0, ry, 0);
  tmp.scale.set(1, 1, 1);
  tmp.updateMatrix();
  return tmp.matrix.clone();
}

/** Текст на канвасе: вывески, номера домов, афиши. */
export function canvasPlane(text: string, w: number, h: number, opts: { bg?: string; fg?: string; border?: string; font?: string } = {}) {
  const c = document.createElement('canvas');
  const px = 256;
  c.width = px;
  c.height = Math.max(32, Math.round((px * h) / w));
  const g = c.getContext('2d')!;
  g.fillStyle = opts.bg ?? '#1a1714';
  g.fillRect(0, 0, c.width, c.height);
  if (opts.border !== 'none') {
    g.strokeStyle = opts.border ?? '#8a7a5a';
    g.lineWidth = 6;
    g.strokeRect(5, 5, c.width - 10, c.height - 10);
  }
  g.fillStyle = opts.fg ?? '#d8c9a0';
  g.font = opts.font ?? `bold ${Math.round(c.height * 0.42)}px Georgia,serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((ln, i) => {
    g.fillText(ln, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * c.height * 0.5, c.width * 0.9);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, transparent: false })
  );
}
