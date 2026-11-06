import type { Game } from './game';
import { t } from './i18n';

/** Guided first steps: each step completes from real game state, never from scripted world events. */
interface Step { id: string; done: (g: Game, s: TutState) => boolean }
interface TutState { x0: number; y0: number; yaw0: number; talked: boolean; logged: boolean; win: boolean; traded: boolean }
const STEPS: Step[] = [
  { id: 'move', done: (g, s) => Math.hypot(g.p.x - s.x0, g.p.y - s.y0) > 8 },
  { id: 'look', done: (g, s) => Math.abs(g.r.yaw - s.yaw0) > 0.6 },
  { id: 'talk', done: (_g, s) => s.talked },
  { id: 'speed', done: g => g.speed >= 4 || g.sim.world.t > 14 * 3600 + 8 * 60 },
  { id: 'pass', done: g => g.sim.has('tram_pass') || g.sim.world.npcs.lea.items.includes('tram_pass') && g.sim.world.t > 14 * 3600 + 9 * 60 },
  { id: 'log', done: (_g, s) => s.logged },
  { id: 'window', done: (_g, s) => s.win },
  { id: 'jump', done: g => g.jumps > 0 },
  { id: 'car', done: g => g.driving },
  { id: 'trade', done: (_g, s) => s.traded },
];

export class Tutorial {
  i = 0; on = false; st: TutState = { x0: 0, y0: 0, yaw0: 0, talked: false, logged: false, win: false, traded: false };
  constructor(public g: Game) {}
  start() { this.on = true; this.i = 0; this.st = { ...this.st, x0: this.g.p.x, y0: this.g.p.y, yaw0: this.g.r.yaw }; this.render(); }
  tick() {
    if (!this.on) return;
    const g = this.g;
    if (g.dlg) this.st.talked = true; if (g.ui.logOn()) this.st.logged = true; if (g.ui.winOpen()) this.st.win = true; if (g.ui.pickOpen() && document.getElementById('pk_t')!.textContent!.includes(t('ui.money'))) this.st.traded = true;
    while (this.i < STEPS.length && STEPS[this.i].done(g, this.st)) { this.i++; g.audio.blip(1320); }
    if (this.i >= STEPS.length) { this.on = false; g.ui.tutorial(null, ''); g.ui.toast(t('tut.done')); return; }
    this.render();
  }
  render() { this.g.ui.tutorial(`${this.i + 1}/${STEPS.length}`, t('tut.' + STEPS[this.i].id)); }
}
