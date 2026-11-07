import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { NPCS, type NpcDef } from '../content/schedule';
import { npcViews, type NpcView } from '../sim/sim';
import type { Sim } from '../sim/types';
import { groundH } from './terrain';

// Люди: тела Mixamo + одежда-оболочка кодом + ретаргет UAL (спека §3.5).
// Масштаб нормализуется по кости Head — у файлов Mixamo Armature 0.01.

const loader = new GLTFLoader();
const cache = new Map<string, Promise<any>>();
const load = (path: string) => {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(path));
  return cache.get(path)!;
};

const CLOTH_BONES = /Head|Eye|Neck|Hand/;
const LEG_BONES = /UpLeg|Leg|Foot|Toe/;

const COAT = [0x2b2a28, 0x3a352e, 0x26292d, 0x4a4238, 0x1d1e20];
const TROU = [0x1c1c1e, 0x2e2c2a, 0x252628];

const MAP: Record<string, string> = {
  mixamorigHips: 'pelvis', mixamorigSpine: 'spine_01', mixamorigSpine1: 'spine_02', mixamorigSpine2: 'spine_03',
  mixamorigNeck: 'neck_01', mixamorigHead: 'Head',
  mixamorigLeftShoulder: 'clavicle_l', mixamorigLeftArm: 'upperarm_l', mixamorigLeftForeArm: 'lowerarm_l', mixamorigLeftHand: 'hand_l',
  mixamorigRightShoulder: 'clavicle_r', mixamorigRightArm: 'upperarm_r', mixamorigRightForeArm: 'lowerarm_r', mixamorigRightHand: 'hand_r',
  mixamorigLeftUpLeg: 'thigh_l', mixamorigLeftLeg: 'calf_l', mixamorigLeftFoot: 'foot_l',
  mixamorigRightUpLeg: 'thigh_r', mixamorigRightLeg: 'calf_r', mixamorigRightFoot: 'foot_r',
};

interface Instance {
  def: NpcDef;
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  current: string;
  targetPos: THREE.Vector3;
  view: NpcView | null;
}

export class People {
  scene: THREE.Scene;
  private insts: Instance[] = [];
  private walkClip: THREE.AnimationClip | null = null;
  private idleClip: THREE.AnimationClip | null = null;
  private ualClips: THREE.AnimationClip[] = [];
  private ualSkin: THREE.SkinnedMesh | null = null;
  private ready = false;
  private usedModels = new Set<string>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async load() {
    try {
      const anims = await load('/models/people/mixamo/mixamo_anims.glb');
      this.walkClip = anims.animations.find((a: THREE.AnimationClip) => /walk/i.test(a.name)) ?? anims.animations[0] ?? null;
      this.idleClip = anims.animations.find((a: THREE.AnimationClip) => /idle/i.test(a.name)) ?? null;
      try {
        const ual = await load('/models/people/universal/anims/ual1.glb');
        const ual2 = await load('/models/people/universal/anims/ual2.glb');
        this.ualClips = [...ual.animations, ...ual2.animations];
        ual.scene.traverse((o: THREE.Object3D) => {
          if ((o as THREE.SkinnedMesh).isSkinnedMesh && !this.ualSkin) this.ualSkin = o as THREE.SkinnedMesh;
        });
      } catch (e) {
        console.warn('UAL animations unavailable', e);
      }
      await Promise.all(NPCS.slice(0, 22).map((def) => this.spawn(def)));
      this.ready = true;
    } catch (e) {
      console.warn('people load failed', e);
    }
  }

  private async spawn(def: NpcDef) {
    try {
      if (!this.usedModels.has(def.model)) this.usedModels.add(def.model);
      const gltf = await load(`/models/people/mixamo/${def.model}.glb`);
      const root = SkeletonUtils.clone(gltf.scene) as THREE.Group;
      root.userData.npc = def.id;
      root.position.set(0, -100, 0);
      this.scene.add(root);

      const body = this.clothe(root, def);
      this.normalizeScale(root, def);

      const mixer = new THREE.AnimationMixer(root);
      const actions = new Map<string, THREE.AnimationAction>();
      const addAction = (name: string, clip: THREE.AnimationClip | null) => {
        if (!clip) return;
        const a = mixer.clipAction(clip);
        a.play();
        a.enabled = false;
        actions.set(name, a);
      };
      addAction('walk', this.walkClip);
      addAction('idle', this.retarget(body, 'Idle_Loop') ?? this.idleClip);
      addAction('talk', this.retarget(body, 'Idle_Talking_Loop') ?? this.idleClip);
      addAction('rail', this.retarget(body, 'Idle_Rail_Loop') ?? this.idleClip);
      addAction('sit', this.retarget(body, 'Sit_Loop') ?? this.idleClip);
      addAction('work', this.retarget(body, 'Idle_FoldArms_Loop') ?? this.idleClip);
      addAction('lie', this.retarget(body, 'Sit_Loop') ?? this.idleClip);
      addAction('crouch', this.retarget(body, 'Crouch_Idle_Loop') ?? this.idleClip);
      addAction('drive', this.retarget(body, 'Idle_Loop') ?? this.idleClip);

      const inst: Instance = {
        def, root, mixer, actions, current: '',
        targetPos: new THREE.Vector3(),
        view: null,
      };
      this.insts.push(inst);
    } catch (e) {
      console.warn('npc spawn failed', def.id, e);
    }
  }

