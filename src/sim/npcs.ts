import { NODES, TIMES, dist2d, findPath, hm } from './map';
import { P } from './params';
import { Npc, World, emit, giveNpc, itemPos, jit, moveItem, npcHas } from './core';
import { boardingOpen, tavernZone } from './systems';

type Brain = (w: World, n: Npc) => void;

function walk(w: World, n: Npc, to: string, ox = 0, oz = 0): boolean {
  n.m.ox = ox; n.m.oz = oz;
  if (n.node === to) { n.task = { k: 'wait', until: w.t + 0.5 }; n.x = NODES[to].x + ox; n.z = NODES[to].z + oz; return true; }
  const p = findPath(n.node, to, new Set(w.blocked));
  if (!p) { n.task = { k: 'wait', until: w.t + 5 }; return false; }
  if (w.blocked.length) { // общее правило: маршрут перестроен из-за препятствия
    const free = findPath(n.node, to);
    if (free && p.len > free.len + 1) emit(w, 'PATH_REPLANNED', [n.id], ['obstacle', n.id], { extra: Math.round(p.len - free.len) });
  }
  n.route = p.path.slice(1); n.task = { k: 'walk', to }; return true;
}
const waitFor = (w: World, n: Npc, secs: number) => { n.task = { k: 'wait', until: w.t + secs }; };
const waitUntil = (w: World, n: Npc, t: number) => { n.task = { k: 'wait', until: Math.max(t, w.t + 0.5) }; };
const act = (w: World, n: Npc, what: string, secs: number) => { n.task = { k: 'act', what, until: w.t + secs }; };
const pathLen = (w: World, a: string, b: string) => findPath(a, b, new Set(w.blocked))?.len ?? 0;
const ARRIVED = (n: Npc, node: string) => n.node === node && !n.route.length;

/** Эвакуация: все, кто в таверне, идут к выходу (общий протокол §8.7). */
function evacuate(w: World, n: Npc): boolean {
  if (!w.alarm) return false;
  if (!tavernZone(n.node) && !n.m.fleeing) return false;
  if (n.m.escort) return false;
  if (n.ph === 'fled') { waitFor(w, n, 5); return true; }
  if (n.ph !== 'fleeing') { n.ph = 'fleeing'; n.m.fleeing = true; walk(w, n, 'tav_door', 1.5, (n.seed % 7) / 5 - 0.6); emit(w, 'EVACUATE', [n.id], ['fire', 'gas']); return true; }
  n.ph = 'fled'; n.safe = true; waitFor(w, n, 5); return true;
}

const staticNpc = (home: string, ox = 0, oz = 0): Brain => (w, n) => {
  if (evacuate(w, n)) return;
  if (!n.ph) { n.ph = 'idle'; walk(w, n, home, ox, oz); return; }
  waitFor(w, n, 3);
};

