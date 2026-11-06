import type { Ev, Iv, IvInput, Leg, Loc, Npc, NpcDef, Override, Vec, World, WorldDef } from './types';
import { dist, hm, hashState, hrand } from './util';
import { BEHAVIORS } from './behaviors';
import { gridPath, WALK_OFF } from './grid';
import { ACTIONS, raiseAlarm } from './actions';

export const ANCHORED = new Set(['lash_bio']);
const WALK = 1.4, CAR = 9;

export class Sim {
  world!: World;
  events: Ev[] = [];
  ivs: Iv[] = [];
  facts = new Map<string, string>(); // player knowledge: lives outside snapshots, survives jumps
  vanish: { item: string; t: number; loc?: string; npc?: string }[] = [];
  snaps = new Map<number, { world: World; evCount: number }>();
  hashes = new Map<number, string>();
  locs: Record<string, Loc> = {};
  defs: Record<string, NpcDef> = {};
  sched: Record<string, { t: number; loc: string; act: string }[]> = {};
  fixed: { t: number; type: string; npc?: string; item?: string; loc: string }[];
  readonly t0: number; readonly t1: number;

  constructor(public def: WorldDef, locs: Loc[], public seed = 1) {
    for (const l of locs) this.locs[l.id] = l;
    this.t0 = hm(def.start); this.t1 = hm(def.end);
    this.fixed = def.events.map(e => ({ ...e, t: hm(e.t) }));
    for (const n of def.npcs) {
      this.defs[n.id] = n;
      this.sched[n.id] = n.sched.map(([t, loc, act]) => ({ t: hm(t), loc, act }));
    }
    this.reset();
  }

  reset() {
    const npcs: Record<string, Npc> = {};
    for (const d of this.def.npcs) {
      const p = this.spot(d.id, d.loc);
      npcs[d.id] = { id: d.id, pos: { x: p.x, y: p.y }, loc: d.loc, legs: [], dest: null, pendingAct: '', act: this.sched[d.id][0].act,
        taskIdx: 0, items: [...(d.items ?? [])], stress: d.stress ?? 0.1, override: null, lastArrive: -1, lastEv: -1, flags: {} };
    }
    this.world = {
      t: this.t0, npcs, ground: [], rain: false,
      feeders: { tunnel: true, clinic: true, lights: true, tower: true, depot: true },
      lockoutUntil: 0, stableSince: -1e9, clinicPower: 'grid', clinicGenUntil: 0,
      mara: 'stable', maraEv: -1, blackoutEv: -1, docsShown: false, launch: 'pending', bridgeNorm: false, route: '',
      driver: '', targetDead: false,
      pinv: ['pistol'], money: 250, flags: {}, alarm: false, alarmEv: -1, shot: 'none', door: false, winStart: 0, winEnd: 0, stage: 0, tramStall: -1,
    };
    for (const g of this.def.ground ?? []) this.world.ground.push({ item: g.item, loc: g.loc, since: 0 });
    for (const d of this.def.npcs) if (d.life?.sick) npcs[d.id].flags.sick = true;
    this.ids = Object.keys(npcs); this.hereT = -1;
    this.events = []; this.ivs = []; this.snaps.clear(); this.hashes.clear();
    this.snapshot();
  }

  // ---------- events ----------
  emit(type: string, loc: string, actors: string[], causes: number[] = [], tags: string[] = [], data?: Record<string, unknown>): number {
    const id = this.events.length;
    this.events.push({ id, t: this.world.t, type, loc, actors, causes: [...new Set(causes.filter(c => c >= 0))], tags, data });
    if (tags.includes('fact') && data?.fact) this.facts.set(String(data.fact), String(data.value));
    for (const a of actors) { const n = this.world.npcs[a]; if (n) n.lastEv = id; }
    return id;
  }

