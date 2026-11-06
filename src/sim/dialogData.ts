// Граф диалогов и осмотров. Тексты регистрируются в TEXTS [ru, en] и подгружаются в i18n.
import { World, giveNpc, hasFact, learn, emit, buyItem, npcHas } from './core';
import { TIMES, dist2d, NODES } from './map';
import type { Skill } from './dialog';

export const TEXTS: Record<string, [string, string]> = {};
const T = (key: string, ru: string, en: string) => { TEXTS[key] = [ru, en]; return key; };

export interface DLine { who: string; k: string; min?: [Skill, number] }
export interface DChoice { id: string; k: string; to?: string; fail?: string; c?: (w: World) => boolean; check?: [Skill, number]; fx?: (w: World) => void; failFx?: (w: World) => void }
export interface DNode { lines: DLine[]; choices: DChoice[]; fx?: (w: World) => void }
export interface DDialog { start: { c?: (w: World) => boolean; node: string }[]; nodes: Record<string, DNode> }
export interface DInspect { name: string; desc: (w: World) => string; voices?: { skill: Skill; dc: number; k: string; c?: (w: World) => boolean }[]; learn?: (w: World) => string[] }

let cur = '';
const ln = (id: string, who: string, ru: string, en: string, min?: [Skill, number]): DLine => ({ who, k: T(`dlg.${cur}.${id}`, ru, en), min });
const ch = (id: string, ru: string, en: string, o: Partial<DChoice> = {}): DChoice => ({ id, k: T(`dlg.${cur}.${id}`, ru, en), ...o });
const N = (lines: DLine[], choices: DChoice[] = [], fx?: (w: World) => void): DNode => ({ lines, choices, fx });
const bye = (ru = 'Понял.', en = 'Understood.') => ch('bye', ru, en);
const holdsKind = (w: World, kind: string) => { const h = w.player.hands && w.items[w.player.hands]; return !!h && h.kind === kind && !(h.double && !h.real); };
const trust = (w: World, id: string) => w.player.trust[id] ?? 0;
const addTrust = (w: World, id: string, d: number) => { w.player.trust[id] = trust(w, id) + d; };
const giveHeld = (w: World, kind: string, to: string) => {
  const h = w.player.hands && w.items[w.player.hands]; if (!h || h.kind !== kind) return;
  w.player.hands = null; giveNpc(w, h.id, to); emit(w, 'GIVE', ['player', to, 'item:' + h.id], [], { item: h.id }, ['item:' + h.id]);
};

export const DIALOGS: Record<string, DDialog> = {};

