import * as THREE from 'three';
import { A } from '../render/materials';
import { placed, Placed } from '../world/city';
import { Flags } from '../sim/flags';
import { at } from '../sim/time';
import { hash } from '../world/terrain';

// The city burns (user request): the story fires are only the seeds, the fire spreads building to building until most of Zaton is ablaze.
interface Seed { id: string; t: number; x: number; z: number; v: number; cap?: number; }
const MIN: Record<string, number> = { priyut: at(22, 56), chapel: at(22, 56), tavern: at(22, 36), tikhon: at(22, 45), contora: at(22, 20), warehouse: at(22, 12), foma: at(22, 30), D8: at(22, 30) };
const NEVER = new Set(['tower']);
function seeds(f: Flags): Seed[] {
  const tap = f.has('tapCut'); const v = 0.11;
  const out: Seed[] = [{ id: 'blast', t: at(22, 12), x: 66, z: 32, v: tap ? 0.06 : v, cap: tap ? 48 : undefined }, { id: 'office', t: at(22, 20), x: 44, z: 26, v: tap ? 0.06 : v, cap: tap ? 40 : undefined }];
  if (!tap) out.push({ id: 'foma', t: at(22, 30), x: -40, z: -17, v }, { id: 'post', t: at(22, 36), x: -22, z: -15, v }, { id: 'kanat', t: at(22, 45), x: -52, z: 40, v }, { id: 'north', t: at(22, 40), x: -60, z: -45, v: v * 0.9 }, { id: 'bank', t: at(22, 38), x: 22, z: -35, v: v * 0.9 });
  return out;
}
/** D6: Rynochnaya (Foma, D8) burns 22:30-22:48 and is only smouldering ruins from 22:50; other houses blaze ~28 min, then smoulder */
export function burnEnd(b: Placed, start: number): number { const k = b.id.split('#')[0]; return k === 'foma' || k === 'D8' ? at(22, 48) : start + 28 * 60; }
export function burnStart(b: Placed, f: Flags): number {
  if (NEVER.has(b.id)) return Infinity; let best = Infinity;
  for (const s of seeds(f)) { const d = Math.max(0, Math.hypot(b.x - s.x, b.z - s.z) - 6); if (s.cap !== undefined && d > s.cap) continue; best = Math.min(best, s.t + d / s.v + hash(b.x, b.z) * 40); }
  const key = b.id.split('#')[0]; if (MIN[key] !== undefined) best = key === 'contora' || key === 'warehouse' || key === 'foma' || key === 'D8' ? MIN[key] : Math.max(best, MIN[key]);
  return best;
}
/** procedural sprites: a licking multi-tongue flame (hot core, ragged edge) and a ragged smoke puff */
function blob(kind: 'flame' | 'smoke') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; g.clearRect(0, 0, 128, 128);
  if (kind === 'flame') {
    const tongue = (x: number, h: number, w: number, a: number) => { const gr = g.createLinearGradient(0, 124, 0, 124 - h); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.55, `rgba(255,255,255,${a * 0.75})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, 124); g.bezierCurveTo(x - w * 1.1, 124 - h * 0.45, x - w * 0.25, 124 - h * 0.7, x + (Math.sin(x) * 6), 124 - h); g.bezierCurveTo(x + w * 0.25, 124 - h * 0.7, x + w * 1.1, 124 - h * 0.45, x + w, 124); g.closePath(); g.fill(); };
    g.filter = 'blur(3px)'; [[30, 70, 18, 0.8], [52, 108, 22, 1], [76, 96, 21, 0.95], [98, 66, 17, 0.8], [64, 84, 26, 1], [42, 56, 16, 0.7], [88, 50, 15, 0.7]].forEach(a => tongue(a[0], a[1], a[2], a[3]));
    g.filter = 'none'; const core = g.createRadialGradient(64, 112, 2, 64, 108, 40); core.addColorStop(0, 'rgba(255,255,255,1)'); core.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = core; g.fillRect(0, 60, 128, 68);
  } else { const im = g.createImageData(128, 128); for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const u = (x - 64) / 64, v = (y - 64) / 64, n = 0.5 + 0.5 * Math.sin(x * 0.45 + y * 0.3) * Math.cos(y * 0.5 - x * 0.2), a = Math.max(0, 1 - Math.hypot(u, v)) ** 1.2 * (0.7 + 0.3 * n), i = (y * 128 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(a * 255); } g.putImageData(im, 0, 0); }
  return new THREE.CanvasTexture(c); }
const flame = blob('flame'), smokeT = blob('smoke');
const MAXB = 30, PPB = 60, SPB = 4;
export class Burn {
  starts = new Map<Placed, number>(); active: Placed[] = []; flames: THREE.Points; smoke: THREE.Points; chars: THREE.InstancedMesh; mat: THREE.ShaderMaterial; smat: THREE.ShaderMaterial; t = 0; fv = ''; count = 0;
  constructor(public scene: THREE.Scene) {
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXB * PPB * 3), 3)); fg.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAXB * PPB), 1)); fg.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(MAXB * PPB), 1)); fg.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, map: { value: flame }, uScale: { value: 520 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'attribute float aSize; attribute float aPhase; uniform float uTime, uScale; varying float vP; void main(){ float k = fract(uTime*0.9+aPhase); vec3 p = position + vec3(sin(aPhase*40.+uTime*3.)*0.3, k*0.9*aSize*0.2, cos(aPhase*30.+uTime*2.)*0.3); vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = min(260.0, aSize*(1.0-k*0.45)*uScale/max(0.5,-mv.z)); gl_Position = projectionMatrix*mv; vP = k; }',
      fragmentShader: 'uniform sampler2D map; varying float vP; void main(){ vec4 c = texture2D(map, vec2(gl_PointCoord.x, 1.0-gl_PointCoord.y)); vec3 col = mix(vec3(1.0,0.62,0.16), vec3(0.85,0.16,0.02), vP); gl_FragColor = vec4(col*c.a*0.5, c.a*(1.0-vP*0.6)*0.6); }' });
    this.flames = new THREE.Points(fg, this.mat); this.flames.frustumCulled = false; this.flames.renderOrder = 4; scene.add(this.flames);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXB * SPB * 3), 3)); sg.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAXB * SPB), 1)); sg.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(MAXB * SPB), 1)); sg.setDrawRange(0, 0);
    this.smat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, map: { value: smokeT }, uScale: { value: 520 } }, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'attribute float aSize; attribute float aPhase; uniform float uTime, uScale; varying float vK; void main(){ float k = fract(uTime*0.07+aPhase); vec3 p = position + vec3(k*9.0, 4.0+k*34.0, k*3.0); vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = min(300.0, aSize*(0.6+k*2.6)*uScale/max(0.5,-mv.z)); gl_Position = projectionMatrix*mv; vK = k; }',
      fragmentShader: 'uniform sampler2D map; varying float vK; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.035,0.03,0.03), c.a*(1.0-vK)*0.5); }' });
    this.smoke = new THREE.Points(sg, this.smat); this.smoke.frustumCulled = false; this.smoke.renderOrder = 3; scene.add(this.smoke);
    this.chars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity: 0.62, depthWrite: false }), MAXB); this.chars.frustumCulled = false; this.chars.count = 0; scene.add(this.chars);
  }
  rebuild(f: Flags) { this.fv = f.hash(); this.starts.clear(); for (const b of placed) { const s = burnStart(b, f); if (s < Infinity) this.starts.set(b, s); } }
  /** is a point inside a building that is burning hard (the jump is refused there) */
  fireAt(x: number, z: number, t: number, f: Flags): boolean { for (const b of this.starts.keys()) { const s = this.starts.get(b)!; if (t < s + 30 || t > burnEnd(b, s)) continue; const dx = x - b.x, dz = z - b.z, c = Math.cos(b.ry), sn = Math.sin(b.ry), lx = dx * c - dz * sn, lz = dx * sn + dz * c; if (Math.abs(lx) < b.w / 2 + 1 && lz < 1 && lz > -b.depth - 1) return true; } void f; return false; }
  /** burning fraction of the city (for the glow in the sky) and the nearest burning buildings (for lights) */
  update(t: number, f: Flags, px: number, pz: number, dt: number) {
    this.t += dt; this.mat.uniforms.uTime.value = this.t; this.smat.uniforms.uTime.value = this.t;
    const ver = f.hash(); if (ver !== this.fv) { this.fv = ver; this.starts.clear(); for (const b of placed) { const s = burnStart(b, f); if (s < Infinity) this.starts.set(b, s); } }
    this.refresh = (this.refresh ?? 0) - dt; if (this.refresh > 0) return; this.refresh = 0.7;
    const cand: { b: Placed; d: number; k: number; age: number }[] = []; let burning = 0;
    for (const [b, s] of this.starts) { if (t < s) continue; burning++; const d = Math.hypot(b.x - px, b.z - pz); const end = burnEnd(b, s), k = t > end ? 0 : Math.min(1, (t - s) / 100) * Math.min(1, (end - t) / 90); if (d < 130) cand.push({ b, d, k, age: t - s }); }
    cand.sort((a, b) => a.d - b.d); const use = cand.slice(0, MAXB); this.active = use.map(u => u.b); this.burning = burning; this.lightList = use.slice(0, 8).map(u => ({ x: u.b.x, z: u.b.z, y: u.b.base + Math.min(8, u.b.H * 0.6), k: u.k }));
    const pos = (this.flames.geometry.attributes.position as THREE.BufferAttribute), sz = this.flames.geometry.attributes.aSize as THREE.BufferAttribute, ph = this.flames.geometry.attributes.aPhase as THREE.BufferAttribute;
    const spos = (this.smoke.geometry.attributes.position as THREE.BufferAttribute), ssz = this.smoke.geometry.attributes.aSize as THREE.BufferAttribute, sph = this.smoke.geometry.attributes.aPhase as THREE.BufferAttribute;
    let n = 0, sn = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let ci = 0;
    use.forEach(({ b, k, age }) => {
      const c = Math.cos(b.ry), sn_ = Math.sin(b.ry), P = (lx: number, ly: number, lz: number) => [b.x + lx * c + lz * sn_, b.base + ly, b.z - lx * sn_ + lz * c];
      const nF = Math.min(PPB, 22 + Math.round(b.w * 3.2 * k)); const wane = age > 1500 ? 0.8 : 1;
      for (let i = 0; i < nF; i++) { const r1 = hash(b.x + i, b.z), r2 = hash(i, b.z * 1.3), r3 = hash(b.x * 0.7, i + 3);
        const kind = i % 3, lx = (r1 - 0.5) * b.w, ly = kind === 0 ? b.H * (0.75 + 0.3 * r2) : b.H * (0.12 + 0.7 * r2), lz = kind === 2 ? -r3 * b.depth : 0.5 + r3 * 0.4;
        const [x, y, z] = P(lx, ly, lz); pos.setXYZ(n, x, y, z); sz.setX(n, (2.4 + r3 * 2.2) * k * wane * (kind === 0 ? 1.4 : 1)); ph.setX(n, r1 * 7.3); n++; }
      for (let i = 0; i < SPB; i++) { const [x, y, z] = P((hash(i, b.x) - 0.5) * b.w * 0.8, b.H, -b.depth * (0.2 + 0.6 * hash(b.z, i))); spos.setXYZ(sn, x, y, z); ssz.setX(sn, 7 + hash(i, b.z) * 6); sph.setX(sn, hash(b.x, i + b.z)); sn++; }
      m4.compose(new THREE.Vector3(...(P(0, b.H / 2 - 1.4, -b.depth / 2) as [number, number, number])), q.setFromEuler(new THREE.Euler(0, b.ry, 0)), new THREE.Vector3(b.w + 0.25, b.H + 1.2, b.depth + 0.25)); this.chars.setMatrixAt(ci++, m4);
      (this.chars.material as THREE.MeshBasicMaterial).opacity = 0.5;
    });
    pos.needsUpdate = sz.needsUpdate = ph.needsUpdate = true; spos.needsUpdate = ssz.needsUpdate = sph.needsUpdate = true; this.flames.geometry.setDrawRange(0, n); this.smoke.geometry.setDrawRange(0, sn); this.chars.count = ci; this.chars.instanceMatrix.needsUpdate = true; this.count = n;
  }
  refresh = 0; burning = 0; lightList: { x: number; y: number; z: number; k: number }[] = [];
  /** share of the city on fire, 0..1 (sky glow) */
  share(): number { return Math.min(1, this.burning / Math.max(1, this.starts.size * 0.8)) ; }
  lights(t: number) { return this.lightList.map(l => ({ x: l.x, y: l.y, z: l.z, color: 0xff7a30, intensity: (20 + Math.sin(t * 13 + l.x) * 6) * l.k, dist: 26 })); }
}
