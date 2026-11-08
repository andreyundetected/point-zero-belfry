import { Conv, L, A } from '../game/dialogue';
import { at } from '../sim/time';

// 02_DIALOGUES §5 Agata, §6 the table, §7 Foma
export const agataAfter: Conv = { id: 'agata.after', start: 'a', nodes: {
  a: { say: [L('agata', '(подметает стекло) Закрыто. Не видишь — разгром.')], choices: [{ ru: 'Где люди, что тут сидели?', next: 'b' }, { ru: 'Мне налить.', next: 'p' }] },
  p: { say: [A('(наливает молча, ставит)'), L('agata', 'Пей и иди.')], next: 'b' },
  b: { say: [L('agata', 'Восемь человек с вечера. Корда люди. Играли, не пили почти. Ждали. Как бахнуло на складе — все туда. Деньги со стола сгребли.')], choices: [{ ru: 'Кто наверху?', next: 'u' }, { ru: 'Харроу тут бывает?', next: 'h' }] },
  u: { say: [L('agata', 'Никого. Комнату держат за ними. Иди посмотри, раз такой любопытный.')], fx: c => c.learn('know_room_up'), end: true },
  h: { say: [L('agata', '(смотрит) Не знаю такого. Вот пальто его наверху висит третий месяц — а самого не знаю.')], fx: c => { c.learn('know_coat'); c.note('agata1', 'Агата: восемь человек Корда сидели с вечера, ждали. Как бахнуло на складе — все туда. Наверху висит пальто «В.Х.» третий месяц.', 'Agata: eight of Cord\'s men sat here since evening, waiting. When the warehouse blew, they all left. A coat with "V.H." hangs upstairs for three months.', 'agata'); }, end: true },
} };
export const agataBefore: Conv = { id: 'agata.before', start: 'a', nodes: {
  a: { say: [L('agata', 'Садись у стойки, не стой столбом. Эти не любят, когда стоят. (кивает на стол)')], choices: [{ ru: 'Кто такие?', next: 'b' }, { ru: 'Налей.', next: 'c' }, { ru: 'Курьера знаешь? Рыжий.', next: 'd', if: c => c.t() < at(22, 8) }] },
  b: { say: [L('agata', 'Не мои гости. Я их не звала. Сиди тихо.')], fx: c => c.learn('know_cord_men'), end: true },
  c: { say: [A('(наливает молча)')], end: true },
  d: { say: [L('agata', 'Нед. Дурачок. Вон он, весь вечер им проигрывает. (тише) Ты его заберёшь отсюда — спасибо скажу.')], fx: c => { c.learn('know_ned_here'); c.note('agata0', 'Агата: «Нед. Дурачок. Весь вечер им проигрывает».', 'Agata: "Ned. A fool. Loses to them all evening."', 'agata'); }, end: true },
} };
export const agataFight: Conv = { id: 'agata.fight', start: 'a', nodes: { a: { say: [L('agata', '(из-за стойки, шёпотом) Уходи. Через двор. Сейчас вернутся.')], fx: c => c.openDoor('tavern.back', true), end: true } } };
export const ignatTable: Conv = { id: 'ignat.table', start: 'a', nodes: {
  a: { say: [L('ignat', 'Стол занят.')], choices: [{ ru: 'Сыграю.', next: 'b' }, { ru: 'Ищу курьера.', if: c => c.t() < at(22, 6), next: 'c' }, { ru: '(Отойти)', next: 'z' }] },
  b: { say: [L('ignat', 'Ставка — сотня. Есть сотня? Нет? Иди к стойке.')], end: true },
  c: { say: [L('ignat', 'Вот он. Курьер, тебя ищут.'), A('(Нед бледнеет.)')], end: true },
  z: { end: true },
} };
export const scarHunt: Conv = { id: 'scar.angry', start: 'a', nodes: { a: { say: [L('scar', 'Ты. Встань.')], fx: c => c.flag('scarAlert'), end: true } } };

// ---- Foma through the door / caught / after the fire
export const fomaDoor: Conv = { id: 'foma.door', start: 'a', nodes: {
  a: { say: [A('(стук)'), L('foma', '(из-за двери) Закрыто!')], choices: [
    { ru: 'Мне ствол нужен.', next: 'b1' }, { ru: 'Я от Неда.', next: 'b2' },
    { ru: 'Через несколько минут здесь всё сгорит. Открой.', know: 'saw_foma_fire', kt: '22:30', next: 'b3' },
    { ru: 'Твой револьвер краденый. Утром за ним придут.', know: 'know_gun_stolen', kt: 'опись', if: c => c.fl('tapCut'), next: 'b4' }] },
  b1: { say: [L('foma', 'Мне тоже много чего нужно. Иди.')], fx: c => c.learn('foma_door'), end: true },
  b2: { say: [L('foma', 'Нед мне шесть монет должен. Пусть сам придёт.')], end: true },
  b3: { say: [L('foma', '(пауза) Ты пьяный? Иди отсюда, пока я полицию… (смешок) Полиции нет. Ну и иди.')], fx: c => { if (c.t() < at(22, 24)) c.flag('fomaWarned'); }, end: true },
  b4: { say: [L('foma', '(долгая пауза, засов) …Пять минут. Деньги вперёд.')], fx: c => { c.flag('fomaPaid'); c.openDoor('foma.door', true); }, end: true },
} };
export const fomaCaught: Conv = { id: 'foma.caught', start: 'a', nodes: {
  a: { say: [L('foma', '(с лампой в проёме, голос срывается) Кто здесь?! У меня…')], choices: [{ ru: 'Тихо. Я уже ухожу.', next: 'b' }, { ru: '(Поднять револьвер)', if: c => c.gun(), next: 'c' }, { ru: 'Бери шкатулку и выходи. Скоро тут всё сгорит. Я знаю.', know: 'saw_foma_fire', kt: '22:30', next: 'd' }] },
  b: { say: [L('foma', 'Как ты вошёл? Дверь на засове!.. Как ты вошёл?!')], end: true },
  c: { say: [L('foma', 'Бери. Бери. Только уходи.')], end: true },
  d: { say: [L('foma', '(смотрит на ставни, принюхивается) …Газом пахнет.')], fx: c => c.flag('fomaWarned'), end: true },
} };
export const fomaAfter: Conv = { id: 'foma.after', start: 'a', nodes: {
  a: { say: [L('foma', '(сидит на шкатулке, мокрый) Тридцать лет. Тридцать лет в долг давал, а сам ни у кого не брал.')], choices: [{ ru: 'Сочувствую.', next: 'z' }, { ru: 'Ствол у тебя был.', next: 'b' }] },
  b: { say: [L('foma', 'Был. Под половицей. (машет рукой на огонь) Теперь там — бери, если достанешь.')], fx: c => { c.learn('know_gun_under_floor'); c.thread('gun'); c.message('Руины. Встать там, где стоял ящик, и прыгнуть на 22:15.', 'The ruins. Stand where the box was and jump to 22:15.'); }, end: true },
  z: { end: true },
} };
