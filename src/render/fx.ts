import * as THREE from 'three';
import { ASSET_BASE } from './assets';
import { hrand } from '../sim/rng';

const tl = new THREE.TextureLoader();
const tex = (p: string) => { const t = tl.load(ASSET_BASE + 'particles/' + p); t.colorSpace = THREE.SRGBColorSpace; return t; };
export type FxKind = 'flame' | 'smoke' | 'dark' | 'gas' | 'moth' | 'steam';
interface P { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number; kind: FxKind; size: number; ph: number; c: THREE.Vector3 }

/** Пул спрайтов для огня, дыма, газа, мотыльков (визуал; не влияет на симуляцию). */
export class Particles {
  group = new THREE.Group(); private pool: P[] = []; private active: P[] = []; private n = 0;
  private tx: Record<FxKind, THREE.Texture> = { flame: tex('kenney/flame_03.png'), smoke: tex('smoke_white_puff/white_puff01.png'), dark: tex('smoke_black_smoke/black_smoke01.png'), gas: tex('smoke_white_puff/white_puff02.png'), moth: tex('kenney/light_01.png'), steam: tex('smoke_white_puff/white_puff00.png') };
  constructor(parent: THREE.Object3D, size = 220) {
    parent.add(this.group);
    for (let i = 0; i < size; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: true })); s.visible = false; this.group.add(s); this.pool.push({ s, v: new THREE.Vector3(), life: 0, max: 1, kind: 'smoke', size: 1, ph: 0, c: new THREE.Vector3() }); }
  }
  spawn(kind: FxKind, x: number, y: number, z: number, o: { vx?: number; vy?: number; vz?: number; life?: number; size?: number; color?: number } = {}) {
    const p = this.pool.pop(); if (!p) return;
    this.n++;
    const mat = p.s.material as THREE.SpriteMaterial; mat.map = this.tx[kind]; mat.color.setHex(o.color ?? (kind === 'gas' ? 0xaaf0b0 : kind === 'flame' ? 0xffb050 : kind === 'moth' ? 0xffd890 : 0xffffff));
    mat.blending = kind === 'flame' || kind === 'moth' ? THREE.AdditiveBlending : THREE.NormalBlending; mat.rotation = hrand(3, this.n) * 6.28;
    p.kind = kind; p.life = p.max = o.life ?? (kind === 'flame' ? 0.9 : 3); p.size = o.size ?? 1; p.ph = hrand(5, this.n) * 6.28;
    p.v.set(o.vx ?? (hrand(1, this.n) - 0.5) * 0.3, o.vy ?? 0.5, o.vz ?? (hrand(2, this.n) - 0.5) * 0.3); p.s.position.set(x, y, z); p.c.set(x, y, z); p.s.visible = true; this.active.push(p);
  }
  update(dt: number, t: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i]; p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; this.active.splice(i, 1); this.pool.push(p); continue; }
      const k = 1 - p.life / p.max; const mat = p.s.material as THREE.SpriteMaterial;
      if (p.kind === 'moth') { p.c.addScaledVector(p.v, dt); p.s.position.set(p.c.x + Math.cos(t * 3 + p.ph) * 0.45, p.c.y + Math.sin(t * 5 + p.ph) * 0.2, p.c.z + Math.sin(t * 3 + p.ph) * 0.45); mat.opacity = 0.9 * Math.sin(k * Math.PI); p.s.scale.setScalar(0.12); continue; }
      p.s.position.addScaledVector(p.v, dt);
      const grow = p.kind === 'flame' ? 1 - k * 0.6 : 0.6 + k * 1.6; p.s.scale.setScalar(p.size * grow);
      mat.opacity = p.kind === 'flame' ? (1 - k) * 0.9 : p.kind === 'dark' ? Math.sin(k * Math.PI) * 0.7 : p.kind === 'gas' ? Math.sin(k * Math.PI) * 0.35 : Math.sin(k * Math.PI) * 0.32;
    }
  }
}
