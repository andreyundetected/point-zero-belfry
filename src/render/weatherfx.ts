import * as THREE from 'three';
import { hash, groundH } from '../world/terrain';
import { placed } from '../world/city';
import { CANAL, QUAY_Z, WATER_Y, CANAL_WATER_Y } from '../world/layout';

// Weather effects, pass 2: rain splashes on the ground around the player, chimney smoke, fog banks over the water, ripples on the puddles.
// Each is one draw call (Points / InstancedMesh with a shader); nothing allocates per frame.

/** short expanding rings where drops hit the ground, within ~12 m of the camera */
export function makeSplashes(scene: THREE.Scene) {
  const N = 600; const seed = new Float32Array(N * 3); for (let i = 0; i < N; i++) { seed[i * 3] = hash(i, 51); seed[i * 3 + 1] = hash(i, 52); seed[i * 3 + 2] = hash(i, 53); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
    vertexShader: `attribute vec3 aSeed; uniform float uTime, uScale; varying float vK; void main(){ float k = fract(uTime*(1.6+aSeed.z*1.2)+aSeed.x*7.0); vK = k; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = min(14.0, (0.04+k*0.14)*uScale/max(0.5,-mv.z)); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vK; void main(){ vec2 d = gl_PointCoord-0.5; float r = length(d)*2.0; float ring = smoothstep(0.45,0.8,r)*smoothstep(1.0,0.85,r); float a = ring*(1.0-vK)*(1.0-vK)*0.35; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.75,0.82,0.95)*a, a); }` });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 2; scene.add(pts);
  const pos = g.attributes.position as THREE.BufferAttribute; let lastX = 1e9, lastZ = 1e9;
  const update = (t: number, cx: number, cz: number, visible: boolean) => {
    pts.visible = visible; mat.uniforms.uTime.value = t; if (!visible) return;
    if (Math.hypot(cx - lastX, cz - lastZ) > 1.5) { lastX = cx; lastZ = cz; // re-seat the splashes on the ground around the camera (flat on the terrain, not inside houses: those get y way below)
      for (let i = 0; i < N; i++) { const a = seed[i * 3] * 6.283, r = 1 + seed[i * 3 + 1] * 11; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; pos.setXYZ(i, x, groundH(x, z) + 0.02, z); } pos.needsUpdate = true; }
  };
  return update;
}

/** thin grey smoke from the chimneys of lit houses: one Points cloud, 8 puffs per chimney, rising and drifting with the wind */
export function makeChimneySmoke(scene: THREE.Scene) {
  const stacks: [number, number, number][] = [];
  for (const b of placed) { if (!b.toWorld || b.id === 'blk' || b.id === 'ob' || b.floors < 2) continue; const R = hash(b.x * 0.7 + 7, b.z * 1.3 - 7); if (R > 0.45) continue;
    for (let c = 0; c < 1 + (b.w > 7 ? 1 : 0); c++) { const [X, , Z] = b.toWorld(-b.w / 4 + c * b.w / 2, 0, -b.depth / 2 + 0.8); stacks.push([X, b.base + b.H + 2.4, Z]); } }
  const PP = 8, N = stacks.length * PP; const pos = new Float32Array(N * 3), ph = new Float32Array(N);
  stacks.forEach(([x, y, z], i) => { for (let k = 0; k < PP; k++) { pos[(i * PP + k) * 3] = x; pos[(i * PP + k) * 3 + 1] = y; pos[(i * PP + k) * 3 + 2] = z; ph[i * PP + k] = hash(i, k) + k / PP; } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms: { uTime: { value: 0 }, uScale: { value: 420 }, fogColor: { value: new THREE.Color(0x0b0f15) }, fogDensity: { value: 0.035 } },
    vertexShader: `attribute float aPhase; uniform float uTime, uScale; varying float vK; varying float vFog; void main(){ float k = fract(uTime*0.12+aPhase); vK = k; vec3 p = position + vec3(k*5.0 + sin(aPhase*30.0+uTime*0.7)*0.4, k*7.0, k*2.0); vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = min(90.0, (0.8+k*3.0)*uScale/max(1.0,-mv.z)); gl_Position = projectionMatrix*mv; vFog = 1.0-exp(-0.035*0.035*mv.z*mv.z); }`,
    fragmentShader: `varying float vK; varying float vFog; uniform vec3 fogColor; void main(){ float d = length(gl_PointCoord-0.5)*2.0; float a = smoothstep(1.0,0.2,d)*(1.0-vK)*smoothstep(0.0,0.15,vK)*0.28; vec3 col = mix(vec3(0.32,0.33,0.36), fogColor, vFog); gl_FragColor = vec4(col, a*(1.0-vFog)); }` });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 3; scene.add(pts);
  return (t: number) => { mat.uniforms.uTime.value = t; };
}

