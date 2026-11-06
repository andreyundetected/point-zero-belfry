export interface Vec { x: number; y: number }
export interface Loc { id: string; x: number; y: number; kind: string }
export interface Ev {
  id: number; t: number; type: string; loc: string;
  actors: string[]; causes: number[]; tags: string[]; data?: Record<string, unknown>;
}
export interface Leg { from: Vec; to: Vec; t0: number; t1: number; mode: 'walk' | 'tram' | 'car' }
export interface Override { loc: string; act: string; until: number }
export interface Npc {
  id: string; pos: Vec; loc: string | null; legs: Leg[];
  dest: string | null; pendingAct: string; act: string; taskIdx: number;
  items: string[]; stress: number; override: Override | null;
  lastArrive: number; lastEv: number; flags: Record<string, number | string | boolean>;
}
export interface GroundItem { item: string; loc: string; since: number }
export interface World {
  t: number; npcs: Record<string, Npc>; ground: GroundItem[]; rain: boolean;
  feeders: Record<string, boolean>; lockoutUntil: number; stableSince: number;
  clinicPower: 'grid' | 'gen' | 'off'; clinicGenUntil: number;
  mara: 'stable' | 'guarded' | 'critical'; maraEv: number; blackoutEv: number;
  docsShown: boolean; launch: 'pending' | 'done' | 'postponed'; bridgeNorm: boolean; route: string;
  driver: string; targetDead: boolean;
  pinv: string[]; money: number; flags: Record<string, number | string | boolean>;
  alarm: boolean; alarmEv: number; shot: 'none' | 'killed' | 'failed'; door: boolean; winStart: number; winEnd: number; stage: number; tramStall: number;
}
export type Iv =
  | { t: number; type: 'give'; item: string; to: string }
  | { t: number; type: 'take'; item: string; loc: string }
  | { t: number; type: 'bridge_norm' }
  | { t: number; type: 'fake_call'; to: string; instruction: string }
  | { t: number; type: 'act'; id: string; ok?: boolean }
  | { t: number; type: 'delay'; npc: string; seconds: number }
  | { t: number; type: 'shoot'; npc: string; weapon: string }
  | { t: number; type: 'buy'; item: string; price: number; shop: string }
  | { t: number; type: 'sell'; item: string; price: number; shop: string };
export interface NpcDef {
  id: string; loc: string; child?: boolean; car?: boolean; target?: boolean; needs?: string;
  items?: string[]; stress?: number; menace?: number; behaviors?: string[];
  expect?: { who: string; loc: string; at: string; grace: number; send: string[]; to: string };
  sched: [string, string, string][]; rel: [string, string][];
  life?: { home: string; work: string; car: boolean; spouse?: string; boss?: string; sick: boolean; job: string };
}
export interface WorldDef {
  start: string; end: string;
  tram: { stops: string[]; headway: number; speed: number; dwell: number; first: string };
  events: { t: string; type: string; npc?: string; item?: string; loc: string }[];
  ground?: { item: string; loc: string }[];
  npcs: NpcDef[];
}

export type IvInput = Iv extends infer U ? (U extends Iv ? Omit<U, 't'> & { t?: number } : never) : never;
