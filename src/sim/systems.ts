import { BARREL_EDGES, NODES, TRAM_TRIPS, TIMES, dist2d, edgeKey } from './map';
import { P } from './params';
import { World, emit, noiseRadius, rainMask } from './core';
import { headline } from './news';

/** Зона таверны по узлу (для огня и эвакуации). */
export function tavernZone(nodeId: string): string {
  const n = NODES[nodeId]; if (!n || n.inside !== 'tavern') return '';
  if ((n.floor ?? 0) < 0) return 'cellar';
  if ((n.floor ?? 0) > 0) return 'upper';
  if (['kit', 'kit_stove', 'kit_window', 'kit_door'].includes(nodeId)) return 'kitchen';
  return 'hall';
}

export function boardingOpen(w: World): boolean {
  const tr = w.tram; if (tr.state !== 'wait' || !tr.at) return false;
  const nt = TRAM_TRIPS[tr.trip]; if (!nt) return false;
  return nt.from === tr.at && w.t >= nt.t - P.boardWindow && w.t < nt.t;
}

function stepTram(w: World, dt: number) {
  const tr = w.tram; const trip = TRAM_TRIPS[tr.trip];
  if (tr.state === 'wait') {
    if (trip && w.t >= trip.t && tr.at === trip.from) {
      tr.state = 'run'; tr.from = trip.from; tr.to = trip.to; tr.at = null;
      emit(w, 'TRAM_DEPART', ['tram', 'luka'], [], { from: trip.from });
    }
  } else {
    const dest = NODES[tr.to].x; const dir = Math.sign(dest - tr.x);
    tr.x += dir * P.tramSpeed * dt;
    if ((dir > 0 && tr.x >= dest) || (dir < 0 && tr.x <= dest)) {
      tr.x = dest; tr.state = 'wait'; tr.at = tr.to; tr.trip++;
      for (const pid of tr.pax) {
        if (pid === 'player') { w.player.x = dest; w.player.z = 17.6; continue; }
        const n = w.npcs[pid]; if (!n) continue;
        n.inTram = false; n.node = tr.to; n.x = dest; n.z = 17.6; n.task = null; n.ph = 'alight';
        emit(w, 'ALIGHT', [pid, 'tram'], [pid], {}, ['item:flag']);
      }
      tr.pax = tr.pax.filter((x) => x === 'player');
    }
  }
  const lk = w.npcs.luka; lk.x = tr.x + 1.6; lk.z = 17.9; lk.node = tr.at ?? lk.node;
  if (w.player.onTram) { w.player.x = tr.x; w.player.z = 17.6; }
}

function stepDock(w: World, dt: number) {
  const d = w.dock; const bo = w.npcs.boris, pg = w.npcs.pug;
  if (d.state === 'far' && w.t >= 960) d.state = 'approach';
  if (d.state === 'approach') {
    d.x -= P.dockSpeed * dt; d.z = 30 - Math.max(0, (110 - d.x)) * 0.0; 
    if (d.decidedAt < 0 && w.t >= P.dockDecide) {
      d.decidedAt = w.t;
      const closed = w.sem.closed;
      // Борис смотрит на мачту: красный над синим = порт закрыт
      emit(w, 'DOCK_DECISION', ['boris', 'dock'], ['sem', 'orven', 'item:flag'], { closed: closed ? 1 : 0 });
      d.state = closed ? 'avoid' : 'approach';
      if (!closed) w.flags.moorStart = w.t;
    }
    if (d.state === 'approach' && d.x <= NODES.quay.x) { d.state = 'moored'; w.flags.mooredAt = w.t; }
  }
  if (d.state === 'avoid') { d.z = Math.min(46, d.z + 0.3 * dt); d.x -= 0.02 * dt; }
  if (d.state === 'moored') {
    d.x = NODES.quay.x; d.z = 26.5;
    if (w.t >= Number(w.flags.mooredAt) + 30) {
      d.state = 'unloaded'; d.barrels = 4;
      for (const [a, b] of BARREL_EDGES) { const k = edgeKey(a, b); if (!w.blocked.includes(k)) w.blocked.push(k); }
      emit(w, 'OBSTACLE_PLACED', ['boris', 'obstacle'], ['dock'], { n: 4 });
    }
  }
  if (d.state === 'unloaded') { d.x = NODES.quay.x; d.z = 26.5; }
  bo.x = d.x; bo.z = d.z - 0.5; pg.x = d.x + 1.5; pg.z = d.z - 0.2;
}

