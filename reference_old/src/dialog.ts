import data from './data/dialogues.json';
import type { Sim } from './sim/sim';
import { t, npcName, locName } from './i18n';
import { hm } from './sim/util';
import { ACTIONS } from './sim/actions';
import type { Choice } from './ui/ui';

interface DChoice { k: string; to?: string; if?: string; check?: [string, number]; fail?: string; act?: string }
interface DNode { lines: [string, string][]; choices: DChoice[]; fact?: [string, string]; trust?: number; act?: string; next?: string }
interface DNpc { start: [string, string][]; nodes: Record<string, DNode> }
const DATA = data as unknown as { npcs: Record<string, DNpc>; barks: Record<string, string[]>; ctx: Record<string, string[]> };

/** Player skills ("voices"). Checks are deterministic: skill + trust >= difficulty. */
export const SKILLS: Record<string, number> = { obs: 3, hack: 2, emp: 2, cool: 2, logic: 3, mem: 2 };
/** Player growth (Disco-style): survives time jumps. 3 XP = 1 skill point; failed checks stay locked until the skill grows. */
export const progress = { xp: 0, points: 0, add: { obs: 0, hack: 0, emp: 0, cool: 0, logic: 0, mem: 0 } as Record<string, number>, failed: new Map<string, number>(), talked: new Set<string>(), onPoint: () => {} };
export function gainXp(n = 1) { progress.xp += n; while (progress.xp >= 3) { progress.xp -= 3; progress.points++; progress.onPoint(); } }
export const PASSIVE = 4;
const BONUS: Record<string, Record<string, number>> = { eye_scanner: { obs: 1 }, empathy_chip: { emp: 1 }, hack_deck: { hack: 1 }, lockpick: { hack: 1 }, cool_patch: { cool: 1 }, synth_vodka: { cool: 1, logic: -1 }, tea: { logic: 1 } };
/** effective skill = base + bonuses from carried implants/items */
export function skill(s: Sim, k: string) { let v = (SKILLS[k] ?? 0) + (progress.add[k] ?? 0); for (const it of s.world.pinv) v += BONUS[it.replace('*', '')]?.[k] ?? 0; return v; }

/** Condition mini-language: space separated AND tokens. */
export function cond(expr: string | undefined, s: Sim, npc: string): boolean {
  if (!expr) return true;
  const w = s.world, n = w.npcs[npc];
  return expr.split(' ').every(tok => {
    const neg = tok.startsWith('!'); const k = neg ? tok.slice(1) : tok;
    let v: boolean;
    const [a, b] = k.split(':');
    if (k === 'always') v = true;
    else if (k === 'lost_pass') v = s.events.some(e => e.type === 'item_dropped') && !w.npcs.lea.items.includes('tram_pass');
    else if (k === 'blackout') v = w.lockoutUntil > w.t;
    else if (k === 'rain') v = w.rain;
    else if (k === 'alarm') v = w.alarm;
    else if (a === 'fact') v = s.facts.has(b);
    else if (a === 'event') v = s.events.some(e => e.type === b);
    else if (a === 'flag') v = !!w.flags[b];
    else if (a === 'has') v = s.has(b);
    else if (a === 'loc') v = n?.loc === b;
    else if (a === 'before') v = w.t < hm(k.slice(7));
    else if (a === 'after') v = w.t >= hm(k.slice(6));
    else if (k.startsWith('trust>=')) v = ((n?.flags.trust as number) ?? 0) >= +k.slice(7);
    else v = false;
    return neg ? !v : v;
  });
}

export function hasDialog(npc: string) { return !!DATA.npcs[npc] || npc.startsWith('c_'); }

interface Hooks { show: (voice: string, text: string, choices: Choice[], check?: string) => void; close: () => void; act: (id: string) => void; toast: (m: string) => void; echo: string | null }

