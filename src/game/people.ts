import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SU from 'three/addons/utils/SkeletonUtils.js';
import { A } from '../render/materials';

// Mixamo bodies + clothing shell + code hats + UAL animations retargeted (spec 3.5 / asset guide 4)
const loader = new GLTFLoader(); const files = new Map<string, Promise<any>>();
const gl = (p: string) => files.get(p) ?? (files.set(p, loader.loadAsync(A + 'models/' + p + '.glb')), files.get(p)!);
const MAP: Record<string, string> = { mixamorigHips: 'pelvis', mixamorigSpine: 'spine_01', mixamorigSpine1: 'spine_02', mixamorigSpine2: 'spine_03', mixamorigNeck: 'neck_01', mixamorigHead: 'Head',
  mixamorigLeftShoulder: 'clavicle_l', mixamorigLeftArm: 'upperarm_l', mixamorigLeftForeArm: 'lowerarm_l', mixamorigLeftHand: 'hand_l', mixamorigRightShoulder: 'clavicle_r', mixamorigRightArm: 'upperarm_r', mixamorigRightForeArm: 'lowerarm_r', mixamorigRightHand: 'hand_r',
  mixamorigLeftUpLeg: 'thigh_l', mixamorigLeftLeg: 'calf_l', mixamorigLeftFoot: 'foot_l', mixamorigRightUpLeg: 'thigh_r', mixamorigRightLeg: 'calf_r', mixamorigRightFoot: 'foot_r' };
/** our animation names -> where they come from */
const UAL: Record<string, string> = { idle: 'Idle_Loop', talk: 'Idle_Talking_Loop', fold: 'Idle_FoldArms_Loop', rail: 'Idle_Rail_Loop', lantern: 'Idle_Lantern_Loop', sit: 'Sitting_Idle_Loop', sittalk: 'Sitting_Talking_Loop',
  drive: 'Driving_Loop', carry: 'Walk_Carry_Loop', pistol: 'Pistol_Idle_Loop', aim: 'Pistol_Aim_Neutral', no: 'Idle_No_Loop', phone: 'Idle_TalkingPhone_Loop', fix: 'Fixing_Kneeling', pickup: 'PickUp_Table', interact: 'Interact', yes: 'Yes', cry: 'Sitting_Idle_Loop', push: 'Push_Loop', punch: 'Punch_Jab', consume: 'Consume', yell: 'Idle_Rail_Call', formal: 'Walk_Formal_Loop', sweep: 'Farm_Harvest', hit2: 'Hit_Chest' };
const MIX: Record<string, string> = { walk: 'walk', run: 'run', shoot: 'idle-shooting', die: 'dying', hit: 'hit-reaction', kneel: 'kneel', creep: 'crouch-walking', reload: 'reloading' };
const ONCE = new Set(['die', 'hit', 'hit2', 'pickup', 'interact', 'punch', 'consume']);

export interface Look {
  body: 'james' | 'remy' | 'liza' | 'michelle'; coat: number; trou?: number; long?: boolean; skirt?: boolean;
  hat?: 'fedora' | 'cap' | 'scarf' | 'peaked' | 'veil' | 'nun' | 'none'; scale?: number; hair?: number; extra?: ('cane' | 'lantern' | 'case' | 'revolver' | 'apron' | 'ribbon' | 'badge' | 'scar' | 'beard')[]; skin?: number;
}
let ualData: Promise<{ skin: THREE.SkinnedMesh; clips: THREE.AnimationClip[] }> | undefined;
const loadUal = () => ualData ??= Promise.all([gl('people/universal/anims/ual1'), gl('people/universal/anims/ual2')]).then(([a, b]) => {
  let skin: THREE.SkinnedMesh | undefined; a.scene.traverse((o: any) => { if (o.isSkinnedMesh && !skin) skin = o; });
  return { skin: skin!, clips: [...a.animations, ...b.animations] as THREE.AnimationClip[] };
});
const clipCache = new Map<string, { clip: THREE.AnimationClip; retargeted: boolean } | null>();

