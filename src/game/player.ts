import * as THREE from 'three';
import type { Input } from '../core/input';
import type { City } from '../world/city';

// Первое лицо: ходьба по groundH, выталкивание из стен, покачивание.
export class Player {
  pos = new THREE.Vector3(-71.4, 27.4, -57.2);
  yaw = 2.35;
  pitch = -0.06;
  bob = 0;
  private cam: THREE.PerspectiveCamera;

  constructor(cam: THREE.PerspectiveCamera) {
    this.cam = cam;
  }

  update(dt: number, input: Input, city: City, frozen: boolean) {
    const look = input.takeMouse();
    if (input.locked && !frozen) {
      this.yaw -= look.dx * 0.002;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - look.dy * 0.002));
    }

    if (!frozen) {
      const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
      const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
      if (f || s) {
        const run = input.down('ShiftLeft') || input.down('ShiftRight');
        const sp = (run ? 5.1 : 3.0) * dt;
        const dx = (-Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) * sp;
        const dz = (-Math.cos(this.yaw) * f - Math.sin(this.yaw) * s) * sp;
        const feet = city.groundAt(this.pos.x, this.pos.z);
        let nx = this.pos.x + dx, nz = this.pos.z;
        if (!city.collides(nx, nz, 0.34, feet)) {
          [nx, nz] = city.resolve(nx, nz, 0.34, feet);
          if (!city.collides(nx, nz, 0.33, feet)) this.pos.x = nx;
        }
        nx = this.pos.x;
        nz = this.pos.z + dz;
        if (!city.collides(nx, nz, 0.34, feet)) {
          [nx, nz] = city.resolve(nx, nz, 0.34, feet);
          if (!city.collides(nx, nz, 0.33, feet)) this.pos.z = nz;
        }
        this.bob += dt * (run ? 11 : 7);
      } else {
        this.bob += dt * 1.2;
      }
    }

    this.pos.y = city.groundAt(this.pos.x, this.pos.z);
    const bobY = Math.sin(this.bob) * 0.012;
    this.cam.position.set(this.pos.x, this.pos.y + 1.65 + bobY, this.pos.z);
    this.cam.rotation.set(this.pitch, this.yaw, 0);
  }

  teleport(x: number, z: number) {
    this.pos.x = x;
    this.pos.z = z;
    this.pos.y = 0;
  }

  get feet() {
    return this.pos.y;
  }
}
