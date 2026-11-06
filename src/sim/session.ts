// Сессия игрока: ветка времени, прыжки Окна, знания, перенос предмета. Единый API для игры и солвера.
import { createWorld, step } from './world';
import { Iv, World, emit, hasFact } from './core';
import { NODES, OBJS, TICK, T1, TIMES, dist2d, findPath, nearestNode } from './map';
import { dialogStart, dialogView, resolveChoice } from './dialog';
import { hashState } from './rng';
import { ending, Ending } from './news';
import { P } from './params';

type DOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;
export type IvIn = DOmit<Iv, 't'>;
export interface Carry { kind: string; double: boolean; origVanishT: number }
export interface BranchInfo { n: number; ended: boolean; looked: boolean }

export class Session {
  w!: World;
  ivs: Iv[] = [];
  queue: Iv[] = [];
  facts: string[] = [];
  sealed = P.sealedFirstJump;
  jumps = 0;
  branchNo = 0;
  ended = false;       // ветка дошла до T1 (или заглянули вперёд)
  looked = false;
  history: { kind: string; at: number; carry: string | null }[] = [];
  private snaps: { w: World; ivs: Iv[] }[] = [];
  constructor(public seed: number, opts: { sealed?: boolean } = {}) {
    if (opts.sealed !== undefined) this.sealed = opts.sealed;
    this.startBranch(null);
  }
  get t() { return this.w.t; }
  get player() { return this.w.player; }

  /** Восстановить состояние между ветками (для солвера): знания, запечатанность, перенесённый предмет. */
  static fromState(seed: number, facts: string[], sealed: boolean, carry: Carry | null): Session {
    const S = new Session(seed, { sealed }); S.facts = [...facts]; S.sealed = sealed; S.startBranch(carry); return S;
  }
  startBranch(carry: Carry | null) {
    this.w = createWorld(this.seed, { facts: this.facts, sealed: this.sealed, carry });
    this.ivs = []; this.queue = []; this.ended = false; this.looked = false; this.branchNo++;
  }

  /** Продвинуть мир на secs игровых секунд (применяя накопленные вмешательства). */
  advance(secs: number) {
    const end = Math.min(this.w.t + secs, T1);
    while (this.w.t < end - 1e-9) {
      const batch = this.queue; this.queue = [];
      for (const b of batch) this.ivs.push(b);
      step(this.w, batch);
    }
    if (this.w.t >= T1 - 1e-9 && !this.ended) this.finishBranch();
  }
  advanceTo(t: number) { if (t > this.w.t) this.advance(t - this.w.t); }

  private finishBranch() {
    this.ended = true;
    if (this.w.fire.started) this.learnFact('K1');
    this.syncFacts();
  }
  private learnFact(f: string) { if (!this.w.player.facts.includes(f)) { this.w.player.facts.push(f); this.w.player.facts.sort(); } }
  private syncFacts() { this.facts = [...this.w.player.facts]; }

  /** Вмешательство игрока в текущий момент (+ его стоимость в игровом времени). */
  do(iv: IvIn, cost = 0): void {
    if (this.ended) return;
    const full = { ...iv, t: this.w.t } as Iv;
    this.queue.push(full);
    // применяем в ближайший тик
    this.advance(Math.max(TICK, cost));
    this.syncFacts();
  }
  move(x: number, z: number, floor?: number, st?: number) {
    if (this.ended) return;
    this.queue.push({ t: this.w.t, k: 'move', x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, floor, st } as Iv);
  }

  // ----- диалог/осмотр -----
  talk(npc: string, choices: string[]): { ok: boolean; log: string[] } {
    const w = this.w; const log: string[] = [];
    let node = dialogStart(w, npc);
    this.advance(6 * (dialogView(w, npc, node)?.lines.length ?? 1));
    for (const c of choices) {
      const view = dialogView(this.w, npc, node);
      if (!view || !view.choices.find((x) => x.id === c)) { log.push('нет варианта ' + c + '@' + node); return { ok: false, log }; }
      const r = resolveChoice(this.w, npc, node, c);
      this.do({ k: 'say', npc, node, choice: c }, r.cost);
      log.push(`${npc}.${node}.${c}${r.ok ? '' : ':провал'}`);
      if (!r.next) break; node = r.next;
    }
    return { ok: true, log };
  }
  inspect(obj: string) { this.do({ k: 'inspect', obj }, 4); }
  use(obj: string, arg?: number | string) { this.do({ k: 'use', obj, arg }, 5); }
  take(item: string) { this.do({ k: 'take', item }, 2); }
  give(npc: string) { this.do({ k: 'give', npc }, 3); }

