import { Flags } from './flags';
import { Kf, Sched } from './schedule';
import { at } from './time';
import { faceTo, inSite, loc, floorY, SITES } from './sites';
import { groundH } from '../world/terrain';
import type { Look } from '../game/people';

// ---------- who is who: the 4 Mixamo bodies x coat x hat x extras (spec 7, 3.5). `look` is data only: no THREE here.
const COAT = { a: 0x2b2a28, b: 0x3a352e, c: 0x26292d, d: 0x4a4238, e: 0x1d1e20, grey: 0x5a5a58, apron: 0x6b6358 };
export interface NpcDef { id: string; name: { ru: string; en: string }; look: Look; sched: (f: Flags) => Kf[]; key?: boolean; interact?: string; civ?: boolean; role?: string; }

const TAV = (lx: number, lz: number) => inSite('tavern', lx, lz);
const TABLE = TAV(0.2, -3.6);
// tavern seats around the long table (local coords)
export const SEATS: [number, number][] = [[-1.5, -2.45], [-0.3, -2.45], [0.9, -2.45], [2.1, -2.45], [-1.5, -4.75], [-0.3, -4.75], [0.9, -4.75], [2.1, -4.75], [-2.8, -3.6], [3.2, -3.6]];
const seat = (i: number) => { const p = TAV(SEATS[i][0], SEATS[i][1]); return { ...p, ry: faceTo(p.x, p.z, TABLE.x, TABLE.z) }; };
const TAV_DOOR = loc('tavern', 0, 0.9);
const TAV_YARD = loc('tavern', -4.5, -9.5);

const roofY = () => groundH(-70, -54) - 0.3 + 9 * 3.1 + 0.8;
export const ROOF_Y = roofY;
export const BASEMENT_Y = () => groundH(-70, -58) - 5.6;
export const ROOF = { cx: -70, cz: -58, x0: -73.6, x1: -66.4, z0: -61.6, z1: -54.4 };

const s = (x: number, z: number, ry = 0, a = 'idle', t = 0, y?: number) => new Sched(x, z, ry, a, t, y);
const SCENE_BARGE = { x: -5.7, z: 60.2 };

function walkLoop(x0: number, z0: number, pts: [number, number][], speed: number, phase: number): Kf[] {
  const sc = s(x0, z0, 0, 'walk', 0); const full: [number, number][] = [...pts, [x0, z0]]; let guard = 0;
  // start inside the loop at `phase` seconds: simply wait first (hidden before the first key is fine for civilians)
  sc.wait(phase, 'idle');
  while (sc.ct < 3700 && guard++ < 400) { for (const p of full) { sc.walk([p], speed, 'walk'); sc.wait(sc.ct + 2 + (guard % 4), 'idle'); } }
  return sc.done();
}


/** the orphanage wagon route (spec 9.4), explicit waypoints; `off` shifts guards sideways */
export function wagonPath(pinPulled: boolean) {
  const sh = (p: [number, number], o: number): [number, number] => [p[0] + o * 0.6, p[1] + o * 0.8];
  return {
    toGate: (o: number): [number, number][] => [[49.5 + o, -52], [47 + o * 0.6, -48]],
    toBridge: (o: number): [number, number][] => [sh([40, -45], o), sh([30, -30], o), sh([20, -6], o), [14 + o * 0.4, -2], [9.5, 0.6 + o * 0.5]],
    overBridge: (o: number): [number, number][] => [[0, 0.8 + o * 0.5], [-9.5, 0.8 + o * 0.5]],
    toPier: (o: number): [number, number][] => [[-13.5 + o * 0.5, 4], [-13.5 + o * 0.5, 50], [-11 + o * 0.5, 57]],
    pin: pinPulled,
  };
}

export const NPCS: NpcDef[] = [];
const add = (d: NpcDef) => { NPCS.push(d); return d; };

// ============ WEST
add({ id: 'crane', name: { ru: 'Эвелина Крайн', en: 'Evelina Crane' }, key: true, look: { body: 'liza', coat: 0x26292d, trou: 0x1c1c1e, long: true, hat: 'veil', extra: ['cane'], scale: 1.0 },
  sched: () => { const y = roofY(); const sc = s(-70.4, -60.6, faceTo(-70.4, -60.6, -70, -55.5), 'idle', 0, y); sc.wait(at(22, 5), 'idle').walk([[-70, -55.6]], 1.3, 'walk', y).hide(sc.ct + 0.5);
    sc.show(at(22, 5, 40), -70, -53.4, 'walk', Math.PI, undefined).walk([[-62, -50], [-57, -43]], 1.4).hide(at(22, 6)); return sc.done(); } });