  // ---------- queries ----------
  private hereT = -1; private hereMap = new Map<string, Npc[]>(); ids: string[] = [];
  here(loc: string): Npc[] {
    if (this.hereT !== this.world.t) {
      this.hereT = this.world.t; this.hereMap.clear();
      for (const id of this.ids) { const n = this.world.npcs[id]; if (n.loc) { const l = this.hereMap.get(n.loc); if (l) l.push(n); else this.hereMap.set(n.loc, [n]); } }
    }
    return this.hereMap.get(loc) ?? [];
  }
  posOf(l: string): Vec { const p = this.locs[l]; return { x: p.x, y: p.y }; }
  /** stable per-NPC standing spot around a location, so people do not stack on one point */
  spot(id: string, l: string): Vec {
    const p = this.locs[l], R: Record<string, number> = { market: 15, hive: 22, bar: 5, depot: 12, school: 9, substation: 8, clinic: 7, garage: 7, tower: 6, street: 8, bridge: 10, dispatch: 6, tunnel: 10, taxi: 6 };
    const R2: Record<string, number> = { home: 2, office: 3, cafe: 3.5 };
    const r = (R2[p.kind] ?? R[p.kind] ?? 4) * Math.sqrt(hrand(this.seed, id, l, 'r')), a = hrand(this.seed, id, l, 'a') * Math.PI * 2;
    let x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
    // never stand on the carriageway: push onto the nearest sidewalk
    const rx = Math.round(x / 100) * 100, ry = Math.round(y / 100) * 100;
    if (Math.abs(x - rx) < 10 && Math.abs(y - ry) >= 10) x = rx + (x >= rx ? 10.8 : -10.8);
    else if (Math.abs(y - ry) < 10 && Math.abs(x - rx) >= 10) y = ry + (y >= ry ? 10.8 : -10.8);
    else if (Math.abs(x - rx) < 10 && Math.abs(y - ry) < 10) { x = rx + (x >= rx ? 10.8 : -10.8); y = ry + (y >= ry ? 10.8 : -10.8); }
    return { x, y };
  }
  curTask(id: string) { const s = this.sched[id]; return s[this.world.npcs[id].taskIdx]; }

  // ---------- routing ----------
  tramArrival(k: number, notBefore: number): number {
    const tr = this.def.tram, first = hm(tr.first);
    let cum = 0;
    for (let i = 1; i <= k; i++) cum += dist(this.posOf(tr.stops[i - 1]), this.posOf(tr.stops[i]));
    const off = cum / tr.speed + k * tr.dwell;
    const n = Math.max(0, Math.ceil((notBefore - first - off) / tr.headway));
    return first + n * tr.headway + off;
  }
  addVanish(v: { item: string; t: number; loc?: string; npc?: string }) {
    if (!this.vanish.some(x => x.item === v.item && x.t === v.t && x.loc === v.loc && x.npc === v.npc)) this.vanish.push(v);
  }
  tramPos(n: number, t: number): Vec | null {
    const tr = this.def.tram, dep = hm(tr.first) + n * tr.headway;
    if (n === this.world.tramStall) { const st = this.world.flags.stallStart as number; if (t >= st) t = t < st + 1200 ? st : t - 1200; }
    if (t < dep) return null;
    let cum = 0, tt = dep;
    for (let i = 1; i < tr.stops.length; i++) {
      const a = this.posOf(tr.stops[i - 1]), b = this.posOf(tr.stops[i]), d = dist(a, b), tm = d / tr.speed;
      if (t <= tt + tm) { const f = (t - tt) / tm; return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; }
      tt += tm + tr.dwell; cum += d;
    }
    return null;
  }

