import { Conv, L, A, W, Ctx } from '../game/dialogue';
import { at, fmt } from '../sim/time';

// Conversations that depend on time, place, the NPC's state and memory (A1-A4). Each NPC state is its own tree; pickConv() chooses it.
// Pressure lines (⟲) show the time the knowledge comes from: kt is computed from when the player learned it.
const ago = (c: Ctx, k: string) => { const t = c.s.knownAt.get(k); return t === undefined ? '' : fmt(t); };
void ago;

// ======================= ORVEN (D2): at his door 22:01-22:02, or later while closing the shutters
export const orven: Conv = { id: 'orven', start: c => (c.count() > 0 ? 'again' : 'a'), nodes: {
  a: { say: [A('Сутулый старик в фартуке возится с замком, спиной к улице.'), L('orven', '(не оборачиваясь) Закрыто. Завтра приходи. Или послезавтра. Лучше вообще не приходи.')], choices: [
    { ru: 'Я от Крайн.', next: 'b1' }, { ru: 'Две минуты. Я заплачу.', once: 'pay', next: 'b2' },
    { ru: 'В две минуты одиннадцатого ты запрёшь и уйдёшь. Записку повесишь: «Буду через три часа».', know: 'know_orven_left', kt: '22:07', next: 'b3' },
    { ru: '(Уйти)', next: 'z' }] },
  b2: { say: [L('orven', 'Деньги у неё бери. Мне с её денег одни долги.')], next: 'a2' },
  a2: { choices: [{ ru: 'Я от Крайн.', next: 'b1' }, { ru: 'В две минуты одиннадцатого ты запрёшь и уйдёшь. Записку повесишь: «Буду через три часа».', know: 'know_orven_left', kt: '22:07', next: 'b3' }, { ru: '(Уйти)', next: 'z' }] },
  b1: { say: [L('orven', '(замирает с ключом в замке) …Так и знал, что этим вечером кончится. Ну. Чего ей?')], next: 'c' },
  b3: { say: [L('orven', '(оборачивается, смотрит долго) Ты кто такой?.. Я эту записку ещё не писал.'), L('tik', 'Напишешь.'), L('orven', '…Ладно. Говори, пока я ставни закрываю. Только быстро — продрог.')], next: 'c' },
  c: { say: [L('tik', 'Мне нужен Харроу.'), L('orven', '(смеётся без звука) Всем нужен. Харроу я три года в глаза не видел. А ключи его людей — видел.')], choices: [{ ru: 'Чьи ключи?', next: 'd' }, { ru: 'Кто сегодня приходил за ключами?', next: 'd' }] },
  d: { say: [L('orven', 'Курьер. Нед, из конторы Гейла. Днём забрал у меня ключ — я точил на заказ. В восемь должен был отнести хозяину. А в девять, гляжу, шлёпает в «Якорь». С ключом в кармане. Дурак молодой.')],
    fx: c => { c.learn('name_ned'); c.learn('know_ned'); c.learn('know_ned_key'); c.learn('name_gayl'); c.learn('know_anchor'); }, next: 'dq' },
  dq: { choices: [{ ru: 'Как он выглядит?', once: 'desc', next: 'e1' }, { ru: 'Где этот «Якорь»?', once: 'anchor', next: 'e2' }, { ru: 'Что за ключ?', once: 'key', next: 'e3' }, { ru: '(Хватит)', sys: true, next: 'f' }] },
  e1: { say: [L('orven', 'Рыжий. Фуражка курьерская, бляха медная, начищенная — он один её и чистит. Не спутаешь.')], fx: c => c.learn('know_ned_desc'), next: 'dq' },
  e2: { say: [L('orven', 'За мостом, на Набережной. Мост один — северный разобрали. Хоть вплавь.')], next: 'dq' },
  e3: { say: [L('orven', 'Сейфовый. Четыре зуба, косой срез. Чей сейф — не моё дело. Моё дело — зубы.')], fx: c => c.learn('know_key_safe'), next: 'dq' },
  f: { say: [L('orven', '(щёлкает ставнем) Передай ей: с меня хватит. Это последнее, что я для неё делаю.')], choices: [{ ru: 'Передам.', next: 'g' }, { ru: 'Сам передашь.', next: 'g' }] },
  g: { fx: c => { c.learn('know_ned_desc'); c.thread('ned'); c.note('orven1', 'Орвен: «Нед, курьер из конторы Гейла, забрал ключ, который я точил. Рыжий, фуражка с медной бляхой. Пошёл в «Якорь» с ключом».', 'Orven: "Ned, a courier from Gayl\'s office, took a key I cut. Red hair, brass badge. He went to the Anchor with it."', 'orven'); }, end: true },
  again: { say: [L('orven', '(не отрываясь от ставен) Ты опять? Всё сказал. Рыжий, фуражка с бляхой, «Якорь». Иди уже, а.')], end: true },
  z: { end: true },
} };
export const orvenKey: Conv = { id: 'orven.key', start: c => (c.ever() > 0 ? 'a' : 'a0'), nodes: {
  a0: { say: [L('orven', 'Закрыто… (замечает ключ у тебя в руке) Стой. Откуда это у тебя?')], next: 'q' },
  a: { say: [L('orven', 'Опять ты? Мы же… (замечает ключ у тебя в руке) Откуда это у тебя?')], next: 'q' },
  q: { choices: [{ ru: 'Чей ключ?', next: 'b1' }, { ru: 'Нед проиграл его в кости. Твой ключ сейчас у людей Корда.', know: 'know_ned_lost', kt: '22:03', next: 'b2' }] },
  b1: { say: [L('orven', '(берёт, вертит у глаз, отдаёт) Моя бородка. Четыре зуба, косой срез. Сейф Гейла. Курьерская контора при складе.')], next: 'z' },
  b2: { say: [L('orven', '(бледнеет) Корд… Это сейф Гейла. Курьерская контора. Господи, что там у него лежит такого…'), L('tik', 'Что лежит?'), L('orven', 'Я ключи точу. Внутрь не заглядываю. Иди уже, а.')], next: 'z' },
  z: { fx: c => { c.thread(c.t() > at(22, 10) ? 'safe_early' : 'safe'); c.learn('know_safe'); c.note('orven2', 'Орвен о ключе: «Моя бородка. Сейф Гейла. Курьерская контора при складе».', 'Orven on the key: "My cut. Gayl\'s safe, at the courier office by the warehouse."', 'orven'); }, end: true },
} };

