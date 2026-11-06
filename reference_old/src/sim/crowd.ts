import type { Loc, NpcDef } from './types';
import { hrand, fmt } from './util';
import { CELL } from './grid';

/**
 * Citizens with personal lives. Each has a home door and a workplace somewhere in the city, maybe a spouse
 * (who may be ill), maybe a car, maybe a boss. Their day is a schedule; the 'citizen' rules can break it:
 * a sick spouse keeps them home (they call the boss), an absent boss sends them to a cafe, a blackout or an
 * alarm nearby sends them running home.
 */
interface Arch { id: string; n: number; work?: string; pattern: 'day' | 'evening' | 'kid' | 'free'; rel: string[]; menace?: number; carP?: number }
const ARCHES: Arch[] = [
  { id: 'trader', n: 8, work: 'market', pattern: 'day', rel: ['nisa', 'yuna'] },
  { id: 'noodle', n: 3, work: 'market', pattern: 'evening', rel: ['yuna', 'courier'] },
  { id: 'clerk', n: 12, pattern: 'day', rel: ['ila', 'dana'], carP: 0.5 },
  { id: 'guard', n: 6, work: 'tower_front', pattern: 'evening', rel: ['dana', 'burn'], carP: 0.4 },
  { id: 'engineer', n: 4, work: 'substation', pattern: 'day', rel: ['yan', 'pike'], carP: 0.4 },
  { id: 'nurse', n: 6, work: 'clinic', pattern: 'evening', rel: ['sol', 'mara'] },
  { id: 'patron', n: 8, pattern: 'free', rel: ['ro', 'mok'] },
  { id: 'student', n: 10, work: 'school', pattern: 'kid', rel: ['lea', 'yuna'] },
  { id: 'teacher', n: 3, work: 'school', pattern: 'day', rel: ['lea', 'ro_wife'], carP: 0.3 },
  { id: 'taxi', n: 8, pattern: 'free', rel: ['yan', 'ro'], carP: 1 },
  { id: 'mechanic', n: 4, work: 'garage', pattern: 'evening', rel: ['osip', 'feld'], carP: 0.6 },
  { id: 'dispatcher', n: 3, work: 'dispatch', pattern: 'evening', rel: ['vera', 'burn'] },
  { id: 'crew', n: 4, work: 'bridge', pattern: 'day', rel: ['gas', 'hart'] },
  { id: 'depotman', n: 4, work: 'depot', pattern: 'day', rel: ['lior', 'emil'] },
  { id: 'worker', n: 16, pattern: 'day', rel: ['osip', 'dana'], carP: 0.45 },
  { id: 'shopkeep', n: 10, pattern: 'evening', rel: ['nisa', 'mok'], carP: 0.3 },
  { id: 'courier2', n: 6, pattern: 'free', rel: ['courier', 'yuna'], carP: 0.5 },
  { id: 'drifter', n: 5, pattern: 'free', rel: ['mok', 'kay'] },
  { id: 'lookout', n: 3, work: 'bar', pattern: 'evening', rel: ['mok', 'collector2'], menace: 0.15 },
  { id: 'resident', n: 14, pattern: 'free', rel: ['ro_wife', 'osip'], carP: 0.3 },
];

/** Procedural places: home doors, workplaces and cafes on sidewalks all over the city. */
export function genPlaces(seed: number, keyLocs: Loc[]): Loc[] {
  const out: Loc[] = [];
  const ok = (x: number, y: number) => !(x > 2440 && x < 2760) && x > -100 && x < 3700 && y > -500 && y < 1700 && !keyLocs.some(l => Math.hypot(l.x - x, l.y - y) < 70);
  const put = (prefix: string, kind: string, n: number, salt: number) => {
    let i = 0, tries = 0;
    while (i < n && tries++ < 3000) {
      const gx = Math.floor(hrand(seed, salt, tries, 'x') * 37) * CELL, gy = Math.floor(hrand(seed, salt, tries, 'y') * 22 - 5) * CELL;
      const along = 20 + hrand(seed, salt, tries, 'a') * 60, side = hrand(seed, salt, tries, 's') < 0.5 ? 1 : -1, horiz = hrand(seed, salt, tries, 'h') < 0.5;
      const x = horiz ? gx + along : gx + side * 12.5, y = horiz ? gy + side * 12.5 : gy + along;
      if (!ok(x, y) || out.some(p => Math.hypot(p.x - x, p.y - y) < 25)) continue;
      out.push({ id: `${prefix}${++i}`, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, kind });
    }
  };
  put('h_', 'home', 60, 1); put('w_', 'office', 26, 2); put('k_', 'cafe', 14, 3);
  return out;
}