add({ id: 'lidia', name: { ru: 'Лидия', en: 'Lidia' }, key: true, look: { body: 'liza', coat: 0x4a4238, trou: 0x2e2c2a, skirt: false, hat: 'scarf', scale: 0.97, hair: 0x3a2a1a },
  sched: () => { const y = roofY(); const sc = s(-72.2, -57.4, 0.6, 'fix', 0, y); sc.wait(at(22, 15), 'fix').walk([[-70, -55.6]], 1.2, 'walk', y).hide(sc.ct + 0.5);
    sc.show(at(22, 40), -70, -51.6, 'cry', Math.PI, undefined); return sc.end().kfs; } });
add({ id: 'fern', name: { ru: 'Ферн', en: 'Fern' }, key: true, look: { body: 'james', coat: 0x3a352e, trou: 0x252628, hat: 'cap', extra: ['lantern'], scale: 0.96, hair: 0xb8b8b0 },
  sched: () => { const y = roofY(); const sc = s(-72.8, -55.3, 1.2, 'idle', 0, y); sc.wait(at(22, 5), 'idle').walk([[-70, -55.6]], 1, 'walk', y).hide(sc.ct + 0.5);
    sc.show(at(22, 7), -71.4, -52.9, 'walk', 0).walk([[-67, -47]], 1.1).wait(at(22, 22), 'idle', 0).walk([[-68, -43.5]], 1, 'walk').wait(at(22, 22) + 40, 'lantern', faceTo(-68, -43.5, -70, -54)).end(); return sc.kfs; } });
add({ id: 'stern', name: { ru: 'Штерн', en: 'Stern' }, key: true, look: { body: 'james', coat: 0x2b2a28, trou: 0x1c1c1e, hat: 'fedora', extra: ['case'] },
  sched: f => { const y = BASEMENT_Y(); const sc = s(-72.4, -60.4, 1.2, 'fix', 0, y);
    if (f.has('sternScared')) { const tf = f.at('sternScared')!; sc.wait(tf, 'fix').hide(); return sc.done(); }
    sc.wait(at(22, 4), 'fix').hide(at(22, 4)); sc.show(at(22, 4, 10), -70, -53.2, 'walk', 0).walk([[-68, -46], [-68, -9], [-76, -8], [-90, -8]], 1.4).hide(); return sc.done(); } });
add({ id: 'orven', name: { ru: 'Орвен', en: 'Orven' }, key: true, look: { body: 'james', coat: 0x4a4238, trou: 0x2e2c2a, hat: 'none', extra: ['apron'], scale: 0.95, hair: 0x8a8a84 },
  sched: () => { const i = inSite('orven', -0.3, -2.7); const d = loc('orven', 1.25, 0.3); const sc = s(i.x, i.z, Math.PI, 'idle', 0, i.y);
    sc.wait(at(22, 9), 'idle', faceTo(i.x, i.z, d.x, d.z)); const door = inSite('orven', 1.25, -0.4);
    sc.walk([[door.x, door.z]], 1.1, 'walk', undefined); const front = loc('orven', 1.25, 0.9); sc.walk([[front.x, front.z]], 0.8, 'walk').wait(at(22, 10), 'idle', 0);
    sc.walk([[-53, -38], [-60, -39], [-83, -40]], 1.3).hide(); return sc.done(); } });
