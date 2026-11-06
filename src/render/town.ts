import * as THREE from 'three';
import type { Engine } from './engine';
import { Ctx, House, W, house, makeCtx } from './kit';
import { FACADES, BACKDROP } from './facades';
import { createGround, createPaved, createWater, puddle } from './atmosphere';
import { spawn, loadPNG, Place } from './assets';
import { hrand } from '../sim/rng';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface Town {
  ctx: Ctx; houses: Record<string, House & { mats?: THREE.Material[] }>;
  tram: THREE.Group; tramLight: THREE.PointLight; tramWheels: THREE.Object3D[];
  barge: THREE.Group; barrels: THREE.Object3D[]; flags: { red: THREE.Object3D; blue: THREE.Object3D; green: THREE.Object3D; yellow: THREE.Object3D };
  clock: { hourHand: THREE.Object3D; minHand: THREE.Object3D; face: THREE.Mesh };
  board: { tex: THREE.CanvasTexture; ctx2d: CanvasRenderingContext2D; draw(text: string, sub: string): void };
  water: THREE.Mesh; ground: THREE.Mesh; world: THREE.Group; gauge: THREE.Object3D; glows: Record<string, THREE.Group>;
  bounds: { x0: number; x1: number; z0: number; z1: number };
}
const rnd = (...k: (string | number)[]) => hrand(7, ...k);

