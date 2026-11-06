// Детерминированные примитивы. Никакого Math.random / Date.now в src/sim.
/** Хэш строк/чисел → uint32 (FNV-1a + финализатор). */
export function hash32(...keys: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  for (const k of keys) {
    const s = String(k);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 0xff; h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}
/** Безсостояний hash→[0,1): не зависит от порядка вызовов, поэтому подсистемы не связаны потоком ГСЧ. */
export const hrand = (seed: number, ...keys: (string | number)[]): number => hash32(seed, ...keys) / 4294967296;

/** Сидированный xoshiro128** — раздельные потоки: stream(seed,'npc'), stream(seed,'weather')… */
export class Stream {
  private s: Uint32Array;
  constructor(seed: number, name: string) {
    this.s = new Uint32Array(4);
    for (let i = 0; i < 4; i++) this.s[i] = hash32(seed, name, i) || 0x9e3779b9;
  }
  next(): number {
    const s = this.s; const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;
    const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 11);
    return result / 4294967296;
  }
}

/** Хэш состояния мира: устойчивый стрингифай (числа округляются до 1e-3). */
export function hashState(o: unknown): string {
  let h = 2166136261 >>> 0;
  const feed = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  const walk = (v: unknown): void => {
    if (v === null || v === undefined) { feed('n'); return; }
    switch (typeof v) {
      case 'number': feed(String(Math.round(v * 1000) / 1000)); return;
      case 'string': feed('"' + v); return;
      case 'boolean': feed(v ? 'T' : 'F'); return;
      case 'object': {
        if (Array.isArray(v)) { feed('['); for (const x of v) { walk(x); feed(','); } feed(']'); return; }
        feed('{');
        for (const k of Object.keys(v as object).sort()) { feed(k + ':'); walk((v as Record<string, unknown>)[k]); feed(','); }
        feed('}'); return;
      }
      default: return;
    }
  };
  walk(o);
  return (h >>> 0).toString(16).padStart(8, '0');
}
