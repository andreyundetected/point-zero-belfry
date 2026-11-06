import * as THREE from 'three';
import { createEngine, Engine } from './render/engine';
import { buildTown, Town } from './render/town';
import { buildInteriors, Interior, PropInst } from './render/interiors';
import { createActor, Actor, NPC_VISUALS } from './render/actors';
import { fadeShell } from './render/kit';
import { BUILDINGS, buildingAt, floorY, levelOf, LEVELS } from './render/levels';
import { Particles } from './render/fx';
import { Session } from './sim/session';
import { dialogStart, dialogView, resolveChoice, inspectView, skillValue } from './sim/dialog';
import { INSPECT } from './sim/dialogData';
import { chronicle, ChronItem } from './sim/chronicle';
import { ending } from './sim/news';
import { NODES, OBJS, T1, clock, dist2d, TIMES } from './sim/map';
import { hrand } from './sim/rng';
import { UI, Verb } from './ui/ui';
import { Sound } from './audio';
import { t, has } from './i18n';
import { BARKS } from './data/barks';
import { applyPlace } from './render/assets';

type Cand = { kind: 'prop'; p: PropInst; d: number } | { kind: 'npc'; id: string; d: number } | { kind: 'item'; id: string; d: number } | { kind: 'out'; id: string; d: number };
const ITEM_KIND_KEY: Record<string, string> = { pass: 'item_pass', key: 'item_key', coinstack: 'item_coin', keyring: 'item_keyring', decor_key: 'item_decor' };
const OUTDOOR: Record<string, { x: number; z: number; r: number; name: string }> = {
  ks1: { x: -33, z: 15.5, r: 2.8, name: 'ks1' }, kiosk: { x: 6, z: 15, r: 3, name: 'kiosk' }, bench: { x: 12, z: 17.6, r: 3.2, name: 'bench' }, board: { x: 8, z: -5, r: 3.4, name: 'board' },
  mast: { x: 86.5, z: 14.5, r: 3.2, name: 'mast' }, fountain: { x: 0, z: 0, r: 3.8, name: 'fountain' },
};
const ARRIVE: Record<string, [number, number]> = { 'tav0>tav1': [-24.4, -3.4], 'tav1>tav0': [-24.4, -3.4], 'tw0>tw1': [3.2, -25.2], 'tw1>tw0': [3.2, -25.2], 'tw1>tw2': [-3.2, -25.2], 'tw2>tw1': [-3.2, -25.2], 'tav-1>tav0': [-25, -3.4], 'tav0>tav-1': [-25, -4.6] };
const spawnT = (id: string) => id;

export class Game {
  eng!: Engine; town!: Town; I!: Interior; S!: Session; ui = new UI(); snd = new Sound();
  hero!: Actor; npcs: Record<string, Actor> = {}; particles!: Particles; fireOut = new THREE.Group(); fireLights: THREE.PointLight[] = [];
  keys = new Set<string>(); camYaw = 0.5; camPitch = 0.92; camDist = 10; fast = false; paused = false;
  pos = new THREE.Vector2(0, -28.6); y = 8.4; floor = 2; heading = Math.PI; stance = 0; moving = false;
  sit: { x: number; z: number } | null = null; hidden = false; target: Cand | null = null; targetT = 0;
  hl: number[] = []; tab = 0; endShown = false; started = false; lastNews = ''; barkT = 6; barkN = 0; lastMoveSent = new THREE.Vector2(1e9, 1e9); lastStance = -1;
  heldVis: THREE.Object3D | null = null; barCollider = { x0: -21.3, z0: -2.1, x1: -20.7, z1: -0.5 };
  shotMode = false; flash = 0; vanishNoted = false; tutorial = 0; lastLevel = ''; lastBell = -1; lastFireOn = false; freeCam: null | { p: number[]; t: number[] } = null;