  private retarget(body: THREE.SkinnedMesh | null, name: string): THREE.AnimationClip | null {
    if (!body || !this.ualSkin) return null;
    const src = this.ualClips.find((c) => c.name === name) ?? this.ualClips.find((c) => c.name.startsWith(name));
    if (!src) return null;
    try {
      const clip = SkeletonUtils.retargetClip(body, this.ualSkin, src, {
        names: MAP, hip: 'mixamorigHips', useFirstFramePosition: true,
      });
      clip.tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion'));
      return clip;
    } catch {
      return null;
    }
  }

  /** Рост по кости Head ≈ 1.75 м. */
  private normalizeScale(root: THREE.Object3D, def: NpcDef) {
    root.updateMatrixWorld(true);
    let head: THREE.Bone | null = null;
    root.traverse((o) => {
      if ((o as THREE.Bone).isBone && /Head$/.test(o.name)) head = o as THREE.Bone;
    });
    let height = 1.8;
    if (head) {
      const v = new THREE.Vector3();
      (head as THREE.Bone).getWorldPosition(v);
      height = v.y - root.position.y;
    }
    if (!isFinite(height) || height <= 0.01) height = 1.8;
    const want = 1.75 * (def.scale ?? 1);
    const s = want / height;
    root.scale.multiplyScalar(s);
    root.updateMatrixWorld(true);
  }

