import * as THREE from 'three';
import { Ctx, W } from './kit';
import { LEVELS } from './levels';
import { createPaved } from './atmosphere';
import { Place, spawn, loadTexture } from './assets';

export interface PropInst {
  id: string; kind: string; level: string; x: number; y: number; z: number; r: number; verbs: string; obj?: string; sit?: { x: number; z: number; ry: number };
  floor: number; node?: THREE.Object3D; item?: string;
}
export interface Interior {
  levels: Record<string, THREE.Group>; props: PropInst[];
  lights: { level: string; light: THREE.PointLight; base: number; flicker: boolean; on: boolean }[];
  gears: THREE.Object3D[]; pendulum: THREE.Object3D | null; lens: THREE.Mesh | null; ks1Items: Record<string, THREE.Object3D>;
  worldItems: Record<string, THREE.Object3D>; colliders: { x0: number; z0: number; x1: number; z1: number; level?: string }[];
  hearth: THREE.PointLight | null; fireGroup: THREE.Group; smoke: THREE.Group; kitchenSmoke: THREE.Group;
  candleLights: THREE.PointLight[];
}

const DS = 0.6;   // KayKit dungeon/restaurant
const FK = 0.75;  // KayKit furniture
const KN = 2.0;   // Kenney furniture

export async function buildInteriors(ctx: Ctx, scene: THREE.Scene): Promise<Interior> {
  const I: Interior = { levels: {}, props: [], lights: [], gears: [], pendulum: null, lens: null, ks1Items: {}, worldItems: {}, colliders: [], hearth: null, fireGroup: new THREE.Group(), smoke: new THREE.Group(), kitchenSmoke: new THREE.Group(), candleLights: [] };
  for (const k of Object.keys(LEVELS)) { const g = new THREE.Group(); g.visible = false; scene.add(g); I.levels[k] = g; }
  const n: Record<string, number> = {};
  /** Поставить модель; kind определяет имя/описание (obj.<kind>.*) */
  const put = (lv: string, kind: string, model: string, x: number, z: number, ry = 0, s = DS, y = 0, verbs = 'o', extra: Partial<PropInst> = {}, place: Place = {}) => {
    const info = LEVELS[lv]; const py = info.y + y;
    const id = `${kind}${n[kind] = (n[kind] ?? 0) + 1}`;
    const p: PropInst = { id, kind, level: lv, x, y: py, z, r: 1.6, verbs, floor: info.floor, ...extra };
    ctx.real(model, { x, y: py, z, ry, s, ...place }, I.levels[lv]).then((o) => { p.node = o; });
    if (verbs) I.props.push(p);
    return p;
  };
  const deco = (lv: string, model: string, x: number, z: number, ry = 0, s = DS, y = 0, place: Place = {}) => { ctx.real(model, { x, y: LEVELS[lv].y + y, z, ry, s, ...place }, I.levels[lv]); };
  const wall = (lv: string, x0: number, z0: number, x1: number, z1: number, gaps: number[] = [], mat: 'wood' | 'stone' = 'wood', rows = 2) => {
    // перегородка из модулей town_kit между (x0,z0) и (x1,z1); gaps — индексы модулей-проёмов
    const len = Math.hypot(x1 - x0, z1 - z0); const cnt = Math.max(1, Math.round(len / W)); const ang = Math.atan2(-(z1 - z0), x1 - x0) + Math.PI / 2;
    for (let i = 0; i < cnt; i++) {
      if (gaps.includes(i)) continue;
      const t = (i + 0.5) / cnt; const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
      for (let r = 0; r < rows; r++) deco(lv, `town_kit/${mat === 'wood' ? 'wall_wood' : 'wall'}`, px, pz, ang, W, LEVELS[lv].y === 0 ? r * W : r * W, {});
    }
    I.colliders.push({ x0: Math.min(x0, x1) - 0.15, z0: Math.min(z0, z1) - 0.15, x1: Math.max(x0, x1) + 0.15, z1: Math.max(z0, z1) + 0.15, level: lv });
  };
  const slab = (lv: string, x0: number, z0: number, x1: number, z1: number, tex: 'planks' | 'pavers', y: number, color?: number) => {
    const m = createPaved(x0, x1, z0, z1, tex, LEVELS[lv].y + y);
    if (color !== undefined) (m.material as THREE.MeshStandardMaterial).color.setHex(color);
    (m.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; I.levels[lv].add(m); return m;
  };
  const light = (lv: string, x: number, y: number, z: number, color: number, intensity: number, dist: number, flicker = true, shadow = false) => {
    intensity *= 2.6; const L = new THREE.PointLight(color, intensity, dist * 1.15, 1.5); L.position.set(x, LEVELS[lv].y + y, z); L.castShadow = shadow; if (shadow) { L.shadow.mapSize.set(1024, 1024); L.shadow.bias = -0.002; }
    I.levels[lv].add(L); I.lights.push({ level: lv, light: L, base: intensity, flicker, on: true }); return L;
  };
  const glowDot = (lv: string, x: number, y: number, z: number, c = 0xffb866) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(5) })); m.position.set(x, LEVELS[lv].y + y, z); I.levels[lv].add(m); return m; };

  // ================= ТАВЕРНА: зал =================
  slab('tav0', -35, -7.5, -21, 3.5, 'planks', 0.03);
  // стойка (x -35.2…-29.2, проход -29.2…-28.0), z=-3.6
  for (let i = 0; i < 5; i++) put('tav0', 'bar', 'tavern_kitchen/kitchencounter_straight_a', -34.6 + i * 1.2, -3.6, Math.PI / 2 * 0, DS, 0, i === 3 ? 'ot' : 'o', { obj: i === 3 ? 'bar' : undefined, r: 2.4 });
  put('tav0', 'bar', 'tavern_kitchen/kitchencounter_outercorner', -28.6, -3.6, 0, DS, 0, 'o');
  I.colliders.push({ x0: -35.4, z0: -4.0, x1: -29.1, z1: -3.2, level: 'tav0' });
  // перегородка кухни (x=-29.2…-35, z=-7.5…-3.6): боковая стенка у прохода
  wall('tav0', -29.2, -7.5, -29.2, -4.0, [], 'wood', 2);
  put('tav0', 'keg', 'dungeon/keg', -29.9, -6.3, 0.4, DS * 0.75, 0, 'o'); put('tav0', 'keg', 'dungeon/keg_decorated', -30.9, -6.9, 0, DS * 0.75, 0, 'o'); put('tav0', 'barrel', 'dungeon/barrel_large', -30.2, -4.6, 0, DS * 0.7, 0, 'o');
  put('tav0', 'mug', 'items_adventurer/mug_full', -32.6, -3.5, 0.5, DS * 0.7, 0.62, 'o'); put('tav0', 'mug', 'items_adventurer/mug_empty', -31.4, -3.5, 1, DS * 0.7, 0.62, 'o');
  deco('tav0', 'dungeon/bottle_a_green', -33.8, -3.6, 0, DS, 0.62); deco('tav0', 'dungeon/bottle_b_brown', -30.6, -3.6, 0, DS, 0.62);
  // столы и места
  const tables: [number, number, number, string][] = [[-24.2, 2.2, Math.PI / 2, 'dungeon/table_long_tablecloth'], [-28.6, 1.6, 0, 'dungeon/table_medium_tablecloth_decorated_b'], [-27.6, -1.3, 0, 'dungeon/table_small'], [-31.8, 0.9, 0, 'dungeon/table_small']];
  tables.forEach(([x, z, ry, m], i) => {
    put('tav0', 'table', m, x, z, ry, DS, 0, 'oh', { hide: true } as never);
    I.colliders.push({ x0: x - (ry ? 1.3 : 0.7), z0: z - (ry ? 0.7 : 1.3), x1: x + (ry ? 1.3 : 0.7), z1: z + (ry ? 0.7 : 1.3), level: 'tav0' });
    const seats: [number, number][] = ry ? [[x - 0.9, z - 0.8], [x + 0.9, z - 0.8], [x - 0.9, z + 0.8], [x + 0.9, z + 0.8]] : [[x - 0.8, z], [x + 0.8, z]];
    seats.forEach(([sx, sz], j) => put('tav0', j % 2 ? 'chair' : 'stool', j % 2 ? 'dungeon/chair' : 'dungeon/stool', sx, sz, Math.atan2(x - sx, z - sz), DS * 0.9, 0, 'os', { sit: { x: sx, z: sz, ry: Math.atan2(x - sx, z - sz) } }));
    const c = put('tav0', 'candle', i % 2 ? 'dungeon/candle_triple' : 'dungeon/candle_lit', x, z, 0, DS * 0.9, 0.62, 'of'); void c;
    const L = light('tav0', x, 1.4, z, 0xffa24a, 1.4, 4.2, true); I.candleLights.push(L);
  });
  deco('tav0', 'dungeon/plate_food_a', -24.2, 2.0, 0, DS, 0.62); put('tav0', 'mug', 'items_adventurer/mug_full', -23.4, 2.6, 0.6, DS * 0.7, 0.62, 'o');
  // очаг
  put('tav0', 'hearth', 'nature/campfire_bricks', -34.4, 1.0, Math.PI / 2, 2.2, 0, 'of', { obj: 'hearth', r: 2.2 });
  deco('tav0', 'town_kit/chimney_base', -34.9, 1.0, Math.PI / 2, 1.6, 0); deco('tav0', 'hex_props/resource_lumber', -34.3, 2.4, 0.6, 1.6);
  I.hearth = light('tav0', -34.0, 0.9, 1.0, 0xff7a2a, 9, 8.5, true, true);
  // свет зала и стойки
  light('tav0', -28, 2.2, 0, 0xffa24a, 3, 9); light('tav0', -32, 2.0, -2.4, 0xffc880, 2.2, 6);
  // шкаф-полка, ковёр, вешалка, меню, картины, факелы
  put('tav0', 'bookcase', 'furniture/kenney/bookcase_closed_doors', -22.3, -6.4, -Math.PI / 2, KN * 1.1, 0, 'oc'); 
  put('tav0', 'rug', 'furniture/kenney/rug_rectangle', -25, -4.5, 0, KN * 1.1, 0.03, 'om', { obj: 'rug', r: 2.4 });
  put('tav0', 'coatrack', 'furniture/kenney/coat_rack_standing', -22.2, -2.6, 0, KN, 0, 'o');
  put('tav0', 'menu', 'tavern_kitchen/menu', -29.2, -3.0, Math.PI, DS * 1.4, 1.1, 'o');
  put('tav0', 'picture', 'furniture/kaykit/pictureframe_large_a', -26.5, 3.38, Math.PI, FK, 1.2, 'o'); put('tav0', 'picture_crooked', 'furniture/kaykit/pictureframe_small_b', -29.8, 3.38, Math.PI, FK, 1.3, 'o', {}, { rz: 0.2 });
  for (const [x, z, ry] of [[-34.8, -1.2, Math.PI / 2], [-21.2, 1.5, -Math.PI / 2], [-31, 3.3, Math.PI]] as number[][]) { put('tav0', 'torch', 'dungeon/torch_mounted', x, z, ry, DS * 1.1, 1.5, 'o'); glowDot('tav0', x + Math.sin(ry) * 0.25, 1.75, z + Math.cos(ry) * 0.25); }
  put('tav0', 'chest', 'dungeon/chest', -22.4, 3.0, Math.PI / 2, DS * 0.55, 0, 'oc');
  // лестница наверх
  put('tav0', 'stairs', 'town_kit/stairs_wood_handrail', -22.4, -5.1, -Math.PI / 2, 1.4, 0, 'o'); put('tav0', 'stairs', 'town_kit/stairs_wood', -22.4, -4.0, -Math.PI / 2, 1.4, 1.4 * 0.5, 'o', {}, { sy: 1.0 });
  const stUp = put('tav0', 'tw_stairs', 'dungeon/banner_pattern_a_red', -21.4, -6.8, -Math.PI / 2, DS * 0.5, 1.2, 'u'); stUp.r = 2.6;
  stUp.x = -23.0; stUp.z = -5.0; (stUp as PropInst & { go?: string }).go = 'up';
  // ================= ТАВЕРНА: кухня =================
  put('tav0', 'stove', 'tavern_kitchen/stove_multi', -34.5, -6.1, Math.PI / 2, DS, 0, 'of', { obj: 'stove', r: 2.2 });
  put('tav0', 'hood', 'tavern_kitchen/extractorhood', -34.5, -6.1, Math.PI / 2, DS, 1.15, 'of', { obj: 'hood', r: 2.4 });
  put('tav0', 'oven', 'tavern_kitchen/oven', -34.5, -4.6, Math.PI / 2, DS, 0, 'of', { r: 2 });
  // труба + стык (код): цилиндры и тор
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x6a6258, metalness: 0.7, roughness: 0.4 });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 10), pipeMat); pipe.position.set(-35.0, 1.2, -6.1); pipe.castShadow = true; I.levels.tav0.add(pipe);
  const jointM = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.045, 8, 14), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.6, roughness: 0.4 })); jointM.position.set(-35.0, 0.45, -6.1); jointM.rotation.x = Math.PI / 2; I.levels.tav0.add(jointM);
  put('tav0', 'joint', 'hex_props/bucket_empty', -34.9, -5.5, 0, 0.001, 0.4, 'o', { obj: 'kit_joint', r: 2.4 });
  put('tav0', 'kcounter', 'tavern_kitchen/kitchencounter_straight_a_backsplash', -32.4, -7.1, 0, DS, 0, 'o'); put('tav0', 'sink', 'tavern_kitchen/kitchencounter_sink', -31.2, -7.1, 0, DS, 0, 'of');
  put('tav0', 'kcounter', 'tavern_kitchen/kitchentable_a_large_decorated', -32.6, -5.2, 0, DS * 0.8, 0, 'o');
  put('tav0', 'pot', 'tavern_kitchen/pot_a_stew', -34.2, -7.0, 0, DS, 0.62, 'o'); put('tav0', 'pan', 'tavern_kitchen/pan_a', -33.2, -5.3, 0.5, DS, 0.62, 'o');
  put('tav0', 'jar', 'tavern_kitchen/jar_a_large', -33.6, -7.4, 0, DS, 1.1, 'o'); put('tav0', 'jar', 'tavern_kitchen/jar_b_medium', -33.0, -7.4, 0, DS, 1.1, 'o'); put('tav0', 'jar', 'tavern_kitchen/jar_d_small', -32.5, -7.4, 0, DS, 1.1, 'o');
  put('tav0', 'crate_food', 'tavern_kitchen/crate_potatoes', -29.9, -7.0, 0, DS * 0.7, 0, 'o'); put('tav0', 'crate_food', 'tavern_kitchen/crate_cheese', -29.9, -5.7, 0, DS * 0.7, 0, 'o');
  put('tav0', 'kwindow', 'tavern_kitchen/wall_window_open', -31, -7.45, Math.PI, DS * 0.5, 1.0, 'oc', { obj: 'kit_window', r: 2.4 });
  put('tav0', 'bucket', 'hex_props/bucket_water', -29.7, -4.6, 0, 3, 0, 'o');
  put('tav0', 'fridge', 'tavern_kitchen/fridge_a_decorated', -33.2, -7.3, 0, DS * 0.8, 0, 'oh');
  put('tav0', 'door_back', 'tavern_kitchen/door_a', -27.3, -7.5, 0, DS * 0.01, 0, 'o', { r: 2 });
  light('tav0', -33, 2.3, -5.5, 0xffc880, 3, 7);
  // дым/огонь пожара (спрайты)
  I.levels.tav0.add(I.fireGroup, I.kitchenSmoke);
  // ================= ТАВЕРНА: погреб =================
  slab('tav-1', -34, -7, -22, 2, 'pavers', 0.03, 0x6a6a78);
  for (const [x0, z0, x1, z1] of [[-34.2, -7.2, -21.8, -7.2], [-34.2, 2.2, -21.8, 2.2], [-34.2, -7.2, -34.2, 2.2], [-21.8, -7.2, -21.8, 2.2]] as number[][]) wall('tav-1', x0, z0, x1, z1, [], 'stone', 3);
  put('tav-1', 'barrel', 'dungeon/barrel_large_decorated', -32.4, -2.8, 0, DS * 0.7, 0, 'oh'); put('tav-1', 'barrel', 'dungeon/barrel_small_stack', -32.8, -1.6, 0.2, DS * 0.7, 0, 'oh'); put('tav-1', 'keg', 'dungeon/keg', -31.6, -3.6, 0.3, DS * 0.75, 0, 'o');
  put('tav-1', 'shelf', 'dungeon/shelf_large', -28, -6.9, 0, DS, 0.8, 'o'); put('tav-1', 'shelf', 'dungeon/shelves', -25.5, -6.9, 0, DS, 0, 'o'); put('tav-1', 'shelf', 'dungeon/shelf_small_candles', -30, -6.9, 0, DS, 1.0, 'o');
  put('tav-1', 'crate', 'dungeon/crates_stacked', -24, -0.5, 0.3, DS * 0.6, 0, 'o'); put('tav-1', 'crate', 'dungeon/box_large', -23.3, 1.2, 0, DS * 0.6, 0, 'o');
  put('tav-1', 'chest', 'dungeon/chest', -24.2, -3.3, 0.5, DS * 0.5, 0, 'oc'); put('tav-1', 'chest', 'dungeon/chest_gold', -27.5, 1.2, 0, DS * 0.5, 0, 'oc'); put('tav-1', 'chest', 'dungeon/trunk_medium_a', -29.2, 1.2, 0, DS * 0.55, 0, 'oc');
  const cp = put('tav-1', 'chest_pip', 'dungeon/trunk_small_b', -30.0, -3.5, 0.3, DS * 0.7, 0, 'oc', { obj: 'chest', r: 2.2 });
  void cp;
  deco('tav-1', 'dungeon/torch_mounted', -33.8, -4, Math.PI / 2, DS * 1.1, 1.5);
  // вентиль таверны (код): труба вдоль стены + колпак + маховик
  const pc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6, 10), pipeMat); pc.rotation.z = Math.PI / 2; pc.position.set(-30, LEVELS['tav-1'].y + 1.3, -6.85); I.levels['tav-1'].add(pc);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 14), new THREE.MeshStandardMaterial({ color: 0x4a4038, metalness: 0.6, roughness: 0.5 })); cap.position.set(-33, LEVELS['tav-1'].y + 1.3, -6.75); I.levels['tav-1'].add(cap);
  put('tav-1', 'valve_tav', 'town_kit/wheel', -33, -6.45, 0, 1.0, 1.3, 'o', { obj: 'tav_valve', r: 2.4 }, { rx: Math.PI / 2 });
  put('tav-1', 'rug', 'town_kit/stairs_wood', -25, -5.6, Math.PI, 1.4, 1.4, 'o'); // лестница вверх к люку
  const stDn = put('tav-1', 'tw_stairs', 'town_kit/stairs_wood', -25, -4.2, 0, 1.4, 0, 'u'); stDn.r = 2.2; (stDn as PropInst & { go?: string }).go = 'up';
  light('tav-1', -29, 2.0, -2.6, 0xffa24a, 3.2, 9); light('tav-1', -26, 2.0, -5.5, 0xffa24a, 1.8, 6);
  // ================= ТАВЕРНА: второй этаж =================
  slab('tav1', -35, -7.5, -21, 3.5, 'planks', 0.03);
  wall('tav1', -29.5, -7.4, -29.5, -4.8, [], 'wood', 2); wall('tav1', -29.5, -3.2, -29.5, 0.3, [], 'wood', 2); wall('tav1', -29.5, 1.8, -29.5, 3.4, [], 'wood', 2); wall('tav1', -35, -1.4, -29.7, -1.4, [], 'wood', 2);
  put('tav1', 'bed', 'furniture/kaykit/bed_single_a', -33.8, -5.2, Math.PI / 2, FK, 0, 'os', { sit: { x: -33.0, z: -5.2, ry: Math.PI / 2 } }); put('tav1', 'chest', 'dungeon/chest', -31.0, -2.4, 0, DS * 0.55, 0, 'oc'); put('tav1', 'lamp', 'furniture/kaykit/lamp_table', -32.2, -6.9, 0, FK, 0, 'of');
  put('tav1', 'picture', 'furniture/kaykit/pictureframe_medium', -31.5, -7.4, 0, FK, 1.4, 'o'); put('tav1', 'rug', 'furniture/kaykit/rug_rectangle_a', -32.2, -4.6, 0, FK, 0.03, 'o'); put('tav1', 'cabinet', 'furniture/kaykit/cabinet_medium_decorated', -30.2, -7.0, 0, FK * 0.8, 0, 'oc');
  put('tav1', 'bed', 'furniture/kenney/bed_double', -33.4, 1.0, Math.PI / 2, KN * 1.4, 0, 'os', { sit: { x: -32.4, z: 1.0, ry: Math.PI / 2 } }); put('tav1', 'desk', 'furniture/kenney/desk', -31.2, 2.7, Math.PI, KN * 1.2, 0, 'o'); put('tav1', 'chair', 'furniture/kenney/chair_desk', -31.3, 1.9, 0, KN * 1.1, 0, 'os', { sit: { x: -31.3, z: 1.9, ry: 0 } });
  put('tav1', 'desk', 'furniture/kenney/books', -31.2, 2.7, 0, KN * 1.6, 0.8, 'o');
  light('tav1', -32, 2.1, -4.5, 0xffc880, 1.6, 6); light('tav1', -32, 2.1, 1.0, 0xffc880, 1.4, 6); light('tav1', -25.5, 2.1, -2, 0xffa24a, 1.6, 8);
  const stDn1 = put('tav1', 'tw_stairs', 'town_kit/stairs_wood_handrail', -22.4, -5.1, -Math.PI / 2, 1.4, 0, 'u'); stDn1.x = -23; stDn1.z = -5; stDn1.r = 2.4; (stDn1 as PropInst & { go?: string }).go = 'down';
  put('tav1', 'bench', 'town_kit/stall_bench', -27, -2, 0, 1.5, 0, 'os', { sit: { x: -27, z: -2, ry: 0 } });
  // ================= МАСТЕРСКАЯ ТИЛЬДЫ =================
  slab('work', -30, -25.5, -22, -18.5, 'planks', 0.03);
  put('work', 'desk', 'furniture/kaykit/table_medium_long', -27, -23, Math.PI / 2, FK * 0.85, 0, 'o'); put('work', 'chest', 'hex_props/sack', -26.5, -23.4, 0, 2.4, 0.55, 'o');
  put('work', 'mannequin', 'furniture/kenney/coat_rack_standing', -28.8, -19.6, 0, KN * 1.2, 0, 'o'); deco('work', 'hex_props/sack', -29.0, -19.7, 0, 1.8, 1.2);
  put('work', 'cabinet', 'furniture/kaykit/cabinet_medium_decorated', -29.2, -24.7, 0, FK * 0.8, 0, 'oc'); put('work', 'bed', 'furniture/kaykit/bed_single_b', -29.0, -21.8, Math.PI / 2, FK * 0.8, 0, 'os', { sit: { x: -28.4, z: -21.8, ry: Math.PI / 2 } });
  put('work', 'lamp', 'furniture/kaykit/lamp_standing', -23.4, -19.4, 0, FK * 0.8, 0, 'of'); put('work', 'spool', 'furniture/kaykit/shelf_b_small_decorated', -23.4, -24.9, Math.PI, FK, 0.3, 'o', { obj: 'tilda_shelf', r: 2.6 });
  deco('work', 'furniture/kaykit/rug_oval_a', -26, -21.5, 0, FK * 0.8, 0.03); put('work', 'oven_work', 'nature/campfire_stones', -25.5, -25.0, 0, 2.2, 0, 'of');
  put('work', 'stairs', 'dungeon/stairs_wood', -22.8, -24.9, Math.PI, DS * 0.3, 0, 'o');
  light('work', -26, 2.2, -22, 0xffb060, 3.2, 8.5); light('work', -25.5, 0.9, -24.6, 0xff7a2a, 1.2, 4);
  // ================= БУДКА ИГНАТА =================
  slab('booth', -38, 8.9, -34, 13.1, 'planks', 0.03);
  put('booth', 'stool', 'dungeon/stool', -35.2, 11.4, 0.5, DS, 0, 'os', { sit: { x: -35.2, z: 11.4, ry: 0.5 } }); put('booth', 'table', 'dungeon/table_small', -34.6, 10.4, 0, DS, 0, 'o'); put('booth', 'mug', 'items_adventurer/mug_full', -34.6, 10.4, 0, DS * 0.7, 0.6, 'o');
  put('booth', 'booth_log', 'furniture/kenney/books', -34.5, 10.0, 0.4, KN * 1.6, 0.6, 'o'); put('booth', 'hook', 'town_kit/poles_horizontal', -36, 9.15, 0, 0.5, 1.4, 'o', { obj: 'booth_hook', r: 3.4 });
  deco('booth', 'cemetery/kenney/lantern_candle', -34.4, 10.9, 0, 2.4, 0.6); light('booth', -35.5, 1.5, 10.9, 0xffb060, 2.4, 5.5);
  // ================= БЮРО ХАРБОРМАСТЕРА =================
  slab('bur', 80.6, 6.2, 86.4, 11.8, 'planks', 0.03);
  put('bur', 'desk', 'furniture/kenney/desk', 83.6, 7.6, 0, KN * 1.5, 0, 'o'); put('bur', 'chair', 'furniture/kenney/chair_desk', 83.6, 8.6, Math.PI, KN * 1.2, 0, 'os', { sit: { x: 83.6, z: 8.6, ry: Math.PI } });
  put('bur', 'bureau_log', 'furniture/kenney/books', 83.0, 7.5, 0.3, KN * 1.8, 0.78, 'o', { obj: 'bureau_journal', r: 3.2 });
  put('bur', 'bookcase', 'furniture/kenney/bookcase_closed_wide', 85.6, 6.5, 0, KN * 1.5, 0, 'oc'); put('bur', 'coatrack', 'furniture/kenney/coat_rack', 81.3, 7.0, 0, KN, 0, 'o'); put('bur', 'lamp', 'furniture/kenney/lamp_round_table', 84.2, 7.5, 0, KN * 1.4, 0.78, 'of');
  deco('bur', 'furniture/kenney/rug_round', 83.6, 9.2, 0, KN * 1.5, 0.03);
  const baro = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0xcdbf90, metalness: 0.4, roughness: 0.5 })); baro.rotation.x = Math.PI / 2; baro.position.set(81.2, 1.8, 6.3); I.levels.bur.add(baro);
  I.props.push({ id: 'barometer1', kind: 'barometer', level: 'bur', x: 81.2, y: 1.8, z: 6.5, r: 2.4, verbs: 'o', floor: 0 });
  put('bur', 'flagbox', 'town_kit/planks_opening', 86.0, 9.8, 0, 1.6, 0.5, 'oc'); deco('bur', 'hex_props/flag_yellow', 85.8, 10.4, 0.3, 3, 0.2);
  light('bur', 83.6, 2.2, 9, 0xffb060, 3.0, 8);
  // ================= БАШНЯ (3 уровня) =================
  slab('tw0', -4.1, -31.1, 4.1, -22.9, 'planks', 0.03); slab('tw1', -4.1, -31.1, 4.1, -22.9, 'planks', 0.03); slab('tw2', -4.1, -31.1, 4.1, -22.9, 'planks', 0.03);
  put('tw0', 'workbench', 'dungeon/table_long_decorated_a', -2.2, -28.0, 0, DS * 0.7, 0, 'o'); put('tw0', 'stool', 'dungeon/stool', -2.2, -26.4, 0, DS, 0, 'os', { sit: { x: -2.2, z: -26.4, ry: Math.PI } });
  put('tw0', 'tool_chest', 'dungeon/chest', 2.6, -29.5, -Math.PI / 2, DS * 0.55, 0, 'oc'); put('tw0', 'gearshelf', 'dungeon/shelves', 0.2, -30.8, 0, DS, 0, 'o'); put('tw0', 'blueprints', 'furniture/kaykit/pictureframe_large_a', -3.9, -26, Math.PI / 2, FK, 1.3, 'o');
  put('tw0', 'workbench', 'furniture/kaykit/table_medium_long', 2.4, -25.2, 0, FK * 0.8, 0, 'o'); put('tw0', 'lamp', 'furniture/kaykit/lamp_standing', 3.4, -29.5, 0, FK * 0.8, 0, 'of');
  light('tw0', 0, 2.2, -27, 0xffb060, 3.4, 9);
  const mkUp = (lv: string, go: 'up' | 'down', x: number, z: number) => { const p = put(lv, 'tw_stairs', 'dungeon/stairs_wood', x, z, go === 'up' ? Math.PI / 2 : -Math.PI / 2, DS * 0.28, 0, 'u'); p.r = 2.4; (p as PropInst & { go?: string }).go = go; };
  mkUp('tw0', 'up', 3.2, -23.8); mkUp('tw1', 'down', 3.2, -23.8); mkUp('tw1', 'up', -3.2, -23.8); mkUp('tw2', 'down', -3.2, -23.8);
  // механизм
  const gearDefs: [string, number, number, number, number][] = [['town_kit/wheel', -2, -28, 3.2, 1], ['vehicles/wheel_dark', 1.8, -28, 2.6, -1.4], ['town_kit/wheel', 0, -26, 2.0, 1.8], ['vehicles/wheel_tractor_front', -1.5, -30, 2.2, -1.2]];
  for (const [m, x, z, s, sp] of gearDefs) { const o = await spawn(m, { x, y: LEVELS.tw1.y + 1.6, z, s, ry: 0, rx: Math.PI / 2 }); I.levels.tw1.add(o.obj); o.obj.userData.speed = sp; o.obj.userData.baseRot = Math.PI / 2; I.gears.push(o.obj); }
  const pend = new THREE.Group(); pend.position.set(3.4, LEVELS.tw1.y + 3.6, -27); const rod = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 0.06), pipeMat); rod.position.y = -1.3; pend.add(rod); const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 18), new THREE.MeshStandardMaterial({ color: 0xb48a3a, metalness: 0.8, roughness: 0.3 })); bob.rotation.x = Math.PI / 2; bob.position.y = -2.7; pend.add(bob); I.levels.tw1.add(pend); I.pendulum = pend;
  put('tw1', 'weights', 'dungeon/coin_stack_large', -3.4, -29.6, 0, DS * 1.0, 0, 'o'); put('tw1', 'weights', 'dungeon/coin_stack_large', -3.4, -28.2, 0, DS * 1.0, 0, 'o'); put('tw1', 'stopper', 'town_kit/wheel', 3.6, -30, 0, 0.7, 1.2, 'o', {}, { rx: Math.PI / 2 });
  put('tw1', 'gear', 'town_kit/wheel', 3.6, -26.5, 0, 0.9, 1.0, 'o', {}, { rx: Math.PI / 2 });
  light('tw1', 0, 2.8, -27, 0xffa24a, 3.6, 10);
  // Окно: линза + кресло + рычаги
  const lensMat = new THREE.ShaderMaterial({
    transparent: true, uniforms: { time: { value: 0 }, k: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float time;uniform float k;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      void main(){vec2 c=vUv-.5;float r=length(c);if(r>.5)discard;
        float w=n(c*9.+time*.6)*.6+n(c*21.-time*.9)*.4; float ring=smoothstep(.5,.44,r)*smoothstep(.36,.46,r);
        vec3 a=vec3(.35,.7,1.),b=vec3(1.,.6,.25); float side=smoothstep(-.1,.1,c.x+(w-.5)*.2);
        vec3 col=mix(vec3(.02,.05,.1),mix(a,b,side),w*(.5+.7*k)); col+=ring*vec3(.9,.8,.5)*1.6+k*vec3(.8,.9,1.)*smoothstep(.5,0.,r);
        gl_FragColor=vec4(col,.92);}`,
  });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), lensMat); lens.position.set(0, LEVELS.tw2.y + 2.0, -30.6); I.levels.tw2.add(lens); I.lens = lens;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 10, 48), new THREE.MeshStandardMaterial({ color: 0xb48a3a, metalness: 0.8, roughness: 0.35 })); ring.position.copy(lens.position); I.levels.tw2.add(ring);
  put('tw2', 'lens', 'furniture/kaykit/chair_a', 0, -28.4, Math.PI, FK * 1.1, 0, 'o', { obj: 'window', r: 4 }); I.props[I.props.length - 1].verbs = 'w'; I.props[I.props.length - 1].x = 0; I.props[I.props.length - 1].z = -28.6;
  put('tw2', 'lever', 'town_kit/poles', -2.4, -30.4, 0, 1.0, 0, 'o'); put('tw2', 'lever', 'town_kit/poles', 2.4, -30.4, 0, 1.0, 0, 'o');
  put('tw2', 'armchair', 'dungeon/chair', 1.0, -27.2, Math.PI, DS * 1.1, 0, 'os', { sit: { x: 1.0, z: -27.2, ry: Math.PI } });
  light('tw2', 0, 2.8, -28.6, 0xffa24a, 3.0, 9); light('tw2', 0, 2.0, -29.8, 0x8fb2ff, 4.0, 7, false);
  void loadTexture;
  await Promise.all(ctx.pending);
  // предметы мира (визуалы sim-предметов)
  const mkItem = async (id: string, model: string, s: number) => { const o = await spawn(model, { s }); o.obj.visible = false; scene.add(o.obj); I.worldItems[id] = o.obj; };
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), new THREE.MeshStandardMaterial({ color: 0xe8d8a0, emissive: 0x5a4a20, side: THREE.DoubleSide })); card.rotation.x = -Math.PI / 2; card.visible = false; scene.add(card); I.worldItems.pass = card;
  await mkItem('key', 'dungeon/key', 0.5); await mkItem('coinstack', 'dungeon/coin_stack_small', 0.55); await mkItem('keyring', 'dungeon/keyring', 0.4); await mkItem('decor_key', 'dungeon/key', 0.3);
  return I;
}
