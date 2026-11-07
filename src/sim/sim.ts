import type { Sim } from './types';
import { has, flag, fmtMin, min, WINDOW } from './types';
import { NPCS, eventsAt, type NpcDef, type Step } from '../content/schedule';
import { place } from '../content/places';

export interface NpcView {
  id: string;
  x: number;
  z: number;
  anim: string;
  face: number;
  visible: boolean;
  walking: boolean;
}

function routeLength(path: string[]) {
  let total = 0;
  const segs: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = place(path[i]), b = place(path[i + 1]);
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    segs.push(d);
    total += d;
  }
  return { total, segs };
}

function alongPath(path: string[], frac: number): { x: number; z: number; face: number } {
  const { total, segs } = routeLength(path);
  if (total < 0.001) {
    const p = place(path[0]);
    return { x: p.x, z: p.z, face: 0 };
  }
  let d = Math.max(0, Math.min(1, frac)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const a = place(path[i]), b = place(path[i + 1]);
      const t = segs[i] > 0 ? d / segs[i] : 0;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      return { x, z, face: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    d -= segs[i];
  }
  const p = place(path[path.length - 1]);
  return { x: p.x, z: p.z, face: 0 };
}

function stepActive(step: Step, sim: Sim) {
  if (step.ifFlag && !flag(sim, step.ifFlag)) return false;
  if (step.unlessFlag && flag(sim, step.unlessFlag)) return false;
  return true;
}

/** Позиция NPC по расписанию и флагам текущего мира. */
export function npcView(def: NpcDef, sim: Sim): NpcView {
  const tMin = sim.t / 60;
  const step = def.schedule.find((s) => tMin >= s.from && tMin < s.to && stepActive(s, sim));
  if (!step || step.hidden) return { id: def.id, x: 0, z: 0, anim: 'idle', face: 0, visible: false, walking: false };

  if (step.path) {
    const frac = (tMin - step.from) / Math.max(0.001, step.to - step.from);
    const p = alongPath(step.path, frac);
    return { id: def.id, x: p.x, z: p.z, anim: 'walk', face: p.face, visible: true, walking: true };
  }
  const p = place(step.place ?? 'market');
  const off = step.offset ?? [0, 0];
  return {
    id: def.id,
    x: p.x + off[0],
    z: p.z + off[1],
    anim: step.anim ?? 'idle',
    face: step.face ?? 0,
    visible: true,
    walking: false,
  };
}

/** Все NPC, которых видно в эту минуту. */
export function npcViews(sim: Sim): NpcView[] {
  return NPCS.map((n) => npcView(n, sim)).filter((v) => v.visible);
}

export function npcAt(sim: Sim, id: string): NpcView | null {
  const def = NPCS.find((n) => n.id === id);
  if (!def) return null;
  const v = npcView(def, sim);
  return v.visible ? v : null;
}

export function npcAvailable(sim: Sim, id: string): boolean {
  return npcAt(sim, id) !== null;
}

/** Ближайший живой NPC в радиусе. */
export function nearestNpc(sim: Sim, x: number, z: number, r = 2.4): NpcView | null {
  let best: NpcView | null = null;
  let bd = r * r;
  for (const v of npcViews(sim)) {
    if (v.id === 'krayn' && sim.t / 60 < 5) continue;
    const d = (v.x - x) ** 2 + (v.z - z) ** 2;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

export interface ThreadInfo { key: string; ru: string; en: string; marker: string[]; }

const THREADS: Record<string, ThreadInfo> = {
  orven: { key: 'orven', ru: 'Орвен, ключник. Переулок Ключников', en: 'Orven the keymaker. Keymakers alley', marker: ['orven'] },
  orven_late: { key: 'orven_late', ru: 'Заперто. Вернуться на пару минут назад?', en: 'Locked. Go back a few minutes?', marker: ['orven'] },
  ned: { key: 'ned', ru: 'Нед: рыжий, фуражка с медной бляхой. «Якорь», за мостом', en: 'Ned: red-haired, courier cap. The Anchor, across the bridge', marker: ['bridge', 'tavern'] },
  tavern: { key: 'tavern', ru: 'Таверна «Якорь»: люди Корда, ключ', en: 'The Anchor: Kord’s men, the key', marker: ['tavern'] },
  gun: { key: 'gun', ru: 'Ствол. Лавка Фомы, Рыночная', en: 'A gun. Foma’s pawnshop, Market street', marker: ['foma'] },
  fight: { key: 'fight', ru: 'Вернуться в «Якорь», пока они там (до 22:12)', en: 'Back to the Anchor while they’re still there (before 22:12)', marker: ['tavern'] },
  key: { key: 'key', ru: 'Что открывает ключ? Орвен точил ключи (до 22:10)', en: 'What does the key open? Orven cuts keys (before 22:10)', marker: ['orven'] },
  safe: { key: 'safe', ru: 'Сейф Гейла. Курьерская контора', en: 'Gale’s safe. Courier office', marker: ['office'] },
  safe_early: { key: 'safe_early', ru: 'Сейф: нужно раньше 22:10', en: 'The safe: get there before 22:10', marker: ['office'] },
  anna: { key: 'anna', ru: 'Предупредить Анну. Приют св. Лукии', en: 'Warn Anna. St Lucia shelter', marker: ['shelter'] },
  tikhon: { key: 'tikhon', ru: 'Рулевой Тихон. Канатная, 4', en: 'Helmsman Tikhon. Ropemakers 4', marker: ['tikhon'] },
  wagon: { key: 'wagon', ru: 'Повозка в 22:40 → пирс 7', en: 'The wagon at 22:40 → pier 7', marker: ['shelter', 'bridge', 'pier7'] },
  tilda: { key: 'tilda', ru: 'Тильда у баржи. Лента Анки', en: 'Tilda at the barge. Anka’s ribbon', marker: ['pier7'] },
  pier3: { key: 'pier3', ru: 'Пристань №3, 22:35. Стать рулевым', en: 'Pier 3, 22:35. Become the helmsman', marker: ['pier3'] },
  pier7: { key: 'pier7', ru: 'Пирс 7. Ни слова ему', en: 'Pier 7. Not a word to him', marker: ['pier7'] },
  tower: { key: 'tower', ru: 'Подвал башни, 22:00. Отвод', en: 'Tower basement, 22:00. The tap', marker: ['tower'] },
};

export function currentThread(sim: Sim): ThreadInfo {
  if (sim.finale) return THREADS.pier7;
  if (sim.t >= WINDOW) return THREADS.pier7;
  if (flag(sim, 'tapCut') && has(sim, 'tapKnown') && !has(sim, 'tapDone')) return THREADS.tower;

  if (has(sim, 'pier3')) return THREADS.pier3;
  if (has(sim, 'tikhon')) return THREADS.tikhon;
  if (has(sim, 'safe')) return sim.t > min(10) ? THREADS.safe_early : THREADS.safe;
  if (has(sim, 'gun') && !has(sim, 'gunTaken')) return THREADS.gun;
  if (has(sim, 'gunTaken') && !has(sim, 'tavernCleared')) return THREADS.fight;
  if (has(sim, 'fomaHint') && !has(sim, 'gunTaken')) return THREADS.gun;
  if (has(sim, 'tavern')) return has(sim, 'gunTaken') ? THREADS.fight : THREADS.gun;
  if (has(sim, 'ned')) return has(sim, 'tavernSeen') ? THREADS.tavern : THREADS.ned;
  if (has(sim, 'orvenLate')) return THREADS.orven_late;
  if (has(sim, 'orven')) return THREADS.ned;
  if (sim.t >= min(10)) return THREADS.orven_late;
  return THREADS.orven;
}

export function threadText(t: ThreadInfo, lang: 'ru' | 'en') {
  return lang === 'ru' ? t.ru : t.en;
}

/** События, которые случились к этой минуте (для Створки и журнала). */
export function timeline(sim: Sim): { t: number; ru: string; en: string }[] {
  const out: { t: number; ru: string; en: string }[] = [];
  for (let m = 0; m <= Math.floor(sim.t / 60); m++) {
    for (const e of eventsAt(m, sim.flags)) out.push({ t: m * 60, ru: e.ru, en: e.en });
  }
  return out;
}

/** Точная копия мира для прыжка: знания и Карман едут, изменения — нет. */
export function branchState(sim: Sim, t: number): Sim {
  return {
    ...sim,
    t,
    branch: sim.branch + 1,
    flags: {},
    branchChanges: [],
    fired: new Set<string>(),
    parent: sim.branch,
    jumps: sim.jumps + 1,
    finale: false,
    finaleChoice: null,
    ended: null,
  };
}

export { fmtMin };
