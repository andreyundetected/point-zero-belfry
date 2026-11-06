import { describe, it, expect } from 'vitest';
import { makeSim } from '../src/sim/load';
import { fmt, hm } from '../src/sim/util';
import type { Sim } from '../src/sim/sim';
import { idealRun } from './helpers';
import world from '../src/data/world.json';

const story = (s: Sim) => s.events.filter(e => e.tags.includes('story')).map(e => `${fmt(e.t)} ${e.type}`);

describe('mission solver', () => {
  it('ideal run (solution A: Nisa call) is a perfect elimination with exactly 3 jumps', () => {
    const { s, jumps } = idealRun();
    console.log(story(s).join('\n'));
    expect(jumps).toBe(3);
    expect(s.world.flags.result).toBe('perfect'); expect(s.world.targetDead).toBe(true);
  });
  it('solution B (shut the tunnel ventilation by hand, no vent call) also works -> at least 2 solutions', () => {
    const { s } = idealRun(['order_vent'], { manualTunnel: true });
    expect(s.world.flags.result).toBe('perfect');
  });
  it('without the player the mission is unsolved (launch happens)', () => {
    const s = makeSim(); s.advanceTo(s.t1);
    expect(s.world.flags.result).toBe('launched'); expect(s.world.targetDead).toBe(false);
  });
  it('structurally impossible without jumps: required items/knowledge only exist after the moment they are needed', () => {
    const ev = (world as any).events as { t: string; type: string; item?: string }[];
    const spawn = (item: string) => hm(ev.find(e => e.type === 'spawn_item' && e.item === item)!.t);
    expect(spawn('jeton')).toBeGreaterThan(hm('18:30'));        // control-room window ends before the token exists
    expect(spawn('memory_chip')).toBeGreaterThan(hm('20:15'));  // the forged vent call fires at 20:15
    // password is visible only after 19:00 but the terminal is readable only 15:45-16:05
    const { s } = idealRun(['observe_garage']);
    expect(s.world.flags.result).not.toBe('perfect');
  });
  for (const skip of ['order_vent', 'jeton_carry', 'chip_carry', 'install_port', 'install_loop', 'neutralize_hart', 'hide_body', 'tram_part', 'order_police', 'rumor_mok', 'get_port', 'get_loop', 'set_bridge_norm', 'read_terminal', 'talk_ro', 'deal_nisa'])
    it(`missing step "${skip}" fails the ideal run`, () => {
      const { s } = idealRun([skip]);
      expect(s.world.flags.result).not.toBe('perfect');
    });
  it('shooting too late fails', () => { const { s } = idealRun([], { shotDelay: 60 }); expect(s.world.flags.result).not.toBe('perfect'); });
});
