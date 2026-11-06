import { TRAM_TRIPS, NODES, OBJS, TICK, TIMES, edgeKey, findPath, hm, nearestNode, dist2d, T1 } from './map';
import { P } from './params';
import { hrand } from './rng';
import { Iv, Item, Npc, World, buyItem, emit, giveNpc, hasFact, itemPos, jit, learn, moveItem, noiseRadius, npcHas, rainMask } from './core';
import { applyDialog, applyInspect } from './dialog';
import { brains } from './npcs';
import { stepSystems } from './systems';

const TRIPS = TRAM_TRIPS;

function mkNpc(id: string, node: string, speed: number, ox = 0, oz = 0, face = 0): Npc {
  const n = NODES[node];
  return { id, x: n.x + ox, z: n.z + oz, node, floor: n.floor ?? 0, face, route: [], speed, task: null, ph: '', m: { ox, oz }, inv: [], inTram: false, hurt: 0, safe: false, mood: 'calm', seed: 0 };
}

export interface CarryIn { kind: string; double: boolean; origVanishT: number }
export interface WorldOpts { facts?: string[]; sealed?: boolean; carry?: CarryIn | null }

export function createWorld(seed: number, opts: WorldOpts = {}): World {
  const npcs: Record<string, Npc> = {};
  const add = (n: Npc) => { n.seed = Math.floor(hrand(seed, n.id) * 1e6); npcs[n.id] = n; return n; };
  add(mkNpc('ignat', 'ignat_post', 1.3, 0, 0, -Math.PI / 2));
  add(mkNpc('matvey', 'tav_table', P.matveySpeed, -1.2, 1.2, 0.5));
  add(mkNpc('orven', 'bur_in', 1.1, 0, 0, 0));
  add(mkNpc('boris', 'quay', 0.3));
  add(mkNpc('luka', 'stop_pl', 1.0, 1.5, 0.8));
  add(mkNpc('foma', 'tav_table', 0.8, 0.6, -0.5, 2.5));
  add(mkNpc('tilda', 'tilda_in', 1.0, 0, 0, 1.0));
  add(mkNpc('agata', 'kit', 0.9, 0.5, -0.3, 3.1));
  add(mkNpc('mira', 'kiosk', 1.0, 0, 0.6, 3.0));
  add(mkNpc('pip', 'board', 1.0, 0, 1.2, 0));
  add(mkNpc('zoya', 'zoya_bench', 0.5, 0, 0, 1.0));
  add(mkNpc('klara', 'stage', 1.0, 0, 0, 3.1));
  add(mkNpc('cat', 'tav_hearth', 0.8, 1.0, 0.3));
  add(mkNpc('pug', 'quay', 0.3));
  add(mkNpc('fox', 'alley1', 0.6, -6, -6));
  const items: Record<string, Item> = {
    pass: { id: 'pass', kind: 'pass', loc: { k: 'node', id: 'stop_pl' }, owner: 'tilda', shiny: true },
    key: { id: 'key', kind: 'key', loc: { k: 'npc', id: 'ignat' }, owner: 'ignat' },
    bundle: { id: 'bundle', kind: 'bundle', loc: { k: 'npc', id: 'tilda' }, owner: 'tilda' },
    flag: { id: 'flag', kind: 'flag', loc: { k: 'npc', id: 'tilda' }, owner: 'tilda' },
    coinstack: { id: 'coinstack', kind: 'coinstack', loc: { k: 'npc', id: 'pip' }, shiny: true },
    decor_key: { id: 'decor_key', kind: 'decor_key', loc: { k: 'chest' }, shiny: true },
    keyring: { id: 'keyring', kind: 'keyring', loc: { k: 'node', id: 'booth' } },
  };
  npcs.ignat.inv.push('key'); npcs.tilda.inv.push('bundle', 'flag'); npcs.pip.inv.push('coinstack');
  const w: World = {
    t: 0, tick: 0, seed, npcs, items,
    player: { x: 0, z: -27, floor: 2, st: 0, hands: null, pocket: null, facts: [...(opts.facts ?? [])].sort(), trust: {}, escort: null, spotted: 0, onTram: false },
    v: 0, w: 0, P: 1.0, tavValve: 1, tavLocked: false, ks1Open: false, ks1Locked: true,
    kitWindow: false, hood: true, stove: true, hearth: true, rugMoved: false, frontDoor: 'open',
    gas: { S: 0, K: 0, H: 0, leakOn: false, thresholdEv: false },
    fire: { zones: {}, since: -1, started: false, ignitedAt: -1, alarm: false, source: '' },
    tram: { x: NODES.stop_pl.x, at: 'stop_pl', state: 'wait', to: 'stop_pr', from: 'stop_pl', trip: 0, departT: TRIPS[0].t, pax: [], denied: {} },
    dock: { x: 110, z: 30, state: 'far', decidedAt: -1, barrels: 0 },
    sem: { closed: false, raisedAt: -1 }, towerOpen: true, kioskOpen: true, lampsLit: 0, lampsDone: false, flicker: false,
    blocked: [], events: [], tail: {}, flags: {}, sealed: opts.sealed ?? P.sealedFirstJump, alarm: false, evac: false, newsId: 'news.prep',
  };
  // стартовые события-корни
  emit(w, 'WAIT_FLAG', ['orven']);
  // перенос предмета (двойник)
  if (opts.carry) {
    const c = opts.carry;
    const orig = Object.values(items).find((i) => i.kind === c.kind);
    const id = 'dbl_' + c.kind;
    const fungible = c.kind === 'coinstack' || c.kind === 'ticket' || c.kind === 'mug';
    items[id] = { id, kind: c.kind, loc: { k: 'player' }, double: true, real: fungible || !orig, origVanishT: c.origVanishT, owner: orig?.owner, shiny: orig?.shiny };
    w.player.hands = id;
  }
  return w;
}