// ======================= TILDA (D3): she comes up to you herself at the alley exit, once a branch
const tildaNote = (c: Ctx, full = false) => { c.learn('know_tilda'); c.learn('name_tilda'); c.learn('name_anka'); c.note('tilda1', full ? 'Тильда, прачка с Канатной: дочь Анка (8) в приюте, «переведена». На пристани говорят — детей грузят на баржу Лукьяна «Вера», пирс 7. Под шалью у неё что-то тяжёлое.' : 'Тильда ищет дочь Анку, 8 лет, красная лента в косе.', full ? 'Tilda, a washerwoman: daughter Anka (8) is at the orphanage, "transferred". On the docks they say children go onto Lukyan\'s barge Vera, pier 7. Something heavy under her shawl.' : 'Tilda is looking for her daughter Anka, 8, a red ribbon in her braid.', 'tilda'); };
export const tildaAlley: Conv = { id: 'tilda.alley', start: c => (c.count() > 0 ? 'again' : 'a'), nodes: {
  a: { say: [A('Женщина в мокром платке выходит наперерез и хватает тебя за рукав.'), L('tilda', 'Простите… Простите, ради бога. Вы девочку не видели? Восемь лет. Коса, вот такая лента. (показывает красную ленту) Анка.')],
    choices: [{ ru: 'Нет. Извини.', next: 'n1' }, { ru: 'Где ты её потеряла?', next: 'n2' }, { ru: '(Высвободить рукав и пройти)', next: 'n3' }] },
  n3: { say: [L('tilda', '(вслед) Если увидите — я Тильда, прачка, с Канатной! Скажите ей — мама ищет!')], fx: c => tildaNote(c), end: true },
  n1: { say: [L('tilda', '(отпускает рукав) Да. Да, конечно. Извините.')], fx: c => tildaNote(c), end: true },
  n2: { say: [L('tilda', 'Я её не теряла. Я её отдала. В приют, на Лукию, на зиму. Работы не было, топить нечем. Сегодня пришла забрать — а мне: «переведена». Куда? «В школу». В какую? «Не ваше дело, мамаша».')],
    choices: [{ ru: 'Может, правда в школу.', next: 'n21' }, { ru: 'Кто сказал «переведена»?', next: 'n22' }] },
  n21: { say: [L('tilda', 'В школу ночью не возят. А на пристани говорят: детей грузят на баржу. К Лукьяну, на «Веру». Он ещё летом двоих возил, из Слободки.')], next: 'n23' },
  n22: { say: [L('tilda', 'Привратник. Дверь перед носом закрыл, сволочь. А на пристани шепчут — баржа Лукьяна. Пирс семь.')], next: 'n23' },
  n23: { say: [L('tik', 'И что будешь делать?'), L('tilda', '(поправляет шаль, под ней что-то тяжёлое) Пойду спрошу Лукьяна.')], choices: [{ ru: 'Не ходи одна.', next: 'n24' }, { ru: 'Удачи.', next: 'n25' }] },
  n24: { say: [L('tilda', 'А с кем мне? (отворачивается)')], fx: c => { c.learn('know_lukyan'); c.learn('name_lukyan'); tildaNote(c, true); }, end: true },
  n25: { say: [L('tilda', '(кивает, не глядя)')], fx: c => { c.learn('know_lukyan'); c.learn('name_lukyan'); tildaNote(c, true); }, end: true },
  again: { say: [L('tilda', '(с надеждой) Вы… Не видели её?')], choices: [{ ru: 'Она в приюте. Ещё там.', if: c => c.knows('know_anka_orphanage'), next: 'g1' }, { ru: 'Нет.', next: 'g2' }] },
  g1: { say: [L('tilda', 'Я знаю, что в приюте! Мне сказали — переведена… (замолкает) Ещё там? Правда?')], fx: c => c.learn('tilda_hopes'), end: true },
  g2: { say: [L('tilda', '(кивает, отворачивается к переулку)')], end: true },
} };

