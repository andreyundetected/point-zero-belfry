import * as THREE from 'three';
import { M } from '../render/materials';
import { doors } from './interiors';
import { A } from '../render/materials';

const haloTex = new THREE.TextureLoader().load(A + 'textures/procedural/lamp_halo.png');
const mkGlow = (parent: THREE.Object3D | null, scene?: THREE.Scene) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xff2a18, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0 })); sp.visible = false; sp.renderOrder = 5; if (parent) parent.add(sp); else scene?.add(sp); return sp; };

// The red accent is only ever a real red material on the thing that matters right now (spec 3.1).
export interface Mark { glow?: THREE.Sprite; mesh: THREE.Mesh; normal: THREE.Material; redIf: (g: any) => boolean; visIf?: (g: any) => boolean; }
export const marks: Mark[] = [];
export const addMark = (mesh: THREE.Mesh, redIf: (g: any) => boolean, visIf?: (g: any) => boolean) => { marks.push({ mesh, normal: mesh.material as THREE.Material, redIf, visIf }); return mesh; };
const doorGlow = new Map<string, THREE.Sprite>(); const doorLine = new Map<string, THREE.Line>();
const THREAD_DOOR: Record<string, string[]> = { orven: ['orven.door'], orven_late: ['orven.door'], key: ['orven.door'], tavern: ['tavern.door'], fight: ['tavern.door'], gun: ['foma.door'], ned: [], safe: ['contora.door'], safe_early: ['contora.door'], anna: ['priyut.door', 'priyut.gate'], wagon: ['priyut.door'], tikhon: ['tikhon.door'] };
export function updateMarks(g: any) {
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 380);
  for (const k of marks) { const red = k.redIf(g); if (k.mesh.material !== (red ? M.RED : k.normal)) k.mesh.material = red ? M.RED : k.normal; if (k.visIf) k.mesh.visible = k.visIf(g);
    if (!k.glow && k.mesh.parent) { k.glow = mkGlow(null, g.scene); }
    if (k.glow) { const on = red && k.mesh.visible && !!k.mesh.parent; k.glow.visible = on; if (on) { k.mesh.getWorldPosition(k.glow.position); k.glow.scale.setScalar(1.3 + 0.4 * pulse); (k.glow.material as THREE.SpriteMaterial).opacity = 0.55 * pulse + 0.2; } } }
  // D1: a door in the thread is not repainted: a thin red contour around the doorway pulses (2 s period) while it is in the thread
  const want = new Set(THREAD_DOOR[g.s.thread] ?? []); const p2 = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * Math.PI);
  for (const d of doors) {
    let o = doorLine.get(d.id);
    if (!o) { const w = 1.36, h = 2.2, pts = [-w / 2, 0, w / 2, 0, w / 2, h, -w / 2, h].map(v => v); const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(pts[0], pts[1], 0), new THREE.Vector3(pts[2], pts[3], 0), new THREE.Vector3(pts[4], pts[5], 0), new THREE.Vector3(pts[6], pts[7], 0), new THREE.Vector3(pts[0], pts[1], 0)]);
      o = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff2a18, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); o.position.set(d.x + Math.sin(d.hingeRy) * 0.12, d.y + 0.02, d.z + Math.cos(d.hingeRy) * 0.12); o.rotation.y = d.hingeRy; g.scene.add(o); doorLine.set(d.id, o);
      const gl2 = mkGlow(null, g.scene); gl2.position.set(o.position.x, d.y + 1.1, o.position.z); gl2.scale.set(2.2, 2.8, 1); doorGlow.set(d.id, gl2); }
    const on = want.has(d.id) && !d.open; o.visible = on; (o.material as THREE.LineBasicMaterial).opacity = 0.35 + 0.65 * p2; const gl2 = doorGlow.get(d.id)!; gl2.visible = on; (gl2.material as THREE.SpriteMaterial).opacity = 0.12 + 0.18 * p2;
  }
  // D4: Ned glows faintly while the thread is about him and he is on the bridge
  { let gl3 = doorGlow.get('#ned'); if (!gl3) { gl3 = mkGlow(null, g.scene); doorGlow.set('#ned', gl3); } const nd = g.npcs.pose('ned'); const on = (g.s.thread === 'ned') && nd && !nd.hidden && nd.a === 'rail';
    gl3.visible = !!on; if (on && nd) { gl3.position.set(nd.x, nd.y + 1.1, nd.z); gl3.scale.set(1.6, 2.4, 1); (gl3.material as THREE.SpriteMaterial).opacity = 0.15 + 0.2 * p2; } }
}
