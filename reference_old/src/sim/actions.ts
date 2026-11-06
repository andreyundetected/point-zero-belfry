import type { Sim } from './sim';
import { hm, hrand } from './util';

export interface Action {
  loc: string; from?: string; to?: string; items?: string[]; facts?: string[];
  can?: (s: Sim) => boolean; run: (s: Sim) => void; radius?: number;
}
const give = (s: Sim, item: string) => s.world.pinv.push(item);
const drop = (s: Sim, item: string) => { const i = s.world.pinv.findIndex(x => x.replace('*', '') === item); if (i >= 0) s.world.pinv.splice(i, 1); };
const root = (s: Sim, id: string, loc: string) => s.emit('player_act', loc, [], [], ['player'], { id });
const fact = (s: Sim, loc: string, f: string, value: string, cause: number) => s.emit('fact', loc, [], [cause], ['player', 'fact'], { fact: f, value });
export function raiseAlarm(s: Sim, why: string, loc: string, causes: number[]) {
  const w = s.world; if (w.alarm) return;
  w.alarm = true; w.alarmEv = s.emit('alarm', loc, [], causes, ['story', 'alarm'], { why });
  if (!w.targetDead) w.flags.evac = true;
}
const stallActive = (s: Sim) => s.world.tramStall >= 0 && s.world.flags.stallStart !== undefined && s.world.t >= (s.world.flags.stallStart as number) && s.world.t < (s.world.flags.stallStart as number) + 1200;

