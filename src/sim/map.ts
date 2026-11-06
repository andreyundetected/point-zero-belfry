// Единая карта: граф путей, объекты симуляции, константы. Метры, X на восток, Z на юг, начало — центр фонтана.
export interface NodeDef { x: number; z: number; floor?: number; inside?: string }
export const NODES: Record<string, NodeDef> = {
  // башня и Окно
  window: { x: 0, z: -28, floor: 2, inside: 'tower' }, tower_in: { x: 0, z: -25, inside: 'tower' }, tower_door: { x: 0, z: -22 },
  // площадь
  sq_n: { x: 0, z: -15 }, sq_nw: { x: -12, z: -14 }, sq_ne: { x: 12, z: -14 }, sq_w: { x: -13, z: 0 }, sq_e: { x: 14, z: 0 },
  sq_c: { x: 0, z: 7 }, sq_sw: { x: -12, z: 10 }, sq_se: { x: 12, z: 10 }, board: { x: 8, z: -5 }, zoya_bench: { x: -9, z: 5 }, stage: { x: -8, z: -17 },
  // таверна
  tav_door: { x: -19, z: -1 }, tav_in: { x: -22, z: -1, inside: 'tavern' }, tav_hall: { x: -27, z: 0, inside: 'tavern' }, tav_table: { x: -24, z: 2.2, inside: 'tavern' },
  tav_bar: { x: -31, z: -3, inside: 'tavern' }, tav_hearth: { x: -33, z: 1, inside: 'tavern' },
  kit: { x: -33, z: -5.5, inside: 'tavern' }, kit_stove: { x: -34.5, z: -6, inside: 'tavern' }, kit_window: { x: -31, z: -7, inside: 'tavern' },
  kit_door: { x: -28, z: -8, inside: 'tavern' }, yard: { x: -30, z: -12 },
  rug: { x: -25, z: -4.5, inside: 'tavern' }, cel_in: { x: -25, z: -5.2, floor: -1, inside: 'tavern' }, cel_chest: { x: -30, z: -3.5, floor: -1, inside: 'tavern' }, cel_valve: { x: -33, z: -6, floor: -1, inside: 'tavern' },
  st_up: { x: -23, z: -5, inside: 'tavern' }, up_hall: { x: -27, z: -2, floor: 1, inside: 'tavern' }, up_r1: { x: -31, z: -4, floor: 1, inside: 'tavern' }, up_r2: { x: -31, z: 1, floor: 1, inside: 'tavern' },
  // мастерская
  tilda_door: { x: -19, z: -21 }, tilda_in: { x: -23, z: -22, inside: 'workshop' },
  // ворота и пост
  gate: { x: -38, z: 12 }, booth: { x: -36, z: 11, inside: 'booth' }, ignat_post: { x: -37.5, z: 13 }, ks1: { x: -33, z: 15.5 },
  // обводной «церковный проулок» (длинный обход)
  alley1: { x: -48, z: -20 }, alley2: { x: -63, z: -8 }, alley3: { x: -64, z: 12 }, alley4: { x: -52, z: 19 },
  // набережная
  emb_a: { x: -30, z: 17 }, emb_b: { x: -20, z: 17 }, emb_c: { x: -14, z: 17 }, emb_d: { x: -6, z: 17 }, emb_e: { x: 2, z: 17 }, kiosk: { x: 6, z: 15 },
  stop_pl: { x: 12, z: 17 }, emb_g: { x: 24, z: 17 }, emb_h: { x: 40, z: 17 }, emb_i: { x: 54, z: 17 }, stop_pr: { x: 66, z: 17 }, emb_j: { x: 74, z: 17 },
  quay: { x: -17, z: 19.5 }, pier_boats: { x: 70, z: 23 },
  // бюро
  bur_door: { x: 80, z: 12 }, bur_in: { x: 83, z: 8.5, inside: 'bureau' }, mast: { x: 87, z: 15 },
};
const E = (a: string, b: string) => [a, b] as const;
export const EDGES: (readonly [string, string])[] = [
  E('window', 'tower_in'), E('tower_in', 'tower_door'), E('tower_door', 'sq_n'),
  E('sq_n', 'sq_nw'), E('sq_n', 'sq_ne'), E('sq_nw', 'sq_w'), E('sq_ne', 'sq_e'), E('sq_w', 'sq_c'), E('sq_e', 'sq_c'), E('sq_w', 'sq_sw'), E('sq_e', 'sq_se'), E('sq_c', 'sq_sw'), E('sq_c', 'sq_se'),
  E('sq_n', 'sq_c'), E('board', 'sq_e'), E('board', 'sq_ne'), E('board', 'sq_c'), E('zoya_bench', 'sq_w'), E('zoya_bench', 'sq_c'), E('stage', 'sq_nw'), E('stage', 'sq_n'),
  E('tav_door', 'sq_w'), E('tav_door', 'tav_in'), E('tav_in', 'tav_hall'), E('tav_in', 'tav_table'), E('tav_table', 'tav_hall'), E('tav_hall', 'tav_bar'), E('tav_hall', 'tav_hearth'), E('tav_bar', 'kit'), E('tav_hearth', 'tav_bar'),
  E('kit', 'kit_stove'), E('kit', 'kit_window'), E('kit', 'kit_door'), E('kit_door', 'yard'), E('tav_hall', 'rug'), E('rug', 'cel_in'), E('cel_in', 'cel_chest'), E('cel_in', 'cel_valve'),
  E('tav_in', 'st_up'), E('st_up', 'up_hall'), E('up_hall', 'up_r1'), E('up_hall', 'up_r2'),
  E('tilda_door', 'tilda_in'), E('tilda_door', 'sq_nw'),
  E('gate', 'booth'), E('gate', 'ignat_post'), E('ignat_post', 'ks1'), E('booth', 'ignat_post'), E('ks1', 'emb_a'),
  E('yard', 'alley1'), E('alley1', 'alley2'), E('alley2', 'alley3'), E('alley3', 'alley4'), E('alley4', 'ks1'), E('alley3', 'gate'),
  E('emb_a', 'emb_b'), E('emb_b', 'emb_c'), E('emb_c', 'emb_d'), E('emb_d', 'emb_e'), E('emb_e', 'stop_pl'), E('emb_e', 'kiosk'), E('kiosk', 'stop_pl'),
  E('stop_pl', 'emb_g'), E('emb_g', 'emb_h'), E('emb_h', 'emb_i'), E('emb_i', 'stop_pr'), E('stop_pr', 'emb_j'), E('emb_j', 'bur_door'), E('bur_door', 'bur_in'), E('bur_door', 'mast'),
  E('sq_sw', 'emb_c'), E('sq_c', 'emb_e'), E('sq_se', 'stop_pl'), E('emb_c', 'quay'), E('emb_b', 'quay'), E('stop_pr', 'pier_boats'),
];
/** Рёбра, которые перекрывают бочки Бориса. */
export const BARREL_EDGES: (readonly [string, string])[] = [E('emb_c', 'emb_b'), E('emb_c', 'quay'), E('emb_b', 'quay')];

