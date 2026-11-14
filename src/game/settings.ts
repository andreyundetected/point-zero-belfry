// Player settings, kept in localStorage. Applied by main.ts (render scale, shadows), Player (mouse), Sound (volume), NpcRuntime (people budget).
export type Quality = 'auto' | 'low' | 'medium' | 'high';
export interface Settings { quality: Quality; sens: number; volume: number; fov: number; hints: boolean; }
const KEY = 'okno.settings';
export const DEFAULTS: Settings = { quality: 'auto', sens: 1, volume: 0.7, fov: 70, hints: true };
export const settings: Settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* defaults */ }
const subs: ((s: Settings) => void)[] = [];
export function onSettings(f: (s: Settings) => void) { subs.push(f); f(settings); }
export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) { settings[k] = v; try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ } for (const f of subs) f(settings); }
/** what a quality preset means for the renderer */
export const PRESET: Record<Exclude<Quality, 'auto'>, { scale: number; shadow: number; people: number; far: number }> = {
  low: { scale: 0.6, shadow: 0, people: 6, far: 50 },
  medium: { scale: 0.85, shadow: 1024, people: 8, far: 60 },
  high: { scale: 1, shadow: 2048, people: 10, far: 70 },
};
