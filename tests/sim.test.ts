import { describe, it, expect } from 'vitest';
import { createWorld, step } from '../src/sim/world';
import { Session } from '../src/sim/session';
import { solve } from '../src/sim/solver';
import { hashState } from '../src/sim/rng';
import { T1 } from '../src/sim/map';
import { TEXTS } from '../src/sim/dialogData';

const run = (w: ReturnType<typeof createWorld>) => { while (w.t < T1) step(w); return w; };

describe('детерминизм', () => {
  it('один seed → один хэш', () => {
    for (const seed of [1, 2, 3]) expect(hashState(run(createWorld(seed, { sealed: false })))).toBe(hashState(run(createWorld(seed, { sealed: false }))));
  });
  it('разные seed → разные хэши', () => {
    expect(hashState(run(createWorld(1, { sealed: false })))).not.toBe(hashState(run(createWorld(2, { sealed: false }))));
  });
});
describe('каскад «проездной → пожар»', () => {
  it('baseline горит', () => { expect(run(createWorld(1, { sealed: false })).fire.started).toBe(true); });
  it('проездной у Тильды — не горит', () => {
    const w = createWorld(1, { sealed: false }); w.items.pass.loc = { k: 'npc', id: 'tilda' }; w.npcs.tilda.inv.push('pass');
    expect(run(w).fire.started).toBe(false);
  });
});
describe('солвер', () => {
  it('≥3 прыжка (информированный игрок) и ≥2 класса', () => {
    const r = solve(1);
    expect(r.minJumpsInformed).toBeGreaterThanOrEqual(3);
    expect(r.classCountInformed).toBeGreaterThanOrEqual(2);
    expect(r.ok).toBe(true);
  });
});
describe('локализация', () => {
  it('у каждого ключа есть Ru и En', () => {
    for (const [k, [ru, en]] of Object.entries(TEXTS)) { if (k.includes('.n_')) continue; expect(ru.length, k).toBeGreaterThan(0); expect(en.length, k).toBeGreaterThan(0); }
  });
});

describe('«Вестник»', () => {
  it('отражает состояние мира: ≥3 разных заголовка за ночь', () => {
    const w = createWorld(1, { sealed: false }); const seen = new Set<string>();
    while (w.t < T1) { step(w); if (w.tick % 20 === 0) seen.add(w.newsId); }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
  it('исходы различаются: пожар / золото', () => {
    const a = createWorld(1, { sealed: false }); while (a.t < T1) step(a);
    const b = createWorld(1, { sealed: false }); b.items.pass.loc = { k: 'npc', id: 'tilda' }; b.npcs.tilda.inv.push('pass'); while (b.t < T1) step(b);
    expect(a.newsId.startsWith('news.fire')).toBe(true); expect(b.newsId).toBe('news.gold');
  });
});