  // ----- перемещение игрока (для солвера и автопилота) -----
  /** Идёт по графу до узла; скорость по стойке (0 шаг 3, 1 крадётся 1.5, 2 бег 5 м/с). */
  goto(node: string, st = 2, endOff?: { x: number; z: number }) {
    const p = this.w.player;
    const from = nearestNode(p.x, p.z, Math.round(p.floor));
    const r = findPath(from, node, new Set(this.w.blocked));
    if (!r) throw new Error(`нет пути ${from}→${node}`);
    const sp = st === 1 ? 1.5 : st === 0 ? 3 : 5;
    const pts = r.path.map((id) => ({ x: NODES[id].x, z: NODES[id].z, f: NODES[id].floor ?? 0 }));
    if (endOff) pts[pts.length - 1] = { x: pts[pts.length - 1].x + endOff.x, z: pts[pts.length - 1].z + endOff.z, f: pts[pts.length - 1].f };
    let cx = p.x, cz = p.z;
    for (const q of pts) {
      let d = dist2d(cx, cz, q.x, q.z);
      while (d > 1e-6 && !this.ended) {
        const stp = Math.min(sp * TICK, d); const k = stp / d;
        cx += (q.x - cx) * k; cz += (q.z - cz) * k; d = dist2d(cx, cz, q.x, q.z);
        this.move(cx, cz, q.f, st); this.advance(TICK);
      }
    }
    this.move(cx, cz, pts[pts.length - 1].f, 0); this.advance(TICK);
  }
  /** К объекту симуляции. */
  gotoObj(obj: string, st = 2) { const o = OBJS[obj]; this.goto(o.node, st, { x: o.x - NODES[o.node].x, z: o.z - NODES[o.node].z }); }
  /** К НПС (в 1.6 м от него, на уровне его узла). */
  gotoNpc(id: string, st = 2) {
    const n = this.w.npcs[id]; const node = n.node;
    this.goto(node, st, { x: n.x - NODES[node].x + 1.2, z: n.z - NODES[node].z });
    this.move(n.x + 1.2, n.z, n.floor, 0); this.advance(TICK);
  }
  wait(secs: number) { this.advance(secs); }
  waitUntil(t: number) { this.advanceTo(t); }

  // ----- Окно -----
  get nearWindow() { const p = this.w.player; return dist2d(p.x, p.z, OBJS.window.x, OBJS.window.z) <= OBJS.window.r + 1; }
  canUseWindow(): { ok: boolean; why?: string } {
    if (this.ended && !this.looked) return { ok: false, why: 'ended' };
    if (!this.nearWindow && !this.looked) return { ok: false, why: 'far' };
    if (!this.w.towerOpen && !this.looked) return { ok: false, why: 'cordon' };
    return { ok: true };
  }
  /** Что унесёт Карман: предмет в руках; мерцающий двойник нести нельзя. */
  carryOf(): Carry | null {
    const h = this.w.player.hands ? this.w.items[this.w.player.hands] : null;
    if (!h) return null;
    if (h.double && !h.vanished && !h.real) return null;
    if (h.kind === 'bundle') return null;
    const origVanishT = h.origVanishT ?? h.takenAt ?? this.w.t;
    return { kind: h.kind, double: true, origVanishT };
  }
  /** Предмет, который игрок держит после прыжка (двойник), как состояние для следующей ветки. */
  carryOf2(): Carry | null {
    const h = this.w.player.hands ? this.w.items[this.w.player.hands] : null;
    return h ? { kind: h.kind, double: true, origVanishT: h.origVanishT ?? h.takenAt ?? 0 } : null;
  }
  /** Прыжок вперёд: мир считается до T1, ветка заканчивается. */
  look(): boolean {
    const c = this.canUseWindow(); if (!c.ok || this.looked) return false;
    if (this.sealed) return false;
    this.advance(P.windowSpin ?? 30);
    this.jumps++; this.history.push({ kind: 'look', at: this.w.t, carry: null });
    this.advanceTo(T1);
    this.looked = true; this.ended = true; this.finishBranch();
    return true;
  }
  /** Прыжок назад в T0 (из Окна). При запечатанном Окне — только с ключом (урок). */
  returnT0(): boolean {
    const c = this.canUseWindow(); if (!c.ok) return false;
    const carry = this.carryOf();
    if (this.sealed) {
      if (!carry || carry.kind !== 'key') return false;
      this.sealed = false;
    }
    if (!this.looked) this.advance(30);
    this.syncFacts();
    this.jumps++; this.history.push({ kind: 'return', at: this.w.t, carry: carry?.kind ?? null });
    this.startBranch(carry);
    return true;
  }
  /** «Нить»: возврат после конца ветки; несёт только знания. */
  threadReturn(): boolean {
    if (!this.ended || this.looked || this.sealed) return false;
    this.syncFacts();
    this.jumps++; this.history.push({ kind: 'thread', at: this.w.t, carry: null });
    this.startBranch(null);
    return true;
  }
  snapshot() { this.snaps.push({ w: structuredClone(this.w), ivs: [...this.ivs] }); return this.snaps.length - 1; }
  restore(i: number) { const s = this.snaps[i]; if (!s || this.sealed) return false; this.w = structuredClone(s.w); this.ivs = [...s.ivs]; this.queue = []; this.ended = false; this.jumps++; return true; }

  // ----- итоги -----
  get ending(): Ending { return ending(this.w); }
  get headline() { return this.w.newsId; }
  hash() { return hashState({ w: this.w, ivs: this.ivs.length }); }
}
export { hasFact, emit };