  plan(npc: Npc, dest: string): Leg[] {
    const now = this.world.t, dp = this.spot(npc.id, dest), sp = npc.pos, def = this.defs[npc.id];
    const wspeed = WALK * (this.world.rain ? 0.92 : 1);
    const walkLegs = (a: Vec, b: Vec, t: number, speed = wspeed, mode: Leg['mode'] = 'walk', off = WALK_OFF): Leg[] => {
      const pts = gridPath(a, b, off), out: Leg[] = []; let tt = t;
      for (let i = 1; i < pts.length; i++) { const d = dist(pts[i - 1], pts[i]); out.push({ from: pts[i - 1], to: pts[i], t0: tt, t1: tt + d / speed, mode }); tt += d / speed; }
      if (!out.length) out.push({ from: a, to: b, t0: t, t1: t + 1, mode });
      return out;
    };
    const end = (l: Leg[]) => l[l.length - 1].t1;
    let best: Leg[] = walkLegs(sp, dp, now);
    if (def.car) {
      const slow = this.world.feeders.lights ? 1 : 1.6;
      const c = walkLegs(sp, dp, now + 30, CAR / slow, 'car', 4);
      if (end(c) < end(best)) best = c;
    }
    const canTram = !def.needs || npc.items.includes(def.needs);
    if (canTram) {
      const stops = this.def.tram.stops;
      for (let i = 0; i < stops.length; i++) for (let j = i + 1; j < stops.length; j++) {
        const w1 = walkLegs(sp, this.posOf(stops[i]), now);
        const board = this.tramArrival(i, end(w1));
        const alight = this.tramArrival(j, board + 1);
        const w2 = walkLegs(this.posOf(stops[j]), dp, alight);
        if (end(w2) < end(best)) {
          best = [...w1, { from: this.posOf(stops[i]), to: this.posOf(stops[i]), t0: end(w1), t1: board, mode: 'walk' },
            { from: this.posOf(stops[i]), to: this.posOf(stops[j]), t0: board, t1: alight, mode: 'tram' }, ...w2];
        }
      }
    }
    return best;
  }

  goTo(npc: Npc, loc: string, act: string, causes: number[] = []) {
    if (npc.loc === loc && !npc.legs.length) { npc.act = act; npc.dest = null; return; }
    if (npc.dest === loc) { npc.pendingAct = act; return; }
    npc.legs = this.plan(npc, loc);
    const from = npc.loc ?? 'street';
    npc.dest = loc; npc.pendingAct = act;
    const wasAt = npc.loc; npc.loc = null;
    if (wasAt) this.emit('depart', wasAt, [npc.id], causes.length ? causes : [npc.lastEv], [], { to: loc });
    else void from;
  }

  setOverride(npc: Npc, loc: string, act: string, until: number, causes: number[]) {
    npc.override = { loc, act, until } as Override;
    this.goTo(npc, loc, act, causes);
  }

  // ---------- stepping ----------
  private moveNpc(n: Npc) {
    if (!n.legs.length) return;
    const t = this.world.t;
    const last = n.legs[n.legs.length - 1];
    if (t >= last.t1) {
      n.pos = { ...last.to }; n.legs = []; n.loc = n.dest; n.act = n.pendingAct; n.dest = null;
      n.lastArrive = this.emit('arrive', n.loc!, [n.id], [n.lastEv]);
      const w = this.world;
      if (n.loc === 'garage' && t >= hm('19:00') && !w.flags.password && this.defs[n.id].car && n.id !== 'convoy') {
        w.flags.firstCar = n.id; w.flags.password = 10 + Math.floor(hrand(this.seed, 'spot', n.id) * 89);
      }
      return;
    }
    for (const l of n.legs) if (t >= l.t0 && t < l.t1) {
      const f = l.t1 > l.t0 ? (t - l.t0) / (l.t1 - l.t0) : 1;
      n.pos = { x: l.from.x + (l.to.x - l.from.x) * f, y: l.from.y + (l.to.y - l.from.y) * f };
      break;
    }
  }

