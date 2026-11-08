import { world } from './colliders';
import { groundH, inCanal, inHarbour } from './terrain';
import { BARGE, BRIDGE, PIER3, PIER7 } from './layout';
import { NavGrid } from '../sim/nav';

const KINDS = new Set(['building', 'solid', 'rail', 'prop']);
/** rasterise every standing obstacle (and the water) into a 0.5 m walkability grid for NPC routing */
export function buildNav(): NavGrid {
  const x0 = -112, z0 = -102, cs = 0.5, nx = 448, nz = 410, blocked = new Uint8Array(nx * nz);
  const walkable = (x: number, z: number) => (Math.abs(z) < BRIDGE.z1 + 0.3 && Math.abs(x) < 9.5) || (Math.abs(x - PIER3.x) < PIER3.w / 2 + 0.2 && z > 56 && z < PIER3.z1) || (Math.abs(x - PIER7.x) < PIER7.w / 2 + 0.2 && z > 56 && z < PIER7.z1) || (Math.abs(x - BARGE.x) < BARGE.w / 2 && Math.abs(z - BARGE.z) < BARGE.l / 2);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = x0 + (i + 0.5) * cs, z = z0 + (j + 0.5) * cs; if ((inCanal(x, z) || inHarbour(z)) && !walkable(x, z)) blocked[j * nx + i] = 1; }
  for (const b of world.boxes) {
    if (!KINDS.has(b.kind)) continue; const gh = groundH(b.cx, b.cz); if (b.y1 - gh < 0.8 || b.y0 > gh + 1.6) continue;
    const pad = 0.25, r = b.r + pad, i0 = Math.max(0, Math.floor((b.cx - r - x0) / cs)), i1 = Math.min(nx - 1, Math.floor((b.cx + r - x0) / cs)), j0 = Math.max(0, Math.floor((b.cz - r - z0) / cs)), j1 = Math.min(nz - 1, Math.floor((b.cz + r - z0) / cs));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = x0 + (i + 0.5) * cs, z = z0 + (j + 0.5) * cs, dx = x - b.cx, dz = z - b.cz, lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos; if (Math.abs(lx) <= b.hx + pad && Math.abs(lz) <= b.hz + pad) blocked[j * nx + i] = 1; }
  }
  return { x0, z0, cs, nx, nz, blocked };
}
