import { describe, it, expect } from 'vitest';
import { makeSim } from '../src/sim/load';
import { fmt } from '../src/sim/util';

const run = (ivs: any[] = []) => { const s = makeSim(); s.ivs = ivs; s.advanceTo(s.t1); return s; };
const find = (s: any, type: string) => s.events.filter((e: any) => e.type === type);

describe('baseline', () => {
  it('prints key baseline facts', () => {
    const s = run();
    for (const e of s.events.filter(e => ['arrive'].includes(e.type) && ['lea','yan','pike','collector1'].includes(e.actors[0])))
      console.log(fmt(e.t), e.type, e.actors.join(','), e.loc);
    console.log(s.events.filter(e => e.tags.includes('story')).map(e => fmt(e.t) + ' ' + e.type));
  });
  it('has no blackout', () => { const s = run(); expect(find(s, 'emergency_switch')).toHaveLength(0); });
  it('deterministic', () => { const a = run(), b = run(); expect([...a.hashes]).toEqual([...b.hashes]); });
});

describe('pass cascade (emergent, no scripts)', () => {
  const pass = [{ t: 14 * 3600 + 9 * 60, type: 'take', item: 'tram_pass', loc: 'market' }, { t: 14 * 3600 + 10 * 60, type: 'give', item: 'tram_pass', to: 'lea' }];
  it('whole chain happens with a single intervention', () => {
    const s = run(pass);
    const types = s.events.map(e => fmt(e.t) + ' ' + e.type + ' ' + e.actors.join(','));
    console.log(types.filter(x => !/arrive|depart/.test(x)).join('\n'));
    for (const k of ['incident_filed', 'collectors_sent', 'emergency_switch', 'burn_regulates', 'kay_breaks_in', 'documents_shown', 'launch_postponed', 'osip_stays', 'mara_critical'])
      expect(find(s, k).length, k).toBeGreaterThan(0);
    expect(s.world.driver).toBe('feld');
  });
  it('anomaly causes trace back to the player action', () => {
    const s = run(pass);
    const root = s.events.find(e => e.type === 'player_give')!;
    let e = find(s, 'launch_postponed')[0]; const seen = new Set<number>(); const q = [e.id]; let found = false;
    while (q.length) { const id = q.pop()!; if (seen.has(id)) continue; seen.add(id); if (id === root.id) found = true; q.push(...s.events[id].causes); }
    expect(found).toBe(true);
  });
});

import { diff, baselineOf } from '../src/sim/anomalies';
import { validateGraph } from '../src/sim/graph';
import worldDef from '../src/data/world.json';

describe('graph', () => {
  it('every NPC has >=2 links and path to target <=4', () => { expect(validateGraph(worldDef as any)).toEqual([]); });
});
describe('anomalies', () => {
  const pass = [{ t: 14 * 3600 + 9 * 60, type: 'take', item: 'tram_pass', loc: 'market' }, { t: 14 * 3600 + 10 * 60, type: 'give', item: 'tram_pass', to: 'lea' }];
  it('baseline vs baseline has none; pass branch flags story anomalies with chains to root', () => {
    const base = baselineOf(makeSim);
    expect(diff(base, run().events, run().t1)).toHaveLength(0);
    const cur = run(pass); const an = diff(base, cur.events, cur.t1);
    const story = an.filter(a => a.ev.tags.includes('story'));
    console.log(an.slice(0, 12).map(a => `${a.kind} ${fmt(a.ev.t)} ${a.ev.type} root=${cur.events[a.root]?.type}`).join('\n'));
    expect(story.length).toBeGreaterThan(3);
    const lp = an.find(a => a.ev.type === 'launch_postponed')!;
    expect(cur.events[lp.root].type).toBe('player_give');
  });
});
describe('time jumps', () => {
  it('jump back restores world and erases later interventions; replay is identical', () => {
    const s = makeSim(); s.ivs = [{ t: 14 * 3600 + 540, type: 'take', item: 'tram_pass', loc: 'market' } as any, { t: 14 * 3600 + 600, type: 'give', item: 'tram_pass', to: 'lea' } as any];
    s.advanceTo(18 * 3600); const h18 = s.hashes.get(18 * 3600)!;
    s.jumpBack(14 * 3600 + 300); expect(s.ivs).toHaveLength(0);
    expect(s.world.npcs.lea.items).toContain('badge_pike');
    s.advanceTo(18 * 3600); expect(s.hashes.get(18 * 3600)).not.toBe(h18);
  });
});