export const ACTIONS: Record<string, Action> = {
  observe_garage: { loc: 'garage', from: '19:00', to: '19:30', can: s => !!s.world.flags.password,
    run: s => { const e = root(s, 'observe_garage', 'garage'); fact(s, 'garage', 'password', String(s.world.flags.password), e); } },
  read_terminal: { loc: 'tower_office', from: '15:45', to: '16:05', facts: ['password'], can: s => s.world.npcs.ila.loc !== 'tower_office',
    run: s => { const e = root(s, 'read_terminal', 'tower_office'); fact(s, 'tower_office', 'convoy_window', 'bridge 21:34 / tunnel', e); } },
  talk_ro: { loc: 'bar', run: s => { const e = root(s, 'talk_ro', 'bar'); fact(s, 'bar', 'dana_debt', 'dana', e); } },
  deal_nisa: { loc: 'market', items: ['memory_chip'], can: s => !s.world.flags.nisa_deal,
    run: s => { drop(s, 'memory_chip'); s.world.flags.nisa_deal = true; root(s, 'deal_nisa', 'market'); s.world.npcs.nisa.items.push('chip_loop', 'port_device'); } },
  get_loop: { loc: 'market', can: s => !!s.world.flags.nisa_deal && s.world.npcs.nisa.items.includes('chip_loop'),
    run: s => { const n = s.world.npcs.nisa; n.items.splice(n.items.indexOf('chip_loop'), 1); give(s, 'chip_loop'); root(s, 'get_loop', 'market');
      s.addVanish({ item: 'chip_loop', t: s.world.t + 1, npc: 'nisa' }); } },
  get_port: { loc: 'market', can: s => !!s.world.flags.nisa_deal && s.world.npcs.nisa.items.includes('port_device'),
    run: s => { const n = s.world.npcs.nisa; n.items.splice(n.items.indexOf('port_device'), 1); give(s, 'port_device'); root(s, 'get_port', 'market');
      s.addVanish({ item: 'port_device', t: s.world.t + 1, npc: 'nisa' }); } },
  shut_tunnel: { loc: 'tunnel', from: '20:00', to: '20:28', can: s => s.world.feeders.tunnel,
    run: s => { const e = root(s, 'shut_tunnel', 'tunnel'); s.world.feeders.tunnel = false; s.emit('tunnel_vent_off', 'tunnel', [], [e], ['story']); } },
  order_vent: { loc: 'market', can: s => !!s.world.flags.nisa_deal && !s.world.flags.o_vent, run: s => { s.world.flags.o_vent = root(s, 'order_vent', 'market'); } },
  order_police: { loc: 'market', can: s => !!s.world.flags.nisa_deal && !s.world.flags.o_police, run: s => { s.world.flags.o_police = root(s, 'order_police', 'market'); } },
  rumor_mok: { loc: 'bar', facts: ['dana_debt'], can: s => !s.world.flags.mok_rumor, run: s => { s.world.flags.mok_rumor = root(s, 'rumor_mok', 'bar'); } },
  set_bridge_norm: { loc: 'garage', from: '18:00', to: '18:30', items: ['jeton'], facts: ['convoy_window'],
    run: s => { s.world.bridgeNorm = true; root(s, 'set_bridge_norm', 'garage'); } },
  install_port: { loc: 'garage', from: '18:00', to: '21:10', items: ['port_device'], facts: ['convoy_window'], can: s => !s.world.flags.port,
    run: s => { drop(s, 'port_device'); s.world.flags.port = root(s, 'install_port', 'garage'); s.world.flags.portAt = s.world.t; } },
  install_loop: { loc: 'booth', from: '21:00', to: '21:34', items: ['chip_loop'], can: s => !s.world.flags.loop,
    run: s => { drop(s, 'chip_loop'); s.world.flags.loop = root(s, 'install_loop', 'booth'); } },
  neutralize_hart: { loc: 'booth', from: '21:00', to: '21:34', items: ['pistol'], can: s => !s.world.flags.hart_down,
    run: s => { const e = root(s, 'neutralize_hart', 'booth'); const h = s.world.npcs.hart; s.world.flags.hart_down = e; s.world.flags.hartAt = s.world.t; h.flags.down = true; h.act = 'down';
      s.emit('hart_down', 'booth', ['hart'], [e], ['story']);
      if (!s.world.flags.loop) raiseAlarm(s, 'camera_signal_lost', 'booth', [e]); } },
  hide_body: { loc: 'booth', can: s => !!s.world.flags.hart_down && !s.world.flags.body_hidden, run: s => { s.world.flags.body_hidden = root(s, 'hide_body', 'booth'); s.emit('body_hidden', 'booth', [], [s.world.flags.hart_down as number]); } },
  look_pawn: { loc: 'pawn', run: s => { const e = root(s, 'look_pawn', 'pawn'); fact(s, 'pawn', 'pawn_shelves', 'shelves', e); } },
  look_ward: { loc: 'clinic', run: s => { const e = root(s, 'look_ward', 'clinic'); fact(s, 'clinic', 'test_loop', 'band', e); } },
  steal_badge: { loc: 'garage', from: '14:00', run: s => { const e = root(s, 'steal_badge', 'garage'); give(s, 'badge_dana'); raiseAlarm(s, 'badge_theft', 'garage', [e]); } },
  shoot_lash: { loc: 'billboard', items: ['rifle'], facts: ['convoy_window'], radius: 25,
    run: s => {
      const w = s.world, e = root(s, 'shoot_lash', 'billboard');
      if (w.door && !w.alarm && w.t >= w.winStart && w.t <= w.winEnd) {
        w.shot = 'killed'; w.targetDead = true; s.world.npcs.lash.flags.dead = true;
        const k = s.emit('lash_killed', 'bridge', ['lash'], [e, w.flags.port as number, w.tramStall >= 0 ? (w.flags.stallEv as number) : -1], ['story']);
        const wit = Object.values(w.npcs).filter(n => n.loc && !n.flags.down && !['lash', 'convoy', 'osip', 'feld'].includes(n.id) && Math.hypot(n.pos.x - 2560, n.pos.y - 640) < 120);
        for (const x of wit) s.emit('witness', x.loc!, [x.id], [k], ['story']);
        if (wit.length) raiseAlarm(s, 'witness', 'bridge', [k]);
      } else { w.shot = 'failed'; s.emit('shot_fired', 'billboard', [], [e], ['story']); raiseAlarm(s, 'shot', 'billboard', [e]); }
    } },
};
export { stallActive, hm, hrand };
