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
const doorGlow = new Map<string, THREE.Sprite>();
const THREAD_DOOR: Record<string, string[]> = { orven: ['orven.door'], orven_late: ['orven.door'], key: ['orven.door'], tavern: ['tavern.door'], fight: ['tavern.door'], gun: ['foma.door'], safe: ['contora.door'], safe_early: ['contora.door'], anna: ['priyut.door', 'priyut.gate'], wagon: ['priyut.door'], tikhon: ['tikhon.door'] };
const doorMat = new Map<string, THREE.Material>();
export function updateMarks(g: any) {
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 380);
  for (const k of marks) { const red = k.redIf(g); if (k.mesh.material !== (red ? M.RED : k.normal)) k.mesh.material = red ? M.RED : k.normal; if (k.visIf) k.mesh.visible = k.visIf(g);
    if (!k.glow && k.mesh.parent) { k.glow = mkGlow(null, g.scene); }
    if (k.glow) { const on = red && k.mesh.visible && !!k.mesh.parent; k.glow.visible = on; if (on) { k.mesh.getWorldPosition(k.glow.position); k.glow.scale.setScalar(1.3 + 0.4 * pulse); (k.glow.material as THREE.SpriteMaterial).opacity = 0.55 * pulse + 0.2; } } }
  const want = new Set(THREAD_DOOR[g.s.thread] ?? []);
  for (const d of doors) { const leaf = ((d.pivot as any).inner as THREE.Group).children[0] as THREE.Mesh; if (!doorMat.has(d.id)) doorMat.set(d.id, leaf.material as THREE.Material); const red = want.has(d.id); const target = red ? M.RED : doorMat.get(d.id)!; if (leaf.material !== target) leaf.material = target;
    let gl = doorGlow.get(d.id); if (!gl) { gl = mkGlow(null, g.scene); doorGlow.set(d.id, gl); } gl.visible = red; if (red) { gl.position.set(d.x, d.y + 1.3, d.z); gl.scale.set(3.2, 3.6, 1); (gl.material as THREE.SpriteMaterial).opacity = 0.35 * pulse + 0.12; } }
}