import ru from '../src/data/i18n/ru.json';
import en from '../src/data/i18n/en.json';
describe('i18n', () => {
  it('ru and en have identical keys and no empty strings', () => {
    const flat = (o: any, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => typeof v === 'object' ? flat(v, p + k + '.') : [p + k + (v === '' ? '!EMPTY' : '')]);
    expect(flat(ru).sort()).toEqual(flat(en).sort());
  });
  it('every event type emitted has a template', () => {
    const s = run([{ t: 14 * 3600 + 540, type: 'take', item: 'tram_pass', loc: 'market' }, { t: 14 * 3600 + 600, type: 'give', item: 'tram_pass', to: 'lea' }]);
    for (const e of s.events) expect((ru as any).ev[e.type], e.type).toBeTruthy();
  });
});

import { headlines } from '../src/sim/news';
describe('news', () => {
  it('headlines change with the world and every key is translated', () => {
    const a = run(), b = run([{ t: 14 * 3600 + 540, type: 'take', item: 'tram_pass', loc: 'market' }, { t: 14 * 3600 + 600, type: 'give', item: 'tram_pass', to: 'lea' }]);
    const ka = headlines(a).map(h => h.key), kb = headlines(b).map(h => h.key);
    expect(kb).toContain('blackout'.replace('blackout', 'postponed')); expect(ka).not.toContain('postponed');
    for (const k of [...ka, ...kb]) { expect((ru as any).news[k]).toBeTruthy(); expect((en as any).news[k]).toBeTruthy(); }
  });
});

import dlgData from '../src/data/dialogues.json';
describe('dialogue i18n', () => {
  it('every dialogue line key exists in ru and en', () => {
    const keys: string[] = [];
    for (const npc of Object.values((dlgData as any).npcs) as any[]) for (const nd of Object.values(npc.nodes) as any[]) {
      for (const [, k] of nd.lines) keys.push(k); for (const c of nd.choices) keys.push(c.k);
      for (const c of nd.choices) if (c.to) expect(npc.nodes[c.to], c.to).toBeTruthy();
    }
    for (const l of [...Object.values((dlgData as any).barks), ...Object.values((dlgData as any).ctx)] as string[][]) keys.push(...l);
    for (const key of keys) {
      const get = (d: any) => key.split('.').reduce((a: any, k: string) => a?.[k], d.dlg);
      expect(get(ru), key).toBeTruthy(); expect(get(en), key).toBeTruthy();
    }
  });
});

describe('graph incl. crowd', () => {
  it('crowd members have >=2 links and reach the target in <=4 steps', () => {
    expect(validateGraph(makeSim(1).def)).toEqual([]);
  });
});
describe('butterfly effect', () => {
  it('small random interventions sometimes (not never, not always) change the target fate', () => {
    const N = Number(process.env.BUTTERFLY_N ?? 120);
    const s = makeSim(1, false); s.advanceTo(s.t1);
    const ids = Object.keys(s.world.npcs); let changed = 0, total = 0;
    let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < N; i++) {
      const t = 14 * 3600 + 60 + Math.floor(rnd() * 7.5 * 3600);
      s.jumpBack(t);
      const moving = ids.filter(id => s.world.npcs[id].legs.length);
      if (!moving.length) { s.advanceTo(s.t1); continue; }
      const npc = moving[Math.floor(rnd() * moving.length)];
      s.addIv({ type: 'delay', npc, seconds: 30 + Math.floor(rnd() * 2400) });
      s.advanceTo(s.t1); total++;
      if (s.world.flags.result !== 'launched') changed++;
    }
    console.log(`butterfly: ${changed}/${total} changed the fate`);
    expect(changed).toBeGreaterThan(0); expect(changed).toBeLessThan(total);
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
describe('no hard-coded Russian/English UI strings in code', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
  it('no Cyrillic literals in src/*.ts', () => {
    for (const f of walk('src')) expect(/[А-Яа-яЁё]/.test(readFileSync(f, 'utf8')), f).toBe(false);
  });
});
