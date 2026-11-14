import * as THREE from 'three';
export const A = import.meta.env.BASE_URL; // assets root
const tl = new THREE.TextureLoader();
export function tex(n: string, srgb = false) {
  const t = tl.load(A + 'textures/city/' + n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function pbr(name: string, { rough = 0.85, tint = 0xffffff, nrm = name, ns = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex(name + '_albedo.png', true), normalMap: tex(nrm + '_normal.png'), color: tint, roughness: rough, envMapIntensity: 0.6 });
  m.normalScale.set(ns, ns); return m;
}
export const M = {
  brick: pbr('brick_red'), brickD: pbr('brick_dark'), stone: pbr('stone_base'),
  plaster: pbr('plaster'), plaster2: pbr('plaster2', { nrm: 'plaster' }), plaster3: pbr('plaster3', { nrm: 'plaster' }),
  roof: pbr('roof', { rough: 0.6 }), wood: pbr('wood', { rough: 0.7 }), flags: pbr('flags', { rough: 0.45 }),
  setts: new THREE.MeshStandardMaterial({ map: tex('setts_albedo.png', true), normalMap: tex('setts_normal.png'), roughnessMap: tex('setts_rough.png'), roughness: 1, envMapIntensity: 1.6 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.6 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.5, metalness: 0.6 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x05070a, roughness: 0.05, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.4 }),
  lit: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb065).multiplyScalar(0.5) }),
  lit2: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc890).multiplyScalar(0.45) }),
  cornice: pbr('stone_base', { tint: 0xbbbbbb }),
  dark: new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.9 }),
  // the only way to get the red accent: a real red material (grade keeps it by hue)
  RED: new THREE.MeshStandardMaterial({ color: 0xa00a0a, roughness: 0.45, emissive: 0x3d0000 }),
};
export const WALLS = [M.brick, M.plaster, M.brickD, M.plaster2, M.plaster3];

/** lit windows are not flat orange rectangles: a warm, uneven glow with a lamp hot-spot, curtains or a blind, and dark mullions. 6 variants in one atlas (one material, no extra draw calls) */
export const LIT_VARIANTS = 6;
function litAtlas() {
  const W = 96, H = 128, c = document.createElement('canvas'); c.width = W * LIT_VARIANTS; c.height = H; const g = c.getContext('2d')!;
  for (let v = 0; v < LIT_VARIANTS; v++) { g.save(); g.translate(v * W, 0); g.beginPath(); g.rect(0, 0, W, H); g.clip();
    const shop = v >= 4; const gr = g.createRadialGradient(W / 2 + (v % 2 ? 14 : -12), shop ? 40 : 74, 4, W / 2, H / 2, shop ? 110 : 92);
    gr.addColorStop(0, shop ? '#ffe8c0' : '#ffdca6'); gr.addColorStop(0.45, shop ? '#f2c078' : '#eaa652'); gr.addColorStop(1, shop ? '#7a5a2c' : '#5a3a18'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(40,20,5,${0.03 + ((k * 37) % 11) * 0.006})`; g.fillRect((k * 53) % W, (k * 29) % H, 6 + (k % 5) * 4, 2); }
    if (!shop) {
      if (v === 1 || v === 2) { const cw = v === 1 ? 26 : 18; for (const x0 of [0, W - cw]) { g.fillStyle = 'rgba(70,48,30,0.86)'; g.fillRect(x0, 0, cw, H); for (let f = 0; f < 4; f++) { g.fillStyle = `rgba(120,86,54,${0.35 + (f % 2) * 0.2})`; g.fillRect(x0 + 3 + f * (cw / 4), 0, 3, H); } } g.fillStyle = 'rgba(70,48,30,0.86)'; g.fillRect(0, 0, W, 10); }
      if (v === 3) { g.fillStyle = 'rgba(62,46,30,0.9)'; g.fillRect(0, 0, W, 58); for (let f = 0; f < 6; f++) { g.fillStyle = 'rgba(30,20,12,0.5)'; g.fillRect(0, f * 9 + 4, W, 1); } }
      if (v === 0) { g.fillStyle = 'rgba(40,26,14,0.55)'; g.beginPath(); g.ellipse(W / 2 + 10, H - 26, 16, 22, 0, 0, 7); g.fill(); } // a figure's shoulder by the lamp
      g.fillStyle = '#17130f'; g.fillRect(W / 2 - 3, 0, 6, H); g.fillRect(0, Math.round(H * 0.34), W, 5);
    } else { g.fillStyle = 'rgba(40,28,16,0.8)'; g.fillRect(0, H - 34, W, 34); for (let k = 0; k < 5; k++) { g.fillStyle = ['#8a6a3a', '#5a4a3a', '#a08050', '#4a3a2a', '#7a6a5a'][k]; g.fillRect(6 + k * 18, H - 48 + (k % 2) * 6, 12, 14 - (k % 2) * 6); } g.fillStyle = '#17130f'; g.fillRect(W / 2 - 2, 0, 4, H); }
    g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export const LIT = new THREE.MeshBasicMaterial({ map: litAtlas(), color: new THREE.Color(0xffffff).multiplyScalar(0.62) });

/** G1: walls never read as one wallpaper: big-scale tone variation (6-10 m), a dirt band at the foot following the terrain, and rain streaks */
function weather(m: THREE.MeshStandardMaterial, strength = 1) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
float groundAt(vec2 xz){ float g = smoothstep(0., 1., (-xz.y - 5.) / 50.) * smoothstep(0., 1., (xz.x - 14.) / 26.); return -xz.y * 0.0107 + 6. * g; }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{ float big = vn(vWP.xz * 0.11 + vWP.y * 0.05) * 0.6 + vn(vWP.xz * 0.37 + vec2(vWP.y * 0.21)) * 0.4;
  diffuseColor.rgb *= mix(0.72, 1.18, big * ${strength.toFixed(2)} + (1. - ${strength.toFixed(2)}) * 0.5);
  float above = vWP.y - groundAt(vWP.xz);
  diffuseColor.rgb *= mix(0.45, 1.0, smoothstep(0.0, 0.75, above));                        // dirt at the foot
  float col = h2(vec2(floor((vWP.x + vWP.z) * 1.7), 3.0)); float streak = step(0.82, col) * smoothstep(0.0, 1.0, fract(-vWP.y * 0.12 + col * 7.0)) * 0.22;
  diffuseColor.rgb *= 1.0 - streak * ${strength.toFixed(2)};                                          // rain streaks under sills
}`);
  };
  m.customProgramCacheKey = () => 'weather' + strength;
}
for (const m of [M.brick, M.brickD, M.plaster, M.plaster2, M.plaster3]) weather(m, 1);
weather(M.stone, 0.6);
