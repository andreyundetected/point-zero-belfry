import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_TEXTS } from '../src/i18n';
import { DIALOGS, INSPECT } from '../src/sim/dialogData';
import { BARKS } from '../src/data/barks';
import { UI } from '../src/data/ui_texts';

const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.ts') ? [path.join(d, e.name)] : []));

describe('локализация Ru/En', () => {
  it('у каждого ключа непустые Ru и En', () => {
    for (const [k, [ru, en]] of Object.entries(ALL_TEXTS)) {
      if (/^obj\.(.+)\.n_/.test(k)) continue; // заголовки доски — берутся из news.*
      if (/^obj\.(ks1|kiosk|bench|board)\.d$/.test(k)) continue; // описания этих объектов приходят из INSPECT
      expect(ru.length, 'ru ' + k).toBeGreaterThan(0); expect(en.length, 'en ' + k).toBeGreaterThan(0);
    }
  });
  it('все t("ключ") в коде существуют в словаре', () => {
    const missing: string[] = [];
    for (const f of walk('src').filter((x) => !x.includes('/data/') && !x.endsWith('i18n.ts'))) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/[^a-zA-Z_.]t\(\s*'([^']+)'(\s*\+)?/g)) { if (m[2]) continue; if (!(m[1] in ALL_TEXTS)) missing.push(`${f}: ${m[1]}`); }
    }
    expect(missing).toEqual([]);
  });
  it('все реплики диалогов, варианты и осмотры переведены', () => {
    for (const d of Object.values(DIALOGS)) for (const n of Object.values(d.nodes)) { for (const l of n.lines) expect(ALL_TEXTS[l.k], l.k).toBeTruthy(); for (const c of n.choices) expect(ALL_TEXTS[c.k], c.k).toBeTruthy(); }
    for (const [id, v] of Object.entries(INSPECT)) expect(ALL_TEXTS[v.name], id).toBeTruthy();
    for (const arr of Object.values(BARKS)) for (const k of arr) expect(ALL_TEXTS[k], k).toBeTruthy();
  });
  it('у каждого NPC есть имя и роль; у каждого события хроники — текст', () => {
    for (const id of ['ignat', 'matvey', 'orven', 'boris', 'luka', 'foma', 'tilda', 'agata', 'mira', 'pip', 'zoya', 'klara', 'cat', 'pug', 'fox']) { expect(UI['npc.' + id], id).toBeTruthy(); expect(UI['role.' + id], id).toBeTruthy(); }
    for (const e of ['PICKUP', 'BOARD_DENIED', 'WALK_STARTED', 'SIGNAL_RAISED', 'DOCK_DECISION', 'OBSTACLE_PLACED', 'PLAN_COMPRESSED', 'PRESSURE_SPIKE', 'JOINT_LEAK', 'GAS_THRESHOLD', 'IGNITION']) expect(UI['ev.' + e], e).toBeTruthy();
  });
  it('диалоги: 5–8 и более реплик на NPC (ключевые персонажи)', () => {
    for (const id of ['ignat', 'matvey', 'tilda', 'pip', 'mira', 'agata', 'orven', 'foma']) { const d = DIALOGS[id]; const lines = Object.values(d.nodes).reduce((a, n) => a + n.lines.length + n.choices.length, 0); expect(lines, id).toBeGreaterThanOrEqual(5); }
  });
});
