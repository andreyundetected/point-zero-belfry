// Солвер: поиск по ветвям времени. Состояние между ветками = (знания, запечатанность Окна, перенесённый предмет).
// Ветка = программа макро-действий (plans.ts), которая исполняется НА НАСТОЯЩЕЙ симуляции; исход решает симуляция, не таблица.
import { Session, Carry } from './session';
import * as P from './plans';
import { ending } from './news';

export interface State { facts: string[]; sealed: boolean; carry: Carry | null; jumps: number; path: string[] }
export interface Solution { cls: 'A' | 'B' | 'C'; jumps: number; path: string[]; ending: string; headline: string; hash: string; params: string; informed: boolean }
export interface Report {
  seed: number; solutions: Solution[]; minJumpsInformed: number; minJumpsPhysical: number; classes: string[]; classCountInformed: number;
  explored: number; blocked: string[]; ok: boolean; assertions: Record<string, boolean>;
}

interface Final { cls: 'A' | 'B' | 'C'; name: string; needCarry: string; needFacts: string[]; run: P.Prog }
const FINALS: Final[] = [
  ...[480, 540].flatMap((bleedAt) => [1100, 1900].map((keyAt): Final => ({ cls: 'A', name: `A(стравить с ${bleedAt}с, ключ Матвею в ${keyAt}с)`, needCarry: 'key', needFacts: ['K1', 'K2', 'K3', 'K4', 'K5'], run: P.finalA({ bleedAt, keyTo: 'matvey', keyAt }) }))),
  { cls: 'B', name: 'B(билет Тильде)', needCarry: 'coinstack', needFacts: ['K1', 'K6', 'K7'], run: P.finalB },
  ...[1900].map((releaseAt): Final => ({ cls: 'C', name: `C(приказ+вентиль, release ${releaseAt}с)`, needCarry: 'coinstack', needFacts: ['K1', 'K5', 'K9'], run: P.finalC({ releaseAt }) })),
];
interface Branch { name: string; sealedOnly?: boolean; unsealedOnly?: boolean; end: 'window' | 'thread'; run: P.Prog }
const BRANCHES: Branch[] = [
  { name: 'урок ключа', sealedOnly: true, end: 'window', run: P.lesson },
  { name: 'наблюдение до T1', unsealedOnly: true, end: 'thread', run: P.observe },
  { name: 'ключ→Окно', unsealedOnly: true, end: 'window', run: P.carryKey },
  { name: 'монеты Пип→Окно', unsealedOnly: true, end: 'window', run: P.carryCoin },
];
const key = (s: State) => `${s.facts.join(',')}|${s.sealed}|${s.carry?.kind ?? '-'}`;
const isFire = (e: string) => e === 'black' || e === 'silver';

export function solve(seed = 1, maxJumps = 4): Report {
  const start: State = { facts: [], sealed: true, carry: null, jumps: 0, path: [] };
  const seen = new Map<string, number>(); seen.set(key(start), 0);
  let frontier: State[] = [start]; const sols: Solution[] = []; const blocked: string[] = []; let explored = 0;
  for (let depth = 0; depth <= maxJumps && frontier.length; depth++) {
    const next: State[] = [];
    for (const st of frontier) {
      // финальные программы: «информированные» (с гейтом знаний) и «физические» (без гейта)
      for (const f of FINALS) {
        const haveCarry = st.carry?.kind === f.needCarry;
        const haveFacts = f.needFacts.every((x) => st.facts.includes(x));
        if (!haveCarry) { if (depth < 3) blocked.push(`${st.path.join('→') || 'старт'}: ${f.cls} невозможен — нет ${f.needCarry} в руках`); continue; }
        explored++;
        const S = Session.fromState(seed, st.facts, st.sealed, st.carry);
        try { f.run(S); } catch (e) { blocked.push(`${f.name}: ${(e as Error).message}`); continue; }
        const e = ending(S.w);
        if (!isFire(e)) sols.push({ cls: f.cls, jumps: st.jumps, path: [...st.path, f.name], ending: e, headline: S.w.newsId, hash: S.hash(), params: f.name, informed: haveFacts });
        else if (depth < 3) blocked.push(`${st.path.join('→') || 'старт'}: ${f.name} → ${e}`);
      }
      if (depth === maxJumps) continue;
      for (const b of BRANCHES) {
        if (b.sealedOnly && !st.sealed) continue; if (b.unsealedOnly && st.sealed) continue;
        explored++;
        const S = Session.fromState(seed, st.facts, st.sealed, st.carry);
        try { b.run(S); if (b.end === 'thread' && !S.threadReturn()) throw new Error('нить недоступна'); } catch (e) { blocked.push(`${b.name}: ${(e as Error).message}`); continue; }
        const h = S.w.player.hands ? S.w.items[S.w.player.hands] : null;
        const carry: Carry | null = h ? { kind: h.kind, double: true, origVanishT: h.origVanishT ?? 0 } : null;
        const ns: State = { facts: [...S.facts], sealed: S.sealed, carry: S.w.player.hands ? S.carryOf2() : null, jumps: st.jumps + (S.jumps - 0) - (st.jumps), path: [...st.path, b.name] };
        ns.jumps = st.jumps + 1;
        void carry;
        const k = key(ns); const prev = seen.get(k);
        if (prev === undefined || prev > ns.jumps) { seen.set(k, ns.jumps); next.push(ns); }
      }
    }
    frontier = next;
  }
  const informed = sols.filter((s) => s.informed); const phys = sols;
  const minInf = informed.length ? Math.min(...informed.map((s) => s.jumps)) : Infinity;
  const minPhys = phys.length ? Math.min(...phys.map((s) => s.jumps)) : Infinity;
  const classes = [...new Set(informed.filter((s) => s.jumps === minInf || true).map((s) => s.cls))];
  const assertions = {
    'min_jumps(informed) >= 3': minInf >= 3,
    'solution_classes(informed) >= 2': classes.length >= 2,
    'все решения: заголовок != пожар': sols.every((s) => !s.headline.startsWith('news.fire')),
  };
  return { seed, solutions: sols, minJumpsInformed: minInf, minJumpsPhysical: minPhys, classes, classCountInformed: classes.length, explored, blocked: [...new Set(blocked)].slice(0, 40), ok: Object.values(assertions).every(Boolean), assertions };
}
