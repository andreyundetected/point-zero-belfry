import * as THREE from 'three';
import { M } from '../render/materials';
import { doors } from './interiors';

// The red accent is only ever a real red material on the thing that matters right now (spec 3.1).
export interface Mark { mesh: THREE.Mesh; normal: THREE.Material; redIf: (g: any) => boolean; visIf?: (g: any) => boolean; }
export const marks: Mark[] = [];
export const addMark = (mesh: THREE.Mesh, redIf: (g: any) => boolean, visIf?: (g: any) => boolean) => { marks.push({ mesh, normal: mesh.material as THREE.Material, redIf, visIf }); return mesh; };
const THREAD_DOOR: Record<string, string[]> = { orven: ['orven.door'], orven_late: ['orven.door'], key: ['orven.door'], tavern: ['tavern.door'], fight: ['tavern.door'], gun: ['foma.door'], safe: ['contora.door'], safe_early: ['contora.door'], anna: ['priyut.door', 'priyut.gate'], wagon: ['priyut.door'], tikhon: ['tikhon.door'] };
const doorMat = new Map<string, THREE.Material>();
export function updateMarks(g: any) {
  for (const k of marks) { const red = k.redIf(g); if (k.mesh.material !== (red ? M.RED : k.normal)) k.mesh.material = red ? M.RED : k.normal; if (k.visIf) k.mesh.visible = k.visIf(g); }
  const want = new Set(THREAD_DOOR[g.s.thread] ?? []);
  for (const d of doors) { const leaf = ((d.pivot as any).inner as THREE.Group).children[0] as THREE.Mesh; if (!doorMat.has(d.id)) doorMat.set(d.id, leaf.material as THREE.Material); const red = want.has(d.id); const target = red ? M.RED : doorMat.get(d.id)!; if (leaf.material !== target) leaf.material = target; }
}