// ---------------- Игнат ----------------
cur = 'ignat';
DIALOGS.ignat = {
  start: [{ c: (w) => !!w.flags.keyMissing, node: 'missing' }, { node: 'hello' }],
  nodes: {
    hello: N([ln('h1', 'npc', 'Стоять. Согласно уставу, до праздничного фонаря вход закрыт.', 'Halt. By regulation, entry is closed until the lantern lighting.')], [
      ch('obs', '«Ключ у вас на поясе, а крюк в будке пуст.»', '“The key is on your belt, the hook in the booth is empty.”', { check: ['obs', 5], to: 'obs_ok', fail: 'obs_f' }),
      ch('pers', '«Мне нужно к башне — там часовщик ждёт.»', '“I need to reach the tower — the watchmaker is waiting.”', { check: ['pers', 7], to: 'pers_ok', fail: 'pers_f' }),
      ch('tea', '«А когда вы отдыхаете, по уставу?»', '“When do you rest, by regulation?”', { to: 'tea' }),
      bye(),
    ]),
    obs_ok: N([ln('o1', 'obs', 'Крюк в будке пуст до тех пор, пока ключ при нём. Ровно в 21:36 он повесит его и уйдёт.', 'The hook stays empty while the key is on him. At exactly 21:36 he hangs it and leaves.'), ln('o2', 'npc', 'Наблюдательны. Руки от служебного имущества — прочь.', 'Observant. Hands off official property.')], [bye()], (w) => learn(w, 'K4')),
    obs_f: N([ln('of', 'npc', 'Не вижу, куда вы клоните.', 'I do not see what you are driving at.')], [bye()]),
    pers_ok: N([ln('p1', 'npc', 'Часовщик, значит… Проходите, но вдоль стены.', 'The watchmaker, is it… Pass, but keep to the wall.')], [bye()]),
    pers_f: N([ln('pf', 'npc', 'Устав есть устав. Назад.', 'Regulations are regulations. Step back.')], [bye()]),
    tea: N([ln('t1', 'npc', 'Три минуты чая в «Трёх якорях». Ровно в 21:36. Ключ вешаю на крюк в будке — чтоб не потерять.', 'Three minutes of tea at the Three Anchors. Exactly 21:36. I hang the key on the booth hook — so as not to lose it.'), ln('t2', 'npc', 'Это не секрет. Это устав.', 'It is no secret. It is regulation.')], [bye()], (w) => learn(w, 'K4')),
    missing: N([ln('m1', 'npc', 'Ключ! Он висел на крюке! Кто здесь был?!', 'The key! It hung on the hook! Who was here?!'), ln('m2', 'npc', 'Без него шкаф КШ-1 не открыть — ни мне, ни фонарщику.', 'Without it the KSh-1 cabinet will not open — not for me, not for the lamplighter.')], [
      ch('give', '«Вот ваш ключ.» (отдать)', '“Here is your key.” (give)', { c: (w) => holdsKind(w, 'key'), to: 'thanks', fx: (w) => { giveHeld(w, 'key', 'ignat'); w.flags.keyMissing = false; } }),
      ch('deny', '«Не видел.»', '“Did not see.”', {}),
    ]),
    thanks: N([ln('th', 'npc', '…Благодарю. Об этом — ни слова.', '…Thank you. Not a word about this.')], [bye()]),
  },
};

// ---------------- Матвей ----------------
cur = 'matvey';
DIALOGS.matvey = {
  start: [{ node: 'hello' }],
  nodes: {
    hello: N([ln('h1', 'npc', 'Три приёма: сорок, семьдесят, сто. Слишком быстро нельзя — трубы старые.', 'Three steps: forty, seventy, hundred. Too fast won’t do — the pipes are old.'), ln('h2', 'npc', 'Двадцать лет фонари зажигаю, спросите кого хотите.', 'Twenty years I have lit these lamps, ask anyone.')], [
      ch('mem', '[Память] «В вашем журнале: “Не открывать сразу больше семидесяти”.»', '[Memory] “Your logbook says: ‘Never open past seventy at once’.”', { check: ['mem', 6], to: 'k5', fail: 'k5f' }),
      ch('toast', '«Угощаю.» (кружка эля)', '“My treat.” (mug of ale)', { c: (w) => holdsKind(w, 'mug'), to: 'toast', fx: (w) => { giveHeld(w, 'mug', 'matvey'); addTrust(w, 'matvey', 2); } }),
      ch('hold', '«Не открывай, пока я не скажу.»', '“Do not open until I say.”', { c: (w) => trust(w, 'matvey') >= 2 && hasFact(w, 'K5') && !w.npcs.matvey.m.hold, to: 'hold', fx: (w) => { w.npcs.matvey.m.hold = true; emit(w, 'ORDER', ['player', 'matvey'], [], { o: 'hold' }, ['matvey']); } }),
      ch('release', '«Теперь можно. Открывай.»', '“Now you may. Open it.”', { c: (w) => !!w.npcs.matvey.m.hold, to: 'release', fx: (w) => { w.npcs.matvey.m.hold = false; emit(w, 'ORDER', ['player', 'matvey'], [], { o: 'release' }, ['matvey']); } }),
      ch('close', '«Закрой вентиль!»', '“Close the valve!”', { c: (w) => trust(w, 'matvey') >= 2, to: 'close', fx: (w) => {
        const m = w.npcs.matvey;
        if (dist2d(m.x, m.z, NODES.ks1.x, NODES.ks1.z) < 7 && w.ks1Open) { w.v = 0; emit(w, 'ORDER', ['player', 'matvey', 'valve:supply'], [], { o: 'close_literal' }, ['valve:supply']); }
      } }),
      bye(),
    ]),
    k5: N([ln('k5', 'mem', 'Точно: «40 — выдержать две минуты, 70 — ещё две, и только потом 100». При спешке он эти паузы пропустит.', 'Right: “40 — hold two minutes, 70 — two more, only then 100”. In a hurry he will skip those pauses.'), ln('k5n', 'npc', 'Читали мой журнал?! Ну… да. Так и есть.', 'You read my logbook?! Well… yes. That is so.')], [bye()], (w) => learn(w, 'K5')),
    k5f: N([ln('k5f', 'npc', 'Что-что? Я не веду журналов для всех подряд.', 'What? I do not keep logbooks for just anyone.')], [bye()]),
    toast: N([ln('to', 'npc', 'Ну вот, это по-человечески! Ваше здоровье. Чем могу — скажите.', 'Now that is decent! Your health. Whatever I can do — say it.')], [bye()]),
    hold: N([ln('ho', 'npc', 'Понял: ни вентиля не трону, пока не скажете. Буквально.', 'Understood: not a valve will I touch until you say. Literally.')], [bye()]),
    release: N([ln('re', 'npc', 'Ага, наконец-то. Открываю как положено!', 'Ah, at last. Opening as proper!')], [bye()]),
    close: N([ln('cl', 'npc', 'Закрыть вентиль? Вон тот, что у меня под рукой — закрыл.', 'Close the valve? The one right under my hand — closed.')], [bye()]),
  },
};

