import * as THREE from 'three';
import { A } from '../render/materials';
import { Fire } from '../sim/world';
import { hash } from '../world/terrain';
import { groundH } from '../world/terrain';

const tl = new THREE.TextureLoader();
const flameTex = [1, 2, 3, 4].map(i => tl.load(A + `particles/kenney/flame_0${i}.png`));
const smokeTex = [0, 1, 2, 3].map(i => tl.load(A + `particles/smoke_black_smoke/black_smoke0${i}.png`));
const glowTex = tl.load(A + 'textures/procedural/soft_glow.png');
interface FireObj { g: THREE.Group; flames: THREE.Sprite[]; smoke: THREE.Sprite[]; fire: Fire; seed: number; }
/** fires: flame sprites, rising smoke, flickering light entries for the light pool; plus a glow over the district */
export class Fx {
  fires = new Map<string, FireObj>(); glow: THREE.Sprite; t = 0;
  constructor(public scene: THREE.Scene) {
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff6a20, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false }));
    this.glow.scale.set(260, 110, 1); this.glow.position.set(0, 70, 10); scene.add(this.glow);
  }
  update(dt: number, fires: Fire[], glow: number) {
    this.t += dt; this.glow.material.opacity = Math.min(0.55, glow * 0.55);
    const seen = new Set<string>();
    for (const f of fires) {
      seen.add(f.id); let o = this.fires.get(f.id);
      if (!o) {
        const g = new THREE.Group(); g.position.set(f.x, groundH(f.x, f.z), f.z); this.scene.add(g); const flames: THREE.Sprite[] = [], smoke: THREE.Sprite[] = [];
        const n = Math.round(6 + f.r * 0.8);
        for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex[i % 4], blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, color: 0xffa040, fog: true })); const a = hash(i, f.x) * 6.28, r = hash(f.z, i) * f.r * 0.55; s.position.set(Math.cos(a) * r, 1, Math.sin(a) * r); g.add(s); flames.push(s); }
        for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex[i % 4], transparent: true, depthWrite: false, color: 0x0c0c0c, opacity: 0.5 })); g.add(s); smoke.push(s); }
        o = { g, flames, smoke, fire: f, seed: hash(f.x, f.z), }; this.fires.set(f.id, o);
      }
      o.fire = f; o.g.visible = f.k > 0.02;
      o.flames.forEach((s, i) => { const ph = this.t * (2.2 + (i % 3) * 0.7) + i * 1.7, sc = (1.2 + f.r * 0.12 + Math.sin(ph) * 0.4) * f.k * (1.2 + (i % 3) * 0.4); s.scale.set(sc * 0.9, sc * 1.5, 1); s.position.y = sc * 0.55 + 0.4; (s.material as THREE.SpriteMaterial).opacity = (0.7 + 0.3 * Math.sin(ph * 1.3)) * Math.min(1, f.k * 1.4); });
      o.smoke.forEach((s, i) => { const ph = ((this.t * 0.18 + i / 6 + o!.seed) % 1), sc = (4 + ph * 14) * (0.4 + f.k); s.scale.set(sc, sc, 1); s.position.set((hash(i, 1) - 0.5) * f.r * 0.6 + ph * 3, 3 + ph * 22, (hash(i, 2) - 0.5) * f.r * 0.6); (s.material as THREE.SpriteMaterial).opacity = 0.5 * (1 - ph) * Math.min(1, f.k * 1.5); });
    }
    for (const [id, o] of this.fires) if (!seen.has(id)) o.g.visible = false;
  }
  /** D4: the warehouse blast, visible over the roofs from the bridge: flash, a fireball rising into a column of fire, then smoke */
  blast(x: number, y: number, z: number) { const g = new THREE.Group(); g.position.set(x, y, z); this.scene.add(g); const fl = new THREE.PointLight(0xffb060, 400, 260, 1.2); fl.position.y = 12; g.add(fl);
    const parts: { s: THREE.Sprite; v: number; r: number; smoke: boolean }[] = [];
    for (let i = 0; i < 46; i++) { const smoke = i > 26; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smoke ? smokeTex[i % 4] : glowTex, color: smoke ? 0x161412 : 0xffa040, blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: smoke ? 0.0 : 1 })); sp.position.set((hash(i, 7) - 0.5) * 14, 4 + hash(i, 8) * 6, (hash(i, 9) - 0.5) * 10); g.add(sp); parts.push({ s: sp, v: 6 + hash(i, 3) * 10, r: 6 + hash(i, 4) * 10, smoke }); }
    let t = 0; const tick = () => { t += 1 / 60; fl.intensity = Math.max(0, 400 * (1 - t / 1.6)); for (const p of parts) { p.s.position.y += p.v / 60 * (p.smoke ? 0.8 : 1); const sc = p.r * (0.4 + t * (p.smoke ? 0.7 : 0.5)); p.s.scale.setScalar(sc); const m = p.s.material as THREE.SpriteMaterial; m.opacity = p.smoke ? Math.min(0.75, t * 0.5) * Math.max(0, 1 - (t - 4) / 6) : Math.max(0, 1 - t / 2.4); } if (t < 10) requestAnimationFrame(tick); else this.scene.remove(g); }; tick(); }
  /** white water burst and rings (D4) */
  splash(x: number, y: number, z: number) { const g = new THREE.Group(); g.position.set(x, y, z); this.scene.add(g); const parts: THREE.Sprite[] = []; for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xdde6ee, transparent: true, depthWrite: false, opacity: 0.9 })); s.userData.v = [(hash(i, 1) - 0.5) * 2.4, 2 + hash(i, 2) * 4, (hash(i, 3) - 0.5) * 2.4]; s.scale.setScalar(0.4); g.add(s); parts.push(s); }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 32), new THREE.MeshBasicMaterial({ color: 0xbfcad4, transparent: true, opacity: 0.7, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    let t = 0; const tick = () => { t += 1 / 60; for (const p of parts) { const v = p.userData.v; v[1] -= 9.8 / 60; p.position.x += v[0] / 60; p.position.y = Math.max(0, p.position.y + v[1] / 60); p.position.z += v[2] / 60; (p.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.9 - t * 0.6); } ring.scale.setScalar(1 + t * 6); (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - t * 0.25); if (t < 3) requestAnimationFrame(tick); else this.scene.remove(g); }; tick(); }
  /** light-pool entries for the nearest fires (flicker) */
  lights(fires: Fire[]) { return fires.filter(f => f.k > 0.05).map(f => ({ x: f.x, y: groundH(f.x, f.z) + 3.5, z: f.z, color: 0xff7a30, intensity: (22 + Math.sin(this.t * 13 + f.x) * 6 + Math.sin(this.t * 7.3) * 4) * f.k, dist: 26 + f.r })); }
}
