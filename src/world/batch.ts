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
/** Collects static geometry per (material, 48 m chunk) and merges it: one mesh each, so frustum + shadow culling work */
export const CHUNK = 48;
export class Batcher {
  private b = new Map<string, { mat: THREE.Material; gs: THREE.BufferGeometry[] }>(); private ids = new Map<THREE.Material, number>();
  geo(mat: THREE.Material, g: THREE.BufferGeometry) {
    g.computeBoundingBox(); const c = g.boundingBox!.getCenter(new THREE.Vector3()); if (!this.ids.has(mat)) this.ids.set(mat, this.ids.size);
    const key = this.ids.get(mat) + '|' + Math.floor(c.x / CHUNK) + '|' + Math.floor(c.z / CHUNK); (this.b.get(key) ?? this.b.set(key, { mat, gs: [] }).get(key)!).gs.push(g);
  }
  box(mat: THREE.Material, w: number, h: number, d: number, m4: THREE.Matrix4, tile = 1.8) {
    const big = mat === M.plaster || mat === M.plaster2 || mat === M.plaster3; // big patches so the missing-plaster pattern does not tile visibly
    const g = new THREE.BoxGeometry(w, h, d); g.applyMatrix4(m4); worldUV(g, big ? tile * 2.6 : tile, hash(w, d) * 7 + m4.elements[12] * 0.37, hash(h, w) * 5 + m4.elements[14] * 0.21); this.geo(mat, g);
  }
  flush(scene: THREE.Object3D) {
    for (const { mat, gs } of this.b.values()) {
      const m = new THREE.Mesh(mergeGeometries(gs.map(g => g.index ? g.toNonIndexed() : g))!, mat);
      m.castShadow = m.receiveShadow = !(mat === M.lit || mat === M.lit2); scene.add(m);
    }
    this.b.clear();
  }
}