  /** Копия тела, раздутая по нормали, с масками головы/кистей (см. 03_ASSET_GUIDE §4.2). */
  private clothe(root: THREE.Object3D, def: NpcDef): THREE.SkinnedMesh | null {
    let body: THREE.SkinnedMesh | null = null;
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh && (!body || m.geometry.attributes.position.count > body.geometry.attributes.position.count)) body = m;
    });
    if (!body) return null;
    const b = body as THREE.SkinnedMesh;
    const sk = b.skeleton;
    const bn = sk.bones.map((bone) => bone.name);
    const g = b.geometry;
    const pos = g.attributes.position, nor = g.attributes.normal;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const region = new Int8Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      let best = 0, bi = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w > best) { best = w; bi = si.getComponent(i, k); }
      }
      const n = bn[bi] || '';
      region[i] = CLOTH_BONES.test(n) ? 0 : LEG_BONES.test(n) ? (/Foot|Toe/.test(n) ? 3 : 2) : 1;
    }
    const mats = [
      new THREE.MeshStandardMaterial({ color: def.clothes.coat, roughness: 0.92 }),
      new THREE.MeshStandardMaterial({ color: def.clothes.coat, roughness: 0.92 }),
      new THREE.MeshStandardMaterial({ color: def.clothes.trousers, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x0d0c0c, roughness: 0.35 }),
    ];
    const idx = g.index ? Array.from(g.index.array) : Array.from({ length: pos.count }, (_, i) => i);
    const groups: number[][] = [[], [], []];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], c = idx[t + 1], d = idx[t + 2];
      if (!region[a] || !region[c] || !region[d]) continue;
      groups[Math.max(region[a], region[c], region[d]) - 1].push(a, c, d);
    }
    const sh = g.clone();
    const p2 = sh.attributes.position;
    const off = [0, 0.03, 0.022, 0.012];
    for (let i = 0; i < p2.count; i++) {
      const o = off[region[i]];
      p2.setXYZ(i, p2.getX(i) + nor.getX(i) * o, p2.getY(i) + nor.getY(i) * o, p2.getZ(i) + nor.getZ(i) * o);
    }
    sh.setIndex([...groups[0], ...groups[1], ...groups[2]]);
    sh.clearGroups();
    sh.addGroup(0, groups[0].length, 0);
    sh.addGroup(groups[0].length, groups[1].length, 1);
    sh.addGroup(groups[0].length + groups[1].length, groups[2].length, 2);
    const shell = new THREE.SkinnedMesh(sh, mats);
    shell.bind(sk, b.bindMatrix);
    shell.castShadow = true;
    shell.frustumCulled = false;
    b.parent?.add(shell);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      const matName = Array.isArray(m.material) ? '' : (m.material?.name ?? '');
      if (m.isMesh && m !== b && m !== shell && !/Hair|hair|lash/i.test(matName)) m.visible = false;
    });

    const bone = (n: string) => sk.bones.find((x) => x.name === n);
    const hips = bone('mixamorigHips');
    if (hips && (def.clothes.long || def.clothes.skirt)) {
      const len = def.clothes.long ? 0.78 : 0.6;
      const cg = new THREE.CylinderGeometry(0.2, def.clothes.long ? 0.3 : 0.27, len, 20, 1, true);
      cg.translate(0, -len / 2 + 0.06, 0);
      const m = new THREE.Mesh(cg, (def.clothes.skirt && !def.clothes.long ? mats[2] : mats[0]).clone());
      m.material.side = THREE.DoubleSide;
      m.castShadow = true;
      hips.add(m);
    }
    const head = bone('mixamorigHead');
    if (head && def.clothes.hat && def.clothes.hat !== 'none') {
      const hm = new THREE.MeshStandardMaterial({ color: def.clothes.hat === 'cap' ? 0x161616 : 0x141414, roughness: 0.8 });
      const hg = new THREE.Group();
      if (def.clothes.hat === 'fedora') {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.012, 28), hm);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.112, 0.12, 22), hm);
        crown.position.y = 0.065;
        hg.add(brim, crown);
        hg.position.set(0, 0.16, 0.01);
        hg.rotation.x = -0.1;
      } else if (def.clothes.hat === 'cap') {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), hm);
        c.scale.set(1.05, 0.55, 1.1);
        const peak = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.012, 0.08), hm);
        peak.position.set(0, 0, 0.11);
        hg.add(c, peak);
        hg.position.set(0, 0.155, 0.005);
      } else {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.122, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
          new THREE.MeshStandardMaterial({ color: 0x5a5650, roughness: 1 }));
        hg.add(c);
        hg.position.set(0, 0.1, -0.01);
      }
      hg.traverse((m) => { m.castShadow = true; });
      head.add(hg);
    }
    return b;
  }

  update(dt: number, sim: Sim, camPos: THREE.Vector3, dead?: Set<string>) {
    if (!this.ready) return;
    const views = new Map(npcViews(sim).map((v) => [v.id, v]));
    for (const inst of this.insts) {
      const v = views.get(inst.def.id) ?? null;
      if (dead?.has(inst.def.id)) { inst.root.visible = false; continue; }
      inst.view = v;
      if (!v) {
        inst.root.visible = false;
        continue;
      }
      inst.root.visible = true;
      const y = groundH(v.x, v.z);
      inst.root.position.set(v.x, y, v.z);
      inst.root.rotation.y = v.face;
      const dist = camPos.distanceTo(inst.root.position);
      const want = v.walking ? 'walk' : (inst.def.id === 'foma' && sim.t / 60 >= 30 ? 'idle' : v.anim);
      if (want !== inst.current) {
        for (const [name, a] of inst.actions) a.enabled = name === want;
        inst.current = want;
      }
      if (dist < 70) inst.mixer.update(dt * (v.walking ? 1 : 0.8));
    }
  }

  /** Портрет головы для журнала: рендер в маленький канвас. */
  portrait(id: string): HTMLCanvasElement | null {
    const inst = this.insts.find((i) => i.def.id === id);
    if (!inst) return null;
    const c = document.createElement('canvas');
    c.width = c.height = 156;
    const r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(156, 156, false);
    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
    const clone = SkeletonUtils.clone(inst.root) as THREE.Group;
    clone.position.set(0, 0, 0);
    clone.rotation.y = 0.4;
    sc.add(clone);
    sc.add(new THREE.HemisphereLight(0xc8d4e8, 0x1a1712, 2.2));
    const d = new THREE.DirectionalLight(0xffd9a0, 2.4);
    d.position.set(1, 2, 2);
    sc.add(d);
    // голова: ищем кость
    let headY = 1.6;
    clone.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone && /Head$/.test(b.name)) {
        const p = new THREE.Vector3();
        b.getWorldPosition(p);
        headY = p.y;
      }
    });
    cam.position.set(0.28, headY + 0.02, 0.62);
    cam.lookAt(0, headY - 0.02, 0);
    r.render(sc, cam);
    r.dispose();
    return c;
  }
}
