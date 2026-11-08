// Pure-TS description of the enterable places: origin of the facade (front centre), facing, size, and local->world transform.
import { groundH } from '../world/terrain';
export interface Site { id: string; x: number; z: number; ry: number; w: number; d: number; floors: number; }
export const SITES: Record<string, Site> = {
  tavern: { id: 'tavern', x: 19.9, z: 9, ry: -Math.PI / 2, w: 12, d: 9, floors: 2 },
  orven: { id: 'orven', x: -46, z: -33.3, ry: Math.PI, w: 5, d: 4, floors: 1 },
  foma: { id: 'foma', x: -40, z: -14.4, ry: 0, w: 6.5, d: 8, floors: 1 },
  contora: { id: 'contora', x: 44, z: 23.2, ry: Math.PI, w: 10, d: 8, floors: 2 },
  priyut: { id: 'priyut', x: 50, z: -66, ry: 0, w: 24, d: 9, floors: 3 },
  tikhon: { id: 'tikhon', x: -38, z: 40.1, ry: Math.PI, w: 6, d: 6, floors: 1 },
  tower: { id: 'tower', x: -70, z: -54, ry: 0, w: 8, d: 8, floors: 9 },
};
export const FH = 3.1;
/** local (lx along the facade, lz into the building = negative) -> world x,z */
export function loc(s: Site | string, lx: number, lz: number): { x: number; z: number } {
  const S = typeof s === 'string' ? SITES[s] : s, c = Math.cos(S.ry), sn = Math.sin(S.ry);
  return { x: S.x + lx * c + lz * sn, z: S.z - lx * sn + lz * c };
}
/** floor height of storey f in a hollow site (matches building(): base = groundH(centre-of-body... facade centre) - 0.3) */
export function floorY(s: Site | string, f = 0): number {
  const S = typeof s === 'string' ? SITES[s] : s; return groundH(S.x, S.z) - 0.3 + 0.35 + f * FH;
}
/** world position inside a site on storey f */
export function inSite(s: string, lx: number, lz: number, f = 0): { x: number; z: number; y: number } { const p = loc(s, lx, lz); return { ...p, y: floorY(s, f) }; }
/** yaw that makes a body face a world target */
export const faceTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
/** is world point inside the footprint of a site (any storey) */
export function insideSite(s: string, x: number, z: number, pad = 0): boolean {
  const S = SITES[s], dx = x - S.x, dz = z - S.z, c = Math.cos(S.ry), sn = Math.sin(S.ry), lx = dx * c - dz * sn, lz = dx * sn + dz * c;
  return Math.abs(lx) <= S.w / 2 + pad && lz <= pad && lz >= -S.d - pad;
}
