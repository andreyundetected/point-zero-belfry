import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { ASSET_BASE, loadTexture } from './assets';

export const FOG_COLOR = 0x101a2e;

export function setupAtmosphere(scene: THREE.Scene) {
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.034);
  const hemi = new THREE.HemisphereLight(0x5a7fc0, 0x2a2018, 1.0);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8fb2ff, 1.1);
  moon.position.set(-14, 22, -10);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 });
  moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.02;
  scene.add(moon); scene.add(moon.target);
  new EXRLoader().load(`${ASSET_BASE}hdri/night_512.exr`, (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = t; scene.environmentIntensity = 0.35;
  });
  return { hemi, moon };
}

/** Лунный свет следует за камерой, чтобы тени были чёткими вокруг игрока. */
export function followMoon(moon: THREE.DirectionalLight, target: THREE.Vector3) {
  moon.target.position.copy(target);
  moon.position.set(target.x - 14, 22, target.z - 10);
}

export function createGround(w = 300, d = 220, cx = 20, cz = 0) {
  const rep = (n: number) => w / 60 * n;
  const alb = loadTexture('cobble_albedo.png', { repeat: [rep(34), d / 60 * 34], srgb: true });
  const nor = loadTexture('cobble_normal.png', { repeat: [rep(34), d / 60 * 34] });
  const rgh = loadTexture('cobble_roughness.png', { repeat: [rep(34), d / 60 * 34] });
  const mat = new THREE.MeshStandardMaterial({ map: alb, normalMap: nor, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: rgh, roughness: 0.42, metalness: 0, envMapIntensity: 1.6 });
  const g = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  g.rotation.x = -Math.PI / 2; g.position.set(cx, 0, cz); g.receiveShadow = true;
  return g;
}

export function createPaved(x0: number, x1: number, z0: number, z1: number, tex: 'pavers' | 'planks', y = 0.02) {
  const w = x1 - x0, d = z1 - z0;
  const k = tex === 'pavers' ? 0.55 : 0.6;
  const mk = (n: string, srgb = false) => loadTexture(`${tex}_${n}.png`, { repeat: [w * k, d * k], srgb });
  const mat = new THREE.MeshStandardMaterial({ map: mk('albedo', true), normalMap: mk('normal'), roughnessMap: mk('roughness'), roughness: tex === 'pavers' ? 0.38 : 0.6, envMapIntensity: 1.5 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true;
  return m;
}

const pudMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1424, roughness: 0.02, metalness: 0.1, clearcoat: 1, envMapIntensity: 2.2, transparent: true, opacity: 0.7 });
export function puddle(x: number, z: number, w: number, h: number, rot = 0) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), pudMat);
  m.scale.set(w, h, 1); m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, 0.035, z);
  return m;
}

