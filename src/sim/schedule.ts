import { walkY as groundH } from '../world/terrain';
import { route } from './nav';
// Keyframed NPC schedules. Between kf[i] and kf[i+1]: if kf[i].go the NPC walks (linear), otherwise holds the pose until the next key.
export interface Kf { t: number; x: number; z: number; y?: number; a: string; ry?: number; go?: boolean; hide?: boolean; speed?: number; }
export interface NpcPose { x: number; z: number; y: number; a: string; ry: number; hidden: boolean; walking: boolean; }

export class Sched {
  kfs: Kf[] = []; cx: number; cz: number; cy: number | undefined; cry: number; ca: string; ct: number;
  constructor(x: number, z: number, ry = 0, a = 'idle', t = 0, y?: number) { this.cx = x; this.cz = z; this.cy = y; this.cry = ry; this.ca = a; this.ct = t; }
  /** stay where we are until absolute time `until` */
  wait(until: number, a?: string, ry?: number) { if (a) this.ca = a; if (ry !== undefined) this.cry = ry; if (until > this.ct) { this.push({ t: this.ct, x: this.cx, z: this.cz, y: this.cy, a: this.ca, ry: this.cry }); this.ct = until; } return this; }
  /** walk a polyline starting now at speed m/s; y = floor height at the end of the path (undefined = terrain) */
  walk(path0: [number, number][], speed = 1.3, a = 'walk', yEnd?: number) {
    const path = this.routed(path0);
    for (const [x, z] of path) {
      const d = Math.hypot(x - this.cx, z - this.cz); if (d < 0.01) continue;
      this.push({ t: this.ct, x: this.cx, z: this.cz, y: this.cy, a, ry: Math.atan2(x - this.cx, z - this.cz), go: true });
      this.ct += d / speed; this.cx = x; this.cz = z; this.cry = Math.atan2(x - (this.kfs[this.kfs.length - 1].x), z - this.kfs[this.kfs.length - 1].z);
    }
    this.cy = yEnd; return this;
  }
  /** walk and arrive exactly at time `arrive` (explicit-timestamp movement, used for carts) */
  /** every leg goes through the nav grid so nobody walks through a house */
  private routed(path: [number, number][]): [number, number][] { const out: [number, number][] = []; let x = this.cx, z = this.cz; for (const [tx, tz] of path) { for (const w of route(x, z, tx, tz)) out.push(w); x = tx; z = tz; } return out; }
  walkBy(path0: [number, number][], arrive: number, a = 'walk') {
    const path = this.routed(path0); let len = 0, px = this.cx, pz = this.cz; for (const [x, z] of path) { len += Math.hypot(x - px, z - pz); px = x; pz = z; }
    return this.walkRaw(path, len / Math.max(1, arrive - this.ct), a);
  }
  private walkRaw(path: [number, number][], speed: number, a: string) { for (const [x, z] of path) { const d = Math.hypot(x - this.cx, z - this.cz); if (d < 0.01) continue; this.push({ t: this.ct, x: this.cx, z: this.cz, y: this.cy, a, ry: Math.atan2(x - this.cx, z - this.cz), go: true }); this.ct += d / speed; this.cx = x; this.cz = z; } this.cy = undefined; return this; }
  teleport(x: number, z: number, y?: number, ry?: number, a?: string) { this.cx = x; this.cz = z; this.cy = y; if (ry !== undefined) this.cry = ry; if (a) this.ca = a; return this; }
  hide(at?: number) { if (at !== undefined) this.wait(at); this.push({ t: this.ct, x: this.cx, z: this.cz, a: this.ca, hide: true }); return this; }
  show(at: number, x: number, z: number, a = 'idle', ry = 0, y?: number) { this.ct = at; this.cx = x; this.cz = z; this.cy = y; this.ca = a; this.cry = ry; return this; }
  end(a?: string, ry?: number) { if (a) this.ca = a; if (ry !== undefined) this.cry = ry; this.push({ t: this.ct, x: this.cx, z: this.cz, y: this.cy, a: this.ca, ry: this.cry }); return this; }
  private push(k: Kf) { const l = this.kfs[this.kfs.length - 1]; if (l && Math.abs(l.t - k.t) < 1e-6 && !l.go) this.kfs.pop(); this.kfs.push(k); }
  done() { if (!this.kfs.length || this.kfs[this.kfs.length - 1].t < this.ct || this.kfs[this.kfs.length - 1].go) this.end(); return this.kfs; }
}
/** evaluate a schedule at time t */
export function poseAt(kfs: Kf[], t: number): NpcPose {
  if (!kfs.length) return { x: 0, z: 0, y: 0, a: 'idle', ry: 0, hidden: true, walking: false };
  let i = -1; for (let k = 0; k < kfs.length; k++) { if (kfs[k].t <= t) i = k; else break; }
  if (i < 0) { const f = kfs[0]; return { x: f.x, z: f.z, y: f.y ?? groundH(f.x, f.z), a: f.a, ry: f.ry ?? 0, hidden: !!f.hide || true, walking: false }; }
  const k = kfs[i], n = kfs[i + 1];
  if (k.hide) return { x: k.x, z: k.z, y: groundH(k.x, k.z), a: k.a, ry: k.ry ?? 0, hidden: true, walking: false };
  if (k.go && n) {
    const u = Math.max(0, Math.min(1, (t - k.t) / Math.max(1e-6, n.t - k.t)));
    const x = k.x + (n.x - k.x) * u, z = k.z + (n.z - k.z) * u, y0 = k.y, y1 = n.y;
    const y = y0 !== undefined && y1 !== undefined ? y0 + (y1 - y0) * u : (y1 !== undefined && u > 0.5 ? y1 : y0 !== undefined && u <= 0.5 ? y0 : groundH(x, z));
    return { x, z, y, a: k.a, ry: Math.atan2(n.x - k.x, n.z - k.z), hidden: false, walking: true };
  }
  return { x: k.x, z: k.z, y: k.y ?? groundH(k.x, k.z), a: k.a, ry: k.ry ?? 0, hidden: false, walking: false };
}
