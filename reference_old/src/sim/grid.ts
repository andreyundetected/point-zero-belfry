import type { Vec } from './types';

/** City street grid shared by the simulation (routing) and the renderer (roads, sidewalks, lots). */
export const CELL = 100;          // street spacing (m)
export const ROAD_HALF = 9;       // carriageway half-width: two 4.5 m lanes each way
export const WALK_OFF = 11.5;     // pedestrian line offset from road centre (on the sidewalk)
export const LOT_OFF = 14;        // building line offset from road centre
export const BOUNDS = { x0: -400, x1: 3900, y0: -1700, y1: 2100 };

const snapLine = (v: number, off: number) => {
  const r = Math.round(v / CELL) * CELL;
  return off === 0 ? r : v >= r ? r + off : r - off;
};

/** Manhattan route along sidewalks (off = WALK_OFF) or lanes (off = small). Returns waypoints from a to b inclusive. */
export function gridPath(a: Vec, b: Vec, off: number): Vec[] {
  if (Math.hypot(a.x - b.x, a.y - b.y) < 45) return [a, b];
  const snap = (p: Vec) => {
    const xs = snapLine(p.x, off), ys = snapLine(p.y, off);
    return Math.abs(p.x - xs) <= Math.abs(p.y - ys) ? { p: { x: xs, y: p.y }, v: true } : { p: { x: p.x, y: ys }, v: false };
  };
  const A = snap(a), B = snap(b), pts: Vec[] = [a, A.p];
  if (A.v && !B.v) pts.push({ x: A.p.x, y: B.p.y });
  else if (!A.v && B.v) pts.push({ x: B.p.x, y: A.p.y });
  else if (A.v && B.v) { const hy = snapLine((A.p.y + B.p.y) / 2, off); pts.push({ x: A.p.x, y: hy }, { x: B.p.x, y: hy }); }
  else { const vx = snapLine((A.p.x + B.p.x) / 2, off); pts.push({ x: vx, y: A.p.y }, { x: vx, y: B.p.y }); }
  pts.push(B.p, b);
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 0.01);
}
export const pathLen = (pts: Vec[]) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