// ---------------- Орвен ----------------
cur = 'orven';
DIALOGS.orven = {
  start: [{ node: 'hello' }],
  nodes: {
    hello: N([ln('h1', 'npc', 'Бюро закрыто для посторонних. Если только вы не с праздничным флагом от швеи.', 'The bureau is closed to outsiders. Unless you come with the festival flag from the seamstress.')], [
      ch('sig', '«Какой сигнал нужен?»', '“What signal is needed?”', { to: 'sig' }),
      ch('log', '«Что в журнале причалов?»', '“What is in the pier log?”', { to: 'log' }),
      bye(),
    ]),
    sig: N([ln('s1', 'npc', 'Красный над синим — порт закрыт на праздник. Флаг поднимаю сам, но без Тильдиного — не могу.', 'Red over blue — the port is closed for the festival. I raise it myself, but without Tilda’s flag I cannot.')], [bye()]),
    log: N([ln('l1', 'npc', 'Правило для Бориса: нет сигнала к 21:42 — швартуется и выгружает бочки на набережную.', 'Boris’s rule: no signal by 21:42 — he moors and unloads barrels onto the embankment.')], [bye()], (w) => learn(w, 'K10')),
  },
};

// ---------------- Борис ----------------
cur = 'boris';
DIALOGS.boris = {
  start: [{ node: 'hello' }],
  nodes: {
    hello: N([ln('h1', 'npc', 'Бочки с маслом, как договаривались! Куда поставить — туда и покачу.', 'Barrels of oil, as agreed! Wherever you say, there I roll them.'), ln('h2', 'npc', 'Мачта сигнала не показывала — значит, швартуюсь. Правило есть правило.', 'The mast showed no signal — so I moor. A rule is a rule.')], [bye()]),
  },
};