export const T0 = 0, T1 = 2400, TICK = 0.5;
export const clock = (t: number): string => { const m = 21 * 60 + 20 + Math.floor(t / 60); const hh = Math.floor(m / 60) % 24, mm = m % 60; return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
/** hh:mm → секунды от 21:20 */
export const hm = (s: string): number => { const [h, m] = s.split(':').map(Number); return (h * 60 + m - (21 * 60 + 20)) * 60; };

export const TIMES = {
  pipPick: hm('21:23'), tildaLeave: hm('21:24'), tram1: hm('21:30'), pipStash: hm('21:34'), ignatTea: hm('21:36'), ignatBack: hm('21:39'),
  tavernBar: hm('21:40'), boris: hm('21:42'), kioskClose: hm('21:45'), matveyLeave: hm('21:48'), cordon: hm('21:52'), fireWatch: hm('21:58'),
};

export const TRAM_TRIPS = [
  { t: hm('21:30'), from: 'stop_pl', to: 'stop_pr' }, { t: hm('21:35'), from: 'stop_pr', to: 'stop_pl' },
  { t: hm('21:50'), from: 'stop_pl', to: 'stop_pr' }, { t: hm('21:55'), from: 'stop_pr', to: 'stop_pl' },
];

// Объекты симуляции (взаимодействие игрока): позиция + радиус.
export interface ObjDef { id: string; node: string; x: number; z: number; r: number; floor?: number }
export const OBJS: Record<string, ObjDef> = {
  ks1: { id: 'ks1', node: 'ks1', x: -33, z: 15.5, r: 2.2 },
  tav_valve: { id: 'tav_valve', node: 'cel_valve', x: -33, z: -6, r: 2.2, floor: -1 },
  kit_joint: { id: 'kit_joint', node: 'kit_stove', x: -34.5, z: -6, r: 2.4 },
  kit_window: { id: 'kit_window', node: 'kit_window', x: -31, z: -7, r: 2.2 },
  rug: { id: 'rug', node: 'rug', x: -25, z: -4.5, r: 2 },
  hearth: { id: 'hearth', node: 'tav_hearth', x: -33, z: 1, r: 2.2 },
  chest: { id: 'chest', node: 'cel_chest', x: -30, z: -3.5, r: 2, floor: -1 },
  booth_hook: { id: 'booth_hook', node: 'booth', x: -36, z: 11, r: 2.4 },
  bench: { id: 'bench', node: 'stop_pl', x: 12, z: 17, r: 3 },
  kiosk: { id: 'kiosk', node: 'kiosk', x: 6, z: 15, r: 2.6 },
  window: { id: 'window', node: 'window', x: 0, z: -28, r: 3, floor: 2 },
  board: { id: 'board', node: 'board', x: 8, z: -5, r: 3 },
  bureau_journal: { id: 'bureau_journal', node: 'bur_in', x: 83, z: 8.5, r: 3 },
  tav_door: { id: 'tav_door', node: 'tav_door', x: -19, z: -1, r: 3 },
  bar: { id: 'bar', node: 'tav_bar', x: -31, z: -3, r: 2.6 },
  tilda_shelf: { id: 'tilda_shelf', node: 'tilda_in', x: -23, z: -22, r: 3 },
};
export const nodePos = (id: string) => NODES[id];
export const dist2d = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
export function nearestNode(x: number, z: number, floor = 0): string {
  let best = 'sq_c', bd = 1e9;
  for (const [id, n] of Object.entries(NODES)) {
    if ((n.floor ?? 0) !== floor) continue;
    const d = dist2d(x, z, n.x, n.z); if (d < bd) { bd = d; best = id; }
  }
  return best;
}

// Dijkstra по графу
const ADJ: Record<string, { to: string; d: number }[]> = {};
for (const id of Object.keys(NODES)) ADJ[id] = [];
for (const [a, b] of EDGES) {
  const na = NODES[a], nb = NODES[b]; if (!na || !nb) throw new Error('bad edge ' + a + ' ' + b);
  const d = dist2d(na.x, na.z, nb.x, nb.z) + (na.floor !== nb.floor ? 3 : 0);
  ADJ[a].push({ to: b, d }); ADJ[b].push({ to: a, d });
}
export const edgeKey = (a: string, b: string) => (a < b ? a + '|' + b : b + '|' + a);
export function findPath(from: string, to: string, blocked?: Set<string> | string[]): { path: string[]; len: number } | null {
  const bl = blocked instanceof Set ? blocked : new Set(blocked ?? []);
  const dist: Record<string, number> = { [from]: 0 }; const prev: Record<string, string> = {};
  const open = new Set<string>([from]); const done = new Set<string>();
  while (open.size) {
    let cur = '', cd = Infinity;
    for (const o of open) if (dist[o] < cd || (dist[o] === cd && o < cur)) { cd = dist[o]; cur = o; }
    open.delete(cur); done.add(cur);
    if (cur === to) break;
    for (const e of ADJ[cur]) {
      if (done.has(e.to) || bl.has(edgeKey(cur, e.to))) continue;
      const nd = cd + e.d;
      if (dist[e.to] === undefined || nd < dist[e.to] - 1e-9) { dist[e.to] = nd; prev[e.to] = cur; open.add(e.to); }
    }
  }
  if (dist[to] === undefined) return null;
  const path = [to]; while (path[0] !== from) path.unshift(prev[path[0]]);
  return { path, len: dist[to] };
}