// ======================= NED, four states (A2): at the table / lost / on the bridge / left early
export const nedTable: Conv = { id: 'ned.table', start: c => (c.count() > 0 ? 'again' : 'a'), nodes: {
  a: { say: [A('Рыжий парень в курьерской фуражке трясёт кости в кулаке, не поднимая глаз.'), L('ned', 'Чё надо? Не видишь — масть пошла.')], choices: [
    { ru: 'Сыграем?', once: 'play', next: 'p' }, { ru: 'Тебя Гейл ищет.', if: c => c.knows('name_gayl') && c.knows('know_ned_key'), once: 'gayl', next: 'g' },
    { ru: 'Через пару минут ты спустишь часы, жетон и ключ. Вставай и уходи.', know: 'know_ned_lost', kt: '22:03', next: 'w' }, { ru: '(Отойти)', next: 'z' }] },
  p: { say: [L('ned', 'Ставь или вали. У меня сегодня рожа счастливая — они сами сказали.'), L('ignat', '(лениво) Курьер, не отвлекайся.')], end: true },
  g: { say: [L('ned', '(дёргается) Пусть ищет. Отыграюсь — сам приду. Отвали.')], end: true },
  w: { say: [L('ned', '(смотрит на тебя, на Игната, снова на тебя) …Ты кто, бля, такой?')], choices: [{ ru: 'Тот, кто видел. Уходи, пока есть с чем.', next: 'w2' }, { ru: '(Пожать плечами)', next: 'w3' }] },
  w2: { say: [L('ned', '(долго молчит) …Хер с ними. (сгребает часы и жетон, встаёт) Ключ — Гейлу. Прямо сейчас.'), L('ignat', 'Куда, курьер? Кон не доигран.'), L('ned', 'Доиграешь сам.')],
    fx: c => { c.flag('nedLeftEarly'); c.note('ned0', 'Увёл Неда из-за стола до проигрыша. Ключ и жетон остались у него — он понёс их Гейлу.', 'Got Ned away from the table before he lost. He kept the key and the token and took them to Gayl.', 'ned'); }, end: true },
  w3: { say: [L('ned', 'Псих. (снова трясёт кости)')], end: true },
  again: { say: [L('ned', 'Отвали, сказал. Не мешай.')], end: true },
  z: { end: true },
} };
export const nedThanks: Conv = { id: 'ned.thanks', start: 'a', nodes: { a: { say: [L('ned', 'Слышь… Спасибо. Я б там всё спустил, до нитки. Ключ — Гейлу, сейчас же.')], end: true } } };
export const ned: Conv = { id: 'ned', start: c => (c.count() > 0 ? 'again' : 'a'),
  interrupts: [{ when: c => c.t() >= at(22, 12) && c.t() < at(22, 14, 30), node: 'boom', once: 'boom' }],
  nodes: {
  a: { say: [W(c => c.knows('know_ned_desc'), '', '(Рыжий, фуражка с медной бляхой. Тот самый курьер.)'), W(c => !c.knows('know_ned_desc'), '', '(Парень у перил. Мокнет и не уходит.)'), L('ned', '(не оборачиваясь) Иди, куда шёл.')],
    choices: [{ ru: 'Ты Нед?', if: c => c.knows('name_ned'), next: 'a1' }, { ru: 'Высоко тут.', next: 'a2' }, { ru: '(Встать рядом и молчать)', next: 'a3' }, { ru: '(Уйти)', next: 'z' }] },
  a1: { say: [L('ned', '(резко оборачивается) Кто спрашивает? От Гейла? Скажи ему… да ничего ему не говори.')], next: 'b0' },
  a2: { say: [L('ned', 'Метров шесть. И вода ледяная. Нормально.')], next: 'b0' },
  a3: { say: [A('(Дождь. Внизу шумит вода.)'), L('ned', 'Чё встал? Цирк тут?')], next: 'b0' },
  again: { say: [L('ned', '(не оборачиваясь) Опять ты. Чё, не насмотрелся?')], next: 'b0' },
  b0: { choices: [{ ru: 'Мне сказали, у тебя ключ.', if: c => c.knows('know_ned_key'), once: 'key', next: 'b' }, { ru: 'Ты в «Якоре» всё спустил. Я видел.', know: 'know_ned_lost', kt: '22:03', once: 'key', next: 'b' },
    { ru: 'Что случилось?', once: 'what', next: 'g1' }, { ru: '(Уйти)', next: 'z' }] },
  g1: { say: [L('ned', 'Ничего. Иди. Не стой над душой.')], fx: c => c.learn('ned_gloomy'), next: 'b0' },
  b: { say: [L('ned', '(смеётся плохо) Был ключ. Всё было. Выручка конторы за неделю, часы отцовские, жетон. Ключ хозяйский. Всё там, на столе в «Якоре».')], fx: c => { c.learn('know_ned_lost'); c.learn('name_ned'); }, next: 'bq' },
  bq: { choices: [{ ru: 'Проиграл?', once: 'lost', next: 'b1' }, { ru: 'Кому?', once: 'whom', next: 'b2' }, { ru: 'Зачем садился?', once: 'why', next: 'b3' }, { ru: '(Дальше)', next: 'c' }] },
  b1: { say: [L('ned', 'Нет, блять, подарил. Конечно проиграл. В кости.')], next: 'bq' },
  b2: { say: [L('ned', 'Людям Корда. Восемь рыл. Сидят с вечера, как будто ждут чего-то. Сами позвали: «Курьер, сыграй, у тебя рожа счастливая».')], fx: c => { c.learn('know_cord_men'); c.learn('name_ignat'); }, next: 'bq' },
  b3: { say: [L('ned', 'Думал, отыграю выручку. Один кон. Потом ещё один. Ты чё, не играл никогда?')], next: 'bq' },
  c: { say: [L('ned', 'Утром Гейл полезет в кассу. И всё. Меня даже не уволят — меня закопают.'), L('ned', 'А мать… (замолкает)')], fx: c => c.learn('ned_mother'), next: 'hold' },
  boom: { say: [A('Над востоком белая вспышка. Через секунду грохот докатывается до моста, перила дрожат под руками.'), L('ned', 'Твою мать… Это склад. Это же наш склад…')], fx: c => c.learn('saw_blast'), next: 'hold' },
  hold: { choices: [
    { ru: 'Выручку можно вернуть.', if: c => c.t() < at(22, 14) && c.knows('know_ned_lost'), once: 'back', next: 'h1' },
    { ru: '(Протянуть часы) Твои?', if: c => c.has('watch'), next: 'h2' },
    { ru: 'Жетон у меня. Никто тебя за жетон не тронет.', if: c => c.has('jeton'), next: 'h3' },
    { ru: 'Склад сгорел. Утром никто не будет считать твою выручку. Там нечего будет считать.', if: c => c.t() >= at(22, 12) && c.knows('know_ned_lost'), next: 'h4' },
    { ru: 'Через пару минут склад взлетит. Утром никто не будет считать твою выручку.', know: 'saw_blast', kt: '22:12', if: c => c.t() < at(22, 12) && c.knows('know_ned_lost'), next: 'h4' },
    { ru: 'Прыгнешь — мать завтра будет одна. С долгом.', if: c => c.knows('ned_mother'), once: 'mother', next: 'h5' },
    { ru: 'Не моё дело. Где ключ?', next: 'h6' }, { ru: '(Уйти)', next: 'z' }] },
  h1: { say: [L('ned', 'Как? Пойдёшь к восьмерым и попросишь вежливо?')], choices: [{ ru: '(Показать револьвер)', if: c => c.gun(), next: 'h1c' }, { ru: '(Промолчать)', next: 'h1b' }] },
  h1b: { say: [L('ned', 'Вот и я о том.')], next: 'hold' },
  h1c: { say: [L('ned', '(смотрит на ствол, на тебя) …Ты пойдёшь. По глазам вижу. Ладно. Подожду. Посмотрю.')], fx: c => c.flag('nedSaved'), next: 'fin' },
  h2: { say: [L('ned', '(берёт часы, руки трясутся) Откуда?.. Ладно. Не говори.')], fx: c => { c.take('watch'); c.flag('nedSaved'); }, next: 'fin' },
  h3: { say: [L('ned', '(смотрит на жетон) …Семнадцатый. Мой. (молчит) Ладно. Ладно, бля.')], fx: c => { c.take('jeton'); c.flag('nedSaved'); }, next: 'fin' },
  h4: { say: [L('ned', '(долго смотрит на восток) …Там никто ничего не будет считать. (сползает спиной по перилам, садится на мокрые камни)')], fx: c => c.flag('nedSaved'), next: 'fin' },
  h5: { say: [L('ned', 'Мать не трогай. (отворачивается)'), A('Он не уходит от перил. Но и не лезет.')], fx: c => c.flag('nedKept'), next: 'fin' },
  h6: { say: [L('ned', 'У Игната. Старший у них. Жилет, без шляпы. Подойди, спроси — может, отдаст. (смеётся)')], fx: c => { c.learn('know_ignat'); c.learn('name_ignat'); }, next: 'fin' },
  fin: { say: [L('ned', 'Только без ствола туда не суйся. У Фомы на Рыночной, под прилавком — все знают. Закладные стволы он не сдаёт, жмот.')],
    fx: c => { c.thread('gun'); c.learn('know_foma_guns'); c.learn('name_foma'); c.note('ned1', 'Нед: проиграл выручку, часы, жетон №17 и ключ людям Корда в «Якоре». Игнат — старший. Ствол — у Фомы на Рыночной.', 'Ned: lost the takings, watch, token #17 and the key to Cord\'s men at the Anchor. Ignat is the senior one. A gun: Foma on Rynochnaya.', 'ned'); }, end: true },
  z: { end: true },
} };
export const nedAfter: Conv = { id: 'ned.after', start: 'a', nodes: { a: { say: [L('ned', 'Я не прыгнул. Если чё надо — я курьер, я все дворы тут знаю.')], choices: [{ ru: 'Покажи короткую дорогу к пирсу семь.', next: 'b' }, { ru: 'Держись.', next: 'z' }] }, b: { say: [L('ned', 'Через двор бондаря. Минуту выиграешь.')], fx: c => c.learn('ned_shortcut'), end: true }, z: { end: true } } };