add({ id: 'tilda', name: { ru: 'Тильда', en: 'Tilda' }, key: true, look: { body: 'liza', coat: 0x4a4238, trou: 0x2e2c2a, skirt: true, long: false, hat: 'scarf', scale: 0.98, extra: [] },
  sched: f => {
    const sc = s(-37.2, -33.2, 0.5, 'talk', at(22, 8)); sc.ct = at(22, 8);
    if (f.has('tildaWarned') && f.at('tildaWarned')! < at(22, 24)) { const tf = f.at('tildaWarned')!;
      const sc2 = s(-37.2, -33.2, 0.5, 'talk', at(22, 8)); sc2.wait(at(22, 14), 'talk').walk([[-30, -30], [-14, -28], [-14, -2]], 1.5).wait(at(22, 17), 'talk', 0).walk([[-14, 50], [-9.5, 58]], 1.5).wait(Math.max(tf, sc2.ct) , 'idle', Math.PI / 2);
      // after the warning she runs to the orphanage back gate
      sc2.walk([[-14, 40], [-14, 2], [-9, 0], [9, 0], [14, 0], [14, -5], [20, -5], [30, -30], [38, -44], [38, -62], [34.6, -69.5]], 4.2, 'run').end('idle', Math.PI / 2); return sc2.kfs; }
    sc.wait(at(22, 14), 'talk').walk([[-30, -30], [-14, -28], [-14, -2]], 1.5).wait(at(22, 17), 'talk', 0).walk([[-14, 50], [-9.5, 57.5], [SCENE_BARGE.x, SCENE_BARGE.z]], 1.5).wait(at(22, 24), 'idle', Math.PI / 2);
    sc.wait(at(22, 32, 20), 'talk', Math.PI / 2).wait(at(22, 33), 'aim', Math.PI / 2).wait(at(22, 33, 40), 'shoot', Math.PI / 2); sc.walk([[-9.6, 59]], 1.2, 'walk').hide(at(22, 35)); return sc.done(); } });
add({ id: 'lukyan', name: { ru: 'Лукьян', en: 'Lukyan' }, key: true, look: { body: 'james', coat: 0x3a352e, trou: 0x252628, hat: 'cap', extra: ['beard'], scale: 1.02, hair: 0x3a3632 },
  sched: f => { const sc = s(-3.8, 63.8, Math.PI / 2, 'idle', 0, -0.62);
    const shot = !(f.has('tildaWarned') && f.at('tildaWarned')! < at(22, 24));
    sc.wait(at(22, 24), 'idle').walk([[-3.2, 66], [-3.0, 62.6]], 0.6, 'walk', -0.62).wait(at(22, 29, 40), 'talk', Math.PI * 0.9);
    if (!shot) return sc.end('idle').kfs;
    sc.walk([[-5.2, 61.6]], 1, 'walk').wait(at(22, 33), 'talk', Math.PI * 1.1); sc.walk([[-5.6, 61.2]], 0.8, 'hit').wait(at(22, 33, 5), 'die', Math.PI * 1.1).end('die'); return sc.kfs; } });
add({ id: 'ned', name: { ru: 'Нед', en: 'Ned' }, key: true, look: { body: 'remy', coat: 0x3a352e, trou: 0x2e2c2a, hat: 'peaked', extra: ['badge'], scale: 0.97, hair: 0x8a5a3a },
  sched: f => { const p = seat(1); const rail = { x: 0.4, z: 2.3 };
    const sc = s(p.x, p.z, p.ry, 'sit', 0, p.y); sc.wait(at(22, 6), 'sittalk').walk([[TAV_DOOR.x, TAV_DOOR.z]], 1.3, 'walk', undefined).walk([[16, 9], [14, 0], [9, 0], [rail.x, rail.z]], 1.9, 'walk').wait(at(22, 16), 'rail', 0);
    if (!f.has('nedSaved')) { sc.wait(at(22, 16, 4), 'yell', 0).hide(at(22, 16, 6)); return sc.done(); }
    sc.wait(at(22, 18), 'cry', 0).walk([[9, 0], [14, 0], [16, 12]], 1.2, 'walk').end('idle', Math.PI / 2); return sc.kfs; } });
add({ id: 'agata', name: { ru: 'Агата', en: 'Agata' }, key: true, look: { body: 'liza', coat: 0x6b6358, trou: 0x2e2c2a, skirt: true, long: true, hat: 'none', extra: ['apron'], scale: 1.0, hair: 0x6a5a48 },
  sched: () => { const b = inSite('tavern', -0.5, -8.0); const sc = s(b.x, b.z, Math.PI / 2 * -1, 'idle', 0, b.y); const sw = inSite('tavern', 2.4, -1.8);
    sc.wait(at(22, 14), 'idle', faceTo(b.x, b.z, TAV(0, -3).x, TAV(0, -3).z)).walk([[sw.x, sw.z]], 1, 'walk', sw.y).wait(at(22, 30), 'sweep', 0).walk([[b.x, b.z]], 1, 'walk', b.y).end('idle'); return sc.kfs; } });
