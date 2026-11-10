import { Conv, L, A, W } from '../game/dialogue';
import { at } from '../sim/time';

// 02_DIALOGUES §5 Agata, §6 the table, §7 Foma
export const agataFight: Conv = { id: 'agata.fight', start: 'a', nodes: { a: { say: [L('agata', '(из-за стойки, шёпотом) Уходи. Через двор. Сейчас вернутся.')], fx: c => c.openDoor('tavern.back', true), end: true } } };
export const ignatTable: Conv = { id: 'ignat.table', start: 'a', nodes: {
  a: { say: [L('ignat', 'Стол занят.')], choices: [{ ru: 'Сыграю.', next: 'b' }, { ru: 'Ищу курьера.', if: c => c.t() < at(22, 6), next: 'c' }, { ru: '(Отойти)', next: 'z' }] },
  b: { say: [L('ignat', 'Ставка — сотня. Есть сотня? Нет? Иди к стойке.')], end: true },
  c: { say: [L('ignat', 'Вот он. Курьер, тебя ищут.'), A('(Нед бледнеет.)')], end: true },
  z: { end: true },
} };
export const scarHunt: Conv = { id: 'scar.angry', start: 'a', nodes: { a: { say: [L('scar', 'Ты. Встань.')], fx: c => c.flag('scarAlert'), end: true } } };

// ---- Foma through the door / caught / after the fire