// ---------- применение вмешательств игрока ----------
const KEYKIND = 'key';
const holdsKey = (w: World) => { const h = w.player.hands && w.items[w.player.hands]; return !!h && h.kind === KEYKIND; };
const near = (w: World, objId: string) => {
  const o = OBJS[objId]; if (!o) return false;
  const pf = w.player.floor;
  const of = o.floor ?? 0;
  return dist2d(w.player.x, w.player.z, o.x, o.z) <= o.r + 0.6 && (pf === of || Math.abs(pf - of) < 1);
};

export function applyIv(w: World, iv: Iv): void {
  const p = w.player;
  switch (iv.k) {
    case 'move': p.x = iv.x; p.z = iv.z; p.floor = iv.floor ?? p.floor; p.st = iv.st ?? p.st; return;
    case 'take': {
      const it = w.items[iv.item]; if (!it || p.hands) return;
      const pos = itemPos(w, it); if (!pos || it.loc.k === 'npc' || it.loc.k === 'player') return;
      if (dist2d(pos.x, pos.z, p.x, p.z) > 3.2 || Math.abs(pos.floor - p.floor) > 0.5) return;
      if (it.kind === 'coinstack' && it.loc.k === 'chest' && w.t < TIMES.pipStash) return;
      it.loc = { k: 'player' }; p.hands = it.id; if (it.takenAt === undefined) it.takenAt = w.t;
      emit(w, 'PICKUP', ['player', 'item:' + it.id], ['item:' + it.id], { item: it.id }, ['item:' + it.id]);
      if (it.id === 'key') { w.flags.keyTakenAt = w.t; }
      return;
    }
    case 'drop': {
      if (!p.hands) return; const it = w.items[p.hands];
      const nn = nearestNode(p.x, p.z, Math.round(p.floor));
      it.loc = { k: 'node', id: nn }; p.hands = null;
      emit(w, 'DROP', ['player', 'item:' + it.id], [], { item: it.id }, ['item:' + it.id]); return;
    }
    case 'give': {
      const n = w.npcs[iv.npc]; if (!n || !p.hands) return;
      if (dist2d(n.x, n.z, p.x, p.z) > 4) return;
      const it = w.items[p.hands];
      if (it.double && !it.real) { emit(w, 'GIVE_REFUSED', ['player', iv.npc], [], { item: it.id }); return; }
      p.hands = null; giveNpc(w, it.id, iv.npc);
      emit(w, 'GIVE', ['player', iv.npc, 'item:' + it.id], [], { item: it.id }, ['item:' + it.id]);
      if (it.kind === 'key' && iv.npc === 'ignat') { n.ph = 'post'; w.flags.keyMissing = false; }
      return;
    }
    case 'buy': {
      if (iv.what === 'ticket' && (!near(w, 'kiosk') || !w.kioskOpen)) return;
      if (iv.what === 'mug' && !near(w, 'bar')) return;
      buyItem(w, iv.what); return;
    }
    case 'escort': {
      const n = w.npcs[iv.npc]; if (!n) return;
      if (iv.on && dist2d(n.x, n.z, p.x, p.z) < 3 && (iv.npc === 'pip')) { p.escort = iv.npc; n.m.escort = true; n.task = null; emit(w, 'ESCORT_START', ['player', iv.npc]); }
      else if (!iv.on) { p.escort = null; n.m.escort = false; emit(w, 'ESCORT_END', ['player', iv.npc]); }
      return;
    }
    case 'say': applyDialog(w, iv.npc, iv.node, iv.choice); return;
    case 'inspect': applyInspect(w, iv.obj); return;
    case 'use': useObj(w, iv.obj, iv.arg); return;
  }
}

