import * as THREE from 'three';
import { hrand } from '../sim/util';
import { NEON } from './textures';

/** Articulated, instanced people: legs/arms swing with distance walked; umbrellas in the rain. */
export interface PersonState { x: number; y: number; z?: number; yaw?: number; hidden?: boolean; lying?: boolean; run?: boolean; work?: boolean; face?: number }

const PARTS = ['torso', 'coat', 'head', 'hair', 'legL', 'legR', 'armL', 'armR', 'umb', 'stick', 'visor', 'device', 'bag'] as const;
type Part = typeof PARTS[number];

const SKIN = [0xe0b9a0, 0xc69077, 0x9a6b50, 0x6e4a36, 0xf1d2bf, 0x8d5a3c];
const HAIR = [0x111111, 0x2a1a12, 0x5a3a20, 0xb0a090, 0xff4fd8, 0x35f2e6, 0x8a2030, 0xe0e0e0];
const CLOTH = [0x1c1f2a, 0x2a2230, 0x30343e, 0x3a2a24, 0x1a2a2a, 0x4a3a5a, 0x5a2020, 0x203a5a, 0x6a6a70, 0x14161e, 0x0e1a24, 0x3a3a1a];

export class People {
  meshes = {} as Record<Part, THREE.InstancedMesh>;
  ids: string[] = []; idx = new Map<string, number>();
  st: { yaw: number; phase: number; px: number; py: number; speed: number; scale: number; w: number; umb: boolean; coat: boolean; hood: boolean; visor: boolean; bag: boolean }[] = [];
  private M = new THREE.Matrix4(); private T = new THREE.Matrix4(); private Q = new THREE.Quaternion(); private E = new THREE.Euler();
  private V = new THREE.Vector3(); private S = new THREE.Vector3(); private zero = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(scene: THREE.Scene, ids: string[]) {
    this.ids = ids; ids.forEach((id, i) => this.idx.set(id, i));
    const N = ids.length;
    const std = (o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05, ...o });
    const geo: Record<Part, THREE.BufferGeometry> = {
      torso: new THREE.BoxGeometry(0.44, 0.6, 0.24).translate(0, 0.3, 0),
      coat: new THREE.CylinderGeometry(0.24, 0.36, 0.72, 8, 1, true).translate(0, -0.36, 0),
      head: new THREE.SphereGeometry(0.125, 8, 6),
      hair: new THREE.SphereGeometry(0.138, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55),
      legL: new THREE.BoxGeometry(0.15, 0.84, 0.17).translate(0, -0.42, 0),
      legR: new THREE.BoxGeometry(0.15, 0.84, 0.17).translate(0, -0.42, 0),
      armL: new THREE.BoxGeometry(0.11, 0.62, 0.12).translate(0, -0.31, 0),
      armR: new THREE.BoxGeometry(0.11, 0.62, 0.12).translate(0, -0.31, 0),
      umb: new THREE.ConeGeometry(0.62, 0.28, 12, 1, true),
      stick: new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4),
      visor: new THREE.BoxGeometry(0.2, 0.035, 0.05),
      device: new THREE.BoxGeometry(0.13, 0.16, 0.14),
      bag: new THREE.BoxGeometry(0.3, 0.38, 0.14),
    };
    const mats: Record<Part, THREE.Material> = {
      torso: std(), coat: std({ side: THREE.DoubleSide }), head: std({ roughness: 0.6 }), hair: std({ roughness: 0.9 }), legL: std(), legR: std(), armL: std(), armR: std(),
      umb: new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.55, roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.35 }),
      stick: new THREE.MeshBasicMaterial({ toneMapped: false }), visor: new THREE.MeshBasicMaterial({ toneMapped: false }), device: new THREE.MeshBasicMaterial({ color: 0x35f2e6, toneMapped: false }), bag: std(),
    };
    for (const p of PARTS) {
      const m = new THREE.InstancedMesh(geo[p], mats[p], N); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.meshes[p] = m; scene.add(m);
    }
    ids.forEach((id, i) => {
      const r = (k: number) => hrand(500 + k, id);
      const player = id === 'player', child = id === 'lea' || id.startsWith('c_student');
      const c = (arr: number[], k: number) => new THREE.Color(arr[Math.floor(r(k) * arr.length)]);
      const top = player ? new THREE.Color(0x1a1e2c) : c(CLOTH, 1), pants = player ? new THREE.Color(0x0c0d12) : c(CLOTH, 2);
      const coat = player || r(3) < 0.45, umb = !player && !child && r(4) < 0.45, hood = r(5) < 0.25 && !player, visor = player || r(6) < 0.18;
      this.meshes.torso.setColorAt(i, top); this.meshes.coat.setColorAt(i, player ? new THREE.Color(0x232838) : top.clone().multiplyScalar(0.8));
      this.meshes.head.setColorAt(i, c(SKIN, 7)); this.meshes.hair.setColorAt(i, hood ? top.clone().multiplyScalar(0.7) : player ? new THREE.Color(0x111111) : c(HAIR, 8));
      this.meshes.legL.setColorAt(i, pants); this.meshes.legR.setColorAt(i, pants);
      this.meshes.armL.setColorAt(i, coat ? top.clone().multiplyScalar(0.85) : top); this.meshes.armR.setColorAt(i, coat ? top.clone().multiplyScalar(0.85) : top);
      const neon = new THREE.Color(NEON[Math.floor(r(9) * NEON.length)]);
      this.meshes.umb.setColorAt(i, r(10) < 0.5 ? neon : new THREE.Color(0x202530)); this.meshes.stick.setColorAt(i, neon.clone().multiplyScalar(2));
      this.meshes.visor.setColorAt(i, player ? new THREE.Color(0x35f2e6).multiplyScalar(2) : neon.clone().multiplyScalar(2)); this.meshes.bag.setColorAt(i, c(CLOTH, 11));
      this.meshes.device.setColorAt(i, new THREE.Color(0x35f2e6).multiplyScalar(2));
      this.st.push({ yaw: r(12) * 6.28, phase: r(13) * 6, px: 0, py: 0, speed: 0, scale: child ? 0.68 : 0.92 + r(14) * 0.16, w: 0.9 + r(15) * 0.25, umb, coat, hood, visor, bag: r(16) < 0.3 });
    });
    for (const p of PARTS) if (this.meshes[p].instanceColor) this.meshes[p].instanceColor!.needsUpdate = true;
  }

  private put(part: Part, i: number, base: THREE.Matrix4, x: number, y: number, z: number, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1, ry = 0) {
    this.Q.setFromEuler(this.E.set(rx, ry, rz)); this.T.compose(this.V.set(x, y, z), this.Q, this.S.set(sx, sy, sz));
    this.M.multiplyMatrices(base, this.T); this.meshes[part].setMatrixAt(i, this.M);
  }
  hide(i: number) { for (const p of PARTS) this.meshes[p].setMatrixAt(i, this.zero); }

  update(states: (PersonState | null)[], px: number, py: number, dt: number, raining: boolean, now: number) {
    const base = new THREE.Matrix4();
    states.forEach((s, i) => {
      const st = this.st[i];
      if (!s || s.hidden || Math.abs(s.x - px) > 260 || Math.abs(s.y - py) > 260) { this.hide(i); st.px = s?.x ?? 0; st.py = s?.y ?? 0; return; }
      const dx = s.x - st.px, dy = s.y - st.py, d = Math.hypot(dx, dy);
      if (d > 30) { st.px = s.x; st.py = s.y; st.speed = 0; } // teleport (time jump)
      else {
        st.speed = st.speed * 0.8 + (dt > 0 ? d / dt : 0) * 0.2;
        if (d > 0.002) { const ty = Math.atan2(dx, dy); let df = ty - st.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); st.yaw += df * Math.min(1, dt * 8); }
        st.phase += d * (s.run ? 1.9 : 2.6);
        st.px = s.x; st.py = s.y;
      }
      if (s.face !== undefined && st.speed < 0.2) { let df = s.face - st.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); st.yaw += df * Math.min(1, dt * 3); }
      const yaw = s.yaw !== undefined ? s.yaw : st.yaw;
      const sc = st.scale;
      this.Q.setFromEuler(this.E.set(s.lying ? -Math.PI / 2 : 0, yaw, 0));
      base.compose(this.V.set(s.x, (s.z ?? 0) + (s.lying ? 0.2 : 0), s.y), this.Q, this.S.set(sc * st.w, sc, sc));
      const moving = st.speed > 0.25 && !s.lying, amp = moving ? Math.min(0.75, 0.35 + st.speed * 0.08) : 0;
      const sw = Math.sin(st.phase) * amp, bob = moving ? Math.abs(Math.cos(st.phase)) * 0.04 : Math.sin(now * 1.5 + i) * 0.005;
      const hip = 0.92 + bob;
      this.put('legL', i, base, -0.1, hip, 0, sw, 0);
      this.put('legR', i, base, 0.1, hip, 0, -sw, 0);
      this.put('torso', i, base, 0, hip, 0, moving ? 0.06 : 0, 0, 1, 1, 1);
      if (st.coat) this.put('coat', i, base, 0, hip + 0.26, 0, 0, 0, 1, 1, 1); else this.meshes.coat.setMatrixAt(i, this.zero);
      this.put('head', i, base, 0, hip + 0.76, 0.01);
      this.put('hair', i, base, 0, hip + 0.78, -0.005, st.hood ? 0 : -0.15, 0, st.hood ? 1.18 : 1, st.hood ? 1.25 : 1, st.hood ? 1.18 : 1);
      const umb = st.umb && raining && !s.lying;
      const wk = s.work && !moving ? Math.sin(now * 3 + i) : 0;
      this.put('armL', i, base, -0.29, hip + 0.56, 0, s.work && !moving ? -0.9 + wk * 0.35 : -sw * 0.9, 0.06);
      if (umb) this.put('armR', i, base, 0.27, hip + 0.56, 0.05, -1.15, -0.1);
      else this.put('armR', i, base, 0.29, hip + 0.56, 0, s.work && !moving ? -0.9 - wk * 0.35 : sw * 0.9, -0.06);
      if (umb) { this.put('stick', i, base, 0.24, hip + 1.15, 0.33); this.put('umb', i, base, 0.2, hip + 1.6, 0.3); }
      else { this.meshes.umb.setMatrixAt(i, this.zero); this.meshes.stick.setMatrixAt(i, this.zero); }
      if (st.visor) this.put('visor', i, base, 0, hip + 0.78, 0.115); else this.meshes.visor.setMatrixAt(i, this.zero);
      if (this.ids[i] === 'player') this.put('device', i, base, -0.31, hip + 0.06, 0.02, -sw * 0.9, 0.06); else this.meshes.device.setMatrixAt(i, this.zero);
      if (st.bag) this.put('bag', i, base, 0, hip + 0.32, -0.2); else this.meshes.bag.setMatrixAt(i, this.zero);
    });
    for (const p of PARTS) this.meshes[p].instanceMatrix.needsUpdate = true;
  }
}
