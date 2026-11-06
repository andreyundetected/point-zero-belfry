import * as THREE from 'three';
import { makeSim } from './sim/load';
import { baselineOf, diff } from './sim/anomalies';
import { Renderer } from './render/scene';
import { collide } from './render/city';
import { UI, evText, type Choice } from './ui/ui';
import { t, npcName, onLang, getLang, setLang, locName } from './i18n';
import { dist } from './sim/util';
import { ACTIONS } from './sim/actions';
import { headlines, SCREENS } from './sim/news';
import { Audio } from './audio';
import { DialogRunner, progress, gainXp, skill } from './dialog';
import { employerTick, objective } from './employer';
import { drawMap } from './ui/map';
import { SHOPS } from './render/city';
import { Tutorial } from './tutorial';
import type { Ev } from './sim/types';

export interface Opt { label: string; locked?: boolean; run: () => void }
interface Trail { t: number; x: number; y: number; f: number }

const REVEAL: Record<string, string[]> = { office_empty: ['ila', 'kay'], kay_plan: ['burn', 'kay'], pike_badge: ['pike', 'lea'], dana_debt: ['dana', 'mok'], hart_info: ['hart'], omega_protocol: ['osip'], osip_loyalty: ['mara', 'osip'], burn_schedule: ['burn'], jeton_time: ['lior'], tram_stall: ['emil'], password_rule: ['ila'], mok_collectors: ['mok', 'yan'], yan_regulation: ['yan'], nisa_services: ['nisa'], feld_strict: ['feld'], billboard: ['hart', 'gas'], false_calls: ['vera'], clinic_gen: ['sol', 'mara'] };
const START = { x: 985, y: 652, f: -Math.PI / 2 };

export class Game {
  sim = makeSim(1);
  base = baselineOf(() => makeSim(1));
  ui: UI; r: Renderer; canvas: HTMLCanvasElement;
  speed = 1; acc = 0;
  p = { x: START.x, y: START.y, facing: START.f, z: 0, vz: 0 };
  trail: Trail[] = [];
  caught = false; started = false; said = new Set<string>(); jumps = 0; echoes: Ev[] = [];
  audio = new Audio(); lastAn = 0; lastAnT = 0; quality = 'high';
  get facts() { return this.sim.facts; }
  factSeen = new Set<string>(); factScan = 0; optSig = ''; travelSel = '';
  keys = new Set<string>();
  logSig = ''; lastLog = 0;
  dlg: DialogRunner | null = null;
  get labels() { return document.getElementById('labels')!; }
  labelEls = new Map<string, HTMLDivElement>();

