import type { Npc } from './types';
import type { Sim } from './sim';
import { hm, hrand } from './util';
import { raiseAlarm } from './actions';

type Rule = (s: Sim, n: Npc) => void;
const END = 24 * 3600;

/** Rules are generic: they read state and set goals / emit events. No rule mentions the "tram pass" scenario. */
export const BEHAVIORS: Record<string, Rule> & { world: (s: Sim) => void } = {
  // Regulation: a child on a shift site -> file an incident and stay on shift
  yan(s, n) {
    if (n.override || n.loc !== 'substation' || n.act !== 'shift') return;
    const kid = s.here('substation').find(k => s.defs[k.id].child);
    if (!kid) return;
    const ev = s.emit('incident_filed', 'substation', [n.id, kid.id], [kid.lastArrive], [], {});
    s.setOverride(n, 'substation', 'incident', s.world.t + 2400, [ev]);
  },

  // Lender: debtor late beyond grace -> send collectors to the debtor's known workplace
  mok(s, n) {
    const e = s.defs[n.id].expect; if (!e || n.flags.sent) return;
    if (s.world.t < hm(e.at) + e.grace) return;
    const who = s.world.npcs[e.who];
    if (who.loc === e.loc) { n.flags.sent = true; return; }
    n.flags.sent = true;
    const ev = s.emit('collectors_sent', n.loc ?? 'bar', [n.id, e.who], [who.lastEv], [], { to: e.to });
    for (const c of e.send) {
      const cn = s.world.npcs[c];
      s.setOverride(cn, e.to, 'collect', END, [ev]);
    }
  },

  // Stress from presence of children / menacing people; panic -> emergency switch (only when at the panel)
  pike(s, n) {
    if (n.loc !== 'substation') return;
    const w = s.world;
    let st = s.defs[n.id].stress ?? 0.15; const why: number[] = [n.lastEv];
    for (const o of s.here('substation')) {
      if (o.id === n.id) continue;
      if (s.defs[o.id].child) { st += 0.2; why.push(o.lastArrive); }
      st += s.defs[o.id].menace ?? 0; if (s.defs[o.id].menace) why.push(o.lastArrive);
    }
    n.stress = st;
    const call = n.flags.call;
    if (call && !n.flags.callDone) {
      n.flags.callDone = true;
      if (call === 'vent_off') { w.feeders.tunnel = false; s.emit('tunnel_vent_off', 'tunnel', [n.id], [n.flags.callEv as number], ['story']); }
    }
    if (n.act === 'maintenance' && st > 0.6 && w.lockoutUntil < w.t) {
      for (const k of Object.keys(w.feeders)) w.feeders[k] = false;
      w.lockoutUntil = w.t + 7200;
      w.blackoutEv = s.emit('emergency_switch', 'substation', [n.id], why, ['story', 'blackout']);
      n.stress = 0.9;
    }
  },

  // Driver: if wife/ward is worse at visit, stay with her (backup driver takes over)
  osip(s, n) {
    if (n.override || n.loc !== 'clinic' || n.act !== 'visit') return;
    if (s.world.mara === 'stable') return;
    const ev = s.emit('osip_stays', 'clinic', [n.id, 'mara'], [s.world.maraEv], ['story']);
    s.setOverride(n, 'clinic', 'stay', END, [ev]);
  },

  // Traffic lights dead -> nearest patrol regulates the junction
  burn(s, n) {
    const w = s.world;
    if (n.act === 'respond' && n.loc && !n.flags.arrivedEv) { n.flags.arrivedEv = true; s.emit('police_arrives', n.loc, ['burn'], [n.lastArrive], ['story']); }
    if (n.act !== 'respond') n.flags.arrivedEv = false;
    if (w.feeders.lights || n.override || w.t >= w.lockoutUntil) return;
    const ev = s.emit('burn_regulates', 'crossing', [n.id], [w.blackoutEv]);
    s.setOverride(n, 'crossing', 'regulate', w.lockoutUntil, [ev]);
  },

  // Journalist: if entrance is unguarded for 3 minutes -> break in and show documents on the hall screen
  kay(s, n) {
    const w = s.world;
    if (w.t < hm('19:30')) return;
    if (!n.flags.done && n.loc === 'tower_front' && n.act === 'stakeout') {
      const police = s.here('tower_front').find(p => p.id === 'burn');
      if (police) {
        n.flags.seen = (n.flags.seen as number ?? 0) + 1;
        if (n.flags.seen as number > 60) {
          n.flags.done = true;
          const ev = s.emit('kay_dispersed', 'tower_front', [n.id, police.id], [police.lastArrive]);
          s.setOverride(n, 'bar', 'drink', END, [ev]);
        }
      } else {
        n.flags.absent = (n.flags.absent as number ?? 0) + 1;
        if (n.flags.absent as number > 180) {
          n.flags.done = true;
          const absentCause = [w.blackoutEv, ...Object.values(w.npcs).filter(x => x.id === 'burn').map(x => x.lastEv)];
          const ev = s.emit('kay_breaks_in', 'tower_front', [n.id], absentCause);
          n.flags.breakEv = ev;
          s.setOverride(n, 'tower_hall', 'documents', END, [ev]);
        }
      }
    }
    if (n.loc === 'tower_hall' && n.act === 'documents' && !w.docsShown) {
      w.docsShown = true;
      s.emit('documents_shown', 'tower_hall', [n.id], [n.flags.breakEv as number], ['story']);
    }
  },

  // Dispatcher: crimes/emergencies reported by events get the nearest patrol assigned
  vera(s, n) {
    const POLICE = new Set(['shot_fired', 'witness', 'body_found', 'alarm', 'device_found']);
    let i = (n.flags.scan as number) ?? 0;
    for (; i < s.events.length; i++) {
      const e = s.events[i];
      if (!POLICE.has(e.type) || (e.type === 'alarm' && e.data?.why === 'hart_alarm' && false)) continue;
      const b = s.world.npcs.burn;
      if (b.override) continue;
      const ev = s.emit('police_dispatched', 'dispatch', ['vera', 'burn'], [e.id], ['story'], { to: e.loc });
      s.setOverride(b, e.loc, 'respond', s.world.t + 900, [ev]);
    }
    n.flags.scan = i;
  },

  ro() {},

  // A citizen's personal rules: they can break the plan for the day
  citizen(s, n) {
    const L = s.defs[n.id].life; if (!L) return;
    const w = s.world, f = n.flags;
    // about to leave home for work, but the spouse is ill -> call the boss and stay home
    if (s.curTask(n.id).act === 'commute' && n.loc !== L.work && !f.called && L.spouse && w.npcs[L.spouse]?.flags.sick) {
      f.called = true;
      const ev = s.emit('citizen_calls_boss', n.loc ?? L.home, [n.id, ...(L.boss ? [L.boss] : [])], [], [], { home: L.home });
      s.setOverride(n, L.home, 'home', 24 * 3600, [ev]);
      return;
    }
    // arrived at work: no boss there -> slack off at a cafe for half an hour
    if (n.act === 'commute' || n.act === 'work') {
      if (n.loc === L.work && !n.legs.length && !f.bossChecked && L.boss && !n.override) {
        f.bossChecked = true;
        const b = w.npcs[L.boss];
        if (b && b.loc !== L.work && !f.slack) {
          f.slack = true; const ev = s.emit('citizen_slacks', L.work, [n.id, L.boss], [b.lastEv]);
          const cafe = Object.keys(s.locs).find(k => k.startsWith('k_') && Math.abs(s.locs[k].x - n.pos.x) < 600) ?? 'market';
          s.setOverride(n, cafe, 'slack', w.t + 1800, [ev]);
        }
      }
    }
    // an alarm or shot nearby -> run home
    if (!f.fled && w.alarm && w.alarmEv >= 0 && !n.override && n.loc !== L.home) {
      const ae = s.events[w.alarmEv], lp = s.locs[ae.loc];
      if (lp && Math.hypot(lp.x - n.pos.x, lp.y - n.pos.y) < 250) { f.fled = true; const ev = s.emit('citizen_flees', n.loc ?? 'street', [n.id], [w.alarmEv]); s.setOverride(n, L.home, 'hide', 24 * 3600, [ev]); }
    }
  },

  // Ordinary citizens: when the street lights die they hurry home (and tell the story of the blackout)
  crowd(s, n) {
    const w = s.world;
    if (w.feeders.lights || n.override || n.loc === (s.defs[n.id].life?.home ?? 'kolco') || w.t >= w.lockoutUntil) return;
    if (n.loc === null) return;
    const ev = s.emit('crowd_goes_home', n.loc, [n.id], [w.blackoutEv]);
    s.setOverride(n, s.defs[n.id].life?.home ?? 'kolco', 'panic', w.lockoutUntil, [ev]);
  },

  hart(s, n) {
    const w = s.world;
    if (n.flags.down) {
      if (!w.flags.body_hidden && !n.flags.found && w.t - (w.flags.hartAt as number) > 300) {
        n.flags.found = true; raiseAlarm(s, 'body_found', 'booth', [w.flags.hart_down as number]);
      }
      return;
    }
    const st = w.flags.stallStart as number | undefined;
    if (st !== undefined && w.t >= st && w.t < st + 1200 && !w.alarm) raiseAlarm(s, 'hart_alarm', 'booth', [w.flags.stallEv as number, n.lastEv]);
  },

  convoy(s, n) {
    const w = s.world, lash = w.npcs.lash, f = n.flags;
    const stage = (f.stage as number) ?? 0;
    if (stage >= 2 && stage < 5 && !lash.flags.dead) { lash.pos = { ...n.pos }; lash.loc = n.loc; lash.act = 'convoy'; }
    if (stage === 1 && n.loc === 'residence' && !f.waitUntil) { f.waitUntil = w.t + 420; }
    else if (stage === 1 && n.loc === 'residence' && w.t >= (f.waitUntil as number)) {
      f.stage = 2; const wp = w.route === 'bridge' ? 'bridge' : 'tunnel';
      const ev = s.emit('lash_boards', 'residence', ['lash', w.driver], [n.lastArrive], w.route === 'bridge' ? ['story'] : []);
      s.goTo(n, wp, 'transit', [ev]);
    } else if (stage === 2 && n.loc && n.loc !== 'residence') {
      if (w.alarm || w.route !== 'bridge') { f.stage = 4; s.goTo(n, 'tower_front', 'arrive', [n.lastArrive, w.alarmEv]); return; }
      const stalled = w.flags.stallStart !== undefined && w.t >= (w.flags.stallStart as number) && w.t < (w.flags.stallStart as number) + 1200;
      if (stalled) {
        const burnHere = w.npcs.burn.loc === 'bridge';
        const e = s.emit('convoy_stops_bridge', 'bridge', [w.driver, 'lash'], [n.lastArrive, w.flags.stallEv as number], ['story']);
        w.door = !!w.flags.port && w.driver === 'osip' && w.t < (w.flags.distractUntil as number ?? 0) && !burnHere;
        if (w.door) { w.winStart = w.t + 10; w.winEnd = w.t + 50; s.emit('omega_door_opens', 'bridge', [w.driver], [w.flags.port as number, e], ['story']); }
        else if (burnHere) raiseAlarm(s, 'patrol_at_bridge', 'bridge', [e, w.npcs.burn.lastEv]);
        f.stage = 3; f.stopUntil = w.t + 60;
      } else { f.stage = 4; s.goTo(n, 'tower_front', 'arrive', [n.lastArrive]); }
    } else if (stage === 3 && w.t >= (f.stopUntil as number)) {
      w.door = false; f.stage = 4; s.goTo(n, 'tower_front', 'arrive', [n.lastEv]);
    } else if (stage === 4 && n.loc === 'tower_front') {
      f.stage = 5; if (!lash.flags.dead) { lash.loc = 'tower_hall'; lash.pos = s.posOf('tower_hall'); lash.act = 'tower'; }
      s.emit('convoy_arrives', 'tower_front', [w.driver, 'lash'], [n.lastArrive], []);
    }
  },

  world(s) {
    const w = s.world, t = w.t;
    // power restore
    if (w.lockoutUntil && t === w.lockoutUntil) {
      for (const k of Object.keys(w.feeders)) w.feeders[k] = true;
      w.stableSince = t; w.clinicPower = 'grid';
      if (w.mara === 'guarded') w.mara = 'stable';
      s.emit('power_restored', 'substation', [], [w.blackoutEv]);
    }
    if (!w.feeders.tower) w.stableSince = Math.max(w.stableSince, -1e9);
    // clinic generator
    if (!w.feeders.clinic && w.clinicPower === 'grid') {
      w.clinicPower = 'gen'; w.clinicGenUntil = t + 2400;
      const e1 = s.emit('clinic_generator', 'clinic', ['sol'], [w.blackoutEv]);
      w.mara = 'guarded'; w.maraEv = e1;
      s.emit('patients_wake', 'clinic', ['mara', 'sol'], [e1], ['story', 'dark']);
    }
    if (w.clinicPower === 'gen' && t >= w.clinicGenUntil && !w.feeders.clinic) {
      w.clinicPower = 'off'; w.mara = 'critical';
      w.maraEv = s.emit('mara_critical', 'clinic', ['mara', 'sol'], [w.maraEv], ['story']);
    }
    if (t === hm('19:05') && w.flags.port) {
      s.emit('device_found', 'garage', ['osip'], [w.flags.port as number], ['story']); w.flags.port = false;
    }
    if (t === hm('20:15') && w.flags.o_vent) { const p = w.npcs.pike; p.flags.call = 'vent_off'; p.flags.callEv = s.emit('fake_call', 'substation', ['nisa', 'pike'], [w.flags.o_vent as number], ['story']); }
    if (t === hm('21:00') && w.flags.mok_rumor) { w.flags.distractUntil = t + 2400; s.emit('mok_calls_dana', 'bar', ['mok', 'dana'], [w.flags.mok_rumor as number], ['story']); }
    if (t === hm('21:20') && w.flags.o_police) { const b = w.npcs.burn; const e = s.emit('false_call', 'dispatch', ['nisa', 'vera'], [w.flags.o_police as number], ['story']); s.setOverride(b, 'tunnel', 'false_call', hm('21:50'), [e]); }
    // tram part missing -> next trip stalls on the bridge
    const tr = s.def.tram, first = hm(tr.first);
    if (w.tramStall < 0 && t > first && (t - first) % tr.headway === 0 && !w.ground.some(g => g.item === 'tram_part' && g.loc === 'depot')) {
      w.tramStall = (t - first) / tr.headway; w.flags.stallStart = Math.ceil(s.tramArrival(2, t));
    }
    if (w.flags.stallStart !== undefined && t === w.flags.stallStart) w.flags.stallEv = s.emit('tram_stalled', 'bridge', ['emil'], [], ['story']);
    // route choice 20:30
    if (t === hm('20:30')) {
      w.route = !w.feeders.tunnel && w.bridgeNorm ? 'bridge' : 'tunnel';
      s.emit('route_chosen', 'garage', ['dana'], [w.blackoutEv], [], { route: w.route });
    }
    // convoy 21:15
    if (t === hm('21:15')) {
      const o = w.npcs.osip;
      w.driver = o.loc === 'garage' && o.act === 'driver' ? 'osip' : 'feld';
      const ce = s.emit('convoy_departs', 'garage', [w.driver, 'lash'], [w.driver === 'feld' ? w.maraEv : -1], [], { route: w.route, strict: w.driver === 'feld' });
      const cv = w.npcs.convoy; cv.flags.stage = 1; s.goTo(cv, 'residence', 'pickup', [ce]);
    }
    // launch decision
    if (t === hm('21:30') && (!w.feeders.tower || t - w.stableSince < 5400 && w.stableSince > 0)) {
      w.launch = 'postponed';
      s.emit('launch_postponed', 'tower_hall', ['lash'], [w.blackoutEv, w.docsShown ? s.events.findIndex(e => e.type === 'documents_shown') : -1], ['story']);
    }
    if (t === hm('22:00')) {
      if (w.targetDead) { w.flags.result = w.alarm ? 'killed_alarm' : 'perfect'; s.emit('launch_cancelled', 'tower_hall', [], [], ['story']); }
      else if (w.flags.evac) { w.flags.result = 'evacuated'; s.emit('launch_by_deputy', 'tower_hall', [], [w.alarmEv], ['story']); }
      else if (w.launch === 'pending') { w.launch = 'done'; w.flags.result = 'launched'; s.emit('launch', 'tower_hall', ['lash'], [], ['story']); }
      else w.flags.result = 'postponed';
    }
  },
};
