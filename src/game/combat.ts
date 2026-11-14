import * as THREE from 'three';
import { NPCS, NpcDef } from '../sim/npcs';
import { world } from '../world/colliders';
import { roomLights } from '../world/interiors';
import { lamps } from '../world/lamps';
import type { Game } from './game';
import { lineOfSight } from './physics';
import { insideSite } from '../sim/sites';
import { tableTop } from '../world/interiors';
import { nameOf } from './dialogue';
import { route } from '../sim/nav';

// Stealth + gunplay (spec 8.8, 8.10). Revolver: 6 in the cylinder, 3 s reload, you die from 2 hits, enemies from 1-2.
export interface Dyn { path?: [number, number][]; pathT?: number; speed?: number; stand?: number; side?: number; seeT?: number; x: number; y: number; z: number; ry: number; a: string; hidden: boolean; hp: number; mode: 'hunt' | 'dead' | 'surrender'; cool: number; }
const HOSTILE_ROLES = new Set(['cord', 'guard']);
const HOSTILE_IDS = new Set(['ignat', 'lovchiy', 'scar', 'cord']);
export class Combat {
  dyn = new Map<string, Dyn>(); aiming = false; lastShooter = ''; reloadT = 0; fireCool = 0; suspicion = new Map<string, number>(); hits = 0; muzzle = 0;
  constructor(public g: Game) {
    addEventListener('mousedown', e => { if (!document.pointerLockElement || (this.g as any).weapon !== 'gun') return; if (e.button === 2) this.aiming = true; if (e.button === 0) this.shoot(); });
    addEventListener('mouseup', e => { if (e.button === 2) this.aiming = false; });
    addEventListener('contextmenu', e => e.preventDefault());
  }
  hostile(d: NpcDef) { return HOSTILE_IDS.has(d.id) || (d.role && HOSTILE_ROLES.has(d.role)); }
  reload() { const s = this.g.s; if (!s.hasGun || this.reloadT > 0 || s.mag >= 6 || s.ammo <= 0) return; this.reloadT = 3; this.g.hud.toast('Перезарядка…', 3); }
  enemyWatching() { const b = this.g.player.body; for (const d of this.dyn.values()) if (d.mode === 'hunt' && Math.hypot(d.x - b.x, d.z - b.z) < 30 && lineOfSight(d.x, d.z, d.y + 1.5, b.x, b.z, b.y + 1.5)) return true; return false; }
  /** the sim pose can be overridden by a fight */
  override(id: string) { const d = this.dyn.get(id); return d ? { x: d.x, y: d.y, z: d.z, ry: d.ry, a: d.a, hidden: d.hidden } : null; }
  alarm(why = '') {
    const g = this.g; if (g.s.flags.has('alarm')) return; g.flag('alarm'); void why;
    for (const d of NPCS) { if (!this.hostile(d)) continue; const p = g.npcs.pose(d.id); if (!p || p.hidden) continue; if (Math.hypot(p.x - g.player.body.x, p.z - g.player.body.z) < 70) this.dyn.set(d.id, { x: p.x, y: p.y, z: p.z, ry: p.ry, a: 'shoot', hidden: false, hp: d.id === 'ignat' ? 2 : 1, mode: 'hunt', cool: 1.2 + (hashId(d.id) % 7) * 0.45, speed: 2.1 + (hashId(d.id) % 5) * 0.3, stand: 5 + (hashId(d.id) % 4) * 1.4, side: ((hashId(d.id) % 3) - 1) * 3.2, path: [], pathT: (hashId(d.id) % 10) * 0.1, seeT: 0 }); }
    g.hud.bark('Тревога.', true); g.snd.boom(0.3, 0.3, 300);
  }
  shoot() {
    const g = this.g, s = g.s; if (!s.hasGun || (g as any).weapon !== 'gun' || g.open || g.runner.active || g.frozen || this.reloadT > 0 || this.fireCool > 0) return;
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
    g.cam.fov = this.aiming && (g as any).weapon === 'gun' ? 52 : 70; g.cam.updateProjectionMatrix();
    // enemy AI: each hunter routes around walls (nav grid), flanks from his own side, keeps a personal distance and only shoots with a clear line
    const hunters = [...this.dyn.entries()].filter(([, d]) => d.mode === 'hunt');
    for (const [id, d] of hunters) {
      const dx = b.x - d.x, dz = b.z - d.z, dist = Math.hypot(dx, dz), sees = dist < 22 && lineOfSight(d.x, d.z, d.y + 1.55, b.x, b.z, b.y + 1.5);
      d.ry = Math.atan2(dx, dz); d.pathT = (d.pathT ?? 0) - dt;
      if (sees) d.seeT = 3; else d.seeT = Math.max(0, (d.seeT ?? 0) - dt);
      if ((d.pathT ?? 0) <= 0 && (!sees || dist > (d.stand ?? 6))) { d.pathT = 0.8 + (hashId(id) % 4) * 0.15; const nx = -dz / Math.max(dist, 1), nz = dx / Math.max(dist, 1), tx = b.x + nx * (d.side ?? 0), tz = b.z + nz * (d.side ?? 0); d.path = route(d.x, d.z, tx, tz); }
      let moving = false;
      if ((!sees || dist > (d.stand ?? 6)) && d.path?.length) { const [wx, wz] = d.path[0], ddx = wx - d.x, ddz = wz - d.z, dd = Math.hypot(ddx, ddz); if (dd < 0.5) d.path.shift(); else { let vx = ddx / dd, vz = ddz / dd;
        for (const [oid, o] of hunters) { if (oid === id) continue; const ox = d.x - o.x, oz = d.z - o.z, od = Math.hypot(ox, oz); if (od < 1.3 && od > 0.01) { vx += ox / od * 0.8; vz += oz / od * 0.8; } } // do not walk through each other
        const vl = Math.hypot(vx, vz) || 1, sp = (d.speed ?? 2.4) * dt; d.x += vx / vl * sp; d.z += vz / vl * sp; d.ry = Math.atan2(vx, vz); moving = true; } }
      d.a = moving ? 'run_gun' : sees ? 'shoot' : 'pistol';
      d.cool -= dt; if (d.cool <= 0 && sees) { d.cool = 1.5 + (hashId(id) % 5) * 0.25; const lit = this.litAt(b.x, b.z); const hitP = 0.3 * lit * (g.player.crouching ? 0.6 : 1) * (dist > 12 ? 0.5 : 1); g.snd.shot(); if (Math.random() < hitP) { this.hits++; this.lastShooter = id; g.hurt(0.8); if (this.hits >= 2) { s.dead = true; g.finish('dead'); } } }
    }
    // D5: Cord's men are not hostile by sight. Only explicit triggers: a gun out in the tavern hall, a theft seen, a shot, coming back to
    // their table after two warnings. Leaving the tavern never starts a fight. Vision cones only matter for the orphanage guards at the cart
    // after 22:30 and for the pier-3 disguise (handled by the dialogue).
    if (!s.flags.has('alarm')) {
      const inTav = g.sceneInside === 'tavern' && s.t < at1215;
      if (inTav && (g as any).weapon === 'gun' && cordInHall(g)) { this.gunT += dt; if (this.gunT > 1.2) { g.hud.sub(nameOfNpc('ignat'), 'Ствол! У него ствол!', 2.5); this.alarm('gun'); } } else this.gunT = 0;
      if (inTav && s.t < at1212 && cordInHall(g)) { const dd = Math.hypot(b.x - tableX(g), b.z - tableZ(g)); if (dd < 1.6) { if (!this.nearTable) { this.nearTable = true; this.warns++; if (this.warns === 1) g.hud.sub(nameOfNpc('ignat'), 'Стол занят. Отойди.', 2.5); else if (this.warns === 2) g.hud.sub(nameOfNpc('ignat'), 'Я сказал — отойди.', 2.5); else { g.hud.sub(nameOfNpc('ignat'), 'Ну всё.', 2); this.alarm('table'); } } } else if (dd > 2.4) this.nearTable = false; }
      for (const d of NPCS) { if (d.role !== 'guard') continue; const p = g.npcs.pose(d.id); if (!p || p.hidden || s.t < 30 * 60) continue;
        const dx = b.x - p.x, dz = b.z - p.z, dist = Math.hypot(dx, dz); if (dist > 6 || Math.hypot(b.x - 52, b.z + 57) > 4) continue;
        const ang = Math.atan2(dx, dz) - p.ry, da = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))); if (da > 0.44 || !lineOfSight(p.x, p.z, p.y + 1.55, b.x, b.z, b.y + 1.5)) continue;
        const k = (this.suspicion.get(d.id) ?? 0) + dt; this.suspicion.set(d.id, k); if (k > 3) { g.hud.sub(nameOfNpc(d.id), 'Отойди от повозки!', 2); this.alarm('cart'); } }
    }
  }
  gunT = 0; warns = 0; nearTable = false;
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
const at1212 = 12 * 60, at1215 = 15 * 60;
const cordInHall = (g: Game) => ['ignat', 'lovchiy', 'cm1', 'cm2', 'cm3'].some(id => { const p = g.npcs.pose(id); return !!p && !p.hidden && insideSite('tavern', p.x, p.z); });
const tableX = (_g: Game) => tableTop.x, tableZ = (_g: Game) => tableTop.z;
const nameOfNpc = (id: string) => nameOf(id);
const hashId = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
