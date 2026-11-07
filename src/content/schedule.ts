import type { Sim } from '../sim/types';
import { learn, setFlag, fmtMin, has, flag } from '../sim/types';

// NPC = расписание + флаги причин (спека §10, §15.2).
export type ModelId = 'james' | 'remy' | 'liza' | 'michelle';

export interface Clothes {
  coat: number;
  trousers: number;
  long?: boolean;
  skirt?: boolean;
  hat?: 'fedora' | 'cap' | 'scarf' | 'none';
  hair?: boolean;
  red?: boolean;
}

export interface Step {
  from: number;            // игровые минуты
  to: number;
  place?: string;          // стоять здесь
  path?: string[];         // идти по точкам
  offset?: [number, number];
  anim?: 'idle' | 'talk' | 'sit' | 'walk' | 'rail' | 'work' | 'lie' | 'drive' | 'crouch';
  face?: number;           // радианы
  ifFlag?: string;
  unlessFlag?: string;
  hidden?: boolean;
}

export interface NpcDef {
  id: string;
  ru: string;
  en: string;
  model: ModelId;
  scale?: number;
  clothes: Clothes;
  key?: boolean;
  schedule: Step[];
}

const S = (from: number, to: number, place: string, anim: Step['anim'] = 'idle', offset?: [number, number], face?: number): Step =>
  ({ from, to, place, anim, offset, face });

const P = (from: number, to: number, path: string[], anim: Step['anim'] = 'walk'): Step =>
  ({ from, to, path, anim });

