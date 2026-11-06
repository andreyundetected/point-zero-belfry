import { T1 } from './map';
import { World } from './core';
import { tavernZone } from './systems';

/** Заголовок «Вестника» по состоянию мира (≥3 разных заголовка). */
export function headline(w: World): string {
  if (w.fire.started) return pipAtRisk(w) ? 'news.fire_pip' : (anyoneInside(w) ? 'news.fire' : 'news.fire_saved');
  if (w.t >= T1 - 1) return w.lampsDone ? 'news.gold' : 'news.dark';
  if (w.gas.thresholdEv) return 'news.gas';
  if (w.flicker) return 'news.flicker';
  if (w.dock.state === 'unloaded') return 'news.barge';
  if (w.sem.closed) return 'news.port_closed';
  return 'news.prep';
}
const anyoneInside = (w: World) => ['agata', 'foma', 'pip'].some((id) => !w.npcs[id].safe && tavernZone(w.npcs[id].node));
export const pipAtRisk = (w: World) => { const p = w.npcs.pip; return !p.safe && !!tavernZone(p.node) && !p.m.escort; };

export type Ending = 'gold' | 'silver' | 'bronze' | 'black';
export function ending(w: World): Ending {
  if (w.fire.started) return pipAtRisk(w) || w.npcs.agata.hurt > 8 || w.npcs.pip.hurt > 0 ? 'black' : 'silver';
  return w.lampsDone ? 'gold' : 'bronze';
}
export const isFire = (w: World) => w.fire.started;