export const brains: Record<string, Brain> = {
  // ---------- Игнат: страж, ключ ----------
  ignat(w, n) {
    if (!n.ph) { n.ph = 'post'; }
    const hasKey = !!npcHas(w, 'ignat', 'key');
    switch (n.ph) {
      case 'post': {
        if (n.node !== 'ignat_post') { walk(w, n, 'ignat_post', 0, 0); return; }
        n.face = -Math.PI / 2;
        if (w.t >= TIMES.ignatTea - 2 && !n.m.teaDone) { n.ph = 'hang'; act(w, n, 'hang', 4); return; }
        if ((w.flicker || w.flags.ignatAlert) && hasKey && !n.m.fixing && n.m.teaDone !== 2) {
          if (w.flicker || w.ks1Open || w.w > 0) { n.m.fixing = 1; n.ph = 'check'; walk(w, n, 'ks1'); return; }
          w.flags.ignatAlert = false;
        }
        waitFor(w, n, 2); return;
      }
      case 'hang': {
        const k = npcHas(w, 'ignat', 'key');
        if (k) { n.inv = n.inv.filter((x) => x !== k.id); moveItem(w, k.id, { k: 'node', id: 'booth' }); emit(w, 'KEY_HUNG', ['ignat', 'item:key'], [], {}, ['item:key']); }
        n.m.teaDone = 1; n.ph = 'to_tea'; walk(w, n, 'tav_table', 1.6, 0.4); return;
      }
      case 'to_tea': {
        n.ph = 'tea'; waitUntil(w, n, TIMES.ignatBack - pathLen(w, 'tav_table', 'ignat_post') / n.speed - 2); return;
      }
      case 'tea': n.ph = 'back'; walk(w, n, 'ignat_post'); return;
      case 'back': {
        const keyItem = Object.values(w.items).find((i) => i.kind === 'key' && i.loc.k === 'node' && i.loc.id === 'booth');
        if (keyItem) { moveItem(w, keyItem.id, { k: 'npc', id: 'ignat' }); n.inv.push(keyItem.id); n.ph = 'post'; return; }
        if (hasKey) { n.ph = 'post'; return; }
        w.flags.keyMissing = true; emit(w, 'KEY_MISSING', ['ignat', 'item:key'], ['item:key']);
        n.ph = 'panic'; n.m.k = 0; return;
      }
      case 'panic': {
        // ищет ключ: будка ↔ ворота ↔ шкаф
        const spots = ['booth', 'ignat_post', 'gate', 'ks1'];
        n.m.k = (Number(n.m.k) + 1) % spots.length; walk(w, n, spots[Number(n.m.k)]); return;
      }
      case 'check': {
        if (ARRIVED(n, 'ks1')) { n.ph = 'fix'; act(w, n, 'fix', 6); return; }
        walk(w, n, 'ks1'); return;
      }
      case 'fix': {
        if (w.w > 0) { w.w = 0; emit(w, 'VALVE_CLOSED', ['ignat', 'valve:bleed'], ['valve:bleed', 'ignat'], { by: 'ignat' }, ['valve:bleed']); }
        if (w.ks1Open) { w.ks1Open = false; w.ks1Locked = true; emit(w, 'CABINET_LOCKED', ['ignat', 'ks1'], [], {}, ['ks1']); }
        w.flags.ignatAlert = false; n.m.fixing = 0; n.ph = 'post'; return;
      }
    }
  },

  // ---------- Матвей: фонарщик, 3 приёма ----------
  matvey(w, n) {
    if (evacuate(w, n)) return;
    switch (n.ph) {
      case '': n.ph = 'tea'; waitUntil(w, n, TIMES.matveyLeave + jit(w, 'matvey', 6)); return;
      case 'tea': n.ph = 'go'; return;
      case 'go': { n.ph = 'arrive'; walk(w, n, 'ks1', 0.8, 0.8); return; }
      case 'arrive': {
        n.ph = 'key';
        if (n.m.replanned === undefined) n.m.replanned = 0; return;
      }
      case 'key': {
        if (npcHas(w, 'matvey', 'key')) { n.ph = 'unlock'; act(w, n, 'unlock', 20); return; }
        const ig = w.npcs.ignat; const k = npcHas(w, 'ignat', 'key');
        if (k && dist2d(ig.x, ig.z, n.x, n.z) < 10 && ig.ph !== 'fix') { giveNpc(w, k.id, 'matvey'); emit(w, 'KEY_HANDED', ['ignat', 'matvey', 'item:key'], [], {}, ['item:key']); waitFor(w, n, 3); return; }
        if (!w.flags.stuckEv) { w.flags.stuckEv = true; emit(w, 'LAMPS_STUCK', ['matvey'], ['item:key']); }
        waitFor(w, n, 5); return;
      }
      case 'unlock': { w.ks1Locked = false; w.ks1Open = true; n.ph = 'plan'; return; }
      case 'plan': {
        if (n.m.hold) { waitFor(w, n, 4); return; }
        if (w.w > 0) { w.w = 0; emit(w, 'VALVE_CLOSED', ['matvey', 'valve:bleed'], ['valve:bleed', 'matvey'], { by: 'matvey' }, ['valve:bleed']); }
        const need = 20 + 10 + 2 * P.waitStep + 20 + P.lampWalk;
        const compress = w.t + need > P.deadline;
        n.m.steps = compress ? '1' : '0.4,0.7,1'; n.m.si = 0;
        if (compress) emit(w, 'PLAN_COMPRESSED', ['matvey'], ['matvey', 'obstacle'], { late: Math.round(w.t + need - P.deadline) });
        n.ph = 'step'; return;
      }
      case 'step': {
        if (n.m.hold) { waitFor(w, n, 4); return; }
        const steps = String(n.m.steps).split(',').map(Number); const i = Number(n.m.si);
        if (i >= steps.length) { n.ph = 'lock'; act(w, n, 'lock', 15); return; }
        const val = steps[i]; w.v = val; n.m.si = i + 1;
        const spike = val >= 0.99 && steps.length === 1;
        emit(w, spike ? 'PRESSURE_SPIKE' : 'VALVE_OPENED', ['matvey', 'valve:supply'], ['matvey'], { v: val }, ['valve:supply']);
        if (i + 1 < steps.length) waitFor(w, n, P.waitStep); else waitFor(w, n, 10);
        return;
      }
      case 'lock': {
        w.ks1Open = false; w.ks1Locked = true; n.m.lampT0 = w.t; n.ph = 'lamps'; walk(w, n, 'emb_e'); return;
      }
      case 'lamps': {
        const prog = Math.min(1, (w.t - Number(n.m.lampT0)) / P.lampWalk);
        w.lampsLit = Math.floor(prog * 10);
        if (prog >= 1) { w.lampsDone = true; w.lampsLit = 10; emit(w, 'LAMPS_LIT', ['matvey'], ['valve:supply']); n.ph = 'done'; return; }
        waitFor(w, n, 3); return;
      }
      case 'done': waitFor(w, n, 10); return;
    }
  },

  // ---------- Орвен: семафор ----------
  orven(w, n) {
    if (evacuate(w, n)) return;
    switch (n.ph) {
      case '': n.ph = 'desk'; walk(w, n, 'bur_in'); return;
      case 'desk': {
        const f = npcHas(w, 'orven', 'flag');
        if (f && !n.m.got) { n.m.got = w.t; }
        if (f && w.t >= Number(n.m.got) + 130) { n.ph = 'to_mast'; walk(w, n, 'mast'); return; }
        waitFor(w, n, 2); return;
      }
      case 'to_mast': n.ph = 'hoist'; act(w, n, 'hoist', 20); return;
      case 'hoist': {
        w.sem.closed = true; w.sem.raisedAt = w.t; emit(w, 'SIGNAL_RAISED', ['orven', 'sem'], ['orven', 'item:flag'], {}, ['sem']);
        n.ph = 'back'; walk(w, n, 'bur_in'); return;
      }
      case 'back': n.ph = 'rest'; return;
      case 'rest': waitFor(w, n, 10); return;
    }
  },

  // ---------- Тильда: швея, проездной ----------
  tilda(w, n) {
    if (evacuate(w, n)) return;
    switch (n.ph) {
      case '': n.ph = 'home'; waitUntil(w, n, TIMES.tildaLeave + jit(w, 'tilda', 5)); return;
      case 'home': n.ph = 'to_stop'; n.m.hurry = true; n.speed = 0.95; walk(w, n, 'stop_pl', -0.8, 0.6); return;
      case 'to_stop': n.ph = 'search'; act(w, n, 'search', 15); return;
      case 'search': {
        // правило «ищу нужное в радиусе 3 м»: карманы и предметы рядом
        let pass = npcHas(w, 'tilda', 'pass');
        if (!pass) {
          for (const it of Object.values(w.items)) {
            if (it.kind !== 'pass' || it.owner !== 'tilda') continue;
            const pos = itemPos(w, it);
            if (it.loc.k === 'node' && pos && dist2d(pos.x, pos.z, n.x, n.z) < 3) { pass = it; moveItem(w, it.id, { k: 'npc', id: 'tilda' }); n.inv.push(it.id); emit(w, 'PICKUP', ['tilda', 'item:pass'], ['item:pass'], { item: it.id }, ['item:pass']); }
          }
        }
        if (!pass) emit(w, 'SEARCH_FAILED', ['tilda'], ['item:pass', 'tilda'], {});
        n.ph = 'queue'; return;
      }
      case 'queue': {
        const tr = w.tram;
        const hasPass = !!n.inv.map((i) => w.items[i]).find((i) => i.kind === 'pass' && i.owner === 'tilda');
        const hasTicket = !!npcHas(w, 'tilda', 'ticket');
        if (tr.at === 'stop_pl' && boardingOpen(w) && w.t >= (tr.departT ?? 0) - 40) {
          if (hasPass || hasTicket) {
            if (tr.pax.length < 6) {
              n.inTram = true; tr.pax.push('tilda'); n.ph = 'ride'; n.task = { k: 'wait', until: 1e9 };
              emit(w, 'BOARD_OK', ['tilda', 'luka', 'tram'], ['tilda'], {}, ['item:flag']); return;
            }
          } else if (!n.m.denied) { n.m.denied = 1; emit(w, 'BOARD_DENIED', ['tilda', 'luka', 'tram'], ['tilda'], {}, ['item:flag']); }
        }
        if (n.m.denied && tr.state === 'run') {
          n.ph = 'walk_b'; n.m.heavy = true; n.m.hurry = false; n.m.stam = P.tildaStamina; n.speed = P.tildaSpeed;
          emit(w, 'WALK_STARTED', ['tilda', 'item:flag'], ['tilda'], {}, ['item:flag']);
          walk(w, n, 'bur_door'); return;
        }
        waitFor(w, n, 2); return;
      }
      case 'alight': n.ph = 'walk_b'; n.m.heavy = true; n.m.hurry = false; n.m.stam = P.tildaStamina; n.speed = P.tildaSpeed; walk(w, n, 'bur_door'); return;
      case 'walk_b': {
        if (!ARRIVED(n, 'bur_door')) { walk(w, n, 'bur_door'); return; }
        const f = npcHas(w, 'tilda', 'flag');
        if (f) { giveNpc(w, f.id, 'orven'); emit(w, 'FLAG_DELIVERED', ['tilda', 'orven', 'item:flag'], ['tilda'], {}, ['item:flag']); }
        n.m.heavy = false; n.ph = 'done'; waitFor(w, n, 10); return;
      }
      case 'done': waitFor(w, n, 10); return;
    }
  },

  // ---------- Пип: любопытство, тайник ----------
  pip(w, n) {
    if (n.m.escort) return;
    if (w.alarm && !n.m.fleeing) {
      if (n.ph !== 'hide') { n.ph = 'hide'; n.m.hiding = true; walk(w, n, 'cel_chest', 0.8, 0.6); emit(w, 'PIP_HIDES', ['pip'], ['fire', 'gas']); return; }
    }
    switch (n.ph) {
      case '': n.ph = 'play'; waitUntil(w, n, TIMES.pipPick - 38 + jit(w, 'pip', 4)); return;
      case 'play': n.ph = 'seek'; walk(w, n, 'stop_pl', 0.4, -0.4); return;
      case 'seek': {
        const it = w.items.pass;
        if (it.loc.k !== 'node' || it.loc.id !== 'stop_pl') { n.ph = 'wander'; waitFor(w, n, 8); return; }
        // «взрослые не смотрят»: взрослый или игрок ближе 3.5 м
        const watched = Object.values(w.npcs).some((o) => o.id !== 'pip' && o.id !== 'cat' && o.id !== 'pug' && o.id !== 'fox' && o.id !== 'luka' && !o.inTram && dist2d(o.x, o.z, n.x, n.z) < 3.5) || dist2d(w.player.x, w.player.z, n.x, n.z) < 3.5;
        if (watched) { waitFor(w, n, 4); return; }
        moveItem(w, it.id, { k: 'npc', id: 'pip' }); n.inv.push(it.id);
        emit(w, 'PICKUP', ['pip', 'item:pass'], ['item:pass'], { item: 'pass' }, ['item:pass']);
        n.ph = 'hold'; return;
      }
      case 'hold': {
        const L = pathLen(w, n.node, 'cel_chest');
        const depart = TIMES.pipStash - L / n.speed - 4;
        if (w.t >= depart) { n.ph = 'to_chest'; walk(w, n, 'cel_chest', 0.8, 0.6); return; }
        waitFor(w, n, 3); return;
      }
      case 'to_chest': {
        // прячет находки в сундучок (после 21:34 там проездной и монеты)
        for (const id of [...n.inv]) { const it = w.items[id]; if (it && it.shiny) { n.inv = n.inv.filter((x) => x !== id); moveItem(w, id, { k: 'chest' }); } }
        emit(w, 'STASH', ['pip', 'item:pass'], ['pip'], {}, ['item:pass']);
        n.ph = 'play2'; return;
      }
      case 'play2': waitFor(w, n, 6); return;
      case 'wander': waitFor(w, n, 6); return;
      case 'hide': waitFor(w, n, 6); return;
    }
  },

  // ---------- Агата: кухня, запах газа ----------
  agata(w, n) {
    if (evacuate(w, n)) return;
    const gasHere = Math.max(w.gas.S, w.gas.K);
    if (gasHere > P.smell && !n.m.smelled) {
      n.m.smelled = 1; emit(w, 'GAS_SMELLED', ['agata'], ['gas']);
      n.ph = 'to_window'; walk(w, n, 'kit_window', 0, 0.3); return;
    }
    if (gasHere > P.alarmGas && !w.alarm) {
      w.alarm = true; emit(w, 'ALARM', ['agata'], ['gas'], { why: 'gas' }); return;
    }
    switch (n.ph) {
      case '': n.ph = 'cook'; walk(w, n, 'kit_stove', 0.8, 0.5); return;
      case 'cook': waitFor(w, n, 3); return;
      case 'to_window': n.ph = 'open_win'; act(w, n, 'open', 6); return;
      case 'open_win': w.kitWindow = true; emit(w, 'WINDOW', ['agata', 'kit_window'], ['gas'], { open: 1 }); n.ph = 'back_cook'; walk(w, n, 'kit_stove', 0.8, 0.5); return;
      case 'back_cook': n.ph = 'cook'; return;
    }
  },

  foma: (w, n) => { if (evacuate(w, n)) return; if (!n.ph) { n.ph = 'sit'; } waitFor(w, n, 4); },
  mira(w, n) {
    if (!n.ph) { n.ph = 'kiosk'; }
    if (n.ph === 'kiosk' && !w.kioskOpen) { n.ph = 'leave'; walk(w, n, 'sq_se', 2, 1); return; }
    waitFor(w, n, 3);
  },
  zoya: (w, n) => { waitFor(w, n, 5); },
  klara: (w, n) => { waitFor(w, n, 5); },
  luka: () => {},
  boris: () => {},
  cat: (w, n) => { if (w.alarm) { n.safe = true; } waitFor(w, n, 5); },
  pug: () => {},
  fox: (w, n) => { waitFor(w, n, 5); },
};
export { staticNpc };
