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
  RED: new THREE.MeshStandardMaterial({ color: 0xa00a0a, roughness: 0.45, emissive: 0x2a0000 }),
};
export const WALLS = [M.brick, M.plaster, M.brickD, M.plaster2, M.plaster3];