export function genCrowd(seed: number, dist: Map<string, number> = new Map(), places: Loc[] = []): NpcDef[] {
  const homes = places.filter(p => p.kind === 'home').map(p => p.id), works = places.filter(p => p.kind === 'office').map(p => p.id), cafes = places.filter(p => p.kind === 'cafe').map(p => p.id);
  if (!homes.length) homes.push('kolco'); if (!works.length) works.push('market'); if (!cafes.length) cafes.push('market');
  const out: NpcDef[] = []; let n = 0;
  const bosses = new Map<string, string>(); // workplace -> first citizen there (the boss)
  for (const a of ARCHES) for (let i = 0; i < a.n; i++) {
    const id = `c_${a.id}_${i + 1}`, r = (k: string) => hrand(seed, id, k); n++;
    const T = (m: number) => fmt(Math.round(m) * 60), J = (base: number, spread: number, k: string) => base + (r(k) - 0.5) * 2 * spread;
    // couples share a home: every second citizen of a kind lives with the previous one
    const home = homes[Math.floor((i % 2 === 1 && r('pair') < 0.6 ? n - 1 : n) * 7.31 % homes.length)];
    const work = a.work ?? works[Math.floor(r('work') * works.length)];
    const cafe = cafes[Math.floor(r('cafe') * cafes.length)], cafe2 = cafes[Math.floor(r('cafe2') * cafes.length)];
    const car = r('car') < (a.carP ?? 0.15);
    const sched: [string, string, string][] = [];
    const b0 = J(15 * 60 + 20, 50, 'brk');
    if (a.pattern === 'day') sched.push(['14:00', work, 'work'], [T(b0), cafe, 'break'], [T(b0 + 25 + r('bl') * 15), work, 'work'], [T(J(17 * 60 + 40, 70, 'end')), cafe2, 'errand'], [T(J(19 * 60 + 30, 40, 'home')), home, 'home'], [T(J(20 * 60 + 50, 30, 'out')), r('o') < 0.4 ? 'bar' : cafe, 'evening'], [T(J(21 * 60 + 40, 10, 'back')), home, 'home']);
    else if (a.pattern === 'evening') sched.push(['14:00', home, 'home'], [T(J(14 * 60 + 35, 20, 'e0')), cafe, 'errand'], [T(J(15 * 60 + 25, 15, 'e1')), home, 'home'], [T(J(16 * 60 + 40, 70, 'go')), work, 'commute']);
    else if (a.pattern === 'kid') sched.push(['14:00', work, 'school'], [T(J(16 * 60 + 30, 15, 'end')), cafe, 'hangout'], [T(J(18 * 60 + 40, 20, 'home')), home, 'home']);
    else sched.push(['14:00', home, 'home'], [T(J(14 * 60 + 40, 30, 'e0')), cafe2, 'errand'], [T(J(15 * 60 + 40, 40, 'e1')), cafe, 'errand'], [T(J(16 * 60 + 50, 30, 'eh')), home, 'home'], [T(J(17 * 60 + 50, 40, 'e2')), a.id === 'patron' ? 'bar' : works[Math.floor(r('vw') * works.length)], 'visit'], [T(J(19 * 60 + 40, 40, 'e3')), cafes[Math.floor(r('c3') * cafes.length)], 'errand'], [T(J(21 * 60, 40, 'h')), home, 'home']);
    if (a.id === 'taxi') { sched.length = 0; sched.push(['14:00', 'taxi', 'work'], [T(J(15 * 60, 30, 'r1')), cafes[Math.floor(r('t1') * cafes.length)], 'drive'], [T(J(16 * 60 + 30, 30, 'r2')), 'taxi', 'work'], [T(J(18 * 60, 40, 'r3')), cafes[Math.floor(r('t3') * cafes.length)], 'drive'], [T(J(19 * 60 + 40, 30, 'r4')), 'taxi', 'work']); }
    const boss = a.work ? (a.rel[0]) : bosses.get(work) ?? (bosses.set(work, id), undefined);
    const okRel = [...a.rel, 'dana', 'osip'].filter(k => (dist.get(k) ?? 0) <= 3);
    const spouse = i % 2 === 1 && r('pair') < 0.6 ? `c_${a.id}_${i}` : undefined;
    const rel: [string, string][] = [[okRel[0], 'acq'], [okRel[1], 'acq']];
    if (spouse) rel.push([spouse, 'family']);
    out.push({ id, loc: sched[0][1], car, menace: a.menace, behaviors: ['crowd', 'citizen'], sched, rel,
      life: { home, work, car, spouse, boss, sick: r('sick') < 0.25, job: a.id } } as NpcDef);
  }
  return out;
}