  private applyIv(iv: Iv) {
    const w = this.world;
    if (iv.type === 'give') {
      const n = w.npcs[iv.to]; const i = w.pinv.indexOf(iv.item); if (i < 0) return;
      w.pinv.splice(i, 1); n.items.push(iv.item.replace('*', ''));
      this.emit('player_give', n.loc ?? 'street', [iv.to], [], ['player'], { item: iv.item.replace('*', '') });
    } else if (iv.type === 'take') {
      const i = w.ground.findIndex(g => g.item === iv.item && g.loc === iv.loc);
      if (i >= 0) { w.ground.splice(i, 1); w.pinv.push(iv.item); }
      this.emit('player_take', iv.loc, [], [], ['player'], { item: iv.item });
    } else if (iv.type === 'bridge_norm') {
      w.bridgeNorm = true; this.emit('player_bridge_norm', 'bridge', [], [], ['player']);
    } else if (iv.type === 'shoot') {
      const n = w.npcs[iv.npc]; if (!n || n.flags.down || n.flags.dead) return;
      n.flags.dead = true; n.flags.down = true; n.legs = []; n.override = { loc: n.loc ?? 'street', act: 'dead', until: 1e9 }; n.act = 'dead';
      const e = this.emit('npc_shot', n.loc ?? 'street', [iv.npc], [], ['player', 'story'], { weapon: iv.weapon });
      if (iv.npc === 'lash') { w.targetDead = true; w.shot = 'killed'; }
      const loud = iv.weapon !== 'pistol';
      const wit = Object.values(w.npcs).filter(o => o.id !== iv.npc && !o.flags.down && Math.hypot(o.pos.x - n.pos.x, o.pos.y - n.pos.y) < (loud ? 120 : 35));
      if (loud || wit.length) { const sf = this.emit('shot_fired', n.loc ?? 'street', wit.slice(0, 3).map(o => o.id), [e], ['story']); raiseAlarm(this, 'shot', n.loc ?? 'street', [sf]); }
    } else if (iv.type === 'buy') {
      if (w.money < iv.price) return;
      w.money -= iv.price; w.pinv.push(iv.item); this.emit('player_buy', iv.shop, [], [], ['player'], { item: iv.item, price: iv.price });
    } else if (iv.type === 'sell') {
      const i = w.pinv.indexOf(iv.item); if (i < 0) return;
      w.pinv.splice(i, 1); w.money += iv.price; this.emit('player_sell', iv.shop, [], [], ['player'], { item: iv.item, price: iv.price });
    } else if (iv.type === 'delay') {
      const n = w.npcs[iv.npc];
      if (n.legs.length) for (const l of n.legs) { if (l.t0 > w.t) l.t0 += iv.seconds; l.t1 += iv.seconds; }
      this.emit('player_delay', n.loc ?? 'street', [iv.npc], [], ['player'], { seconds: iv.seconds });
    } else if (iv.type === 'act') {
      const a = ACTIONS[iv.id]; if (!a) return;
      if (iv.ok === undefined) iv.ok = this.canAct(iv.id);
      if (iv.ok) a.run(this); else this.emit('act_failed', a.loc, [], [], ['player'], { id: iv.id });
    } else if (iv.type === 'fake_call') {
      const n = w.npcs[iv.to]; n.flags.call = iv.instruction;
      n.flags.callEv = this.emit('fake_call', n.loc ?? 'street', [iv.to], [], ['player'], { instruction: iv.instruction });
    }
  }

  private applyFixed(f: { type: string; npc?: string; item?: string; loc: string }) {
    const w = this.world;
    if (f.type === 'drop_item') {
      const n = w.npcs[f.npc!]; const i = n.items.indexOf(f.item!);
      if (i >= 0) { n.items.splice(i, 1); w.ground.push({ item: f.item!, loc: f.loc, since: w.t }); }
      this.emit('item_dropped', f.loc, [n.id], [], [], { item: f.item });
    } else if (f.type === 'spawn_item') { w.ground.push({ item: f.item!, loc: f.loc, since: w.t }); this.emit('item_appeared', f.loc, [], [], [], { item: f.item });
    } else if (f.type === 'rain_starts') { w.rain = true; this.emit(f.type, f.loc, []); }
    else this.emit(f.type, f.loc, []);
  }