export class DialogRunner {
  ok = true; node: DNode | null = null; i = 0; queue: { voice: string; text: string; check?: string }[] = [];
  constructor(public npc: string, public sim: Sim, public h: Hooks) {
    if (npc.startsWith('c_')) { this.bark(); return; }
    const d = DATA.npcs[npc]; if (!d) { this.ok = false; return; }
    if (((sim.world.npcs[npc]?.flags.trust as number) ?? 0) <= -2) { this.node = { lines: [], choices: [] }; this.queue = [{ voice: 'npc', text: t('ui.refuse') }]; return; }
    const st = d.start.find(([c]) => cond(c, sim, npc));
    this.enter(st ? st[1] : 'main', true);
  }
  /** ordinary citizens: their personal story + what they are doing right now and why */
  private bark() {
    const arch = /^c_([a-z0-9]+)_/.exec(this.npc)![1], w = this.sim.world, n = w.npcs[this.npc], L = this.sim.defs[this.npc].life;
    const ctx = this.h.echo ? 'echo' : w.lockoutUntil > w.t ? 'blackout' : w.alarm ? 'alarm' : w.rain && (w.t % 2) ? 'rain' : null;
    const pool = ctx ? DATA.ctx[ctx] : DATA.barks[arch] ?? DATA.barks[arch.replace(/\d+$/, '')] ?? DATA.ctx.rain;
    const k = pool[Math.floor(w.t / 7) % pool.length];
    this.queue = [];
    if (L) {
      const who = t('story.who', { name: npcName(this.npc), job: t('job.' + L.job) });
      const parts = [who, t('story.home', { home: locName(L.home) }), t('story.work', { work: locName(L.work) })];
      if (L.spouse) parts.push(t('story.spouse', { sp: npcName(L.spouse), sick: w.npcs[L.spouse]?.flags.sick ? t('story.sick') : '' }));
      if (L.boss && w.npcs[L.boss]) parts.push(t('story.boss', { boss: npcName(L.boss) }));
      parts.push(t(L.car ? 'story.car' : 'story.nocar'));
      this.queue.push({ voice: 'obs', text: parts.join(' ') });
      const nowKey = n.flags.called ? 'now_home' : n.act === 'slack' ? 'now_slack' : n.act === 'hide' ? 'now_flee' : n.act === 'panic' ? 'now_dark' : n.legs.length && n.dest ? 'now_going' : n.act === 'work' || n.act === 'commute' ? 'now_work' : 'now_free';
      this.queue.push({ voice: 'npc', text: t('story.' + nowKey, { dest: n.dest ? locName(n.dest) : '' }) });
      this.known = [this.npc, ...(L.spouse ? [L.spouse] : []), ...(L.boss ? [L.boss] : [])];
    }
    this.queue.push({ voice: 'npc', text: t('dlg.' + k) });
    this.node = { lines: [], choices: [] };
  }
  known: string[] = [];
  private enter(id: string, first = false) {
    const nd = DATA.npcs[this.npc].nodes[id]; if (!nd) return this.h.close();
    this.node = nd; this.queue = [];
    if (first && this.h.echo) this.queue.push({ voice: 'mem', text: t('ui.echo', { what: this.h.echo }) });
    for (const [v, k] of nd.lines) {
      if (SKILLS[v] !== undefined && skill(this.sim, v) < PASSIVE) continue; // passive check: the voice speaks only if you are good enough
      this.queue.push({ voice: v, text: t('dlg.' + k), check: SKILLS[v] !== undefined ? `${skill(this.sim, v)}` : undefined });
    }
    if (!this.queue.length) this.queue.push({ voice: 'narr', text: '…' });
    const n = this.sim.world.npcs[this.npc];
    if (nd.trust && n) n.flags.trust = ((n.flags.trust as number) ?? 0) + nd.trust;
    if (nd.fact && !this.sim.facts.has(nd.fact[0])) this.sim.facts.set(nd.fact[0], nd.fact[1]);
    if (nd.act && this.sim.canAct(nd.act)) this.h.act(nd.act);
  }
  begin() { if (!progress.talked.has(this.npc)) { progress.talked.add(this.npc); gainXp(1); } this.i = 0; this.render(); }
  private render() {
    const L = this.queue[this.i]; if (!L) return this.end();
    const last = this.i === this.queue.length - 1;
    this.h.show(L.voice, L.text, last ? this.choices() : [], L.check);
    const s = this.sim; s.advanceTo(Math.min(s.t1, s.world.t + 10)); // dialogue happens in game time
  }
  private choices(): Choice[] {
    const nd = this.node!; if (nd.next) return [];
    const out: Choice[] = [];
    for (const c of nd.choices) {
      if (!cond(c.if, this.sim, this.npc)) continue;
      if (c.act) { if (!this.sim.canAct(c.act)) continue; out.push({ label: t('dlg.' + c.k), cls: 'act', run: () => this.pick(c) }); continue; }
      if (c.check) {
        const trust = (this.sim.world.npcs[this.npc]?.flags.trust as number) ?? 0;
        const val = skill(this.sim, c.check[0]) + trust, fk = this.npc + '|' + c.k, prev = progress.failed.get(fk);
        const locked = prev !== undefined && val <= prev;
        out.push({ label: `${t('dlg.' + c.k)} <small>(${val}/${c.check[1]})${locked ? ' — ' + t('ui.locked_check') : ''}</small>`, cls: locked ? 'skill fail' : 'skill', run: () => locked ? this.h.toast(t('ui.locked_check')) : this.pick(c) });
      } else out.push({ label: t('dlg.' + c.k), run: () => this.pick(c) });
    }
    out.push({ label: t('ui.leave'), run: () => this.end() });
    return out;
  }
  private pick(c: DChoice) {
    if (c.act) { this.h.act(c.act); this.h.toast(t('ui.act.' + c.act)); this.sim.step(); this.i = this.queue.length - 1; return this.render(); }
    if (c.check) {
      const trust = (this.sim.world.npcs[this.npc]?.flags.trust as number) ?? 0;
      const val = skill(this.sim, c.check[0]) + trust, okc = val >= c.check[1];
      if (okc) gainXp(1); else progress.failed.set(this.npc + '|' + c.k, val);
      if (okc || c.fail) this.enter(okc ? c.to! : c.fail!);
      else { this.node = { lines: [], choices: [] }; this.queue = []; }
      this.queue.unshift({ voice: c.check[0], text: t(okc ? 'ui.check_ok' : 'ui.check_fail') + ' — ' + t('ui.voice.' + c.check[0]), check: '' });
      this.i = 0; return this.render();
    }
    if (c.to) { this.enter(c.to); this.i = 0; return this.render(); }
    this.end();
  }
  advance() {
    if (!this.node) return;
    const nd = this.node;
    if (this.i < this.queue.length - 1) { this.i++; return this.render(); }
    if (nd.next) { this.enter(nd.next); this.i = 0; return this.render(); }
    const ch = this.choices(); if (ch.length <= 1) this.end();
  }
  choose(k: number) { if (this.i !== this.queue.length - 1) return; const ch = this.choices(); ch[k]?.run(); }
  end() { this.node = null; this.h.close(); }
}
void ACTIONS;
