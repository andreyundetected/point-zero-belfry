import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, NoiseEffect, BlendFunction, ChromaticAberrationEffect, ToneMappingEffect, ToneMappingMode, SMAAEffect } from 'postprocessing';
import { buildCity, inCollider, SHOPS, type CityHandles } from './city';
import { People, type PersonState } from './people';
import { Traffic } from './traffic';
import { makeEnvironment, makeSky } from './env';
import { Extras } from './extras';
import { MyCar } from './mycar';
import { onLang } from '../i18n';
import type { Sim } from '../sim/sim';
import type { Npc } from '../sim/types';
import { hrand } from '../sim/util';

const WORK = new Set(['work', 'noodles', 'bartend', 'repairs', 'stall', 'busk', 'deliver', 'doctor', 'cameras', 'dispatch', 'storeroom', 'maintenance', 'shift', 'lender', 'security', 'inspect']);
const posOnLegs = (n: Npc, t: number) => {
  for (const l of n.legs) if (t >= l.t0 && t < l.t1) { const f = (t - l.t0) / Math.max(1e-6, l.t1 - l.t0); return { x: l.from.x + (l.to.x - l.from.x) * f, y: l.from.y + (l.to.y - l.from.y) * f, dx: l.to.x - l.from.x, dy: l.to.y - l.from.y, mode: l.mode }; }
  return null;
};

