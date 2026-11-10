import { Flags } from './flags';
import { Kf, NpcPose, poseAt, Sched } from './schedule';
import { at } from './time';
import { wagonPath } from './npcs';

export interface VehicleDef { id: string; kind: 'car' | 'cart' | 'tram' | 'launch'; sched: (f: Flags) => Kf[]; }
const s = (x: number, z: number, ry = 0, a = 'v', t = 0) => new Sched(x, z, ry, a, t);

export const VEHICLES: VehicleDef[] = [
  { id: 'craneCar', kind: 'car', sched: () => { const sc = s(-55.5, -36.5, Math.PI, 'v', 0); sc.wait(at(22, 6)).walk([[-53, -38], [-46, -35], [-38, -33], [-30, -30], [-22, -28], [-14.6, -28], [-14.6, 0], [-14.6, 56]], 7).hide();
    sc.show(at(22, 52, 0), -14.6, 18, 'v', 0).walk([[-14.6, 40], [-12.6, 55]], 6).wait(at(22, 52, 50)).walk([[-14.6, 40], [-14.6, -30]], 7).hide(); return sc.done(); } },
  { id: 'cordCar', kind: 'car', sched: f => { const sc = s(-14.6, -40, 0, 'v', 0); sc.hide(0).show(at(22, 15, 20), -14.6, -34, 'v', 0).walk([[-14.6, -2], [-9, 1.0], [9, 1.0], [14.8, 1], [14.8, 16.5], [30, 17], [58, 17.8]], 8).wait(at(22, 31, 30))
      .walk([[30, 17], [14.8, 16.5], [14.8, 1], [9, 1.0], [-9, 1.0], [-14.6, 2], [-14.6, 50], [-12.6, 56]], 8).wait(at(22, 36)).walk([[-14.6, 40], [-14.6, -40]], 8).hide(); void f; return sc.done(); } },
  { id: 'tram', kind: 'cart' as const, sched: f => { const sc = s(-84, -9.6, Math.PI / 2, 'v', 0); const stuck = !f.has('tapCut');
    if (stuck) { sc.walk([[-18, -9.6]], 4.5).walk([[-52, -9.6]], 4.5).wait(at(22, 13)); sc.cx = -52; sc.cz = -9.6; return sc.end().kfs; }
    for (let i = 0; i < 8; i++) { sc.walk([[-18, -9.6]], 5).wait(sc.ct + 20).walk([[-84, -9.6]], 5).wait(sc.ct + 20); } return sc.done(); } },
  { id: 'wagon', kind: 'cart', sched: f => { const w = wagonPath(f.has('wagonPinPulled')); const sc = s(51.5, -57.5, Math.PI, 'v', 0);
    sc.wait(at(22, 40)).walkBy(w.toGate(0), at(22, 42, 20)).walkBy(w.toBridge(0), at(22, 44));
    if (f.has('wagonPinPulled')) return sc.end('broken').kfs;
    sc.walkBy(w.overBridge(0), at(22, 45)).walkBy(w.toPier(0), at(22, 49, 40)).end(); return sc.kfs; } },
  { id: 'launch', kind: 'launch', sched: f => { const sc = s(-70, 112, Math.PI, 'v', 0); sc.hide(0).show(at(22, 34, 40), -64, 104, 'v', Math.PI).walk([[-45.5, 87], [-44.5, 83.5]], 3.2).wait(at(22, 40)); void f;
    sc.walk([[-36, 90], [-22, 94], [-8, 100], [4, 118]], 4).hide(); return sc.done(); } },
];
export const vehiclePose = (kfs: Kf[], t: number): NpcPose => poseAt(kfs, t);
export const T_WAGON_BRIDGE = at(22, 44);
