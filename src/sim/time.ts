// Game time: seconds since 22:00:00. The window is 0..3600. Pure TS, no THREE, no Math.random/Date.now.
export const WINDOW = 3600;
export const TIME_SCALE = 4;       // 1 game minute = 15 real seconds
export const WAIT_SCALE = 16;      // holding T
/** hh,mm,ss (hh is 22 or 23) -> seconds since 22:00 */
export const at = (h: number, m: number, s = 0) => (h - 22) * 3600 + m * 60 + s;
export const pad = (n: number) => (n < 10 ? '0' : '') + n;
export function fmt(t: number, withSec = false) {
  const c = Math.max(0, Math.min(WINDOW, Math.floor(t))), h = 22 + Math.floor(c / 3600), m = Math.floor((c % 3600) / 60), s = c % 60;
  return pad(h) + ':' + pad(m) + (withSec ? ':' + pad(s) : '');
}
/** seeded PRNG (mulberry32) for small variations in the simulation */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
