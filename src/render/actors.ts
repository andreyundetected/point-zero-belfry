import * as THREE from 'three';
import { spawn, loadModel } from './assets';

export interface Actor {
  obj: THREE.Group; mixer: THREE.AnimationMixer; actions: Record<string, THREE.AnimationAction>; current: string; kind: 'mini' | 'hero' | 'animal';
  play(name: string, fade?: number): void; height: number; head: THREE.Object3D | null; base: number;
}
const sizeCache = new Map<string, number>();
const find = (anims: THREE.AnimationClip[], ...names: string[]) => { for (const n of names) { const c = anims.find((a) => a.name === n) || anims.find((a) => a.name.toLowerCase().includes(n.toLowerCase())); if (c) return c; } return anims[0]; };

export async function createActor(path: string, kind: Actor['kind'], height: number, tint?: number, scaleMul = 1): Promise<Actor> {
  const { obj, animations } = await spawn(path, {});
  const root = new THREE.Group(); root.add(obj);
  obj.updateMatrixWorld(true);
  const mixer = new THREE.AnimationMixer(obj);
  const map: Record<string, string[]> = kind === 'hero'
    ? { idle: ['Idle'], walk: ['Walking_A'], run: ['Running_A'], sneak: ['Walking_C', 'Walking_B'], sit: ['Sit_Chair_Idle'], interact: ['Interact'], pick: ['PickUp'], die: ['Death_A'], cheer: ['Cheer'] }
    : kind === 'mini'
      ? { idle: ['idle'], walk: ['walk'], run: ['sprint'], sneak: ['crouch'], sit: ['sit'], interact: ['interact-right'], pick: ['pick-up'], die: ['die'], cheer: ['emote-yes'], no: ['emote-no'], hold: ['holding-right'] }
      : { idle: ['Idle'], walk: ['Walk', 'Gallop'], run: ['Run', 'Gallop'], sit: ['Idle'], sneak: ['Walk'], interact: ['Idle'], pick: ['Idle'], die: ['Death', 'Idle'], cheer: ['Idle'] };
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const [k, names] of Object.entries(map)) { const c = find(animations, ...names); if (c) actions[k] = mixer.clipAction(c); }
  // рост: нормализуем по реальному bbox позы (Box3 скинированных моделей «врёт» — берём precise после первого кадра)
  if (actions.idle) { actions.idle.play(); mixer.update(0.01); }
  obj.updateMatrixWorld(true);
  let h = sizeCache.get(path);
  if (!h) { const b = new THREE.Box3().setFromObject(obj, true); h = Math.max(0.01, b.max.y - b.min.y); sizeCache.set(path, h); }
  const s = (height / h) * scaleMul; root.scale.setScalar(s);
  obj.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.frustumCulled = false; mesh.castShadow = true;
      if (tint !== undefined) { const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; const nm = mats.map((mm) => { const c = (mm as THREE.MeshStandardMaterial).clone(); if (c.color) c.color.multiply(new THREE.Color(tint)); return c; }); mesh.material = Array.isArray(mesh.material) ? nm : nm[0]; }
    }
  });
  let cur = 'idle';
  const actor: Actor = {
    obj: root, mixer, actions, current: cur, kind, height, base: 0, head: null,
    play(name, fade = 0.2) {
      const a = actions[name] ?? actions.idle; if (!a || actions[cur] === a) { cur = name; this.current = name; return; }
      const prev = actions[cur]; a.reset().fadeIn(fade).play(); if (prev) prev.fadeOut(fade);
      if (name === 'die') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      cur = name; this.current = name;
    },
  };
  void loadModel;
  return actor;
}

export interface NpcVisual { model: string; tint?: number; height: number; kind: Actor['kind']; mul?: number }
export const NPC_VISUALS: Record<string, NpcVisual> = {
  ignat: { model: 'characters/npc_mini_male_a', tint: 0xa8b8d0, height: 1.95, kind: 'mini' }, matvey: { model: 'characters/npc_mini_male_b', tint: 0xe6c27a, height: 1.9, kind: 'mini' },
  orven: { model: 'characters/npc_mini_male_c', tint: 0x9aa8c0, height: 1.92, kind: 'mini' }, boris: { model: 'characters/npc_mini_male_d', tint: 0xc08a5a, height: 2.0, kind: 'mini' },
  luka: { model: 'characters/npc_mini_male_e', tint: 0x70a888, height: 1.9, kind: 'mini' }, foma: { model: 'characters/npc_mini_male_f', tint: 0xd49a7a, height: 1.88, kind: 'mini' },
  tilda: { model: 'characters/npc_mini_female_a', tint: 0xb878a8, height: 1.85, kind: 'mini' }, agata: { model: 'characters/npc_mini_female_b', tint: 0xe09a68, height: 1.88, kind: 'mini' },
  mira: { model: 'characters/npc_mini_female_c', tint: 0x88aad0, height: 1.85, kind: 'mini' }, pip: { model: 'characters/npc_mini_female_d', tint: 0xf0c070, height: 1.45, kind: 'mini' },
  zoya: { model: 'characters/npc_mini_female_e', tint: 0xc0b0d0, height: 1.8, kind: 'mini' }, klara: { model: 'characters/npc_mini_female_f', tint: 0xe07a8a, height: 1.88, kind: 'mini' },
  cat: { model: 'characters/animal_cat', height: 0.42, kind: 'animal' }, pug: { model: 'characters/animal_pug', height: 0.6, kind: 'animal' }, fox: { model: 'characters/animal_fox', height: 0.55, kind: 'animal' },
};