  constructor() {
    const canvas = (this.canvas = document.getElementById('c') as HTMLCanvasElement);
    try { this.quality = localStorage.getItem('quality') || 'high'; } catch { /* ignore */ }
    this.r = new Renderer(canvas, this.sim, this.quality);
    this.r.onThunder = () => this.audio.thunder();
    progress.onPoint = () => { this.ui.toast(t('ui.new_point')); this.audio.blip(1700); };
    this.ui = new UI(document.getElementById('ui')!, this.sim.t0, this.sim.t1);
    this.ui.onJump = tt => this.jump(tt);
    this.ui.onMenu = a => this.menu(a);
    this.ui.onTravel = v => { this.travelSel = v; };
    this.ui.el('st_b').onclick = () => { this.started = true; this.ui.el('start').classList.add('off'); this.audio.start(); this.lock(); };
    this.ui.el('st_tut').onclick = () => { this.ui.el('st_b').click(); this.tut.start(); };
    this.ui.el('st_g').onclick = () => this.menu('quality');
    const unlock = () => this.audio.start(); addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
    addEventListener('keydown', e => this.onKey(e));
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    this.ui.el('dlg').addEventListener('click', () => this.advanceDlg());
    canvas.addEventListener('click', () => { if (this.started && !this.anyPanel()) this.lock(); });
    document.addEventListener('pointerlockchange', () => {
      // Esc releases the pointer lock in browsers -> treat an unexpected unlock as "open the menu"
      if (!document.pointerLockElement && this.started && !this.anyPanel() && !this.wantUnlock) this.ui.showMenu(true);
      this.wantUnlock = false;
    });
    addEventListener('mousemove', e => {
      if (document.pointerLockElement !== canvas && !(e.buttons & 2)) return;
      this.r.yaw += e.movementX * 0.0032;
      this.r.pitch = Math.max(-0.75, Math.min(1.2, this.r.pitch + e.movementY * 0.0032));
    });
    addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousedown', e => { if (e.button === 0 && document.pointerLockElement === canvas && !this.anyPanel() && !this.driving) this.fire(); });
    onLang(() => { this.logSig = ''; this.optSig = ''; this.refreshCarry(); this.ui.menuState(!this.audio.muted, this.quality); });
    this.ui.menuState(true, this.quality);
    this.refreshCarry();
    (window as any).__game = this;
    let last = performance.now();
    const loop = (now: number) => { const raw = Math.max(0, (now - last) / 1000); last = now; this.frame(Math.min(0.1, raw), Math.min(0.5, raw)); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  wantUnlock = false; stepAcc = 0;
  lock() { try { const r = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined; r?.catch?.(() => {}); } catch { /* ignore */ } }
  unlock() { if (document.pointerLockElement) { this.wantUnlock = true; document.exitPointerLock(); } }
  anyPanel() { return this.ui.pickOpen() || this.ui.menuOpen() || this.ui.winOpen() || !!this.dlg || this.ui.el('bigmap').classList.contains('on'); }

  onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (!this.started) { if (k === 'enter') this.ui.el('st_b').click(); return; }
    if (this.ui.menuOpen()) { if (k === 'escape') this.menu('resume'); return; }
    if (this.ui.pickOpen()) { if (k === 'escape' || k === 'k') { this.ui.closePick(); this.lock(); } else if (k >= '1' && k <= '9') this.ui.pickKey(+k - 1); return; }
    if (this.dlg) {
      e.preventDefault();
      if (k === ' ' || k === 'enter') this.advanceDlg();
      else if (k >= '1' && k <= '9') this.dlg.choose(+k - 1);
      else if (k === 'escape') this.closeDialog();
      return;
    }
    if (this.ui.winOpen()) {
      const step = e.shiftKey ? 600 : 60;
      if (k === 'arrowleft' || k === 'a') { this.ui.setTarget(this.ui.target - step); e.preventDefault(); }
      else if (k === 'arrowright' || k === 'd') { this.ui.setTarget(this.ui.target + step); e.preventDefault(); }
      else if (k === 'enter') this.jump(this.ui.target);
      else if (k === 'q' || k === 'escape') this.toggleWindow(false);
      return;
    }
    if (k === 'escape') { if (this.ui.el('bigmap').classList.contains('on')) { this.ui.el('bigmap').classList.remove('on'); return; } this.unlock(); this.ui.showMenu(true); return; }
    this.keys.add(k);
    if (k === 'q') return this.toggleWindow(true);
    if (k === 't') return this.taxi();
    if (k === 'u') this.useItem();
    if (k === 'k') this.skills();
    if (k === 'v') this.toggleDrive();
    if (k === 'tab') { e.preventDefault(); this.ui.toggleLog(); this.logSig = ''; }
    if (k >= '1' && k <= '5') this.speed = [1, 2, 4, 8, 16][+k - 1];
    if (k === 'm') { this.audio.muted = !this.audio.muted; this.ui.menuState(!this.audio.muted, this.quality); }
    if (k === 'n') { const b = this.ui.el('bigmap'); b.classList.toggle('on'); if (b.classList.contains('on')) this.drawMaps(); }
    if (k === ' ') { e.preventDefault(); if (this.p.z <= 0.001) this.p.vz = 5.2; }
    if (k === 'e') this.interact(0);
    const oi = ['f', 'g', 'h', 'j'].indexOf(k); if (oi >= 0) this.interact(oi + 1);
  }

  toggleWindow(on: boolean) {
    this.ui.showWin(on); this.keys.clear();
    if (on) { this.unlock(); this.refreshCarry(); } else this.lock();
  }

  /** Taxi: pick a destination; the ride takes game time (car speed along the street grid) */
  taxi() {
    const s = this.sim, dests = ['market', 'bar', 'clinic', 'substation', 'depot', 'dispatch', 'tower_front', 'garage', 'bridge', 'tunnel', 'kolco', 'school'];
    this.unlock(); this.keys.clear();
    this.ui.pick(t('ui.taxi_title'), dests.map(id => {
      const l = s.locs[id], d = Math.abs(l.x - this.p.x) + Math.abs(l.y - this.p.y), sec = Math.round(90 + d / 9 * (s.world.feeders.lights ? 1 : 1.6));
      return { label: `${locName(id)} — ${t('ui.eta', { t: String(Math.ceil(sec / 60)) })}`, run: () => {
        const target = Math.min(s.t1, s.world.t + sec);
        this.ui.fastForward(true, false);
        setTimeout(() => {
          s.advanceTo(target); this.p.x = l.x + 6; this.p.y = l.y + 8; this.p.z = 0;
          this.trail.push({ t: s.world.t, x: this.p.x, y: this.p.y, f: this.p.facing });
          this.ui.fastForward(false); this.ui.toast(t('ui.arrived', { loc: locName(id) })); this.optSig = ''; this.lock();
        }, 400);
      } };
    }));
  }

  menu(a: string) {
    if (a === 'resume') { this.ui.showMenu(false); this.lock(); }
    if (a === 'lang') setLang(getLang() === 'ru' ? 'en' : 'ru');
    if (a === 'sound') this.audio.muted = !this.audio.muted;
    if (a === 'quality') { this.quality = this.quality === 'high' ? 'low' : 'high'; try { localStorage.setItem('quality', this.quality); } catch { /* ignore */ } this.r.setQuality(this.quality); }
    if (a === 'restart') { this.ui.showMenu(false); this.jump(this.sim.t0); this.lock(); }
    this.ui.menuState(!this.audio.muted, this.quality);
  }

  refreshCarry() { this.ui.inventory(this.sim.world.pinv, this.sim, this.travelSel, this.sim.world.money); }

  /** Jump: back = world AND the player rewind to that moment (position from the trail); forward = fast simulation */
  jump(target: number) {
    const s = this.sim, now = s.world.t;
    if (target === now) return;
    const back = target < now;
    this.ui.fastForward(true, back); this.audio.jump(back); this.r.glitch = 1;
    setTimeout(() => {
      if (back) {
        this.jumps++;
        for (const e of s.events) if (e.t > target && (e.tags.includes('story') || e.tags.includes('player')) && !this.echoes.some(x => x.type === e.type && x.loc === e.loc && Math.abs(x.t - e.t) < 60)) this.echoes.push({ ...e });
        if (this.echoes.length > 80) this.echoes.splice(0, this.echoes.length - 80);
        const carry = this.travelSel || undefined;
        if (!s.travelBack(target, carry)) { this.ui.toast(t('ui.refused')); s.travelBack(target); }
        let pos: Trail = { t: s.t0, x: START.x, y: START.y, f: START.f };
        for (const tr of this.trail) if (tr.t <= target) pos = tr; else break;
        this.trail = this.trail.filter(tr => tr.t <= target);
        this.p.x = pos.x; this.p.y = pos.y; this.p.facing = pos.f; this.r.yaw = pos.f; this.p.z = 0; this.p.vz = 0;
        this.caught = false;
      } else s.advanceTo(target);
      this.logSig = ''; this.optSig = ''; this.refreshCarry();
      this.ui.fastForward(false); this.toggleWindow(false);
      this.ui.toast(t(back ? 'ui.jumped_back' : 'ui.jumped_fwd', { t: String(Math.floor(target / 3600)).padStart(2, '0') + ':' + String(Math.floor(target % 3600 / 60)).padStart(2, '0') }));
    }, 450);
  }

  nearLoc(loc: string, r: number): boolean { const lp = this.sim.locs[loc]; return dist(lp, this.p) < r; }

  options(): Opt[] {
    const s = this.sim, w = s.world, out: Opt[] = [];
    for (const g of w.ground) {
      const lp = s.locs[g.loc];
      if (dist({ x: lp.x + 2, y: lp.y + 3 }, this.p) < 7) out.push({ label: `${t('ui.take')}: ${t('ui.items.' + g.item.replace('*', ''))}`, run: () => {
        s.addIv({ type: 'take', item: g.item, loc: g.loc }); s.addVanish({ item: g.item.replace('*', ''), t: w.t + 1, loc: g.loc });
      } });
    }
    let near: string | null = null, bd = 4.5;
    for (const n of Object.values(w.npcs)) { const d = dist(n.pos, this.p); if (d < bd && !n.flags.down && !n.flags.dead && n.id !== 'convoy') { bd = d; near = n.id; } }
    if (near) {
      const id = near; out.push({ label: `${t('ui.talk')}: ${npcName(id)}`, run: () => this.openDialog(id) });
      for (const it of w.pinv.filter(x => !['pistol', 'rifle'].includes(x.replace('*', ''))))
        out.push({ label: `${t('ui.give')}: ${t('ui.items.' + it.replace('*', ''))} → ${npcName(id)}`, run: () => s.addIv({ type: 'give', item: it, to: id }) });
    }
    for (const [id, a] of Object.entries(ACTIONS)) {
      if (!this.nearLoc(a.loc, a.radius ?? 18)) continue;
      const stateOk = s.canAct(id, false), factsOk = (a.facts ?? []).every(f => this.facts.has(f));
      if (!stateOk) continue;
      out.push({ label: (factsOk ? '' : '🔒 ') + t('ui.act.' + id), locked: !factsOk, run: () => {
        if (!factsOk) return this.ui.toast(t('ui.need_fact'));
        s.addIv({ type: 'act', id });
      } });
    }
    for (const [id, sh] of Object.entries(SHOPS)) if (Math.abs(this.p.x - sh.x) < sh.w / 2 + 1 && Math.abs(this.p.y - sh.y) < sh.d / 2 + 1)
      out.unshift({ label: `${t('ui.trade')}: ${t('ui.shop.' + id)}`, run: () => this.trade(id) });
    return out;
  }

  /** shop: buy from the catalogue, sell loot; money lives in the world state (rewinds with jumps) */
  trade(id: string) {
    const sh = SHOPS[id], s = this.sim, w = s.world; this.unlock(); this.keys.clear();
    const items: { label: string; run: () => void }[] = [];
    for (const [it, price] of sh.sell) items.push({ label: `${t('ui.buy')}: ${t('ui.items.' + it)} — ${price} ${t('ui.cr')}${t('ui.idesc.' + it) !== 'ui.idesc.' + it ? ` <small>(${t('ui.idesc.' + it)})</small>` : ''}`, run: () => {
      if (w.money < price) { this.ui.toast(t('ui.no_money')); return this.trade(id); }
      s.addIv({ type: 'buy', item: it, price, shop: sh.loc }); s.step(); this.audio.blip(990); this.refreshCarry(); this.trade(id);
    } });
    for (const it of w.pinv) { const base = it.replace('*', ''), price = sh.buy[base]; if (!price) continue;
      items.push({ label: `${t('ui.sell')}: ${t('ui.items.' + base)} — +${price} ${t('ui.cr')}`, run: () => { s.addIv({ type: 'sell', item: it, price, shop: sh.loc }); s.step(); this.audio.blip(520); this.refreshCarry(); this.trade(id); } }); }
    this.ui.pick(`${t('ui.shop.' + id)} · ${t('ui.money')}: ${w.money} ${t('ui.cr')}`, items.slice(0, 9));
  }
  driving = false; tut = new Tutorial(this); known = new Set<string>();
  /** V: take the nearest parked car (or get back into yours) / step out */
  toggleDrive() {
    const car = this.r.myCar;
    if (this.driving) { this.driving = false; this.r.driving = false; car.active = false; car.v = 0;
      const c = collide(car.x + Math.cos(car.h) * 2.4, car.y - Math.sin(car.h) * 2.4); this.p.x = c.x; this.p.y = c.y; return; }
    if (car.placed && Math.hypot(car.x - this.p.x, car.y - this.p.y) < 5) { this.driving = true; this.r.driving = true; car.active = true; return; }
    const T = this.r.traffic; let best = -1, bd = 6;
    T.parked.forEach((p, i) => { const d = Math.hypot(p.x - this.p.x, p.y - this.p.y); if (d < bd) { bd = d; best = i; } });
    if (best < 0) return this.ui.toast(t('ui.no_car'));
    const p = T.parked.splice(best, 1)[0];
    if (car.placed) T.parked.push({ x: car.x, y: car.y, yaw: car.h, kind: 0 });
    const col = new THREE.Color().setHSL(Math.random(), 0.8, 0.45);
    car.place(p.x, p.y, p.yaw, col); this.driving = true; this.r.driving = true; car.active = true;
    this.ui.toast(t('ui.in_car'));
  }
  drive(dt: number) {
    const car = this.r.myCar, k = this.keys;
    const acc = (k.has('w') ? 1 : 0) - (k.has('s') ? 1 : 0), steer = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
    const max = k.has('shift') ? 42 : 28;
    car.v += acc * (acc > 0 ? 14 : 22) * dt; car.v *= 1 - dt * (acc === 0 ? 0.6 : 0.15); car.v = Math.max(-8, Math.min(max, car.v));
    if (k.has(' ')) car.v *= 1 - dt * 3;
    car.h -= steer * dt * Math.min(1, Math.abs(car.v) / 6) * 1.7 * Math.sign(car.v || 1);
    const nx = car.x + Math.sin(car.h) * car.v * dt, ny = car.y + Math.cos(car.h) * car.v * dt;
    const c = collide(nx, ny, 1.3);
    if (Math.hypot(c.x - nx, c.y - ny) > 0.05) { car.v *= -0.25; this.audio.blip(80); }
    car.x = c.x; car.y = c.y; this.p.x = car.x; this.p.y = car.y; this.p.facing = Math.atan2(Math.cos(car.h), Math.sin(car.h));
    let dy = (Math.PI / 2 - car.h) - this.r.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    // camera follows the car heading softly (yaw convention: forward = (cos yaw, sin yaw))
    const fw = Math.atan2(Math.cos(car.h), Math.sin(car.h)); let d2 = fw - this.r.yaw; d2 = Math.atan2(Math.sin(d2), Math.cos(d2)); this.r.yaw += d2 * Math.min(1, dt * 3); void dy;
    this.audio.engine(Math.abs(car.v));
  }
  /** shoot whoever is under the crosshair (within 40 m, 5 degrees); pistol is quiet, rifle is loud */
  fire() {
    const s = this.sim, w = s.world;
    const weapon = s.has('rifle') ? 'rifle' : s.has('pistol') ? 'pistol' : null;
    if (!weapon) return this.ui.toast(t('ui.no_weapon'));
    const cam = this.r.camera, dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    let best: string | null = null, bd = 1e9;
    for (const n of Object.values(w.npcs)) {
      if (n.flags.down || n.id === 'convoy') continue;
      const v = new THREE.Vector3(n.pos.x - cam.position.x, 1.4 - cam.position.y, n.pos.y - cam.position.z), d = v.length();
      if (d > (weapon === 'rifle' ? 120 : 40)) continue;
      const ang = v.normalize().angleTo(dir); if (ang < 0.09 && d < bd) { bd = d; best = n.id; }
    }
    this.audio.shot(weapon === 'pistol'); this.r.muzzle = 1;
    // the shot itself is the special mission action when it is the right moment on the billboard
    if (weapon === 'rifle' && s.canAct('shoot_lash') && this.nearLoc('billboard', 25) && w.door) { s.addIv({ type: 'act', id: 'shoot_lash' }); return; }
    if (!best) return this.ui.toast(t('ui.no_target'));
    s.addIv({ type: 'shoot', npc: best, weapon });
  }
  /** K: spend skill points (Disco-style growth that persists through time jumps) */
  skills() {
    this.unlock(); this.keys.clear();
    const names = ['obs', 'hack', 'emp', 'cool', 'logic', 'mem'];
    this.ui.pick(t('ui.skills', { p: String(progress.points), x: String(progress.xp) }), names.map(k => ({
      label: `${t('ui.voice.' + k)}: <b>${skill(this.sim, k)}</b> <small>${t('ui.skill_desc.' + k)}</small>${progress.points ? ' [+]' : ''}`,
      run: () => { if (progress.points > 0) { progress.points--; progress.add[k]++; this.audio.blip(1500); } this.skills(); },
    })));
  }
  stimUntil = 0;
  useItem() {
    const s = this.sim;
    if (s.has('stim')) { const i = s.world.pinv.findIndex(x => x.replace('*', '') === 'stim'); s.world.pinv.splice(i, 1); this.stimUntil = s.world.t + 120; this.ui.toast(t('ui.stim_on')); this.audio.blip(1200); this.refreshCarry(); }
    else if (s.has('noodles') || s.has('tea') || s.has('synth_vodka')) { const i = s.world.pinv.findIndex(x => ['noodles', 'tea', 'synth_vodka'].includes(x.replace('*', ''))); const it = s.world.pinv[i]; s.world.pinv.splice(i, 1); this.ui.toast(t('ui.use') + ': ' + t('ui.items.' + it.replace('*', ''))); this.refreshCarry(); }
  }

  interact(i = 0) { const o = this.options()[i]; if (!o) return; o.run(); if (!o.locked) { this.audio.blip(660); this.refreshCarry(); this.optSig = ''; } }

  openDialog(npc: string) {
    const n = this.sim.world.npcs[npc], now = this.sim.world.t;
    const echo = this.echoes.find(e => n.loc && e.loc === n.loc && Math.abs(e.t - now) < 900 && !e.tags.includes('player'));
    const r = new DialogRunner(npc, this.sim, {
      show: (voice, text, choices: Choice[], check) => this.ui.dialogLine(npc, npcName(npc), voice, text, choices, check),
      close: () => this.closeDialog(),
      act: id => this.sim.addIv({ type: 'act', id }),
      toast: m => this.ui.toast(m),
      echo: echo ? evText(echo) : null,
    });
    if (!r.ok) return;
    this.known.add(npc); for (const k of r.known) this.known.add(k);
    this.dlg = r; this.unlock(); this.keys.clear(); r.begin();
  }
  advanceDlg() { if (!this.dlg) return; if (this.ui.typing()) this.ui.skipTyping(); else this.dlg.advance(); }
  closeDialog() { this.dlg = null; this.ui.dialogClose(); this.optSig = ''; this.refreshCarry(); this.lock(); }

  scanFacts() {
    const ev = this.sim.events;
    if (this.factScan > ev.length) this.factScan = 0;
    for (; this.factScan < ev.length; this.factScan++) {
      const e = ev[this.factScan];
      if (e.tags.includes('fact')) { const f = String(e.data?.fact), v = String(e.data?.value); if (!this.factSeen.has(f)) { this.factSeen.add(f); this.ui.toast(t('ui.fact.' + f, { v })); } }
    }
    for (const [f, v] of this.facts) if (!this.factSeen.has(f)) { this.factSeen.add(f); this.ui.toast(t('ui.fact.' + f, { v })); for (const n of REVEAL[f] ?? []) this.known.add(n); gainXp(1); }
  }

  frame(dt: number, simDt = dt) {
    const s = this.sim, k = this.keys, free = this.started && !this.anyPanel();
    const f = free ? (k.has('w') ? 1 : 0) - (k.has('s') ? 1 : 0) : 0, r = free ? (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0) : 0;
    if (k.has('arrowleft')) this.r.yaw -= dt * 1.8; if (k.has('arrowright')) this.r.yaw += dt * 1.8;
    if (this.driving && free) this.drive(dt); else this.audio.engine(0);
    const moving = !this.driving && (f !== 0 || r !== 0);
    if (moving) {
      const yaw = this.r.yaw, sp = (k.has('shift') ? 9 : 5) * (s.world.t < this.stimUntil ? 1.7 : 1) * dt;
      const dx = Math.cos(yaw) * f - Math.sin(yaw) * r, dy = Math.sin(yaw) * f + Math.cos(yaw) * r, len = Math.hypot(dx, dy) || 1;
      const c = collide(this.p.x + dx / len * sp, this.p.y + dy / len * sp);
      this.stepAcc += Math.hypot(c.x - this.p.x, c.y - this.p.y); if (this.stepAcc > (k.has('shift') ? 1.3 : 0.75) && this.p.z === 0) { this.stepAcc = 0; this.audio.step(k.has('shift')); }
      this.p.x = c.x; this.p.y = c.y;
      let df = Math.atan2(dy, dx) - this.p.facing; df = Math.atan2(Math.sin(df), Math.cos(df)); this.p.facing += df * Math.min(1, dt * 12);
    }
    // physical jump
    this.p.vz -= 15 * dt; this.p.z = Math.max(0, this.p.z + this.p.vz * dt); if (this.p.z === 0) this.p.vz = Math.max(0, this.p.vz);
    // simulation clock (paused only in menus/dialog; dialogue lines advance time themselves)
    this.acc += this.dlg || !this.started || this.ui.menuOpen() ? 0 : simDt * this.speed;
    let n = 0; while (this.acc >= 1 && n < 400) {
      this.acc -= 1; if (s.world.t < s.t1) s.step(); n++;
      if (s.world.t % 2 === 0) { const last = this.trail[this.trail.length - 1]; if (!last || last.t < s.world.t) this.trail.push({ t: s.world.t, x: this.p.x, y: this.p.y, f: this.p.facing }); }
    }
    this.r.frac = this.acc;
    this.r.update(this.p.x, this.p.y, this.p.z, this.p.facing, moving, k.has('shift'), s.world.pinv.some(x => x.endsWith('*')), dt);
    this.r.render();
    this.ui.clock(s.world.t, this.speed);
    this.updateLabels();
    this.audio.update(s.world.t, s.world.rain, this.lastAn, this.speed);
    const now = performance.now();
    if (now - this.lastLog > 350) {
      this.lastLog = now; this.scanFacts(); this.updateLog(); this.updateOptions(); employerTick(this); this.tut.tick(); this.drawMaps(); this.ui.objective(objective(this));
      if (this.ui.winOpen()) this.ui.setMarks(s.events.filter(e => e.tags.includes('story') || e.tags.includes('player')).slice(-120).map(e => ({ t: e.t, story: e.tags.includes('story') })));
    }
  }

  updateLog() {
    const s = this.sim, on = this.ui.logOn();
    if (!on && performance.now() - this.lastAnT < 2000) return;
    this.lastAnT = performance.now();
    const an = diff(this.base, s.events, s.world.t).filter(a => a.chain.length > 0);
    this.lastAn = an.length;
    if (!on) return;
    const sig = an.slice(0, 16).map(a => a.ev.id).join(',') + s.events.length + this.facts.size + getLang() + 'L';
    if (sig === this.logSig) return; this.logSig = sig;
    const leads: string[] = [];
    for (const [id, a] of Object.entries(ACTIONS)) {
      if (!a.facts?.length) continue;
      if (!(a.facts ?? []).every(f => this.facts.has(f))) continue;
      const done = s.events.some(e => e.type === 'player_act' && e.data?.id === id);
      leads.push(`${done ? '✔ ' : '◇ '}${t('ui.act.' + id)} — ${locName(a.loc)}${a.from ? ` · ${a.from}–${a.to ?? '22:00'}` : ''}`);
    }
    this.ui.renderLog(s.events, an, this.facts, leads);
  }

  drawMaps() {
    drawMap(this.ui.el('mini') as HTMLCanvasElement, this.sim, this.p.x, this.p.y, this.p.facing, 380, true, this.known);
    const big = this.ui.el('bigmap') as HTMLCanvasElement; if (big.classList.contains('on')) drawMap(big, this.sim, this.p.x, this.p.y, this.p.facing, 0, true, this.known);
  }

  updateOptions() {
    const w = this.sim.world;
    const nearScreen = SCREENS.some(l => this.nearLoc(l, 90));
    this.ui.news(nearScreen ? headlines(this.sim).map(h => t('news.' + h.key, h.params)) : null);
    const police = this.sim.events.slice(-60).find(e => e.type === 'police_arrives' && e.t > w.t - 180 && dist(this.sim.locs[e.loc], this.p) < 90);
    this.caught = !!police && !w.flags.result && !this.sim.has('disguise');
    if (this.caught) this.ui.result('caught'); else if (w.flags.result) this.ui.result(String(w.flags.result)); else this.ui.result(null);
    const wpn = this.sim.has('rifle') ? 'rifle' : this.sim.has('pistol') ? 'pistol' : null;
    this.ui.weapon(wpn && !this.driving ? t('ui.weapon', { w: t('ui.items.' + wpn) }) : '');
    const o = this.options(), sig = o.map(x => x.label).join('|') + w.pinv.join(',') + getLang();
    if (sig === this.optSig) return; this.optSig = sig;
    this.ui.options(o.map(x => ({ label: x.label, cls: x.locked ? 'lock' : '', run: () => { x.run(); this.optSig = ''; } })));
    this.refreshCarry();
  }

  updateLabels() {
    const s = this.sim, cam = this.r.camera, seen = new Set<string>();
    const cand = Object.values(s.world.npcs).filter(n => dist(n.pos, this.p) < (this.sim.has('eye_scanner') ? 60 : 24) && !n.flags.down).sort((a, b) => dist(a.pos, this.p) - dist(b.pos, this.p)).slice(0, 8);
    for (const n of cand) {
      const v = new THREE.Vector3(n.pos.x, 2.3, n.pos.y).project(cam); if (v.z > 1 || Math.abs(v.x) > 1.1) continue;
      let el = this.labelEls.get(n.id);
      if (!el) { el = document.createElement('div'); this.labels.appendChild(el); this.labelEls.set(n.id, el); }
      el.className = n.id.startsWith('c_') ? '' : 'key';
      const goal = n.legs.length ? (n.override?.act ?? n.pendingAct) : n.act;
      const it = n.id.startsWith('c_') && goal ? t('intent.' + goal) : '';
      el.textContent = npcName(n.id) + (it && !it.startsWith('intent.') ? ' · ' + it : ''); el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`; seen.add(n.id);
    }
    for (const [id, el] of this.labelEls) if (!seen.has(id)) { el.remove(); this.labelEls.delete(id); }
  }
}