const cmLook = (i: number): Look => ({ body: i % 2 ? 'remy' : 'james', coat: [COAT.e, COAT.c, COAT.a, COAT.b][i % 4], trou: 0x1c1c1e, hat: i % 3 === 0 ? 'cap' : 'fedora', scale: 0.98 + (i % 3) * 0.02 });
add({ id: 'ignat', name: { ru: 'Игнат', en: 'Ignat' }, key: true, look: { body: 'james', coat: 0x2e2c2a, trou: 0x1c1c1e, hat: 'none', scale: 1.0, hair: 0x2a2622 },
  sched: f => { const p = seat(5); const sc = s(p.x, p.z, p.ry, 'sittalk', 0, p.y);
    if (f.has('ignatDead')) { sc.wait(f.at('ignatDead')!, 'sit').wait(f.at('ignatDead')! + 0.1, 'die'); return sc.end('die').kfs; }
    sc.wait(at(22, 12), 'sittalk').wait(at(22, 15), 'idle', p.ry).walk([[TAV_DOOR.x, TAV_DOOR.z], [16, 9], [16, 18], [58, 19.5]], 1.8).wait(at(22, 20), 'idle', 0).end(); return sc.kfs; } });
add({ id: 'lovchiy', name: { ru: 'Ловчий', en: 'Lovchiy' }, key: true, look: { body: 'remy', coat: 0x4a4238, trou: 0x2e2c2a, hat: 'none', scale: 1.0, hair: 0x3a2a1a },
  sched: f => { const p = seat(2); const sc = s(p.x, p.z, p.ry, 'sit', 0, p.y);
    if (f.has('lovchiyDead')) { sc.wait(f.at('lovchiyDead')!, 'sit').wait(f.at('lovchiyDead')! + 0.1, 'die'); return sc.end('die').kfs; }
    sc.wait(at(22, 12), 'sittalk').wait(at(22, 15), 'idle', p.ry).walk([[TAV_DOOR.x, TAV_DOOR.z], [16, 9], [16, 18], [60, 19.5]], 1.8).wait(at(22, 20), 'idle', 0).end(); return sc.kfs; } });
for (let i = 0; i < 6; i++) add({ id: 'cm' + (i + 1), name: { ru: 'Человек Корда', en: "Cord's man" }, look: cmLook(i), role: 'cord',
  sched: f => { const idx = [0, 3, 4, 6, 7, 8][i], p = seat(idx); const sc = s(p.x, p.z, p.ry, i % 2 ? 'sit' : 'sittalk', 0, p.y);
    sc.wait(at(22, 12, i * 2), i % 2 ? 'sit' : 'sittalk').walk([[TAV_DOOR.x, TAV_DOOR.z], [16, 9], [16, 18], [52 + i * 1.8, 20 - (i % 2) * 1.4]], 3.8, 'run').wait(at(22, 20), 'idle', 0.2 * i);
    if (i < 2) sc.wait(at(22, 30), 'idle', 0.2 * i).walk([[38, 19], [16, 17], [14, 0], [9, 0], [-9, 0], [-14, 0], [-14, 50], [-12, 56.5 + i * 1.2]], 1.9, 'walk').end('idle', Math.PI / 2); else sc.end(); void f; return sc.kfs; } });
add({ id: 'scar', name: { ru: 'Шрам', en: 'Scar' }, key: true, look: { body: 'james', coat: 0x1d1e20, trou: 0x1c1c1e, hat: 'fedora', extra: ['scar'], scale: 1.03 },
  sched: f => { const bar = inSite('tavern', -2.0, -6.2); const sc = s(bar.x, bar.z, Math.PI / 2, 'idle', 0, bar.y); const ig = seat(5);
    if (f.has('jetonStolen')) { const t0 = at(22, 6);
      sc.wait(at(22, 5, 40), 'idle').walk([[ig.x + 0.4, ig.z + 0.4]], 1.2, 'walk', ig.y).wait(t0 + 5, 'talk', ig.ry).wait(t0 + 30, 'yell').walk([[TAV(-3.2, -1.2).x, TAV(-3.2, -1.2).z]], 1, 'walk', ig.y).wait(at(22, 8), 'idle')
        .walk([[TAV_DOOR.x, TAV_DOOR.z], [16, 9], [14, 0], [9, 0], [-14, 0], [-14, 50], [-12, 56]], 1.7).end('idle'); return sc.kfs; }
    sc.wait(at(22, 5, 40), 'idle').walk([[ig.x + 0.5, ig.z + 0.5]], 1.2, 'walk', ig.y).wait(at(22, 6, 15), 'talk', ig.ry).walk([[TAV_DOOR.x, TAV_DOOR.z]], 1.2, 'walk', undefined)
      .walk([[17, 9], [17, 19], [45.2, 19.8], [45.25, 21.8]], 1.9).wait(at(22, 10), 'idle', 0).walk([[45.25, 24.2]], 1, 'walk', floorY('contora')).wait(at(22, 12, 50), 'idle', Math.PI)
      .walk([[45.25, 21.5], [38, 19.5], [17, 18], [14, 0], [9, 0], [-14, 0], [-14, 50], [-12, 56]], 1.9, 'walk').end('idle'); return sc.kfs; } });