// ======================= AGATA with memory (A4)
export const agataBefore: Conv = { id: 'agata.before', start: c => (c.count() >= 2 ? 'nod' : c.count() === 1 ? 'again' : 'a'), nodes: {
  a: { say: [L('agata', 'Садись у стойки, не стой столбом. Эти не любят, когда стоят. (кивает на стол)')], choices: [{ ru: 'Кто такие?', once: 'who', next: 'b' }, { ru: 'Налей.', once: 'pour', next: 'c' }, { ru: 'Курьера знаешь? Рыжий.', if: c => c.t() < at(22, 4) && c.knows('know_ned_desc'), once: 'ned', next: 'd' }, { ru: '(Отойти)', next: 'z' }] },
  b: { say: [L('agata', 'Не мои гости. Я их не звала. Сиди тихо.')], fx: c => c.learn('know_cord_men'), end: true },
  c: { say: [A('(наливает молча, ставит стакан)')], end: true },
  d: { say: [L('agata', 'Нед. Дурачок. Вон он, весь вечер им проигрывает. (тише) Заберёшь его отсюда — спасибо скажу.')], fx: c => { c.learn('know_ned_here'); c.learn('name_ned'); c.note('agata0', 'Агата: «Нед. Дурачок. Весь вечер им проигрывает».', 'Agata: "Ned. A fool. Loses to them all evening."', 'agata'); }, end: true },
  again: { say: [L('agata', 'Я ж уже говорила. Налить?')], choices: [{ ru: 'Налей.', once: 'pour', next: 'c' }, { ru: 'Курьера знаешь? Рыжий.', if: c => c.t() < at(22, 4) && c.knows('know_ned_desc'), once: 'ned', next: 'd' }, { ru: '(Отойти)', next: 'z' }] },
  nod: { say: [A('(Агата молча кивает на стойку и отворачивается.)')], end: true },
  z: { end: true },
} };
export const agataAfter: Conv = { id: 'agata.after', start: c => (c.count() >= 2 ? 'nod' : c.count() === 1 ? 'again' : 'a'), nodes: {
  a: { say: [L('agata', '(сметает стекло) Закрыто. Не видишь — разгром.')], choices: [{ ru: 'Где люди, что тут сидели?', next: 'b' }, { ru: 'Налей.', next: 'p' }, { ru: '(Уйти)', next: 'z' }] },
  p: { say: [A('(наливает молча, ставит)'), L('agata', 'Пей и иди.')], next: 'b' },
  b: { say: [L('agata', 'Восемь человек с вечера. Корда люди. Играли, не пили почти. Ждали. Как бахнуло на складе — все туда. Деньги со стола сгребли.')], fx: c => c.learn('know_cord_men'), choices: [{ ru: 'Кто наверху?', once: 'up', next: 'u' }, { ru: 'Харроу тут бывает?', once: 'harrow', next: 'h' }, { ru: '(Уйти)', next: 'z' }] },
  u: { say: [L('agata', 'Никого. Комнату держат за ними. Иди посмотри, раз такой любопытный.')], fx: c => c.learn('know_room_up'), end: true },
  h: { say: [L('agata', '(смотрит) Не знаю такого. Вон пальто его наверху третий месяц висит — а самого не знаю.')], fx: c => { c.learn('know_coat'); c.note('agata1', 'Агата: восемь человек Корда сидели с вечера, ждали. Как бахнуло на складе — все туда. Наверху висит пальто «В.Х.».', 'Agata: eight of Cord\'s men waited here; when the warehouse blew they left. A "V.H." coat hangs upstairs.', 'agata'); }, end: true },
  again: { say: [L('agata', 'Опять? Сказала — ушли все. Наверх иди, раз любопытный.')], end: true },
  nod: { say: [A('(Агата не поднимает головы от веника.)')], end: true },
  z: { end: true },
} };