export class Person {
  root = new THREE.Group(); mixer!: THREE.AnimationMixer; meshMixer!: THREE.AnimationMixer; body!: THREE.SkinnedMesh; cur = ''; action?: THREE.AnimationAction; headY = 1.62; height = 1.75;
  extra: THREE.Object3D[] = []; ghost = false; id = ''; dead = false;
  constructor(public look: Look) {}
  async anim(name: string, speed = 1) {
    if (name === this.cur) return; this.cur = name;
    const got = await this.clip(name); if (!got || name !== this.cur) return;
    // clips retargeted from UAL address `.bones[...]` and must be played by a mixer rooted at the skinned mesh; Mixamo clips by the root group
    const mx = got.retargeted ? this.meshMixer : this.mixer;
    const next = mx.clipAction(got.clip); next.reset(); next.setLoop(ONCE.has(name) ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); next.clampWhenFinished = true; next.timeScale = speed;
    next.time = (this.id.length * 0.37 + this.look.coat % 7) % Math.max(0.5, got.clip.duration); next.setEffectiveWeight(1);
    if (this.action) { this.action.fadeOut(0.25); next.fadeIn(0.25); } next.play(); this.action = next;
  }
  private async clip(name: string): Promise<{ clip: THREE.AnimationClip; retargeted: boolean } | null> {
    const key = this.look.body + '/' + name; const hit = clipCache.get(key); if (hit !== undefined) return hit;
    let out: { clip: THREE.AnimationClip; retargeted: boolean } | null = null;
    try {
      if (MIX[name]) { const g = await gl('people/mixamo/mixamo_anims'); const c = g.animations.find((a: THREE.AnimationClip) => a.name === MIX[name]); out = c ? { clip: c, retargeted: false } : null; }
      else if (UAL[name]) { const u = await loadUal(); const src = u.clips.find(c => c.name === UAL[name]); if (src) { const c = SU.retargetClip(this.body, u.skin, src, { names: MAP, hip: 'mixamorigHips', useFirstFramePosition: true }); c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion'));
        this.restore(); /* retargetClip leaves the target bones scaled x100 (Armature 0.01): put them back */ out = { clip: c, retargeted: true }; } }
    } catch (e) { console.warn('anim', name, e); }
    clipCache.set(key, out); return out;
  }
  rest: { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }[] = [];
  snapshot() { this.rest = this.body.skeleton.bones.map(b => ({ p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() })); }
  restore() { this.body.skeleton.bones.forEach((b, i) => { const r = this.rest[i]; if (r) { b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); } }); this.root.updateMatrixWorld(true); }
  update(dt: number) { this.mixer.update(dt); this.meshMixer.update(dt); }
  dispose() { this.root.removeFromParent(); this.mixer.stopAllAction(); this.meshMixer.stopAllAction(); }
}

export async function createPerson(look: Look, id = ''): Promise<Person> {
  const p = new Person(look); p.id = id;
  const g = await gl('people/mixamo/' + look.body); const root = SU.clone(g.scene) as THREE.Group; p.root.add(root);
  root.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
  p.root.updateMatrixWorld(true);
  // --- scale: head bone at ~1.62 m (children: x0.6)
  let head: THREE.Object3D | undefined; root.traverse(o => { if (o.name === 'mixamorigHead') head = o; });
  const hv = new THREE.Vector3(); head!.getWorldPosition(hv); const rv = new THREE.Vector3(); p.root.getWorldPosition(rv);
  const BODY_K: Record<string, number> = { james: 1, remy: 0.96, liza: 0.93, michelle: 0.8 };
  const k = (1.62 * (look.scale ?? 1) * BODY_K[look.body]) / Math.max(0.01, hv.y - rv.y); root.scale.multiplyScalar(k); p.root.updateMatrixWorld(true);
  p.height = 1.75 * (look.scale ?? 1);
  p.body = clothe(root, look); p.snapshot();
  p.mixer = new THREE.AnimationMixer(root); p.meshMixer = new THREE.AnimationMixer(p.body);
  return p;
}