add({ id: 'cord', name: { ru: 'Корд', en: 'Cord' }, key: true, look: { body: 'james', coat: 0x26292d, trou: 0x1c1c1e, hat: 'peaked', long: true, scale: 1.05 },
  sched: () => { const sc = s(-9.2, 62.2, Math.PI / 2, 'idle', 0); sc.hide(0); sc.show(at(22, 34), -7.4, 57.8, 'walk', Math.PI * 1.2).walk([[-6.1, 60.2]], 1.4).wait(at(22, 35, 20), 'yell', Math.PI / 2).walk([[-7.8, 57]], 1.2).hide(at(22, 37)); return sc.done(); } });
add({ id: 'foma', name: { ru: 'Фома', en: 'Foma' }, key: true, look: { body: 'james', coat: 0x4a4238, trou: 0x2e2c2a, hat: 'none', extra: ['apron'], scale: 0.96, hair: 0x7a7a72 },
  sched: f => { const i = inSite('foma', -0.2, -3.5); const door = loc('foma', 0, 1.2); const sc = s(i.x, i.z, 0, 'idle', 0, i.y);
    const leave = f.has('fomaWarned') ? at(22, 24) : at(22, 29, 20);
    sc.wait(at(22, 20), 'idle').walk([[loc('foma', -1.5, -3.5).x, loc('foma', -1.5, -3.5).z]], 0.7, 'walk', i.y).wait(leave, 'idle', Math.PI * 0.5).walk([[loc('foma', 0, -0.3).x, loc('foma', 0, -0.3).z], [door.x, door.z], [door.x + 1.5, door.z + 4]], 1.4, 'walk').wait(sc.ct + 4, 'idle', Math.PI).end('cry', Math.PI); return sc.kfs; } });
add({ id: 'gayl', name: { ru: 'Гейл', en: 'Gayl' }, key: true, look: { body: 'james', coat: 0x3a352e, trou: 0x252628, hat: 'none', scale: 1.0, hair: 0x6a6a64 },
  sched: f => { const p = inSite('contora', -1.25, -5.0); const sc = s(p.x, p.z, Math.PI, 'idle', 0, p.y); const yard = { x: 41.5, z: 33.5 };
    if (f.has('annaWarned') || f.has('gaylWarned')) { const tf = f.at('gaylWarned') ?? f.at('annaWarned')!; sc.wait(Math.max(tf, at(22, 6)), 'idle').walk([[loc('contora', -1.25, -0.5).x, loc('contora', -1.25, -0.5).z], [45, 20], [34, 19], [14, 18], [14, -5], [30, -30], [46, -47], [50, -52]], 1.6).end('idle'); return sc.kfs; }
    if (f.has('jetonStolen')) { sc.wait(at(22, 20), 'idle').walk([[loc('contora', -1.25, -0.5).x, loc('contora', -1.25, -0.5).z], [45, 20], [34, 19], [14, 18], [14, -5], [30, -30], [46, -47], [50, -52]], 1.6).end('idle'); return sc.kfs; }
    sc.wait(at(22, 10, 40), 'idle').wait(at(22, 11, 30), 'hit').wait(at(22, 12), 'die').wait(at(22, 13), 'die').teleport(yard.x, yard.z, undefined, 0.4, 'die').wait(at(22, 14), 'die').end('die', 0.4); return sc.kfs; } });
// ============ EAST: orphanage
add({ id: 'agnia', name: { ru: 'Матушка Агния', en: 'Mother Agnia' }, key: true, look: { body: 'liza', coat: 0x1d1e20, trou: 0x1c1c1e, skirt: true, long: true, hat: 'nun', scale: 0.96, hair: 0x9a9a94 },
  sched: () => { const o = inSite('priyut', -7, -4.5); const sc = s(o.x, o.z, 0, 'idle', 0, o.y); const gate = { x: 49.2, z: -53 };
    sc.wait(at(22, 30), 'idle', Math.PI).walk([[loc('priyut', -3.3, -2).x, loc('priyut', -3.3, -2).z], [loc('priyut', 1.2, 0.8).x, loc('priyut', 1.2, 0.8).z], [gate.x, gate.z]], 1.2, 'walk').wait(at(22, 40, 30), 'idle', 0).walk([[loc('priyut', 1.2, 0.8).x, loc('priyut', 1.2, 0.8).z], [o.x, o.z]], 1.2, 'walk', o.y).end('idle'); return sc.kfs; } });
