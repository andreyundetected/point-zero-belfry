import { Conv, L, A } from '../game/dialogue';
import { at } from '../sim/time';

// 02_DIALOGUES §8-10: Gayl (wounded / healthy), the orphanage
export const gaylWounded: Conv = { id: 'gayl.wounded', start: 'a', nodes: {
  a: { say: [A('Двор конторы, дым, искры. Гейл лежит у стены, зажимает бок. Глаза открыты.'), L('gayl', '(видит Тика) Не… не трогай. Больно.')], choices: [{ ru: 'Кто тебя?', next: 'b1' }, { ru: 'Где сейф?', next: 'b2' }, { ru: 'Держись. Я помогу.', next: 'b3' }] },
  b1: { say: [L('gayl', 'Вошёл по жетону… Жетон Неда… Я думал — Нед. Шрам у него. Через лицо.')], fx: c => c.learn('know_scar_raid'), next: 'c' },
  b2: { say: [L('gayl', '(смеётся, кашляет) Сейф… Нет сейфа. Взорвал. Всё горит.')], next: 'c' },
  b3: { say: [L('gayl', 'Не поможешь. Слушай.')], next: 'c' },
  c: { say: [L('gayl', '(хватает за рукав) Анна. Жена. Сестрой в приюте на Лукии. Скажи ей — пусть уходит. Сегодня. Прямо сейчас. За ней придут, как за мной.')], choices: [{ ru: 'Почему за ней?', next: 'd' }, { ru: 'Скажу.', next: 'e' }] },
  d: { say: [L('gayl', 'Потому что она… видела бумаги. Мои бумаги. Я дурак, я ей показал. (пауза) Скажи.')], next: 'e' },
  e: { say: [L('gayl', '(снимает кольцо, кладёт в ладонь Тику) Отдай. Она поймёт, что от меня.')], fx: c => { c.give('ring'); c.learn('know_gayl_wife'); c.thread('anna'); c.learn('know_safe_early'); c.note('gayl1', 'Гейл, раненый во дворе конторы: «Анна, жена, сестра в приюте. Пусть уходит. За ней придут». Отдал кольцо. Шрам вошёл по жетону Неда.', 'Gayl, wounded in the office yard: "Anna, my wife, a nurse at the orphanage. Tell her to leave. They will come for her." Gave me his ring. Scar came in on Ned\'s token.', 'gayl'); c.message('Сейф: нужно раньше 22:10.', 'The safe: get there before 22:10.'); }, end: true },
} };
export const gaylWindow: Conv = { id: 'gayl.window', start: 'a', nodes: {
  a: { say: [A('Окошко приёмной. Гейл в жилете и очках, недовольный.'), L('gayl', 'Контора закрыта. Курьеров по жетонам.')], choices: [
    { ru: '(Показать жетон)', if: c => c.has('jeton'), next: 'j' }, { ru: 'У меня к тебе дело.', next: 'd' },
    { ru: 'Анна. Сестра в приюте на Лукии. Твоя жена.', know: 'know_gayl_wife', kt: '22:14', next: 'w' }] },
  j: { say: [L('gayl', 'Семнадцатый — Нед. Ты не Нед. (смотрит) Где Нед?'), L('tik', 'Нед жетон проиграл. Тот, кто его купил, будет здесь через пять минут.')], next: 'w2' },
  d: { say: [L('gayl', 'Дела днём. (закрывает окошко)')], choices: [{ ru: 'Анна. Сестра в приюте на Лукии. Твоя жена.', know: 'know_gayl_wife', kt: '22:14', next: 'w' }, { ru: '(Уйти)', next: 'z' }] },
  w: { say: [L('gayl', '(окошко застыло на полпути) …Откуда ты знаешь мою жену?')], next: 'w2' },
  w2: { say: [L('tik', 'Через семь минут тут всё взлетит. Склад, контора. Тебя ранят во дворе. Ты попросишь передать Анне, чтобы уходила. И отдашь мне кольцо.')], choices: [
    { ru: '(Показать кольцо)', if: c => c.has('ring'), know: 'know_gayl_wife', kt: '22:14', next: 'k1' },
    { ru: 'Человек со шрамом. Войдёт по жетону Неда.', know: 'know_scar_raid', kt: '22:12', next: 'k2' },
    { ru: '(Положить ключ на стойку)', if: c => c.has('key'), next: 'k3' }] },
  k1: { say: [L('gayl', '(смотрит на своё кольцо у себя на пальце, потом на кольцо у Тика) …Что это. Что это такое…')], next: 'open' },
  k2: { say: [L('gayl', 'Шрам… Корда человек. Он вчера спрашивал, когда я один.')], next: 'open' },
  k3: { say: [L('gayl', 'Ключ Неда. (пауза) Тогда ты правда оттуда.')], next: 'open' },
  open: { say: [A('(Открывает дверь, пускает.)'), L('gayl', 'Чего ты хочешь?')], fx: c => { c.flag('officeOpen'); c.flag('innerOpen'); c.openDoor('contora.door', true); }, choices: [{ ru: 'Открой сейф.', next: 's1' }, { ru: 'Мне нужен Харроу.', next: 's2' }, { ru: 'Уходи отсюда. Сейчас.', next: 's3' }] },
  s1: { say: [L('gayl', '(стоит у сейфа, не открывает) Если я открою — меня убьют.'), L('tik', 'Тебя убьют в любом случае.'), L('gayl', '(открывает) Бери. Мне это никогда не было нужно.')], fx: c => c.flag('safeOpened'), next: 'items' },
  s2: { say: [L('gayl', 'Харроу не бывает на суше. Он на катере. Катер меняет рулевых. Всё в сейфе. (открывает)')], fx: c => c.flag('safeOpened'), next: 'items' },
  s3: { say: [L('gayl', '(снимает пальто с крюка) А курьеры? У меня двое в подвале спят.')], fx: c => { c.flag('gaylWarned'); c.flag('annaWarned'); c.flag('safeOpened'); }, next: 'items' },
  items: { say: [A('В сейфе: список рулевых катера «Сокол», запасной ключ зажигания «Сокол-2», опись склада, перевозочный лист.'), L('gayl', 'Подпись моя. Печать склада. Я подписываю, что везут. Не что внутри.')], choices: [{ ru: 'Ты знал, что внутри.', next: 'q1' }, { ru: 'Кто приказывает?', next: 'q2' }, { ru: '(Взять лист и уйти)', next: 'fin' }] },
  q1: { say: [L('gayl', '(молчит долго) Догадывался. Вот Анна — знала.')], next: 'fin' },
  q2: { say: [L('gayl', 'Карандашом внизу написано. Совет. Попечительский. А деньги — со склада Харроу. Кто приказывает — тот, кто платит. Я не знаю, кто из них платит.')], fx: c => c.learn('know_manifest_pencil'), next: 'fin' },
  fin: { fx: c => { c.give('manifest'); c.learn('know_manifest'); c.learn('know_helmsmen'); c.learn('know_gun_stolen'); c.thread('tikhon'); c.note('gayl2', 'Сейф Гейла: список рулевых катера «Сокол» («Ян Вилк — списать. Тихон Мерц, Канатная 4 — после рейса списать»), запасной ключ «Сокол-2», опись склада, перевозочный лист (приют → пирс 7, 22:40, 14 мест; карандашом: «по распоряжению попечительского совета»).', 'Gayl\'s safe: list of the "Falcon" helmsmen ("Yan Vilk — write off. Tikhon Merts, Kanatnaya 4 — write off after the trip"), spare key "Falcon-2", warehouse inventory, transport sheet (orphanage → pier 7, 22:40, 14 places; in pencil: "by order of the board of trustees").', 'gayl'); c.message('Рулевой Тихон. Приют: 14 детей, 22:40.', 'Helmsman Tikhon. The orphanage: 14 children, 22:40.'); }, end: true },
  z: { end: true },
} };
export const guardGate: Conv = { id: 'guard.gate', start: 'a', nodes: {
  a: { say: [L('guard', 'Стой. Куда?')], choices: [{ ru: 'К матушке Агнии.', next: 'b1' }, { ru: 'Я здесь вырос.', next: 'b2' }, { ru: 'К Анне. От мужа.', if: c => c.has('ring'), next: 'b3' }] },
  b1: { say: [L('guard', 'Ночью не принимают.')], fx: c => c.learn('guard_no'), end: true },
  b2: { say: [L('guard', '(усмехается) И что, соскучился?')], fx: c => c.learn('guard_no'), end: true },
  b3: { say: [L('guard', '(пауза) Пять минут. И чтоб я тебя видел.')], fx: c => { c.flag('gateOpen'); c.openDoor('priyut.gate', true); }, end: true },
} };
export const agnia: Conv = { id: 'agnia', start: 'a', nodes: {
  a: { say: [L('agnia', '(поднимает голову от книги, щурится) Кто?.. (встаёт медленно) Тимоша? Тимофей?')], choices: [{ ru: 'Здравствуйте, матушка.', next: 'a1' }, { ru: 'Узнали.', next: 'a2' }, { ru: 'Не надо так меня звать.', next: 'a3' }] },
  a1: { say: [L('agnia', 'Господи. Высокий какой. Худой. Ты ешь?')], next: 'b' },
  a2: { say: [L('agnia', 'Как не узнать. Ты мне окно в прачечной выбил. Двадцать лет прошло, а стекло так и не вставили.')], next: 'b' },
  a3: { say: [L('agnia', '(садится) Хорошо. Как хочешь.')], next: 'b' },
  b: { say: [L('agnia', 'Зачем пришёл? Ночью.')], choices: [{ ru: 'Куда везут детей?', next: 'b1' }, { ru: 'Кто велел?', next: 'b2' }, { ru: 'Пирс семь. Баржа «Вера». Это не школа.', if: c => c.has('manifest'), know: 'know_manifest', kt: 'лист', next: 'b3' }] },
  b1: { say: [L('agnia', 'В монастырскую школу. В Ольховку. Им там будет лучше, у нас печи не топлены.')], next: 'c' },
  b2: { say: [L('agnia', 'Госпожа Крайн. Попечительский совет. У нас всё по бумагам.')], fx: c => { c.learn('know_crane_orders'); c.note('agnia1', 'Агния: детей перевозят «в школу» по распоряжению госпожи Крайн, попечительского совета.', 'Agnia: the children go "to a school" by order of Mrs. Crane and the board of trustees.', 'agnia'); }, next: 'c' },
  b3: { say: [L('agnia', '(смотрит на лист долго) Не знаю я никакой «Веры». Мне сказали — школа. Мне двадцать лет говорят — школа.')], next: 'c' },
  c: { say: [L('tik', 'Двадцать лет?'), L('agnia', '(молчит, потом гладит книгу) Иди, Тимоша. Не надо тебе этого.')], choices: [{ ru: 'Покажите книгу.', next: 'k1' }, { ru: '(Взять книгу самому)', next: 'k2' }, { ru: 'Я уйду. С детьми.', next: 'k3' }] },
  k1: { say: [L('agnia', '(отодвигает книгу к нему) Смотри. Я всё равно не смогла бы прочесть тебе вслух.')], next: 'book' },
  k2: { say: [A('(Агния не мешает, отворачивается к окну.)')], next: 'book' },
  k3: { say: [L('agnia', 'С тремя стволами во дворе? (качает головой) Не дури.')], next: 'z' },
  book: { say: [A('Книга: колонка «отметка», «отложен». Сегодняшние четырнадцать. Ниже, старым почерком: «Тимофей, 7 лет, родных нет — отложен», чужой рукой: «сбежал».'), L('tik', '(вслух, тихо) Отложен.'), L('agnia', 'Ты сбежал за два дня. Я тогда думала — к лучшему.')],
    fx: c => { c.learn('know_ledger'); c.note('ledger', 'Книга приюта: у сегодняшних четырнадцати отметка «отложен». Двадцать лет назад: «Тимофей, 7 лет, родных нет — отложен», ниже: «сбежал».', 'The orphanage ledger: today\'s fourteen are marked "set aside". Twenty years ago: "Timofey, 7, no kin — set aside", below: "ran away".', 'agnia', true); }, next: 'z' },
  z: { say: [L('agnia', 'Она даёт уголь, хлеб, сестёр. Без неё тут через месяц половина бы умерла. Ты думаешь, я не спрашивала себя? Спрашивала.')], end: true },
} };
export const anna: Conv = { id: 'anna', start: 'a', nodes: {
  a: { say: [L('anna', '(встаёт между Тиком и кроватями) Вы кто? Сюда нельзя.')], choices: [
    { ru: '(Протянуть кольцо) От Гейла.', if: c => c.has('ring'), next: 'a1' }, { ru: 'Гейл просил передать — уходи.', next: 'a2' }, { ru: 'Склад взорвали. Гейл ранен.', know: 'saw_blast', kt: '22:12', next: 'a3' }] },
  a1: { say: [L('anna', '(берёт кольцо двумя руками) Где он? Он живой?')], fx: c => { c.take('ring'); c.flag('ringGiven'); }, next: 'b' },
  a2: { say: [L('anna', 'Гейл? Он… Почему он сам… Что с ним?')], next: 'b' },
  a3: { say: [L('anna', '(садится на край кровати) Я ему говорила. Я ему говорила.')], next: 'b' },
  b: { say: [L('anna', 'Он показывал мне бумаги. Я сказала: это не школа. Он сказал: молчи, Анна, это не наше. (смотрит на детей) Они одеты. Им сказали — поедут к морю.')], choices: [{ ru: 'Выведи их. Сейчас. Через прачечную.', next: 'c1' }, { ru: 'Уходи одна.', next: 'c2' }, { ru: 'Сколько охраны?', next: 'c3' }] },
  c1: { say: [L('anna', 'Четырнадцать. Через окно. Ночью. В дождь. (пауза) …Задняя калитка. Если двор будет пустой хоть минуту.')], fx: c => { c.flag('annaWarned'); c.learn('know_back_gate'); c.thread('wagon'); c.note('anna1', 'Анна: «Задняя калитка, если двор будет пустой хоть минуту». Охрана курит за воротами 22:24–22:25.', 'Anna: "The back gate, if the yard is empty for a minute." The guards smoke outside the gate at 22:24–22:25.', 'anna'); }, end: true },
  c2: { say: [L('anna', 'Нет.')], end: true },
  c3: { say: [L('anna', 'Трое и возница. Курят за воротами, когда матушка не видит. Минуту, не больше.')], fx: c => c.learn('know_guard_smoke'), next: 'b' },
} };
export const anka: Conv = { id: 'anka', start: 'a', nodes: {
  a: { say: [L('anka', '(смотрит снизу) Вы с мамой знакомы?')], choices: [{ ru: 'Знаком. Её зовут Тильда.', next: 'b' }, { ru: 'Нет.', next: 'n' }] },
  b: { say: [L('anka', '(улыбается) Она меня заберёт? Тут сказали — к морю.')], choices: [{ ru: 'Заберёт.', next: 'c' }, { ru: 'Не знаю.', next: 'c' }] },
  c: { say: [L('anka', '(снимает ленту с косы) Передайте ей. Чтобы не волновалась.')], fx: c => { c.give('ribbon'); c.thread('tilda'); c.note('anka1', 'Анка отдала ленту: «Передайте маме». Приют, 22:30–22:38, возле повозки.', 'Anka gave me her ribbon: "Give it to Mama." The orphanage, 22:30–22:38, by the wagon.', 'anka', true); }, end: true },
  n: { say: [L('anka', 'А. (отворачивается к повозке)')], end: true },
} };
export const guardCart: Conv = { id: 'guard.cart', start: 'a', nodes: {
  a: { say: [L('guard', 'Отойди от повозки.')], choices: [{ ru: 'Куда везёте?', next: 'b1' }, { ru: 'Чьи вы люди?', next: 'b2' }, { ru: '(Отойти)', next: 'z' }] },
  b1: { say: [L('guard', 'В школу. Отойди.')], end: true },
  b2: { say: [L('guard', '(показывает бумагу с печатью совета) Видишь печать? Вот чьи. Отойди.'), A('На ремне кобуры бирка: «Склад №2».'), L('tik', 'Бирка со склада Харроу.')], fx: c => { c.learn('know_guard_tag'); c.note('tag', 'Охрана повозки: пропуск с печатью совета; на кобуре бирка «Склад №2» (склад Харроу).', 'Wagon guards: a pass with the board seal; a "Warehouse No. 2" tag on the holster (Harrow\'s warehouse).', 'ggrd1'); }, end: true },
  z: { end: true },
} };