export const NPCS: NpcDef[] = [
  {
    id: 'krayn', ru: 'Эвелина Крайн', en: 'Evelina Krain', model: 'liza', key: true,
    clothes: { coat: 0x22242a, trousers: 0x1a1a1c, skirt: true, hat: 'scarf', long: true, red: false },
    schedule: [
      S(0, 5, 'tower_roof', 'talk', [0.9, 0.4], 2.6),
      { from: 5, to: 52, place: 'tower_roof', hidden: true },
      S(52, 58, 'pier7', 'talk', [1.2, -0.6], -1.4),
      { from: 58, to: 60, place: 'pier7', hidden: true },
    ],
  },
  {
    id: 'lydia', ru: 'Лидия', en: 'Lydia', model: 'liza', key: true,
    clothes: { coat: 0x3b3a32, trousers: 0x2b2b2b, hat: 'scarf' },
    schedule: [
      S(0, 15, 'tower_roof', 'work', [-0.7, 0.6], 3.6),
      P(15, 20, ['tower_roof', 'tower']),
      { from: 20, to: 40, place: 'tower', hidden: true },
      S(40, 55, 'tower', 'sit', [1.2, 1.5], Math.PI),
      { from: 55, to: 60, place: 'tower', hidden: true },
    ],
  },
  {
    id: 'fern', ru: 'Ферн', en: 'Fern', model: 'james',
    clothes: { coat: 0x302c24, trousers: 0x1e1c19, hat: 'cap' },
    schedule: [
      S(0, 5, 'tower_roof', 'idle', [2.2, -1.2], -2.2),
      S(5, 22, 'square', 'idle', [1.4, -1.8], 0.8),
      S(22, 45, 'square', 'talk', [0.6, -0.6], 2.4),
      S(45, 60, 'tower', 'idle', [2.4, 1.6], 3.1),
    ],
  },
  {
    id: 'stern', ru: 'Штерн', en: 'Stern', model: 'remy',
    clothes: { coat: 0x2a2b2f, trousers: 0x232324, hat: 'fedora' },
    schedule: [
      S(0, 4, 'tower_basement', 'work', [0, 0], Math.PI / 2),
      P(4, 10, ['tower', 'square', 'market']),
      { from: 10, to: 60, hidden: true },
    ],
  },
  {
    id: 'orven', ru: 'Орвен', en: 'Orven', model: 'james',
    clothes: { coat: 0x413a2c, trousers: 0x26241f, hat: 'cap' },
    schedule: [
      S(0, 9, 'orven', 'work', [0, -0.6], 0),
      S(9, 10, 'orven', 'idle', [0.1, 3.0], 0),
      { from: 10, to: 60, hidden: true },
    ],
  },
  {
    id: 'ned', ru: 'Нед', en: 'Ned', model: 'remy', key: true,
    clothes: { coat: 0x33302a, trousers: 0x242322, hat: 'cap' },
    schedule: [
      S(0, 6, 'tavern', 'sit', [1.2, 0.6], 2.2),
      P(6, 8, ['tavern', 'embankment_e', 'bridge_ned']),
      S(8, 16, 'bridge_ned', 'rail', [0, 0], -1.5),
      { from: 16, to: 20, place: 'bridge_ned', hidden: true },
      S(20, 60, 'embankment_e', 'idle', [0.6, 1.2], 0.4),
    ],
  },
  {
    id: 'tilda', ru: 'Тильда', en: 'Tilda', model: 'michelle',
    clothes: { coat: 0x3a342c, trousers: 0x2a2721, skirt: true, hat: 'scarf' },
    schedule: [
      S(8, 14, 'alley', 'talk', [-1.4, 0.2], 1.2),
      P(14, 22, ['alley', 'market', 'embankment_w', 'bridge', 'embankment_e', 'pier7']),
      S(22, 33, 'pier7', 'talk', [1.6, 1.2], -1.2),
      S(33, 40, 'pier7', 'idle', [-1.2, 2.0], -1.0),
      { from: 40, to: 60, place: 'pier7', hidden: true },
    ],
  },
  {
    id: 'agata', ru: 'Агата', en: 'Agata', model: 'michelle', scale: 1.02,
    clothes: { coat: 0x2f2a26, trousers: 0x2a2521, skirt: true, long: true, hat: 'scarf' },
    schedule: [S(0, 60, 'tavern', 'work', [-2.4, 1.0], 1.4)],
  },
  {
    id: 'ignat', ru: 'Игнат', en: 'Ignat', model: 'james',
    clothes: { coat: 0x25262b, trousers: 0x1b1b1d, hat: 'none' },
    schedule: [
      S(0, 12, 'tavern', 'sit', [1.6, -0.9], Math.PI),
      P(12, 12.6, ['tavern', 'tavern_yard', 'sklad']),
      { from: 12.6, to: 60, place: 'sklad', hidden: true },
    ],
  },
  {
    id: 'lovchiy', ru: 'Ловчий', en: 'Hunter', model: 'remy',
    clothes: { coat: 0x2b241d, trousers: 0x211e1a, hat: 'fedora' },
    schedule: [
      S(0, 12, 'tavern', 'sit', [2.4, -0.5], Math.PI),
      P(12, 12.6, ['tavern', 'tavern_yard', 'sklad']),
      { from: 12.6, to: 60, place: 'sklad', hidden: true },
    ],
  },
  {
    id: 'shram', ru: 'Шрам', en: 'Scar', model: 'james', key: true,
    clothes: { coat: 0x1e1f22, trousers: 0x191a1b, hat: 'fedora' },
    schedule: [
      S(0, 6, 'tavern', 'talk', [-1.0, -1.2], 0.6),
      P(6, 10, ['tavern', 'embankment_e', 'bridge', 'embankment_w', 'office']),
      S(10, 13, 'office', 'work', [0.4, 0], Math.PI),
      P(13, 20, ['office', 'bridge', 'embankment_e', 'pier7']),
      S(34, 40, 'pier7', 'idle', [-1.6, 0.6], -0.6),
      { from: 40, to: 60, hidden: true },
    ],
  },
  {
    id: 'foma', ru: 'Фома', en: 'Foma', model: 'james', key: true,
    clothes: { coat: 0x37322a, trousers: 0x232020, hat: 'cap' },
    schedule: [
      S(0, 30, 'foma', 'work', [0, -0.8], 0),
      S(30, 60, 'foma', 'idle', [0, 2.6], Math.PI),
    ],
  },
  {
    id: 'gale', ru: 'Гейл', en: 'Gale', model: 'james', key: true,
    clothes: { coat: 0x2c2d31, trousers: 0x202022, hat: 'none' },
    schedule: [
      S(0, 10, 'office', 'work', [0, -0.4], 0),
      S(10, 14, 'office', 'work', [0, -0.4], 0),
      S(14, 60, 'office_yard', 'lie', [0.4, 0.8], 1.2),
    ],
  },
  {
    id: 'agnia', ru: 'Матушка Агния', en: 'Mother Agnia', model: 'michelle', key: true,
    clothes: { coat: 0x1c1b19, trousers: 0x161513, skirt: true, long: true, hat: 'scarf' },
    schedule: [
      S(0, 20, 'shelter_office', 'work', [0, -0.6], 0),
      S(20, 30, 'shelter_office', 'talk', [0.3, -0.4], 0.4),
      S(30, 40, 'shelter_yard', 'idle', [1.2, -0.8], -1.8),
      S(40, 60, 'shelter_hall', 'idle', [0, 0.6], 2.6),
    ],
  },
  {
    id: 'anna', ru: 'Анна', en: 'Anna', model: 'liza', key: true,
    clothes: { coat: 0x3d3d3a, trousers: 0x2a2a28, skirt: true, hat: 'scarf' },
    schedule: [
      S(0, 30, 'shelter_dorm', 'talk', [1.2, -1.0], 1.4),
      S(30, 40, 'shelter_yard', 'talk', [0.4, 1.4], -0.8),
      S(40, 60, 'shelter_hall', 'idle', [-1.2, 0.8], 2.2),
    ],
  },
  {
    id: 'anka', ru: 'Анка', en: 'Anka', model: 'liza', scale: 0.62,
    clothes: { coat: 0x3a352e, trousers: 0x2a2723, hat: 'scarf' },
    schedule: [
      { from: 0, to: 30, place: 'shelter_dorm', hidden: true },
      S(30, 40, 'shelter_yard', 'idle', [1.8, 0.8], -2.2),
      S(40, 60, 'shelter_dorm', 'idle', [0.6, -0.4], 1.8),
    ],
  },
  {
    id: 'tikhon', ru: 'Тихон', en: 'Tikhon', model: 'remy', key: true,
    clothes: { coat: 0x2f2d27, trousers: 0x232220, hat: 'cap' },
    schedule: [
      S(0, 28, 'tikhon', 'sit', [0.5, -0.4], 0.2),
      S(28, 29, 'tikhon', 'idle', [0.5, 1.2], Math.PI),
      P(29, 37, ['tikhon', 'kanat', 'pier3']),
      S(37, 40, 'pier3', 'idle', [1.2, 0.4], Math.PI),
      { from: 40, to: 60, place: 'boat', hidden: true },
    ],
  },
  {
    id: 'pip', ru: 'Пип', en: 'Pip', model: 'liza', scale: 0.58,
    clothes: { coat: 0x4a4438, trousers: 0x3a352c, hat: 'scarf' },
    schedule: [S(0, 60, 'tikhon', 'sit', [1.6, -1.4], 0.4)],
  },
  {
    id: 'lukyan', ru: 'Лукьян', en: 'Lukyan', model: 'james', key: true,
    clothes: { coat: 0x2b2f2c, trousers: 0x1f2220, hat: 'cap' },
    schedule: [
      S(0, 24, 'barge', 'work', [0.4, 0.2], 1.2),
      S(24, 33, 'barge', 'talk', [0.4, 0.2], -1.4),
      S(33, 55, 'barge', 'lie', [0.6, 0.4], 1.6),
      { from: 55, to: 60, hidden: true },
    ],
  },
  {
    id: 'kord', ru: 'Корд', en: 'Kord', model: 'james', key: true,
    clothes: { coat: 0x1b1c1e, trousers: 0x17181a, hat: 'fedora', long: true },
    schedule: [
      S(16, 22, 'warehouse', 'idle', [2.4, 1.2], 0.8),
      S(22, 34, 'warehouse', 'idle', [1.4, 0.8], 0.8),
      S(34, 40, 'pier7', 'talk', [-0.6, 2.6], -2.2),
      P(40, 47, ['pier7', 'embankment_e', 'bridge', 'embankment_w', 'pier3']),
      S(47, 60, 'pier3', 'idle', [1.2, 0.2], 0.2),
    ],
  },
  {
    id: 'jan', ru: 'Ян', en: 'Jan', model: 'remy',
    clothes: { coat: 0x2b3030, trousers: 0x222625, hat: 'cap' },
    schedule: [
      S(0, 35, 'boat', 'idle', [0, -1.2], 1.4),
      S(35, 36, 'pier3', 'idle', [0.4, 1.2], 3.0),
      { from: 36, to: 60, hidden: true },
    ],
  },
  {
    id: 'guard1', ru: 'Охранник', en: 'Guard', model: 'james',
    clothes: { coat: 0x4a4a46, trousers: 0x2c2c2a, hat: 'fedora' },
    schedule: [
      S(20, 40, 'shelter_yard', 'idle', [-2.6, 0.6], 1.6),
      S(34, 60, 'pier3', 'idle', [2.2, 0.6], -1.2),
    ],
  },
  {
    id: 'guard2', ru: 'Охранник', en: 'Guard', model: 'remy',
    clothes: { coat: 0x46463f, trousers: 0x2a2a27, hat: 'fedora' },
    schedule: [
      S(20, 40, 'shelter_yard', 'idle', [-2.2, 2.0], 2.0),
      S(34, 60, 'pier3', 'idle', [2.8, -0.4], -1.0),
    ],
  },
  {
    id: 'guard3', ru: 'Охранник', en: 'Guard', model: 'james',
    clothes: { coat: 0x42423d, trousers: 0x292926, hat: 'fedora' },
    schedule: [
      S(20, 40, 'shelter_yard', 'idle', [2.6, 2.2], -2.6),
      S(34, 60, 'pier3', 'idle', [3.4, 0.8], -0.6),
    ],
  },
  {
    id: 'visitor1', ru: 'Моряк', en: 'Sailor', model: 'james',
    clothes: { coat: 0x2a303a, trousers: 0x242a30, hat: 'cap' },
    schedule: [S(0, 60, 'tavern', 'sit', [-2.2, -1.8], 0.8)],
  },
  {
    id: 'visitor2', ru: 'Докер', en: 'Docker', model: 'remy',
    clothes: { coat: 0x332f28, trousers: 0x262320, hat: 'cap' },
    schedule: [S(0, 60, 'tavern', 'sit', [-1.2, -2.4], 1.0)],
  },
  {
    id: 'passer', ru: 'Прохожий', en: 'Passer-by', model: 'james',
    clothes: { coat: 0x2d2c28, trousers: 0x242320, hat: 'fedora' },
    schedule: [
      P(0, 8, ['market', 'embankment_w', 'bridge', 'embankment_e']),
      P(8, 18, ['embankment_e', 'bridge', 'embankment_w', 'market']),
      P(18, 30, ['market', 'embankment_w', 'bridge', 'embankment_e', 'sklad']),
      { from: 30, to: 60, hidden: true },
    ],
  },
];