  step() {
    const w = this.world; w.t++;
    for (const f of this.fixed) if (f.t === w.t) this.applyFixed(f);
    for (const iv of this.ivs) if (iv.t === w.t) this.applyIv(iv);
    for (const v of this.vanish) if (v.t === w.t) {
      if (v.loc) {
        const g = w.ground.findIndex(x => x.item === v.item && x.loc === v.loc);
        if (g >= 0) { w.ground.splice(g, 1); this.emit('item_vanished', v.loc, [], [], [], { item: v.item }); }
      } else if (v.npc) {
        const n = w.npcs[v.npc], i = n.items.indexOf(v.item);
        if (i >= 0) { n.items.splice(i, 1); this.emit('item_vanished', n.loc ?? 'street', [n.id], [], [], { item: v.item }); }
      }
    }
    for (const id of this.ids) {
      const n = w.npcs[id], s = this.sched[id];
      this.moveNpc(n);
      while (n.taskIdx + 1 < s.length && s[n.taskIdx + 1].t <= w.t) {
        n.taskIdx++;
        if (!n.override) this.goTo(n, s[n.taskIdx].loc, s[n.taskIdx].act);
      }
      if (n.override && n.override.until <= w.t) { n.override = null; const c = s[n.taskIdx]; this.goTo(n, c.loc, c.act); }
    }
    this.hereT = -1;
    for (const id of this.ids) { const bs = this.defs[id].behaviors; if (bs) for (const b of bs) BEHAVIORS[b]?.(this, w.npcs[id]); }
    BEHAVIORS.world(this);
    if (w.t % 60 === 0) this.snapshot();
  }

  snapshot() {
    this.snaps.set(this.world.t, { world: structuredClone(this.world), evCount: this.events.length });
    this.hashes.set(this.world.t, hashState(this.world));
  }

  advanceTo(t: number) { while (this.world.t < t) this.step(); }

  /** Rewind to t: restore snapshot, erase later branch (interventions, events). Traveller-item vanishings survive. */
  jumpBack(t: number) {
    t = Math.max(this.t0, t);
    const s = Math.floor((t - this.t0) / 60) * 60 + this.t0;
    const sn = this.snaps.get(s)!;
    this.world = structuredClone(sn.world); this.hereT = -1;
    this.events.length = sn.evCount;
    this.ivs = this.ivs.filter(i => i.t <= t);
    for (const k of [...this.snaps.keys()]) if (k > s) { this.snaps.delete(k); this.hashes.delete(k); }
    this.advanceTo(t);
  }

  vanishFor(item: string): number | null { return this.vanish.find(v => v.item === item)?.t ?? null; }
  has(item: string) { return this.world.pinv.some(x => x.replace('*', '') === item); }
  canAct(id: string, withFacts = true): boolean {
    const a = ACTIONS[id], w = this.world; if (!a) return false;
    if (a.from && w.t < hm(a.from)) return false;
    if (a.to && w.t > hm(a.to)) return false;
    for (const it of a.items ?? []) if (!this.has(it)) return false;
    if (withFacts) for (const f of a.facts ?? []) if (!this.facts.has(f)) return false;
    return a.can ? a.can(this) : true;
  }
  /** a traveller copy of this item already exists in the world -> the Window refuses to carry another */
  doubleExists(item: string): boolean {
    const w = this.world, star = item + '*';
    return w.pinv.includes(star) || w.ground.some(g => g.item === star) || Object.values(w.npcs).some(n => n.items.includes(star));
  }
  /** Jump back; optionally carry one pinv item through time (becomes a starred traveller copy). Returns false if refused. */
  travelBack(t: number, carry?: string): boolean {
    let c: string | undefined;
    if (carry) {
      const base = carry.replace('*', '');
      if (ANCHORED.has(base) || this.doubleExists(base)) return false;
      if (!this.world.pinv.includes(carry)) return false;
      c = base + '*';
    }
    this.jumpBack(t);
    if (c) this.world.pinv.push(c);
    return true;
  }
  addIv(iv: IvInput) { this.ivs.push({ ...iv, t: iv.t ?? this.world.t + 1 } as Iv); }
}
