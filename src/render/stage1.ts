import * as THREE from 'three';
import type { Engine } from './engine';
import { StaticBatcher, spawn } from './assets';
import { createGround, puddle } from './atmosphere';

const S = 2.3;
/** Этап 1: проверочная ночная площадь (рецепт tools/style_test). Заменяется миром этапа 2. */
export async function buildProofStreet(eng: Engine) {
  const { scene, lamps } = eng;
  scene.add(createGround(120, 120, 0, 0));
  [[-2.2, 3.4, 2.2, 1.1], [2.4, -1.2, 1.6, 0.9], [0.2, -5.5, 2.8, 1.3], [-3.5, -2, 1.2, 0.8]].forEach(([x, z, w, h]) => scene.add(puddle(x, z, w, h)));
  const b = new StaticBatcher();
  const hx: [string, number, number, number, number][] = [
    ['building_home_a_red', -7.5, -3.5, Math.PI / 2, S], ['building_home_b_blue', -7.6, 0.6, Math.PI / 2, S], ['building_market_red', -7.8, 5.0, Math.PI / 2, S],
    ['building_home_a_green', 7.2, -4.2, -Math.PI / 2, S], ['building_blacksmith_yellow', 7.6, 0.2, -Math.PI / 2, S], ['building_home_b_yellow', 7.3, 4.6, -Math.PI / 2, S],
    ['building_church_blue', 0, -14, 0, S * 1.5], ['building_home_a_blue', -6, -10, 0.4, S], ['building_home_b_red', 6.5, -10, -0.3, S],
  ];
  hx.forEach(([n, x, z, ry, s]) => b.add('buildings_hex/' + n, { x, z, ry, s }));
  b.add('town_kit/fountain_round', { x: 0, z: 0.5, s: 1.6 });
  b.add('town_kit/stall_red', { x: -3.8, z: 2.2, ry: Math.PI / 2, s: 1.4 }); b.add('town_kit/stall_green', { x: 3.8, z: 3.0, ry: -Math.PI / 2, s: 1.4 });
  b.add('town_kit/cart', { x: 2.8, z: -3.0, ry: 0.5, s: 1.5 }); b.add('town_kit/cart_high', { x: -3.0, z: -4.2, ry: -0.6, s: 1.5 });
  b.add('hex_props/barrel', { x: -4.6, z: 3.0, s: 1.4 }); b.add('hex_props/crate_a_big', { x: -4.7, z: 1.6, ry: 0.3, s: 1.4 }); b.add('hex_props/crate_b_small', { x: -4.5, z: 1.2, ry: 0.9, s: 1.4 });
  b.add('hex_props/barrel', { x: 4.6, z: 4.5, s: 1.4 }); b.add('hex_props/sack', { x: 4.6, z: 2.1, ry: 0.4, s: 1.4 }); b.add('hex_props/wheelbarrow', { x: -1.8, z: -6.5, ry: 0.8, s: 1.6 });
  b.add('nature/tree_default_dark', { x: 9.5, z: -7, s: 2 }); b.add('nature/tree_oak_dark', { x: -10, z: -7, s: 2 });
  await b.flush(scene);
  for (const [x, z] of [[-3.4, -1.0], [3.6, -1.5], [-3.6, 5.5], [3.6, 6.2], [-0.2, -8.0], [2, -12.5]]) {
    const { obj } = await spawn('town_kit/lantern', { x, z, s: 1.7 }); scene.add(obj);
    lamps.add('p' + x + z, x, 2.5, z);
  }
  const people: [string, number, number, number, string, number][] = [
    ['npc_mini_male_c', -1.6, 3.4, 2.4, 'idle', 1.35], ['npc_mini_female_b', -3.0, 3.2, -1.2, 'idle', 1.35], ['npc_mini_male_b', 3.3, 4.2, -1.8, 'idle', 1.35],
    ['npc_mini_female_e', 1.5, -2.2, 0.4, 'walk', 1.35], ['npc_mini_male_d', -0.6, -4.2, 3.0, 'walk', 1.35], ['npc_mini_female_c', 2.2, 1.2, 2.7, 'idle', 1.35],
    ['npc_mini_male_f', -2.2, -0.2, -0.6, 'sit', 1.35], ['hero_rogue_hooded', 0.2, 2.2, 0.15, 'Idle', 0.62],
  ];
  for (const [n, x, z, ry, anim, s] of people) {
    const { obj, animations } = await spawn('characters/' + n, { x, z, ry, s }); scene.add(obj);
    const m = new THREE.AnimationMixer(obj); const c = THREE.AnimationClip.findByName(animations, anim) || animations[0];
    if (c) { m.clipAction(c).play(); m.update(0.37 * (x + 5)); eng.mixers.push(m); }
  }
}