// ---------------- Лука ----------------
cur = 'luka';
DIALOGS.luka = {
  start: [{ node: 'hello' }],
  nodes: {
    hello: N([ln('h1', 'npc', 'Без билета не пущу. Проездной — только именной.', 'No ticket, no ride. A pass is personal only.')], [
      ch('price', '«Сколько стоит билет?»', '“How much is a ticket?”', { to: 'price' }),
      ch('sched', '«Расписание?»', '“The timetable?”', { to: 'sched' }),
      bye(),
    ]),
    price: N([ln('p1', 'npc', 'Две монеты, в киоске у Миры. Киоск до 21:45.', 'Two coins, at Mira’s kiosk. The kiosk is open until 21:45.')], [bye()], (w) => learn(w, 'K7')),
    sched: N([ln('s1', 'npc', 'От «Площади»: 21:30 и 21:50. От «Пристани»: 21:35 и 21:55. Не жду никого.', 'From “Square”: 21:30 and 21:50. From “Pier”: 21:35 and 21:55. I wait for no one.')], [bye()]),
  },
};

// ---------------- Фома ----------------
cur = 'foma';
DIALOGS.foma = {
  start: [{ node: 'hello' }],
  nodes: {
    hello: N([ln('h1', 'npc', 'А, садитесь! Всё знаю, всё слыхал… Только вот даты путаю.', 'Ah, sit down! I know it all, heard it all… only I muddle the dates.')], [
      ch('ale', '«Угощаю.» (кружка эля)', '“My treat.” (mug of ale)', { c: (w) => holdsKind(w, 'mug'), to: 'gossip', fx: (w) => { giveHeld(w, 'mug', 'foma'); addTrust(w, 'foma', 1); } }),
      ch('gos', '«Что слыхать?»', '“What’s the news?”', { to: 'rumor' }),
      bye(),
    ]),
    rumor: N([ln('r1', 'npc', 'У Агаты плита шипит… или это дождь? А вентиль, говорят, в погребе, под ковром.', 'Agata’s stove hisses… or is that the rain? And the valve, they say, is in the cellar, under the rug.')], [bye()]),
    gossip: N([ln('g1', 'npc', 'За кружку — слушай! Вентиль таверны в погребе, под ковром у лестницы. Стар, как я!', 'For a mug — listen! The tavern valve is in the cellar, under the rug by the stairs. Old as I am!'), ln('g2', 'npc', 'А Игнат ровно в 21:36 уходит пить чай. Ключ на крюк вешает.', 'And Ignat leaves for tea at exactly 21:36. Hangs the key on the hook.')], [bye()], (w) => { learn(w, 'K9'); learn(w, 'K4'); }),
  },
};

// ---------------- Тильда ----------------
cur = 'tilda';
DIALOGS.tilda = {
  start: [{ node: 'hello' }],
  nodes: {
    hello: N([ln('h1', 'npc', 'Тяжёлое. Но я справлюсь.', 'It’s heavy. I’ll manage.')], [
      ch('emp', '[Эмпатия] «Вы торопитесь не из-за флага. Что-то случилось?»', '[Empathy] “You’re not hurrying because of the flag. What happened?”', { check: ['emp', 5], to: 'worry', fail: 'closed' }),
      ch('help', '«Давайте я возьму свёрток.»', '“Let me carry the bundle.”', { to: 'nohelp' }),
      ch('ticket', '«Вот билет.» (отдать)', '“Here is a ticket.” (give)', { c: (w) => holdsKind(w, 'ticket'), to: 'thanks', fx: (w) => { giveHeld(w, 'ticket', 'tilda'); addTrust(w, 'tilda', 1); } }),
      ch('pass', '«Вот ваш проездной.» (отдать)', '“Here is your pass.” (give)', { c: (w) => holdsKind(w, 'pass'), to: 'thanks', fx: (w) => { giveHeld(w, 'pass', 'tilda'); addTrust(w, 'tilda', 1); } }),
      bye(),
    ]),
    worry: N([ln('w1', 'npc', 'Проездной… Оставила на скамье и забыла. Без него Лука не пустит, а на билет у меня одна монета.', 'My pass… I left it on the bench and forgot. Without it Luka will not let me on, and for a ticket I have one coin.'), ln('w2', 'npc', 'Флаг должен быть у Орвена до сигнала. Трамвай в 21:30 — другого не будет.', 'The flag must reach Orven before the signal. The 21:30 tram — there will be no other.')], [bye()], (w) => learn(w, 'K6')),
    closed: N([ln('c1', 'npc', 'Не ваше дело. Я сама.', 'None of your business. I’ll manage myself.')], [bye()]),
    nohelp: N([ln('n1', 'npc', 'Нет-нет, свёрток никому не отдаю. Спасибо.', 'No, no, I give the bundle to no one. Thank you.')], [bye()]),
    thanks: N([ln('t1', 'npc', 'Я… не просила. Но спасибо. Успею?', 'I… did not ask. But thank you. Will I make it?')], [bye()]),
  },
};

