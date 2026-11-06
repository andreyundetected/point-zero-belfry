import { expect } from 'vitest';
import { makeSim } from '../src/sim/load';
import { hm } from '../src/sim/util';
import type { Sim } from '../src/sim/sim';

export const at = (s: Sim, t: string, fn: () => void) => { s.advanceTo(hm(t) - 1); fn(); s.step(); };
export const act = (s: Sim, id: string) => s.addIv({ type: 'act', id });
export const take = (s: Sim, item: string, loc: string) => { s.addIv({ type: 'take', item, loc }); s.addVanish({ item, t: s.world.t + 1, loc }); };

/**
 * The ideal run: THREE forced jumps.
 *  1. 19:10 watch the garage (parking-bay password) -> back to 14:00 to read Ila's terminal at 15:46
 *  2. 19:45 take the key token at the depot -> carry it back to 18:00 (control room window)
 *  3. 20:20 take the memory chip from the pawn shelf -> carry it back to 20:00 (Nisa's calls need a deal before 20:15)
 */
export function idealRun(skip: string[] = [], opts: { shotDelay?: number; manualTunnel?: boolean } = {}) {
  const s = makeSim(1, false);
  const doIt = (id: string) => { if (!skip.includes(id)) act(s, id); };
  let jumps = 0;
  at(s, '19:10', () => doIt('observe_garage'));
  s.travelBack(hm('14:00')); jumps++;
  at(s, '14:02', () => doIt('talk_ro'));
  at(s, '15:46', () => doIt('read_terminal'));
  at(s, '19:45', () => take(s, 'jeton', 'depot')); s.step();
  if (!skip.includes('jeton_carry')) expect(s.travelBack(hm('18:00'), 'jeton')).toBe(true); else s.jumpBack(hm('18:00'));
  jumps++;
  at(s, '18:05', () => doIt('set_bridge_norm'));
  at(s, '20:20', () => take(s, 'memory_chip', 'pawn')); s.step();
  if (!skip.includes('chip_carry')) expect(s.travelBack(hm('20:00'), 'memory_chip')).toBe(true); else s.jumpBack(hm('20:00'));
  jumps++;
  at(s, '20:01', () => doIt('deal_nisa'));
  at(s, '20:02', () => doIt('get_loop'));
  at(s, '20:03', () => doIt('get_port'));
  at(s, '20:04', () => { if (opts.manualTunnel) doIt('shut_tunnel'); else doIt('order_vent'); });
  at(s, '20:05', () => doIt('order_police'));
  at(s, '20:06', () => doIt('rumor_mok'));
  at(s, '20:07', () => doIt('install_port'));
  at(s, '21:05', () => doIt('install_loop'));
  at(s, '21:06', () => doIt('neutralize_hart'));
  at(s, '21:07', () => doIt('hide_body'));
  at(s, '21:10', () => take(s, 'rifle', 'billboard'));
  at(s, '21:12', () => { if (!skip.includes('tram_part')) take(s, 'tram_part', 'depot'); });
  while (s.world.t < hm('21:50') && !s.world.door) s.step();
  if (s.world.door) { s.advanceTo(s.world.winStart + (opts.shotDelay ?? 5)); act(s, 'shoot_lash'); s.step(); }
  s.advanceTo(s.t1);
  return { s, jumps };
}
