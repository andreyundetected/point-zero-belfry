import * as THREE from 'three';
import { NPCS, NpcDef } from '../sim/npcs';
import { world } from '../world/colliders';
import { roomLights } from '../world/interiors';
import { lamps } from '../world/lamps';
import type { Game } from './game';

// Stealth + gunplay (spec 8.8, 8.10). Revolver: 6 in the cylinder, 3 s reload, you die from 2 hits, enemies from 1-2.
export interface Dyn { x: number; y: number; z: number; ry: number; a: string; hidden: boolean; hp: number; mode: 'hunt' | 'dead' | 'surrender'; cool: number; }
const HOSTILE_ROLES = new Set(['cord', 'guard']);
const HOSTILE_IDS = new Set(['ignat', 'lovchiy', 'scar', 'cord']);
export class Combat {
  dyn = new Map<string, Dyn>(); aiming = false; lastShooter = ''; reloadT = 0; fireCool = 0; suspicion = new Map<string, number>(); hits = 0; muzzle = 0;
  constructor(public g: Game) {
    addEventListener('mousedown', e => { if (!document.pointerLockElement) return; if (e.button === 2) this.aiming = true; if (e.button === 0) this.shoot(); });
    addEventListener('mouseup', e => { if (e.button === 2) this.aiming = false; });
    addEventListener('contextmenu', e => e.preventDefault());
  }
  hostile(d: NpcDef) { return HOSTILE_IDS.has(d.id) || (d.role && HOSTILE_ROLES.has(d.role)); }
  reload() { const s = this.g.s; if (!s.hasGun || this.reloadT > 0 || s.mag >= 6 || s.ammo <= 0) return; this.reloadT = 3; this.g.hud.toast('Перезарядка…', 3); }
  enemyWatching() { return [...this.dyn.values()].some(d => d.mode === 'hunt') || this.g.s.flags.has('alarm'); }
  /** the sim pose can be overridden by a fight */
  override(id: string) { const d = this.dyn.get(id); return d ? { x: d.x, y: d.y, z: d.z, ry: d.ry, a: d.a, hidden: d.hidden } : null; }
  alarm(why = '') {
    const g = this.g; if (g.s.flags.has('alarm')) return; g.flag('alarm'); void why;
    for (const d of NPCS) { if (!this.hostile(d)) continue; const p = g.npcs.pose(d.id); if (!p || p.hidden) continue; if (Math.hypot(p.x - g.player.body.x, p.z - g.player.body.z) < 70) this.dyn.set(d.id, { x: p.x, y: p.y, z: p.z, ry: p.ry, a: 'shoot', hidden: false, hp: d.id === 'ignat' ? 2 : 1, mode: 'hunt', cool: 1.5 + this.dyn.size * 0.4 }); }
    g.hud.bark('Тревога.', true); g.snd.boom(0.3, 0.3, 300);
  }
  shoot() {
    const g = this.g, s = g.s; if (!s.hasGun || !this.aiming || g.open || g.runner.active || g.frozen || this.reloadT > 0 || this.fireCool > 0) return;
    if (s.mag <= 0) { g.hud.toast('Пусто', 1); return; }
    s.mag--; this.fireCool = 0.35; this.muzzle = 0.08; g.snd.shot();
    const o = g.cam.getWorldPosition(new THREE.Vector3()), dir = g.cam.getWorldDirection(new THREE.Vector3());
    // loud: everyone within 60 m hears it (spec 8.10)
    this.alarm('shot');
    let bestT = 60, hit: string | null = null; let lamp: typeof roomLights[0] | null = null;
    for (const d of NPCS) { const p = g.npcs.pose(d.id); if (!p || p.hidden) continue; const dy = this.dyn.get(d.id); if (dy && dy.mode === 'dead') continue;
      const c = new THREE.Vector3(p.x, p.y + 0.9, p.z).sub(o), t = c.dot(dir); if (t < 0.3 || t > bestT) continue; const perp = c.sub(dir.clone().multiplyScalar(t)).length(); if (perp < 0.45) { bestT = t; hit = d.id; } }
    for (const l of roomLights) { if (!l.shootable || l.shot) continue; const c = new THREE.Vector3(l.x, l.y, l.z).sub(o), t = c.dot(dir); if (t < 0.3 || t > bestT) continue; if (c.sub(dir.clone().multiplyScalar(t)).length() < 0.4) { bestT = t; lamp = l; hit = null; } }
    // walls block shots: step along the ray
    for (let t = 0.5; t < bestT; t += 0.35) { const x = o.x + dir.x * t, y = o.y + dir.y * t, z = o.z + dir.z * t; let blocked = false; for (const b of world.near(x, z)) { if (b.off || y < b.y0 || y > b.y1 || b.kind === 'rail' && false) continue; const dx = x - b.cx, dz = z - b.cz, lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos; if (Math.abs(lx) < b.hx && Math.abs(lz) < b.hz) { blocked = true; break; } } if (blocked) { hit = null; lamp = null; break; } }
    if (lamp) { lamp.shot = true; g.flag('lampsShot'); g.snd.play('impact/impact_glass_light_000', 0.6); }
    if (hit) this.damage(hit, 1);
  }
  damage(id: string, n: number) {
    const g = this.g, d = this.dyn.get(id); if (!d) { // not hunting yet: shot a sleeper -> dies anyway
      const p = g.npcs.pose(id); if (!p) return; this.dyn.set(id, { x: p.x, y: p.y, z: p.z, ry: p.ry, a: 'die', hidden: false, hp: 0, mode: 'dead', cool: 0 }); this.killed(id); return; }
    d.hp -= n; if (d.hp <= 0 && d.mode !== 'dead') { d.mode = 'dead'; d.a = 'die'; this.killed(id); } else d.a = 'hit';
  }
  killed(id: string) { const g = this.g; if (id === 'ignat') g.flag('ignatDead'); if (id === 'lovchiy') g.flag('lovchiyDead'); g.s.learn('killed_' + id); g.note('kill_' + id, `${id} убит при Тике`, `${id} killed in front of Tik`, id); g.snd.play('impact/impact_generic_light_001', 0.5); }
  update(dt: number) {
    const g = this.g, s = g.s, b = g.player.body; this.fireCool = Math.max(0, this.fireCool - dt); this.muzzle = Math.max(0, this.muzzle - dt);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { const need = 6 - s.mag, take = Math.min(need, s.ammo); s.mag += take; s.ammo -= take; } }
    g.cam.fov = this.aiming && s.hasGun ? 52 : 70; g.cam.updateProjectionMatrix();
    // enemy AI: walk toward the player, stop at 6 m, shoot with a delay
    for (const [id, d] of this.dyn) {
      if (d.mode !== 'hunt') continue; const dx = b.x - d.x, dz = b.z - d.z, dist = Math.hypot(dx, dz); d.ry = Math.atan2(dx, dz);
      if (dist > 6) { const sp = 2.6 * dt; d.x += dx / dist * sp; d.z += dz / dist * sp; d.a = 'run'; } else d.a = 'shoot';
      d.cool -= dt; if (d.cool <= 0 && dist < 18) { d.cool = 1.6 + (hashId(id) % 5) * 0.2; const lit = this.litAt(b.x, b.z); const hitP = 0.35 * lit * (g.player.crouching ? 0.6 : 1); g.snd.shot(); if (Math.random() < hitP) { this.hits++; this.lastShooter = id; g.hurt(0.8); if (this.hits >= 2) { s.dead = true; g.finish('dead'); } } }
    }
    // suspicion by vision cones (50 deg, 4-14 m depending on light)
    if (!s.flags.has('alarm')) for (const d of NPCS) { if (!this.hostile(d)) continue; const p = g.npcs.pose(d.id); if (!p || p.hidden || p.a === 'die') continue;
      const dx = b.x - p.x, dz = b.z - p.z, dist = Math.hypot(dx, dz), lit = this.litAt(b.x, b.z), range = 4 + 10 * lit; if (dist > range || Math.abs(b.y - p.y) > 2.5) continue;
      const ang = Math.atan2(dx, dz) - p.ry, da = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))); if (da > 0.44) continue;
      if (this.zoneAllows(d, dist)) continue; const k = (this.suspicion.get(d.id) ?? 0) + dt * (g.player.keys.ShiftLeft ? 2 : 1) * (g.player.crouching ? 0.4 : 1); this.suspicion.set(d.id, k);
      if (k > 2.2) { this.alarm('seen'); g.hud.bark('Кто там?!', true); }
    }
  }
  /** where being seen is fine (spec 8.5, 6.3): sitting in the tavern, walking about the orphanage with permission, disguise on the pier */
  zoneAllows(d: NpcDef, dist: number) { const g = this.g, s = g.s; if (this.aiming && s.hasGun) return false; if (s.flags.has('scarAlert')) return false;
    if (g.sceneInside === 'tavern' && s.t < 12 * 60 && !s.flags.has('jetonStolen')) return true; void dist; void d; return d.role === 'guard' && s.flags.has('gateOpen'); }
  /** 0..1 how visible the player is here: nearest lit lamp/window/fire (spec 8.8) */
  litAt(x: number, z: number) {
    let best = 0.15; for (const l of roomLights) { if (!l.on(this.g.s.t, this.g.s.flags) || l.shot) continue; const d = Math.hypot(l.x - x, l.z - z); if (d < l.dist) best = Math.max(best, 1 - d / l.dist); }
    for (const f of this.g.cs.fires) { const d = Math.hypot(f.x - x, f.z - z); if (d < f.r + 12) best = Math.max(best, f.k); }
    return Math.min(1, best + this.streetLight(x, z));
  }
  private streetLight(x: number, z: number) { let b = 0; for (const l of lamps) { if (!l.on) continue; const d = Math.hypot(l.x - x, l.z - z); if (d < 12) b = Math.max(b, 1 - d / 12); } return b; }
}
const hashId = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
