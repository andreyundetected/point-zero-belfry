import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const ASSET_BASE = '/assets/';
const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
let loaded = 0, requested = 0;
export const progress = () => (requested ? loaded / requested : 1);

/** Загрузка GLB из assets/models/<path>.glb (кешируется). */
export function loadModel(p: string): Promise<GLTF> {
  let c = cache.get(p);
  if (!c) {
    requested++;
    c = loader.loadAsync(`${ASSET_BASE}models/${p}.glb`).then((g) => {
      loaded++;
      g.scene.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (mesh.isMesh) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            const s = mat as THREE.MeshStandardMaterial;
            if (s.isMeshStandardMaterial) { s.roughness = Math.min(1, s.roughness * 0.9); s.envMapIntensity = 1.0; }
          }
        }
      });
      return g;
    });
    cache.set(p, c);
  }
  return c;
}

export interface Place { x?: number; y?: number; z?: number; ry?: number; s?: number; sx?: number; sy?: number; sz?: number; rx?: number; rz?: number }

export function applyPlace(o: THREE.Object3D, p: Place) {
  o.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  o.rotation.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0);
  const s = p.s ?? 1;
  o.scale.set(p.sx ?? s, p.sy ?? s, p.sz ?? s);
}

export interface Spawned { obj: THREE.Object3D; animations: THREE.AnimationClip[] }

/** Клон модели (SkeletonUtils — для скинированных). */
export async function spawn(p: string, place: Place = {}, shadows = true): Promise<Spawned> {
  const g = await loadModel(p);
  const obj = SkeletonUtils.clone(g.scene);
  applyPlace(obj, place);
  obj.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = shadows; mesh.receiveShadow = shadows; }
  });
  return { obj, animations: g.animations };
}

/** Пакетная расстановка статики: один InstancedMesh на (модель, часть). */
export class StaticBatcher {
  private groups = new Map<string, { path: string; mats: THREE.Matrix4[] }>();
  add(path: string, place: Place) {
    const o = new THREE.Object3D(); applyPlace(o, place); o.updateMatrix();
    let g = this.groups.get(path);
    if (!g) { g = { path, mats: [] }; this.groups.set(path, g); }
    g.mats.push(o.matrix.clone());
  }
  get count() { let n = 0; for (const g of this.groups.values()) n += g.mats.length; return n; }
  async flush(parent: THREE.Object3D, tint?: (path: string, i: number) => THREE.Color | null): Promise<THREE.InstancedMesh[]> {
    const out: THREE.InstancedMesh[] = [];
    await Promise.all([...this.groups.values()].map(async (grp) => {
      const gltf = await loadModel(grp.path);
      gltf.scene.updateMatrixWorld(true);
      const rootInv = new THREE.Matrix4().copy(gltf.scene.matrixWorld).invert();
      gltf.scene.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        const local = new THREE.Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld);
        const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, grp.mats.length);
        const m = new THREE.Matrix4();
        grp.mats.forEach((pm, i) => {
          m.multiplyMatrices(pm, local);
          im.setMatrixAt(i, m);
          const c = tint?.(grp.path, i);
          if (c) im.setColorAt(i, c);
        });
        im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true;
        im.frustumCulled = false;
        parent.add(im); out.push(im);
      });
    }));
    this.groups.clear();
    return out;
  }
}

const texLoader = new THREE.TextureLoader();
export function loadTexture(name: string, opts: { repeat?: [number, number]; srgb?: boolean; wrap?: boolean } = {}): THREE.Texture {
  const t = texLoader.load(`${ASSET_BASE}textures/procedural/${name}`);
  if (opts.wrap !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  if (opts.srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export function loadPNG(path: string, srgb = true): THREE.Texture {
  const t = texLoader.load(`${ASSET_BASE}${path}`);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
