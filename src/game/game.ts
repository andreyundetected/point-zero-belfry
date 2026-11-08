import * as THREE from 'three';
import { Player } from './player';
import { GameState, ItemId } from './state';
import { Hud } from './hud';
import { Stvorka, StvHost, itemName } from './stvorka';
import { DialogueRunner, DialogueUI, Ctx } from './dialogue';
import { NpcRuntime } from './npcRuntime';
import { Fx } from './fx';
import { Sound } from './audio';
import { SimWorld, CityState } from '../sim/world';
import { Flags, FlagName } from '../sim/flags';
import { fmt, WINDOW, TIME_SCALE, WAIT_SCALE, at } from '../sim/time';
import { EVENTS } from '../sim/events';
import { THREADS } from '../content/threads';
import { LampPool, lamps, setLamp } from '../world/lamps';
import { roomLights, doors, updateDoors, interactables, Interactable } from '../world/interiors';
import { insideSite, SITES } from '../sim/sites';
import { setFomaState } from '../world/ruins';
import { setClock } from '../world/tower';
import { world } from '../world/colliders';
import { R, HEIGHT, STEP } from './physics';
import { groundH } from '../world/terrain';
import { NPCS } from '../sim/npcs';
import { VEHICLES } from '../sim/vehicles';
import { Vehicles } from './vehicles';
import { getLang, pick, setLang } from './strings';
import { CONVS, pickConv, registerWorldItems, onBark } from '../content';
import { Combat } from './combat';
import { Pilot } from './pilot';
import { updateMarks } from '../world/marks';
import { addInteract } from '../world/interiors';

