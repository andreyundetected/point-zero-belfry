import { world, Box } from '../world/colliders';
import { groundH, inCanal, inHarbour } from '../world/terrain';
import { BOUNDS, WATER_Y } from '../world/layout';

export const R = 0.32, HEIGHT = 1.75, STEP = 0.42, G = 15, JUMP_V = 5.2;
export interface Body { x: number; y: number; z: number; vx: number; vz: number; vy: number; grounded: boolean; inWater: boolean; }
export const newBody = (x: number, z: number): Body => ({ x, y: groundH(x, z), z, vx: 0, vz: 0, vy: 0, grounded: true, inWater: false });

/** floor height under (x,z) for a body with feet at y: terrain or the highest box top it can step onto */
export function supportAt(x: number, z: number, feetY: number, r = R * 0.6): number {
  const gh = groundH(x, z); let s = feetY < gh - 1.2 ? -1e9 : gh; // below ground (cellar): only boxes support
  for (const b of world.near(x, z)) {
    if (b.off || b.y1 > feetY + STEP) continue;
    if (circleHitsBox(x, z, r, b) && b.y1 > s) s = b.y1;
  }
  return s;
}
function circleHitsBox(x: number, z: number, r: number, b: Box): boolean {
  const dx = x - b.cx, dz = z - b.cz, lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
  const nx = Math.max(-b.hx, Math.min(b.hx, lx)), nz = Math.max(-b.hz, Math.min(b.hz, lz));
  return (lx - nx) ** 2 + (lz - nz) ** 2 < r * r;
}
/** push the body out of boxes that block it horizontally */
function resolveHoriz(p: Body, head: number) {
  for (let it = 0; it < 3; it++) {
    for (const b of world.near(p.x, p.z)) {
      if (b.off || p.y + STEP >= b.y1 || p.y + head <= b.y0) continue; // below step height or above head: not a wall
      const dx = p.x - b.cx, dz = p.z - b.cz, lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
      const nx = Math.max(-b.hx, Math.min(b.hx, lx)), nz = Math.max(-b.hz, Math.min(b.hz, lz));
      let ox = lx - nx, oz = lz - nz, d2 = ox * ox + oz * oz, px = 0, pz = 0;
      if (d2 > R * R) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (R - d) / d; px = ox * k; pz = oz * k; }
      else { // centre inside the box: shortest way out
        const ex = b.hx - Math.abs(lx), ez = b.hz - Math.abs(lz);
        if (ex < ez) px = (lx >= 0 ? 1 : -1) * (ex + R); else pz = (lz >= 0 ? 1 : -1) * (ez + R);
      }
      p.x += px * b.cos + pz * b.sin; p.z += -px * b.sin + pz * b.cos;
    }
  }
}
export interface MoveInput { fx: number; fz: number; run: boolean; jump: boolean; crouch?: boolean; }
/** One physics step. wishX/Z are world-space unit-ish direction. */
export function stepBody(p: Body, wishX: number, wishZ: number, run: boolean, jump: boolean, dt: number, head = HEIGHT) {
  const speed = run ? 5.0 : 2.9;
  const accel = p.grounded ? 14 : 3.5;
  const tx = wishX * speed, tz = wishZ * speed, k = Math.min(1, accel * dt);
  p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k;
  if (jump && p.grounded) { p.vy = JUMP_V; p.grounded = false; }
  // horizontal, sub-stepped so thin walls can't be tunnelled
  const mx = p.vx * dt, mz = p.vz * dt, n = Math.max(1, Math.ceil(Math.hypot(mx, mz) / 0.2));
  for (let i = 0; i < n; i++) { p.x += mx / n; p.z += mz / n; resolveHoriz(p, head); }
  p.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, p.x)); p.z = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, p.z));
  // vertical
  p.vy -= G * dt; p.y += p.vy * dt;
  const sup = supportAt(p.x, p.z, p.y);
  if (sup < -1e8) { p.vy = Math.max(p.vy, -20); p.grounded = false; }
  else if (p.vy <= 0 && p.y <= sup + 0.001) { p.y = sup; p.vy = 0; p.grounded = true; }
  else if (p.grounded && p.vy < 0 && p.y - sup < 0.3) { p.y = sup; p.vy = 0; } // stick to slopes/stairs going down
  else p.grounded = false;
  if (p.vy > 0) for (const b of world.near(p.x, p.z)) { // bump head on ceilings
    if (!b.off && b.y0 > p.y + head - 0.3 && b.y0 < p.y + head + p.vy * dt + 0.05 && circleHitsBox(p.x, p.z, R * 0.8, b)) { p.vy = 0; break; }
  }
  p.inWater = p.y < WATER_Y - 0.5 && (inCanal(p.x, p.z) || inHarbour(p.z));
}

/** can a point at (ax,ay,az) see (bx,by,bz)? Walls, closed doors and the cellar block sight; furniture does not. */
export function lineOfSight(ax: number, az: number, ay: number, bx: number, bz: number, by: number): boolean {
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(d / 0.35));
  for (let i = 1; i < n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t;
    for (const b of world.near(x, z)) { if (b.off || (b.kind !== 'building' && b.kind !== 'cellar' && b.kind !== 'door' && b.kind !== 'tram' && b.kind !== 'floor')) continue; if (y < b.y0 || y > b.y1) continue;
      const dx = x - b.cx, dz = z - b.cz, lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos; if (Math.abs(lx) < b.hx && Math.abs(lz) < b.hz) return false; } }
  return true;
}
