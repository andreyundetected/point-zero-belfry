import { Conv, L, A, W } from '../game/dialogue';
import { at } from '../sim/time';

// 02_DIALOGUES §2 Orven, §3 Tilda, §4 Ned, §13 Fern / Lidia / Stern
const note1 = (c: any, full = false) => { c.learn('know_tilda'); c.learn('name_tilda'); c.learn('name_anka'); c.note('tilda1', full ? 'Тильда, прачка с Канатной: дочь Анка (8) в приюте, «переведена». На пристани говорят — детей грузят на баржу Лукьяна «Вера», пирс 7. Под шалью у неё что-то тяжёлое.' : 'Тильда ищет дочь Анку, 8 лет, красная лента в косе.', full ? 'Tilda, a washerwoman: daughter Anka (8) is at the orphanage, "transferred". On the docks they say children go onto Lukyan\'s barge Vera, pier 7. Something heavy under her shawl.' : 'Tilda is looking for her daughter Anka, 8, a red ribbon in her braid.', 'tilda'); };
export const tildaPier: Conv = { id: 'tilda.pier', start: 'a', nodes: {
  a: { say: [L('tilda', '(узнаёт) Вы… из переулка. Вы её видели?')], choices: [
    { ru: '(Протянуть ленту)', if: c => c.has('ribbon'), next: 'r' }, { ru: 'Видел. Она в приюте.', if: c => c.knows('know_anka_orphanage'), next: 'p' }, { ru: 'Не ходи к барже.', next: 'q' }] },
  r: { say: [L('tilda', '(берёт ленту, прижимает к лицу) Это её. Это её лента. Где?')], fx: c => c.take('ribbon'), next: 'm' },
  p: { say: [L('tilda', 'Врёшь. Мне сказали — переведена.')], next: 'm' },
  q: { say: [L('tilda', 'А куда мне ещё?')], next: 'm' },
  m: { say: [W(c => c.knows('know_anka_orphanage'), 'tik', 'В приюте. До двадцати двух сорока. Потом её посадят в повозку. Сюда.'), W(c => !c.knows('know_anka_orphanage'), 'tik', 'Я поищу её.'), L('tilda', '(смотрит на баржу, на Тика) …Почему ты мне помогаешь?')], choices: [{ ru: 'Я там вырос.', next: 'w1' }, { ru: 'Не знаю.', next: 'w2' }, { ru: 'Иди. Время.', next: 'w2' }] },
  w1: { say: [L('tilda', '(кивает, будто это всё объясняет) Задняя калитка. У прачечной. Я знаю, я там стирала.')], fx: c => { c.flag('tildaWarned'); c.thread('tilda'); c.note('tilda2', 'Тильда: предупреждена. «Задняя калитка у прачечной».', 'Tilda: warned. "The back gate by the laundry."', 'tilda'); }, end: true },
  w2: { say: [L('tilda', '(уходит быстро)')], fx: c => { c.flag('tildaWarned'); c.note('tilda2', 'Тильда: предупреждена, побежала в приют.', 'Tilda: warned, ran to the orphanage.', 'tilda'); }, end: true },
} };
export const fern: Conv = { id: 'fern', start: 'a', nodes: {
  a: { say: [L('fern', '(держит фонарь, смотрит на башню) Ты слышишь?')], choices: [{ ru: 'Что?', next: 'b' }, { ru: 'Ничего не слышу.', next: 'b' }] },
  b: { say: [L('fern', 'Вот и я ничего. Половина одиннадцатого — а колокол молчит. Сорок лет не молчал.')], next: 'q' },
  q: { choices: [{ ru: 'Механизм сломался?', hide: true, next: 'q1' }, { ru: 'Свет тоже мигает.', hide: true, next: 'q2' }, { ru: 'Кто был в башне сегодня?', hide: true, next: 'q3' }, { ru: '(Уйти)', next: 'z' }] },
  q1: { say: [L('fern', 'Механизм от сети. Сеть пустая. Как будто кто-то пьёт ток.')], next: 'q' },
  q2: { say: [L('fern', 'С пяти минут одиннадцатого. Я на крыше был, видел — по всему городу волной.')], next: 'q' },
  q3: { say: [L('fern', 'Девушка инженерша. Хозяйка её. Ты. (щурится) И этот, с чемоданом. В подвал шёл, без десяти десять. Сказал — от подстанции. Я ему открыл.')], fx: c => { c.learn('know_tap_man'); c.note('fern1', 'Ферн: человек с чемоданом шёл в подвал башни без десяти десять. «От подстанции». Колокол молчит, свет мигает.', 'Fern: a man with a suitcase went to the tower cellar at ten to ten. "From the substation." The bell is silent, lights flicker.', 'fern'); }, next: 'q' },
  z: { end: true },
} };
export const lidia: Conv = { id: 'lidia.steps', start: 'a', nodes: {
  a: { say: [A('Сидит на мокрых ступенях, без зонта.'), L('lidia', '(не поднимает голову) Работает?')], choices: [{ ru: 'Работает.', next: 'b' }, { ru: 'Что ты сделала?', next: 'c' }, { ru: 'Иди домой, простудишься.', next: 'b2' }] },
  b: { say: [L('lidia', 'Хорошо. Хоть что-то.')], next: 'c' },
  b2: { say: [L('lidia', 'Мне некуда. (пауза) То есть есть куда. Только там никого.')], next: 'c' },
  c: { choices: [{ ru: 'Подвал башни. Человек с чемоданом.', if: c => c.knows('know_tap_man'), next: 'c9' }, { ru: 'Что ты сделала?', next: 'c0' }, { ru: '(Оставить её)', next: 'c00' }] },
  c0: { say: [L('lidia', '(качает головой) Ничего. Оставьте меня.')], fx: c => c.learn('lidia_weeps'), end: true },
  c00: { end: true },
  c9: { say: [L('tik', 'Подвал. Человек с чемоданом.'), L('lidia', '(поднимает голову) Ты и это знаешь… Конечно знаешь.'), L('lidia', 'Мне принесли записку. С печатью совета. «Впустить техника в 21:55. После — брат дома». Миша в приюте, ему девять. Я его туда отдала, когда мама умерла. Я думала — на год.')],
    choices: [{ ru: 'Чью печать?', next: 'c1' }, { ru: 'Ты знаешь, что он сделал?', next: 'c2' }, { ru: 'Твой брат в повозке. В двадцать два сорок.', next: 'c3' }] },
  c1: { say: [L('lidia', 'Совета. Её. Подписи нет. Машинка. Я не знаю, кто приносил. Человек в сером пальто.')], next: 'd' },
  c2: { say: [L('lidia', 'Теперь знаю. Отвод. Он тянет город. Поэтому свет. Поэтому пожар. (смотрит на зарево) Это я.')], next: 'd' },
  c3: { say: [L('lidia', '(встаёт) Нет. Нет, мне сказали — дома…')], next: 'd' },
  d: { say: [L('lidia', 'Предохранитель. Красный. В коробке слева. Если выдернуть, пока он не ушёл… Нет. Уже поздно. Для этого мира — поздно.')],
    fx: c => { c.learn('know_fuse'); c.learn('know_lidia_note'); c.thread('prologue'); c.note('lidia2', 'Лидия: записка с печатью совета «Впустить техника в 21:55. После — брат дома». Отвод в подвале башни тянет город. Красный предохранитель, коробка слева. Брат Миша (9) в приюте.', 'Lidia: a note with the council seal, "Let the technician in at 21:55. After — brother home." The tap in the tower cellar drains the city. Red fuse, the box on the left. Her brother Misha (9) is at the orphanage.', 'lidia'); c.message('Подвал башни. Прыжок на 22:00.', 'Tower cellar. Jump to 22:00.'); }, end: true },
} };
export const stern: Conv = { id: 'stern', start: 'a', nodes: {
  a: { say: [L('stern', '(не оборачиваясь, крутит клемму) Свет не загораживай.')], choices: [{ ru: 'Кто ты?', next: 'b' }, { ru: '(Выдернуть предохранитель сразу)', if: c => c.knows('know_fuse'), next: 'c' }, { ru: '(Поднять револьвер)', if: c => c.gun(), next: 'd' }] },
  b: { say: [L('stern', 'Подстанция. Плановые работы.')], fx: c => { c.learn('know_tap_man'); c.note('stern1', 'Штерн, техник: «Подстанция. Плановые работы». В подвале башни ставит отвод.', 'Stern, technician: "Substation. Planned works." Fitting the tap in the tower cellar.', 'stern'); }, end: true },
  c: { say: [L('stern', '(хватает за руку) Ты что делаешь?!'), A('(Борьба две секунды.)')], fx: c => { c.advance(2); c.openDoor('x'); }, choices: [{ ru: '(Рвануть)', next: 'c2' }] },
  c2: { fx: c => { c.flag('tapCut'); c.flag('sternScared'); c.note('fuse', 'Выдернул красный предохранитель отвода в подвале башни.', 'Pulled the red fuse of the tap in the tower cellar.'); c.message('Свет ровный. Город изменился.', 'The lights are steady. The city has changed.'); }, end: true },
  d: { say: [L('stern', '(медленно поднимает руки) Ладно. Ладно. Мне заплатили, я сделал. Кто — не знаю. Конверт. Печать. (пятится к двери)'), A('Штерн убегает, бросив чемодан. В чемодане: инструменты, схема отвода, конверт с печатью совета (пустой).')], fx: c => { c.flag('sternScared'); c.learn('know_tap_man'); c.note('stern2', 'Штерн: «Мне заплатили. Конверт. Печать совета». Убежал, бросив чемодан.', 'Stern: "I was paid. An envelope. The council seal." He ran, leaving the suitcase.', 'stern'); }, end: true },
} };
