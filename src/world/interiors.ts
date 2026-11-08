import * as THREE from 'three';
import { M } from '../render/materials';
import { Batcher, mtx } from './batch';
import { world } from './colliders';
import { PropField } from './props';
import { floorY, FH, SITES, loc, inSite } from '../sim/sites';
import { groundH } from './terrain';

// ============ doors, interactables, room lights, furniture helpers
export interface RoomLight { room: string; x: number; y: number; z: number; color: number; intensity: number; dist: number; on: (t: number, f: any) => boolean; shootable?: boolean; shot?: boolean; }
export const roomLights: RoomLight[] = [];
export interface Door { id: string; pivot: THREE.Group; box: ReturnType<typeof world.add>; open: boolean; target: number; locked: (t: number, f: any) => string | null; x: number; z: number; y: number; label: string; hingeRy: number; }
export const doors: Door[] = [];
const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 0.8 });

/** a real door in a wall gap: leaf swings inward (positive local rotation turns +lx toward -lz = into the building) */
export function makeDoor(scene: THREE.Scene, id: string, site: string, lx: number, lz: number, o: { w?: number; locked?: (t: number, f: any) => string | null; f?: number; red?: boolean; label?: string; tall?: number } = {}): Door {
  const S = SITES[site], c = loc(site, lx, lz); return makeWorldDoor(scene, id, c.x, c.z, S.ry, floorY(site, o.f ?? 0), o);
}
/** a door at world x,z whose gap centre line runs along local +x of yaw ry */
export function makeWorldDoor(scene: THREE.Scene, id: string, cx: number, cz: number, ry: number, y: number, o: { w?: number; locked?: (t: number, f: any) => string | null; red?: boolean; label?: string; tall?: number; mat?: THREE.Material } = {}): Door {
  const w = (o.w ?? 1.3) - 0.06, h = o.tall ?? 2.1, hx = (o.w ?? 1.3) / 2 - 0.03;
  const hinge = { x: cx - hx * Math.cos(ry), z: cz + hx * Math.sin(ry) };
  const pivot = new THREE.Group(); pivot.position.set(hinge.x, y, hinge.z); pivot.rotation.y = ry;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), o.red ? M.RED : o.mat ?? leafMat); leaf.position.set(w / 2, h / 2, 0); leaf.castShadow = true;
  const inner = new THREE.Group(); inner.add(leaf); pivot.add(inner); (pivot as any).inner = inner; scene.add(pivot);
  const box = world.add(cx, cz, w / 2 + 0.03, 0.08, ry, y, y + h, 'door');
  const d: Door = { id, pivot, box, open: false, target: 0, locked: o.locked ?? (() => null), x: cx, z: cz, y, label: o.label ?? 'door', hingeRy: ry }; doors.push(d); return d;
}
export function updateDoors(dt: number) {
  for (const d of doors) { const inner = (d.pivot as any).inner as THREE.Group, tgt = d.open ? 1.75 : 0; inner.rotation.y += (tgt - inner.rotation.y) * Math.min(1, dt * 7); d.box.off = d.open; }
}
export interface Interactable { id: string; x: number; y: number; z: number; r?: number; at?: (c: any) => { x: number; y: number; z: number } | null; label: (c: any) => string | null; use: (c: any) => void; ok?: (c: any) => boolean; }
export const interactables: Interactable[] = [];
export const addInteract = (i: Interactable) => { interactables.push(i); return i; };

class Furn {
  constructor(public site: string, public bt: Batcher, public pf: PropField) {}
  /** local box on storey f; bottom at ly above the floor */
  box(mat: THREE.Material, w: number, h: number, d: number, lx: number, lz: number, f = 0, ly = 0, o: { rot?: number; collide?: boolean; tile?: number; kind?: string } = {}) {
    const S = SITES[this.site], p = loc(this.site, lx, lz), y = floorY(this.site, f) + ly, ry = S.ry + (o.rot ?? 0);
    this.bt.box(mat, w, h, d, mtx(p.x, y + h / 2, p.z, ry), o.tile ?? 1.2);
    if (o.collide !== false) world.add(p.x, p.z, w / 2, d / 2, ry, y, y + h, o.kind ?? 'furn');
    return { x: p.x, y: y + h, z: p.z };
  }
  prop(path: string, lx: number, lz: number, f = 0, o: { rot?: number; h?: number; l?: number; s?: number; collide?: boolean; ly?: number } = {}) {
    const S = SITES[this.site], p = loc(this.site, lx, lz);
    this.pf.add(path, p.x, p.z, { ry: S.ry + (o.rot ?? 0), y: floorY(this.site, f) + (o.ly ?? 0), h: o.h, l: o.l, s: o.s, collide: o.collide ?? true, kind: 'furn' });
  }
  /** straight stair flight along local lz (rising toward -lz) at lx, width w, from lz0 to lz1 (lz1 < lz0), up to storey 1 */
  stairs(lx: number, w: number, lz0: number, lz1: number, f = 0) {
    const n = Math.round(Math.abs(lz1 - lz0) / 0.32), run = Math.abs(lz1 - lz0) / n, rise = FH / n;
    for (let i = 0; i < n; i++) this.box(M.wood, w, rise * (i + 1), run, lx, lz0 - (i + 0.5) * run, f, 0, { kind: 'stair', tile: 1 });
  }
  light(room: string, lx: number, lz: number, f: number, ly: number, color: number, intensity: number, dist: number, on: RoomLight['on'] = () => true, shootable = false) {
    const p = loc(this.site, lx, lz); const L: RoomLight = { room, x: p.x, y: floorY(this.site, f) + ly, z: p.z, color, intensity, dist, on, shootable }; roomLights.push(L); return L;
  }
}
const iron = M.iron, wood = M.wood, dark = M.dark;
const clothMat = new THREE.MeshStandardMaterial({ color: 0x6b6358, roughness: 1 });
const paper = new THREE.MeshStandardMaterial({ color: 0xcfc6ac, roughness: 1 });
const copper = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8, roughness: 0.35 });
export const tableTop = { x: 0, y: 0, z: 0 };
export const world2: Record<string, any> = {};

