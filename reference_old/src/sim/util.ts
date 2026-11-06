import type { Vec } from './types';
export const hm = (s: string): number => { const [h, m] = s.split(':').map(Number); return h * 3600 + m * 60; };
export const fmt = (t: number): string => {
  const h = Math.floor(t / 3600) % 24, m = Math.floor((t % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
/** Stateless deterministic hash -> [0,1). Independent of call order, so no cross-system RNG coupling. */
export function hrand(seed: number, ...keys: (string | number)[]): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (const k of keys) {
    const s = String(k);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 0xff; h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function hashState(o: unknown): string {
  const s = JSON.stringify(o); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return (h >>> 0).toString(16);
}
