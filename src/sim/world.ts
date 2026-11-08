import { Flags } from './flags';
import { NPCS, NpcDef } from './npcs';
import { Kf, NpcPose, poseAt } from './schedule';
import { at } from './time';
import { VEHICLES } from './vehicles';

export interface Fire { id: string; x: number; z: number; r: number; k: number; }   // k = intensity 0..1
export interface CityState {
  lampsFlicker: boolean; bridgeLampsDead: boolean; tramStuck: boolean; telegraphDead: boolean; bellSilent: boolean; bellRings: boolean;
  rynokBurning: boolean; rynokRuin: boolean; kanatBurning: boolean; blast: boolean; officeBurning: boolean; officeRaided: boolean; safeBlown: boolean;
  bridgePatrol: boolean; wagonPinOut: boolean; glow: number; fires: Fire[]; basementDoorOpen: boolean; wagonOnBridgeBroken: boolean;
}
export function cityState(t: number, f: Flags): CityState {
  const tap = f.has('tapCut');
  const raided = !f.has('jetonStolen') && !f.has('gaylWarned') && !f.has('annaWarned');
  const blast = t >= at(22, 12), rynok = !tap && t >= at(22, 30), ruin = !tap && t >= at(22, 40), kanat = !tap && t >= at(22, 45), office = t >= at(22, 20);
  const fires: Fire[] = [];
  if (blast) fires.push({ id: 'warehouse', x: 66, z: 32, r: 22, k: Math.min(1, 0.6 + (t - at(22, 12)) / 600) });
  if (office) fires.push({ id: 'office', x: 44, z: 27, r: 9, k: Math.min(1, (t - at(22, 20)) / 120) });
  if (rynok) { fires.push({ id: 'foma', x: -40, z: -17, r: 8, k: Math.min(1, (t - at(22, 30)) / 40) }); fires.push({ id: 'd8', x: -33, z: -17, r: 7, k: Math.min(1, (t - at(22, 30, 8)) / 40) }); }
  if (kanat) fires.push({ id: 'kanat', x: -52, z: 40, r: 10, k: Math.min(1, (t - at(22, 45)) / 90) });
  const wagonPinOut = f.has('wagonPinPulled') && t >= at(22, 44);
  return {
    lampsFlicker: !tap && t >= at(22, 5), bridgeLampsDead: !tap && t >= at(22, 18), tramStuck: !tap && t >= at(22, 13), telegraphDead: !tap && t >= at(22, 18),
    bellSilent: !tap && t >= at(22, 22), bellRings: tap && (Math.abs(t - at(22, 30)) < 20 || Math.abs(t - at(22, 45)) < 20), rynokBurning: rynok, rynokRuin: ruin, kanatBurning: kanat,
    blast, officeBurning: office, officeRaided: raided && t >= at(22, 12), safeBlown: raided && t >= at(22, 12), bridgePatrol: tap && t >= at(22, 18), wagonPinOut,
    glow: Math.min(1, fires.reduce((a, b) => a + b.k * 0.35, 0)), fires, basementDoorOpen: t < at(22, 5), wagonOnBridgeBroken: wagonPinOut,
  };
}

/** the deterministic sim: positions of everyone at time t given the flags of the current universe */
export class SimWorld {
  defs = new Map<string, NpcDef>(); private cache = new Map<string, Kf[]>(); private ver = '';
  constructor(public flags: Flags) { for (const n of NPCS) this.defs.set(n.id, n); }
  private rebuild() { const v = this.flags.hash(); if (v === this.ver) return; this.ver = v; this.cache.clear(); }
  kfs(id: string): Kf[] { this.rebuild(); let k = this.cache.get(id); if (!k) { const d = this.defs.get(id); k = d ? d.sched(this.flags) : []; this.cache.set(id, k); } return k; }
  pose(id: string, t: number): NpcPose { return poseAt(this.kfs(id), t); }
  private vcache = new Map<string, Kf[]>(); private vver = '';
  vehicle(id: string, t: number): NpcPose { const v = this.flags.hash(); if (v !== this.vver) { this.vver = v; this.vcache.clear(); } let k = this.vcache.get(id); if (!k) { k = VEHICLES.find(x => x.id === id)!.sched(this.flags); this.vcache.set(id, k); } return poseAt(k, t); }
  setFlags(f: Flags) { this.flags = f; this.ver = ''; }
  city(t: number) { return cityState(t, this.flags); }
}