add({ id: 'anna', name: { ru: 'Анна', en: 'Anna' }, key: true, look: { body: 'liza', coat: 0x5a5a58, trou: 0x2a2a2a, skirt: true, long: true, hat: 'nun', extra: ['apron'], scale: 1.0, hair: 0x6a5a48 },
  sched: () => { const dorm = inSite('priyut', 6, -5, 1); const sc = s(dorm.x, dorm.z, Math.PI, 'idle', 0, dorm.y);
    const yard = { x: 52.5, z: -56.5 };
    sc.wait(at(22, 30), 'idle').walk([[loc('priyut', 5.7, -2).x, loc('priyut', 5.7, -2).z], [loc('priyut', 1.2, 0.8).x, loc('priyut', 1.2, 0.8).z], [yard.x, yard.z]], 1.2, 'walk').wait(at(23, 0), 'idle', 0.5).end(); return sc.kfs; } });
const KIDS = [{ n: 'anka', b: 'liza' as const, c: 0x4a4238, k: 0.62 }, { n: 'misha', b: 'remy' as const, c: 0x3a352e, k: 0.6 }, { n: 'kid3', b: 'liza' as const, c: 0x26292d, k: 0.58 }, { n: 'kid4', b: 'remy' as const, c: 0x4a4238, k: 0.64 },
  { n: 'kid5', b: 'liza' as const, c: 0x3a352e, k: 0.6 }, { n: 'kid6', b: 'remy' as const, c: 0x26292d, k: 0.57 }];
KIDS.forEach((k, i) => add({ id: k.n, name: k.n === 'anka' ? { ru: 'Анка', en: 'Anka' } : k.n === 'misha' ? { ru: 'Миша', en: 'Misha' } : { ru: 'Ребёнок', en: 'Child' }, key: k.n === 'anka', look: { body: k.b, coat: k.c, trou: 0x252628, skirt: k.b === 'liza', hat: 'none', scale: k.k, extra: k.n === 'anka' ? ['ribbon'] : [] },
  sched: () => { const bed = inSite('priyut', 4 + (i % 3) * 1.9, -3.2 - Math.floor(i / 3) * 3.3, 1); const sc = s(bed.x, bed.z, Math.PI / 2, i % 2 ? 'sit' : 'idle', 0, bed.y);
    const yard = { x: 51 + (i % 3) * 1.1, z: -57.4 + Math.floor(i / 3) * 1.1 };
    sc.wait(at(22, 30, i * 4), 'idle').walk([[loc('priyut', 5.7, -2).x, loc('priyut', 5.7, -2).z], [loc('priyut', 1.2, 0.8).x, loc('priyut', 1.2, 0.8).z], [yard.x, yard.z]], 1.1, 'walk').wait(at(22, 38), 'idle', Math.PI * 0.8).hide(at(22, 38, 30 + i)); return sc.done(); } }));
for (let i = 0; i < 3; i++) add({ id: 'ggrd' + (i + 1), name: { ru: 'Охранник в сером', en: 'Grey-coated guard' }, role: 'guard', look: { body: i % 2 ? 'remy' : 'james', coat: COAT.grey, trou: 0x2e2c2a, hat: 'fedora', extra: ['revolver'], scale: 1.0 + i * 0.01 },
  sched: f => { const yard = { x: 46 + i * 3.4, z: -55 + (i % 2) * 1.2 }, gate = { x: 49.4 + i * 1.2, z: -48.5 };
    const sc = s(yard.x, yard.z, 0, 'idle', at(22, 20)); sc.ct = at(22, 20); sc.wait(at(22, 24), 'idle', 0.4 * i).walk([[gate.x, gate.z]], 1.2, 'walk').wait(at(22, 25, 10), 'consume', Math.PI)
      .walk([[yard.x, yard.z]], 1.2, 'walk').wait(at(22, 40), 'idle', i);
    const o = (i - 1) * 1.7; const w = wagonPath(f.has('wagonPinPulled'));
    sc.walkBy(w.toGate(o), at(22, 42, 20)).walkBy(w.toBridge(o), at(22, 44)); if (f.has('wagonPinPulled')) { sc.wait(at(22, 44, 30), 'yell', Math.PI).end('yell', Math.PI); return sc.kfs; }
    sc.walkBy(w.overBridge(o), at(22, 45)).walkBy(w.toPier(o), at(22, 49, 40)).wait(at(22, 50), 'idle', Math.PI / 2).end('idle', Math.PI / 2); return sc.kfs; } });