  async boot(setProgress: (p: number) => void) {
    const host = document.getElementById('app')!; this.eng = createEngine(host);
    let done = 0; const tick = () => { done++; setProgress(Math.min(0.96, done / 6)); };
    this.town = await buildTown(this.eng); tick();
    this.I = await buildInteriors(this.town.ctx, this.eng.scene); tick();
    this.particles = new Particles(this.eng.scene); this.eng.scene.add(this.fireOut); tick();
    this.hero = await createActor('characters/hero_rogue_hooded', 'hero', 1.75); this.eng.scene.add(this.hero.obj); tick();
    await Promise.all(Object.entries(NPC_VISUALS).map(async ([id, v]) => { const a = await createActor(v.model, v.kind, v.height, v.tint); this.npcs[id] = a; this.eng.scene.add(a.obj); a.play('idle'); }));
    tick();
    this.S = new Session(1);
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xff7a2a, 0, 14, 1.4); l.visible = false; this.eng.scene.add(l); this.fireLights.push(l); }
    // моль у газовых фонарей, дымки из труб
    this.eng.onFrame.push((dt, tm) => this.frame(dt, tm));
    this.bindInput();
    this.eng.start();
    setProgress(1);
  }

  begin() {
    this.started = true; this.snd.init(); this.ui.removeTitle(); this.refreshTutorial(); this.ui.toast(t('tut.1'), 6000);
  }

  // ======================= ввод =======================
  bindInput() {
    const cv = this.eng.renderer.domElement; let drag = false, lx = 0, ly = 0;
    cv.addEventListener('mousedown', (e) => { drag = true; lx = e.clientX; ly = e.clientY; });
    addEventListener('mouseup', () => { drag = false; });
    addEventListener('mousemove', (e) => { if (!drag || this.ui.open) return; this.camYaw -= (e.clientX - lx) * 0.006; this.camPitch = Math.max(0.35, Math.min(1.35, this.camPitch + (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY; });
    cv.addEventListener('wheel', (e) => { this.camDist = Math.max(4.5, Math.min(18, this.camDist + Math.sign(e.deltaY) * 0.8)); });
    addEventListener('keydown', (e) => {
      if (!this.started) return;
      const k = e.key.toLowerCase();
      if (this.ui.open) { if (k === 'escape') this.closeModal(); return; }
      this.keys.add(k);
      if (k === 'tab') { e.preventDefault(); this.fast = !this.fast; }
      if (k === 'q' || k === 'й') this.openJournal();
      if (k === 'e' || k === 'у') this.act(0); if (k === 'f' || k === 'а') this.act(1); if (k === 'g' || k === 'п') this.act(2);
      if (k === 'x' || k === 'ч') this.dropHeld();
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.key.toLowerCase()); });
    addEventListener('blur', () => this.keys.clear());
  }
  closeModal() { this.ui.closeModal(); this.paused = false; this.snd.ui(2); }

  // ======================= игровой цикл =======================
  get w() { return this.S.w; }
  levelKey() { const b = buildingAt(this.pos.x, this.pos.y); return b ? levelOf(b.b, this.floor) : ''; }

  frame(dt: number, tm: number) {
    if (!this.S) return;
    const w = this.w;
    if (this.started && !this.paused && !this.S.ended) {
      this.handleMovement(dt);
      const scale = this.fast ? 16 : 4;
      const before = w.t;
      this.syncMove();
      this.S.advance(dt * scale);
      void before;
      this.afterSim();
    } else if (this.started && !this.paused) { this.handleMovement(dt * 0); }
    if (this.started && this.S.ended && !this.endShown && !this.S.looked && !this.ui.open) { this.endShown = true; this.showEnding(); }
    this.updateVisuals(dt, tm);
    this.updateCamera(dt);
    if (this.started) { this.updateTarget(dt); this.updateHud(); this.updateBarks(dt); }
    this.eng.post.grade.uniforms.flash.value = Math.max(0, this.flash); this.flash = Math.max(0, this.flash - dt * 1.4);
  }

  afterSim() {
    const w = this.w;
    if (this.S.player.onTram) { this.pos.set(this.S.player.x, this.S.player.z); }
    // оригинал исчез
    if (w.flags.vanished && !this.vanishNoted) { this.vanishNoted = true; if (w.player.hands && w.items[w.player.hands]?.double) this.ui.toast(t('msg.vanish')); }
    // колокол каждые 15 игровых минут
    const q = Math.floor(w.t / 900); if (q !== this.lastBell && w.t > 1) { this.lastBell = q; this.snd.bell(); }
    if (w.fire.started && !this.lastFireOn) { this.lastFireOn = true; this.ui.toast(t('msg.fireNow'), 3000); this.snd.metal(); }
    if (this.S.ended && !this.endShown && !this.S.looked) { this.endShown = true; this.showEnding(); }
    this.refreshTutorial();
  }

  syncMove() {
    const p = this.pos; if (this.S.ended) return;
    if (this.lastMoveSent.distanceTo(p) > 0.4 || this.lastStance !== this.stance) {
      this.S.move(p.x, p.y, this.floor, this.stance); this.lastMoveSent.copy(p); this.lastStance = this.stance;
    }
  }

  // ======================= движение и коллизии =======================
  colliders() {
    const lk = this.levelKey(); const out = this.town.ctx.colliders.filter((c) => true); void lk;
    const res = [...out, ...this.I.colliders.filter((c) => !c.level || c.level === lk)];
    if (this.w.frontDoor === 'closed') res.push(this.barCollider);
    return res;
  }
  handleMovement(dt: number) {
    if (this.S.player.onTram) return;
    const k = this.keys; let ix = 0, iz = 0;
    if (k.has('w') || k.has('arrowup') || k.has('ц')) iz -= 1; if (k.has('s') || k.has('arrowdown') || k.has('ы')) iz += 1;
    if (k.has('a') || k.has('arrowleft') || k.has('ф')) ix -= 1; if (k.has('d') || k.has('arrowright') || k.has('в')) ix += 1;
    this.moving = ix !== 0 || iz !== 0;
    if (this.moving && (this.sit || this.hidden)) { this.sit = null; this.hidden = false; }
    if (this.sit) { this.stance = 1; return; }
    const sneak = k.has('c') || k.has('control') || k.has('с'); const run = k.has('shift');
    this.stance = this.hidden ? 1 : sneak ? 1 : run ? 2 : 0;
    if (!this.moving) return;
    const len = Math.hypot(ix, iz); ix /= len; iz /= len;
    // относительно камеры
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    const dx = ix * cy + iz * sy, dz = -ix * sy + iz * cy;
    const sp = (this.stance === 2 ? 5.5 : this.stance === 1 ? 1.6 : 3.1) * (this.S.player.escort ? 0.7 : 1);
    this.tryMove(dx * sp * dt, dz * sp * dt);
    this.heading = Math.atan2(dx, dz);
  }
  tryMove(dx: number, dz: number) {
    const cols = this.colliders(); const r = 0.38;
    const hit = (x: number, z: number) => cols.some((c) => x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r);
    const b = this.town.bounds; const nx = this.pos.x + dx, nz = this.pos.y + dz;
    if (!hit(nx, this.pos.y) && nx > b.x0 && nx < b.x1) this.pos.x = nx;
    if (!hit(this.pos.x, nz) && nz > b.z0 && nz < b.z1) this.pos.y = nz;
  }

  // ======================= визуальная синхронизация =======================
  updateVisuals(dt: number, tm: number) {
    const w = this.w; const eng = this.eng; const S = this.S;
    const lk = this.started ? this.levelKey() : ''; const inB = buildingAt(this.pos.x, this.pos.y);
    // уровни и оболочки
    for (const [k, g] of Object.entries(this.I.levels)) g.visible = k === lk;
    const camDx = Math.sin(this.camYaw), camDz = Math.cos(this.camYaw);
    for (const bb of BUILDINGS) {
      const h = this.town.houses[bb.house]; if (!h) continue; const inside = inB?.b === bb.b;
      fadeShell(h, inside ? 0 : 1, camDx, camDz, this.shotMode ? 5 : dt); if (this.town.glows[bb.house]) this.town.glows[bb.house].visible = !inside;
    }
    const underground = this.floor < 0 && !!inB;
    this.town.world.visible = !underground;
    // герой
    const ty = floorY(this.pos.x, this.pos.y, this.floor); this.y += (ty - this.y) * Math.min(1, dt * 10);
    this.hero.obj.position.set(this.pos.x, this.y + (this.sit ? -0.15 : 0), this.pos.y); this.hero.obj.rotation.y = this.heading; this.hero.obj.visible = !S.player.onTram || true;
    this.hero.play(this.sit ? 'sit' : this.hidden ? 'sneak' : this.moving ? (this.stance === 2 ? 'run' : this.stance === 1 ? 'sneak' : 'walk') : 'idle'); this.hero.mixer.update(dt * (this.moving && this.stance === 1 ? 0.6 : 1));
    // NPC
    for (const [id, a] of Object.entries(this.npcs)) {
      const n = w.npcs[id]; if (!n) continue;
      const fy = id === 'boris' || id === 'pug' ? 0.4 : floorY(n.x, n.z, n.floor);
      a.obj.position.set(n.x, fy + (n.inTram ? 0.4 : 0), n.z);
      let ry = n.face; const dRy = ((ry - a.obj.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI; a.obj.rotation.y += dRy * Math.min(1, dt * 8);
      const walking = (n.task?.k === 'walk' && n.route.length > 0) || (id === 'pip' && n.m.escort && dist2d(n.x, n.z, w.player.x, w.player.z) > 1.6);
      const seated = n.inTram || (id === 'zoya') || (id === 'foma' && !w.alarm) || (id === 'matvey' && n.ph === 'tea') || (id === 'ignat' && n.ph === 'tea') || (n.task?.k === 'act' && n.task.what === 'rest');
      const hiding = n.ph === 'hide' && !walking;
      const state = n.hurt > 4 ? 'die' : n.ph === 'fleeing' || n.ph === 'panic' ? 'run' : walking ? (n.speed > 1.2 ? 'run' : 'walk') : hiding ? 'sneak' : seated ? 'sit' : 'idle';
      a.play(state === 'run' && a.kind === 'animal' ? 'run' : state); a.mixer.update(dt);
      a.obj.visible = !(n.inTram && false) && !(id === 'boris' && w.dock.state === 'far') && !(id === 'pug' && w.dock.state === 'far');
    }
    // трамвай, баржа, бочки, флаги, часы, доска, фонари, дождь, манометр
    const tr = w.tram; this.town.tram.position.x = tr.x; this.town.tramWheels.forEach((o) => { o.rotation.x += (tr.state === 'run' ? 3 : 0) * dt * 3; });
    this.town.tramLight.intensity = 7 * (0.9 + 0.1 * Math.sin(tm * 8));
    const d = w.dock; this.town.barge.visible = d.state !== 'far'; this.town.barge.position.set(d.x, -0.1 + Math.sin(tm * 0.8) * 0.04, d.z); this.town.barge.rotation.set(Math.sin(tm * 0.7) * 0.01, d.state === 'avoid' ? 0.4 : 0, Math.sin(tm * 0.9) * 0.015);
    this.town.barrels.forEach((b) => { b.visible = d.barrels > 0; });
    this.town.flags.red.visible = this.town.flags.blue.visible = w.sem.closed; this.town.flags.green.visible = !w.sem.closed; this.town.flags.yellow.visible = w.lampsDone;
    const minutes = w.t / 60 + 20 + 21 * 60; const mm = minutes % 60, hh = (minutes / 60) % 12;
    this.town.clock.minHand.rotation.z = -(mm / 60) * Math.PI * 2; this.town.clock.hourHand.rotation.z = -(hh / 12) * Math.PI * 2;
    if (this.lastNews !== w.newsId) { this.lastNews = w.newsId; this.town.board.draw(t(w.newsId), has(w.newsId + '.s') ? t(w.newsId + '.s') : ''); }
    eng.lamps.level = Math.max(0.2, Math.min(1.1, w.P)); eng.lamps.flicker = w.P < 0.6 ? 1 : 0; eng.lamps.festive = w.lampsLit / 10;
    eng.rain.intensity = 1 - 0.4 * (w.t / T1);
    const wm = this.town.water.material as THREE.ShaderMaterial; wm.uniforms.time.value = tm;
    const near = eng.lamps.lamps.map((l) => ({ l, d: l.pos.distanceToSquared(eng.cam.position) })).sort((a, b) => a.d - b.d).slice(0, 8);
    near.forEach((q, i) => { wm.uniforms.lampPos.value[i].copy(q.l.pos); wm.uniforms.lampK.value[i] = 0.9 * eng.lamps.level; });
    const gauge = (this.town.world.userData.ks1 as THREE.Group | undefined)?.userData.gauge as THREE.Object3D | undefined; if (gauge) gauge.rotation.z = -((w.P / 3) * Math.PI * 1.4 - 0.7 * Math.PI);
    // башня: механизм
    for (const g of this.I.gears) g.rotation.y += g.userData.speed * dt * 0.8 * (this.fast ? 4 : 1);
    if (this.I.pendulum) this.I.pendulum.rotation.z = Math.sin(tm * 2.6) * 0.4;
    if (this.I.lens) { (this.I.lens.material as THREE.ShaderMaterial).uniforms.time.value = tm; (this.I.lens.material as THREE.ShaderMaterial).uniforms.k.value = Math.max(0, this.flash); }
    // свет интерьеров: мерцание
    for (const L of this.I.lights) if (L.flicker && L.level === lk) L.light.intensity = L.base * (0.88 + 0.12 * Math.sin(tm * 11 + L.base) + 0.05 * Math.sin(tm * 27 + L.base * 2));
    // предметы мира
    this.updateItems(dt, tm);
    // огонь, дым, газ
    this.updateFx(dt, tm);
    this.particles.update(dt, tm);
    // звук
    const nearWater = this.pos.y > 14 && !inB; const nearFire = (w.fire.started ? 1 : 0) * Math.max(0, 1 - dist2d(this.pos.x, this.pos.y, -28, -2) / 30) + (inB?.b === 'tavern' ? 0.4 * (w.hearth ? 1 : 0) : 0);
    this.snd.update(dt, { indoor: !!inB, nearWater, nearFire, inTower: inB?.b === 'tower', moving: this.moving && !this.sit, run: this.stance === 2, sneak: this.stance === 1, wood: !!inB || (this.pos.y > 20), rain: eng.rain.intensity });
    if (this.lastLevel !== lk) { if (this.started && (this.lastLevel === '' || lk === '')) this.snd.door(lk !== ''); this.lastLevel = lk; }
  }

  updateItems(dt: number, tm: number) {
    const w = this.w; const hands = w.player.hands;
    for (const [id, vis] of Object.entries(this.I.worldItems)) {
      const it = w.items[id]; let show = false;
      if (it) {
        if (it.loc.k === 'node') { const n = NODES[it.loc.id]; const y = it.loc.id === 'booth' ? 1.3 : it.loc.id === 'stop_pl' ? 0.62 : 0.3; if (id === 'key' || id === 'keyring') vis.position.set(-36 + (id === 'keyring' ? 0.4 : 0), y + LEVELS.booth.y, 9.25); else vis.position.set(n.x + 0.2, y, n.z - 0.1); show = true; if (it.loc.id === 'booth' || it.loc.id.startsWith('stop')) { /* видимы всегда */ } }
        else if (it.loc.k === 'chest') { vis.position.set(-30 + (id === 'pass' ? 0.1 : id === 'coinstack' ? -0.15 : 0.2), LEVELS['tav-1'].y + 0.42, -3.5); show = (id === 'decor_key') || w.t >= TIMES.pipStash; }
      }
      vis.visible = show && (this.levelKey() !== '' || !['coinstack', 'decor_key'].includes(id));
      if (show) vis.rotation.y += dt * 0.6;
    }
    // предмет в руках — над правой рукой героя
    if (this.heldVis) { this.heldVis.parent?.remove(this.heldVis); this.heldVis = null; }
    if (hands) {
      const it = w.items[hands]; const src = this.I.worldItems[it.kind === 'coinstack' ? 'coinstack' : it.kind === 'ticket' ? 'pass' : it.kind] ?? this.I.worldItems.key;
      if (src) { const c = src.clone(); c.visible = true; c.position.set(0.35, 1.0, 0.25); c.scale.multiplyScalar(1.4); this.hero.obj.add(c); this.heldVis = c; if (it.double && !it.real) c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const mm = (m.material as THREE.Material).clone() as THREE.MeshStandardMaterial; mm.transparent = true; mm.opacity = 0.5 + 0.4 * Math.sin(tm * 9); m.material = mm; } }); }
    }
  }

  fxT = 0; mothT = 0; winWorld: THREE.Vector3[] | null = null;
  updateFx(dt: number, tm: number) {
    const w = this.w; this.fxT += dt; this.mothT += dt;
    const f = w.fire;
    // дым из труб таверны и башни (всегда)
    if (this.fxT > 0.5) { this.fxT = 0; const tv = this.town.houses.F2.door; void tv; this.particles.spawn('steam', -25 + (hrand(9, w.tick) - 0.5), 6.6, -2, { vy: 0.7, vx: 0.2, size: 1.2, life: 4 });
      if (w.gas.leakOn && this.levelKey() === 'tav0') this.particles.spawn('gas', -34.8, 0.7 + hrand(1, w.tick) * 0.5, -6.0, { vy: 0.25, vx: 0.3, size: 0.8 + Math.min(1.6, w.gas.S * 0.2), life: 2.5 });
    }
    if (this.mothT > 0.7) { this.mothT = 0; const L = this.eng.lamps.lamps[Math.floor(hrand(4, w.tick) * this.eng.lamps.lamps.length)]; if (L && L.pos.distanceTo(this.eng.cam.position) < 28) this.particles.spawn('moth', L.pos.x, L.pos.y - 0.2, L.pos.z, { vx: 0.05, vy: 0.02, life: 6 }); }
    // пожар
    const lamps = this.fireLights; lamps.forEach((l) => { l.visible = false; });
    if (f.started) {
      const zones: [string, number, number, number][] = [['kitchen', -33, 0.7, -5.5], ['hall', -27, 0.7, 0], ['upper', -30, 3.6, -2], ['cellar', -28, -2.6, -3]];
      let li = 0;
      for (const [z, x, y, zz] of zones) {
        const st = f.zones[z]; if (st === undefined) continue; const k = Math.min(1, (w.t - st) / 40);
        const inside = this.levelKey() === (z === 'upper' ? 'tav1' : z === 'cellar' ? 'tav-1' : 'tav0');
        const inB = buildingAt(this.pos.x, this.pos.y)?.b === 'tavern';
        const Lp = li < 3 ? lamps[li++] : undefined; if (Lp) { Lp.visible = true; Lp.position.set(x, y + 0.6, zz); Lp.intensity = 14 * k * (0.8 + 0.2 * Math.sin(tm * 17 + x)); }
        if (inside && hrand(11, w.tick, z) < 0.5 * k + 0.2) {
          const ox = (hrand(12, w.tick) - 0.5) * 4, oz = (hrand(13, w.tick) - 0.5) * 3;
          this.particles.spawn('flame', x + ox, y + hrand(14, w.tick) * 0.5, zz + oz, { vy: 1.0, size: 1.4 * k + 0.4, life: 0.9 });
        }
        if (hrand(16, w.tick, z) < 0.35 * k) this.particles.spawn('dark', -28 + (hrand(17, w.tick) - 0.5) * 8, 7.4, -2 + (hrand(18, w.tick) - 0.5) * 5, { vy: 1.8, vx: 0.5, size: 3.2, life: 4.5 });
      }
      // внешний вид пожара: огонь в окнах и над коньком, отсвет на фасаде
      if (!this.winWorld) { const h = this.town.houses.F2; h.group.updateMatrixWorld(true); this.winWorld = h.winSpots.map((sp) => { const v = h.group.localToWorld(new THREE.Vector3(sp.x + sp.nx * 0.5, sp.y, sp.z + sp.nz * 0.5)); return v; }); }
      const sinceIg = w.t - f.ignitedAt; const kk = Math.min(1, sinceIg / 60);
      if (this.winWorld.length && hrand(19, w.tick) < 0.8 * kk) { const v = this.winWorld[Math.floor(hrand(20, w.tick) * this.winWorld.length)]; this.particles.spawn('flame', v.x, v.y, v.z, { vy: 1.2, size: 1.8 * kk + 0.4, life: 1.0 }); }
      if (sinceIg > 50 && hrand(21, w.tick) < 0.7) this.particles.spawn('flame', -34 + hrand(22, w.tick) * 12, 6.6 + hrand(23, w.tick) * 1.4, -4 + hrand(24, w.tick) * 4, { vy: 1.5, size: 2.4, life: 1.1 });
      const ext = this.fireLights[3]; ext.visible = true; ext.position.set(-19.5, 3.4, -1.5); ext.intensity = 20 * kk * (0.8 + 0.2 * Math.sin(tm * 13));
      this.eng.post.grade.uniforms.heat.value = Math.max(0, 1 - dist2d(this.pos.x, this.pos.y, -28, -2) / 18) * 0.8;
    } else this.eng.post.grade.uniforms.heat.value = 0;
  }

  updateCamera(dt: number) {
    const cam = this.eng.cam;
    if (this.freeCam) { cam.position.set(...(this.freeCam.p as [number, number, number])); cam.lookAt(...(this.freeCam.t as [number, number, number])); return; }
    const inside = !!buildingAt(this.pos.x, this.pos.y);
    const dist = inside ? Math.min(this.camDist, 8.2) : this.camDist; const pitch = inside ? Math.max(this.camPitch, 1.0) : this.camPitch;
    const tx = this.pos.x, ty = this.y + 1.2, tz = this.pos.y;
    const px = tx + Math.sin(this.camYaw) * Math.cos(pitch) * dist, py = ty + Math.sin(pitch) * dist, pz = tz + Math.cos(this.camYaw) * Math.cos(pitch) * dist;
    cam.position.lerp(new THREE.Vector3(px, py, pz), Math.min(1, dt * 6)); cam.lookAt(tx, ty, tz);
  }

  // ======================= взаимодействие =======================
  name(id: string) { return has('npc.' + id) ? t('npc.' + id) : has('who.' + id) ? t('who.' + id) : id; }
  itemName(id: string) { const it = this.w.items[id]; if (!it) return id; const k = (it.double ? 'item.dbl_' : 'item.') + it.kind; return has(k) ? t(k) : has('item.' + it.kind) ? t('item.' + it.kind) : it.kind; }
  updateTarget(dt: number) {
    this.targetT -= dt; if (this.targetT > 0 && !this.paused) return; this.targetT = 0.08;
    if (this.ui.open) return;
    const w = this.w; const px = this.pos.x, pz = this.pos.y; const lk = this.levelKey(); const cands: Cand[] = [];
    const sameFloor = (f: number) => Math.abs(f - this.floor) < 0.5 || (this.floor >= 0 && f >= 0 && !buildingAt(px, pz));
    for (const p of this.I.props) {
      if (p.level !== lk || !p.verbs) continue; const d = dist2d(px, pz, p.x, p.z);
      if (d < p.r) cands.push({ kind: 'prop', p, d: d - (p.verbs.includes('u') || p.verbs.includes('w') ? 0.5 : 0) });
    }
    if (!lk) for (const [id, o] of Object.entries(OUTDOOR)) { const d = dist2d(px, pz, o.x, o.z); if (d < o.r) cands.push({ kind: 'out', id, d: d + 0.3 }); }
    if (!lk) { const tr = w.tram; if (tr.state === 'wait' && tr.at && Math.abs(px - tr.x) < 5 && Math.abs(pz - 17.6) < 3.2 && !w.player.onTram) cands.push({ kind: 'out', id: 'tram', d: 1.5 }); if (w.player.onTram) cands.push({ kind: 'out', id: 'tram_exit', d: 0 }); }
    for (const [id, n] of Object.entries(w.npcs)) { if (n.inTram && !w.player.onTram) continue; const d = dist2d(px, pz, n.x, n.z); if (d < 3.0 && sameFloor(n.floor) && !(id === 'boris' && w.dock.state === 'far')) cands.push({ kind: 'npc', id, d }); }
    for (const it of Object.values(w.items)) {
      if (it.loc.k !== 'node' && it.loc.k !== 'chest') continue; if (it.id === 'keyring') continue;
      if (it.loc.k === 'chest' && !(w.t >= TIMES.pipStash || it.id === 'decor_key')) continue;
      const ip = it.loc.k === 'chest' ? { x: -30, z: -3.5 } : { x: NODES[it.loc.id].x, z: NODES[it.loc.id].z }; const d = dist2d(px, pz, ip.x, ip.z);
      const lvl = it.loc.k === 'chest' ? 'tav-1' : it.loc.id === 'booth' ? 'booth' : '';
      if (d < 2.4 && lk === lvl) cands.push({ kind: 'item', id: it.id, d: d - 0.8 });
    }
    cands.sort((a, b) => a.d - b.d); this.target = cands[0] ?? null;
  }
  candName(c: Cand): string {
    switch (c.kind) { case 'prop': return t(`obj.${c.p.kind}.name`); case 'npc': return `${t('npc.' + c.id)} — ${t('role.' + c.id)}`; case 'item': return this.itemName(c.id); case 'out': return c.id === 'tram' || c.id === 'tram_exit' ? t('obj.tram.name') : t(`obj.${c.id}.name`); }
  }
  verbs(c: Cand): Verb[] {
    const V = (key: string, label: string, run: () => void) => ({ key, label, run });
    const out: { label: string; run: () => void }[] = []; const w = this.w;
    const add = (label: string, run: () => void) => out.push({ label, run });
    if (c.kind === 'npc') {
      add(t(c.id === 'cat' || c.id === 'pug' ? 'verb.pet' : 'verb.talk'), () => this.openDialog(c.id));
      if (w.player.hands && !['cat', 'pug', 'fox'].includes(c.id)) add(t('verb.give'), () => { const it = w.player.hands!; this.S.do({ k: 'give', npc: c.id }, 3); if (this.w.player.hands !== it) this.ui.toast(t('msg.gave', { i: this.itemName(it) })); else this.ui.toast(t('ui.flicker.warn')); this.snd.coins(); });
      if (c.id === 'pip' && !this.S.player.escort) add(t('verb.hand'), () => { this.S.do({ k: 'escort', npc: 'pip', on: true }, 2); this.ui.toast(t('msg.hand')); });
      else if (c.id === 'pip' && this.S.player.escort) add(t('msg.handOff'), () => { this.S.do({ k: 'escort', npc: 'pip', on: false }, 2); this.ui.toast(t('msg.handOff')); });
    } else if (c.kind === 'item') {
      add(t('verb.take'), () => { if (w.player.hands) { this.ui.toast(t('ui.handsFull')); return; } this.S.do({ k: 'take', item: c.id }, 2); if (this.w.player.hands) { this.ui.toast(t('msg.took', { i: this.itemName(this.w.player.hands) })); this.snd.play('rpg_foley/cloth1.ogg', 0.4); } else this.ui.toast(t('ui.nothing')); });
      add(t('verb.inspect'), () => this.inspectKind(ITEM_KIND_KEY[this.w.items[c.id].kind] ?? 'item_pass'));
    } else if (c.kind === 'out') this.outVerbs(c.id, add);
    else this.propVerbs(c.p, add);
    const keys = ['E', 'F', 'G']; return out.slice(0, 3).map((o, i) => V(keys[i], o.label, o.run));
  }
  act(i: number) { if (!this.target || this.ui.open) return; const v = this.verbs(this.target)[i]; if (v) { this.snd.ui(i); v.run(); } }

  outVerbs(id: string, add: (l: string, r: () => void) => void) {
    const w = this.w;
    switch (id) {
      case 'ks1': add(t('verb.inspect'), () => this.inspectObj('ks1', 'ks1')); add(t('verb.operate'), () => this.openValves()); break;
      case 'kiosk': add(t('verb.inspect'), () => this.inspectObj('kiosk', 'kiosk')); add(t('verb.buy'), () => this.buy('ticket')); break;
      case 'bench': add(t('verb.inspect'), () => this.inspectObj('bench', 'bench')); break;
      case 'board': add(t('verb.read'), () => this.readBoard()); break;
      case 'mast': add(t('verb.inspect'), () => this.inspectKind('mast')); break;
      case 'fountain': add(t('verb.inspect'), () => this.inspectKind('fountain')); break;
      case 'tram': add(t('verb.board'), () => { const before = this.S.player.onTram; this.S.do({ k: 'use', obj: 'tram' }, 2); if (this.S.player.onTram && !before) this.ui.toast(t('msg.boarded')); else this.ui.toast(t('msg.denied')); }); break;
      case 'tram_exit': add(t('verb.exit'), () => { if (this.w.tram.state === 'wait') { this.S.do({ k: 'use', obj: 'tram_exit' }, 2); this.pos.set(this.w.tram.x, 18.9); } else this.ui.toast(t('ui.nothing')); }); break;
    }
    void w;
  }
  propVerbs(p: PropInst, add: (l: string, r: () => void) => void) {
    const w = this.w; const L = p.verbs; const objId = p.obj;
    const goOf = (p as PropInst & { go?: string }).go;
    if (L.includes('u')) { add(t(goOf === 'up' ? 'verb.stairs_up' : 'verb.stairs_down'), () => this.stairs(p, goOf === 'up')); return; }
    if (L.includes('w')) { add(t('verb.window'), () => this.openWindow()); add(t('verb.inspect'), () => this.inspectProp(p)); return; }
    if (objId === 'rug') { add(t('verb.inspect'), () => this.inspectProp(p)); add(t(w.rugMoved ? 'verb.descend' : 'verb.move'), () => { if (!w.rugMoved) { this.S.do({ k: 'use', obj: 'rug' }, 3); this.ui.toast(t('msg.rug')); this.snd.play('rpg_foley/cloth2.ogg', 0.5); } else this.descend(); }); return; }
    if (L.includes('o')) add(t('verb.inspect'), () => this.inspectProp(p));
    if (objId === 'bar') add(t('verb.buy'), () => this.buy('mug'));
    else if (objId === 'tav_valve') add(t('verb.operate'), () => this.openTavValve());
    else if (objId === 'kit_window') add(t(w.kitWindow ? 'verb.close' : 'verb.open'), () => { this.S.do({ k: 'use', obj: 'kit_window', arg: w.kitWindow ? 0 : 1 }, 3); this.ui.toast(t('msg.window')); this.snd.play('rpg_foley/creak1.ogg', 0.4); });
    else if (objId === 'hearth') add(t('verb.toggle'), () => { this.S.do({ k: 'use', obj: 'hearth', arg: w.hearth ? 0 : 1 }, 3); this.ui.toast(t('msg.lamp')); });
    else if (objId === 'stove') add(t('verb.toggle'), () => { this.S.do({ k: 'use', obj: 'stove', arg: w.stove ? 0 : 1 }, 3); this.ui.toast(t('msg.lamp')); });
    else if (objId === 'hood') add(t('verb.toggle'), () => { this.S.do({ k: 'use', obj: 'hood', arg: w.hood ? 0 : 1 }, 3); this.ui.toast(t('msg.lamp')); });
    else {
      if (L.includes('s') && p.sit) add(t('verb.sit'), () => { this.pos.set(p.sit!.x, p.sit!.z); this.heading = p.sit!.ry; this.sit = { x: p.sit!.x, z: p.sit!.z }; this.ui.toast(t('ui.sit')); });
      else if (L.includes('s')) add(t('verb.sit'), () => { this.sit = { x: this.pos.x, z: this.pos.y }; this.ui.toast(t('ui.sit')); });
      if (L.includes('h')) add(t('verb.hide'), () => { this.pos.set(p.x, p.z + 0.2); this.hidden = true; this.ui.toast(t('ui.hidden')); });
      if (L.includes('f')) add(t('verb.toggle'), () => this.toggleLight(p));
      if (L.includes('c')) add(t('verb.open'), () => { this.snd.play('rpg_foley/door_open_1.ogg', 0.4); this.inspectProp(p); });
    }
  }
  toggleLight(p: PropInst) {
    const near = this.I.lights.filter((l) => l.level === p.level && dist2d(l.light.position.x, l.light.position.z, p.x, p.z) < 3.2);
    near.forEach((l) => { l.on = !l.on; l.light.intensity = l.on ? l.base : 0; }); this.ui.toast(t('msg.lamp')); this.snd.ui(3);
  }
  stairs(p: PropInst, up: boolean) {
    const info = LEVELS[p.level]; const dir = up ? info.floor + 1 : info.floor - 1;
    const dst = Object.entries(LEVELS).find(([, v]) => v.b === info.b && v.floor === dir)?.[0]; if (!dst) return;
    const a = ARRIVE[`${p.level}>${dst}`]; if (!a) return;
    this.floor = dir; this.pos.set(a[0], a[1]); this.ui.toast(t('msg.stairs')); this.snd.play('impact/footstep_wood_001', 0.5); this.syncMove(); this.S.move(a[0], a[1], dir, 0);
  }
  descend() { const a = ARRIVE['tav0>tav-1']; this.floor = -1; this.pos.set(a[0], a[1]); this.ui.toast(t('msg.down')); this.S.move(a[0], a[1], -1, 0); }
  buy(what: string) {
    const h = this.w.player.hands && this.w.items[this.w.player.hands];
    if (!h || h.kind !== 'coinstack') { this.ui.toast(t('msg.nomoney')); return; }
    const before = this.w.player.hands; this.S.do({ k: 'buy', what }, 3);
    if (this.w.player.hands !== before) { this.ui.toast(t('msg.bought')); this.snd.coins(); } else this.ui.toast(h.double && !h.real ? t('ui.flicker.warn') : t('ui.nothing'));
  }
  dropHeld() { if (!this.w.player.hands || this.ui.open) return; const it = this.w.player.hands; this.S.do({ k: 'drop' }, 2); this.ui.toast(t('msg.dropped', { i: this.itemName(it) })); }

  // ----- осмотр -----
  inspectProp(p: PropInst) { if (p.obj && INSPECT[p.obj] && OBJS[p.obj]) this.inspectObj(p.obj, p.kind); else this.inspectKind(p.kind); }
  inspectKind(kind: string) {
    const nameK = `obj.${kind}.name`; const dk = `obj.${kind}.d`; this.paused = true;
    this.ui.inspect({ name: t(nameK), desc: has(dk) ? t(dk) : '', voices: [], facts: [] }, () => this.closeModal());
  }
  inspectObj(obj: string, kind: string) {
    const before = [...this.w.player.facts]; const view = inspectView(this.w, obj); if (!view) return this.inspectKind(kind);
    this.S.do({ k: 'inspect', obj }, 4);
    const after = this.w.player.facts; const fresh = after.filter((f) => !before.includes(f));
    const gain = fresh.length ? fresh : [];
    this.paused = true; const shown = view.facts.filter((f) => after.includes(f));
    this.ui.inspect({ name: t(view.name), desc: t(view.desc), voices: view.voices.map((v) => ({ skill: v.skill, text: t(v.k) })), facts: shown }, () => this.closeModal());
    if (gain.length) this.ui.toast(t('ui.fact.new'));
  }
  readBoard() {
    const w = this.w; const before = w.player.facts.length; this.S.do({ k: 'inspect', obj: 'board' }, 3); this.paused = true;
    this.ui.note(t('ob.reading'), `${t(w.newsId)} — ${has(w.newsId + '.s') ? t(w.newsId + '.s') : ''}`, () => this.closeModal()); if (w.player.facts.length > before) this.ui.toast(t('ui.fact.new'));
  }
  openValves() {
    const w = this.w; this.paused = true; const act = (kind: string, val?: number) => {
      if (kind === 'unlock') this.S.do({ k: 'use', obj: 'ks1_door', arg: 'unlock' }, 4);
      else if (kind === 'lock') this.S.do({ k: 'use', obj: 'ks1_door', arg: 'lock' }, 4);
      else { if (!w.player.facts.includes('K3')) this.S.do({ k: 'inspect', obj: 'ks1' }, 3); this.S.do({ k: 'use', obj: kind === 'supply' ? 'ks1_supply' : 'ks1_bleed', arg: val }, 4); this.snd.metal(); }
      this.openValves();
    };
    if (!w.ks1Open && !w.player.hands) { this.ui.valves({ P: w.P, v: w.v, w: w.w, open: false, locked: w.ks1Locked }, (k) => { if (k === 'unlock') this.ui.toast(t('ui.noKey')); }, () => this.closeModal()); return; }
    this.ui.valves({ P: w.P, v: w.v, w: w.w, open: w.ks1Open, locked: w.ks1Locked }, act, () => this.closeModal());
  }
  openTavValve() {
    const w = this.w; this.paused = true;
    const act = (k: string) => {
      if (!w.player.facts.includes('K9')) this.S.do({ k: 'inspect', obj: 'tav_valve' }, 3);
      if (k === 'open') this.S.do({ k: 'use', obj: 'tav_valve', arg: 1 }, 4); else if (k === 'close') this.S.do({ k: 'use', obj: 'tav_valve', arg: 0 }, 4);
      else this.S.do({ k: 'use', obj: 'tav_valve_lock', arg: k === 'lock' ? 1 : 0 }, 4); this.snd.metal(); this.openTavValve();
    };
    this.ui.tavValve({ open: w.tavValve > 0.5, locked: w.tavLocked }, act, () => this.closeModal());
  }

  // ----- диалог -----
  openDialog(id: string) {
    const w = this.w; if (!w.npcs[id]) return; this.paused = true; let node = dialogStart(w, id); if (!node) { this.paused = false; return; }
    const show = () => {
      const view = dialogView(this.w, id, node); if (!view) { this.closeModal(); return; }
      const pre = [...this.w.player.facts];
      this.ui.dialog(t('npc.' + id), t('role.' + id), view, (cid) => {
        const r = resolveChoice(this.w, id, node, cid); this.snd.ui(1);
        this.S.do({ k: 'say', npc: id, node, choice: cid }, r.cost);
        if (this.w.player.facts.length > pre.length) this.ui.toast(t('ui.fact.new'));
        if (!r.next) this.closeModal(); else { node = r.next; show(); }
      }, () => this.closeModal());
    };
    show();
  }

  // ----- Окно -----
  openWindow() {
    const S = this.S; this.paused = true; const w = this.w; void w;
    const h = this.w.player.hands ? this.w.items[this.w.player.hands] : null; const carry = S.carryOf();
    this.ui.windowPanel({
      sealed: S.sealed, canLook: !S.sealed && !S.looked && this.w.towerOpen, canBack: S.looked ? true : this.w.towerOpen && (!S.sealed || carry?.kind === 'key'), looked: S.looked, cordon: !this.w.towerOpen,
      carry: carry && h ? this.itemName(h.id) : '', carryLost: !!h && !carry, headline: S.looked ? [this.w.newsId, this.w.newsId + '.s'] : undefined,
    }, (k) => {
      if (k === 'cancel') return this.closeModal();
      if (k === 'look') { this.ui.toast(t('ui.look')); this.snd.jump(); this.flash = 1; if (S.look()) { this.lastNews = ''; this.openWindow(); } return; }
      if (k === 'back') { this.snd.jump(); this.flash = 1.2; this.ui.toast(t('msg.jump')); if (S.returnT0()) this.afterJump(); else this.ui.toast(t('ui.nothing')); }
    });
  }
  afterJump() {
    this.closeModal(); this.endShown = false; this.vanishNoted = false; this.lastFireOn = false; this.lastNews = '';
    this.pos.set(0, -28.6); this.floor = 2; this.y = 8.4; this.sit = null; this.hidden = false; this.heading = Math.PI; this.lastMoveSent.set(1e9, 1e9);
    this.S.move(0, -28.6, 2, 0); this.camYaw = 0.5; this.refreshTutorial();
  }

  // ----- журнал и финал -----
  evText(ev: ChronItem['ev']) {
    const key = `ev.${ev.type}`; const a = ev.actors.find((x) => x !== 'player' && !x.startsWith('item:')) ?? ev.actors[0] ?? ''; const it = ev.d?.item ? this.itemName(String(ev.d.item)) : '';
    const nm = a ? (has('npc.' + a) ? t('npc.' + a) : has('who.' + a) ? t('who.' + a) : a) : '';
    return has(key) ? t(key, { a: nm, i: it }) : t('ev.DEFAULT', { t: ev.type });
  }
  openJournal() {
    this.paused = true; const draw = () => {
      const chron = chronicle(this.w, this.S.seed);
      this.ui.journal({ facts: this.w.player.facts.filter((f) => /^K\d+$/.test(f)), chron, tab: this.tab, hl: this.hl }, (n) => { this.tab = n; draw(); }, (it) => { this.hl = it.chain; this.tab = 2; draw(); }, () => this.closeModal(), (tm) => clock(tm), (e) => this.evText(e));
    }; draw();
  }
  showEnding() {
    const S = this.S; const kind = ending(this.w); const chron = chronicle(this.w, S.seed);
    const items = chron.items.slice(0, 6).map((it) => `${clock(it.ev.t)} — ${it.witnessed ? this.evText(it.ev) : t('jr.unseen')}`);
    this.paused = true; this.snd.bell();
    this.ui.ending({ kind, headline: [this.w.newsId, this.w.newsId + '.s'], items, locked: S.sealed, onAgain: () => { if (S.threadReturn()) this.afterJump(); } });
    if (S.sealed) this.ui.toast(t('win.sealed'), 5000);
  }

  // ----- подсказки туториала, HUD, реплики -----
  refreshTutorial() {
    const w = this.w; const S = this.S; let k = 1;
    const hasKeyReal = w.player.hands && w.items[w.player.hands]?.kind === 'key' && !w.items[w.player.hands].double;
    const pos = this.pos; const farFromWindow = dist2d(pos.x, pos.y, 0, -28) > 8;
    if (!S.sealed) { k = w.player.facts.includes('K3') ? 0 : (w.player.hands && w.items[w.player.hands]?.double ? 4 : 5); if (k === 5) k = 0; }
    else if (hasKeyReal) k = 3; else if (farFromWindow) k = 2;
    if (k !== this.tutorial) { this.tutorial = k; this.ui.setBanner(k ? t('tut.' + k) : ''); }
  }
  updateHud() {
    const w = this.w; const h = w.player.hands ? w.items[w.player.hands] : null;
    this.ui.setHud(clock(w.t), this.fast, h ? this.itemName(h.id) : t('hud.empty'), this.S.jumps, w.player.facts.filter((f) => /^K\d+$/.test(f)).length, !!h && !!h.double && !h.real);
    if (this.ui.open) { this.ui.prompt(null); return; }
    if (this.target) { const vb = this.verbs(this.target); this.ui.prompt(this.candName(this.target), vb); } else this.ui.prompt(null);
  }
  updateBarks(dt: number) {
    this.barkT -= dt; if (this.barkT > 0 || this.ui.open) return; this.barkT = 5 + hrand(7, this.barkN) * 6; this.barkN++;
    const w = this.w; const cam = this.eng.cam;
    const ids = Object.keys(this.npcs).filter((id) => { const n = w.npcs[id]; return n && dist2d(n.x, n.z, this.pos.x, this.pos.y) < 14 && BARKS[id] && !n.inTram; });
    if (!ids.length) return;
    const id = ids[Math.floor(hrand(8, this.barkN) * ids.length)]; const n = w.npcs[id];
    const pool = w.alarm && n.floor === this.floor ? BARKS.alarm : hrand(9, this.barkN) < 0.25 ? BARKS.rain : BARKS[id];
    const v = new THREE.Vector3(n.x, floorY(n.x, n.z, n.floor) + 2.4, n.z).project(cam); if (v.z > 1) return;
    this.ui.bark((v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, t(pool[Math.floor(hrand(10, this.barkN) * pool.length)]));
  }
}
void applyPlace; void spawnT; void skillValue;