/** low fog banks drifting over the canal and the harbour */
export function makeFogBanks(scene: THREE.Scene) {
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; const im = g.createImageData(128, 128); for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const u = (x - 64) / 64, v = (y - 64) / 64, n = 0.6 + 0.4 * Math.sin(x * 0.3 + y * 0.17) * Math.cos(y * 0.23 - x * 0.11), a = Math.max(0, 1 - Math.hypot(u * 0.8, v * 1.6)) ** 1.6 * n, i = (y * 128 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(a * 255); } g.putImageData(im, 0, 0); return new THREE.CanvasTexture(c); })();
  const banks: { s: THREE.Sprite; x0: number; z0: number; ph: number }[] = [];
  const mk = (x: number, y: number, z: number, w: number, h: number, ph: number) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x6a7686, transparent: true, opacity: 0.16, depthWrite: false, fog: true })); s.scale.set(w, h, 1); s.position.set(x, y, z); s.renderOrder = 1; scene.add(s); banks.push({ s, x0: x, z0: z, ph }); };
  for (let z = CANAL.z0 + 6; z < CANAL.z1 - 4; z += 9) mk((hash(z, 1) - 0.5) * 4, CANAL_WATER_Y + 1.2, z, 10 + hash(z, 2) * 6, 2.2, hash(z, 3) * 6);
  for (let x = -88; x < 88; x += 11) mk(x, WATER_Y + 1.0, QUAY_Z + 4 + hash(x, 4) * 8, 14 + hash(x, 5) * 8, 2.6, hash(x, 6) * 6);
  return (t: number) => { for (const b of banks) { b.s.position.x = b.x0 + Math.sin(t * 0.05 + b.ph) * 1.5; b.s.position.z = b.z0 + Math.cos(t * 0.04 + b.ph) * 0.8; (b.s.material as THREE.SpriteMaterial).opacity = 0.13 + 0.05 * Math.sin(t * 0.11 + b.ph); } };
}

/** puddles: expanding rain rings perturb the normal and brighten the rim, driven by a time uniform */
export function puddleRipples(m: THREE.MeshPhysicalMaterial) {
  const u = { value: 0 };
  m.onBeforeCompile = sh => { sh.uniforms.uTime = u;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP2;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime; varying vec3 vWP2;
float rh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 23758.5453); }
vec3 ripple(vec2 xz){ vec3 acc = vec3(0.0); for (int i = 0; i < 3; i++) { vec2 cell = floor(xz * 2.2 + float(i) * 7.3); vec2 c = (cell + vec2(rh(cell), rh(cell + 3.1))) / 2.2 - float(i) * 7.3 / 2.2; float t0 = rh(cell + 9.7); float k = fract(uTime * 1.3 + t0); float r = k * 0.35; float d = length(xz - c); float ring = smoothstep(0.03, 0.0, abs(d - r)) * (1.0 - k); vec2 dir = normalize(xz - c + 1e-4); acc += vec3(dir * ring * 0.6, ring); } return acc; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ vec3 rp = ripple(vWP2.xz); normal = normalize(normal + vec3(rp.x, 0.0, rp.y)); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
{ vec3 rp = ripple(vWP2.xz); roughnessFactor = clamp(roughnessFactor + rp.z * 0.25, 0.0, 1.0); }`); };
  m.customProgramCacheKey = () => 'puddle-ripples';
  return (t: number) => { u.value = t; };
}
