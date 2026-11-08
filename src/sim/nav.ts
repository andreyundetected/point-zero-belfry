// Walkable-cell grid + A* so that NPC schedules route around houses, the canal and furniture-free walls instead of cutting straight through them.
// Pure TS. The grid is filled by the world builder (setNav); without it (unit tests) routes are straight lines.
export interface NavGrid { x0: number; z0: number; cs: number; nx: number; nz: number; blocked: Uint8Array; }
let nav: NavGrid | null = null; export let navVersion = 0;
const cache = new Map<string, [number, number][]>();
export function setNav(g: NavGrid | null) { nav = g; navVersion++; cache.clear(); }
export const hasNav = () => !!nav;
const idx = (g: NavGrid, i: number, j: number) => j * g.nx + i;
const cell = (g: NavGrid, x: number, z: number): [number, number] => [Math.floor((x - g.x0) / g.cs), Math.floor((z - g.z0) / g.cs)];
export const isBlocked = (g: NavGrid, i: number, j: number) => i < 0 || j < 0 || i >= g.nx || j >= g.nz || g.blocked[idx(g, i, j)] === 1;
function nearestFree(g: NavGrid, i: number, j: number): [number, number] | null {
  if (!isBlocked(g, i, j)) return [i, j];
  for (let r = 1; r <= 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; if (!isBlocked(g, i + di, j + dj)) return [i + di, j + dj]; }
  return null;
}
/** straight walk between two points is clear? (grid ray) */
export function clear(ax: number, az: number, bx: number, bz: number): boolean {
  if (!nav) return true; const g = nav, d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / (g.cs * 0.5)));
  for (let k = 0; k <= n; k++) { const t = k / n, [i, j] = cell(g, ax + (bx - ax) * t, az + (bz - az) * t); if (isBlocked(g, i, j)) return false; } return true;
}
/** waypoints from a to b (excluding a). Falls back to the straight line when there is no grid or no path. */
export function route(ax: number, az: number, bx: number, bz: number): [number, number][] {
  if (!nav) return [[bx, bz]]; if (Math.hypot(bx - ax, bz - az) < 1.2 || clear(ax, az, bx, bz)) return [[bx, bz]];
  const key = `${Math.round(ax * 2)},${Math.round(az * 2)},${Math.round(bx * 2)},${Math.round(bz * 2)}`; const hit = cache.get(key); if (hit) return hit;
  const g = nav; const sa = nearestFree(g, ...cell(g, ax, az)), sb = nearestFree(g, ...cell(g, bx, bz)); if (!sa || !sb) return [[bx, bz]];
  const W = g.nx, open: number[] = [], gs = new Map<number, number>(), from = new Map<number, number>(), closed = new Set<number>(); const goal = sb[1] * W + sb[0];
  const h = (i: number, j: number) => Math.hypot(i - sb[0], j - sb[1]); const f = new Map<number, number>();
  const start = sa[1] * W + sa[0]; gs.set(start, 0); f.set(start, h(sa[0], sa[1])); open.push(start); let it = 0, found = false;
  while (open.length && it++ < 60000) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (f.get(open[k])! < f.get(open[bi])!) bi = k; const cur = open.splice(bi, 1)[0]; if (cur === goal) { found = true; break; } closed.add(cur);
    const ci = cur % W, cj = (cur - ci) / W;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (isBlocked(g, ni, nj)) continue; if (di && dj && (isBlocked(g, ci + di, cj) || isBlocked(g, ci, cj + dj))) continue; const nid = nj * W + ni; if (closed.has(nid)) continue;
      const ng = gs.get(cur)! + (di && dj ? 1.414 : 1); if (ng < (gs.get(nid) ?? 1e9)) { gs.set(nid, ng); from.set(nid, cur); f.set(nid, ng + h(ni, nj)); if (!open.includes(nid)) open.push(nid); } }
  }
  if (!found) { cache.set(key, [[bx, bz]]); return [[bx, bz]]; }
  const cells: [number, number][] = []; for (let c = goal; c !== undefined; c = from.get(c)!) { const i = c % W; cells.push([g.x0 + (i + 0.5) * g.cs, g.z0 + ((c - i) / W + 0.5) * g.cs]); if (c === start) break; } cells.reverse();
  // string pulling: skip waypoints that can be reached in a straight line
  const out: [number, number][] = []; let px = ax, pz = az, k = 0;
  while (k < cells.length) { let far = k; for (let m = cells.length - 1; m > k; m--) if (clear(px, pz, cells[m][0], cells[m][1])) { far = m; break; } const [x, z] = cells[far]; out.push([x, z]); px = x; pz = z; k = far + 1; }
  if (out.length) out[out.length - 1] = [bx, bz]; cache.set(key, out); return out;
}
