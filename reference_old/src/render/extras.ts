import * as THREE from 'three';
import type { Sim } from '../sim/sim';
import { headlines, SCREENS } from '../sim/news';
import { t } from '../i18n';
import { drawPortrait } from '../ui/portrait';
import { hrand } from '../sim/util';

/** Big TV screens (Vector-24), patrol drones and holographic ads. */
export class Extras {
  screens: { mesh: THREE.Mesh; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; loc: string; idx: number; sig: string }[] = [];
  drones: { g: THREE.Group; phase: number; cx: number; cy: number; r: number }[] = [];
  ads: THREE.Mesh[] = []; hwy!: { body: THREE.InstancedMesh; lt: THREE.InstancedMesh; N: number }; fly!: { body: THREE.InstancedMesh; lights: THREE.InstancedMesh; paths: { x0: number; z0: number; dx: number; dz: number; y: number; v: number; span: number; ph: number }[] }; holo!: THREE.Mesh;
  anchor = document.createElement('canvas'); hlT = -9; hl: ReturnType<typeof headlines> = [];

  constructor(scene: THREE.Scene, public sim: Sim) {
    drawPortrait(this.anchor, 'anchor_v24');
    for (const loc of SCREENS) {
      const l = sim.locs[loc], canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 288;
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      mesh.position.set(l.x - 12, 9, l.y - 14); scene.add(mesh);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5), new THREE.MeshBasicMaterial({ color: 0x141826 })); post.position.set(l.x - 12, 4.5, l.y - 14.4); scene.add(post);
      this.screens.push({ mesh, canvas, tex, loc, idx: 0, sig: '' });
    }
    const centers: [number, number][] = [[1000, 600], [2000, 1200], [3300, 900], [3000, 300], [1700, 300]];
    centers.forEach(([cx, cy], i) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), new THREE.MeshStandardMaterial({ color: 0x1a1d2a })));
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b5c })); eye.position.y = -0.3; g.add(eye);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(5, 16, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.position.y = -8; g.add(cone);
      scene.add(g); this.drones.push({ g, phase: i * 1.7, cx, cy, r: 60 + hrand(61, i) * 90 });
    });
    // flying traffic high above the streets
    const paths = Array.from({ length: 46 }, (_, i) => {
      const ns = hrand(70, i) < 0.5, c = Math.round((hrand(71, i) * 3400) / 100) * 100;
      return { x0: ns ? c + (hrand(72, i) < 0.5 ? 4 : -4) : -400, z0: ns ? -1700 : Math.round((hrand(73, i) * 3200 - 1000) / 100) * 100, dx: ns ? 0 : 1, dz: ns ? 1 : 0, y: 70 + hrand(74, i) * 110, v: (25 + hrand(75, i) * 25) * (hrand(76, i) < 0.5 ? 1 : -1), span: ns ? 3800 : 4300, ph: hrand(77, i) };
    });
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.9, 5.2), new THREE.MeshStandardMaterial({ color: 0x1a1d28, metalness: 0.8, roughness: 0.3 }), paths.length);
    const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(2.0, 0.15, 5.4), new THREE.MeshBasicMaterial({ toneMapped: false }), paths.length);
    paths.forEach((p, i) => lights.setColorAt(i, new THREE.Color(['#ff3b5c', '#35f2e6', '#ffe14a', '#ff4fd8'][i % 4]).multiplyScalar(2)));
    body.frustumCulled = lights.frustumCulled = false; scene.add(body, lights); this.fly = { body, lights, paths };
    // elevated highway traffic (both directions)
    { const N = 70, body = new THREE.InstancedMesh(new THREE.BoxGeometry(4.4, 1.3, 1.9), new THREE.MeshStandardMaterial({ metalness: 0.7, roughness: 0.3 }), N);
      const lt = new THREE.InstancedMesh(new THREE.BoxGeometry(4.5, 0.12, 1.7), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
      for (let i = 0; i < N; i++) { body.setColorAt(i, new THREE.Color().setHSL(hrand(80, i), 0.4, 0.2 + hrand(81, i) * 0.3)); lt.setColorAt(i, new THREE.Color(i % 2 ? 0xff1838 : 0xeaf6ff).multiplyScalar(1.5)); }
      body.frustumCulled = lt.frustumCulled = false; scene.add(body, lt); this.hwy = { body, lt, N }; }
    // giant hologram over Unity Square
    { const c = document.createElement('canvas'); drawPortrait(c, 'helion_muse'); const g = c.getContext('2d')!;
      g.globalCompositeOperation = 'source-over'; for (let y = 0; y < c.height; y += 3) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, c.width, 1); }
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      this.holo = new THREE.Mesh(new THREE.PlaneGeometry(34, 44), new THREE.MeshBasicMaterial({ map: tx, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75, color: 0x9ff8ff, side: THREE.DoubleSide }));
      this.holo.position.set(3290, 38, 1010); scene.add(this.holo); }
  }

  update(now: number, px: number, py: number, camYaw: number, tf?: number) {
    const w = this.sim.world, t0 = tf ?? w.t;
    { const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
      this.fly.paths.forEach((p, i) => {
        const d = ((p.ph * p.span + p.v * t0) % p.span + p.span) % p.span;
        Q.setFromAxisAngle(V.set(0, 1, 0), p.dx ? Math.PI / 2 : 0);
        M.compose(V.set(p.x0 + p.dx * d, p.y + Math.sin(now + i) * 0.6, p.z0 + p.dz * d), Q, S); this.fly.body.setMatrixAt(i, M);
        M.compose(V.set(p.x0 + p.dx * d, p.y - 0.5, p.z0 + p.dz * d), Q, S); this.fly.lights.setMatrixAt(i, M);
      });
      this.fly.body.instanceMatrix.needsUpdate = true; this.fly.lights.instanceMatrix.needsUpdate = true; }
    { const M = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), span = 4600;
      for (let i = 0; i < this.hwy.N; i++) { const dir = i % 2 ? 1 : -1, sp = 24 + hrand(82, i) * 14, x = -500 + (((hrand(83, i) * span + dir * sp * t0) % span) + span) % span, z = 1300 + dir * (3 + (i % 4 < 2 ? 0 : 4.5));
        M.compose(V.set(x, 13.3, z), Q, S); this.hwy.body.setMatrixAt(i, M); M.compose(V.set(x, 13.1, z), Q, S); this.hwy.lt.setMatrixAt(i, M); }
      this.hwy.body.instanceMatrix.needsUpdate = true; this.hwy.lt.instanceMatrix.needsUpdate = true; }
    this.holo.lookAt(px, this.holo.position.y, py);
    (this.holo.material as THREE.MeshBasicMaterial).opacity = (w.feeders.tower ? 0.7 : 0.15) * (0.85 + Math.sin(now * 13) * 0.05 + (Math.sin(now * 0.7) > 0.97 ? -0.5 : 0));
    // drones: patrol loops, parked at the dispatch roof while charging 20:00-20:30
    const charging = t0 >= 20 * 3600 && t0 < 20.5 * 3600;
    for (const d of this.drones) {
      const a = d.phase + t0 / 40;
      const tx = charging ? 1700 + d.phase * 2 : d.cx + Math.cos(a) * d.r, tz = charging ? 300 + d.phase : d.cy + Math.sin(a) * d.r;
      d.g.position.x += (tx - d.g.position.x) * 0.05; d.g.position.z += (tz - d.g.position.z) * 0.05;
      d.g.position.y += ((charging ? 6 : 28 + Math.sin(now * 2 + d.phase) * 1.2) - d.g.position.y) * 0.05;
      (d.g.children[2] as THREE.Mesh).visible = !charging;
    }
    for (const m of this.ads) { m.lookAt(px, m.position.y, py); (m.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(now * 3 + m.position.x) * 0.15; }
    for (const sc of this.screens) {
      const l = this.sim.locs[sc.loc];
      if (Math.hypot(l.x - px, l.y - py) > 140) continue;
      if (now - this.hlT > 0.5) { this.hlT = now; this.hl = headlines(this.sim); }
      const hl = this.hl, idx = Math.floor(now / 6) % hl.length, h = hl[idx];
      const sig = h.key + (h.params ? JSON.stringify(h.params) : '') + t('ui.news');
      if (sig === sc.sig) continue; sc.sig = sig;
      const g = sc.canvas.getContext('2d')!;
      g.fillStyle = '#05070f'; g.fillRect(0, 0, 512, 288);
      const grd = g.createLinearGradient(0, 0, 512, 288); grd.addColorStop(0, '#10224a'); grd.addColorStop(1, '#2a0f3a'); g.fillStyle = grd; g.fillRect(8, 8, 496, 272);
      g.drawImage(this.anchor, 14, 40, 150, 190);
      g.fillStyle = '#ffe14a'; g.fillRect(14, 12, 150, 24); g.fillStyle = '#000'; g.font = '700 18px Oswald, sans-serif'; g.fillText(t('ui.news'), 22, 31);
      g.fillStyle = '#fff'; g.font = '500 25px "JetBrains Mono", monospace';
      const words = t('news.' + h.key, h.params).split(' '); let line = '', y = 80; 
      for (const wd of words) { if ((line + wd).length > 20) { g.fillText(line, 180, y); y += 34; line = ''; } line += wd + ' '; }
      g.fillText(line, 180, y);
      g.fillStyle = '#35f2e6'; g.fillRect(8, 252, 496, 28); g.fillStyle = '#000'; g.font = '16px "JetBrains Mono", monospace';
      g.fillText(hl.map(x => t('news.' + x.key, x.params)).join(' ◆ ').slice(0, 64), 14, 272);
      sc.tex.needsUpdate = true;
    }
    void camYaw;
  }
}
