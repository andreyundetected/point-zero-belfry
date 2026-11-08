import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M } from '../render/materials';
import { hash } from './terrain';

// World-space UVs so brick/stone scale is identical on every house.
export function worldUV(g: THREE.BufferGeometry, tile: number, ox = 0, oy = 0) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ay > 0.5) uv.setXY(i, (x + ox) / tile, (z + oy) / tile);
    else if (ax > 0.5) uv.setXY(i, (z + ox) / tile, (y + oy) / tile);
    else uv.setXY(i, (x + ox) / tile, (y + oy) / tile);
  }
  uv.needsUpdate = true; return g;
}
const tmp = new THREE.Object3D();
export function mtx(x: number, y: number, z: number, ry = 0) {
  tmp.position.set(x, y, z); tmp.rotation.set(0, ry, 0); tmp.updateMatrix(); return tmp.matrix.clone();
}
/** Collects static geometry per material and merges it into one mesh per material. */
export class Batcher {
  private b = new Map<THREE.Material, THREE.BufferGeometry[]>();
  geo(mat: THREE.Material, g: THREE.BufferGeometry) { (this.b.get(mat) ?? this.b.set(mat, []).get(mat)!).push(g); }
  box(mat: THREE.Material, w: number, h: number, d: number, m4: THREE.Matrix4, tile = 1.8) {
    const g = new THREE.BoxGeometry(w, h, d); g.applyMatrix4(m4); worldUV(g, tile, hash(w, d) * 7, hash(h, w) * 5); this.geo(mat, g);
  }
  flush(scene: THREE.Scene) {
    for (const [mat, gs] of this.b) {
      const m = new THREE.Mesh(mergeGeometries(gs.map(g => g.index ? g.toNonIndexed() : g))!, mat);
      m.castShadow = m.receiveShadow = !(mat === M.lit || mat === M.lit2); scene.add(m);
    }
    this.b.clear();
  }
}
