import { Conv, L, A, W } from '../game/dialogue';
import { at } from '../sim/time';

// 02_DIALOGUES §11 Lukyan, §12 Tikhon and Pip, §14 pier 3, §15 the launch
export const lukyan: Conv = { id: 'lukyan', start: 'a', nodes: {
  a: { say: [L('lukyan', 'Чего надо? Баржа не возит.')], choices: [
    { ru: 'Кого ты сегодня ждёшь?', next: 'b1' },
    { ru: 'Через несколько минут тебе выстрелят в живот. Прачка. Из мужниного револьвера.', know: 'saw_tilda_shoot', kt: '22:33', next: 'b2' },
    { ru: '(Показать лист)', if: c => c.has('manifest'), next: 'b3' }] },
  b1: { say: [L('lukyan', 'Груз. Как всегда.')], next: 'c' },
  b2: { say: [L('lukyan', '(оглядывается на пирс) …Чего ты мелешь.')], next: 'c' },
  b3: { say: [L('lukyan', '(читает, сплёвывает) Ну, лист. Мне такой каждый месяц дают.')], next: 'c' },
  c: { say: [L('tik', 'Кто платит?'), L('lukyan', 'Человек от приюта. Конверт с печатью совета. Деньги — новые, банковские.')], choices: [{ ru: 'Кто внутри — дети?', next: 'd1' }, { ru: 'Харроу знает?', next: 'd2' }] },
  d1: { say: [L('lukyan', 'Я в трюм не смотрю. Мне за это и платят.')], fx: c => c.learn('know_envelope'), end: true },
  d2: { say: [L('lukyan', 'Баржа — Харроу. Пирс — Харроу. Склад — Харроу. А конверт — совета. Ты разбирайся, мне некогда.')], fx: c => { c.learn('know_envelope'); c.learn('know_barge_harrow'); c.note('luk1', 'Лукьян: «Платит человек от приюта. Конверт с печатью совета». Баржа, пирс и склад — Харроу.', 'Lukyan: "A man from the orphanage pays. An envelope with the board seal." Barge, pier and warehouse belong to Harrow.', 'lukyan'); }, end: true },
} };
export const lukyanDying: Conv = { id: 'lukyan.dying', start: 'a', nodes: { a: { say: [L('lukyan', '(хрипит) Тильда… Дура. Зачем… Я бы её сам отдал. Мне что дети, что бочки…')], fx: c => c.learn('know_lukyan_dying'), end: true } } };
export const tikhonDoor: Conv = { id: 'tikhon.door', start: 'a', nodes: {
  a: { say: [A('(стук)'), L('tikhon', '(за дверью) Кто?')], choices: [{ ru: 'Я от Гейла.', if: c => c.knows('name_gayl'), next: 'b1' }, { ru: 'Открой. Поговорить.', next: 'b2' }, { ru: 'Про Яна.', know: 'saw_yan_killed', kt: '22:35', next: 'b3' }] },
  b1: { say: [L('tikhon', '(открывает на цепочку) От Гейла? Ключ я забрал уже. Чего ещё?')], fx: c => c.flag('tikhonKnock'), next: 'in' },
  b2: { say: [L('tikhon', 'Ночью не говорят. Иди.')], choices: [{ ru: 'Я от Гейла.', next: 'b1' }, { ru: 'Про Яна.', know: 'saw_yan_killed', kt: '22:35', next: 'b3' }] },
  b3: { say: [L('tikhon', '(открывает) Тише. Ребёнок спит. Что с Яном?')], fx: c => c.flag('tikhonKnock'), next: 'in' },
  in: { say: [L('tikhon', '(шёпотом, оглядываясь на кровать) Говори.')], choices: [
    { ru: 'Яна убили на пристани. Как только катер встал.', know: 'saw_yan_killed', kt: '22:35', next: 'c1' },
    { ru: 'В списке у Гейла: «Ян — списать». «Тихон — после рейса списать».', if: c => c.knows('know_helmsmen'), next: 'c2' },
    { ru: 'Мне нужна твоя кепка и твой ключ.', next: 'c3' }, { ru: '(Поднять револьвер)', if: c => c.gun(), next: 'c4' }] },
  c1: { say: [L('tikhon', '(садится на табурет) Не может… Ян двадцать лет у них. Двадцать лет…')], next: 'fork' },
  c2: { say: [L('tikhon', '(берёт список, читает дважды) «После рейса». (смотрит на Пип) После рейса.')], next: 'fork' },
  c3: { say: [L('tikhon', 'А ещё что? Жену? Иди отсюда.')], next: 'in' },
  c4: { say: [L('tikhon', '(встаёт между Тиком и кроватью) Не при ней. Слышишь? Не при ней.')], next: 'fork4' },
  fork: { choices: [{ ru: 'Не ходи сегодня. Останься с ней. Я пойду вместо тебя.', next: 'f1' }, { ru: 'Отдай кепку и ключ. И уходи с ней из города до утра.', next: 'f2' }, { ru: 'Кепку. Ключ. Молча.', if: c => c.gun(), next: 'f3' }] },
  fork4: { choices: [{ ru: 'Кепку. Ключ. Молча.', next: 'f3' }, { ru: '(Ударить, пока не смотрит)', next: 'f4' }] },
  f1: { say: [L('tikhon', 'А ты кто ей такой, чтобы за неё умирать?')], choices: [{ ru: 'Никто. Я из Лукии. Как она будет, если ты не вернёшься.', next: 'f1a' }, { ru: 'Мне за это платят.', next: 'f1a' }] },
  f1a: { say: [L('tikhon', '(долго смотрит) …Охрана меня не знает в лицо. Я у них первый раз. Кепку вперёд надвинь. Бушлат бери. Ключ — вот. Двигатель любит, чтобы газ плавно. (у двери) Если они спросят пароль — нет пароля. Они спрашивают «Ты Тихон?». Скажи «Я». И не смотри им в лицо.')], fx: c => { c.flag('tikhonTurned'); c.give('cap'); c.learn('know_helm'); c.thread('pier3'); c.note('tik1', 'Тихон: отдал кепку, бушлат и ключ, остался с Пип. «Они спрашивают «Ты Тихон?». Скажи «Я» и не смотри им в лицо. Газ плавно».', 'Tikhon: gave me his cap, coat and key, and stayed with Pip. "They ask: Are you Tikhon? Say: I am — and do not look them in the face. Gas gently."', 'tikhon'); }, end: true },
  f2: { say: [L('tikhon', 'Из города — куда? С ребёнком, ночью. (думает) К сестре в Ольшаны.')], fx: c => { c.flag('tikhonTurned'); c.give('cap'); c.thread('pier3'); c.note('tik1', 'Тихон: отдал кепку и ключ; уйдёт с Пип к сестре в Ольшаны.', 'Tikhon: gave me his cap and key; he will leave with Pip to his sister in Olshany.', 'tikhon'); }, end: true },
  f3: { say: [L('tikhon', '(отдаёт) Ты их не обманешь. Они тебя убьют, и меня потом.')], fx: c => { c.flag('tikhonThreatened'); c.give('cap'); c.thread('pier3'); c.note('tik1', 'Тихон: отдал кепку под угрозой. Может предупредить Корда.', 'Tikhon: gave up his cap under threat. He may warn Cord.', 'tikhon'); }, end: true },
  f4: { say: [A('Тихон без сознания до 23:00. Пип просыпается.'), L('pip', 'Пап? Пап?..')], fx: c => { c.flag('tikhonHurt'); c.give('cap'); c.thread('pier3'); c.note('tik1', 'Ударил Тихона. Пип проснулась одна.', 'Struck Tikhon. Pip woke up alone.', 'tikhon'); }, end: true },
} };
export const guardPier: Conv = { id: 'guard.pier3', start: 'a', nodes: {
  a: { say: [L('guard1', 'Ты Тихон?')], choices: [{ ru: 'Я.', if: c => c.has('cap'), next: 'ok' }, { ru: 'Тихон заболел. Я вместо.', next: 'v' }, { ru: '(Молча кивнуть)', if: c => c.has('cap'), next: 'ok' }] },
  ok: { say: [L('guard1', 'Ключ есть? Заводи. Хозяин не любит ждать.')], fx: c => { c.learn('helm_ok'); }, end: true },
  v: { say: [L('guard1', '(рука к кобуре) Вместо кого? Нам вместо не говорили.')], choices: [{ ru: '(Показать список) Гейл прислал.', if: c => c.has('helmsmen'), next: 'v1' }, { ru: '(Молчать)', next: 'fight' }] },
  v1: { say: [L('guard1', '(читает при фонаре) …Ладно. Заводи. Но я рядом сяду.')], fx: c => c.learn('helm_ok'), end: true },
  fight: { say: [L('guard1', 'Эй, ты не Тихон.')], fx: c => c.flag('scarAlert'), end: true },
} };

export const patrol: Conv = { id: 'patrol', start: 'a', nodes: {
  a: { say: [L('guard', 'Стой. Мост закрыт. Пропуск или жетон курьера.')], choices: [{ ru: '(Показать жетон)', if: c => c.has('jeton'), next: 'ok' }, { ru: 'Мне по делу.', next: 'no' }, { ru: '(Уйти)', next: 'z' }] },
  ok: { say: [L('guard', '(смотрит на номер) Семнадцатый. Проходи.')], fx: c => { c.flag('patrolPassed'); c.learn('know_patrol'); }, end: true },
  no: { say: [L('guard', 'Дела днём. Назад.')], fx: c => { c.learn('know_patrol'); c.note('patrol', 'Мост перекрыт патрулём Корда: пропуск или жетон курьера.', 'The bridge is held by Cord\'s patrol: a pass or a courier token.', 'patrol1'); }, end: true },
  z: { end: true },
} };
