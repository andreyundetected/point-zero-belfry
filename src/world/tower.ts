import * as THREE from 'three';
import { M } from '../render/materials';
import { Batcher, mtx } from './batch';
import { world } from './colliders';
import { PropField, putModel } from './props';
import { groundH } from './terrain';
import { BASEMENT_Y, ROOF, ROOF_Y } from '../sim/npcs';
import { roomLights } from './interiors';

// The bell tower: roof platform (28 m), 4 clock faces showing game time, cellar with the substation.
export const clockFaces: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture }[] = [];
export const TOWER = { hatch: { x: -70, z: -55.4 }, foot: { x: -70, z: -52.7 }, cellarDoor: { x: -64.6, z: -58 }, cellarIn: { x: -67.1, z: -56.2 }, fuse: { x: -68.2, z: -61.1 }, roofSpawn: { x: -70, z: -56.6 } };
export const world3: Record<string, any> = {};

export function buildTower(scene: THREE.Scene, bt: Batcher, pf: PropField) {
  const y = ROOF_Y() - 0.6, R = ROOF; // y = roof surface (the building's own collider top is base+H+0.2)
  const roofTop = y; void roofTop;
  const top = ROOF_Y();               // standing height on the roof
  // parapet all around (visual 1.25, collider 1.45) with a break nowhere: the hatch is a frame in the floor
  const wall = (x0: number, z0: number, x1: number, z1: number) => { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.abs(x1 - x0) + 0.5, d = Math.abs(z1 - z0) + 0.5;
    bt.box(M.stone, w, 1.25, d, mtx(cx, top + 0.625, cz, 0), 1.4); bt.box(M.cornice, w + 0.1, 0.12, d + 0.1, mtx(cx, top + 1.3, cz, 0), 1.2); world.add(cx, cz, w / 2, d / 2, 0, top - 0.2, top + 1.5, 'rail'); };
  wall(R.x0 + 0.25, R.z0 + 0.25, R.x1 - 0.25, R.z0 + 0.25); wall(R.x0 + 0.25, R.z1 - 0.25, R.x1 - 0.25, R.z1 - 0.25); wall(R.x0 + 0.25, R.z0 + 0.25, R.x0 + 0.25, R.z1 - 0.25); wall(R.x1 - 0.25, R.z0 + 0.25, R.x1 - 0.25, R.z1 - 0.25);
  // hatch frame in the floor, bell house, mechanism hut, tool chest, bench, lamp
  bt.box(M.wood, 1.5, 0.22, 1.5, mtx(TOWER.hatch.x, top + 0.11, TOWER.hatch.z - 0.5, 0), 1); world.add(TOWER.hatch.x, TOWER.hatch.z - 0.5, 0.75, 0.75, 0, top, top + 0.22, 'furn');
  for (const [dx, dz] of [[-1.1, -1.0], [1.1, -1.0], [-1.1, 1.0], [1.1, 1.0]]) { bt.box(M.wood, 0.2, 2.6, 0.2, mtx(-67.9 + dx, top + 1.3, -59.7 + dz, 0), 1); world.add(-67.9 + dx, -59.7 + dz, 0.1, 0.1, 0, top, top + 2.6, 'furn'); }
  bt.box(M.roof, 3.0, 0.2, 2.8, mtx(-67.9, top + 2.7, -59.7, 0), 2);
  bt.box(M.brickD, 2.6, 2.4, 2.4, mtx(-72.5, top + 1.2, -60.4, 0), 1.8); world.add(-72.5, -60.4, 1.3, 1.2, 0, top, top + 2.4, 'furn');
  bt.box(M.wood, 1.0, 0.7, 0.6, mtx(-72.3, top + 0.35, -57.5, 0), 1); world.add(-72.3, -57.5, 0.5, 0.3, 0, top, top + 0.7, 'furn');
  bt.box(M.wood, 1.9, 0.45, 0.5, mtx(-72.9, top + 0.22, -55.2, 0), 1); world.add(-72.9, -55.2, 0.95, 0.25, 0, top, top + 0.45, 'furn');
  roomLights.push({ room: 'roof', x: -71.2, y: top + 1.6, z: -57.6, color: 0xffb070, intensity: 14, dist: 16, on: () => true }); roomLights.push({ room: 'roof', x: -69.6, y: top + 2.2, z: -58.5, color: 0xa8b8d8, intensity: 5, dist: 14, on: () => true });
  pf.add('village_q/bell', -67.9, -59.7, { y: top + 0.9, h: 1.3, collide: false });
  // clock faces: 4 canvas dials, hands follow game time
  const faces: [number, number, number][] = [[-70, -53.93, 0], [-70, -62.07, Math.PI], [-74.07, -58, -Math.PI / 2], [-65.93, -58, Math.PI / 2]];
  const base = groundH(-70, -54) - 0.3, fy = base + 27.5 - 4.2;
  for (const [x, z, ry] of faces) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d')!; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), new THREE.MeshBasicMaterial({ map: tex })); m.position.set(x, fy, z); m.rotation.y = ry; scene.add(m); clockFaces.push({ ctx, tex });
  }
  setClock(0);
  // cellar under the tower: floor at BASEMENT_Y, 7.4 x 7.4, ceiling 3.1 above
  const by = BASEMENT_Y(), cw = (x0: number, z0: number, w: number, d: number, h: number, y0: number, mat: THREE.Material = M.stone) => { const cx = x0 + w / 2, cz = z0 + d / 2; bt.box(mat, w, h, d, mtx(cx, y0 + h / 2, cz, 0), 1.6); world.add(cx, cz, w / 2, d / 2, 0, y0, y0 + h, 'cellar'); };
  cw(-74.2, -62.2, 8.4, 0.5, 3.4, by - 0.1); cw(-74.2, -54.3, 8.4, 0.5, 3.4, by - 0.1); cw(-74.2, -62.2, 0.5, 8.4, 3.4, by - 0.1); cw(-66.3, -62.2, 0.5, 8.4, 3.4, by - 0.1);
  cw(-74.2, -62.2, 8.4, 8.4, 0.5, by - 0.6, M.dark); cw(-74.2, -62.2, 8.4, 8.4, 0.4, by + 3.0, M.dark);
  // substation cabinet, the tap box with the red fuse, cable, technician's suitcase
  bt.box(M.iron, 2.0, 2.2, 0.5, mtx(-70.5, by + 1.1, -61.7, 0), 1); world.add(-70.5, -61.7, 1.0, 0.25, 0, by, by + 2.2, 'cellar');
  for (let k = 0; k < 5; k++) bt.box(M.dark, 0.18, 0.5, 0.06, mtx(-71.1 + k * 0.3, by + 1.4, -61.4, 0), 1);
  bt.box(M.frame, 0.7, 0.5, 0.35, mtx(TOWER.fuse.x, by + 0.9, TOWER.fuse.z, 0), 1); world.add(TOWER.fuse.x, TOWER.fuse.z, 0.35, 0.18, 0, by, by + 1.15, 'cellar');
  bt.box(M.iron, 0.07, 3.0, 0.07, mtx(-68.2, by + 1.5, -61.95, 0), 1);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 10), M.RED); fuse.rotation.z = Math.PI / 2; fuse.position.set(TOWER.fuse.x, by + 0.95, TOWER.fuse.z + 0.22); scene.add(fuse); world3.fuse = fuse;
  bt.box(new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.6 }), 0.5, 0.3, 0.3, mtx(-72.2, by + 0.15, -59.4, 0), 1); world3.suitcase = { x: -72.2, y: by + 0.3, z: -59.4 };
  // sign "Подстанция №3"
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d')!; g.fillStyle = '#1a1a18'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#c8b890'; g.font = 'bold 24px serif'; g.textAlign = 'center'; g.fillText('ПОДСТАНЦИЯ №3', 128, 40);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })); sg.position.set(-70.5, by + 2.45, -61.42); scene.add(sg);
  roomLights.push({ room: 'cellar', x: -70, y: by + 2.6, z: -58, color: 0xffb870, intensity: 7, dist: 11, on: () => true });
  // stair up (marker only; teleport happens through the interaction)
  for (let i = 0; i < 6; i++) { bt.box(M.wood, 1.3, 0.2 * (i + 1), 0.3, mtx(TOWER.cellarIn.x, by + 0.1 * (i + 1), -56.8 + 0.3 * i, 0), 1); world.add(TOWER.cellarIn.x, -56.8 + 0.3 * i, 0.65, 0.15, 0, by, by + 0.2 * (i + 1), 'cellar'); }
  // lantern prop near the chest
  void putModel;
}
/** draw the hands: 22:00 -> hour hand at 10, minute hand follows game time */
export function setClock(t: number) {
  const min = (t / 60) % 60, hr = (10 + t / 3600) % 12;
  for (const f of clockFaces) {
    const g = f.ctx; g.fillStyle = '#d9cfae'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#1b1814'; g.beginPath(); g.arc(128, 128, 122, 0, 7); g.fill(); g.fillStyle = '#d9cfae'; g.beginPath(); g.arc(128, 128, 116, 0, 7); g.fill();
    g.fillStyle = '#1b1814'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.save(); g.translate(128 + Math.sin(a) * 102, 128 - Math.cos(a) * 102); g.rotate(a); g.fillRect(-3, -9, 6, 18); g.restore(); }
    const hand = (a: number, l: number, w: number) => { g.strokeStyle = '#1b1814'; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l); g.stroke(); };
    hand(hr / 12 * Math.PI * 2, 62, 9); hand(min / 60 * Math.PI * 2, 94, 6); f.tex.needsUpdate = true;
  }
}