// ---------------- Агата ----------------
cur = 'agata';
DIALOGS.agata = {
  start: [{ c: (w) => w.alarm, node: 'alarm' }, { node: 'hello' }],
  nodes: {
    hello: N([ln('h1', 'npc', 'Не стой у плиты. Хочешь поесть — садись, не мешай.', 'Don’t stand by the stove. Want to eat — sit, don’t get in the way.')], [
      ch('ale', '«Кружку эля.» (две монеты)', '“A mug of ale.” (two coins)', { c: (w) => holdsKind(w, 'coinstack'), to: 'ale', fx: (w) => { buyItem(w, 'mug'); } }),
      ch('stove', '«Плита не шипит?»', '“Isn’t the stove hissing?”', { to: 'stove' }),
      ch('cel', '«Что в погребе?»', '“What is in the cellar?”', { to: 'cellar' }),
      bye(),
    ]),
    ale: N([ln('a1', 'npc', 'Держи. И не расплещи на ковёр.', 'Here. And don’t spill on the rug.')], [bye()]),
    stove: N([ln('s1', 'npc', 'Плита исправная, дрова сухие. Ты мне зубы не заговаривай.', 'The stove is sound, the wood is dry. Don’t sweet-talk me.'), ln('s2', 'tech', 'Стык у плиты старый, но пока тих. Проверить его можно, когда он начнёт шипеть.', 'The stove joint is old, but quiet for now. It can only be judged once it starts to hiss.', ['tech', 5])], [bye()]),
    cellar: N([ln('c1', 'npc', 'Бочки, ящики, сундучок девчонки. И вентиль, чтоб ему… Под ковром у лестницы.', 'Barrels, crates, the girl’s little chest. And the valve, bother it… Under the rug by the stairs.')], [bye()], (w) => learn(w, 'K9')),
    alarm: N([ln('al1', 'npc', 'Огонь! Все на улицу! Девчонку, девчонку найдите!', 'Fire! Everyone outside! Find the girl, find the girl!')], [bye('Бегу!', 'Running!')]),
  },
};

// ---------------- Мира ----------------
cur = 'mira';
DIALOGS.mira = {
  start: [{ c: (w) => !w.kioskOpen, node: 'closed' }, { node: 'hello' }],
  nodes: {
    hello: N([ln('h1', 'npc', 'Билеты! Свежий «Вестник»! Билет — две монеты, и ни медяком меньше.', 'Tickets! Fresh “Herald”! A ticket is two coins, not a copper less.')], [
      ch('buy', '«Билет, пожалуйста.» (две монеты)', '“A ticket, please.” (two coins)', { c: (w) => holdsKind(w, 'coinstack'), to: 'sold', fx: (w) => { buyItem(w, 'ticket'); } }),
      ch('no', '«Нет денег.»', '“No money.”', { c: (w) => !holdsKind(w, 'coinstack'), to: 'nomoney' }),
      ch('open', '«До скольки работаете?»', '“How late are you open?”', { to: 'hours' }),
      bye(),
    ]),
    sold: N([ln('s1', 'npc', 'Вот. Не потеряй — Лука строг.', 'There. Don’t lose it — Luka is strict.')], [bye()]),
    nomoney: N([ln('n1', 'npc', 'Без монет — никак. Хоть торгуйся, хоть пой.', 'Without coins — no way. Haggle or sing, same thing.')], [bye()]),
    hours: N([ln('hh', 'npc', 'До 21:45, потом закрываю и бегу на сцену смотреть.', 'Until 21:45, then I close and run to watch the stage.')], [bye()], (w) => learn(w, 'K7')),
    closed: N([ln('cl', 'npc', 'Закрыто! Приходите завтра.', 'Closed! Come back tomorrow.')], [bye()]),
  },
};

