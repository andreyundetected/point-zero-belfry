import type { GameState } from '../game/state';
import { fmt } from '../sim/time';
import { getLang } from '../game/strings';
import { nameOf } from '../game/dialogue';

// B5: "This branch" in human words; every flag has a Ru/En line
const FLAG_TXT: Record<string, [string, string]> = {
  jetonStolen: ['Украл жетон Неда со стола', 'Stole Ned\'s token from the table'], tapCut: ['Выдернул предохранитель отвода в подвале башни', 'Pulled the tap fuse in the tower cellar'],
  nedSaved: ['Удержал Неда на мосту', 'Kept Ned from jumping'], nedKept: ['Нед остался у перил — не прыгнул', 'Ned stayed at the rail — no jump'], nedLeftEarly: ['Увёл Неда из-за стола до проигрыша', 'Got Ned away from the table before he lost'],
  wagonPinPulled: ['Выбил чеку с оси повозки приюта', 'Knocked the linchpin out of the orphanage wagon'], tildaWarned: ['Предупредил Тильду', 'Warned Tilda'], annaWarned: ['Предупредил Анну', 'Warned Anna'],
  tikhonTurned: ['Тихон отдал кепку и остался с Пип', 'Tikhon gave up his cap and stayed with Pip'], tikhonThreatened: ['Забрал кепку у Тихона под угрозой', 'Took Tikhon\'s cap at gunpoint'], tikhonHurt: ['Оглушил Тихона', 'Knocked Tikhon out'],
  gaylWarned: ['Предупредил Гейла — он ушёл из конторы', 'Warned Gayl — he left the office'], ignatDead: ['Убил Игната', 'Killed Ignat'], lovchiyDead: ['Убил Ловчего', 'Killed Lovchiy'],
  safeOpened: ['Открыл сейф Гейла', 'Opened Gayl\'s safe'], fomaWarned: ['Предупредил Фому о пожаре', 'Warned Foma about the fire'], fomaAlarmed: ['Фома застал меня в кладовке', 'Foma caught me in the storeroom'],
  gunTaken: ['Взял револьвер Фомы', 'Took Foma\'s revolver'], sternScared: ['Спугнул техника в подвале', 'Scared off the technician'], alarm: ['Подняли тревогу', 'An alarm was raised'], lampsShot: ['Прострелил лампы', 'Shot out the lamps'],
  gateOpen: ['Впустили во двор приюта', 'Let into the orphanage yard'], patrolPassed: ['Прошёл патруль на мосту по жетону', 'Passed the bridge patrol on the token'], ringGiven: ['Отдал кольцо Анне', 'Gave Anna the ring'], prologueOver: ['Пролог на крыше', 'The roof prologue'],
};
export function branchHtml(s: GameState): string {
  const ru = getLang() === 'ru'; const rows: string[] = [];
  for (const [k, t] of s.flags.entries()) { if (k.startsWith('talk_')) { rows.push(`<p><span class="dim">${fmt(t)}</span> ${ru ? 'Говорил' : 'Talked'}: ${nameOf(k.slice(5))}</p>`); continue; } const tx = FLAG_TXT[k]; if (tx) rows.push(`<p><span class="dim">${fmt(t)}</span> ${ru ? tx[0] : tx[1]}</p>`); }
  const head = `<p class="dim">${ru ? `Ветка началась в ${fmt(s.universeStart)} · прыжков всего: ${s.jumps}` : `Branch started at ${fmt(s.universeStart)} · jumps: ${s.jumps}`}</p>`;
  return head + (rows.length ? rows.join('') : `<p class="dim">${ru ? 'С последнего прыжка ничего не изменилось.' : 'Nothing has changed since the last jump.'}</p>`);
}
export interface MapPlace { x: number; z: number; name: string; desc: string; kind: 'place' | 'person' | 'thread'; label?: string; }
const PL: [string, string, number, number, string, string][] = [
  ['Башня-каланча', 'Bell tower', -70, -58, 'Крыша-обсерватория, Створка. Подвал — подстанция.', 'Roof observatory. Cellar substation.'],
  ['Лавка Орвена «Ключи и замки»', 'Orven\'s shop', -46, -33.3, 'Ключник порта. Переулок Ключников.', 'The port locksmith. Kluchnikov alley.'],
  ['Лавка Фомы «Залоги»', 'Foma\'s pawnshop', -40, -14.4, 'Ростовщик. Рыночная улица.', 'Pawnbroker. Rynochnaya.'],
  ['Старый мост', 'Old Bridge', 0, 0, 'Единственная переправа через канал.', 'The only crossing.'],
  ['Таверна «Якорь»', 'The Anchor', 24, 9, 'Набережная Заречья. Люди Корда с вечера.', 'Zarechye embankment.'],
  ['Курьерская контора', 'Courier office', 44, 23, 'Гейл, сейф. При складе Харроу.', 'Gayl, the safe.'],
  ['Склад №2 Харроу', 'Harrow\'s warehouse', 66, 32, 'Склад Харроу. Ворота, кран.', 'Harrow\'s warehouse.'],
  ['Приют св. Лукии', 'St. Lucia orphanage', 50, -62, 'На холме. Матушка Агния, сестра Анна.', 'On the hill.'],
  ['Дом Тихона, Канатная 4', 'Tikhon\'s house', -38, 40, 'Рулевой Тихон и дочь Пип.', 'Tikhon and Pip.'],
  ['Пристань №3', 'Pier 3', -42, 70, 'Катер Харроу швартуется в 22:35.', 'Harrow\'s launch moors at 22:35.'],
  ['Пирс 7, баржа «Вера»', 'Pier 7, barge Vera', -9.5, 66, 'Баржа Лукьяна.', 'Lukyan\'s barge.'],
  ['Почта и телеграф', 'Post office', -22, -15, 'Рыночная.', 'Rynochnaya.'],
];
export function mapPlaces(s: GameState): MapPlace[] {
  const ru = getLang() === 'ru'; const out: MapPlace[] = PL.map(p => ({ x: p[2], z: p[3], name: ru ? p[0] : p[1], desc: ru ? p[4] : p[5], kind: 'place' as const }));
  // people the player has met, at the place he last saw them (spec 2.5: "where and when seen")
  for (const [id, pos] of s.lastSeen) if (s.met.has(id)) out.push({ x: pos.x, z: pos.z, name: nameOf(id), desc: (ru ? 'видел здесь в ' : 'seen here at ') + fmt(pos.t), kind: 'person' });
  return out;
}
