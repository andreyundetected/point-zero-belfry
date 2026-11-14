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
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!; g.clearRect(0, 0, 256, 256);
  if (kind === 'flame') {
    // a 2x2 atlas of four different tongue sets, so neighbouring particles never look like copies
    const tongue = (x: number, h: number, w: number, a: number, lean: number) => { const gr = g.createLinearGradient(0, 124, 0, 124 - h); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.5, `rgba(255,255,255,${a * 0.8})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, 124); g.bezierCurveTo(x - w * 1.15, 124 - h * 0.4, x - w * 0.2 + lean * 0.5, 124 - h * 0.72, x + lean, 124 - h); g.bezierCurveTo(x + w * 0.2 + lean * 0.5, 124 - h * 0.72, x + w * 1.15, 124 - h * 0.4, x + w, 124); g.closePath(); g.fill(); };
    const sets: [number, number, number, number, number][][] = [
      [[34, 66, 17, 0.75, -6], [58, 110, 22, 1, 4], [84, 90, 20, 0.9, 10], [100, 58, 14, 0.7, 6], [66, 80, 26, 1, 0]],
      [[28, 54, 14, 0.7, -8], [50, 92, 20, 0.95, -4], [70, 118, 21, 1, 2], [96, 76, 18, 0.85, 12], [60, 70, 28, 1, 0], [112, 44, 10, 0.6, 8]],
      [[40, 100, 24, 1, -10], [72, 72, 19, 0.9, 0], [92, 104, 20, 0.95, 8], [56, 50, 16, 0.75, -3], [66, 86, 30, 1, 0]],
      [[30, 80, 16, 0.8, -4], [52, 60, 15, 0.8, -8], [68, 116, 24, 1, 0], [90, 84, 18, 0.9, 10], [106, 62, 14, 0.7, 12], [64, 76, 30, 1, 2]]];
    sets.forEach((set, i) => { g.save(); g.translate((i % 2) * 128, Math.floor(i / 2) * 128); g.filter = 'blur(1.5px)'; set.forEach(a => tongue(...a)); g.filter = 'none';
      const core = g.createRadialGradient(64, 114, 2, 64, 110, 34); core.addColorStop(0, 'rgba(255,255,255,1)'); core.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = core; g.fillRect(0, 70, 128, 58); g.restore(); });
  } else { const im = g.createImageData(256, 256); for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const u = (x - 128) / 128, v = (y - 128) / 128, n = 0.5 + 0.5 * Math.sin(x * 0.22 + y * 0.15) * Math.cos(y * 0.25 - x * 0.1), a = Math.max(0, 1 - Math.hypot(u, v)) ** 1.2 * (0.7 + 0.3 * n), i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(a * 255); } g.putImageData(im, 0, 0); }
  return new THREE.CanvasTexture(c); }
const flame = blob('flame'), smokeT = blob('smoke');
const MAXB = 30, PPB = 120, SPB = 4;
export class Burn {
  sparks!: THREE.Points; kmat!: THREE.ShaderMaterial;
  starts = new Map<Placed, number>(); active: Placed[] = []; flames: THREE.Points; smoke: THREE.Points; chars: THREE.InstancedMesh; mat: THREE.ShaderMaterial; smat: THREE.ShaderMaterial; t = 0; fv = ''; count = 0;
  constructor(public scene: THREE.Scene) {
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXB * PPB * 3), 3)); fg.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAXB * PPB), 1)); fg.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(MAXB * PPB), 1)); fg.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, map: { value: flame }, uScale: { value: 520 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'attribute float aSize; attribute float aPhase; uniform float uTime, uScale; varying float vP; varying float vM; void main(){ vM = aPhase; float k = fract(uTime*(0.55+fract(aPhase*3.1)*0.35)+aPhase); float rise = aSize*1.3; vec3 p = position + vec3(sin(aPhase*40.+uTime*2.5+k*6.)*0.1*aSize, k*rise, cos(aPhase*30.+uTime*2.)*0.1*aSize); vec4 mv = modelViewMatrix*vec4(p,1.); float s = aSize*(0.8+0.5*fract(aPhase*5.3))*(1.4-1.1*k)*min(1.0, 0.3+k*4.0); gl_PointSize = min(140.0, s*uScale/max(0.5,-mv.z)); gl_Position = projectionMatrix*mv; vP = k; }',
      fragmentShader: 'uniform sampler2D map; varying float vP; varying float vM; void main(){ float fx = fract(vM*7.0) > 0.5 ? 1.0-gl_PointCoord.x : gl_PointCoord.x; float q = floor(fract(vM*13.0)*4.0); vec2 uv = (vec2(fx, 1.0-gl_PointCoord.y) + vec2(mod(q,2.0), floor(q/2.0))) * 0.5; vec4 c = texture2D(map, uv); vec3 col = mix(vec3(1.0,0.88,0.5), mix(vec3(1.0,0.55,0.12), vec3(0.9,0.22,0.03), smoothstep(0.35,1.0,vP)), smoothstep(0.0,0.3,vP)); float a = pow(c.a, 1.6)*pow(1.0-vP, 2.2)*min(1.0, vP*8.0); gl_FragColor = vec4(col*a*1.1, a*0.7); }' });
    this.flames = new THREE.Points(fg, this.mat); this.flames.frustumCulled = false; this.flames.renderOrder = 4; scene.add(this.flames);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXB * SPB * 3), 3)); sg.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAXB * SPB), 1)); sg.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(MAXB * SPB), 1)); sg.setDrawRange(0, 0);
    this.smat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, map: { value: smokeT }, uScale: { value: 520 } }, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'attribute float aSize; attribute float aPhase; uniform float uTime, uScale; varying float vK; void main(){ float k = fract(uTime*0.07+aPhase); vec3 p = position + vec3(k*9.0, 4.0+k*34.0, k*3.0); vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = min(300.0, aSize*(0.6+k*2.6)*uScale/max(0.5,-mv.z)); gl_Position = projectionMatrix*mv; vK = k; }',
      fragmentShader: 'uniform sampler2D map; varying float vK; void main(){ vec4 c = texture2D(map, gl_PointCoord); vec3 col = mix(vec3(0.42,0.15,0.04), vec3(0.035,0.03,0.03), smoothstep(0.0,0.3,vK)); gl_FragColor = vec4(col, c.a*(1.0-vK)*0.55); /* lit from below by the fire */ }' });
    this.smoke = new THREE.Points(sg, this.smat); this.smoke.frustumCulled = false; this.smoke.renderOrder = 3; scene.add(this.smoke);
    const kg = new THREE.BufferGeometry(); kg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXB * 10 * 3), 3)); kg.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(MAXB * 10), 1)); kg.setDrawRange(0, 0);
    this.kmat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'attribute float aPhase; uniform float uTime; varying float vK; void main(){ float k = fract(uTime*0.45+aPhase); vec3 p = position + vec3(sin(aPhase*50.+uTime)*2.5*k, k*16., cos(aPhase*37.)*2.5*k); vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = 70.0/max(1.0,-mv.z); gl_Position = projectionMatrix*mv; vK = k; }',
      fragmentShader: 'varying float vK; void main(){ float d = length(gl_PointCoord-0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0,0.7,0.25)*(1.0-vK), (1.0-vK)*(1.0-d*2.0)); }' });
    this.sparks = new THREE.Points(kg, this.kmat); this.sparks.frustumCulled = false; scene.add(this.sparks);
    this.chars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity: 0.62, depthWrite: false }), MAXB); this.chars.frustumCulled = false; this.chars.count = 0; scene.add(this.chars);
  }
  rebuild(f: Flags) { this.fv = f.hash(); this.starts.clear(); for (const b of placed) { const s = burnStart(b, f); if (s < Infinity) this.starts.set(b, s); } }
  /** is a point inside a building that is burning hard (the jump is refused there) */
  fireAt(x: number, z: number, t: number, f: Flags): boolean { for (const b of this.starts.keys()) { const s = this.starts.get(b)!; if (t < s + 30 || t > burnEnd(b, s)) continue; const dx = x - b.x, dz = z - b.z, c = Math.cos(b.ry), sn = Math.sin(b.ry), lx = dx * c - dz * sn, lz = dx * sn + dz * c; if (Math.abs(lx) < b.w / 2 + 1 && lz < 1 && lz > -b.depth - 1) return true; } void f; return false; }
  /** is a strongly burning building within r metres (for people who keep away from flames) */
  nearFire(x: number, z: number, r: number): boolean { for (const b of this.active) { if (Math.hypot(b.x - x, b.z - z) < r + b.w / 2) return true; } return false; }
  /** burning fraction of the city (for the glow in the sky) and the nearest burning buildings (for lights) */
  update(t: number, f: Flags, px: number, pz: number, dt: number) {
    this.t += dt; this.mat.uniforms.uTime.value = this.t; this.kmat.uniforms.uTime.value = this.t; this.smat.uniforms.uTime.value = this.t;
    const ver = f.hash(); if (ver !== this.fv) { this.fv = ver; this.starts.clear(); for (const b of placed) { const s = burnStart(b, f); if (s < Infinity) this.starts.set(b, s); } }
    this.refresh = (this.refresh ?? 0) - dt; if (this.refresh > 0) return; this.refresh = 0.7;
    const cand: { b: Placed; d: number; k: number; age: number }[] = []; let burning = 0;
    for (const [b, s] of this.starts) { if (t < s) continue; burning++; const d = Math.hypot(b.x - px, b.z - pz); const end = burnEnd(b, s), k = t > end ? 0 : Math.min(1, (t - s) / 100) * Math.min(1, (end - t) / 90); if (d < 130) cand.push({ b, d, k, age: t - s }); }
    cand.sort((a, b) => a.d - b.d); const use = cand.slice(0, MAXB); this.active = use.map(u => u.b); this.burning = burning; this.lightList = use.slice(0, 8).map(u => ({ x: u.b.x, z: u.b.z, y: u.b.base + Math.min(8, u.b.H * 0.6), k: u.k }));
    const pos = (this.flames.geometry.attributes.position as THREE.BufferAttribute), sz = this.flames.geometry.attributes.aSize as THREE.BufferAttribute, ph = this.flames.geometry.attributes.aPhase as THREE.BufferAttribute;
    const spos = (this.smoke.geometry.attributes.position as THREE.BufferAttribute), ssz = this.smoke.geometry.attributes.aSize as THREE.BufferAttribute, sph = this.smoke.geometry.attributes.aPhase as THREE.BufferAttribute;
    const kpos = this.sparks.geometry.attributes.position as THREE.BufferAttribute, kph = this.sparks.geometry.attributes.aPhase as THREE.BufferAttribute; let kn = 0;
    let n = 0, sn = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let ci = 0;
    use.forEach(({ b, k, age }) => {
      const c = Math.cos(b.ry), sn_ = Math.sin(b.ry), P = (lx: number, ly: number, lz: number) => [b.x + lx * c + lz * sn_, b.base + ly, b.z - lx * sn_ + lz * c];
      // where a house really burns: out of the window openings (bay grid of the generator), along the eave, and a column above the roof
      const wane = age > 1500 ? 0.8 : 1, FH = 3.1, bays = Math.max(2, Math.round(b.w / 2.3)), bw = b.w / bays, floors = Math.max(1, b.floors);
      const put = (lx: number, ly: number, lz: number, size: number, seed: number) => { if (n >= MAXB * PPB) return; const [x, y, z] = P(lx, ly, lz); pos.setXYZ(n, x, y, z); sz.setX(n, size * k * wane); ph.setX(n, hash(seed, lx + ly) * 7.3); n++; };
      // a source = a small column of 4-6 overlapping puffs rising ~2 m: windows first (the sprite at the sill, licking up the wall), then the eave, then the roof
      let budget = Math.hypot(b.x - px, b.z - pz) < 45 ? PPB : 40; const src = (lx: number, ly: number, lz: number, size: number, cnt: number, seed: number) => { for (let j = 0; j < cnt && budget > 0; j++, budget--) put(lx + (hash(seed, j) - 0.5) * 0.45 * size, ly + hash(j, seed) * 0.9 * size - 0.3 * size, lz, size * (0.6 + 0.6 * hash(j + 5, seed)), seed * 7 + j); };
      const wins: [number, number, number][] = []; for (let f = 0; f < floors; f++) for (let bI = 0; bI < bays; bI++) { const r = hash(b.x + bI, b.z + f); if (r > 0.3) wins.push([-b.w / 2 + bw * (bI + 0.5), 0.35 + f * FH + 1.9, r]); }
      wins.sort((a, b2) => a[2] - b2[2]); for (const [lx, ly, r] of wins.slice(0, Math.min(6, Math.floor(budget * 0.5 / 10)))) src(lx, ly, 0.3, 0.9 + r * 0.4, 10, Math.round(lx * 10 + ly));
      for (let e = 0; e < bays && budget > 8; e++) { const lx = -b.w / 2 + (e + 0.5) * bw, r = hash(e, b.x); src(lx, b.H + 0.1, -0.5 - r * 1.5, 1.2 + r * 0.7, 8, e + 11); }
      for (let c2 = 0; c2 < 3 && budget > 0; c2++) { const r = hash(c2, b.z + 2); src((r - 0.5) * b.w * 0.5, b.H + 0.4, -b.depth * (0.25 + 0.5 * hash(c2, b.x)), 1.5 + r * 0.8, 12, c2 + 31); }
      if (k > 0.2) for (let i = 0; i < 10; i++) { const [x, y, z] = P((hash(i, b.z) - 0.5) * b.w * 0.8, b.H * 0.8, -b.depth * hash(b.x, i)); kpos.setXYZ(kn, x, y, z); kph.setX(kn, hash(i + 3, b.x + b.z)); kn++; }
      for (let i = 0; i < SPB; i++) { const [x, y, z] = P((hash(i, b.x) - 0.5) * b.w * 0.8, b.H, -b.depth * (0.2 + 0.6 * hash(b.z, i))); spos.setXYZ(sn, x, y, z); ssz.setX(sn, 7 + hash(i, b.z) * 6); sph.setX(sn, hash(b.x, i + b.z)); sn++; }
      m4.compose(new THREE.Vector3(...(P(0, b.H / 2 - 1.4, -b.depth / 2) as [number, number, number])), q.setFromEuler(new THREE.Euler(0, b.ry, 0)), new THREE.Vector3(b.w + 0.25, b.H + 1.2, b.depth + 0.25)); this.chars.setMatrixAt(ci++, m4);
      (this.chars.material as THREE.MeshBasicMaterial).opacity = 0.5;
    });
    pos.needsUpdate = sz.needsUpdate = ph.needsUpdate = true; spos.needsUpdate = ssz.needsUpdate = sph.needsUpdate = true; this.flames.geometry.setDrawRange(0, n); kpos.needsUpdate = kph.needsUpdate = true; this.sparks.geometry.setDrawRange(0, kn); this.smoke.geometry.setDrawRange(0, sn); this.chars.count = ci; this.chars.instanceMatrix.needsUpdate = true; this.count = n;
  }
  refresh = 0; burning = 0; lightList: { x: number; y: number; z: number; k: number }[] = [];
  /** share of the city on fire, 0..1 (sky glow) */
  share(): number { return Math.min(1, this.burning / Math.max(1, this.starts.size * 0.8)) ; }
  lights(t: number) { return this.lightList.map(l => ({ x: l.x, y: l.y, z: l.z, color: 0xff7a30, intensity: (20 + Math.sin(t * 13 + l.x) * 6) * l.k, dist: 26 })); }
}
