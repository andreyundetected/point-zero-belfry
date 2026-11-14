import * as THREE from 'three';
import { settings } from './settings';
import { Body, newBody, stepBody, HEIGHT, supportAt } from './physics';
import { groundH } from '../world/terrain';
import { BOUNDS } from '../world/layout';

/** First-person controller on top of the collision physics. Eye 1.65 m. */
export class Player {
  yaw = 0; pitch = 0; keys: Record<string, boolean> = {}; t = 0; body: Body; bob = 0; safe = { x: 0, z: 0, y: 0 };
  autoRun = false; walkTo: { x: number; z: number } | null = null; canClickMove: () => boolean = () => true; stuckT = 0; frozen = false; jumpQueued = false; onRespawn?: () => void; dom: HTMLElement;
  constructor(public cam: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.dom = dom;
    cam.rotation.order = 'YXZ'; this.body = newBody(0, 0);
    addEventListener('keydown', e => { this.keys[e.code] = true; if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) { if (e.code === 'KeyS') this.autoRun = false; this.walkTo = null; } if (e.code === 'Space') { this.jumpQueued = true; e.preventDefault(); } });
    addEventListener('keyup', e => this.keys[e.code] = false);
    dom.addEventListener('click', () => { if (!document.pointerLockElement) dom.requestPointerLock(); });
    addEventListener('mousemove', e => { if (document.pointerLockElement && !this.frozen) { const k = 0.0022 * settings.sens; this.yaw -= e.movementX * k; this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch - e.movementY * k)); } });
  }
  place(x: number, z: number, lookX: number, lookZ: number, lookDy = 0, y?: number) {
    this.body = newBody(x, z); if (y !== undefined) this.body.y = y;
    this.yaw = Math.atan2(-(lookX - x), -(lookZ - z)); this.pitch = lookDy;
    this.safe = { x, z, y: this.body.y }; this.apply();
  }
  apply() { this.cam.position.set(this.body.x, this.body.y + 1.65 - (this.crouching ? 0.45 : 0) + Math.sin(this.bob) * 0.012, this.body.z); this.cam.rotation.set(this.pitch, this.yaw, 0); }
  crouching = false;
  /** click = walk to the spot under the crosshair (ray against the ground and solid boxes) */
  clickMove() {
    const o = this.cam.position, d = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    for (let t = 0.6; t < 30; t += 0.4) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y <= supportAt(x, z, this.body.y + 0.3) + 0.15) { this.walkTo = { x, z }; this.autoRun = false; this.stuckT = 0; return; } }
  }
  update(dt: number) {
    this.t += dt; const k = this.keys, b = this.body;
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    let wx = 0, wz = 0;
    if (this.frozen) { this.walkTo = null; this.autoRun = false; }
    if (!f && !s && this.autoRun) { wx = -Math.sin(this.yaw); wz = -Math.cos(this.yaw); }
    else if (!f && !s && this.walkTo) { const dx = this.walkTo.x - b.x, dz = this.walkTo.z - b.z, d = Math.hypot(dx, dz); if (d < 0.7) this.walkTo = null; else { wx = dx / d; wz = dz / d; } }
    if ((f || s) && !this.frozen) { const l = Math.hypot(f, s); wx = (-Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) / l; wz = (-Math.cos(this.yaw) * f - Math.sin(this.yaw) * s) / l; }
    this.crouching = !!(k.KeyC || k.ControlLeft) && !this.frozen;
    const run = !!(k.ShiftLeft || k.ShiftRight) && !this.crouching;
    const jump = this.jumpQueued && !this.frozen; this.jumpQueued = false;
    stepBody(b, this.crouching ? wx * 0.5 : wx, this.crouching ? wz * 0.5 : wz, run, jump, dt, this.crouching ? 1.2 : HEIGHT);
    if (this.walkTo && Math.hypot(b.vx, b.vz) < 0.4) { this.stuckT += dt; if (this.stuckT > 0.6) { this.walkTo = null; this.stuckT = 0; } } else this.stuckT = 0;
    if (b.grounded && (wx || wz)) this.bob += dt * (run ? 12 : 8.5);
    if (b.grounded && !b.inWater && (this.t | 0) !== ((this.t - dt) | 0)) this.safe = { x: b.x, z: b.z, y: b.y };
    if (b.inWater) { // cold water: back to the last dry spot
      const q = this.safe; this.body = newBody(q.x, q.z); this.body.y = q.y; this.onRespawn?.();
    }
    this.apply();
  }
}
export { groundH, BOUNDS };