export const npcById = (id: string) => NPCS.find((n) => n.id === id);

// Мировые события хронологии (§10). Без игрока всё это происходит само.
export interface WorldEvent {
  id: string;
  minute: number;
  unlessFlag?: string;
  ifFlag?: string;
  place?: string;
  ru: string;
  en: string;
}

export const EVENTS: WorldEvent[] = [
  { id: 'lights_flicker', minute: 5, unlessFlag: 'tapCut', ru: '22:05 · фонари мигают по всему городу', en: '22:05 · lights flicker across town' },
  { id: 'explosion', minute: 12, place: 'warehouse', ru: '22:12 · взрыв на складе Харроу', en: '22:12 · explosion at Harrow warehouse' },
  { id: 'tram_stops', minute: 13, unlessFlag: 'tapCut', ru: '22:13 · трамвай встал у рынка', en: '22:13 · tram stops by the market' },
  { id: 'telegraph', minute: 18, unlessFlag: 'tapCut', ru: '22:18 · телеграф искрит и гаснет', en: '22:18 · telegraph sparks and dies' },
  { id: 'bell_silent', minute: 22, unlessFlag: 'tapCut', ru: '22:22 · колокол молчит', en: '22:22 · the bell stays silent' },
  { id: 'market_fire', minute: 30, unlessFlag: 'tapCut', ru: '22:30 · пожар на Рыночной', en: '22:30 · fire on Market street' },
  { id: 'fire_kanat', minute: 45, unlessFlag: 'tapCut', ru: '22:45 · огонь дошёл до Канатной', en: '22:45 · fire reaches Ropemakers street' },
  { id: 'bell_ring', minute: 30, ifFlag: 'tapCut', ru: '22:30 · колокол бьёт', en: '22:30 · the bell rings' },
  { id: 'bell_ring2', minute: 45, ifFlag: 'tapCut', ru: '22:45 · колокол бьёт', en: '22:45 · the bell rings' },
  { id: 'tilda_shot', minute: 33, unlessFlag: 'tildaWarned', place: 'pier7', ru: '22:33 · выстрел на пирсе 7', en: '22:33 · a shot at pier 7' },
  { id: 'kord_pier', minute: 34, place: 'pier7', ru: '22:34 · машина Корда у пирса 7', en: "22:34 · Kord's car at pier 7" },
  { id: 'jan_killed', minute: 35, place: 'pier3', ru: '22:35 · катер у пристани №3, Ян убит', en: '22:35 · launch at pier 3, Jan killed' },
  { id: 'tikhon_pier', minute: 37, ifFlag: 'tikhonGoes', ru: '22:37 · Тихон на пристани №3', en: '22:37 · Tikhon at pier 3' },
  { id: 'boat_departs', minute: 40, ifFlag: 'tikhonTurned', ru: '22:40 · катер отходит', en: '22:40 · the launch departs' },
  { id: 'wagon_leaves', minute: 40, unlessFlag: 'wagonPinPulled', ru: '22:40 · повозка выезжает из приюта', en: '22:40 · the wagon leaves the shelter' },
  { id: 'wagon_bridge', minute: 44, unlessFlag: 'wagonPinPulled', ru: '22:44 · повозка на Старом мосту', en: '22:44 · the wagon on the Old bridge' },
  { id: 'wagon_break', minute: 44, ifFlag: 'wagonPinPulled', ru: '22:44 · колесо повозки слетает на мосту', en: '22:44 · the wagon wheel comes off on the bridge' },
  { id: 'krayn_pier', minute: 52, place: 'pier7', ru: '22:52 · Крайн приезжает к пирсу 7', en: '22:52 · Krain arrives at pier 7' },
];

export function eventsAt(minute: number, flags: Record<string, number>): WorldEvent[] {
  return EVENTS.filter((e) => e.minute === minute
    && (!e.unlessFlag || flags[e.unlessFlag] === undefined)
    && (!e.ifFlag || flags[e.ifFlag] !== undefined));
}

export { learn, setFlag, has, flag, fmtMin };