// ============ SOUTH: Kanatnaya
add({ id: 'tikhon', name: { ru: 'Тихон', en: 'Tikhon' }, key: true, look: { body: 'remy', coat: 0x26292d, trou: 0x2e2c2a, hat: 'cap', scale: 0.98, hair: 0x3a2a1a },
  sched: f => { const t = inSite('tikhon', -1.6, -3.4), door = loc('tikhon', 0, 0.9); const sc = s(t.x, t.z, Math.PI * 1.2, 'fix', 0, t.y);
    if (f.has('tikhonDead')) return sc.hide(f.at('tikhonDead')!).done();
    if (f.has('tikhonHurt')) { const tf = f.at('tikhonHurt')!; sc.wait(tf, 'fix').wait(tf + 0.1, 'die').end('die'); return sc.kfs; }
    if (f.has('tikhonTurned')) return sc.wait(at(23, 0), 'fix').end('idle').kfs;
    if (f.has('tikhonLocked')) return sc.wait(at(22, 28), 'fix').wait(at(23, 0), 'no').end('no').kfs;
    sc.wait(at(22, 28), 'fix').walk([[door.x, door.z], [door.x, 36.8], [-14.8, 36.8]], 1.3).wait(at(22, 35, 20), 'idle', Math.PI).walk([[-14.8, 51], [-42, 51], [-42, 57.5]], 1.4).end('idle', 0); return sc.kfs; } });
add({ id: 'pip', name: { ru: 'Пип', en: 'Pip' }, look: { body: 'liza', coat: 0x4a4238, trou: 0x252628, skirt: true, hat: 'none', scale: 0.55, hair: 0x6a5a48 },
  sched: f => { const b = inSite('tikhon', 2.0, -4.8); const sc = s(b.x, b.z, 0, 'idle', 0, b.y + 0.55);
    if (f.has('tikhonDead') || f.has('tikhonHurt')) return sc.wait(f.at('tikhonDead') ?? f.at('tikhonHurt')!, 'idle').wait(at(23, 0), 'cry').end('cry').kfs;
    return sc.end('idle').kfs; } });
// ============ HARBOUR: Pier 3 and the launch
add({ id: 'yan', name: { ru: 'Ян', en: 'Yan' }, key: true, look: { body: 'james', coat: 0x3a352e, trou: 0x252628, hat: 'cap', scale: 0.98, hair: 0x9a9a94 },
  sched: () => { const sc = s(-42.1, 80.5, Math.PI, 'idle', 0); sc.hide(0).show(at(22, 35, -3), -42, 80, 'walk', Math.PI).walk([[-42, 71]], 1.3).wait(at(22, 35, 20), 'talk', Math.PI * 1.5).walk([[-42, 65.5]], 1.2).wait(at(22, 35, 30), 'hit').wait(at(22, 35, 32), 'die').hide(at(22, 36, 10)); return sc.done(); } });
for (let i = 0; i < 3; i++) add({ id: 'dock' + (i + 1), name: { ru: 'Человек Корда', en: "Cord's man" }, look: cmLook(i + 1), role: 'cord',
  sched: () => { const sc = s(-42 + (i - 1) * 1.1, 60 + (i % 2) * 2.2, 0.4, 'idle', 0); sc.hide(0).show(at(22, 34, 31), -39.5 - i, 54.5, 'walk', 0).walk([[-42 + (i - 1) * 1.1, 61 + (i % 2) * 2.2]], 1.3).wait(at(22, 40), 'idle', i).hide(at(22, 40, 20)); return sc.done(); } });
add({ id: 'harrow', name: { ru: 'Виктор Харроу', en: 'Victor Harrow' }, key: true, look: { body: 'james', coat: 0xb8b2a4, trou: 0x3a3a38, long: true, hat: 'none', scale: 1.04, hair: 0xd0d0cc },
  sched: () => { const sc = s(-42, 82, 0, 'idle', 0); sc.hide(0); return sc.done(); } });