function stepGas(w: World, dt: number) {
  const g = w.gas;
  // давление в сети: подача тянет к P_target = 1 + 1.6·v, стравливание — сток
  if (w.v > 0) w.P += ((1 + 1.6 * w.v - w.P) * w.v / P.tau) * dt;
  if (w.w > 0) w.P -= w.w * P.bleed * dt;
  w.P = Math.max(0.1, Math.min(3.2, w.P));
  w.flicker = w.P < 0.6;
  const Ptav = w.tavValve > 0.5 ? w.P : 0;
  let q = 0;
  if (Ptav > P.rated) q = P.kLeak * Math.pow(Ptav - P.rated, P.kLeakPow);
  if (q > 0 && !g.leakOn) { g.leakOn = true; emit(w, 'JOINT_LEAK', ['joint', 'gas'], ['valve:supply'], { P: Math.round(Ptav * 100) / 100 }, ['joint']); }
  g.S += q * dt;
  const vS = P.ventBase + (w.hood ? P.ventHood : 0), vK = P.ventBase + (w.kitWindow ? P.ventWin : 0), vH = P.ventBase + (w.frontDoor === 'open' ? P.ventDoor : 0);
  g.S -= g.S * vS * dt; g.K -= g.K * vK * dt; g.H -= g.H * vH * dt;
  const a = P.diffSK * (g.S - g.K) * dt; g.S -= a; g.K += a;
  const b = P.diffKH * (g.K - g.H) * dt; g.K -= b; g.H += b;
  g.S = Math.max(0, g.S); g.K = Math.max(0, g.K); g.H = Math.max(0, g.H);
  if (!g.thresholdEv && Math.max(g.S, g.K) >= P.smell) { g.thresholdEv = true; emit(w, 'GAS_THRESHOLD', ['gas'], ['joint'], { c: Math.round(Math.max(g.S, g.K) * 100) / 100 }); }
  // воспламенение: источник огня в клетке с концентрацией ≥ 5 %
  if (!w.fire.started) {
    const src = (g.S >= P.ignite && w.stove && w.tavValve > 0.5) ? 'stove' : (g.H >= P.ignite && (w.hearth || true)) ? 'hearth' : (g.K >= P.ignite && w.stove) ? 'stove' : '';
    if (src) {
      w.fire.started = true; w.fire.ignitedAt = w.t; w.fire.source = src; w.fire.zones = { kitchen: w.t };
      emit(w, 'IGNITION', ['fire', src], ['gas', 'joint'], { cell: src });
    }
  }
}

function stepFire(w: World, dt: number) {
  const f = w.fire; if (!f.started) return;
  const since = w.t - f.ignitedAt;
  if (since >= P.fireSpread.hall && f.zones.hall === undefined) f.zones.hall = w.t;
  if (since >= P.fireSpread.upper && f.zones.upper === undefined) f.zones.upper = w.t;
  if (since >= P.fireSpread.cellar && f.zones.cellar === undefined) f.zones.cellar = w.t;
  if (!f.alarm) { f.alarm = true; w.alarm = true; emit(w, 'ALARM', ['agata'], ['fire'], { why: 'fire' }); }
  for (const n of Object.values(w.npcs)) {
    const z = tavernZone(n.node);
    if (!z || !f.zones[z]) continue;
    if (n.inTram) continue;
    const intensity = Math.min(1, (w.t - f.zones[z]) / 40);
    if (intensity > 0.4) n.hurt += dt;
  }
}

export function lightLevel(w: World, x: number, z: number): number {
  if (dist2d(x, z, NODES.ks1.x, NODES.ks1.z) < 4) return 0.25;
  return 0.7;
}

function perception(w: World) {
  const ig = w.npcs.ignat, p = w.player;
  if (w.alarm || ig.inTram) return;
  const d = dist2d(ig.x, ig.z, p.x, p.z);
  if (d > 14) return;
  const heard = d < noiseRadius(p.st) * rainMask;
  const ang = Math.atan2(p.x - ig.x, p.z - ig.z); let da = Math.abs(ang - ig.face); da = Math.min(da, Math.PI * 2 - da);
  const seen = da < (55 * Math.PI) / 180 && d < 12 * (0.4 + lightLevel(w, p.x, p.z));
  if ((heard || seen) && dist2d(p.x, p.z, NODES.ks1.x, NODES.ks1.z) < 5.5 && (w.ks1Open || w.w > 0)) {
    if (!w.flags.ignatAlert) { w.flags.ignatAlert = true; emit(w, 'GUARD_SPOTTED', ['ignat', 'player'], []); }
  }
}

export function stepSystems(w: World, dt: number) {
  // расписание мира
  if (w.t >= TIMES.tavernBar && w.frontDoor === 'open') { w.frontDoor = 'closed'; emit(w, 'DOOR_BARRED', ['tavern'], []); }
  if (w.t >= TIMES.kioskClose && w.kioskOpen) { w.kioskOpen = false; emit(w, 'KIOSK_CLOSED', ['mira'], []); }
  if (w.t >= TIMES.cordon && w.towerOpen) { w.towerOpen = false; emit(w, 'TOWER_CORDON', ['klara'], []); }
  stepTram(w, dt); stepDock(w, dt); stepGas(w, dt); stepFire(w, dt); perception(w);
  if (w.tick % 10 === 0) w.newsId = headline(w);
}
