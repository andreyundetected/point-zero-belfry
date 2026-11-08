import * as THREE from 'three';
import { M } from '../render/materials';
import { Batcher, mtx } from './batch';
import { world } from './colliders';
import { PropField, putModel } from './props';
import { groundH } from './terrain';
import { BASEMENT_Y, ROOF_Y } from '../sim/npcs';
import { roomLights } from './interiors';

// The bell tower: roof platform (28 m), 4 clock faces showing game time, cellar with the substation.
export const clockFaces: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture }[] = [];
export const TOWER = { hatch: { x: -70, z: -54.6 }, foot: { x: -70, z: -52.7 }, cellarDoor: { x: -64.6, z: -58 }, cellarIn: { x: -67.1, z: -56.2 }, fuse: { x: -68.2, z: -61.1 }, roofSpawn: { x: -70, z: -56.3 } };
export const world3: Record<string, any> = {};

const OCT = 7.7; // half-width of the two squares whose union is the octagonal observation deck
export const tesla: { arcs: THREE.Line[]; gears: THREE.Object3D[]; glow?: THREE.Sprite; light?: ReturnType<() => any>; top: number; toroid?: THREE.Vector3; rods: THREE.Vector3[]; t: number } = { arcs: [], gears: [], top: 0, rods: [], t: 0 };
export function buildTower(scene: THREE.Scene, bt: Batcher, pf: PropField) {
  const top = ROOF_Y(); tesla.top = top; const cx = -70, cz = -58;
  const copper = new THREE.MeshStandardMaterial({ color: 0xb8733a, metalness: 0.95, roughness: 0.28 }), brass = new THREE.MeshStandardMaterial({ color: 0x9a7a3a, metalness: 0.95, roughness: 0.3 }), ins = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.4, metalness: 0.2 });
  // ---- the deck: octagon on a stone corbel, wider than the tower body so the apparatus has room
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(OCT / Math.cos(Math.PI / 8), OCT / Math.cos(Math.PI / 8), 0.5, 8), M.setts); deck.rotation.y = Math.PI / 8; deck.position.set(cx, top - 0.25, cz); deck.receiveShadow = true; scene.add(deck);
  const corbel = new THREE.Mesh(new THREE.CylinderGeometry(OCT / Math.cos(Math.PI / 8) + 0.2, 5.7, 3.4, 8, 1, true), M.stone); corbel.rotation.y = Math.PI / 8; corbel.position.set(cx, top - 2.1, cz); corbel.castShadow = true; scene.add(corbel);
  for (const rot of [0, Math.PI / 4]) world.add(cx, cz, OCT, OCT, rot, top - 0.5, top, 'building');
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, dx = Math.sin(a), dz = Math.cos(a), len = 2 * OCT * Math.tan(Math.PI / 8) + 0.5, px = cx + dx * (OCT + 0.1), pz = cz + dz * (OCT + 0.1);
    bt.box(M.stone, len, 1.25, 0.5, mtx(px, top + 0.625, pz, a), 1.4); bt.box(M.cornice, len + 0.1, 0.12, 0.64, mtx(px, top + 1.3, pz, a), 1.2); world.add(px, pz, len / 2, 0.25, a, top - 0.2, top + 1.5, 'rail');
    const rx = cx + dx * (OCT - 0.5) + Math.cos(a) * 3.1 * 0, rz = cz + dz * (OCT - 0.5); void rx; void rz; }
  // ---- Tesla coil: stepped base, copper winding, toroid and a glowing sphere; four lightning rods on the rim
  const coil = new THREE.Group(); coil.position.set(cx, top, cz + 0.5); scene.add(coil);
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; coil.add(m); return m; };
  mk(new THREE.CylinderGeometry(1.9, 2.1, 0.4, 20), M.cornice, 0.2); mk(new THREE.CylinderGeometry(1.35, 1.6, 0.4, 20), brass, 0.6); mk(new THREE.CylinderGeometry(0.75, 0.95, 0.5, 20), ins, 1.05);
  mk(new THREE.CylinderGeometry(0.32, 0.38, 6.0, 16), ins, 4.4); for (let i = 0; i < 24; i++) mk(new THREE.TorusGeometry(0.44, 0.045, 6, 18), copper, 2.0 + i * 0.2).rotation.x = Math.PI / 2;
  for (let i = 0; i < 6; i++) mk(new THREE.CylinderGeometry(0.62 - i * 0.05, 0.62 - i * 0.05, 0.08, 18), brass, 7.55 + i * 0.12);
  const tor = mk(new THREE.TorusGeometry(1.25, 0.42, 14, 32), copper, 8.7); tor.rotation.x = Math.PI / 2; const ball = mk(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbfe0ff).multiplyScalar(3) }), 9.4);
  world.add(cx, cz + 0.5, 2.1, 2.1, 0, top, top + 1.7, 'furn'); void ball;
  tesla.toroid = new THREE.Vector3(cx, top + 8.7, cz + 0.5);
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8, rx = cx + Math.sin(a) * (OCT - 1.3), rz = cz + Math.cos(a) * (OCT - 1.3); const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 3.4, 8), copper); rod.position.set(rx, top + 1.7, rz); scene.add(rod); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), brass); tip.position.set(rx, top + 3.45, rz); scene.add(tip); tesla.rods.push(new THREE.Vector3(rx, top + 3.5, rz)); world.add(rx, rz, 0.12, 0.12, 0, top, top + 3.4, 'solid'); }
  const arcMat = new THREE.LineBasicMaterial({ color: 0xa8d8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, fog: false });
  for (let i = 0; i < 6; i++) { const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 14 }, () => new THREE.Vector3())), arcMat); ln.frustumCulled = false; scene.add(ln); tesla.arcs.push(ln); }
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.TextureLoader().load('/textures/procedural/lamp_halo.png'), color: 0x9fd0ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.9 })); gl.scale.setScalar(9); gl.position.copy(tesla.toroid); scene.add(gl); tesla.glow = gl;
  tesla.light = { room: 'roof', x: cx, y: top + 8.4, z: cz + 0.5, color: 0x8fc4ff, intensity: 28, dist: 26, on: () => true }; roomLights.push(tesla.light);
  roomLights.push({ room: 'roof', x: cx - 5.2, y: top + 2.4, z: cz - 1.5, color: 0xffb070, intensity: 8, dist: 12, on: () => true });
  // ---- giant clockwork gears standing against the parapet (they turn slowly) and a stone belfry on the north-east rim
  for (const [a, r] of [[Math.PI * 0.5, 1.9], [Math.PI * 1.25, 1.5], [Math.PI * 1.75, 1.7]] as [number, number][]) {
    const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.14, 8, 28), brass); g.add(ring); for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, r * 2, 0.08), brass); sp.rotation.z = i * Math.PI / 8; g.add(sp); }
    for (let i = 0; i < 20; i++) { const th = i / 20 * Math.PI * 2, t = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.16), brass); t.position.set(Math.cos(th) * (r + 0.1), Math.sin(th) * (r + 0.1), 0); t.rotation.z = th; g.add(t); }
    g.position.set(cx + Math.sin(a) * (OCT - 0.9), top + r + 0.5, cz + Math.cos(a) * (OCT - 0.9)); g.rotation.y = a + Math.PI / 2; scene.add(g); tesla.gears.push(g); g.traverse(o => { o.castShadow = true; });
  }
  { const bx = cx + 4.6, bz = cz - 4.6; for (const [dx, dz] of [[-1.2, 0], [1.2, 0]]) { bt.box(M.stone, 0.5, 3.4, 0.5, mtx(bx + dx, top + 1.7, bz + dz, 0), 1.4); world.add(bx + dx, bz + dz, 0.25, 0.25, 0, top, top + 3.4, 'furn'); } bt.box(M.stone, 3.2, 0.5, 0.6, mtx(bx, top + 3.55, bz, 0), 1.4); pf.add('village_q/bell', bx, bz, { y: top + 1.4, h: 1.5, collide: false }); }
  // ---- console with glowing gauges, a tool chest, a bench, the hatch down
  bt.box(M.dark, 2.4, 1.0, 0.8, mtx(cx - 5.4, top + 0.5, cz - 1.0, Math.PI / 2), 1); world.add(cx - 5.4, cz - 1.0, 0.4, 1.2, 0, top, top + 1.0, 'furn');
  for (let i = 0; i < 5; i++) { const gm = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? 0xffc080 : 0x9fd0ff).multiplyScalar(1.6) })); gm.position.set(cx - 5.0, top + 1.05, cz - 1.0 + (i - 2) * 0.42); gm.rotation.x = -Math.PI / 2; scene.add(gm); }
  bt.box(M.wood, 1.0, 0.7, 0.6, mtx(cx - 3.9, top + 0.35, cz + 1.8, 0.3), 1); world.add(cx - 3.9, cz + 1.8, 0.5, 0.3, 0.3, top, top + 0.7, 'furn');
  bt.box(M.wood, 1.9, 0.45, 0.5, mtx(cx + 4.4, top + 0.22, cz + 3.0, 0), 1); world.add(cx + 4.4, cz + 3.0, 0.95, 0.25, 0, top, top + 0.45, 'furn');
  bt.box(M.wood, 1.5, 0.22, 1.5, mtx(TOWER.hatch.x, top + 0.11, TOWER.hatch.z, 0), 1); world.add(TOWER.hatch.x, TOWER.hatch.z, 0.75, 0.75, 0, top, top + 0.22, 'furn');
  // clock faces: 4 canvas dials, hands follow game time
  const faces: [number, number, number][] = [[-70, -53.93, 0], [-70, -62.07, Math.PI], [-74.07, -58, -Math.PI / 2], [-65.93, -58, Math.PI / 2]];
  const base = groundH(-70, -54) - 0.3, fy = base + 27.5 - 6.2;
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

