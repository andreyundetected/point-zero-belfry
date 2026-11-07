// Координаты Затона из спеки §4.2. Метры: X на восток, Z на юг.
// Всё, что стоит в мире, берёт позицию отсюда.

export interface Place {
  id: string;
  ru: string;
  en: string;
  x: number;
  z: number;
  indoor?: boolean;
  door?: { x: number; z: number };
}

export const PLACES: Record<string, Place> = {
  tower: { id: 'tower', ru: 'Башня-каланча', en: 'Watchtower', x: -70, z: -58, door: { x: -70, z: -54 } },
  tower_roof: { id: 'tower_roof', ru: 'Крыша каланчи', en: 'Tower roof', x: -70, z: -58, indoor: true },
  tower_basement: { id: 'tower_basement', ru: 'Подстанция №3', en: 'Substation 3', x: -75.5, z: -57.5, indoor: true },
  square: { id: 'square', ru: 'Башенная площадь', en: 'Tower square', x: -68, z: -40 },
  orven: { id: 'orven', ru: 'Лавка Орвена', en: "Orven's shop", x: -46, z: -33, indoor: true, door: { x: -46, z: -30.5 } },
  alley: { id: 'alley', ru: 'Переулок Ключников', en: 'Keymakers alley', x: -40, z: -34 },
  market: { id: 'market', ru: 'Рыночная улица', en: 'Market street', x: -50, z: -8 },
  foma: { id: 'foma', ru: 'Лавка Фомы', en: "Foma's pawnshop", x: -40, z: -14, indoor: true, door: { x: -40, z: -10.6 } },
  post: { id: 'post', ru: 'Почта и телеграф', en: 'Post office', x: -22, z: -15 },
  embankment_w: { id: 'embankment_w', ru: 'Береговая улица', en: 'Embankment street', x: -14, z: -20 },
  bridge: { id: 'bridge', ru: 'Старый мост', en: 'Old bridge', x: 0, z: 0 },
  bridge_ned: { id: 'bridge_ned', ru: 'Нед у перил', en: 'Ned at the rail', x: 0, z: 2.6 },
  embankment_e: { id: 'embankment_e', ru: 'Набережная Заречья', en: 'Zarechye embankment', x: 14, z: 0 },
  tavern: { id: 'tavern', ru: 'Таверна «Якорь»', en: 'The Anchor tavern', x: 26, z: 9, indoor: true, door: { x: 26, z: 12.5 } },
  tavern_up: { id: 'tavern_up', ru: 'Комната наверху', en: 'Upstairs room', x: 26, z: 6.5, indoor: true },
  tavern_yard: { id: 'tavern_yard', ru: 'Двор «Якоря»', en: 'Anchor yard', x: 22, z: 3 },
  sklad: { id: 'sklad', ru: 'Складская улица', en: 'Warehouse street', x: 50, z: 18 },
  office: { id: 'office', ru: 'Курьерская контора', en: 'Courier office', x: 44, z: 24, indoor: true, door: { x: 44, z: 27 } },
  office_yard: { id: 'office_yard', ru: 'Двор конторы', en: 'Office yard', x: 48, z: 20 },
  warehouse: { id: 'warehouse', ru: 'Склад Харроу', en: 'Harrow warehouse', x: 66, z: 28 },
  shelter: { id: 'shelter', ru: 'Приют св. Лукии', en: 'St Lucia shelter', x: 50, z: -62, indoor: true, door: { x: 50, z: -56 } },
  shelter_yard: { id: 'shelter_yard', ru: 'Двор приюта', en: 'Shelter yard', x: 48, z: -53 },
  shelter_hall: { id: 'shelter_hall', ru: 'Холл приюта', en: 'Shelter hall', x: 50, z: -60, indoor: true },
  shelter_office: { id: 'shelter_office', ru: 'Кабинет Агнии', en: "Agnia's office", x: 47, z: -62, indoor: true },
  shelter_dorm: { id: 'shelter_dorm', ru: 'Спальня детей', en: 'Children dorm', x: 53, z: -62, indoor: true },
  kanat: { id: 'kanat', ru: 'Канатная улица', en: 'Ropemakers street', x: -30, z: 36 },
  tikhon: { id: 'tikhon', ru: 'Дом Тихона', en: "Tikhon's house", x: -38, z: 39, indoor: true, door: { x: -38, z: 42 } },
  pier3: { id: 'pier3', ru: 'Пристань №3', en: 'Pier 3', x: -42, z: 60 },
  pier7: { id: 'pier7', ru: 'Пирс 7', en: 'Pier 7', x: -9, z: 64 },
  barge: { id: 'barge', ru: 'Баржа «Вера»', en: 'Barge Vera', x: -5, z: 64, indoor: true },
  boat: { id: 'boat', ru: 'Катер Харроу', en: "Harrow's launch", x: -40, z: 64, indoor: true },
  canal: { id: 'canal', ru: 'Канал', en: 'Canal', x: 0, z: -20 },
  harbour: { id: 'harbour', ru: 'Гавань', en: 'Harbour', x: 0, z: 66 },
};

export const place = (id: string): Place => PLACES[id] ?? PLACES.market;

// Маршруты для расписаний: ломаные через мост.
export const ROUTES: Record<string, string[]> = {
  west_to_bridge: ['market', 'embankment_w', 'bridge'],
  bridge_to_tavern: ['bridge', 'embankment_e', 'tavern'],
  market_to_tavern: ['market', 'embankment_w', 'bridge', 'embankment_e', 'tavern'],
  market_to_orven: ['market', 'orven'],
  orven_to_market: ['orven', 'market'],
  bridge_to_pier7: ['bridge', 'embankment_w', 'pier7'],
  kanat_to_pier3: ['tikhon', 'kanat', 'pier3'],
  shelter_to_yard: ['shelter', 'shelter_yard'],
  office_to_warehouse: ['office', 'office_yard', 'warehouse'],
};
