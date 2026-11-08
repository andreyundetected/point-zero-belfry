// Single source of truth for ground height. Everything stands on groundH(x,z).
export function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function vnoise(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export type HeightFn = (x: number, z: number) => number;
let fn: HeightFn = () => 0;
export const setGroundFn = (f: HeightFn) => { fn = f; };
export const groundH: HeightFn = (x, z) => fn(x, z);