export async function buildTown(eng: Engine): Promise<Town> {
  const { scene, lamps } = eng;
  const ctx = makeCtx(scene);
  const world = new THREE.Group(); scene.add(world);
  const B = ctx.batcher;
  const P = (path: string, x: number, z: number, ry = 0, s = 1, y = 0) => B.add(path, { x, y, z, ry, s });
  const col = (x0: number, z0: number, x1: number, z1: number) => ctx.colliders.push({ x0, z0, x1, z1 });

  // ---------------- земля, вода ----------------
  const ground = createGround(200, 100, 17, -30); world.add(ground);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ color: 0x0c1220, roughness: 1 })); far.rotation.x = -Math.PI / 2; far.position.y = -0.6; scene.add(far);
  world.add(createPaved(-46, 96, 14.5, 20, 'pavers'));
  world.add(createPaved(-21, -13, 20, 28, 'planks', 0.04)); world.add(createPaved(66, 74, 20, 28, 'planks', 0.04));
  const water = createWater(300, 160, 20, 100, -0.45); world.add(water);
  for (const [x, z, w, h, r] of [[-2.2, 3.4, 2.2, 1.1, 0], [2.4, -1.2, 1.6, 0.9, 0.4], [0.2, -5.5, 2.8, 1.3, 0], [-6, -9, 1.5, 1, 1], [8, 6, 2.2, 1.2, .3], [-12, 6, 1.4, .8, 0], [14, -9, 1.8, 1, 0], [30, 17, 2.4, 1, 0], [50, 17.5, 3, 1, 0], [-8, 17.2, 2, .9, 0], [-34, 8, 2.2, 1.1, 0.5], [20, 4, 2, 1, .2]] as number[][]) world.add(puddle(x, z, w, h, r));

  // ---------------- фасады ----------------
  const houses: Town['houses'] = {};
  for (const f of FACADES) {
    houses[f.id] = house(ctx, f.opts) as Town['houses'][string];
    world.add(houses[f.id].group);
    // цветочные горшки и бочки у фасадов
  }
  // вывеска таверны, горшки у мастерской
  const tavDoor = houses.F2.door!, wsDoor = houses.F1.door!;
  for (const [dx, dz] of [[-1.4, 1.6], [1.4, 1.6]]) { void dx; void dz; }
  P('nature/pot_small', wsDoor.x + 0.9, wsDoor.z + 1.0, 0, 2.2); P('nature/flower_red_a', wsDoor.x + 0.9, wsDoor.z + 1.0, 0, 2.2, 0.35);
  P('nature/pot_small', wsDoor.x + 0.9, wsDoor.z - 1.0, 0, 2.2); P('nature/flower_yellow_a', wsDoor.x + 0.9, wsDoor.z - 1.0, 0, 2.2, 0.35);
  P('hex_props/barrel', tavDoor.x + 0.8, tavDoor.z + 2.6, 0.4, 2.2); P('hex_props/crate_a_big', tavDoor.x + 1.2, tavDoor.z - 2.6, 0.2, 2.2); P('hex_props/barrel', tavDoor.x + 0.6, tavDoor.z - 3.3, 0, 2.2);
  P('town_kit/overhang', tavDoor.x + 0.4, tavDoor.z, 0, 2.6, 2.1);
  P('town_kit/banner_red', tavDoor.x + 1.5, tavDoor.z + 2.2, Math.PI / 2, 1.5, 1.7);
  P('town_kit/banner_green', wsDoor.x + 0.5, wsDoor.z + 1.4, Math.PI / 2, 1.3, 1.5);

  // ---------------- площадь ----------------
  P('town_kit/fountain_round_detail', 0, 0, 0, 1.7);
  col(-2.6, -2.6, 2.6, 2.6);
  const stalls: [string, number, number, number][] = [['town_kit/stall_red', -9.5, -6, Math.PI / 2], ['town_kit/stall_green', 10.5, 6.8, -Math.PI / 2], ['town_kit/stall_green', -4.2, 9.6, Math.PI], ['town_kit/stall_red', 14, -8, -Math.PI / 2]];
  for (const [p, x, z, ry] of stalls) { P(p, x, z, ry, 1.5); col(x - 1.3, z - 1.3, x + 1.3, z + 1.3); P('town_kit/stall_stool', x + 1.4 * Math.cos(ry + 1.57), z - 1.4 * Math.sin(ry + 1.57), 0, 1.6); }
  P('town_kit/cart', 4, -9, 0.5, 1.6); P('town_kit/cart_high', -7, -9.5, -0.6, 1.6); P('hex_props/wheelbarrow', -2, -11, 0.8, 1.8); col(2.5, -10.5, 5.5, -7.5); col(-8.5, -11, -5.5, -8);
  for (const [x, z, ry] of [[-9, 5, 1.57], [11, -2, -1.57], [-1, 9, 0]] as number[][]) { P('town_kit/stall_bench', x, z, ry, 2); col(x - 1, z - 1, x + 1, z + 1); }
  for (let i = 0; i < 16; i++) { // бочки, ящики, мешки, горшки — «каждый кадр ≥ 6 разных пропсов»
    const x = -13 + rnd('px', i) * 28, z = -13 + rnd('pz', i) * 24;
    if (Math.hypot(x, z) < 4.5 || (Math.abs(x) < 3 && z > 5)) continue;
    const kinds = ['hex_props/barrel', 'hex_props/crate_a_big', 'hex_props/crate_b_small', 'hex_props/sack', 'nature/pot_large', 'hex_props/crate_long_a'];
    const k = kinds[Math.floor(rnd('pk', i) * kinds.length)];
    P(k, x, z, rnd('pr', i) * 6, k.includes('pot') ? 2 : 2.2); if (k.includes('pot')) P('nature/flower_yellow_b', x, z, 0, 2.2, 0.5);
    col(x - 0.4, z - 0.4, x + 0.4, z + 0.4);
  }
  // сцена праздника у ступеней башни
  P('buildings_hex/building_stage_a', -9, -17, 0, 3.2); col(-12, -19.5, -6, -14.5);
  P('town_kit/banner_red', 6, -3, 0, 2, 0.8); P('town_kit/banner_green', -6, 8.2, 0, 2, 0.8);
  // ступени башни
  P('town_kit/stairs_stone', 0, -21.4, Math.PI / 2, 2.6); P('town_kit/stairs_stone', 1.2, -21.2, Math.PI / 2, 2.6); P('town_kit/stairs_stone', -1.2, -21.2, Math.PI / 2, 2.6);
  // деревья и клумбы
  for (const [x, z] of [[-13, -17], [13, -17], [-16, 8], [16, 8], [-20, 14], [38, -6], [-44, 5], [-40, -10]]) P(rnd('t', x) > 0.5 ? 'nature/tree_oak_dark' : 'nature/tree_default_dark', x, z, rnd('tr', z) * 6, 2.4);
  // колодец, бельё
  P('buildings_hex/building_well_red', -15, -11, 0, 1.9); col(-16, -12, -14, -10);

  // ---------------- ворота и пост ----------------
  P('town_kit/pillar_stone', -38, 9.2, 0, 2.2, 0); P('town_kit/pillar_stone', -38, 14.8, 0, 2.2, 0); P('town_kit/wall_arch_top', -38, 12, Math.PI / 2, 1.5, 2.9);
  P('town_kit/fence_gate', -38, 12, Math.PI / 2, 3.2);
  for (let z = 15.2; z < 19; z += 1.4) P('town_kit/fence', -38, z, Math.PI / 2, 1.4); for (let z = 8.8; z > 4; z -= 1.4) P('town_kit/fence', -38, z, Math.PI / 2, 1.4);
  col(-38.5, 4, -37.5, 9.2); col(-38.5, 14.8, -37.5, 19);
  P('cemetery/kenney/fire_basket', -36.2, 14.6, 0, 1.8); lamps.add('gate_fire', -36.2, 1.4, 14.6, { gas: false, base: 12 });
  // шкаф КШ-1 (код): ящик + манометр + два маховика
  const ks1 = new THREE.Group(); ks1.position.set(-33, 0, 15.5); scene.add(ks1);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 0.8), new THREE.MeshStandardMaterial({ color: 0x3a4250, metalness: 0.5, roughness: 0.5 })); cab.position.y = 0.95; cab.castShadow = true; ks1.add(cab);
  const gauge = new THREE.Group(); gauge.position.set(0, 1.4, 0.42);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24), new THREE.MeshBasicMaterial({ color: 0xe6e0c8 })); gauge.add(dial);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.01), new THREE.MeshBasicMaterial({ color: 0xaa2222 })); needle.position.set(0, 0.1, 0.01); needle.geometry.translate(0, 0.1, 0); needle.position.y = 0; gauge.add(needle); gauge.userData.needle = needle;
  ks1.add(gauge);
  const w1 = await spawn('town_kit/wheel', { x: -0.4, y: 0.7, z: 0.42, s: 1.1, ry: Math.PI / 2 }); ks1.add(w1.obj); const w2 = await spawn('town_kit/wheel', { x: 0.4, y: 0.7, z: 0.42, s: 1.1, ry: Math.PI / 2 }); ks1.add(w2.obj);
  ks1.userData = { supply: w1.obj, bleed: w2.obj, gauge: needle }; world.userData.ks1 = ks1;
  const gh = await spawn('city_bits/watertower', { x: -44, z: 22, s: 6 }); gh.obj.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh) { mm.material = (mm.material as THREE.Material).clone(); (mm.material as THREE.MeshStandardMaterial).color.set(0x2a2f38); } }); scene.add(gh.obj);
  col(-33.9, 14.9, -32.1, 16.1);

  // ---------------- набережная ----------------
  // парапет вдоль кромки воды (с проёмами у причалов), ступени к воде
  for (let x = -45; x <= 95; x += 1.4) {
    if ((x > -22 && x < -12) || (x > 65 && x < 75)) continue;
    P('town_kit/wall_half', x, 20.1, Math.PI / 2, 1.4);
  }
  col(-46, 19.7, -22, 20.6); col(-12, 19.7, 65, 20.6); col(75, 19.7, 96, 20.6);
  // колонны причалов и сходни
  for (const [x0, x1] of [[-21, -13], [66, 74]]) {
    for (let z = 21; z <= 28; z += 3.5) { P('hex_props/resource_lumber', x0, z, 0, 1.5, -0.2); P('hex_props/resource_lumber', x1, z, 0, 1.5, -0.2); }
    col(x0 - 0.5, 28.2, x1 + 0.5, 29); col(x0 - 0.6, 20.5, x0 + 0.1, 28.5); col(x1 - 0.1, 20.5, x1 + 0.6, 28.5);
  }
  P('town_kit/stairs_stone', 6, 21, 0, 2.2, -0.4);
  // фонари: высокие газовые вдоль набережной (шаг ~12 м)
  let li = 0;
  for (let x = -36; x <= 90; x += 12.6) {
    const z = 15.2; P('cemetery/kenney/lightpost_single', x, z, Math.PI / 2, 2.1);
    lamps.add('emb' + li++, x + 0.0, 3.0, z + 0.5, { gas: true, base: 14 }); col(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
  }
  // фонари площади
  for (const [x, z] of [[-3.4, -1.0], [3.6, -1.5], [-3.6, 5.5], [3.6, 6.2], [-0.2, -8.0], [8, 10], [-12, 3], [13, -4]]) {
    P('town_kit/lantern', x, z, 0, 1.7); lamps.add('sq' + x + z, x, 2.5, z, { gas: true, base: 12 }); col(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
  }
  // свет окон: тёплые плоскости за стеклом + фонарь у каждой двери (рецепт: тёплые точки против холодного тумана)
  const winTex = loadPNG('textures/procedural/window_warm_emissive.png');
  const winMat = new THREE.MeshBasicMaterial({ map: winTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9, fog: true, color: 0xffc27a, side: THREE.DoubleSide });
  const glows: Record<string, THREE.Group> = {};
  for (const f of FACADES) {
    const h = houses[f.id]; h.group.updateMatrixWorld(true);
    const gg = new THREE.Group(); scene.add(gg); glows[f.id] = gg;
    const planes: THREE.BufferGeometry[] = [];
    h.winSpots.forEach((sp, i) => {
      if (rnd('win', f.id, i) < 0.22) return;
      const wp = h.group.localToWorld(new THREE.Vector3(sp.x + sp.nx * 0.08, sp.y, sp.z + sp.nz * 0.08));
      const g = new THREE.PlaneGeometry(0.8 * W, 0.8 * W); const rot = h.group.rotation.y;
      g.rotateY(Math.atan2(sp.nx * Math.cos(rot) + sp.nz * Math.sin(rot), -sp.nx * Math.sin(rot) + sp.nz * Math.cos(rot))); g.translate(wp.x, wp.y, wp.z); planes.push(g);
    });
    if (planes.length) { const mg = mergeGeometries(planes, false); if (mg) gg.add(new THREE.Mesh(mg, winMat)); }
    if (h.door) {
      const lx = h.door.x + h.door.nx * 0.6 - h.door.nz * 1.3, lz = h.door.z + h.door.nz * 0.6 + h.door.nx * 1.3;
      P('town_kit/lantern', lx, lz, 0, 1.5); lamps.add('door_' + f.id, lx, 2.2, lz, { gas: false, base: 9, color: 0xffa24a });
    }
  }
  // рельсы + шпалы
  const railMat = new THREE.MeshStandardMaterial({ color: 0x5a6070, metalness: 0.8, roughness: 0.35 });
  for (const dz of [-0.55, 0.55]) { const r = new THREE.Mesh(new THREE.BoxGeometry(100, 0.07, 0.07), railMat); r.position.set(46, 0.06, 17 + dz); r.receiveShadow = true; scene.add(r); }
  for (let x = -4; x <= 96; x += 1.0) P('town_kit/planks_half', x, 17, Math.PI / 2, 1.5, 0.03);
  // остановки: навес + скамья
  for (const [sx, name] of [[12, 'pl'], [66, 'pr']] as [number, string][]) {
    for (const dx of [-1.8, 1.8]) for (const dz of [-0.9, 0.9]) P('town_kit/poles', sx + dx, 18.5 + dz * 0, Math.PI / 2, 1.8);
    P('town_kit/overhang', sx, 18.7, Math.PI, 2.6, 2.4); P('town_kit/stall_bench', sx - 0.6, 18.9, Math.PI, 2.0); P('town_kit/planks', sx + 1.6, 19.3, 0, 1.2, 0.9); col(sx - 1.2, 19, sx + 0.1, 19.7);
    void name;
  }
  // киоск «Билеты и Вестник»
  P('town_kit/stall_red', 6, 15, 0, 1.7); P('town_kit/stall_stool', 4.3, 15.2, 0, 2); col(4.5, 13.7, 7.5, 16.3);
  P('dungeon/coin_stack_small', 6.1, 15.4, 0, 0.5, 0.9);
  // уличный мусор/бочки на набережной и причалах
  for (let i = 0; i < 14; i++) { const x = -40 + rnd('ex', i) * 130, z = 14.6 + rnd('ez', i) * 4; P(['hex_props/barrel', 'hex_props/crate_b_small', 'hex_props/sack', 'hex_props/crate_long_b'][i % 4], x, z, rnd('er', i) * 6, 2.2); col(x - 0.4, z - 0.4, x + 0.4, z + 0.4); }
  // лодки у причала-1 (лодочный), в тумане — корабли
  for (const [p, x, z, ry, s] of [['boats/boat_watercraft_pack_001', 63, 24.5, 1.57, 0.9], ['boats/boat_watercraft_pack_002', 77, 25, 1.4, 0.9], ['pirate_kit/boat_small', 70, 30.5, 0.3, 5], ['boats/boat_watercraft_pack_004', 60, 33, 1.7, 0.8], ['pirate_kit/ship_dark', 40, 62, 0.2, 2.2], ['pirate_kit/ship_light', -30, 74, -0.3, 2.4], ['boats/boat_watercraft_pack_003', 100, 52, 0.5, 1.4], ['pirate_kit/ship_dark', 110, 90, 1, 2.8]] as [string, number, number, number, number][]) B.add(p, { x, y: -0.4, z, ry, s });
  // мачта-семафор у бюро
  const mast = new THREE.Group(); mast.position.set(87, 0, 15); scene.add(mast);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 9, 8), new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.8 })); pole.position.y = 4.5; pole.castShadow = true; mast.add(pole);
  for (const y of [7.2, 6.2]) { const yard = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0x4a3a2c })); yard.position.y = y; mast.add(yard); }
  const mkFlag = async (p: string, y: number) => { const f = await spawn(p, { x: 0.6, y, z: 0, s: 3.2 }); f.obj.visible = false; mast.add(f.obj); return f.obj; };
  const flags = { red: await mkFlag('hex_props/flag_red', 7.0), blue: await mkFlag('hex_props/flag_blue', 6.0), green: await mkFlag('hex_props/flag_green', 7.0), yellow: await mkFlag('hex_props/flag_yellow', 8.2) };
  flags.green.visible = true; col(86.7, 14.7, 87.3, 15.3);

  // ---------------- башня: циферблат, шестерни снаружи ----------------
  const faceCanvas = document.createElement('canvas'); faceCanvas.width = faceCanvas.height = 256; const fc = faceCanvas.getContext('2d')!;
  fc.fillStyle = '#f4e3b0'; fc.beginPath(); fc.arc(128, 128, 124, 0, 7); fc.fill(); fc.strokeStyle = '#3a2a18'; fc.lineWidth = 8; fc.stroke();
  fc.fillStyle = '#3a2a18'; fc.font = 'bold 30px serif'; fc.textAlign = 'center'; fc.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) { const a = i * Math.PI / 6; fc.fillText(String(i), 128 + Math.sin(a) * 92, 128 - Math.cos(a) * 92); }
  const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.CircleGeometry(2.0, 40), new THREE.MeshBasicMaterial({ map: faceTex, color: new THREE.Color(0xffc070).multiplyScalar(1.7), fog: true }));
  face.position.set(0, 9.2, -27 + 4.3); scene.add(face);
  const hand = (len: number, wd: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(wd, len, 0.05), new THREE.MeshBasicMaterial({ color: 0x1a1208 })); m.geometry.translate(0, len / 2, 0); const g = new THREE.Group(); g.add(m); g.position.set(0, 9.2, -27 + 4.36); scene.add(g); return g; };
  const clock = { hourHand: hand(1.1, 0.12), minHand: hand(1.6, 0.08), face };
  lamps.add('clock', 0, 9.2, -27 + 5, { gas: false, color: 0xffb060, base: 9, scale: 0.01 });
  // силуэт колокольни за башней
  P('buildings_hex/building_church_blue', 0, -42, 0, 3.4); P('buildings_hex/building_tower_a_blue', -6, -40, 0, 3.0);

  // ---------------- фон: холмы, мельницы, замок, лес ----------------
  for (const [n, x, z, ry, s] of BACKDROP) P('buildings_hex/' + n, x, z, ry, s);
  for (let i = 0; i < 26; i++) {
    const a = -0.7 + (i / 25) * 4.4; const r = 70 + rnd('hr', i) * 50;
    P(['hex_nature/hills_a_trees', 'hex_nature/hills_b_trees', 'hex_nature/mountain_a_grass_trees', 'hex_nature/hills_c_trees'][i % 4], 20 + Math.cos(a) * r * 1.6, -30 - Math.abs(Math.sin(a)) * r * 0.9 - 30, rnd('hy', i) * 6, 9 + rnd('hs', i) * 7, -0.2);
  }
  for (let i = 0; i < 38; i++) { const x = -90 + rnd('fx', i) * 200, z = -90 + rnd('fz', i) * 50; if (z > -55 && x > -50 && x < 50) continue; P(['nature/tree_pine_round_a', 'nature/tree_oak_dark', 'nature/tree_default_dark', 'nature/tree_cone_dark'][i % 4], x, z, rnd('ft', i) * 6, 2.6 + rnd('fs', i)); }
  for (let i = 0; i < 10; i++) { const x = -80 + i * 20, z = -52 - rnd('tz', i) * 10; P('nature/tree_pine_round_b', x, z, 0, 3); }
  // лиса на холме (фон)
  P('hex_nature/rock_single_a', -52, -8, 0.6, 3);
  col(-110, -75, 130, -30); // северная граница
  // ---------------- трамвай «Газовичок» (код из кусков пака) ----------------
  const tram = new THREE.Group(); tram.position.set(12, 0, 17); scene.add(tram);
  const tramBody = new THREE.Group(); tram.add(tramBody);
  const L = 4; // модулей по длине
  const tw: THREE.Object3D[] = [];
  const addTo = async (p: string, pl: Place) => { const s = await spawn(p, pl, true); tramBody.add(s.obj); return s.obj; };
  for (let i = 0; i < L; i++) {
    const x = (i - (L - 1) / 2) * 1.4;
    for (const side of [-1, 1]) await addTo(i % 2 === 1 ? 'town_kit/wall_wood_window_glass' : 'town_kit/wall_wood_window_glass', { x, y: 0.35, z: side * 0.95, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, s: 1.4 });
  }
  for (const side of [-1, 1]) await addTo('town_kit/wall_wood', { x: side * 2.8, y: 0.35, z: 0, ry: side > 0 ? 0 : Math.PI, sz: 1.4 * 1.3, sy: 1.4, sx: 1.4 });
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.25, 2.1), new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.7 })); floorMesh.position.y = 0.3; floorMesh.castShadow = true; tramBody.add(floorMesh);
  const roofM = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.18, 2.4), new THREE.MeshStandardMaterial({ color: 0x264a3a, roughness: 0.6 })); roofM.position.y = 2.45; roofM.castShadow = true; tramBody.add(roofM);
  for (const dx of [-2.0, 2.0]) for (const dz of [-0.75, 0.75]) { const w = await addTo('town_kit/wheel', { x: dx, y: 0.28, z: dz * 1.25, ry: 0, s: 1.5 }); tw.push(w); }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshBasicMaterial({ color: 0xffd890 })); plate.position.set(3.01, 1.9, 0); plate.rotation.y = Math.PI / 2; tramBody.add(plate);
  const head = await addTo('town_kit/lantern', { x: 3.05, y: 0.9, z: 0, s: 1.1 });
  const arc = await addTo('cemetery/kenney/lantern_glass', { x: 0, y: 2.55, z: 0, s: 2.2 });
  void head; void arc;
  for (const bx of [-1.6, -0.5, 0.6, 1.7]) { for (const bz of [-0.55, 0.55]) await addTo('town_kit/stall_bench', { x: bx, y: 0.4, z: bz, ry: Math.PI / 2, s: 0.9 }); }
  const tramLight = new THREE.PointLight(0xffc880, 7, 9, 1.7); tramLight.position.set(0, 2.1, 0); tram.add(tramLight);
  const tg = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd890).multiplyScalar(4) })); tg.position.set(3.1, 0.9, 0); tramBody.add(tg);

  // ---------------- баржа Бориса ----------------
  const barge = new THREE.Group(); scene.add(barge); barge.visible = false;
  const bm = await spawn('pirate_kit/boat_large', { s: 5.5, ry: Math.PI / 2 }); barge.add(bm.obj);
  const cargo: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i++) { const c = await spawn(i % 2 ? 'hex_props/barrel' : 'dungeon/barrel_large', { x: -1.5 + i * 0.7, y: 0.5, z: (i % 3 - 1) * 0.45, s: i % 2 ? 2.2 : 0.45 }); barge.add(c.obj); cargo.push(c.obj); }
  // бочки на причале (динамические препятствия)
  const barrels: THREE.Object3D[] = [];
  for (const [x, z] of [[-15.6, 16.0], [-16.2, 17.2], [-17.0, 16.4], [-16.8, 18.1]]) { const b = await spawn('hex_props/barrel', { x, z, s: 2.6, ry: rnd('br', x) * 6 }); b.obj.visible = false; scene.add(b.obj); barrels.push(b.obj); }

  // ---------------- доска «Вестник» ----------------
  const bc = document.createElement('canvas'); bc.width = 512; bc.height = 320; const b2 = bc.getContext('2d')!;
  const bTex = new THREE.CanvasTexture(bc); bTex.colorSpace = THREE.SRGBColorSpace; bTex.anisotropy = 8;
  const boardGrp = new THREE.Group(); boardGrp.position.set(8, 0, -5); scene.add(boardGrp);
  for (const dx of [-1.2, 1.2]) { const s = await spawn('town_kit/poles', { x: dx, z: 0, ry: Math.PI / 2, s: 2.2, sy: 2.8 }); boardGrp.add(s.obj); }
  const bp = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.8, emissive: 0x2a2010, emissiveMap: bTex, emissiveIntensity: 0.6 })); bp.position.set(0, 1.85, 0.06); bp.castShadow = true; boardGrp.add(bp);
  const roofB = await spawn('town_kit/overhang', { y: 2.9, z: 0.1, s: 2.8, sx: 3.2, ry: Math.PI / 2 }); boardGrp.add(roofB.obj);
  col(6.6, -5.5, 9.4, -4.5);
  const board: Town['board'] = { tex: bTex, ctx2d: b2, draw(text, sub) {
    b2.fillStyle = '#d9c79a'; b2.fillRect(0, 0, 512, 320); b2.strokeStyle = '#4a3a1a'; b2.lineWidth = 6; b2.strokeRect(8, 8, 496, 304);
    b2.fillStyle = '#2a1c0a'; b2.textAlign = 'center'; b2.font = 'bold 34px "Old Standard TT", serif'; b2.fillText('ВЕСТНИК', 256, 52);
    b2.fillRect(40, 64, 432, 3);
    b2.font = 'bold 28px "Old Standard TT", serif'; wrap(b2, text, 256, 112, 440, 34); b2.font = '20px "Old Standard TT", serif'; wrap(b2, sub, 256, 230, 440, 26); bTex.needsUpdate = true;
  } };
  function wrap(c: CanvasRenderingContext2D, t: string, x: number, y: number, mw: number, lh: number) { const words = t.split(' '); let line = ''; for (const w of words) { const test = line + w + ' '; if (c.measureText(test).width > mw && line) { c.fillText(line.trim(), x, y); line = w + ' '; y += lh; } else line = test; } c.fillText(line.trim(), x, y); }
  board.draw('…', '');

  // границы игровой зоны
  const bounds = { x0: -66, x1: 98, z0: -60, z1: 29 };
  // инстансы пакетом
  await B.flush(scene);
  await Promise.all(ctx.pending);
  return { ctx, houses, tram, tramLight, tramWheels: tw, barge, barrels, flags, clock, board, water, ground, world, gauge: ks1, glows, bounds };
}
