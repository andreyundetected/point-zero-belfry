import * as THREE from 'three';
import { hrand } from '../sim/util';
import { CELL, BOUNDS } from '../sim/grid';
import { NEON } from './textures';

/** Car model as instanced parts (extruded body profile, glass cabin, wheels, light bars, underglow). */
function bodyGeo() {
  const s = new THREE.Shape();
  s.moveTo(-2.25, 0.25); s.lineTo(2.1, 0.25); s.quadraticCurveTo(2.35, 0.3, 2.3, 0.62); s.lineTo(2.2, 0.82); s.lineTo(0.9, 0.9);
  s.lineTo(-1.6, 0.92); s.lineTo(-2.25, 0.85); s.quadraticCurveTo(-2.35, 0.5, -2.25, 0.25);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.8, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -0.9); g.rotateY(-Math.PI / 2); return g; // length along z
}
function cabinGeo() {
  const s = new THREE.Shape();
  s.moveTo(-1.45, 0.9); s.lineTo(0.85, 0.9); s.lineTo(0.2, 1.42); s.lineTo(-1.1, 1.45); s.lineTo(-1.45, 0.9);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false }); g.translate(0, 0, -0.8); g.rotateY(-Math.PI / 2); return g;
}
const PARTS = ['body', 'cabin', 'wheels', 'head', 'tail', 'glow', 'beam', 'roof'] as const;
type Part = typeof PARTS[number];

interface Loop { pts: { x: number; y: number }[]; len: number; seg: number[] }
interface Car { loop: number; s: number; speed: number; kind: number }

