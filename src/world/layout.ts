// Map of Zaton (spec §4). Metres, X east, Z south, origin = centre of the Old Bridge.
export type V2 = [number, number];
export interface Road { id: string; pts: V2[]; w: number; walk?: number; kind?: 'setts' | 'dirt'; }
export interface Rect { id: string; x0: number; x1: number; z0: number; z1: number; kind: 'setts' | 'flags' | 'yard'; }

export const WATER_Y = -2.9;      // canal and harbour water level
export const BED_Y = -3.6;        // harbour bed
// G3: the canal is cut deep into the flat town: water 4.5 m below the embankment, held by a lock gate at the harbour mouth
export const CANAL_WATER_Y = -4.6, CANAL_BED_Y = -5.4;
export const CANAL = { x0: -6, x1: 6, z0: -90, z1: 58 };
export const QUAY_Z = 58;         // harbour line
export const BOUNDS = { x0: -92, x1: 92, z0: -86, z1: 90 };

export const ROADS: Road[] = [
  { id: 'bereg', pts: [[-14, -80], [-14, 56]], w: 7 },
  { id: 'rynok', pts: [[-90, -8], [-14, -8]], w: 8 },
  { id: 'bashn', pts: [[-68, -31], [-68, -8]], w: 6 },
  { id: 'klyuch', pts: [[-53, -38], [-46, -35], [-38, -33], [-30, -30], [-22, -28], [-14, -28]], w: 3.4, walk: 0.6 },
  { id: 'kanat', pts: [[-62, 36], [-14, 36]], w: 5, walk: 1.2 },
  { id: 'gavan', pts: [[-62, 51], [-14, 51]], w: 6 },
  { id: 'lodoch', pts: [[-45, 36], [-45, 51]], w: 3, walk: 0.6 },
  { id: 'mostW', pts: [[-14, 0], [-8, 0]], w: 6, walk: 0.5 },
  { id: 'mostE', pts: [[8, 0], [14, 0]], w: 6, walk: 0.5 },
  { id: 'nab', pts: [[14, -78], [14, 52]], w: 7 },
  { id: 'sklad', pts: [[14, 18], [88, 18]], w: 5.5 },
  { id: 'priyut', pts: [[14, -5], [20, -5], [30, -30], [38, -44], [46, -47], [50, -50]], w: 5 },
  { id: 'zadn', pts: [[40, 18], [40, 3]], w: 3, walk: 0.6 },
  { id: 'gavanE', pts: [[14, 51], [80, 51]], w: 6 },
  { id: 'eastS', pts: [[62, 18], [62, 51]], w: 4, walk: 1 },
  { id: 'eastN', pts: [[62, 18], [62, -20]], w: 4, walk: 1 },
  { id: 'westS', pts: [[-90, -8], [-90, 36]], w: 4, walk: 1 },
  { id: 'westN', pts: [[-83, -8], [-83, -30]], w: 4, walk: 1 },
];
export const RECTS: Rect[] = [
  { id: 'tower_sq', x0: -83, x1: -53, z0: -52, z1: -30, kind: 'setts' },
  { id: 'tower_front', x0: -76, x1: -64, z0: -55, z1: -52, kind: 'flags' },
  { id: 'contora_yard', x0: 34, x1: 50, z0: 30, z1: 42, kind: 'setts' },
  { id: 'contora_side', x0: 49, x1: 51, z0: 22, z1: 30, kind: 'setts' },
  { id: 'tavern_yard', x0: 32, x1: 40, z0: 3, z1: 15, kind: 'yard' },
  { id: 'priyut_yard', x0: 38, x1: 62, z0: -66, z1: -50, kind: 'setts' },
  { id: 'prom_w', x0: -11, x1: -6.4, z0: -88, z1: 58, kind: 'flags' },
  { id: 'prom_e', x0: 6.4, x1: 11, z0: -88, z1: 58, kind: 'flags' },
  { id: 'pier7_root', x0: -14, x1: -6, z0: 52, z1: 58, kind: 'flags' },
  { id: 'quay_w', x0: -95, x1: -14, z0: 51, z1: 58, kind: 'flags' },
  { id: 'quay_e', x0: 14, x1: 95, z0: 51, z1: 58, kind: 'flags' },
];
// Named anchors used by sim / interiors / NPCs (spec §4.2)
export const PLACES = {
  tower: { x: -70, z: -58 }, towerSquare: { x: -68, z: -40 }, orven: { x: -46, z: -33.3 },
  rynok: { x: -50, z: -8 }, foma: { x: -40, z: -14 }, post: { x: -22, z: -14.5 },
  bridge: { x: 0, z: 0 }, ned: { x: 0, z: 2.6 }, tavern: { x: 26, z: 9 }, contora: { x: 44, z: 26 },
  warehouse: { x: 66, z: 32 }, priyut: { x: 50, z: -62 }, tikhon: { x: -38, z: 41 },
  pier3: { x: -42, z: 58 }, pier7: { x: -9.5, z: 60 },
};

// piers, barge, bridge (shared by the world builder and by the NPC simulation)
export interface PierSpec { x: number; z0: number; z1: number; w: number; }
export const PIER3: PierSpec = { x: -42, z0: QUAY_Z - 1, z1: 86, w: 3 };
export const PIER7: PierSpec = { x: -9.5, z0: QUAY_Z - 1, z1: 78, w: 5 };
export const DECK_Y = -0.5;
export const BARGE = { x: PIER7.x + PIER7.w / 2 + 3.1, z: 68, w: 5, l: 16, top: DECK_Y - 0.15 };
export const BRIDGE = { x0: -9, x1: 9, z0: -3, z1: 3 };
/** deck top height of the Old Bridge at x */
export const bridgeTop = (x: number) => { const t = x / 9; return 0.12 + 1.15 * (1 - t * t); };