// ---------------- дождь ----------------
export class Rain {
  readonly obj: THREE.LineSegments;
  private N = 3800; private pos: Float32Array; private seed: Float32Array;
  private box = { x: 30, y: 14, z: 34 };
  private rippleTex = loadTexture('ripple_ring.png');
  intensity = 1;
  constructor() {
    this.pos = new Float32Array(this.N * 6); this.seed = new Float32Array(this.N * 3);
    for (let i = 0; i < this.N; i++) {
      // детерминированное зерно для визуала допустимо (не симуляция)
      const r = (k: number) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
      this.seed[i * 3] = (r(1) - 0.5) * this.box.x; this.seed[i * 3 + 1] = r(2) * this.box.y; this.seed[i * 3 + 2] = (r(3) - 0.5) * this.box.z;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9db8e6, transparent: true, opacity: 0.32, fog: true }));
    this.obj.frustumCulled = false;
  }
  update(t: number, center: THREE.Vector3) {
    const { N, pos, seed, box } = this;
    const n = Math.floor(N * this.intensity);
    for (let i = 0; i < N; i++) {
      const k = i * 6;
      if (i >= n) { pos[k] = pos[k + 3] = 0; pos[k + 1] = pos[k + 4] = -50; pos[k + 2] = pos[k + 5] = 0; continue; }
      const x = center.x + ((seed[i * 3] + 0) % box.x), z = center.z + seed[i * 3 + 2];
      const y = ((seed[i * 3 + 1] - t * 14) % box.y + box.y) % box.y;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z; pos[k + 3] = x - 0.04; pos[k + 4] = y + 0.55; pos[k + 5] = z;
    }
    (this.obj.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ---------------- фонари ----------------
export interface Lamp {
  id: string; pos: THREE.Vector3; base: number; mesh: THREE.Mesh; halo: THREE.Sprite; phase: number; gas: boolean; color: THREE.Color;
}
export class LampSystem {
  lamps: Lamp[] = [];
  private pool: THREE.PointLight[] = [];
  level = 1;           // давление → яркость
  festive = 0;         // 0..1 праздничная подсветка
  flicker = 0;         // 0..1 мерцание (низкое давление)
  private haloTex = loadTexture('lamp_halo.png', { wrap: false });
  private glowGeo = new THREE.SphereGeometry(0.11, 12, 8);
  constructor(private scene: THREE.Scene, poolSize = 12) {
    for (let i = 0; i < poolSize; i++) {
      const L = new THREE.PointLight(0xffa850, 0, 11, 1.7); L.visible = false; scene.add(L); this.pool.push(L);
    }
  }
  add(id: string, x: number, y: number, z: number, opts: { gas?: boolean; color?: number; scale?: number; base?: number } = {}) {
    const color = new THREE.Color(opts.color ?? 0xffa850);
    const mesh = new THREE.Mesh(this.glowGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb866).multiplyScalar(5) }));
    mesh.position.set(x, y, z); mesh.scale.setScalar(opts.scale ?? 1);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.haloTex, color: color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, fog: false }));
    halo.scale.setScalar(2.3 * (opts.scale ?? 1)); halo.position.set(x, y, z);
    this.scene.add(mesh, halo);
    const lamp: Lamp = { id, pos: new THREE.Vector3(x, y, z), base: opts.base ?? 14, mesh, halo, phase: this.lamps.length * 3.1, gas: opts.gas ?? true, color };
    this.lamps.push(lamp);
    return lamp;
  }
  update(t: number, cam: THREE.Vector3) {
    const sorted = this.lamps.map((l) => ({ l, d: l.pos.distanceToSquared(cam) })).sort((a, b) => a.d - b.d);
    this.pool.forEach((L, i) => {
      const s = sorted[i];
      if (!s || s.d > 1600) { L.visible = false; L.intensity = 0; return; }
      L.visible = true; L.position.copy(s.l.pos); L.color.copy(s.l.color);
      L.intensity = this.intensityOf(s.l, t);
    });
    for (const l of this.lamps) {
      const k = this.factor(l, t);
      (l.mesh.material as THREE.MeshBasicMaterial).color.setRGB(1.0 * 5 * k, 0.72 * 5 * k, 0.4 * 5 * k);
      (l.halo.material as THREE.SpriteMaterial).opacity = Math.min(1, 0.8 * k);
      l.halo.scale.setScalar((2.3 + this.festive * 0.8) * (l.mesh.scale.x) * (0.8 + 0.2 * k));
    }
  }
  private factor(l: Lamp, t: number) {
    let k = l.gas ? this.level : 1;
    const fl = l.gas ? this.flicker : 0;
    k *= 0.93 + 0.07 * Math.sin(t * 9 + l.phase) + 0.03 * Math.sin(t * 23 + l.phase);
    if (fl > 0) k *= 1 - fl * (0.5 + 0.5 * Math.sin(t * 31 + l.phase * 2.3)) * 0.8;
    return k * (1 + this.festive * 0.25);
  }
  private intensityOf(l: Lamp, t: number) { return l.base * this.factor(l, t); }
}

// ---------------- вода ----------------
export function createWater(w: number, d: number, cx: number, cz: number, y = -0.45) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, lampPos: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, -99, 0)) }, lampK: { value: new Array(8).fill(0) } }]),
    vertexShader: `varying vec3 vW; varying vec4 vMV;
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix*vec4(position,1.); vW = wp.xyz; vec4 mvPosition = viewMatrix*wp; vMV = mvPosition; gl_Position = projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float time; uniform vec3 lampPos[8]; uniform float lampK[8]; varying vec3 vW; varying vec4 vMV;
      #include <fog_pars_fragment>
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        vec2 p = vW.xz;
        float n = noise(p*1.6+vec2(time*.25,time*.18))*.55+noise(p*4.1-vec2(time*.4,time*.1))*.3+noise(p*9.+time*.6)*.15;
        vec2 g = vec2(noise(p*2.2+time*.3)-noise(p*2.2-time*.3+7.), noise(p*2.4+3.-time*.2)-noise(p*2.4+11.+time*.2));
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vec3(g.x*.55, 1., g.y*.55));
        float fres = pow(1.-max(dot(N,V),0.), 3.)*.8+.08;
        vec3 deep = vec3(.015,.03,.055); vec3 sky = vec3(.08,.14,.25);
        vec3 col = mix(deep, sky, fres);
        // отражения фонарей: вытянутые блики
        for(int i=0;i<8;i++){
          vec3 lp = lampPos[i]; float k = lampK[i];
          vec2 d = vW.xz - lp.xz; float len = length(d);
          float streak = exp(-abs(d.x)*(1.6+ n*3.))*exp(-abs(d.y)*.18) * smoothstep(40., 0., len);
          col += vec3(1.,.62,.28)*streak*k*(.35+n*.9)*(0.4+fres);
        }
        col += vec3(.6,.75,1.)*pow(max(dot(reflect(-V,N), normalize(vec3(-.4,.7,-.3))),0.),60.)*.35;
        gl_FragColor = vec4(col, .93);
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(cx, y, cz);
  return m;
}