// ======================= FOMA (D6): through the door / caught in the storeroom / on the street after the fire
export const fomaDoor: Conv = { id: 'foma.door', start: c => (c.count() > 0 ? 'again' : 'a'), nodes: {
  a: { say: [A('(стук)'), L('foma', '(из-за двери, глухо) Закрыто! Ночь на дворе!')], choices: [
    { ru: 'Мне ствол нужен.', if: c => c.knows('know_foma_guns'), next: 'b1' }, { ru: 'Я от Неда.', if: c => c.knows('name_ned'), next: 'b2' }, { ru: 'Открой. Поговорить надо.', next: 'b0' },
    { ru: 'В половине одиннадцатого здесь всё сгорит. Открой.', know: 'know_fire_2230', kt: '22:30', next: 'b3' },
    { ru: 'Твой револьвер краденый. Утром за ним придут.', know: 'know_gun_stolen', kt: 'опись', if: c => c.fl('tapCut'), next: 'b4' }, { ru: '(Уйти)', next: 'z' }] },
  b0: { say: [L('foma', 'Ночью не говорят. Иди.')], end: true },
  b1: { say: [L('foma', 'Мне тоже много чего нужно. Иди-иди.')], fx: c => c.learn('foma_door'), end: true },
  b2: { say: [L('foma', 'Нед мне шесть монет должен. Пусть сам придёт и отдаст.')], end: true },
  b3: { say: [L('foma', '(пауза) Ты пьяный? Иди отсюда, пока я полицию… (смешок) Полиции нет. Ну и иди.')], fx: c => { if (c.t() < at(22, 24)) c.flag('fomaWarned'); }, end: true },
  b4: { say: [L('foma', '(долгая пауза, лязгает засов) …Пять минут. Деньги вперёд.')], fx: c => { c.flag('fomaPaid'); c.openDoor('foma.door', true); }, end: true },
  again: { say: [L('foma', '(из-за двери) Сказал же — закрыто! Ещё раз постучишь — кипятком оболью!')], choices: [
    { ru: 'В половине одиннадцатого здесь всё сгорит. Открой.', know: 'know_fire_2230', kt: '22:30', next: 'b3' }, { ru: '(Уйти)', next: 'z' }] },
  z: { end: true },
} };
export const fomaCaught: Conv = { id: 'foma.caught', start: 'a', nodes: {
  a: { say: [A('Скрипит половица. В проёме — Фома с керосиновой лампой, огонь пляшет в его руке.'), L('foma', 'Кто здесь?! Кто… Как ты… У меня засов! Я сейчас… я кричать буду!')], choices: [
    { ru: 'Тихо. Я уже ухожу.', next: 'b' }, { ru: '(Поднять револьвер)', if: c => c.gun(), next: 'c' }, { ru: 'Бери шкатулку и выходи. В половине одиннадцатого тут всё сгорит.', know: 'know_fire_2230', kt: '22:30', next: 'd' }] },
  b: { say: [L('foma', 'Как ты вошёл?! Дверь на засове!.. Стой! Вор! Во-ор!')], fx: c => c.flag('fomaAlarmed'), end: true },
  c: { say: [L('foma', '(пятится, лампа ходит ходуном) Бери. Бери, всё бери. Только не надо… не надо.')], end: true },
  d: { say: [L('foma', '(смотрит на тебя, на ставни, принюхивается) …Газ. Господи, и правда газом тянет…')], fx: c => c.flag('fomaWarned'), end: true },
} };
export const fomaAfter: Conv = { id: 'foma.after', start: c => (c.count() > 0 ? 'again' : 'a'), nodes: {
  a: { say: [L('foma', '(сидит на шкатулке посреди улицы, мокрый) Тридцать лет. Тридцать лет в долг давал, а сам ни у кого не брал.')], choices: [{ ru: 'Сочувствую.', next: 'z' }, { ru: 'Ствол у тебя был.', if: c => c.knows('know_foma_guns'), next: 'b' }, { ru: '(Уйти)', next: 'z' }] },
  b: { say: [L('foma', 'Был. В кладовке, под половицей. (машет рукой на огонь) Теперь там — бери, если достанешь.')], fx: c => { c.learn('know_gun_under_floor'); c.thread('gun'); }, end: true },
  again: { say: [L('foma', '(не глядя) Чего ещё? Всё сгорело. Всё.')], end: true },
  z: { end: true },
} };
