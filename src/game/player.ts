import * as THREE from 'three';
import { groundH } from '../world/terrain';

/** First-person controller. Eye height 1.65 m, always on groundH. */
export class Player {
  yaw = 0; pitch = 0; keys: Record<string, boolean> = {}; t = 0;
  constructor(public cam: THREE.PerspectiveCamera, dom: HTMLElement) {
    cam.rotation.order = 'YXZ';
    addEventListener('keydown', e => this.keys[e.code] = true); addEventListener('keyup', e => this.keys[e.code] = false);
    dom.addEventListener('click', () => dom.requestPointerLock());
    addEventListener('mousemove', e => { if (document.pointerLockElement) { this.yaw -= e.movementX * 0.002; this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - e.movementY * 0.002)); } });
  }
  place(x: number, z: number, lookX: number, lookZ: number, lookY = 1.6) {
    this.cam.rotation.order = 'YXZ';
    this.cam.position.set(x, groundH(x, z) + 1.65, z); this.cam.lookAt(lookX, groundH(lookX, lookZ) + lookY, lookZ);
    this.yaw = this.cam.rotation.y; this.pitch = this.cam.rotation.x;
  }
  update(dt: number) {
    this.t += dt; const k = this.keys, cam = this.cam;
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    if (f || s) {
      const run = k.ShiftLeft || k.ShiftRight, sp = (run ? 5.2 : 3) * dt;
      cam.position.x += (-Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) * sp; cam.position.z += (-Math.cos(this.yaw) * f - Math.sin(this.yaw) * s) * sp;
      cam.position.y = groundH(cam.position.x, cam.position.z) + 1.65 + Math.sin(this.t * (run ? 12 : 9)) * 0.012;
    }
    if (document.pointerLockElement) cam.rotation.set(this.pitch, this.yaw, 0);
  }
}
