import type { HouseOpts } from './kit';

/** Таблица фасадов (спека §3 и ассет-гайд §6): 8+ разных на площадь, 4 на набережную, фон — hex-здания. */
export interface Facade { id: string; where: string; opts: HouseOpts; note: string }
export const FACADES: Facade[] = [
  { id: 'F1', where: 'Северо-запад', note: 'Мастерская Тильды, цветочные горшки', opts: { cx: -26, cz: -22, w: 6, d: 5, floors: 1, wall: 'mixed', roof: 'gable', win: 'shutters', door: 2, doorSide: 'E', enterable: true, roofColor: 0x3d4a6b, banner: 'green' } },
  { id: 'F2', where: 'Запад', note: 'Таверна «Три якоря», вывеска, навес', opts: { cx: -28, cz: -2, w: 10, d: 8, floors: 2, wall: 'mixed', roof: 'high', win: 'glass', door: 4, doorSide: 'E', enterable: true, chimney: true, roofColor: 0x6a2f2a, banner: 'red', overhang: true, extra: [{ side: 'N', i: 5 }] } },
  { id: 'F3', where: 'Юго-запад', note: 'Пост стража (будка Игната)', opts: { cx: -36, cz: 11, w: 3, d: 3, floors: 1, wall: 'wood', roof: 'flat', win: 'small', door: 1, doorSide: 'S', enterable: true, roofColor: 0x3a3a44 } },
  { id: 'F4', where: 'Север', note: 'Часовая башня (3 этажа)', opts: { cx: 0, cz: -27, w: 6, d: 6, floors: 4, wall: 'stone', roof: 'point', win: 'round', door: 2, doorSide: 'S', enterable: true, roofColor: 0x23406a, tint: 0xd8dff0 } },
  { id: 'F5', where: 'Северо-восток', note: 'Склад (дерево, 2 этажа)', opts: { cx: 22, cz: -15, w: 7, d: 5, floors: 2, wall: 'wood', roof: 'gable', win: 'shutters', door: 3, doorSide: 'S', roofColor: 0x4b3a2f } },
  { id: 'F6', where: 'Восток', note: 'Дом с аркой (камень)', opts: { cx: 25, cz: 0, w: 5, d: 7, floors: 2, wall: 'stone', roof: 'gable', win: 'round', door: 3, doorSide: 'W', arch: true, roofColor: 0x2f4f4a } },
  { id: 'F7', where: 'Юго-восток', note: 'Лавка у остановки', opts: { cx: 26, cz: 11, w: 6, d: 4, floors: 1, wall: 'stone', roof: 'flat', win: 'glass', door: 2, doorSide: 'W', roofColor: 0x4a4048 } },
  { id: 'F8a', where: 'Север-северо-запад', note: 'Дом мансардой', opts: { cx: -14, cz: -29, w: 5, d: 5, floors: 2, wall: 'mixed', roof: 'high', win: 'glass', door: 2, doorSide: 'S', chimney: true, roofColor: 0x5a3a2a } },
  { id: 'F8b', where: 'Север-северо-восток', note: 'Трёхэтажный каменный', opts: { cx: 14, cz: -29, w: 5, d: 5, floors: 3, wall: 'stone', roof: 'high', win: 'small', door: 2, doorSide: 'S', roofColor: 0x3d2f4f } },
  { id: 'F9', where: 'Набережная, запад', note: 'Мастерская лодочника', opts: { cx: -24, cz: 13, w: 6, d: 3, floors: 1, wall: 'wood', roof: 'gable', win: 'shutters', door: 3, doorSide: 'S', roofColor: 0x4a3a30 } },
  { id: 'F10', where: 'Набережная, центр', note: 'Склад у трамвайной линии', opts: { cx: 34, cz: 13, w: 5, d: 3, floors: 1, wall: 'stone', roof: 'flat', win: 'small', door: 2, doorSide: 'S', roofColor: 0x3f3f4a } },
  { id: 'F11', where: 'Набережная, восток', note: 'Контора', opts: { cx: 48, cz: 13, w: 6, d: 3, floors: 2, wall: 'mixed', roof: 'gable', win: 'glass', door: 3, doorSide: 'S', roofColor: 0x5a2f3a } },
  { id: 'F12', where: 'Набережная, у пристани', note: 'Рыбацкая лавка', opts: { cx: 60, cz: 13, w: 4, d: 3, floors: 1, wall: 'wood', roof: 'point', win: 'round', door: 1, doorSide: 'S', roofColor: 0x2f4a5a } },
  { id: 'F13', where: 'Юго-восток (бюро)', note: 'Бюро харбормастера', opts: { cx: 83, cz: 9, w: 5, d: 4, floors: 1, wall: 'stone', roof: 'gable', win: 'glass', door: 1, doorSide: 'S', enterable: true, roofColor: 0x2f3f5a } },
];
// Фон (F8): hex-здания масштаба ×2.3 в тумане
export const BACKDROP: [string, number, number, number, number][] = [
  ['building_home_a_red', -46, -14, Math.PI / 2, 2.3], ['building_home_b_blue', -48, -4, Math.PI / 2, 2.3], ['building_market_yellow', -50, 8, Math.PI / 2, 2.3],
  ['building_blacksmith_green', -44, -26, 0.3, 2.3], ['building_tavern_red', -40, -36, 0.2, 2.3], ['building_church_red', 36, -34, -0.2, 2.3],
  ['building_home_a_green', 32, -12, -Math.PI / 2, 2.3], ['building_home_b_yellow', 40, 4, -Math.PI / 2, 2.3], ['building_market_blue', 38, -22, -1.4, 2.3],
  ['building_home_b_red', 6, -42, 0, 2.3], ['building_home_a_blue', -22, -40, 0.4, 2.3], ['building_home_b_green', 22, -40, -0.3, 2.3],
  ['building_windmill_yellow', -70, -30, 0.5, 2.6], ['building_windmill_blue', 70, -34, -0.4, 2.6], ['building_castle_blue', 4, -78, 0, 3.4],
  ['building_church_blue', 0, -56, 0, 3.4], ['building_well_red', -34, -16, 0, 2.0],
];
