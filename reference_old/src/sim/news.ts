import type { Sim } from './sim';
import { fmt, hm } from './util';

export interface Headline { key: string; params?: Record<string, string> }

/** Vector-24 headlines are a pure function of the world state: change the world, change the news. */
export function headlines(s: Sim): Headline[] {
  const w = s.world, t = w.t, out: Headline[] = [];
  const blackout = w.lockoutUntil > t;
  out.push({ key: w.rain ? 'rain' : 'dry' });
  out.push({ key: 'promo', params: { left: fmt(Math.max(0, hm('22:00') - t)) } });
  out.push({ key: blackout ? 'traffic_dead' : 'traffic_ok' });
  if (blackout) out.push({ key: 'blackout', params: { until: fmt(w.lockoutUntil) } });
  if (w.clinicPower === 'gen') out.push({ key: 'clinic_gen' });
  if (w.clinicPower === 'off' || w.mara === 'critical') out.push({ key: 'clinic_off' });
  if (w.docsShown) out.push({ key: 'docs' });
  if (w.launch === 'postponed') out.push({ key: 'postponed' });
  if (w.flags.stallStart !== undefined && t >= (w.flags.stallStart as number) && t < (w.flags.stallStart as number) + 1200) out.push({ key: 'tram_bridge' });
  if (w.flags.hart_down && w.flags.loop) out.push({ key: 'camera_glitch' });
  if (w.alarm && !w.targetDead) out.push({ key: 'security' });
  if (w.targetDead) out.push({ key: 'breaking_lash' });
  if (s.events.some(e => e.type === 'item_dropped')) out.push({ key: 'lost_pass' });
  if (s.events.some(e => e.type === 'kay_dispersed')) out.push({ key: 'kay_dispersed' });
  if (s.events.some(e => e.type === 'osip_stays')) out.push({ key: 'convoy_driver' });
  return out;
}
export const SCREENS = ['market', 'bar', 'clinic', 'tower_hall'];