// ---------------- Пип ----------------
cur = 'pip';
DIALOGS.pip = {
  start: [{ c: (w) => w.alarm, node: 'alarm' }, { node: 'hello' }],
  nodes: {
    hello: N([ln('h1', 'npc', 'Не скажу, что у меня в сундучке.', 'I won’t tell what’s in my chest.')], [
      ch('emp', '[Эмпатия] «Тебе что-то нужно взамен?»', '[Empathy] “Do you want something in exchange?”', { check: ['emp', 4], to: 'barter', fail: 'cold' }),
      ch('auth', '[Авторитет] «Верни. Сейчас же.»', '[Authority] “Give it back. Right now.”', { check: ['auth', 8], to: 'obey', fail: 'refuse', failFx: (w) => addTrust(w, 'pip', -1) }),
      bye(),
    ]),
    barter: N([ln('b1', 'npc', 'Блестящее! Принеси блестящее — скажу, где всё лежит. В подвале! Под ковром!', 'Shiny! Bring something shiny — I’ll tell where it all lies. In the cellar! Under the rug!'), ln('b2', 'emp', 'Она прячет находки — маленькие, блестящие. Взрослым не показывает.', 'She hides her finds — little, shiny ones. Never shows them to adults.')], [bye()], (w) => { learn(w, 'K8'); addTrust(w, 'pip', 1); }),
    cold: N([ln('c1', 'npc', 'Отстаньте.', 'Leave me alone.')], [bye()]),
    obey: N([ln('o1', 'npc', 'Ну ладно… (дуется)', 'Oh, fine… (sulks)')], [bye()], (w) => addTrust(w, 'pip', -1)),
    refuse: N([ln('r1', 'npc', 'Ты мне не мама!', 'You’re not my mom!')], [bye()]),
    alarm: N([ln('al', 'npc', 'Страшно! Не пойду! … Если за руку — пойду.', 'Scary! I won’t go! … If you hold my hand — I will.')], [
      ch('hand', '«Давай руку. Идём.»', '“Give me your hand. Let’s go.”', { to: 'go', fx: (w) => { const p = w.npcs.pip; if (dist2d(p.x, p.z, w.player.x, w.player.z) < 4) { w.player.escort = 'pip'; p.m.escort = true; p.task = null; p.m.fleeing = false; p.ph = 'escort'; emit(w, 'ESCORT_START', ['player', 'pip']); } } }),
      bye('Жди тут.', 'Wait here.'),
    ]),
    go: N([ln('g1', 'npc', 'Идём…', 'Okay…')], [bye()]),
  },
};

