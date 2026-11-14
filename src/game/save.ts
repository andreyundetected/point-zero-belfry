// One autosave slot. Saved after every jump, every finished conversation and every 20 s of play; loaded from the menu ("Продолжить").
import type { Game } from './game';
import { Flags } from '../sim/flags';
import { GameState } from './state';
const KEY = 'okno.save';
export interface SaveMeta { t: number; thread: string; jumps: number; when: number; }
export function hasSave(): boolean { try { return !!localStorage.getItem(KEY); } catch { return false; } }
export function saveMeta(): SaveMeta | null { try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d ? { t: d.s.t, thread: d.s.thread, jumps: d.s.jumps, when: d.when } : null; } catch { return null; } }
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* */ } }
const m2a = (m: Map<string, unknown>) => [...m.entries()];
const a2m = <T>(a: [string, T][] | undefined) => new Map<string, T>(a ?? []);
export function saveGame(g: Game): boolean {
  if (g.s.ended || g.s.dead || !g.s.knows('prologue_done')) return false;
  const s = g.s, b = g.player.body;
  const data = { v: 2, when: Date.now(), player: { x: b.x, y: b.y, z: b.z, yaw: g.player.yaw, pitch: g.player.pitch, weapon: g.weapon },
    s: { t: s.t, flags: s.flags.entries(), changes: s.changes, money: s.money, held: s.held, pocket: s.pocket, hasGun: s.hasGun, ammo: s.ammo, mag: s.mag, know: [...s.know], knownAt: m2a(s.knownAt), journal: s.journal, thread: s.thread, jumps: s.jumps,
      seenEvents: [...s.seenEvents], messages: s.messages, talks: m2a(s.talks), topics: [...s.topics], everTalks: m2a(s.everTalks), thoughts: [...s.thoughts], lastSeen: m2a(s.lastSeen), met: [...s.met], portraits: s.portraits, worldItems: [...s.worldItems], universeStart: s.universeStart, tickDone: [...s.tickDone], hp: s.hp } };
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}
export function loadGame(g: Game): boolean {
  let d: any; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return false; } if (!d || !d.s) return false;
  const s = new GameState(), q = d.s;
  s.t = q.t; s.flags = new Flags(); for (const [k, t] of q.flags ?? []) s.flags.put(k, t); s.changes = q.changes ?? []; s.money = q.money ?? 40; s.held = q.held; s.pocket = q.pocket; s.hasGun = !!q.hasGun; s.ammo = q.ammo ?? 0; s.mag = q.mag ?? 6;
  s.know = new Set(q.know ?? []); s.knownAt = a2m<number>(q.knownAt); s.journal = q.journal ?? []; s.thread = q.thread ?? 'orven'; s.jumps = q.jumps ?? 0; s.seenEvents = new Set(q.seenEvents ?? []); s.messages = q.messages ?? [];
  s.talks = a2m<number>(q.talks); s.topics = new Set(q.topics ?? []); s.everTalks = a2m<number>(q.everTalks); s.thoughts = new Set(q.thoughts ?? []); s.lastSeen = a2m(q.lastSeen); s.met = new Set(q.met ?? []); s.portraits = q.portraits ?? {}; s.worldItems = new Set(q.worldItems ?? []); s.universeStart = q.universeStart ?? 0; s.tickDone = new Set(q.tickDone ?? []); s.hp = q.hp ?? 2;
  g.s = s; g.applyUniverse(); const p = d.player; g.player.body.x = p.x; g.player.body.y = p.y; g.player.body.z = p.z; g.player.body.vx = g.player.body.vz = g.player.body.vy = 0; g.player.yaw = p.yaw; g.player.pitch = p.pitch; g.player.safe = { x: p.x, z: p.z, y: p.y }; g.player.apply();
  g.applyCity(s.t, true); g.setWeapon(s.hasGun && p.weapon === 'gun' ? 'gun' : 'device'); g.hud.clock(s.t); return true;
}
