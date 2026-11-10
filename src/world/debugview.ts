import * as THREE from 'three';
import { world } from './colliders';
// F5: F3 / ?debug=1 draws every collision box as a wireframe (red = walls, yellow = furniture/props, cyan = doors, green = rails)
let grp: THREE.Group | null = null;
export function toggleDebug(scene: THREE.Scene, on?: boolean) {
  if (grp && on !== true) { scene.remove(grp); grp = null; return; } if (grp) return;
  grp = new THREE.Group(); const col: Record<string, number> = { building: 0xff3030, cellar: 0xff3030, rail: 0x40ff60, door: 0x40e0ff, furn: 0xffd040, prop: 0xffd040, solid: 0xff9040, stair: 0xc080ff, deck: 0x8080ff };
  const by = new Map<number, number[]>();
  for (const b of [...world.boxes, ...world.dyn]) { if (b.off || b.y1 - b.y0 > 60 || b.y1 < -30) continue; const c = col[b.kind] ?? 0xffffff, arr = by.get(c) ?? by.set(c, []).get(c)!;
    const pts: number[][] = []; for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const lx = sx * b.hx, lz = sz * b.hz; pts.push([b.cx + lx * b.cos + lz * b.sin, b.cz - lx * b.sin + lz * b.cos]); }
    for (let i = 0; i < 4; i++) { const a = pts[i], n = pts[(i + 1) % 4]; for (const y of [b.y0, b.y1]) arr.push(a[0], y, a[1], n[0], y, n[1]); arr.push(a[0], b.y0, a[1], a[0], b.y1, a[1]); } }
  for (const [c, arr] of by) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); grp.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: c, depthTest: true, fog: false }))); }
  scene.add(grp);
}
