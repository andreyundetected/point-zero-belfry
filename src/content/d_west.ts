import { Conv, L, A } from '../game/dialogue';
import { at } from '../sim/time';

// 02_DIALOGUES §2 Orven, §3 Tilda, §4 Ned, §13 Fern / Lidia / Stern
export const orven: Conv = { id: 'orven', start: 'a', nodes: {
  a: { say: [L('orven', 'Закрыто. Завтра.')], choices: [
    { ru: 'Я от Крайн.', next: 'b1' }, { ru: 'Я подожду, пока откроешь.', next: 'b2' },
    { ru: 'Через три минуты тебя тут уже не будет. Поэтому сейчас.', know: 'saw_orven_locked', kt: '22:13', next: 'b3' }] },
  b1: { say: [L('orven', '(замирает, не оборачиваясь) …Так и знал, что этим вечером кончится. Чего ей?')], next: 'c' },
  b2: { say: [L('orven', 'Жди. До утра.')], choices: [{ ru: 'Я от Крайн.', next: 'b1' }, { ru: 'Через три минуты тебя тут уже не будет. Поэтому сейчас.', know: 'saw_orven_locked', kt: '22:13', next: 'b3' }] },
  b3: { say: [L('orven', '(оборачивается, смотрит долго) Ты кто такой?.. Ладно. Говори быстро, я замёрз.')], next: 'c' },
  c: { say: [L('tik', 'Мне нужен Харроу.'), L('orven', '(смеётся без звука) Всем нужен. Харроу я не видел три года. Ключи его людей видел.')], choices: [{ ru: 'Чьи ключи?', next: 'd' }, { ru: 'Кто сегодня приходил за ключами?', next: 'd' }] },
  d: { say: [L('orven', 'Есть парень. Нед, курьер из конторы Гейла. Сегодня забрал у меня ключ — я точил на заказ. Должен был отнести хозяину ещё в восемь. А я видел, как он в девять шёл в «Якорь». С ключом.')],
    choices: [{ ru: 'Как он выглядит?', next: 'e1' }, { ru: 'Где «Якорь»?', next: 'e2' }] },
  e1: { say: [L('orven', 'Рыжий. Фуражка курьерская, с медной бляхой. Не перепутаешь.')], next: 'e2b' },
  e2: { say: [L('orven', 'За мостом. Другого моста нет, северный разобрали.')], next: 'e1b' },
  e1b: { say: [L('orven', 'Рыжий, фуражка с медной бляхой. Не перепутаешь.')], next: 'f' },
  e2b: { say: [L('orven', '«Якорь» — за мостом. Другого моста нет, северный разобрали.')], next: 'f' },
  f: { say: [L('orven', 'Передай ей: с меня хватит. Это последнее.')], choices: [{ ru: 'Передам.', next: 'g' }, { ru: 'Сам передашь.', next: 'g' }] },
  g: { fx: c => { c.thread('ned'); c.learn('know_ned'); c.learn('know_anchor'); c.note('orven1', 'Орвен: «Нед, курьер из конторы Гейла, забрал ключ, который я точил. Рыжий, фуражка с медной бляхой. Шёл в «Якорь» с ключом».', 'Orven: "Ned, a courier from Gayl\'s office, took a key I cut. Red hair, brass badge. He went to the Anchor with it."', 'orven'); c.learn('orven_met'); }, end: true },
} };
export const orvenKey: Conv = { id: 'orven.key', start: 'a', nodes: {
  a: { say: [L('orven', 'Опять ты? Мы же… (замечает ключ в руке Тика) Откуда у тебя это?')], choices: [
    { ru: 'Чей ключ?', next: 'b1' }, { ru: 'Нед проиграл его в кости. Твой ключ сейчас у людей Корда.', know: 'saw_key_lost', kt: '22:12', next: 'b2' }] },
  b1: { say: [L('orven', '(берёт, вертит, отдаёт) Моя бородка. Четыре зуба, косой срез. Сейф Гейла. Курьерская контора при складе.')], next: 'z' },
  b2: { say: [L('orven', '(бледнеет) Корд… Это сейф Гейла. Курьерская контора. Господи, что там лежит такого…'), L('tik', 'Что лежит?'), L('orven', 'Я ключи точу. Я внутрь не смотрю. Иди уже.')], next: 'z' },
  z: { fx: c => { c.thread(c.t() > at(22, 10) ? 'safe_early' : 'safe'); c.learn('know_safe'); c.note('orven2', 'Орвен о ключе: «Моя бородка. Сейф Гейла. Курьерская контора при складе».', 'Orven on the key: "My cut. Gayl\'s safe, at the courier office by the warehouse."', 'orven'); }, end: true },
} };
export const tildaAlley: Conv = { id: 'tilda.alley', start: 'a', nodes: {
  a: { say: [A('Женщина в мокром платке перегораживает узкий проход, хватает за рукав.'), L('tilda', 'Простите… Простите. Вы девочку не видели? Восемь лет. Коса, вот такая лента. (показывает красную ленту, такую же) Анка.')],
    choices: [{ ru: 'Нет. Извини.', next: 'n1' }, { ru: 'Где ты её потеряла?', next: 'n2' }, { ru: '(Пройти мимо)', next: 'n3' }] },
  n3: { say: [L('tilda', '(вслед) Если увидите — я прачка, Тильда, с Канатной! Скажите ей, мама ищет!')], fx: c => note1(c), end: true },
  n1: { say: [L('tilda', '(отпускает рукав) Да. Да, конечно. Извините.')], fx: c => note1(c), end: true },
  n2: { say: [L('tilda', 'Я её не теряла. Я её отдала. В приют, на Лукию, на зиму. Работы не было, топить нечем. Сегодня пришла забрать — а мне говорят: переведена. Куда? В школу. В какую? Не ваше дело, мамаша.')],
    choices: [{ ru: 'Может, правда в школу.', next: 'n21' }, { ru: 'Кто сказал «переведена»?', next: 'n22' }] },
  n21: { say: [L('tilda', 'В школу ночью не возят. А на пристани говорят: детей грузят на баржу. К Лукьяну, на «Веру». Он ещё летом двоих возил, из Слободки.')], next: 'n23' },
  n22: { say: [L('tilda', 'Привратник. Он дверь закрыл. Мне сказали — баржа Лукьяна. Пирс семь.')], next: 'n23' },
  n23: { say: [L('tik', 'И что ты будешь делать?'), L('tilda', '(поправляет шаль, под ней что-то тяжёлое) Пойду спрошу Лукьяна.')], choices: [{ ru: 'Не ходи одна.', next: 'n24' }, { ru: 'Удачи.', next: 'n25' }] },
  n24: { say: [L('tilda', 'А с кем мне? (уходит)')], fx: c => { c.learn('know_lukyan'); note1(c, true); }, end: true },
  n25: { say: [L('tilda', '(кивает, уходит)')], fx: c => { c.learn('know_lukyan'); note1(c, true); }, end: true },
} };
const note1 = (c: any, full = false) => { c.learn('know_tilda'); c.note('tilda1', full ? 'Тильда, прачка с Канатной: дочь Анка (8) в приюте, «переведена». На пристани говорят — детей грузят на баржу Лукьяна «Вера», пирс 7. Под шалью у неё что-то тяжёлое.' : 'Тильда ищет дочь Анку, 8 лет, красная лента в косе.', full ? 'Tilda, a washerwoman: daughter Anka (8) is at the orphanage, "transferred". On the docks they say children go onto Lukyan\'s barge Vera, pier 7. Something heavy under her shawl.' : 'Tilda is looking for her daughter Anka, 8, a red ribbon in her braid.', 'tilda'); };
export const tildaPier: Conv = { id: 'tilda.pier', start: 'a', nodes: {
  a: { say: [L('tilda', '(узнаёт) Вы… из переулка. Вы её видели?')], choices: [
    { ru: '(Протянуть ленту)', if: c => c.has('ribbon'), next: 'r' }, { ru: 'Видел. Она в приюте.', next: 'p' }, { ru: 'Не ходи к барже.', next: 'q' }] },
  r: { say: [L('tilda', '(берёт ленту, прижимает к лицу) Это её. Это её лента. Где?')], fx: c => c.take('ribbon'), next: 'm' },
  p: { say: [L('tilda', 'Врёшь. Мне сказали — переведена.')], next: 'm' },
  q: { say: [L('tilda', 'А куда мне ещё?')], next: 'm' },
  m: { say: [L('tik', 'В приюте. До двадцати двух сорока. Потом её посадят в повозку. Сюда.'), L('tilda', '(смотрит на баржу, на Тика) …Почему ты мне помогаешь?')], choices: [{ ru: 'Я там вырос.', next: 'w1' }, { ru: 'Не знаю.', next: 'w2' }, { ru: 'Иди. Время.', next: 'w2' }] },
  w1: { say: [L('tilda', '(кивает, будто это всё объясняет) Задняя калитка. У прачечной. Я знаю, я там стирала.')], fx: c => { c.flag('tildaWarned'); c.thread('tilda'); c.note('tilda2', 'Тильда: предупреждена. «Задняя калитка у прачечной».', 'Tilda: warned. "The back gate by the laundry."', 'tilda'); }, end: true },
  w2: { say: [L('tilda', '(уходит быстро)')], fx: c => { c.flag('tildaWarned'); c.note('tilda2', 'Тильда: предупреждена, побежала в приют.', 'Tilda: warned, ran to the orphanage.', 'tilda'); }, end: true },
} };
export const ned: Conv = { id: 'ned', start: 'a', nodes: {
  a: { say: [A('Рыжий парень в фуражке с медной бляхой стоит у перил и смотрит на воду.'), L('ned', '(не оборачиваясь) Иди, куда шёл.')], choices: [{ ru: 'Ты Нед?', next: 'a1' }, { ru: 'Высоко тут.', next: 'a2' }, { ru: '(Встать рядом и молчать)', next: 'a3' }] },
  a1: { say: [L('ned', '(резко оборачивается) Кто спрашивает? От Гейла? Скажи ему… ничего не говори.')], next: 'b' },
  a2: { say: [L('ned', 'Нормально. Метра четыре. И холодная.')], next: 'b' },
  a3: { fx: c => c.advance(10), say: [A('(Проходит десять секунд.)'), L('ned', 'Чего встал?')], next: 'b' },
  b: { say: [L('tik', 'Мне сказали, у тебя ключ.'), L('ned', '(смеётся плохо) Был ключ. Всё было. Выручка конторы за неделю, часы отцовские, жетон. Ключ хозяйский. Всё на столе в «Якоре».')], next: 'bq' },
  bq: { choices: [{ ru: 'Проиграл?', hide: true, next: 'b1' }, { ru: 'Кому?', hide: true, next: 'b2' }, { ru: 'Зачем садился?', hide: true, next: 'b3' }, { ru: '(Дальше)', next: 'c' }] },
  b1: { say: [L('ned', 'Нет, подарил. Конечно проиграл. В кости.')], next: 'bq' },
  b2: { say: [L('ned', 'Людям Корда. Восемь человек. Сидят с вечера, как будто ждут чего-то. Сами позвали: «Курьер, сыграй, у тебя рожа счастливая».')], fx: c => c.learn('know_cord_men'), next: 'bq' },
  b3: { say: [L('ned', 'Думал, отыграю за выручку. Один кон. Потом ещё один. Ты не играл никогда, что ли?')], next: 'bq' },
  c: { say: [L('ned', 'Утром Гейл откроет кассу. Потом откроет рот. А у меня мать.')], fx: c => { if (c.t() >= at(22, 12)) { c.learn('saw_blast'); } }, next: 'boom' },
  boom: { say: [A('Над востоком вспышка, дрожь. Нед вцепляется в перила.'), L('ned', 'Господи… Это склад. Это же наш склад…')], choices: [], next: 'hold' },
  hold: { choices: [
    { ru: 'Выручку можно вернуть.', if: c => c.t() < at(22, 16), next: 'h1' },
    { ru: '(Протянуть часы) Твои?', if: c => c.has('watch') && c.t() < at(22, 16), next: 'h2' },
    { ru: 'Жетон у меня. Без него тебя никто не уволит за жетон.', know: 'saw_token_table', kt: '22:04', if: c => c.has('jeton') && c.t() < at(22, 16), next: 'h3' },
    { ru: 'Склад сгорел. Утром никто не будет считать твою выручку. Там нечего будет считать.', know: 'saw_blast', kt: '22:12', if: c => c.t() < at(22, 16), next: 'h4' },
    { ru: 'Прыгнешь — мать завтра будет одна. С долгом.', if: c => c.t() < at(22, 16), next: 'h5' },
    { ru: 'Не моё дело. Где ключ?', next: 'h6' }] },
  h1: { say: [L('ned', 'Как? Ты пойдёшь к восьмерым и попросишь?')], next: 'h1b' },
  h1b: { say: [L('ned', 'Иди. Попроси. Я посмотрю.')], choices: [{ ru: '(Показать револьвер)', if: c => c.gun(), next: 'h1c' }, { ru: '(Сказать что-то ещё)', next: 'hold' }] },
  h1c: { say: [L('ned', '…Ты пойдёшь. По глазам вижу.')], fx: c => c.flag('nedSaved'), next: 'fin' },
  h2: { say: [L('ned', '(берёт часы, руки трясутся) Откуда?.. Ладно. Не говори.')], fx: c => { c.take('watch'); c.flag('nedSaved'); }, next: 'fin' },
  h3: { say: [L('ned', '(смотрит на жетон) …Номер семнадцать. Мой. (молчит) Ладно. Ладно.')], fx: c => { c.take('jeton'); c.flag('nedSaved'); }, next: 'fin' },
  h4: { say: [L('ned', '(долго смотрит на огонь) …Там никто ничего не будет считать. (садится на мокрые камни)')], fx: c => c.flag('nedSaved'), next: 'fin' },
  h5: { say: [L('ned', 'Не трогай мать. (отворачивается)')], fx: c => c.flag('nedSaved'), next: 'fin' },
  h6: { say: [L('ned', 'У Игната. Старший у них. Жилет, без шляпы.')], fx: c => c.learn('know_ignat'), next: 'fin' },
  fin: { say: [L('ned', 'Без ствола туда не ходи. У Фомы, на Рыночной, под прилавком — все знают. Он закладные стволы не сдаёт.')],
    fx: c => { c.thread('tavern'); c.learn('know_foma_guns'); c.note('ned1', 'Нед: проиграл выручку, часы, жетон №17 и ключ людям Корда в «Якоре». Игнат — старший. Фома — стволы.', 'Ned: lost the takings, watch, token #17 and the key to Cord\'s men at the Anchor. Ignat is the senior one. Foma has guns.', 'ned'); }, end: true },
} };
export const nedAfter: Conv = { id: 'ned.after', start: 'a', nodes: { a: { say: [L('ned', 'Я не прыгнул. Если тебе что надо — я курьер, я все дворы знаю.')], choices: [{ ru: 'Покажи короткую дорогу к пирсу семь.', next: 'b' }, { ru: 'Держись.', next: 'z' }] }, b: { say: [L('ned', 'Через двор бондаря. Минуту выиграем.')], fx: c => { c.learn('ned_shortcut'); c.advance(60); }, end: true }, z: { end: true } } };
export const fern: Conv = { id: 'fern', start: 'a', nodes: {
  a: { say: [L('fern', '(держит фонарь, смотрит на башню) Ты слышишь?')], choices: [{ ru: 'Что?', next: 'b' }, { ru: 'Ничего не слышу.', next: 'b' }] },
  b: { say: [L('fern', 'Вот и я ничего. Половина одиннадцатого — а колокол молчит. Сорок лет не молчал.')], next: 'q' },
  q: { choices: [{ ru: 'Механизм сломался?', hide: true, next: 'q1' }, { ru: 'Свет тоже мигает.', hide: true, next: 'q2' }, { ru: 'Кто был в башне сегодня?', hide: true, next: 'q3' }, { ru: '(Уйти)', next: 'z' }] },
  q1: { say: [L('fern', 'Механизм от сети. Сеть пустая. Как будто кто-то пьёт ток.')], next: 'q' },
  q2: { say: [L('fern', 'С пяти минут одиннадцатого. Я на крыше был, видел — по всему городу волной.')], next: 'q' },
  q3: { say: [L('fern', 'Девушка инженерша. Хозяйка её. Ты. (щурится) И этот, с чемоданом. В подвал шёл, без десяти десять. Сказал — от подстанции. Я ему открыл.')], fx: c => { c.learn('know_tap_man'); c.thread('key'); c.note('fern1', 'Ферн: человек с чемоданом шёл в подвал башни без десяти десять. «От подстанции». Колокол молчит, свет мигает.', 'Fern: a man with a suitcase went to the tower cellar at ten to ten. "From the substation." The bell is silent, lights flicker.', 'fern'); c.thread('prologue'); }, next: 'q' },
  z: { end: true },
} };
export const lidia: Conv = { id: 'lidia.steps', start: 'a', nodes: {
  a: { say: [A('Сидит на мокрых ступенях, без зонта.'), L('lidia', '(не поднимает голову) Работает?')], choices: [{ ru: 'Работает.', next: 'b' }, { ru: 'Что ты сделала?', next: 'c' }, { ru: 'Иди домой, простудишься.', next: 'b2' }] },
  b: { say: [L('lidia', 'Хорошо. Хоть что-то.')], next: 'c' },
  b2: { say: [L('lidia', 'Мне некуда. (пауза) То есть есть куда. Только там никого.')], next: 'c' },
  c: { say: [L('tik', 'Подвал. Человек с чемоданом.'), L('lidia', '(поднимает голову) Ты и это знаешь… Конечно знаешь.'), L('lidia', 'Мне принесли записку. С печатью совета. «Впустить техника в 21:55. После — брат дома». Миша в приюте, ему девять. Я его туда отдала, когда мама умерла. Я думала — на год.')],
    choices: [{ ru: 'Чью печать?', next: 'c1' }, { ru: 'Ты знаешь, что он сделал?', next: 'c2' }, { ru: 'Твой брат в повозке. В двадцать два сорок.', next: 'c3' }] },
  c1: { say: [L('lidia', 'Совета. Её. Подписи нет. Машинка. Я не знаю, кто приносил. Человек в сером пальто.')], next: 'd' },
  c2: { say: [L('lidia', 'Теперь знаю. Отвод. Он тянет город. Поэтому свет. Поэтому пожар. (смотрит на зарево) Это я.')], next: 'd' },
  c3: { say: [L('lidia', '(встаёт) Нет. Нет, мне сказали — дома…')], next: 'd' },
  d: { say: [L('lidia', 'Предохранитель. Красный. В коробке слева. Если выдернуть, пока он не ушёл… Нет. Уже поздно. Для этого мира — поздно.')],
    fx: c => { c.learn('know_fuse'); c.learn('know_lidia_note'); c.thread('prologue'); c.note('lidia2', 'Лидия: записка с печатью совета «Впустить техника в 21:55. После — брат дома». Отвод в подвале башни тянет город. Красный предохранитель, коробка слева. Брат Миша (9) в приюте.', 'Lidia: a note with the council seal, "Let the technician in at 21:55. After — brother home." The tap in the tower cellar drains the city. Red fuse, the box on the left. Her brother Misha (9) is at the orphanage.', 'lidia'); c.message('Подвал башни. Прыжок на 22:00.', 'Tower cellar. Jump to 22:00.'); }, end: true },
} };
export const stern: Conv = { id: 'stern', start: 'a', nodes: {
  a: { say: [L('stern', '(не оборачиваясь, крутит клемму) Свет не загораживай.')], choices: [{ ru: 'Кто ты?', next: 'b' }, { ru: '(Выдернуть предохранитель сразу)', next: 'c' }, { ru: '(Поднять револьвер)', if: c => c.gun(), next: 'd' }] },
  b: { say: [L('stern', 'Подстанция. Плановые работы.')], fx: c => { c.learn('know_tap_man'); c.note('stern1', 'Штерн, техник: «Подстанция. Плановые работы». В подвале башни ставит отвод.', 'Stern, technician: "Substation. Planned works." Fitting the tap in the tower cellar.', 'stern'); }, end: true },
  c: { say: [L('stern', '(хватает за руку) Ты что делаешь?!'), A('(Борьба две секунды.)')], fx: c => { c.advance(2); c.openDoor('x'); }, choices: [{ ru: '(Рвануть)', next: 'c2' }] },
  c2: { fx: c => { c.flag('tapCut'); c.flag('sternScared'); c.note('fuse', 'Выдернул красный предохранитель отвода в подвале башни.', 'Pulled the red fuse of the tap in the tower cellar.'); c.message('Свет ровный. Город изменился.', 'The lights are steady. The city has changed.'); }, end: true },
  d: { say: [L('stern', '(медленно поднимает руки) Ладно. Ладно. Мне заплатили, я сделал. Кто — не знаю. Конверт. Печать. (пятится к двери)'), A('Штерн убегает, бросив чемодан. В чемодане: инструменты, схема отвода, конверт с печатью совета (пустой).')], fx: c => { c.flag('sternScared'); c.learn('know_tap_man'); c.note('stern2', 'Штерн: «Мне заплатили. Конверт. Печать совета». Убежал, бросив чемодан.', 'Stern: "I was paid. An envelope. The council seal." He ran, leaving the suitcase.', 'stern'); }, end: true },
} };