// Bridge patrol (spec 8.3): only when the fuse was pulled (tapCut): two of Cord's men check a pass or a courier token from 22:18
for (let i = 0; i < 2; i++) add({ id: 'patrol' + (i + 1), name: { ru: 'Патрульный Корда', en: "Cord's patrol" }, role: 'cord', look: { body: i ? 'remy' : 'james', coat: 0x1d1e20, hat: 'peaked', extra: ['revolver'], scale: 1.0 },
  sched: f => { const sc = s(-8.6, i ? 1.6 : -1.6, -Math.PI / 2, 'idle', 0); if (!f.has('tapCut')) return sc.hide(0).done(); const t0 = Math.max(f.at('tapCut')!, at(22, 18)); sc.hide(0).show(t0, -8.6, i ? 1.6 : -1.6, 'pistol', -Math.PI / 2).end('pistol', -Math.PI / 2); return sc.kfs; } });
// ============ civilians (deterministic loops; alive on the streets and in the tavern)
const CIVS: { id: string; body: Look['body']; coat: number; hat: Look['hat']; x: number; z: number; pts: [number, number][]; sp: number; ph: number; long?: boolean; skirt?: boolean }[] = [
  { id: 'civ1', body: 'james', coat: COAT.a, hat: 'fedora', x: -60, z: -5.2, pts: [[-30, -5.2], [-45, -5.2]], sp: 1.2, ph: 0 },
  { id: 'civ2', body: 'liza', coat: COAT.d, hat: 'scarf', x: -20, z: -10.6, pts: [[-20, -10.6], [-62, -10.6]], sp: 1.1, ph: 30, skirt: true, long: true },
  { id: 'civ3', body: 'remy', coat: COAT.c, hat: 'cap', x: -14.5, z: 20, pts: [[-14.5, -20], [-14.5, 30]], sp: 1.3, ph: 10 },
  { id: 'civ4', body: 'james', coat: COAT.e, hat: 'fedora', x: 11.8, z: -30, pts: [[11.8, 30], [11.8, -30]], sp: 1.25, ph: 5, long: true },
  { id: 'civ5', body: 'liza', coat: COAT.b, hat: 'scarf', x: -68, z: -22, pts: [[-68, -10], [-68, -28]], sp: 1.0, ph: 60, skirt: true },
  { id: 'civ6', body: 'remy', coat: COAT.a, hat: 'cap', x: 30, z: 20.4, pts: [[60, 20.4], [20, 20.4]], sp: 1.3, ph: 45 },
  { id: 'civ7', body: 'james', coat: COAT.d, hat: 'fedora', x: -30, z: 38.6, pts: [[-55, 38.6], [-20, 38.6]], sp: 1.1, ph: 15, long: true },
  { id: 'civ8', body: 'liza', coat: COAT.e, hat: 'scarf', x: 20, z: -12, pts: [[24, -22], [18, -6]], sp: 0.9, ph: 90, skirt: true, long: true },
];
for (const c of CIVS) add({ id: c.id, name: { ru: 'Прохожий', en: 'Passer-by' }, civ: true, look: { body: c.body, coat: c.coat, trou: 0x1c1c1e, hat: c.hat, long: c.long, skirt: c.skirt, scale: 0.95 + (c.ph % 7) * 0.01 }, sched: () => walkLoop(c.x, c.z, c.pts, c.sp, c.ph) });
// tavern regulars
const reg = [{ id: 'sailor', lx: -4.6, lz: -2.0, body: 'remy' as const, coat: COAT.c, hat: 'cap' as const }, { id: 'docker1', lx: -4.6, lz: -6.0, body: 'james' as const, coat: COAT.d, hat: 'cap' as const }, { id: 'docker2', lx: -3.9, lz: -6.6, body: 'remy' as const, coat: COAT.a, hat: 'cap' as const }, { id: 'oldman', lx: 3.0, lz: -7.0, body: 'james' as const, coat: COAT.b, hat: 'none' as const }];
for (const r of reg) add({ id: r.id, name: { ru: 'Посетитель', en: 'Regular' }, civ: true, look: { body: r.body, coat: r.coat, hat: r.hat, scale: 0.95, hair: 0x8a8a84 },
  sched: () => { const p = inSite('tavern', r.lx, r.lz); const sc = s(p.x, p.z, faceTo(p.x, p.z, TAV(r.lx + 1, r.lz).x, TAV(r.lx + 1, r.lz).z), 'sit', 0, p.y); sc.wait(at(22, 12), 'sittalk').wait(at(23, 0), 'kneel', 0).end('kneel'); return sc.kfs; } });
void SITES; void TAV_YARD; void SEATS;