function useObj(w: World, obj: string, arg?: number | string) {
  const p = w.player;
  switch (obj) {
    case 'ks1_door': {
      if (!near(w, 'ks1')) return;
      if (arg === 'unlock' || arg === 'open') {
        if (w.ks1Locked) { if (!holdsKey(w)) return; w.ks1Locked = false; }
        w.ks1Open = true; emit(w, 'CABINET_OPENED', ['player', 'ks1'], [], {}, ['ks1']);
      } else if (arg === 'close') { w.ks1Open = false; emit(w, 'CABINET_CLOSED', ['player', 'ks1'], [], {}, ['ks1']); }
      else if (arg === 'lock') { if (!holdsKey(w)) return; w.ks1Open = false; w.ks1Locked = true; emit(w, 'CABINET_LOCKED', ['player', 'ks1'], [], {}, ['ks1']); }
      return;
    }
    case 'ks1_supply': case 'ks1_bleed': {
      if (!near(w, 'ks1') || !w.ks1Open || !hasFact(w, 'K3')) return;
      const val = Math.max(0, Math.min(1, Number(arg)));
      if (obj === 'ks1_supply') { w.v = val; emit(w, 'VALVE_SET', ['player', 'valve:supply'], ['valve:supply'], { v: val }, ['valve:supply']); }
      else { w.w = val; emit(w, 'VALVE_SET', ['player', 'valve:bleed'], ['valve:bleed'], { w: val }, ['valve:bleed']); }
      learn(w, 'K3'); return;
    }
    case 'tav_valve': {
      if (!near(w, 'tav_valve') || !hasFact(w, 'K9')) return;
      const val = Number(arg) > 0.5 ? 1 : 0;
      if (val === 1 && w.tavLocked) return;
      w.tavValve = val; emit(w, 'TAV_VALVE', ['player', 'valve:tavern'], [], { v: val }, ['valve:tavern']);
      return;
    }
    case 'tav_valve_lock': { if (!near(w, 'tav_valve') || !holdsKey(w)) return; w.tavLocked = Number(arg) > 0; emit(w, 'TAV_VALVE_LOCK', ['player', 'valve:tavern'], [], { l: w.tavLocked ? 1 : 0 }, ['valve:tavern']); return; }
    case 'kit_window': { if (!near(w, 'kit_window')) return; w.kitWindow = Number(arg) > 0; emit(w, 'WINDOW', ['player', 'kit_window'], [], { open: w.kitWindow ? 1 : 0 }); return; }
    case 'hood': { if (!near(w, 'kit_joint')) return; w.hood = Number(arg) > 0; return; }
    case 'rug': { if (!near(w, 'rug')) return; w.rugMoved = true; emit(w, 'RUG_MOVED', ['player'], []); return; }
    case 'hearth': { if (!near(w, 'hearth')) return; w.hearth = Number(arg) > 0; emit(w, 'HEARTH', ['player', 'hearth'], [], { on: w.hearth ? 1 : 0 }); return; }
    case 'stove': { if (!near(w, 'kit_joint')) return; w.stove = Number(arg) > 0; emit(w, 'STOVE', ['player', 'stove'], [], { on: w.stove ? 1 : 0 }); return; }
    case 'tram': {
      const tr = w.tram;
      if (tr.state !== 'wait' || !tr.at || dist2d(p.x, p.z, NODES[tr.at].x, NODES[tr.at].z) > 6) return;
      const h = p.hands && w.items[p.hands];
      if (h && h.kind === 'ticket') { p.onTram = true; tr.pax.push('player'); emit(w, 'BOARD_OK', ['player', 'luka', 'tram'], []); }
      else emit(w, 'BOARD_DENIED', ['player', 'luka', 'tram'], []);
      return;
    }
    case 'tram_exit': { if (p.onTram) { p.onTram = false; w.tram.pax = w.tram.pax.filter((x) => x !== 'player'); } return; }
  }
}