export function buildInteriors(scene: THREE.Scene, bt: Batcher, pf: PropField) {
  // ---------------- TAVERN "Якорь"
  { const F = new Furn('tavern', bt, pf); const room = 'tavern';
    // stairs up along the south wall, the bar on the back wall
    F.stairs(5.15, 1.1, -1.0, -6.2);
    F.box(wood, 5, 1.1, 0.8, -0.5, -7.0); F.box(M.cornice, 5.1, 0.08, 0.95, -0.5, -7.0, 0, 1.1, { collide: false });
    for (const lx of [-2.2, -0.7, 0.8]) F.prop('dungeon/keg', lx, -8.4, 0, { h: 1.0 });
    F.box(wood, 4.6, 0.78, 1.4, 0.2, -3.6, 0, 0, { tile: 1 }); F.box(new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 1 }), 4.7, 0.03, 1.5, 0.2, -3.6, 0, 0.78, { collide: false });
    const seats = [[-1.5, -2.45, Math.PI], [-0.3, -2.45, Math.PI], [0.9, -2.45, Math.PI], [2.1, -2.45, Math.PI], [-1.5, -4.75, 0], [-0.3, -4.75, 0], [0.9, -4.75, 0], [2.1, -4.75, 0], [-2.8, -3.6, -Math.PI / 2], [3.2, -3.6, Math.PI / 2]];
    for (const [lx, lz, r] of seats) F.prop('dungeon/chair', lx, lz, 0, { h: 0.95, rot: r, collide: false });
    for (const [lx, lz] of [[-4.6, -2.0], [-4.6, -6.0], [3.0, -7.0]]) { F.prop('dungeon/table_small', lx, lz, 0, { h: 0.78 }); F.prop('dungeon/stool', lx + 0.7, lz, 0, { h: 0.5, collide: false }); F.prop('dungeon/stool', lx - 0.7, lz, 0, { h: 0.5, collide: false }); }
    F.prop('interior_q/fireplace', -5.2, -4.6, 0, { l: 2.8, rot: Math.PI / 2 });
    F.light(room, -5.0, -4.6, 0, 1.0, 0xff8a40, 7, 9, () => true);
    for (const [lx, lz, k] of [[-3.2, -3.0, 'a'], [0.2, -3.6, 'b'], [2.4, -6.4, 'c']] as [number, number, string][]) { F.prop('interior_q/light_ceilingsingle', lx, lz, 0, { h: 0.4, ly: 2.35, collide: false }); F.light(room, lx, lz, 0, 2.2, 0xffb070, 8, 10, () => true, true); void k; }
    // upstairs room: bed, chair and the coat with the monogram (the false lead)
    F.prop('interior_q/bed_single', -4.2, -7.0, 1, { l: 2.1 }); F.prop('dungeon/chair', -1.2, -7.8, 1, { h: 0.95, collide: false, rot: Math.PI });
    const coat = F.box(new THREE.MeshStandardMaterial({ color: 0x6e6a60, roughness: 0.9 }), 0.5, 0.75, 0.12, -1.2, -8.1, 1, 0.55, { collide: false }); world2.coat = coat;
    F.light(room, 0.5, -5.5, 1, 2.2, 0xffd9a0, 5, 9);
    // table items: the players' stakes (interactive objects are placed by the game)
    const tp = loc('tavern', 0.2, -3.6); tableTop.x = tp.x; tableTop.z = tp.z; tableTop.y = floorY('tavern') + 0.82;
    for (let i = 0; i < 6; i++) { const q = loc('tavern', -1.2 + i * 0.4, -3.6 + (i % 2 ? 0.3 : -0.3)); bt.box(copper, 0.07, 0.015, 0.07, mtx(q.x, tableTop.y, q.z, 0), 1); }
    // bar items + guest rooms are decor
    const kit = F.box(wood, 1.2, 0.9, 0.7, -4.8, -8.3, 0, 0); void kit;
  }
  // ---------------- ORVEN
  { const F = new Furn('orven', bt, pf);
    F.box(wood, 3.2, 1.05, 0.6, -0.5, -1.7); F.box(iron, 0.6, 0.9, 0.5, -2.0, -3.3); F.box(M.cornice, 0.7, 0.1, 0.5, -2.0, -3.3, 0, 0.9, { collide: false });
    F.box(wood, 4.1, 1.7, 0.06, 0, -3.88, 0, 0.5, { collide: false });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) F.prop('dungeon/key', -1.85 + c * 0.33, -3.84, 0, { s: 0.18, collide: false, ly: 0.75 + r * 0.32 });
    F.prop('interior_q/light_desk', 0.4, -1.7, 0, { h: 0.45, ly: 1.05, collide: false }); F.prop('interior_q/stool', -0.6, -2.5, 0, { h: 0.75, collide: false });
    F.light('orven', 0.4, -1.9, 0, 1.6, 0xffc080, 6, 6, (t) => t < 9 * 60 + 40);
  }
  // ---------------- FOMA (intact interior; the ruined variant lives in ruins.ts)
  // ---------------- CONTORA
  { const F = new Furn('contora', bt, pf);
    F.stairs(4.0, 1.3, -3.8, -7.5);
    F.box(wood, 5.4, 1.05, 0.5, 0.05, -3.2); for (let k = 0; k < 8; k++) F.box(iron, 0.03, 1.1, 0.03, -2.6 + k * 0.62, -3.2, 0, 1.05, { collide: false }); // grille over the counter
    F.box(wood, 2.6, 0.45, 0.5, -3.3, -0.8); F.box(wood, 1.9, 1.2, 0.05, -3.5, -7.7, 0, 0.9, { collide: false });
    for (let k = 0; k < 12; k++) F.box(copper, 0.12, 0.12, 0.02, -4.2 + (k % 6) * 0.3, -7.66, 0, 1.4 + Math.floor(k / 6) * 0.3, { collide: false });
    F.light('contora', -1.0, -4.0, 0, 2.4, 0xffd9a0, 7, 10); F.light('contora', 0.5, -5.0, 1, 2.4, 0xffd9a0, 6, 9);
    F.box(wood, 1.8, 0.78, 0.9, -2.2, -6.2, 1); F.prop('dungeon/chair', -2.2, -7.0, 1, { h: 0.95, rot: Math.PI, collide: false });
    const safe = F.box(iron, 0.9, 1.1, 0.8, -4.2, -7.0, 1); world2.safe = safe;
    F.box(wood, 1.2, 1.9, 0.4, 0.5, -7.7, 1); F.box(wood, 0.7, 1.5, 0.5, 4.2, -7.7, 1);
  }
  // ---------------- PRIYUT
  { const F = new Furn('priyut', bt, pf);
    F.stairs(5.7, 1.3, -2.3, -8.0);
    // partition between the hall and mother Agnia's office (doorway at lz -2.0)
    F.box(M.plaster, 0.25, 3.0, 1.05, -2.5, -0.85, 0, 0); F.box(M.plaster, 0.25, 3.0, 6.0, -2.5, -5.65, 0, 0);
    F.box(wood, 1.8, 0.78, 0.9, -7, -5.2); F.prop('dungeon/chair', -7, -6.1, 0, { h: 0.95, collide: false, rot: Math.PI }); F.box(wood, 2.2, 1.9, 0.45, -10.3, -8.4);
    const book = F.box(new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 }), 0.55, 0.07, 0.4, -7, -5.1, 0, 0.78, { collide: false }); world2.book = book;
    F.light('priyut', -7, -4.5, 0, 2.3, 0xffc890, 6, 8); F.light('priyut', 3.5, -4.0, 0, 2.3, 0xffd0a0, 6, 10);
    for (const lz of [-4.2, -6.5]) F.box(wood, 3.5, 0.45, 0.5, 8.8, lz, 0, 0); // hall benches
    // dormitory (storey 1): 7 bunks = 14 beds, a candle
    for (let k = 0; k < 7; k++) { const lx = k < 4 ? -10.3 + k * 2.2 : -10.3 + (k - 4) * 2.2, lz = k < 4 ? -7.2 : -3.0; F.prop('interior_q/bed_bunk', lx, lz, 1, { l: 2.0, rot: k < 4 ? 0 : Math.PI }); }
    F.light('priyut', -5.5, -5.0, 1, 2.2, 0xffc080, 4, 11); F.light('priyut', 2.5, -4.0, 1, 2.2, 0xffc080, 3.5, 10);
  }
  // ---------------- TIKHON's house
  { const F = new Furn('tikhon', bt, pf);
    F.box(wood, 1.3, 0.76, 0.85, -1.4, -3.4); F.prop('interior_q/stool', -1.4, -2.5, 0, { h: 0.6, collide: false });
    F.box(wood, 1.3, 0.45, 0.7, 1.9, -4.8); F.box(iron, 0.7, 0.9, 0.6, -2.4, -5.3); F.box(wood, 0.6, 1.6, 0.35, 2.5, -1.0);
    F.light('tikhon', -1.2, -3.3, 0, 2.0, 0xffc080, 5, 8);
  }
}