export const safeConv: Conv = { id: 'safe', start: 'a', nodes: {
  a: { say: [A('В сейфе: список рулевых катера «Сокол», запасной ключ зажигания «Сокол-2», опись склада, перевозочный лист. В Карман войдёт одно.')],
    fx: c => { c.learn('know_manifest'); c.learn('know_helmsmen'); c.learn('know_gun_stolen'); c.learn('know_manifest_pencil'); c.thread('tikhon'); c.note('safe', 'Сейф Гейла: список рулевых («Ян Вилк — списать. Тихон Мерц, Канатная 4 — после рейса списать»), запасной ключ «Сокол-2», опись склада (револьвер №4417 краденый, сдан в залог Ф.), перевозочный лист (приют → пирс 7, 22:40, 14 мест; карандашом: «по распоряжению попечительского совета»).', 'Gayl\'s safe: list of helmsmen, spare key "Falcon-2", warehouse inventory (revolver #4417 stolen, pawned by F.), transport sheet (orphanage → pier 7, 22:40, 14 places; in pencil: "by order of the board").', 'gayl'); },
    choices: [{ ru: 'Взять перевозочный лист.', next: 'm' }, { ru: 'Взять список рулевых.', next: 'h' }, { ru: 'Взять запасной ключ зажигания.', next: 's' }, { ru: 'Оставить всё.', next: 'z' }] },
  m: { fx: c => c.give('manifest'), end: true }, h: { fx: c => c.give('helmsmen'), end: true }, s: { fx: c => c.give('spareKey'), end: true }, z: { end: true },
} };
