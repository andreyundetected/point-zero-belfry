import type { Game } from './game';
import { t } from './i18n';

/** The Employer speaks through the Window. Messages fire from world/game state, never from scripts that bypass the sim. */
export function employerTick(g: Game) {
  const s = g.sim, w = s.world, seen = g.said;
  const say = (k: string) => { if (!seen.has(k)) { seen.add(k); g.ui.employer(t('employer.' + k)); } };
  if (!g.started) return;
  say('intro');
  if (w.t >= 14 * 3600 + 8 * 60 + 30 && s.events.some(e => e.type === 'item_dropped')) say('pass');
  if (g.lastAn > 0) say('first_anomaly');
  if (g.jumps > 0) say('first_jump');
  if (g.echoes.length > 12 && g.jumps >= 3) say('echo_many');
  if (s.events.some(e => e.type === 'emergency_switch')) say('blackout');
  if (w.alarm) say('alarm');
  if (w.t >= 21 * 3600 + 30 * 60 && !w.targetDead) say('time_low');
  if (w.flags.result === 'perfect') say('win');
}

/** A light-touch objective line under the mission: teaches the loop without scripting the world. */
export function objective(g: Game): string {
  const s = g.sim, w = s.world, f = s.facts;
  const passGround = w.ground.some(x => x.item === 'tram_pass'), hasPass = s.has('tram_pass');
  if (['convoy_window', 'password', 'omega_protocol', 'nisa_services'].some(k => f.has(k))) return t('obj.plan');
  if (g.jumps > 0) return t('obj.learn');
  if (g.lastAn > 0) return t('obj.jump');
  if (hasPass) return t('obj.give');
  if (passGround && w.t < 17 * 3600) return t('obj.pass');
  return t('obj.look');
}
