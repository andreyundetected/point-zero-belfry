import * as THREE from 'three';
import { M } from '../render/materials';
import { Batcher, mtx } from './batch';
import { ROADS } from './layout';
import { groundH, hash, surfaceAt } from './terrain';
import { placed } from './city';
import { world } from './colliders';
import { PropField } from './props';
import { roomLights } from './interiors';
import { A } from '../render/materials';

// Street and facade dressing, pass 2: the small things a real street has and a generated one lacks.
// Everything static is merged (Batcher) or instanced (PropField); the only per-item objects are the door lanterns' halos (sprites).
const plaqueTex = (text: string, w = 256, h = 64) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!; g.fillStyle = '#1b2230'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8d2c4'; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = '#e8e2d4'; g.font = `bold ${Math.round(h * 0.52)}px Georgia,serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 1); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const STREET_OF: Record<string, string> = { rynok: 'Рыночная', bashn: 'Башенная', klyuch: 'пер. Ключников', bereg: 'Береговая', kanat: 'Канатная', gavan: 'Гаванная', nab: 'Набережная', sklad: 'Складская', priyut: 'Приютская', gavanE: 'Гаванная', eastS: 'Восточная', eastN: 'Восточная', westS: 'Западная', westN: 'Западная', lodoch: 'Лодочный пер.', tower_sq: 'Башенная пл.' };

