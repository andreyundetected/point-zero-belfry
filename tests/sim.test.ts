import { describe, it, expect } from 'vitest';
import { createSim, learn, setFlag, min, fmt, fmtMin } from '../src/sim/types';
import { npcView, npcViews, currentThread, branchState, timeline } from '../src/sim/sim';
import { NPCS, eventsAt } from '../src/content/schedule';

describe('время и расписания', () => {
  it('окно 22:00–23:00', () => {
    expect(fmt(0)).toBe('22:00:00');
    expect(fmt(600)).toBe('22:10:00');
    expect(fmtMin(1920)).toBe('22:32');
  });

  it('Орвен в лавке до 22:09 и на пороге в 22:09', () => {
    const sim = createSim();
    const def = NPCS.find((n) => n.id === 'orven')!;
    sim.t = min(5);
    expect(npcView(def, sim).visible).toBe(true);
    sim.t = min(9.5);
    expect(npcView(def, sim).visible).toBe(true);
    sim.t = min(10.5);
    expect(npcView(def, sim).visible).toBe(false);
  });

  it('Нед на мосту с 22:08 до 22:16', () => {
    const sim = createSim();
    const def = NPCS.find((n) => n.id === 'ned')!;
    sim.t = min(9);
    const v = npcView(def, sim);
    expect(v.visible).toBe(true);
    expect(v.x).toBeCloseTo(0, 0);
    sim.t = min(17);
    expect(npcView(def, sim).visible).toBe(false);
  });

  it('после взрыва шестеро уходят на склад', () => {
    const sim = createSim();
    sim.t = min(13);
    const ids = npcViews(sim).map((v) => v.id);
    expect(ids).not.toContain('ignat');
    expect(ids).not.toContain('lovchiy');
  });
});

describe('хронология без игрока', () => {
  it('взрыв склада в 22:12 всегда', () => {
    expect(eventsAt(12, {}).map((e) => e.id)).toContain('explosion');
    expect(eventsAt(12, { tapCut: 0 }).map((e) => e.id)).toContain('explosion');
  });

  it('пожар на Рыночной только без отвода', () => {
    expect(eventsAt(30, {}).map((e) => e.id)).toContain('market_fire');
    expect(eventsAt(30, { tapCut: 0 }).map((e) => e.id)).not.toContain('market_fire');
  });

  it('колокол бьёт только с отводом', () => {
    expect(eventsAt(30, {}).map((e) => e.id)).not.toContain('bell_ring');
    expect(eventsAt(30, { tapCut: 0 }).map((e) => e.id)).toContain('bell_ring');
  });
});

describe('прыжок и флаги', () => {
  it('прыжок сохраняет знания и карман, но сбрасывает изменения мира', () => {
    const sim = createSim();
    sim.t = min(10);
    learn(sim, 'orven');
    setFlag(sim, 'jetonStolen');
    sim.pocket = 'jeton';
    sim.weapon = true;
    const next = branchState(sim, min(4));
    expect(next.t).toBe(min(4));
    expect(next.knowledge.orven).toBe(min(10));
    expect(next.flags.jetonStolen).toBeUndefined();
    expect(next.pocket).toBe('jeton');
    expect(next.weapon).toBe(true);
    expect(next.branch).toBe(sim.branch + 1);
    expect(next.jumps).toBe(1);
  });

  it('нить идёт от Орвена к Неду и к стволу', () => {
    const sim = createSim();
    expect(currentThread(sim).key).toBe('orven');
    sim.t = min(13);
    expect(currentThread(sim).key).toBe('orven_late');
    learn(sim, 'orven');
    expect(currentThread(sim).key).toBe('ned');
    learn(sim, 'ned');
    learn(sim, 'tavern');
    expect(currentThread(sim).key).toBe('gun');
  });
});

describe('детерминизм', () => {
  it('одинаковые действия — одинаковая последовательность', () => {
    const run = () => {
      const sim = createSim(1947);
      const log: string[] = [];
      for (let m = 0; m <= 60; m += 2) {
        sim.t = min(m);
        log.push(fmtMin(sim.t));
        for (const e of eventsAt(m, sim.flags)) log.push(e.id);
        log.push(npcViews(sim).map((v) => `${v.id}:${v.x.toFixed(1)}`).join(','));
      }
      return log.join('|');
    };
    expect(run()).toBe(run());
  });

  it('временная линия собирается по флагам мира', () => {
    const sim = createSim();
    sim.t = min(35);
    const names = timeline(sim).map((e) => e.ru);
    expect(names.some((n) => n.includes('взрыв'))).toBe(true);
    expect(names.some((n) => n.includes('пожар на Рыночной'))).toBe(true);
  });
});