// ---------------- Зоя / Клара / животные ----------------
cur = 'zoya';
DIALOGS.zoya = {
  start: [{ node: 'hello' }],
  nodes: {
    hello: N([ln('h1', 'npc', 'Дождь смывает следы, но не слова. Присядь, дитя.', 'Rain washes away tracks, but not words. Sit, child.')], [
      ch('saw', '«Что вы видели?»', '“What did you see?”', { c: (w) => w.t >= TIMES.pipPick + 10, to: 'saw' }),
      ch('emp', '[Эмпатия] «Вы что-то знаете».', '[Empathy] “You know something.”', { check: ['emp', 5], to: 'hint', fail: 'cryptic' }),
      bye(),
    ]),
    saw: N([ln('s1', 'npc', 'У остановки девочка подобрала что-то блестящее. Скамья теперь пуста.', 'At the stop a girl picked up something shiny. The bench is empty now.')], [bye()], (w) => learn(w, 'K8')),
    hint: N([ln('hi', 'npc', 'Маленькая беда тянет большую. Особенно если никто не смотрит.', 'A small trouble drags a big one. Especially when no one watches.')], [bye()]),
    cryptic: N([ln('cr', 'npc', 'Звёзды за тучами. Но они там.', 'The stars are behind the clouds. But they are there.')], [bye()]),
  },
};
cur = 'klara';
DIALOGS.klara = {
  start: [{ node: 'hello' }],
  nodes: {
    hello: N([ln('h1', 'npc', 'Сцена не готова! Фонари должны зажечься в 22:00 — иначе праздник насмарку!', 'The stage isn’t ready! The lamps must light at 22:00 — or the festival is ruined!')], [
      ch('who', '«Кто зажигает фонари?»', '“Who lights the lamps?”', { to: 'who' }),
      bye(),
    ]),
    who: N([ln('w1', 'npc', 'Матвей! Обещал к десяти. Где он?! Он же в таверне чаи гоняет!', 'Matvey! Promised by ten. Where is he?! He’s drinking tea in the tavern!'), ln('w2', 'npc', 'А башню в 21:52 закрываю — церемония!', 'And I close the tower at 21:52 — the ceremony!')], [bye()]),
  },
};
cur = 'cat';
DIALOGS.cat = { start: [{ node: 'hello' }], nodes: { hello: N([ln('h', 'npc', 'Мррр. (Кочерга щурится на очаг.)', 'Mrrr. (Poker squints at the hearth.)')], [bye('Погладить.', 'Pet.')]) } };
cur = 'pug';
DIALOGS.pug = { start: [{ node: 'hello' }], nodes: { hello: N([ln('h', 'npc', 'Хр-р! Уф! (Пёс виляет хвостом.)', 'Snuf! Woof! (The pug wags its tail.)')], [bye('Погладить.', 'Pet.')]) } };
cur = 'fox';
DIALOGS.fox = { start: [{ node: 'hello' }], nodes: { hello: N([ln('h', 'npc', '(Лиса смотрит из тумана и исчезает.)', '(The fox watches from the fog and vanishes.)')], [bye('…', '…')]) } };