export function buildDressing(scene: THREE.Scene, props: PropField) {
  const bt = new Batcher(); const halos: number[] = [];
  const plaqueMat = new Map<string, THREE.Material>(); const plaque = (t: string) => plaqueMat.get(t) ?? plaqueMat.set(t, new THREE.MeshStandardMaterial({ map: plaqueTex(t), roughness: 0.6 })).get(t)!;
  const numMat = new Map<string, THREE.Material>(); const num = (t: string) => numMat.get(t) ?? numMat.set(t, new THREE.MeshStandardMaterial({ map: plaqueTex(t, 96, 96), roughness: 0.6 })).get(t)!;
  // ---- kerbs: a granite lip along every road edge (the walk sits 12 cm above the carriageway in the look, not in the physics)
  for (const r of ROADS) for (let k = 0; k < r.pts.length - 1; k++) {
    const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1], len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len, ry = -Math.atan2(bz - az, bx - ax);
    for (const side of [-1, 1]) for (let t = 0; t < len; t += 2) { const l = Math.min(2, len - t), cx = ax + dx * (t + l / 2) - dz * (r.w / 2) * side, cz = az + dz * (t + l / 2) + dx * (r.w / 2) * side;
      if (Math.abs(cx) < 9 && Math.abs(cz) < 4) continue; if (surfaceAt(cx - dz * side * 0.4, cz + dx * side * 0.4) === 'water') continue; if (world.inside(cx, cz, ['building'], 0.1)) continue;
      bt.box(M.cornice, l - 0.02, 0.14, 0.28, mtx(cx, groundH(cx, cz) + 0.04, cz, ry), 1.2); }
    // gutter grates and manholes down the middle / along the kerb, every ~14 m
    for (let t = 7; t < len - 2; t += 14 + hash(t, k) * 6) { const gx = ax + dx * t, gz = az + dz * t; if (Math.abs(gx) < 9 && Math.abs(gz) < 4) continue;
      const man = hash(t, r.id.length) < 0.5; if (man) { const g = new THREE.CylinderGeometry(0.34, 0.34, 0.03, 18); g.translate(gx, groundH(gx, gz) + 0.012, gz); bt.geo(M.iron, g); }
      else { const side = hash(t, 2) < 0.5 ? -1 : 1, kx = gx - dz * (r.w / 2 - 0.35) * side, kz = gz + dx * (r.w / 2 - 0.35) * side; for (let b = 0; b < 5; b++) bt.box(M.iron, 0.08, 0.03, 0.5, mtx(kx + dx * (b - 2) * 0.11, groundH(kx, kz) + 0.012, kz + dz * (b - 2) * 0.11, ry), 1); } }
  }
  // ---- per house: a lantern over the door (shops and every third house), house number, a doorstep, chimney pots, an awning on some shops, a cellar grate
  let hn = 1; const seenRow = new Map<string, number>();
  for (const b of placed) {
    if (b.id === 'blk' || b.id === 'ob' || b.id === 'tower' || !b.toWorld) continue;
    const row = b.id.split('#')[0]; const n = (seenRow.get(row) ?? 0) + 1; seenRow.set(row, n); hn = n * 2 + (row.length % 2);
    const R = (a: number) => hash(b.x * 0.7 + a, b.z * 1.3 - a); const P = b.toWorld; const nx = Math.sin(b.ry), nz = Math.cos(b.ry);
    const dcx = b.dcx ?? 0; const shop = /orven|foma|tavern|contora/.test(row) || R(1) < 0.3;
    // doorstep
    { const [X, Y, Z] = P(dcx, 0, 0.55); void Y; bt.box(M.stone, 1.9, 0.12, 0.9, mtx(X, b.base + 0.3 + 0.06, Z, b.ry), 1.2); }
    // house number plaque right of the door at 2.0 m
    { const [X, , Z] = P(dcx + 0.95, 0, 0.09); const m = new THREE.BoxGeometry(0.22, 0.22, 0.02); m.applyMatrix4(mtx(X, b.base + 0.35 + 2.0, Z, b.ry)); bt.geo(num(String(hn)), m); }
    // door lantern: an iron bracket, a small glass box that glows, a halo, and a real light in the pool (short range) for shops
    if (shop || R(2) < 0.35) { const [X, , Z] = P(dcx - 0.9, 0, 0.3); const y = b.base + 0.35 + 2.75;
      bt.box(M.iron, 0.04, 0.04, 0.5, mtx(X - nx * 0.12, y + 0.2, Z - nz * 0.12, b.ry), 1); bt.box(M.iron, 0.16, 0.04, 0.16, mtx(X, y + 0.2, Z, b.ry), 1);
      const glass = new THREE.BoxGeometry(0.14, 0.2, 0.14); glass.applyMatrix4(mtx(X, y, Z, b.ry)); bt.geo(doorGlass, glass);
      halos.push(X, y, Z); roomLights.push({ room: 'street', x: X, y: y - 0.1, z: Z, color: 0xffb070, intensity: shop ? 4 : 2.5, dist: shop ? 7 : 5, on: () => true }); }
    // awning over a shop window
    if (shop && R(3) < 0.55 && b.w >= 5) { const side = dcx > 0 ? -1 : 1; const aw = Math.min(3.2, b.w / 2 - 1.2), ax = dcx + side * (Math.abs(dcx) + aw / 2 + 0.8) * (dcx === 0 ? 1 : 1); const cx = side * (b.w / 4) + (dcx === 0 ? side * 0.4 : 0); void ax;
      const [X, , Z] = P(cx, 0, 0.55); const g = new THREE.BoxGeometry(aw, 0.04, 1.1); g.applyMatrix4(new THREE.Matrix4().makeRotationX(0.32)); g.applyMatrix4(mtx(X, b.base + 0.35 + 3.0, Z, b.ry)); bt.geo(awningMat(R(4)), g);
      for (const s of [-1, 1]) { const [bx, , bz] = P(cx + s * (aw / 2 - 0.05), 0, 0.95); bt.box(M.iron, 0.03, 0.03, 0.9, mtx(bx, b.base + 0.35 + 3.25, bz, b.ry), 1); } }
    // chimney pots on top of the chimneys the generator placed (two clay pots per stack)
    if (b.floors >= 2) for (let c = 0; c < 1 + (b.w > 7 ? 1 : 0); c++) { const [X, , Z] = P(-b.w / 4 + c * b.w / 2, 0, -b.depth / 2 + 0.8); const top = b.base + b.H + (2.6 + R(2) * 1.2) * 0.6 + 0.8; for (const s of [-0.18, 0.18]) { const g = new THREE.CylinderGeometry(0.1, 0.13, 0.4, 8); g.translate(X + nx * 0 + s * nz, top + 0.2, Z - s * nx); bt.geo(M.brickD, g); } }
    // cellar grate at the foot of some facades
    if (R(5) < 0.3 && b.w >= 5) { const [X, , Z] = P(dcx > 0 ? -b.w / 3 : b.w / 3, 0, 0.1); for (let k = 0; k < 6; k++) bt.box(M.iron, 0.03, 0.42, 0.03, mtx(X + (k - 2.5) * 0.11 * nz, b.base + 0.35 + 0.35, Z - (k - 2.5) * 0.11 * nx, b.ry), 1); bt.box(M.dark, 0.7, 0.46, 0.04, mtx(X - nx * 0.03, b.base + 0.35 + 0.35, Z - nz * 0.03, b.ry), 1); }
    // street-name plaque on the corner house of each row (the first house)
    if (n === 1) { const name = STREET_OF[row.split(':')[0]]; if (name) { const [X, , Z] = P(-b.w / 2 + 1.1, 0, 0.09); const g = new THREE.BoxGeometry(1.0, 0.25, 0.02); g.applyMatrix4(mtx(X, b.base + 0.35 + 2.9, Z, b.ry)); bt.geo(plaque(name), g); } }
  }
  // ---- more wires: cross-street lines with insulators between facing rows (Rynochnaya, Beregovaya, Naberezhnaya)
  const wire = new THREE.LineBasicMaterial({ color: 0x15171a }); const pts: number[] = [];
  const span = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, sag = 0.7) => { for (let i = 0; i < 14; i++) { const t0 = i / 14, t1 = (i + 1) / 14; pts.push(ax + (bx - ax) * t0, ay + (by - ay) * t0 - Math.sin(t0 * Math.PI) * sag, az + (bz - az) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1 - Math.sin(t1 * Math.PI) * sag, az + (bz - az) * t1); } };
  for (let x = -80; x <= -22; x += 16) { const y = groundH(x, -8) + 7.2; span(x, y, -8 - 4.4, x + 1.5, y + 0.3, -8 + 4.4); }
  for (let z = -70; z <= 40; z += 18) { const y = groundH(-14, z) + 7.0; span(-14 - 3.8, y, z, -14 + 3.8, y + 0.2, z + 1.2); }
  for (let z = -60; z <= 40; z += 20) { const y = groundH(14, z) + 7.0; span(14 - 3.8, y, z, 14 + 3.8, y + 0.4, z + 1); }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); scene.add(new THREE.LineSegments(wg, wire));
  // ---- piers: rope coils, a net on the rail, buckets
  for (const [x, z] of [[-10.6, 60.5], [-8.3, 74], [-43.2, 61], [-40.9, 79]] as [number, number][]) { const g = new THREE.TorusGeometry(0.22, 0.07, 6, 14); g.rotateX(Math.PI / 2); g.translate(x, -0.5 + 0.07, z); bt.geo(ropeMat, g); }
  props.add('hex_props/bucket_water', -11.4, 66, { l: 0.5, ry: 0.4, y: -0.5 }); props.add('hex_props/bucket_empty', -43.3, 70, { l: 0.5, ry: 2, y: -0.5 });
  // ---- tavern interior: bottles on the back shelf, mugs and plates on the tables, candles
  const tv = placed.find(p => p.id === 'tavern'); if (tv?.toWorld && tv.floorY) { const fy = tv.floorY(0); const L = (lx: number, lz: number) => { const [X, , Z] = tv.toWorld!(lx, 0, lz); return { x: X, z: Z }; };
    { const [SX, , SZ] = tv.toWorld(-0.6, 0, -8.6); bt.box(M.wood, 5.0, 0.05, 0.3, mtx(SX, fy + 1.55, SZ, tv.ry), 1); const sh = world.add(SX, SZ, 2.5, 0.15, tv.ry, fy + 1.5, fy + 1.55, 'surf'); void sh; } // back-bar shelf (surf: the check treats its top as a support)
    for (let i = 0; i < 9; i++) { const p = L(-2.6 + i * 0.5, -8.6); props.add(i % 3 === 1 ? 'dungeon/bottle_b_green' : 'dungeon/bottle_a_brown', p.x, p.z, { h: 0.26 + (i % 2) * 0.04, ry: i, y: fy + 1.55 }); }
    for (const [lx, lz] of [[-4.3, -2.0], [-4.9, -2.1], [-4.4, -6.1], [3.3, -6.9], [-1.2, -3.3], [0.9, -3.9], [1.9, -3.3]]) { const p = L(lx, lz); props.add(hash(lx, lz) < 0.6 ? 'items_adventurer/mug_full' : 'items_adventurer/mug_empty', p.x, p.z, { h: 0.11, ry: hash(lz, lx) * 6, y: fy + 0.78 + 0.004 }); }
    for (const [lx, lz] of [[-4.7, -1.8], [2.7, -7.1]]) { const p = L(lx, lz); props.add('dungeon/plate_food_a', p.x, p.z, { l: 0.24, ry: lx, y: fy + 0.78 + 0.004 }); }
    for (const [lx, lz] of [[-4.6, -2.3], [-4.6, -5.7], [3.0, -6.7]]) { const p = L(lx, lz); props.add('dungeon/candle_lit', p.x, p.z, { h: 0.12, y: fy + 0.78 + 0.004 }); }
  }
  // ---- Orven: tools on the counter; contora: ledgers and an inkwell; Tikhon: a bowl and a mug
  const orv = placed.find(p => p.id === 'orven'); if (orv?.toWorld && orv.floorY) { const fy = orv.floorY(0); const [X, , Z] = orv.toWorld(-1.4, 0, -1.7); props.add('dungeon/plate_small', X, Z, { l: 0.2, y: fy + 1.05 + 0.004 }); const [X2, , Z2] = orv.toWorld(0.5, 0, -1.6); props.add('dungeon/coin_stack_small', X2, Z2, { l: 0.12, y: fy + 1.05 + 0.004 }); }
  const ct = placed.find(p => p.id === 'contora'); if (ct?.toWorld && ct.floorY) { const fy = ct.floorY(0); for (const [lx, lz, k] of [[-1.6, -3.1, 0], [1.4, -3.3, 1], [-0.2, -3.0, 2]] as [number, number, number][]) { const [X, , Z] = ct.toWorld(lx, 0, lz); const g = new THREE.BoxGeometry(0.3, 0.04 + k * 0.01, 0.42); g.applyMatrix4(mtx(X, fy + 1.05 + 0.03, Z, ct.ry + k * 0.2)); bt.geo(k === 1 ? M.dark : paperMat, g); } }
  const tk = placed.find(p => p.id === 'tikhon'); if (tk?.toWorld && tk.floorY) { const fy = tk.floorY(0); const [X, , Z] = tk.toWorld(-1.1, 0, -3.6); props.add('tavern_kitchen/bowl', X, Z, { l: 0.22, y: fy + 0.76 + 0.004 }); const [X2, , Z2] = tk.toWorld(-1.7, 0, -3.2); props.add('items_adventurer/mug_empty', X2, Z2, { h: 0.11, y: fy + 0.76 + 0.004 }); }
  bt.flush(scene);
  if (halos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(halos, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: new THREE.TextureLoader().load(A + 'textures/procedural/lamp_halo.png'), size: 1.4, sizeAttenuation: true, color: 0xffb070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5, fog: false })); pts.frustumCulled = false; scene.add(pts); }
}
const doorGlass = new THREE.MeshBasicMaterial({ color: 0xffc080 });
const ropeMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 1 });
const paperMat = new THREE.MeshStandardMaterial({ color: 0xcfc6ac, roughness: 1 });
const awnings = [0x3a2a24, 0x2a3034, 0x3a3328].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, side: THREE.DoubleSide }));
const awningMat = (r: number) => awnings[Math.floor(r * awnings.length)];
