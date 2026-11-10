import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { A } from '../render/materials';
import { world } from './colliders';
import { groundH } from './terrain';

/** keep pack props out of the red accent: pull albedo toward grey so only real red materials survive the grade */
const seen = new WeakSet<THREE.Material>();
export function desat(m: THREE.Material | THREE.Material[], k = 0.4) {
  for (const mat of Array.isArray(m) ? m : [m]) { if (seen.has(mat)) continue; seen.add(mat); const sm = mat as THREE.MeshStandardMaterial; if (!sm.isMeshStandardMaterial) continue;
    sm.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.299,0.587,0.114))), diffuseColor.rgb, ' + k.toFixed(2) + ');'); }; sm.needsUpdate = true; }
}
const loader = new GLTFLoader(); const cache = new Map<string, Promise<Model>>();
interface Part { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[]; m: THREE.Matrix4; }
export interface Model { parts: Part[]; size: THREE.Vector3; scene: THREE.Group; }
/** loads a glb and normalises its origin to bottom-centre */
export function loadModel(path: string): Promise<Model> {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(A + 'models/' + path + '.glb').then(g => {
    g.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const norm = new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z);
    const parts: Part[] = [];
    g.scene.traverse(o => { const me = o as THREE.Mesh; if (me.isMesh && !(me as THREE.SkinnedMesh).isSkinnedMesh) parts.push({ geo: me.geometry, mat: me.material, m: norm.clone().multiply(me.matrixWorld) }); });
    return { parts, size, scene: g.scene };
  }));
  return cache.get(path)!;
}
export interface PropOpts { ry?: number; h?: number; l?: number; s?: number; y?: number; collide?: boolean; tilt?: number; kind?: string; yOff?: number; }
interface Inst { path: string; x: number; z: number; o: PropOpts; }
export const allFields: PropField[] = [];
export class PropField {
  inst: Inst[] = []; constructor() { allFields.push(this); }
  add(path: string, x: number, z: number, o: PropOpts = {}) { this.inst.push({ path, x, z, o }); }
  async build(scene: THREE.Object3D) {
    const by = new Map<string, Inst[]>(); for (const i of this.inst) (by.get(i.path) ?? by.set(i.path, []).get(i.path)!).push(i);
    await Promise.all([...by].map(async ([path, list]) => {
      let model: Model; try { model = await loadModel(path); } catch (e) { console.warn('prop missing', path); return; }
      const mats: THREE.Matrix4[] = [];
      for (const it of list) {
        const o = it.o, sc = o.s ?? (o.h ? o.h / model.size.y : o.l ? o.l / Math.max(model.size.x, model.size.z) : 1);
        const y = o.y ?? groundH(it.x, it.z), ry = o.ry ?? 0;
        const M4 = new THREE.Matrix4().compose(new THREE.Vector3(it.x, y + (o.yOff ?? 0), it.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.tilt ?? 0, ry, 0, 'YXZ')), new THREE.Vector3(sc, sc, sc));
        mats.push(M4);
        if (o.collide) world.add(it.x, it.z, model.size.x * sc / 2, model.size.z * sc / 2, ry, y, y + model.size.y * sc, o.kind ?? 'prop');
      }
      for (const p of model.parts) {
        desat(p.mat); const im = new THREE.InstancedMesh(p.geo, p.mat, mats.length);
        mats.forEach((m, i) => im.setMatrixAt(i, m.clone().multiply(p.m)));
        im.castShadow = im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
      }
    }));
  }
}
/** clone a single model into the scene (for things that move or are recoloured) */
export async function putModel(scene: THREE.Scene, path: string, x: number, z: number, o: PropOpts = {}) {
  const model = await loadModel(path); const g = new THREE.Group();
  const o3 = model.scene.clone(true); const sc = o.s ?? (o.h ? o.h / model.size.y : o.l ? o.l / Math.max(model.size.x, model.size.z) : 1);
  const box = new THREE.Box3().setFromObject(o3), c = box.getCenter(new THREE.Vector3()); o3.position.set(-c.x, -box.min.y, -c.z); g.add(o3);
  g.scale.setScalar(sc); g.position.set(x, o.y ?? groundH(x, z), z); g.rotation.y = o.ry ?? 0;
  g.traverse(m => { if ((m as THREE.Mesh).isMesh) { m.castShadow = m.receiveShadow = true; desat((m as THREE.Mesh).material); } });
  scene.add(g); return g;
}