// ---------------- осмотры (эффекты в симуляции) ----------------
export const INSPECT: Record<string, DInspect> = {};
const I = (id: string, name: [string, string], descFn: (w: World) => [string, string, string], extra: Partial<DInspect> = {}) => {
  const nameK = T(`obj.${id}.name`, name[0], name[1]);
  INSPECT[id] = { name: nameK, desc: (w) => { const [k, ru, en] = descFn(w); T(`obj.${id}.${k}`, ru, en); return `obj.${id}.${k}`; }, ...extra };
};
const voice = (id: string, skill: Skill, dc: number, k: string, ru: string, en: string, c?: (w: World) => boolean) => ({ skill, dc, k: T(`obj.${id}.${k}`, ru, en), c });
I('ks1', ['Шкаф КШ-1', 'Cabinet KSh-1'], (w) => w.ks1Open ? ['open', 'Манометр, вентиль подачи и вентиль стравливания. Стрелка дрожит около единицы.', 'A pressure gauge, a supply valve and a bleed valve. The needle trembles near one.'] : ['closed', 'Железный шкаф с биркой «КШ-1». Заперт. Манометр под стеклом не виден.', 'An iron cabinet tagged “KSh-1”. Locked. The gauge behind glass cannot be read.'], {
  voices: [voice('ks1', 'tech', 6, 'tech', 'Подача — вверх, давление растёт. Стравливание — вниз, но медленно: примерно полбара за десять минут.', 'Supply — up, pressure rises. Bleed — down, but slowly: roughly half a bar per ten minutes.', (w) => w.ks1Open)],
  learn: (w) => (w.ks1Open ? ['K3'] : []),
});
I('kit_joint', ['Стык газовой трубы', 'Gas pipe joint'], (w) => w.gas.leakOn ? ['leak', 'Стык шипит, воздух над плитой тягучий и сладковатый. Рейтинг на бирке: 2.0 бар. Сеть давит сильнее!', 'The joint hisses, the air over the stove is thick and sweetish. The tag reads: rated 2.0 bar. The network is pushing harder!'] : ['quiet', 'Старый стык у плиты. Пока тих. Бирка стёрта.', 'The old joint by the stove. Quiet for now. The tag is worn.'], {
  voices: [voice('kit_joint', 'tech', 6, 'tech', 'Резьба старая, прокладка уплотнена смолой. Такое держит недолго.', 'Old thread, gasket sealed with pitch. It will not hold long.')],
  learn: (w) => (w.gas.leakOn ? ['K2'] : []),
});
I('tav_valve', ['Вентиль таверны', 'Tavern valve'], () => ['d', 'Труба вдоль стены уходит в стену кухни. Маховик с замком под вентильный ключ. Закрытие отсечёт таверну от сети.', 'A pipe runs along the wall into the kitchen. A handwheel with a lock for the valve key. Closing it cuts the tavern off the network.'], { learn: () => ['K9'] });
I('bureau_journal', ['Журнал причалов', 'Pier log'], () => ['d', 'Запись: «Нет сигнала к 21:42 — баржа Бориса швартуется у пристани и выгружает бочки на набережную».', 'Entry: “No signal by 21:42 — Boris’s barge moors at the quay and unloads barrels onto the embankment”.'], { learn: () => ['K10'] });
I('chest', ['Сундучок Пип', 'Pip’s little chest'], (w) => w.t >= TIMES.pipStash ? ['stash', 'В сундучке лежит чей-то проездной, стопка монет и блестящий ключик. Пип постаралась.', 'Inside lies someone’s pass, a stack of coins and a shiny little key. Pip has been busy.'] : ['toys', 'Пуговицы, ракушки, блестящий ключик. Пока ничего ценного.', 'Buttons, shells, a shiny little key. Nothing valuable yet.'], { learn: (w) => (w.t >= TIMES.pipStash ? ['K8'] : []) });
I('kiosk', ['Киоск «Билеты и Вестник»', 'Ticket & Herald kiosk'], () => ['d', 'Табличка: «Билет — 2 монеты. Киоск до 21:45».', 'A sign: “Ticket — 2 coins. Open until 21:45”.'], { learn: () => ['K7'] });
I('tilda_shelf', ['Полка с катушками', 'Spool shelf'], () => ['d', 'Рулоны ткани, нитки. Записка: «Праздничный флаг и баннеры — Орвену до сигнала. Трамвай 21:30».', 'Rolls of cloth, thread. A note: “Festival flag and banners — to Orven before the signal. Tram 21:30”.'], { learn: () => ['K6'] });
I('booth_hook', ['Крюк в будке', 'Booth hook'], (w) => (w.items.key.loc.k === 'node') ? ['key', 'На крюке висит вентильный ключ. Рядом журнал постов: «21:36 — чай».', 'The valve key hangs on the hook. Beside it the post log: “21:36 — tea”.'] : ['empty', 'Крюк пуст. В журнале постов: «21:36 — чай, ключ на крюк».', 'The hook is empty. The post log: “21:36 — tea, key on hook”.'], { learn: () => ['K4'] });
I('board', ['Доска «Вестник»', 'Herald board'], (w) => [w.newsId.replace('news.', 'n_'), '', ''] as [string, string, string], { learn: (w) => (w.fire.started ? ['K1'] : []) });
I('bench', ['Скамья на остановке', 'Stop bench'], (w) => (w.items.pass.loc.k === 'node' ? ['pass', 'На скамье лежит проездной на имя Тильды.', 'A pass in Tilda’s name lies on the bench.'] : ['empty', 'Мокрая скамья. Кто-то забыл здесь шнурок.', 'A wet bench. Someone forgot a lace here.']) as [string, string, string]);