export class Renderer {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, 1, 0.2, 2200);
  composer!: EffectComposer; city: CityHandles; people: People; traffic: Traffic; extras: Extras;
  ids: string[]; sky: THREE.Mesh; chroma!: ChromaticAberrationEffect;
  rain!: THREE.LineSegments; rainPos!: Float32Array; splash!: THREE.InstancedMesh; splashT: Float32Array;
  trams: THREE.Group[] = []; items = new Map<string, THREE.Mesh>();
  hemi: THREE.HemisphereLight; playerLight: THREE.PointLight; lights: THREE.PointLight[] = [];
  onThunder: () => void = () => {}; myCar!: MyCar; driving = false; muzzle = 0; frac = 0;
  yaw = -Math.PI / 2; pitch = 0.22; glitch = 0; camDist = 5.2; flash = 0; nextFlash = 30;
  private camPos = new THREE.Vector3(); private powered = true;

  constructor(public canvas: HTMLCanvasElement, public sim: Sim, public quality = 'high') {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.environment = makeEnvironment(this.renderer);
    this.scene.fog = new THREE.FogExp2(0x120c22, 0.0036);
    this.sky = makeSky(); this.scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0x5a5a9a, 0x140c18, 0.55); this.scene.add(this.hemi);
    const moon = new THREE.DirectionalLight(0x8090c0, 0.35); moon.position.set(-300, 500, 200); this.scene.add(moon);
    this.city = buildCity(this.scene, Object.values(sim.locs), quality);
    for (let i = 0; i < 6; i++) { const pl = new THREE.PointLight(0xffffff, 0, 45, 2); this.scene.add(pl); this.lights.push(pl); }
    this.playerLight = new THREE.PointLight(0x7fe8ff, 2.5, 8, 2); this.scene.add(this.playerLight);
    this.ids = ['player', ...Object.keys(sim.world.npcs).filter(id => id !== 'convoy')];
    this.people = new People(this.scene, this.ids);
    const avoid = ['market', 'tower_front', 'kolco', 'substation', 'depot'].map(id => ({ x: sim.locs[id].x, y: sim.locs[id].y, r: 45 }));
    this.traffic = new Traffic(this.scene, avoid, 24);
    this.extras = new Extras(this.scene, sim);
    this.myCar = new MyCar(this.scene);
    this.makeTrams(); this.initRain(); this.initSteam();
    this.splashT = new Float32Array(this.splash.count);
    this.initComposer();
    onLang(() => this.city.refreshText());
    this.resize(); addEventListener('resize', () => this.resize());
  }

  initComposer() {
    const hi = this.quality === 'high';
    this.renderer.setPixelRatio(hi ? Math.min(devicePixelRatio, 1.5) : 1);
    this.composer?.dispose();
    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new BloomEffect({ intensity: 1.15, luminanceThreshold: 0.5, luminanceSmoothing: 0.35, mipmapBlur: true, radius: 0.72, levels: hi ? 8 : 5 });
    this.chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0004), radialModulation: true, modulationOffset: 0.3 });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY }); noise.blendMode.opacity.value = 0.12;
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const vig = new VignetteEffect({ darkness: 0.6, offset: 0.28 });
    this.composer.addPass(new EffectPass(this.camera, bloom));
    this.composer.addPass(new EffectPass(this.camera, this.chroma));
    this.composer.addPass(new EffectPass(this.camera, tone, vig, noise));
    if (hi) this.composer.addPass(new EffectPass(this.camera, new SMAAEffect()));
    this.resize();
  }
  setQuality(q: string) { this.quality = q; this.initComposer(); }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false); this.composer?.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  makeTrams() {
    const body = new THREE.MeshStandardMaterial({ color: 0xc8ccd8, roughness: 0.35, metalness: 0.6, envMapIntensity: 1.2 });
    const win = new THREE.MeshBasicMaterial({ color: 0xbff4ff, toneMapped: false });
    const stripe = new THREE.MeshBasicMaterial({ color: 0xff4fd8, toneMapped: false });
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      for (const z of [-8.2, 8.2]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, 15.6), body); b.position.set(0, 2.0, z); g.add(b);
        const w = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.9, 13.5), win); w.position.set(0, 2.6, z); g.add(w);
        const s = new THREE.Mesh(new THREE.BoxGeometry(2.66, 0.12, 15.6), stripe); s.position.set(0, 1.25, z); g.add(s);
      }
      const panto = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 1.6), new THREE.MeshStandardMaterial({ color: 0x222 })); panto.position.set(0, 4.3, -4); panto.rotation.x = 0.6; g.add(panto);
      const head = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); head.position.set(0, 1.4, 16.05); g.add(head);
      g.visible = false; this.scene.add(g); this.trams.push(g);
    }
  }

  steam!: THREE.Points; steamP!: Float32Array; steamC!: Float32Array; steamL!: Float32Array; emitters: { x: number; y: number }[] = [];
  initSteam() {
    for (let i = 0; i < 420; i++) { const gx = Math.round((hrand(800, i) * 3600) / 100) * 100, gy = Math.round((hrand(801, i) * 3000 - 1000) / 100) * 100, a = hrand(802, i) * 60 + 20; this.emitters.push(hrand(803, i) < 0.5 ? { x: gx + a, y: gy + 1.5 } : { x: gx - 1.5, y: gy + a }); }
    const m = this.sim.locs.market; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; this.emitters.push({ x: m.x + Math.cos(a) * 30, y: m.y + Math.sin(a) * 30 }); }
    const N = 500; this.steamP = new Float32Array(N * 3); this.steamC = new Float32Array(N * 3); this.steamL = new Float32Array(N);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.steamP, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.steamC, 3));
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    this.steam = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.6, map: new THREE.CanvasTexture(c), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.steam.frustumCulled = false; this.scene.add(this.steam);
  }
  updateSteam(px: number, py: number, dt: number) {
    const near = this.emitters.filter(e => Math.abs(e.x - px) < 110 && Math.abs(e.y - py) < 110);
    const P = this.steamP, C = this.steamC, L = this.steamL;
    for (let i = 0; i < L.length; i++) {
      L[i] -= dt * 0.35;
      if (L[i] <= 0) { if (!near.length) { P[i * 3 + 1] = -50; continue; } const e = near[i % near.length]; L[i] = 0.6 + Math.random() * 0.4; P[i * 3] = e.x + (Math.random() - 0.5) * 0.8; P[i * 3 + 1] = 0.2; P[i * 3 + 2] = e.y + (Math.random() - 0.5) * 0.8; }
      P[i * 3 + 1] += dt * 1.3; P[i * 3] += dt * 0.4; const c = Math.min(1, L[i]) * 0.10; C[i * 3] = c; C[i * 3 + 1] = c * 1.05; C[i * 3 + 2] = c * 1.2;
    }
    this.steam.geometry.attributes.position.needsUpdate = true; this.steam.geometry.attributes.color.needsUpdate = true;
  }

  initRain() {
    const N = this.quality === 'high' ? 9000 : 4000; this.rainPos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * 90, y = Math.random() * 45, z = (Math.random() - 0.5) * 90; this.rainPos.set([x, y, z, x - 0.12, y - 1.1, z + 0.05], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xa8bce8, transparent: true, opacity: 0.32 }));
    this.rain.frustumCulled = false; this.scene.add(this.rain);
    const ring = new THREE.RingGeometry(0.05, 0.11, 10).rotateX(-Math.PI / 2);
    this.splash = new THREE.InstancedMesh(ring, new THREE.MeshBasicMaterial({ color: 0x8090b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 220);
    this.splash.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(220 * 3), 3);
    this.splash.frustumCulled = false; this.scene.add(this.splash); (this.splash as any)._p = new Float32Array(this.splash.count * 2);
  }

  /** camera must not enter buildings: pull it in along the ray if a collider/high wall is crossed */
  private camBlocked(x: number, y: number) { return inCollider(x, y, 0.3); }

  update(px: number, py: number, pz: number, facing: number, moving: boolean, running: boolean, traveller: boolean, dt: number) {
    const w = this.sim.world, now = performance.now() / 1000, t = w.t + Math.min(0.999, Math.max(0, this.frac));
    const lights = w.feeders.lights;
    if (lights !== this.powered) { this.powered = lights; this.city.setPower(lights); this.scene.environmentIntensity = lights ? 1 : 0.15; }
    // ---- people & NPC cars ----
    const cars: { x: number; y: number; yaw: number; kind: number; moving: boolean }[] = [];
    const states: (PersonState | null)[] = this.ids.map(id => {
      if (id === 'player') return this.driving ? { x: 0, y: 0, hidden: true } : { x: px, y: py, z: pz, yaw: Math.atan2(Math.cos(facing), Math.sin(facing)), run: running };
      const n = w.npcs[id]; if (!n) return null;
      if (n.flags.dead) return { x: n.pos.x, y: n.pos.y, lying: true };
      if (n.flags.down) return w.flags.body_hidden ? { x: 0, y: 0, hidden: true } : { x: n.pos.x, y: n.pos.y, lying: true };
      if (id === 'lash' && w.npcs.convoy && (w.npcs.convoy.flags.stage as number) >= 2 && (w.npcs.convoy.flags.stage as number) < 5) return { x: 0, y: 0, hidden: true };
      const leg = posOnLegs(n, t);
      if (leg?.mode === 'tram') return { x: 0, y: 0, hidden: true };
      if (leg?.mode === 'car') { cars.push({ x: leg.x, y: leg.y, yaw: Math.atan2(leg.dx, leg.dy), kind: id === 'burn' ? 2 : id.startsWith('c_taxi') ? 1 : 0, moving: true }); return { x: 0, y: 0, hidden: true }; }
      const work = WORK.has(n.act); const lp = n.loc ? this.sim.locs[n.loc] : null;
      const sp = leg ? { x: leg.x, y: leg.y } : n.pos;
      // base reaction: someone running close by makes people turn and look
      if (!leg && running && Math.hypot(sp.x - px, sp.y - py) < 6) return { x: sp.x, y: sp.y, face: Math.atan2(px - sp.x, py - sp.y) };
      return { x: sp.x, y: sp.y, work, face: lp && !n.legs.length ? Math.atan2(lp.x - n.pos.x, lp.y - n.pos.y) + (work ? Math.PI : 0) : undefined };
    });
    // the convoy: armored Omega-9 + two escorts following on the same path
    const cv = w.npcs.convoy;
    if (cv) {
      const stage = (cv.flags.stage as number) ?? 0;
      const leg = posOnLegs(cv, t);
      const yaw = leg ? Math.atan2(leg.dx, leg.dy) : (cv.flags.yaw as number) ?? 0; if (leg) cv.flags.yaw = yaw;
      cars.push({ x: leg ? leg.x : cv.pos.x, y: leg ? leg.y : cv.pos.y, yaw, kind: 3, moving: !!leg || stage === 3 });
      if (stage >= 1) for (const back of [3, 6]) { const p = posOnLegs(cv, t - back) ?? { x: cv.pos.x - Math.sin(yaw) * back * 4, y: cv.pos.y - Math.cos(yaw) * back * 4 }; cars.push({ x: p.x, y: p.y, yaw, kind: 3, moving: true }); }
    }
    this.people.update(states, px, py, dt, w.rain || t < 17 * 3600, now);
    this.traffic.update(t, px, py, lights, cars, now);
    // ---- ground items ----
    const seen = new Set<string>();
    for (const g of w.ground) {
      const key = g.item + g.loc; seen.add(key);
      let m = this.items.get(key);
      if (!m) { m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xffe14a, toneMapped: false })); this.items.set(key, m); this.scene.add(m); }
      const lp = this.sim.locs[g.loc]; m.position.set(lp.x + 2, 0.75 + Math.sin(now * 3) * 0.1, lp.y + 3); m.rotation.y = now * 2;
    }
    for (const [k, m] of this.items) if (!seen.has(k)) { this.scene.remove(m); this.items.delete(k); }
    void traveller;
    this.playerLight.position.set(px - Math.sin(facing) * 0.6, 1.4 + pz, py + Math.cos(facing) * 0.6);
    this.muzzle = Math.max(0, this.muzzle - dt * 12); this.playerLight.intensity = 2.5 + this.muzzle * 400; this.playerLight.color.setHex(this.muzzle > 0.05 ? 0xffd08a : 0x7fe8ff);
    // ---- trams ----
    const tr = this.sim.def.tram, firstN = Math.max(0, Math.floor((t - 14 * 3600 - 900) / tr.headway));
    this.trams.forEach((m, i) => {
      const p = this.sim.tramPos(firstN + i, t);
      if (!p) { m.visible = false; return; }
      const q = this.sim.tramPos(firstN + i, t + 3) ?? this.sim.tramPos(firstN + i, t - 3) ?? p;
      m.visible = Math.abs(p.x - px) < 600 && Math.abs(p.y - py) < 600; m.position.set(p.x, 0.15, p.y + 6);
      if (Math.hypot(q.x - p.x, q.y - p.y) > 0.01) m.rotation.y = Math.atan2(q.x - p.x, q.y - p.y);
    });
    // ---- city dynamics, extras ----
    this.city.update(t, px, py, now);
    this.extras.update(now, px, py, this.yaw, t);
    // nearest neon spots get the few real point lights
    const spots = this.city.spots;
    const near = spots.map(s => ({ s, d: (s.x - px) ** 2 + (s.y - py) ** 2 })).sort((a, b) => a.d - b.d).slice(0, this.lights.length);
    this.lights.forEach((l, i) => { const o = near[i]; if (!o || !lights) { l.intensity = 0; return; } l.position.set(o.s.x, o.s.z, o.s.y); l.color.setHex(o.s.c); l.intensity = 150; });
    this.updateSteam(px, py, dt);
    // ---- rain & splashes ----
    const heavy = w.rain;
    const indoor = Object.values(SHOPS).some(sh => Math.abs(px - sh.x) < sh.w / 2 && Math.abs(py - sh.y) < sh.d / 2) || (Math.abs(px - 3440) < 28 && Math.abs(py - 1158) < 26);
    this.rain.visible = !indoor; this.splash.visible = !indoor;
    (this.rain.material as THREE.LineBasicMaterial).opacity = heavy ? 0.34 : 0.14;
    const P = this.rainPos, N = P.length / 6, fall = (heavy ? 32 : 22) * dt;
    for (let i = 0; i < N; i++) { let y = P[i * 6 + 1] - fall; if (y < 0) y += 45; P[i * 6 + 1] = y; P[i * 6 + 4] = y - 1.1; }
    this.rain.geometry.attributes.position.needsUpdate = true;
    this.rain.position.set(this.camera.position.x, 0, this.camera.position.z);
    const M = new THREE.Matrix4();
    for (let i = 0; i < this.splash.count; i++) {
      this.splashT[i] -= dt * (heavy ? 3 : 1.5);
      if (this.splashT[i] <= 0) { this.splashT[i] = 0.3 + Math.random() * 0.7; (this.splash as any)._p = (this.splash as any)._p ?? new Float32Array(this.splash.count * 2); const pp = (this.splash as any)._p; pp[i * 2] = px + (Math.random() - 0.5) * 36; pp[i * 2 + 1] = py + (Math.random() - 0.5) * 36; }
      const pp = (this.splash as any)._p, life = Math.max(0, this.splashT[i]), s = 0.4 + (1 - life) * 1.1;
      M.makeScale(s, 1, s).setPosition(pp[i * 2], 0.19, pp[i * 2 + 1]); this.splash.setMatrixAt(i, M);
      const c = heavy ? life * 0.22 : life * 0.1; this.splash.instanceColor!.setXYZ(i, c, c, c);
    }
    this.splash.instanceMatrix.needsUpdate = true; this.splash.instanceColor!.needsUpdate = true;
    // lightning during heavy rain
    this.nextFlash -= dt;
    if (heavy && this.nextFlash < 0) { this.flash = 1; this.nextFlash = 25 + Math.random() * 50; this.onThunder(); }
    this.flash = Math.max(0, this.flash - dt * 2.5);
    const fl = this.flash > 0.6 || (this.flash > 0.25 && this.flash < 0.35) ? this.flash : 0;
    this.hemi.intensity = 0.55 + fl * 2.2;
    const sm = this.sky.material as THREE.ShaderMaterial; sm.uniforms.time.value = now; sm.uniforms.flash.value = fl;
    this.sky.position.copy(this.camera.position);
    // glitch on time jumps
    this.glitch = Math.max(0, this.glitch - dt * 1.3);
    this.chroma.offset.set(0.0006 + this.glitch * 0.02, 0.0004 + this.glitch * 0.012);
    // ---- camera: over the shoulder, orbit with pitch (can look up), never inside walls ----
    this.myCar.update(dt);
    const pivot = new THREE.Vector3(px, (this.driving ? 1.9 : 1.65) + pz, py);
    const cp = Math.cos(this.pitch), dir = new THREE.Vector3(-Math.cos(this.yaw) * cp, Math.sin(this.pitch), -Math.sin(this.yaw) * cp);
    const shoulder = new THREE.Vector3(-Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(0.75);
    let d = this.driving ? 8.5 : this.camDist;
    for (let s = 0.6; s <= d; s += 0.35) { const q = pivot.clone().addScaledVector(dir, s).add(shoulder); if (this.camBlocked(q.x, q.z) && q.y < 60) { d = Math.max(0.6, s - 0.4); break; } }
    const target = pivot.clone().addScaledVector(dir, d).add(shoulder); target.y = Math.max(0.35, target.y);
    this.camPos.lerp(target, Math.min(1, dt * 14)); if (this.camPos.distanceTo(target) > 30) this.camPos.copy(target);
    this.camera.position.copy(this.camPos);
    const look = pivot.clone().add(shoulder).addScaledVector(dir, -6);
    this.camera.lookAt(look);
    void moving;
  }

  render() { this.composer.render(); }
}