export class Game implements StvHost, Ctx {
  s = new GameState(); sim: SimWorld; npcs: NpcRuntime; hud = new Hud(); stv: Stvorka; ui = new DialogueUI(); runner: DialogueRunner; fx: Fx; snd = new Sound(); veh: Vehicles; combat: Combat;
  pilot: Pilot; pool: LampPool; open = false; targetT = 0; previewing = false; cs!: CityState; lastCs = ''; locked = false; jumpBusy = false; ghosts: THREE.Group; fomaRuin = false;
  sinceThread = 0; sceneInside = ''; waitHeld = false; fadeBusy = false; time = 0; frozen = false; custom?: { update(dt: number): void; done?: boolean };
  seenLight = 1; stepT = 0; sub = ''; hintT = 0; hintStep = 0; shakeT = 0; shakeA = 0;
  portraitQ: string[] = []; rt?: THREE.WebGLRenderTarget; pcam = new THREE.PerspectiveCamera(28, 1, 0.05, 20);
  constructor(public scene: THREE.Scene, public cam: THREE.PerspectiveCamera, public player: Player, public moon: THREE.DirectionalLight, public hemi: THREE.HemisphereLight, public renderer: THREE.WebGLRenderer) {
    this.sim = new SimWorld(this.s.flags); this.npcs = new NpcRuntime(scene, this.sim); this.fx = new Fx(scene); this.veh = new Vehicles(scene); this.combat = new Combat(this); this.pilot = new Pilot(this);
    this.pool = new LampPool(scene, 10); this.stv = new Stvorka(this); this.runner = new DialogueRunner(this.ui, this); this.runner.register(...CONVS);
    this.ghosts = new THREE.Group(); scene.add(this.ghosts); this.ghosts.visible = false;
    registerWorldItems(this);
    addInteract({ id: 'launch.helm', x: -43.0, y: -0.5, z: 83.2, r: 4.2, ok: c => c.s.t >= at(22, 36) && c.s.t < at(22, 40, 40) && !c.pilot.aboard, label: () => 'Встать к штурвалу', use: c => {
      if (c.fl('tikhonThreatened') && !c.fl('tikhonLocked')) { c.combat.alarm('tikhon'); c.hud.bark('Эй, ты не Тихон.', true); return; }
      if (!c.s.knows('helm_ok') && c.s.pocket !== 'cap') { c.hud.bark('Охрана не подпустит. Надо сказать «Я».', true); const d = c.npcs.pose('dock1'); if (d && !d.hidden) c.runner.start('guard.pier3'); return; }
      c.pilot.board(); } });
    addEventListener('keydown', e => this.key(e));
    document.addEventListener('pointerlockchange', () => { const locked = !!document.pointerLockElement; if (locked) { this.hadLock = true; this.paused = false; document.getElementById('pause')!.style.display = 'none'; } else if (this.hadLock && !this.open && !this.ui.open && !this.s.ended && !this.jumpBusy) { this.paused = true; document.getElementById('pause')!.style.display = 'flex'; } });
    document.getElementById('pause')!.addEventListener('click', () => { this.paused = false; document.getElementById('pause')!.style.display = 'none'; this.player.dom.requestPointerLock?.(); });
    addEventListener('keyup', e => { if (e.code === 'KeyT') this.waitHeld = false; if (e.code === 'Enter') this.holdEnd(); });
    addEventListener('mousedown', () => this.snd.init()); addEventListener('keydown', () => this.snd.init(), { once: true });
    player.onRespawn = () => { this.hud.bark('Холодная вода. Вылез.', true); this.hurt(0.6); };
    this.applyUniverse(); this.hud.clock(0);
  }
  // ---------------- StvHost
  getPos() { return { x: this.player.body.x, z: this.player.body.z }; }
  // ---------------- Ctx (for dialogues and content)
  advance(sec: number) { this.s.t = Math.min(WINDOW, this.s.t + sec); }
  bark(ru: string, force = false) { return this.hud.bark(ru, force); }
  thread(key: string) { if (this.s.thread === key) return; this.s.thread = key; const th = THREADS[key]; if (th) this.hud.thread(pick(th), 7); this.sinceThread = 0; }
  flag(n: FlagName) { this.s.setFlag(n); this.sim.flags = this.s.flags; }
  give(i: ItemId) { this.s.give(i); this.hud.toast(itemName(i)); }
  take(i: ItemId) { if (this.s.pocket === i) { this.s.pocket = undefined; this.s.held = undefined; } }
  learn(id: string) { this.s.learn(id); }
  note(id: string, ru: string, en: string, who?: string, red = false) { this.s.note({ id, t: this.s.t, ru, en, who, red }); }
  message(ru: string, en: string) { this.s.messages.push({ t: this.s.t, ru, en }); this.hud.toast(ru, 5); }
  npcAct() {} end(ending: string) { this.finish(ending); } has(i: ItemId) { return this.s.pocket === i; } knows(id: string) { return this.s.knows(id); } fl(n: FlagName) { return this.s.flags.has(n); }
  t() { return this.s.t; } money(d: number) { this.s.money += d; } gun() { return this.s.hasGun; } conv(id: string) { void this.runner.start(id); }
  fomaRuinOn() { return this.fomaRuin; }
  jumpRel(sec: number) { void this.doJump(Math.max(0, Math.min(WINDOW, this.s.t + sec))); }
  openDoor(id: string, open = true) { const d = doors.find(x => x.id === id); if (d) d.open = open; }
  setPocketHeld() { this.s.held = this.s.pocket; }
  shake(a: number) { this.shakeA = a; this.shakeT = 1.2; }
  hurt(v: number) { this.hud.hurt(v); setTimeout(() => this.hud.hurt(0), 350); }
  // ---------------- universe handling
  applyUniverse() { this.sim.setFlags(this.s.flags); }
  /** pick the nearest free standing spot within 1.5 m of (x,z) at time t, or null */
  freeSpot(x: number, z: number, y: number): { x: number; z: number; y: number } | null {
    const ok = (px: number, pz: number, py: number) => {
      for (const b of world.near(px, pz)) { if (b.off) continue; if (py + STEP >= b.y1 || py + HEIGHT <= b.y0) continue; const dx = px - b.cx, dz = pz - b.cz, lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos; const nx = Math.max(-b.hx, Math.min(b.hx, lx)), nz = Math.max(-b.hz, Math.min(b.hz, lz)); if ((lx - nx) ** 2 + (lz - nz) ** 2 < R * R) return false; }
      for (const d of NPCS) { const p = this.npcs.pose(d.id); if (!p || p.hidden) continue; if (Math.hypot(p.x - px, p.z - pz) < 0.6 && Math.abs(p.y - py) < 1.5) return false; }
      for (const f of this.cs.fires) if (f.k > 0.3 && Math.hypot(px - f.x, pz - f.z) < f.r * 0.45) return false;
      return true;
    };
    if (ok(x, z, y)) return { x, z, y };
    for (let r = 0.3; r <= 1.5; r += 0.3) for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (ok(px, pz, y)) return { x: px, z: pz, y }; }
    return null;
  }
  bellShown = false; markT = 0; paused = false; hadLock = false; holdT = 0; holding = false;
  /** spec 2.2: hold the jump button for 1 real second = preview; released earlier = cancel; held through = jump */
  holdBegin() { if (this.holding || this.jumpBusy) return; this.holding = true; this.holdT = 0; this.showGhosts(this.targetT); }
  holdEnd() { if (!this.holding) return; this.holding = false; this.hideGhosts(); }
  async jumpTo(target: number, previewOnly: boolean) {
    if (this.jumpBusy) return;
    if (previewOnly) { this.showGhosts(target); this.previewing = true; return; }
    if (!this.previewing) { /* quick click: do the jump directly */ } this.hideGhosts(); this.previewing = false;
    this.doJump(target);
  }
  async doJump(target: number) {
    const s = this.s; if (this.jumpBusy || s.dead || s.ended) return; if (s.knows('sync_held')) { this.hud.bark('Синхронизация удержана.', true); this.snd.play('digital/phaser_down1.ogg', 0.7); return; } this.jumpBusy = true;
    const b = this.player.body, oldT = s.t;
    // check the destination first (spec 2.2): occupied -> shift, impossible -> refuse
    const keepFlags = s.flags; const tmp = new Flags(); this.sim.setFlags(tmp); this.cs = this.sim.city(target); this.applyCity(target, true);
    this.npcs.update(target, b.x, b.z, 0, b.y);
    const spot = this.freeSpot(b.x, b.z, b.y);
    if (!spot) { this.sim.setFlags(keepFlags); this.cs = this.sim.city(oldT); this.applyCity(oldT, true); this.snd.play('digital/phaser_down1.ogg', 0.7); const fire = this.cs.fires.some(f => f.k > 0.3 && Math.hypot(b.x - f.x, b.z - f.z) < f.r * 0.5); this.hud.bark(fire ? 'Там горит.' : 'Там стена.', true); this.hud.toast(fire ? 'Там горит' : 'Там нельзя стоять', 2.5); this.jumpBusy = false; return; }
    this.snd.play('digital/phase_jump' + (1 + (s.jumps % 5)) + '.ogg', 0.9);
    this.hud.flash(1); this.hud.fade(true, 380); await new Promise(r => setTimeout(r, 700));
    // new universe: flags reset, knowledge + pocket stay
    s.flags = tmp; s.changes = []; s.t = target; s.jumps++; s.held = s.pocket; s.worldItems.clear(); s.universeStart = target;
    this.sim.setFlags(s.flags); b.x = spot.x; b.z = spot.z; b.y = spot.y; b.vy = 0; b.vx = b.vz = 0;
    for (const d of doors) { d.open = false; (d.pivot as any).inner.rotation.y = 0; }
    this.player.apply(); this.applyCity(target, true); this.onUniverse();
    this.hud.flash(0); this.hud.fade(false, 500); await new Promise(r => setTimeout(r, 450)); this.jumpBusy = false;
    this.hud.toast(`${fmt(oldT)} → ${fmt(target)}`, 2.5);
  }
  onUniverse() { onBark(this, 'universe'); }
  showGhosts(t: number) {
    this.hideGhosts(); this.ghosts.visible = true; this.hud.ghost(true);
    const m = new THREE.MeshBasicMaterial({ color: 0x6aa0ff, transparent: true, opacity: 0.35, depthTest: false });
    const tmp = new SimWorld(new Flags()); const px = this.player.body.x, pz = this.player.body.z;
    for (const d of NPCS) { const p = tmp.pose(d.id, t); if (p.hidden || Math.hypot(p.x - px, p.z - pz) > 45) continue; const g = new THREE.Mesh(new THREE.CapsuleGeometry(0.26 * (d.look.scale ?? 1), 1.1 * (d.look.scale ?? 1), 4, 8), m); g.position.set(p.x, p.y + 0.85 * (d.look.scale ?? 1), p.z); g.renderOrder = 10; this.ghosts.add(g); }
    const cs = tmp.city(t); for (const f of cs.fires) { const g = new THREE.Mesh(new THREE.SphereGeometry(f.r * 0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff7a30, transparent: true, opacity: 0.18, depthTest: false })); g.position.set(f.x, groundH(f.x, f.z) + 2, f.z); this.ghosts.add(g); }
  }
  hideGhosts() { this.ghosts.visible = false; this.hud.ghost(false); while (this.ghosts.children.length) this.ghosts.remove(this.ghosts.children[0]); }
  // ---------------- input
  key(e: KeyboardEvent) {
    if (this.ui.open || this.s.ended) return;
    if (e.code === 'Tab') { e.preventDefault(); this.toggleStvorka(); return; }
    if (this.open) { if (e.code === 'Enter' && !e.repeat) this.holdBegin(); if (e.code === 'KeyB') { this.s.bookmarks.push({ t: this.s.t, label: fmt(this.s.t) }); this.stv.render(); } if (e.code === 'Escape') this.toggleStvorka(); return; }
    if (e.code === 'KeyL') { setLang(getLang() === 'ru' ? 'en' : 'ru'); this.hud.toast(getLang() === 'ru' ? 'Язык: русский' : 'Language: English', 1.5); this.hud.refresh(); }
    if (e.code === 'KeyT') this.waitHeld = true;
    if (e.code === 'KeyB') { this.s.bookmarks.push({ t: this.s.t, label: fmt(this.s.t) }); this.hud.toast('Закладка ' + fmt(this.s.t), 1.5); }
    if (e.code === 'KeyE') this.useNearest();
    if (e.code === 'KeyR') this.combat.reload();
  }
  toggleStvorka() {
    if (this.jumpBusy || this.frozen) return; this.open = !this.open;
    if (this.open) { document.exitPointerLock?.(); this.stv.show(this.s.t); } else { this.stv.hide(); this.hideGhosts(); this.previewing = false; this.player.dom.requestPointerLock?.(); }
    this.hud.thread(THREADS[this.s.thread] ? pick(THREADS[this.s.thread]) : '', this.open ? 99 : 0.01);
  }
  // ---------------- interaction
  near: { i: Interactable | null; label: string | null; fn?: () => void } = { i: null, label: null };
  findInteract() {
    const p = this.player.body, cam = this.cam; const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw); let best: { d: number; label: string; fn: () => void } | null = null;
    const consider = (x: number, y: number, z: number, r: number, label: string | null, fn: () => void) => {
      if (!label) return; const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d > r || Math.abs(y - p.y) > 2.2) return; const cosA = d < 0.5 ? 1 : (dx * fx + dz * fz) / d; if (cosA < 0.35) return; const score = d - cosA; if (!best || score < best.d) best = { d: score, label, fn };
    };
    for (const d of doors) { const lk = d.locked(this.s.t, this.s.flags); consider(d.x, d.y, d.z, 1.9, lk && !d.open ? `${d.label}: ${lk}` : (d.open ? 'Закрыть дверь' : 'Открыть дверь'), () => { if (lk && !d.open) { this.hud.bark(lk.split('.')[0] + '.', true); this.snd.play('rpg_foley/metal_latch.ogg', 0.5); onBark(this, 'locked:' + d.id); return; } d.open = !d.open; this.snd.play('rpg_foley/door_' + (d.open ? 'open_' : 'close_') + (1 + (this.s.t | 0) % 4) + '.ogg', 0.7); }); }
    for (const it of interactables) { if (it.ok && !it.ok(this)) continue; const q = it.at ? it.at(this) : { x: it.x, y: it.y, z: it.z }; if (!q) continue; consider(q.x, q.y, q.z, it.r ?? 1.6, it.label(this), () => it.use(this)); }
    for (const d of NPCS) { const po = this.npcs.pose(d.id); if (!po || po.hidden || d.civ && !pickConv(d.id, this)) continue; const cid = pickConv(d.id, this); if (!cid) continue; consider(po.x, po.y, po.z, 2.5, `Говорить: ${pick(d.name)}`, () => this.talk(d.id, cid)); }
    void cam; return best as { d: number; label: string; fn: () => void } | null;
  }
  talk(npc: string, conv: string) { if (this.runner.active) return; if (!this.s.met.has(npc)) { this.s.met.add(npc); this.portraitQ.push(npc); const d = NPCS.find(n => n.id === npc)!; this.note('seen_' + npc, `Встретил ${fmt(this.s.t)}: ${pick(d.name)}`, `Met at ${fmt(this.s.t)}: ${pick(d.name)}`, npc, !!d.key); } this.s.met.add(npc); const p = this.npcs.pose(npc)!; this.player.yaw = Math.atan2(-(p.x - this.player.body.x), -(p.z - this.player.body.z)); this.runner.start(conv).then(() => this.afterTalk()); }
  afterTalk() { this.player.apply(); }
  useNearest() { if (this.runner.active || this.frozen) return; const n = this.findInteract(); n?.fn(); }
  // ---------------- per-frame
  applyCity(t: number, force = false) {
    const cs = this.cs = this.sim.city(t);
    const flick = cs.lampsFlicker; for (let i = 0; i < lamps.length; i++) { const l = lamps[i]; let on = true; if (flick) { const ph = Math.sin(t * 2.3 + i * 1.7) + Math.sin(t * 5.1 + i * 3.1); on = ph > -1.55; } if (cs.bridgeLampsDead && Math.abs(l.z) < 4 && Math.abs(l.x) < 10) on = false; if (l.on !== on) setLamp(l, on); }
    if (this.fomaRuin !== cs.rynokRuin || force) { this.fomaRuin = cs.rynokRuin; setFomaState(cs.rynokRuin); }
    if (cs.bellRings && !this.bellShown) { this.bellShown = true; this.snd.play('impact/impact_bell_heavy_00' + (Math.floor(t) % 5), 1, 0.7); } else if (!cs.bellRings) this.bellShown = false;
    world.setOff('patrol', !(cs.bridgePatrol && !this.s.flags.has('patrolPassed'))); world.setOff('tram', !cs.tramStuck);
    this.veh.update(this.sim, t, cs, this.pilot.aboard);
  }
  /** journal portrait: render the head of a person you just met, grey (red frame is drawn by the UI for key people) */
  capturePortrait() {
    const id = this.portraitQ.shift(); if (!id || this.s.portraits[id]) return; const per = this.npcs.active.get(id); if (!per) return;
    let head: THREE.Object3D | undefined; per.root.traverse(o => { if (o.name === 'mixamorigHead') head = o; }); if (!head) return;
    const hp = head.getWorldPosition(new THREE.Vector3()); const dir = new THREE.Vector3(Math.sin(per.root.rotation.y), 0, Math.cos(per.root.rotation.y));
    this.pcam.position.copy(hp).addScaledVector(dir, 1.0).add(new THREE.Vector3(0, 0.12, 0)); this.pcam.lookAt(hp.x, hp.y + 0.1, hp.z); this.pcam.updateMatrixWorld(); this.pcam.aspect = 1; this.pcam.updateProjectionMatrix();
    const rt = this.rt ??= new THREE.WebGLRenderTarget(96, 96); const buf = new Uint8Array(96 * 96 * 4);
    const prevFog = this.scene.fog; this.scene.fog = null; const pl = new THREE.PointLight(0xffe0c0, 6, 4); pl.position.copy(this.pcam.position).add(new THREE.Vector3(0.3, 0.4, 0)); this.scene.add(pl);
    this.renderer.setRenderTarget(rt); this.renderer.render(this.scene, this.pcam); this.renderer.readRenderTargetPixels(rt, 0, 0, 96, 96, buf); this.renderer.setRenderTarget(null); this.scene.remove(pl); this.scene.fog = prevFog;
    const cv = document.createElement('canvas'); cv.width = cv.height = 96; const cx = cv.getContext('2d')!; const im = cx.createImageData(96, 96);
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const i = (y * 96 + x) * 4, j = ((95 - y) * 96 + x) * 4, l = Math.min(255, (buf[i] * 0.3 + buf[i + 1] * 0.59 + buf[i + 2] * 0.11) * 1.5); im.data[j] = im.data[j + 1] = im.data[j + 2] = l; im.data[j + 3] = 255; }
    cx.putImageData(im, 0, 0); this.s.portraits[id] = cv.toDataURL('image/png');
  }
  update(dt: number) {
    const s = this.s, p = this.player;
    if (this.portraitQ.length && !this.open) this.capturePortrait();
    if (this.custom) this.custom.update(dt);
    const wasT = s.t; const talking = this.ui.open || this.runner.active;
    if (!this.open && !talking && !this.jumpBusy && !this.frozen && !s.ended && !this.paused) {
      const wait = this.waitHeld && !this.combat.enemyWatching(); this.s.t += dt * (wait ? WAIT_SCALE : TIME_SCALE);
      if (this.waitHeld && !wait) { this.hud.toast('Рядом враг — ждать нельзя', 1.5); this.waitHeld = false; }
    }
    this.time += dt; s.clampT();
    if (this.holding) { this.holdT += dt; if (this.holdT >= 1.0) { this.holding = false; this.hideGhosts(); this.previewing = false; void this.doJump(this.targetT); } }
    if (s.t >= WINDOW && !s.ended && !this.frozen) this.finish('empty');
    p.frozen = this.open || talking || this.jumpBusy || this.frozen || this.pilot.aboard || this.paused; if (!this.pilot.aboard) p.update(dt); else p.apply();
    this.hud.clock(s.t); this.hud.update(dt);
    { const b0 = p.body, sp = Math.hypot(b0.vx, b0.vz); if (b0.grounded && sp > 0.8 && !p.frozen) { this.stepT -= dt * (sp > 4 ? 1.6 : 1); if (this.stepT <= 0) { this.stepT = 0.5; const kind = this.sceneInside || b0.y > 20 ? 'wood' : 'concrete'; this.snd.play(`impact/footstep_${kind}_00${(Math.random() * 5) | 0}`, p.crouching ? 0.12 : 0.28); } } }
    // city state + lights
    if (Math.floor(wasT) !== Math.floor(s.t) || this.lastCs === '') { this.lastCs = 'x'; this.applyCity(s.t); setClock(s.t); }
    else if (this.cs.lampsFlicker) this.applyCity(s.t);
    const b = p.body; const inside = this.insideRoom(); this.sceneInside = inside ?? ''; this.hemi.intensity = inside ? 0.12 : 0.7; this.moon.intensity = inside ? 0.0 : 1.0; this.snd.setMuffled(!!inside);
    const extra = roomLights.filter(l => l.on(s.t, s.flags) && !l.shot && (inside ? l.room === inside : Math.hypot(l.x - b.x, l.z - b.z) < 14 && (l.room !== 'cellar' || b.y < -2))).map(l => ({ x: l.x, y: l.y, z: l.z, color: l.color, intensity: l.intensity, dist: l.dist }));
    if (this.pilot.aboard) { const m = this.pilot.mesh.position, ry = this.pilot.s.ry; extra.push({ x: m.x + Math.sin(ry) * 1.2, y: m.y + 2.6, z: m.z + Math.cos(ry) * 1.2, color: 0xffd0a0, intensity: 6, dist: 9 }); }
    const fl = this.fx.lights(this.cs.fires); this.pool.update(b.x, b.z, [...extra, ...fl], !!inside);
    this.fx.update(dt, this.cs.fires, this.cs.glow); this.snd.setFire(this.cs.glow);
    updateDoors(dt);
    // npcs
    this.npcs.update(s.t, b.x, b.z, dt, b.y, undefined, id => this.combat.override(id));
    this.combat.update(dt); this.pilot.update(dt); this.markT -= dt; if (this.markT <= 0) { this.markT = 0.25; updateMarks(this); }
    if (this.shakeT > 0) { this.shakeT -= dt; const k = this.shakeA * Math.max(0, this.shakeT); this.cam.position.x += (Math.random() - 0.5) * 0.12 * k; this.cam.position.y += (Math.random() - 0.5) * 0.12 * k; }
    // events seen
    for (const e of EVENTS) if (s.t >= e.t && s.t < e.t + 30 && !s.seenEvents.has(e.id) && Math.hypot(e.x - b.x, e.z - b.z) < (e.r ?? 55)) { s.seenEvents.add(e.id); onBark(this, 'event:' + e.id); }
    // interaction prompt
    if (!talking && !this.open && !this.frozen) { const n = this.findInteract(); this.hud.prompt(n ? n.label : null); } else this.hud.prompt(null);
    if (this.open) this.stv.drawMapIfOpen();
    // thread nag + generic thread hint
    this.sinceThread += dt; onBark(this, 'tick');
    this.hud.sync(this.s.flags.has('alarm') && false);
  }
  insideRoom(): string | null {
    const b = this.player.body;
    for (const id of Object.keys(SITES)) { if (id === 'tower') continue; const S = SITES[id]; if (insideSite(id, b.x, b.z, -0.1) && b.y > -3) { const fy = groundH(S.x, S.z); if (b.y < fy + S.floors * 3.1 + 1) return id; } }
    if (b.y < groundH(b.x, b.z) - 1.5) return 'cellar';
    return null;
  }
  finish(ending: string) { this.s.ended = ending; this.frozen = true; document.exitPointerLock?.(); this.hud.fade(true, 1200); setTimeout(() => this.showEnding(ending), 1300); }
  placeName(): string { const m: Record<string, string> = { tavern: 'таверна «Якорь»', orven: 'лавка Орвена', foma: 'лавка Фомы', contora: 'курьерская контора', priyut: 'приют св. Лукии', tikhon: 'дом Тихона', cellar: 'подвал башни' }; return m[this.sceneInside] ?? 'Затон'; }
  /** the final screen (spec 13.3 / 15.3): neutral facts, no judgement */
  facts(): string[] {
    const f = this.s.flags, ru = getLang() === 'ru'; const L: string[] = []; const has = (n: any) => f.has(n);
    L.push(ru ? `Нед: ${has('nedSaved') ? 'жив, остался на мосту' : 'прыгнул со Старого моста в 22:16'}` : `Ned: ${has('nedSaved') ? 'alive, stayed on the bridge' : 'jumped from the Old Bridge at 22:16'}`);
    L.push(ru ? `Гейл: ${has('gaylWarned') || has('annaWarned') || has('jetonStolen') ? 'ушёл к жене' : 'ранен, лежит во дворе склада'}` : `Gayl: ${has('gaylWarned') || has('annaWarned') || has('jetonStolen') ? 'went to his wife' : 'wounded in the warehouse yard'}`);
    const tk = has('tikhonDead') ? 'мёртв' : has('tikhonHurt') ? 'без сознания' : has('tikhonLocked') ? 'заперт в доме' : has('tikhonTurned') ? 'дома с Пип' : 'ушёл на пристань';
    L.push(ru ? `Тихон: ${tk}. Пип: ${has('tikhonTurned') ? 'с отцом' : has('tikhonDead') || has('tikhonHurt') ? 'одна' : 'спит одна'}` : `Tikhon: ${tk}. Pip: ${has('tikhonTurned') ? 'with her father' : 'alone'}`);
    const kids = has('wagonPinPulled') ? (has('annaWarned') ? (ru ? 'в приюте у Анны' : 'back at the orphanage with Anna') : (ru ? 'на повозке, застрявшей на мосту' : 'in the wagon stuck on the bridge')) : (this.s.ended === 'utro' ? (ru ? `на катере: ${Math.min(14, 8 + (has('tildaWarned') ? 3 : 0) + (has('nedSaved') ? 3 : 0))} из 14` : `on the launch: ${Math.min(14, 8 + (has('tildaWarned') ? 3 : 0) + (has('nedSaved') ? 3 : 0))} of 14`) : (ru ? 'на барже «Вера»' : 'on the barge Vera'));
    L.push(ru ? `Дети приюта: ${kids}` : `Orphanage children: ${kids}`);
    L.push(ru ? `Тильда и Анка: ${has('tildaWarned') ? 'вместе' : 'Тильда у Корда'}` : `Tilda and Anka: ${has('tildaWarned') ? 'together' : 'Tilda is with Cord'}`);
    L.push(ru ? `Рыночная: ${has('tapCut') ? 'цела' : 'сгорела'}. Колокол: ${has('tapCut') ? 'бил' : 'молчал'}` : `Rynochnaya: ${has('tapCut') ? 'intact' : 'burned'}. The bell: ${has('tapCut') ? 'rang' : 'was silent'}`);
    return L;
  }
  showEnding(ending: string) {
    const e = document.getElementById('end')!; e.style.display = 'flex'; const ru = getLang() === 'ru';
    const T: Record<string, [string, string]> = {
      empty: ['Пустой час', ru ? 'В 23:00 окно закрывается. Крайн: «Время вышло».' : 'At 23:00 the window closes. Crane: "Time is up."'],
      dead: ['Смерть', ru ? 'Смерть окончательна.' : 'Death is final.'],
      otlozhen: ['Отложен', ru ? 'Катер у пирса 7. Выстрел. Тьма. Дождь.' : 'The launch at pier 7. A shot. Darkness. Rain.'],
      utro: ['Утро', ru ? 'Катер уходит в гавань. Город горит. Рассвет нескоро.' : 'The launch leaves for the harbour. The city burns. Dawn is far.'],
    };
    const [h, p] = T[ending] ?? [ending, '']; const facts = ending === 'otlozhen' || ending === 'utro' ? `<h3 style="font-weight:400;color:#8d887c">${ru ? 'Что изменилось этой ночью' : 'What changed tonight'}</h3><ul>${this.facts().map(x => `<li>${x}</li>`).join('')}</ul>` : `<p>${fmt(this.s.t, true)}${ending === 'dead' ? ` · ${this.placeName()} · ${ru ? 'стрелял' : 'shot by'}: ${this.combat.lastShooter ? (NPCS.find(n => n.id === this.combat.lastShooter) ? pick(NPCS.find(n => n.id === this.combat.lastShooter)!.name) : this.combat.lastShooter) : '—'}` : ''}</p>`;
    e.innerHTML = `<h1>${h}</h1><p>${p}</p>${facts}<p><a href="" style="color:#e01818">${ru ? 'Новая игра' : 'New game'}</a></p>`;
  }
}