function clothe(root: THREE.Object3D, o: Look): THREE.SkinnedMesh {
  let body: THREE.SkinnedMesh | null = null; root.traverse((m: any) => { if (m.isSkinnedMesh && (!body || m.geometry.attributes.position.count > body.geometry.attributes.position.count)) body = m; });
  const b = body!; const sk = b.skeleton, bn = sk.bones.map(x => x.name), geo = b.geometry, pos = geo.attributes.position, nor = geo.attributes.normal, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  root.updateMatrixWorld(true); geo.computeBoundingBox(); const unit = (geo.boundingBox!.max.y - geo.boundingBox!.min.y) > 10 ? 100 : 1;
  const boneUnit = (bone: THREE.Object3D) => { const v = new THREE.Vector3(); bone.getWorldScale(v); return 1 / v.x; };
  const region = new Int8Array(pos.count);
  for (let i = 0; i < pos.count; i++) { let best = 0, bi = 0; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > best) { best = w; bi = si.getComponent(i, k); } } const n = bn[bi] || '';
    region[i] = /Head|Eye|Neck/.test(n) ? 0 : /Hand/.test(n) ? 0 : /Foot|Toe/.test(n) ? 3 : /UpLeg|Leg/.test(n) ? 2 : 1; }
  const mats = [new THREE.MeshStandardMaterial({ color: o.coat, roughness: 0.92 }), new THREE.MeshStandardMaterial({ color: o.trou ?? 0x1c1c1e, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x0d0c0c, roughness: 0.35 })];
  const idx = geo.index ? geo.index.array : [...Array(pos.count).keys()]; const groups: number[][] = [[], [], []];
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], bb = idx[t + 1], c = idx[t + 2]; if (!region[a] || !region[bb] || !region[c]) continue; groups[Math.max(region[a], region[bb], region[c]) - 1].push(a, bb, c); }
  const sh = geo.clone(); const p2 = sh.attributes.position; const off = [0, 0.03, 0.022, 0.012];
  for (let i = 0; i < p2.count; i++) { const f = off[region[i]] * unit; p2.setXYZ(i, p2.getX(i) + nor.getX(i) * f, p2.getY(i) + nor.getY(i) * f, p2.getZ(i) + nor.getZ(i) * f); }
  sh.setIndex([...groups[0], ...groups[1], ...groups[2]]); sh.clearGroups(); sh.addGroup(0, groups[0].length, 0); sh.addGroup(groups[0].length, groups[1].length, 1); sh.addGroup(groups[0].length + groups[1].length, groups[2].length, 2);
  const shell = new THREE.SkinnedMesh(sh, mats); shell.bind(sk, b.bindMatrix); shell.castShadow = true; shell.frustumCulled = false; b.parent!.add(shell);
  // the original body keeps only skin that shows (head, neck, hands): the clothed parts are covered by the shell, so halve the triangle count
  { const keep: number[] = []; for (let t = 0; t < idx.length; t += 3) if (!region[idx[t]] && !region[idx[t + 1]] && !region[idx[t + 2]]) keep.push(idx[t], idx[t + 1], idx[t + 2]); const hg = geo.clone(); hg.setIndex(keep); hg.clearGroups(); b.geometry = hg; }
  root.traverse((m: any) => { if (m.isSkinnedMesh && m !== b && m !== shell && !/Hair|hair|lash/.test(m.material?.name || '')) m.visible = false; });
  // body skin stays the model's own; tint hair if asked
  if (o.hair !== undefined) root.traverse((m: any) => { if (m.isMesh && /Hair|hair/.test(m.material?.name || '')) { m.material = m.material.clone(); m.material.color.setHex(o.hair!); } });
  const bone = (n: string) => sk.bones.find(x => x.name === n)!;
  const hips = bone('mixamorigHips'), head = bone('mixamorigHead');
  if (o.long || o.skirt) { const len = o.long ? 0.78 : 0.6, cg = new THREE.CylinderGeometry(0.2, o.long ? 0.3 : 0.27, len, 20, 1, true); cg.translate(0, -len / 2 + 0.06, 0);
    const m = new THREE.Mesh(cg, (o.skirt && !o.long ? mats[1] : mats[0]).clone()); (m.material as THREE.Material).side = THREE.DoubleSide; m.castShadow = true; m.scale.setScalar(boneUnit(hips)); hips.add(m); }
  const hu = boneUnit(head), hm = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.8 }), hg = new THREE.Group(); let hasHat = true;
  switch (o.hat ?? 'fedora') {
    case 'fedora': { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.012, 28), hm), cr = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.112, 0.12, 22), hm); cr.position.y = 0.065; const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.113, 0.113, 0.028, 22), new THREE.MeshStandardMaterial({ color: 0x080808 })); bd.position.y = 0.02; hg.add(br, cr, bd); hg.position.set(0, 0.16, 0.01); hg.rotation.x = -0.1; break; }
    case 'cap': { const c = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), hm); c.scale.set(1.05, 0.55, 1.1); const pk = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.012, 0.08), hm); pk.position.set(0, 0, 0.11); hg.add(c, pk); hg.position.set(0, 0.155, 0.005); break; }
    case 'peaked': { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.125, 0.09, 20), hm); c.position.y = 0.05; const pk = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.01, 0.09), hm); pk.position.set(0, 0.0, 0.12); hg.add(c, pk); hg.position.set(0, 0.155, 0.005); break; }
    case 'scarf': { const c = new THREE.Mesh(new THREE.SphereGeometry(0.122, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: 0x5a5650, roughness: 1 })); hg.add(c); hg.position.set(0, 0.1, -0.01); break; }
    case 'veil': { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.07, 18), hm); c.position.y = 0.06; const v = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.17), new THREE.MeshStandardMaterial({ color: 0x050505, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); v.position.set(0, -0.04, 0.12); hg.add(c, v); hg.position.set(0, 0.16, 0.0); break; }
    case 'nun': { const c = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.66), new THREE.MeshStandardMaterial({ color: 0xcfcabc, roughness: 1 })); hg.add(c); hg.position.set(0, 0.1, -0.01); break; }
    default: hasHat = false;
  }
  if (hasHat) { hg.traverse(m => { m.castShadow = true; }); hg.scale.setScalar(hu); hg.position.multiplyScalar(hu); head.add(hg); }
  // small attachments in bone-local units
  const att = (parent: THREE.Object3D, obj: THREE.Object3D, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => { const u = boneUnit(parent); obj.scale.setScalar(u); obj.position.set(pos[0] * u, pos[1] * u, pos[2] * u); obj.rotation.set(...rot); obj.traverse(m => { m.castShadow = true; }); parent.add(obj); };
  const dark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.4 });
  for (const e of o.extra ?? []) {
    if (e === 'cane') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 8), dark); att(bone('mixamorigRightHand'), c, [0, -0.28, 0.04]); }
    if (e === 'lantern') { const l = new THREE.Group(); const cage = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), dark); const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc080).multiplyScalar(3) })); l.add(cage, f); att(bone('mixamorigRightHand'), l, [0, -0.18, 0.05]); }
    if (e === 'case') { const c = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.12), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.6 })); att(bone('mixamorigRightHand'), c, [0, -0.25, 0.04]); }
    if (e === 'revolver') { const r = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.2), dark); att(bone('mixamorigRightHand'), r, [0, 0.0, 0.1]); }
    if (e === 'apron') { const a = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.6), new THREE.MeshStandardMaterial({ color: 0xcfc9bb, side: THREE.DoubleSide, roughness: 1 })); a.position.set(0, -0.3, 0.2); a.scale.setScalar(boneUnit(hips)); a.position.multiplyScalar(boneUnit(hips)); hips.add(a); }
    if (e === 'badge') { const bd = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8, roughness: 0.3 })); bd.position.set(0, 0.09, 0.125); const u = boneUnit(head); bd.scale.setScalar(u); bd.position.multiplyScalar(u); head.add(bd); }
    if (e === 'ribbon') { const rb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.02), new THREE.MeshStandardMaterial({ color: 0xa00a0a, emissive: 0x2a0000 })); att(head, rb, [0, 0.05, -0.12]); }
    if (e === 'scar') { const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.11), new THREE.MeshBasicMaterial({ color: 0x1a1010 })); sc.rotation.z = 0.5; att(head, sc, [0.03, 0.07, 0.112]); }
    if (e === 'beard') { const bd = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 1 })); bd.scale.set(1, 1.1, 0.8); att(head, bd, [0, 0.0, 0.085]); }
  }
  return b;
}