// ---------- шаг мира ----------
function stepNpc(w: World, n: Npc, dt: number) {
  if (n.inTram) { n.x = w.tram.x; n.z = 17.6; n.floor = 0; return; }
  if (n.m.escort) {
    const p = w.player; const d = dist2d(n.x, n.z, p.x, p.z);
    if (d > 1.4) { const k = Math.min(1.0 * dt, d - 1.2) / d; n.x += (p.x - n.x) * k; n.z += (p.z - n.z) * k; n.face = Math.atan2(p.x - n.x, p.z - n.z); }
    n.floor = p.floor; return;
  }
  const tk = n.task;
  if (!tk) return;
  if (tk.k === 'walk') {
    if (!n.route.length) { n.task = null; const dn = NODES[n.node]; n.x = dn.x + (Number(n.m.ox) || 0); n.z = dn.z + (Number(n.m.oz) || 0); n.floor = dn.floor ?? 0; return; }
    // перекрытое ребро → перепланирование (общее правило)
    const blk = new Set(w.blocked);
    if (blk.has(edgeKey(n.node, n.route[0]))) {
      const p = findPath(n.node, tk.to, blk);
      emit(w, 'PATH_REPLANNED', [n.id], ['obstacle', n.id], { to: tk.to });
      if (!p) { n.task = { k: 'wait', until: w.t + 5 }; n.route = []; return; }
      n.route = p.path.slice(1); return;
    }
    const tgt = NODES[n.route[0]];
    const dx = tgt.x - n.x, dz = tgt.z - n.z, d = Math.hypot(dx, dz);
    let sp = n.speed;
    const step = sp * dt;
    if (d <= step) { n.x = tgt.x; n.z = tgt.z; n.node = n.route.shift()!; n.floor = tgt.floor ?? 0; }
    else { n.x += (dx / d) * step; n.z += (dz / d) * step; n.floor = tgt.floor ?? n.floor; }
    if (d > 1e-6) n.face = Math.atan2(dx, dz);
    if (n.m.heavy) {
      n.m.stam = Number(n.m.stam ?? P.tildaStamina) - Math.min(step, d);
      if (Number(n.m.stam) <= 0 && !n.m.hurry) {
        n.m.rt = tk.to; n.route = [];
        n.task = { k: 'act', what: 'rest', until: w.t + P.tildaRest };
        emit(w, 'REST', [n.id], [n.id], {}, ['item:flag']);
      }
    }
    return;
  }
  if (w.t >= tk.until) {
    const what = tk.k === 'act' ? tk.what : '';
    n.task = null;
    if (what === 'rest') { n.m.stam = P.tildaStamina; const to = String(n.m.rt); const p = findPath(n.node, to, new Set(w.blocked)); if (p) { n.route = p.path.slice(1); n.task = { k: 'walk', to }; } }
    else n.m.just = what;
  }
}

export function step(w: World, ivs: Iv[] = []): void {
  const dt = TICK;
  for (const iv of ivs) applyIv(w, iv);
  // двойники: оригинал исчезает в момент T прошлой ветки
  for (const it of Object.values(w.items)) {
    if (it.double && !it.vanished && it.origVanishT !== undefined && w.t >= it.origVanishT) {
      const orig = Object.values(w.items).find((o) => o.kind === it.kind && !o.double && o.loc.k !== 'gone' && o.loc.k !== 'player');
      if (orig) {
        const oldLoc = orig.loc;
        if (oldLoc.k === 'npc') { const o = w.npcs[oldLoc.id]; o.inv = o.inv.filter((x) => x !== orig.id); }
        orig.loc = { k: 'gone' };
        emit(w, 'ORIGINAL_VANISHED', [it.kind === 'key' ? 'ignat' : 'pip', 'item:' + orig.id], [], { item: orig.id }, ['item:' + orig.id]);
        w.flags.vanished = true;
      }
      it.vanished = true; it.real = true;
    }
  }
  for (const id of Object.keys(w.npcs)) {
    const n = w.npcs[id];
    stepNpc(w, n, dt);
    if (!n.task && !n.inTram && !n.m.escort) { const b = brains[id]; if (b) b(w, n); }
  }
  stepSystems(w, dt);
  w.t += dt; w.tick++;
}

export function runTo(w: World, tEnd: number, ivs: Iv[] = [], from = 0): number {
  let i = from;
  while (w.t < tEnd - 1e-9) {
    const batch: Iv[] = [];
    while (i < ivs.length && ivs[i].t <= w.t + 1e-9) batch.push(ivs[i++]);
    step(w, batch);
  }
  return i;
}
export const clockStr = (w: World) => w.t;
export { T1, hasFact, hm, moveItem, npcHas, jit, noiseRadius, rainMask };