export class Traffic {
  m = {} as Record<Part, THREE.InstancedMesh>;
  loops: Loop[] = []; cars: Car[] = []; parked: { x: number; y: number; yaw: number; kind: number }[] = [];
  N: number; dyn = 0; private lastT = -1;
  private M = new THREE.Matrix4(); private Mb = new THREE.Matrix4(); private Q = new THREE.Quaternion(); private V = new THREE.Vector3(); private S = new THREE.Vector3(1, 1, 1); private zero = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(scene: THREE.Scene, avoid: { x: number; y: number; r: number }[], extraSlots: number) {
    // loops: rectangles of whole blocks driven in the right-hand lane
    let tries = 0;
    while (this.loops.length < 110 && tries++ < 9000) {
      const gx = Math.round((hrand(600, tries) * 3600 - 100) / CELL) * CELL, gy = Math.round((hrand(601, tries) * 2200 - 500) / CELL) * CELL;
      const w = (1 + Math.floor(hrand(602, tries) * 4)) * CELL, h = (1 + Math.floor(hrand(603, tries) * 3)) * CELL;
      if (gx + w > BOUNDS.x1 || gy + h > BOUNDS.y1 || gx < BOUNDS.x0) continue;
      if (gx < 2730 && gx + w > 2470) continue; // river
      const cw = hrand(604, tries) < 0.5, o = 2.3;
      let pts = [{ x: gx + o, y: gy + o }, { x: gx + w - o, y: gy + o }, { x: gx + w - o, y: gy + h - o }, { x: gx + o, y: gy + h - o }];
      if (!cw) pts = [{ x: gx - o, y: gy - o }, { x: gx - o, y: gy + h + o }, { x: gx + w + o, y: gy + h + o }, { x: gx + w + o, y: gy - o }];
      let bad = false;
      for (let i = 0; i < 4 && !bad; i++) { const a = pts[i], b = pts[(i + 1) % 4]; for (let k = 0; k <= 20; k++) { const x = a.x + (b.x - a.x) * k / 20, y = a.y + (b.y - a.y) * k / 20; if (avoid.some(p => Math.hypot(p.x - x, p.y - y) < p.r + 14)) { bad = true; break; } } }
      if (bad) continue;
      pts.push(pts[0]);
      const seg = [0]; for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      this.loops.push({ pts, len: seg[seg.length - 1], seg });
    }
    this.loops.forEach((l, li) => { const n = Math.max(1, Math.floor(l.len / 130)); for (let k = 0; k < n; k++) this.cars.push({ loop: li, s: (k / n) * l.len + hrand(605, li, k) * 30, speed: 8 + hrand(606, li, k) * 6, kind: kindOf(hrand(607, li, k)) }); });
    // parked cars along curbs
    for (let i = 0; i < 520; i++) {
      const gx = Math.round((hrand(610, i) * 3700 - 100) / CELL) * CELL, gy = Math.round((hrand(611, i) * 3300 - 1300) / CELL) * CELL, along = 20 + hrand(612, i) * 60, side = hrand(613, i) < 0.5 ? -1 : 1, vert = hrand(614, i) < 0.5;
      const x = vert ? gx + side * 7.2 : gx + along, y = vert ? gy + along : gy + side * 7.2;
      if (x > 2470 && x < 2730) continue; if (avoid.some(p => Math.hypot(p.x - x, p.y - y) < p.r + 10)) continue;
      this.parked.push({ x, y, yaw: vert ? 0 : Math.PI / 2, kind: kindOf(hrand(615, i)) });
    }
    this.N = this.cars.length + this.parked.length + extraSlots; this.dyn = this.cars.length + this.parked.length;
    const g: Record<Part, THREE.BufferGeometry> = {
      body: bodyGeo(), cabin: cabinGeo(),
      wheels: (() => { const parts: THREE.BufferGeometry[] = []; for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) parts.push(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12).rotateZ(Math.PI / 2).translate(x, 0.36, z)); return mergeAll(parts); })(),
      head: mergeAll([new THREE.BoxGeometry(1.6, 0.08, 0.05).translate(0, 0.72, 2.3)]),
      tail: new THREE.BoxGeometry(1.85, 0.08, 0.05).translate(0, 0.78, -2.31),
      glow: new THREE.PlaneGeometry(2.2, 4.4).rotateX(-Math.PI / 2).translate(0, 0.06, 0),
      beam: new THREE.PlaneGeometry(3.4, 11).rotateX(-Math.PI / 2).translate(0, 0.07, 7.5),
      roof: new THREE.BoxGeometry(0.9, 0.18, 0.3).translate(0, 1.55, -0.3),
    };
    const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const mat: Record<Part, THREE.Material> = {
      body: new THREE.MeshStandardMaterial({ roughness: 0.22, metalness: 0.75, envMapIntensity: 1.4 }),
      cabin: new THREE.MeshStandardMaterial({ color: 0x0a0e16, roughness: 0.05, metalness: 0.9, envMapIntensity: 2 }),
      wheels: new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.8 }),
      head: new THREE.MeshBasicMaterial({ color: 0xeaf6ff, toneMapped: false }),
      tail: new THREE.MeshBasicMaterial({ color: 0xff1838, toneMapped: false }),
      glow: new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }),
      beam: new THREE.MeshBasicMaterial({ map: glowTex, color: 0xbfdcff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.22 }),
      roof: new THREE.MeshBasicMaterial({ toneMapped: false }),
    };
    for (const p of PARTS) { const im = new THREE.InstancedMesh(g[p], mat[p], this.N); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.m[p] = im; scene.add(im); }
    for (const p of PARTS) this.m[p].setColorAt(0, new THREE.Color(1, 1, 1));
    for (let i = 0; i < this.N; i++) { this.m.head.setColorAt(i, new THREE.Color(1, 1, 1)); this.m.tail.setColorAt(i, new THREE.Color(1, 1, 1)); }
    for (const p of PARTS) if (this.m[p].instanceColor) this.m[p].instanceColor!.needsUpdate = true;
  }
  private colors(kind: number, seed: number) {
    const c = new THREE.Color(), r = hrand(620, seed);
    if (kind === 1) c.setHex(0xf2c200); else if (kind === 2) c.setHex(0xd8dde8); else if (kind === 3) c.setHex(0x050507);
    else c.setHSL(r, 0.25 + hrand(621, seed) * 0.4, 0.12 + hrand(622, seed) * 0.35);
    const glow = new THREE.Color(kind === 3 ? 0x000000 : NEON[Math.floor(hrand(623, seed) * NEON.length)]).multiplyScalar(hrand(624, seed) < 0.4 || kind === 4 ? 1 : 0);
    const roof = new THREE.Color(kind === 1 ? 0xffe14a : kind === 2 ? 0x2060ff : 0);
    return { c, glow, roof };
  }
  private cache = new Map<number, ReturnType<Traffic['colors']>>();
  private v = 0; private vRoof = 0; private vBeam = 0;
  private place(id: number, x: number, y: number, yaw: number, kind: number, moving: boolean, scale = 1, roofCol?: THREE.Color) {
    let col = this.cache.get(id * 8 + kind); if (!col) { col = this.colors(kind, id); this.cache.set(id * 8 + kind, col); }
    this.Q.setFromAxisAngle(this.V.set(0, 1, 0), yaw);
    this.Mb.compose(this.V.set(x, 0.02, y), this.Q, this.S.set(scale, kind === 4 ? 1.25 : 1, scale));
    const i = this.v++;
    for (const p of ['body', 'cabin', 'wheels', 'head', 'tail', 'glow'] as Part[]) this.m[p].setMatrixAt(i, this.Mb);
    this.m.body.setColorAt(i, col.c); this.m.glow.setColorAt(i, col.glow);
    if (kind === 1 || kind === 2) { const r = this.vRoof++; this.m.roof.setMatrixAt(r, this.Mb); this.m.roof.setColorAt(r, roofCol ?? col.roof); }
    if (moving) this.m.beam.setMatrixAt(this.vBeam++, this.Mb);
  }

  /** extra: NPC-driven cars (key NPCs, taxis, convoy, police) placed at their simulated positions */
  update(t: number, px: number, py: number, lights: boolean, extra: { x: number; y: number; yaw: number; kind: number; moving: boolean }[], now: number) {
    const dt = this.lastT < 0 || Math.abs(t - this.lastT) > 30 || t < this.lastT ? 0 : t - this.lastT; this.lastT = t;
    const R = 420, mul = lights ? 1 : 0.3; this.v = 0; this.vRoof = 0; this.vBeam = 0;
    // advance along loops: stop before red lights (same 60 s cycle as the city signals), keep a gap to the car ahead
    const ph = t % 60;
    const green = (ns: boolean) => { const p = ns ? ph : (ph + 30) % 60; return lights ? p < 27 : true; };
    const byLoop = new Map<number, Car[]>();
    for (const c of this.cars) (byLoop.get(c.loop) ?? byLoop.set(c.loop, []).get(c.loop)!).push(c);
    for (const [li, cs] of byLoop) {
      const l = this.loops[li]; cs.sort((a, b) => a.s - b.s);
      cs.forEach((c, k) => {
        let step = c.speed * mul * dt;
        const ahead = cs[(k + 1) % cs.length]; if (cs.length > 1) { const gap = ((ahead.s - c.s) % l.len + l.len) % l.len; step = Math.min(step, Math.max(0, gap - 8)); }
        // next intersection on the current segment
        let j = 1; while (j < l.seg.length - 1 && l.seg[j] < c.s) j++;
        const a = l.pts[j - 1], b = l.pts[j], ns = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
        const along = c.s - l.seg[j - 1], segLen = l.seg[j] - l.seg[j - 1];
        const pos0 = ns ? a.y : a.x, dir = Math.sign(ns ? b.y - a.y : b.x - a.x);
        const nextX = (k2: number) => pos0 + dir * k2;
        for (let d = 1; d < segLen; d++) {
          const coord = nextX(d); if (Math.abs(coord - Math.round(coord / CELL) * CELL) < 0.6) {
            const stopAt = d - 12; if (stopAt > along && stopAt - along < step + 0.5 && !green(ns)) step = Math.max(0, stopAt - along); break; }
        }
        c.s = (c.s + step) % l.len;
      });
    }
    this.cars.forEach((c, i) => {
      const l = this.loops[c.loop];
      let k = 1; while (k < l.seg.length - 1 && l.seg[k] < c.s) k++;
      const a = l.pts[k - 1], b = l.pts[k], f = (c.s - l.seg[k - 1]) / (l.seg[k] - l.seg[k - 1]);
      const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
      if (Math.abs(x - px) > R || Math.abs(y - py) > R) return;
      this.place(i, x, y, Math.atan2(b.x - a.x, b.y - a.y), c.kind, true);
    });
    this.parked.forEach((p, j) => { const i = this.cars.length + j; if (Math.abs(p.x - px) > R || Math.abs(p.y - py) > R) return; this.place(i, p.x, p.y, p.yaw, p.kind, false); });
    extra.forEach((e, j) => {
      const roof = e.kind === 2 ? new THREE.Color(Math.floor(now * 4) % 2 ? 0xff2030 : 0x2050ff) : undefined;
      this.place(this.dyn + j, e.x, e.y, e.yaw, e.kind, e.moving, e.kind === 3 ? 1.12 : 1, roof);
    });
    for (const p of PARTS) {
      this.m[p].count = p === 'roof' ? this.vRoof : p === 'beam' ? this.vBeam : this.v;
      this.m[p].instanceMatrix.needsUpdate = true; if (this.m[p].instanceColor) this.m[p].instanceColor!.needsUpdate = true;
    }
    (this.m.beam.material as THREE.MeshBasicMaterial).opacity = 0.22;
  }
}
function kindOf(r: number) { return r < 0.14 ? 1 : r < 0.18 ? 2 : r < 0.25 ? 4 : 0; }
function mergeAll(gs: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [];
  for (const g of gs) { const ng = g.toNonIndexed(); pos.push(...(ng.attributes.position.array as Float32Array)); nor.push(...(ng.attributes.normal.array as Float32Array)); }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return o;
}