/** per-frame animation of the apparatus: crackling arcs from the toroid to the rods, flicker, slow gears */
export function updateTower(dt: number, near: boolean) {
  if (!near) return; tesla.t += dt;
  for (const g of tesla.gears) g.rotation.z += dt * 0.35 * (g === tesla.gears[1] ? -1 : 1);
  if (tesla.light) tesla.light.intensity = 22 + Math.sin(tesla.t * 31) * 6 + (Math.random() < 0.08 ? 14 : 0);
  if (tesla.glow) (tesla.glow.material as THREE.SpriteMaterial).opacity = 0.65 + Math.sin(tesla.t * 17) * 0.2 + Math.random() * 0.1;
  const from = tesla.toroid; if (!from) return;
  tesla.arcs.forEach((ln, i) => {
    const on = Math.sin(tesla.t * (7 + i * 1.3) + i * 2) > -0.2 && Math.random() < 0.8; ln.visible = on; if (!on) return;
    const to = tesla.rods[(Math.floor(tesla.t * (3 + i)) + i * 3) % tesla.rods.length]; const pos = ln.geometry.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) { const u = k / (pos.count - 1), j = Math.sin(u * Math.PI) * 0.7; pos.setXYZ(k, from.x + (to.x - from.x) * u + (Math.random() - 0.5) * j, from.y + (to.y - from.y) * u * u + (Math.random() - 0.5) * j - Math.sin(u * Math.PI) * 0.6, from.z + (to.z - from.z) * u + (Math.random() - 0.5) * j); }
    pos.needsUpdate = true;
  });
}
