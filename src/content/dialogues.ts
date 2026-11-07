import type { ItemId } from '../sim/types';

// Диалоги по docs/02_DIALOGUES.md. Ветки давления знанием помечены ifKnow
// (иначе — ifItem / ifFlag) и показываются со значком ⟲ и временем знания.

export interface Choice {
  ru: string;
  en: string;
  goto?: string;
  ifKnow?: string;
  ifItem?: ItemId;
  ifFlag?: string;
  ifNot?: string;
  setKnow?: string;
  setFlag?: string;
  give?: ItemId;
  take?: ItemId;
  effect?: string;
  close?: boolean;
  end?: boolean;
}

export interface Node {
  id: string;
  who: string;      // npc id, 'tik', 'device', 'krayn'
  ru: string;
  en: string;
  next?: string;
  choices?: Choice[];
  effect?: string;
  end?: boolean;
  close?: boolean;
}

export interface Scene {
  id: string;
  start: string;
  nodes: Record<string, Node>;
}

const N = (id: string, who: string, ru: string, en: string, extra: Partial<Node> = {}): Node =>
  ({ id, who, ru, en, ...extra });

const C = (ru: string, en: string, extra: Partial<Choice> = {}): Choice => ({ ru, en, ...extra });

// --- пролог ---------------------------------------------------------------
const prologue: Scene = {
  id: 'prologue',
  start: 'l1',
  nodes: {
    l1: N('l1', 'lydia', 'Осторожно, тут провод. Вы Тимофей?', 'Careful, there’s a wire. Are you Timofey?', {
      choices: [
        C('Тик.', 'Tik.', { goto: 'l2' }),
        C('Смотря кто спрашивает.', 'Depends who’s asking.', { goto: 'l2' }),
      ],
    }),
    l2: N('l2', 'lydia', 'Лидия. Я собирала эту штуку. Держите. Нет, не так — циферблатом к себе.', 'Lydia. I built this thing. Take it. No, not like that — dial towards you.', { effect: 'give_device', next: 'l3' }),
    l3: N('l3', 'lydia', 'Видите колёсико? Отведите на три минуты назад. И нажмите.', 'See the wheel? Turn it back three minutes. And press.', {
      end: true, effect: 'tutorial_jump',
    }),
    l4: N('l4', 'lydia', 'Осторожно, тут провод. Вы Тимофей?', 'Careful, there’s a wire. Are you Timofey?', {
      choices: [
        C('Я это уже слышал.', 'I’ve heard this already.', { goto: 'l5' }),
        C('Ты это уже говорила.', 'You’ve said this already.', { goto: 'l5' }),
      ],
    }),
    l5: N('l5', 'lydia', 'Значит, работает. Для меня вы только что поднялись. Для вас — нет.', 'So it works. To me you just came up. To you — not.', { next: 'k1' }),
    k1: N('k1', 'krayn', 'Хватит, Лидия. Подойдите, Тимофей.', 'Enough, Lydia. Come here, Timofey.', { next: 'k2' }),
    k2: N('k2', 'krayn', 'Я Эвелина Крайн. Вы слышали это имя.', 'I am Evelina Krain. You’ve heard the name.', {
      choices: [
        C('Газ, приюты, попечительский совет.', 'Gas, shelters, the board of trustees.', { goto: 'k3' }),
        C('Слышал. Ничего хорошего.', 'Heard it. Nothing good.', { goto: 'k3' }),
        C('Нет.', 'No.', { goto: 'k3' }),
      ],
    }),
    k3: N('k3', 'krayn', 'У вас в руке час. С десяти до одиннадцати. Двигайтесь в нём куда хотите, сколько хотите.', 'You hold an hour in your hand. Ten to eleven. Move in it wherever and as often as you like.', {
      choices: [
        C('Как это работает?', 'How does it work?', { goto: 'k4' }),
        C('Сколько раз можно?', 'How many times can I?', { goto: 'k5' }),
        C('Что мне нужно сделать?', 'What do I have to do?', { goto: 'k8' }),
      ],
    }),
    k4: N('k4', 'lydia', 'Каждый раз, когда вы прыгаете, появляется ещё один мир. Тот, из которого вы ушли, живёт дальше. Без вас.', 'Every jump makes another world. The one you left keeps living. Without you.', { next: 'k6' }),
    k5: N('k5', 'lydia', 'Сколько угодно. Устройство не устаёт. Устаёт голова.', 'As many as you like. The device doesn’t tire. Your head does.', { next: 'k7' }),
    k6: N('k6', 'krayn', 'А я синхронизирую своё время с вашим. Когда час кончится, я выберу, какой из миров станет настоящим.', 'And I sync my time with yours. When the hour ends, I choose which world becomes real.', { next: 'k8' }),
    k7: N('k7', 'lydia', 'Чтобы удержать один час, нужно больше энергии, чем город тратит за год. Пятнадцать лет — невозможно. Даже сутки.', 'Holding one hour takes more energy than this city spends in a year. Fifteen years is impossible. Even a day.', { next: 'k8' }),
    k8: N('k8', 'krayn', 'Теперь главное. Если вас убьют — вас убьют. Здесь, по-настоящему. Мёртвые не нажимают кнопки.', 'Now the important part. If you’re killed, you’re killed. For real. Dead men don’t press buttons.', {
      choices: [C('Понял.', 'Understood.', { goto: 'k9' }), C('Утешили.', 'Comforting.', { goto: 'k9' })],
    }),
    k9: N('k9', 'krayn', 'Виктор Харроу. Вы знаете, кто это.', 'Viktor Harrow. You know who that is.', {
      choices: [
        C('Хозяин порта.', 'The harbour master.', { goto: 'k10' }),
        C('Человек, которого не находят.', 'A man nobody finds.', { goto: 'k10' }),
      ],
    }),
    k10: N('k10', 'krayn', 'У него шесть адресов, и ни по одному его нет. Сегодня между десятью и одиннадцатью Харроу будет на воде. Он нужен мне живым. На пирсе семь. До без десяти одиннадцать.', 'He has six addresses and is at none of them. Tonight, between ten and eleven, Harrow will be on the water. I need him alive. Pier seven. Before ten to eleven.', {
      choices: [
        C('Живым — дороже.', 'Alive costs more.', { goto: 'k11' }),
        C('Что он сделал?', 'What did he do?', { goto: 'k11' }),
        C('Почему я?', 'Why me?', { goto: 'k11' }),
      ],
    }),
    k11: N('k11', 'krayn', 'Начните с Орвена. Ключник порта, переулок Ключников. Он мне должен и знает, у кого какие ключи. Я буду писать, если будет нужно. Редко.', 'Start with Orven. The port keymaker, Keymakers alley. He owes me and knows who holds which keys. I’ll write if I must. Rarely.', { next: 'k12' }),
    k12: N('k12', 'lydia', 'Крутите колёсико плавно. Если в той минуте на вашем месте стена, оно не пустит. Удачи.', 'Turn the wheel gently. If there’s a wall where you stand in that minute, it won’t let you through. Good luck.', {
      end: true, effect: 'prologue_done',
    }),
  },
};

// --- Орвен ----------------------------------------------------------------
const orven: Scene = {
  id: 'orven',
  start: 'o1',
  nodes: {
    o1: N('o1', 'orven', 'Закрыто. Завтра.', 'Closed. Tomorrow.', {
      choices: [
        C('Я от Крайн.', 'I’m from Krain.', { goto: 'o2' }),
        C('Я подожду, пока откроешь.', 'I’ll wait till you open.', { goto: 'o2' }),
        C('Через три минуты тебя тут уже не будет. Поэтому сейчас.', 'In three minutes you won’t be here. So now.', { ifKnow: 'orvenLate', goto: 'o3' }),
      ],
    }),
    o2: N('o2', 'orven', '(замирает, не оборачиваясь) …Так и знал, что этим вечером кончится. Чего ей?', '(freezes) …Knew this evening would end it. What does she want?', { effect: 'meet_orven', next: 'o4' }),
    o3: N('o3', 'orven', '(оборачивается, смотрит долго) Ты кто такой?.. Ладно. Говори быстро, я замёрз.', '(turns, stares) Who are you?.. Fine. Talk fast, I’m freezing.', { effect: 'meet_orven', next: 'o4' }),
    o4: N('o4', 'tik', 'Мне нужен Харроу.', 'I need Harrow.', { next: 'o5' }),
    o5: N('o5', 'orven', 'Всем нужен. Харроу я не видел три года. Ключи его людей видел.', 'Everyone does. Haven’t seen Harrow in three years. Seen his people’s keys.', {
      choices: [
        C('Чьи ключи?', 'Whose keys?', { goto: 'o6' }),
        C('Кто сегодня приходил за ключами?', 'Who came for keys today?', { goto: 'o6' }),
      ],
    }),
    o6: N('o6', 'orven', 'Есть парень. Нед, курьер из конторы Гейла. Сегодня забрал у меня ключ — я точил на заказ. Должен был отнести хозяину ещё в восемь. А я видел, как он в девять шёл в «Якорь». С ключом.', 'There’s a lad. Ned, courier from Gale’s office. Picked up a key today — I cut it to order. Should’ve taken it to his boss by eight. Saw him heading to the Anchor at nine. With the key.', { next: 'o7' }),
    o7: N('o7', 'orven', 'Рыжий. Фуражка курьерская, с медной бляхой. Не перепутаешь. «Якорь» за мостом. Другого моста нет, северный разобрали.', 'Red-haired. Courier cap with a brass badge. You won’t mix him up. The Anchor is across the bridge. There’s no other bridge, the north one’s torn up.', { effect: 'orven_done', next: 'o8' }),
    o8: N('o8', 'orven', 'Передай ей: с меня хватит. Это последнее.', 'Tell her: I’m done. This is the last one.', {
      choices: [C('Передам.', 'I’ll tell her.', { goto: 'o9' }), C('Сам передашь.', 'Tell her yourself.', { goto: 'o9' })],
    }),
    o9: N('o9', 'tik', 'Если увижу Неда — что ему сказать?', 'If I see Ned — what do I say?', { end: true, effect: 'orven_leave' }),
  },
};

const orvenKey: Scene = {
  id: 'orven_key',
  start: 'ok1',
  nodes: {
    ok1: N('ok1', 'orven', 'Опять ты? Мы же… (замечает ключ) Откуда у тебя это?', 'You again? We… (notices the key) Where did you get that?', {
      choices: [
        C('Чей ключ?', 'Whose key is it?', { goto: 'ok2' }),
        C('Нед проиграл его в кости. Твой ключ сейчас у людей Корда.', 'Ned lost it at dice. Your key is with Kord’s men now.', { ifKnow: 'ned', goto: 'ok3' }),
      ],
    }),
    ok2: N('ok2', 'orven', '(берёт, вертит, отдаёт) Моя бородка. Четыре зуба, косой срез. Сейф Гейла. Курьерская контора при складе.', '(takes it, turns it, gives it back) My bit. Four teeth, angled cut. Gale’s safe. The courier office by the warehouse.', { effect: 'safe_known', next: 'ok4' }),
    ok3: N('ok3', 'orven', '(бледнеет) Корд… Это сейф Гейла. Курьерская контора. Господи, что там лежит такого…', '(pales) Kord… It’s Gale’s safe. The courier office. God, what’s in there…', { effect: 'safe_known', next: 'ok4' }),
    ok4: N('ok4', 'tik', 'Что лежит?', 'What’s in there?', { next: 'ok5' }),
    ok5: N('ok5', 'orven', 'Я ключи точу. Я внутрь не смотрю. Иди уже.', 'I cut keys. I don’t look inside. Go now.', { close: true }),
  },
};

// --- Тильда ---------------------------------------------------------------
const tilda: Scene = {
  id: 'tilda',
  start: 't1',
  nodes: {
    t1: N('t1', 'tilda', 'Простите… Простите. Вы девочку не видели? Восемь лет. Коса, вот такая лента. (показывает красную ленту) Анка.', 'Sorry… Sorry. Have you seen a girl? Eight years old. A braid, a ribbon like this. (shows a red ribbon) Anka.', {
      choices: [
        C('Нет. Извини.', 'No. Sorry.', { goto: 't2' }),
        C('Где ты её потеряла?', 'Where did you lose her?', { goto: 't3' }),
        C('(Пройти мимо)', '(Walk past)', { goto: 't2' }),
      ],
    }),
    t2: N('t2', 'tilda', 'Я прачка, Тильда, с Канатной! Если увидите — скажите ей, мама ищет!', 'I’m Tilda the laundress, from Ropemakers street! If you see her — tell her her mother is looking!', { effect: 'tilda_seen', end: true }),
    t3: N('t3', 'tilda', 'Я её не теряла. Я её отдала. В приют, на Лукию, на зиму. Работы не было, топить нечем. Сегодня пришла забрать — а мне говорят: переведена. Куда? В школу. В какую? Не ваше дело, мамаша.', 'I didn’t lose her. I gave her away. To the shelter, St Lucia, for the winter. No work, nothing to burn. Today I came to take her back — they say she’s been transferred. Where? To a school. Which one? Not your business, mother.', {
      choices: [
        C('Может, правда в школу.', 'Maybe it really is a school.', { goto: 't4' }),
        C('Кто сказал «переведена»?', 'Who said “transferred”?', { goto: 't4' }),
      ],
    }),
    t4: N('t4', 'tilda', 'В школу ночью не возят. А на пристани говорят: детей грузят на баржу. К Лукьяну, на «Веру». Он ещё летом двоих возил, из Слободки.', 'They don’t take children to school at night. At the pier they say children are loaded onto a barge. To Lukyan, on the Vera. He took two from Slobodka in the summer.', { next: 't5' }),
    t5: N('t5', 'tik', 'И что ты будешь делать?', 'And what will you do?', { next: 't6' }),
    t6: N('t6', 'tilda', '(поправляет шаль, под ней что-то тяжёлое) Пойду спрошу Лукьяна.', '(adjusts her shawl, something heavy under it) I’ll go and ask Lukyan.', {
      choices: [
        C('Не ходи одна.', 'Don’t go alone.', { goto: 't7' }),
        C('Удачи.', 'Good luck.', { goto: 't7' }),
      ],
    }),
    t7: N('t7', 'tilda', 'А с кем мне? (уходит)', 'And with whom? (leaves)', { effect: 'tilda_done', end: true }),
  },
};

// --- Нед ------------------------------------------------------------------
const ned: Scene = {
  id: 'ned',
  start: 'n1',
  nodes: {
    n1: N('n1', 'ned', '(не оборачиваясь) Иди, куда шёл.', '(without turning) Go where you were going.', {
      choices: [
        C('Ты Нед?', 'Are you Ned?', { goto: 'n2' }),
        C('Высоко тут.', 'It’s high here.', { goto: 'n2' }),
        C('(Встать рядом и молчать)', '(Stand beside him in silence)', { goto: 'n2' }),
      ],
    }),
    n2: N('n2', 'ned', '(резко оборачивается) Кто спрашивает? От Гейла? Скажи ему… ничего не говори.', '(turns sharply) Who’s asking? From Gale? Tell him… don’t tell him anything.', { effect: 'meet_ned', next: 'n3' }),
    n3: N('n3', 'tik', 'Мне сказали, у тебя ключ.', 'They told me you have a key.', { next: 'n4' }),
    n4: N('n4', 'ned', '(смеётся плохо) Был ключ. Всё было. Выручка конторы за неделю, часы отцовские, жетон. Ключ хозяйский. Всё на столе в «Якоре».', '(laughs badly) Had a key. Had everything. A week’s takings, my father’s watch, the courier tag. The master’s key. All on the table at the Anchor.', {
      choices: [
        C('Проиграл?', 'Lost it?', { goto: 'n5' }),
        C('Кому?', 'To whom?', { goto: 'n5' }),
        C('Зачем садился?', 'Why sit down at all?', { goto: 'n5' }),
      ],
    }),
    n5: N('n5', 'ned', 'Нет, подарил. Конечно проиграл. В кости. Людям Корда. Восемь человек. Сидят с вечера, как будто ждут чего-то.', 'No, I gave it away. Of course I lost it. At dice. To Kord’s men. Eight of them. Sitting since evening like they’re waiting for something.', { next: 'n6' }),
    n6: N('n6', 'ned', 'Утром Гейл откроет кассу. Потом откроет рот. А у меня мать.', 'In the morning Gale opens the till. Then he opens his mouth. And I have a mother.', { next: 'n7' }),
    n7: N('n7', 'ned', 'Без ствола туда не ходи. У Фомы, на Рыночной, под прилавком — все знают. Он закладные стволы не сдаёт.', 'Don’t go there without a gun. Foma on Market street, under the counter — everyone knows. He doesn’t hand over pawned guns.', { effect: 'ned_talked', next: 'n8' }),
    n8: N('n8', 'ned', 'Прыгну — мать завтра одна будет. С долгом.', 'If I jump, my mother will be alone tomorrow. With the debt.', {
      choices: [
        C('Выручку можно вернуть.', 'The takings can be returned.', { goto: 'n9' }),
        C('Склад сгорел. Утром никто не будет считать твою выручку.', 'The warehouse burned. In the morning nobody will count your takings.', { ifKnow: 'explosion' }),
        C('Прыгнешь — мать завтра будет одна. С долгом.', 'Jump and your mother is alone tomorrow. With the debt.', { goto: 'n10' }),
        C('Не моё дело. Где ключ?', 'Not my business. Where’s the key?', { goto: 'n11' }),
      ],
    }),
    n9: N('n9', 'ned', 'Как? Ты пойдёшь к восьмерым и попросишь?.. По глазам вижу, что пойдёшь.', 'How? You’ll go to eight men and ask?.. I can see you will.', { effect: 'ned_saved', end: true }),
    n10: N('n10', 'ned', '(долго смотрит на воду) …Ладно. Ладно. (садится на мокрые камни)', '(stares at the water a long time) …Fine. Fine. (sits on the wet stones)', { effect: 'ned_saved', end: true }),
    n11: N('n11', 'ned', 'У Игната. Старший у них. Жилет, без шляпы.', 'Ignat. Their senior. Waistcoat, no hat.', { effect: 'ned_gone', end: true }),
  },
};

// --- Фома -----------------------------------------------------------------
const foma: Scene = {
  id: 'foma',
  start: 'f1',
  nodes: {
    f1: N('f1', 'foma', '(из-за двери) Закрыто!', '(from behind the door) Closed!', {
      choices: [
        C('Мне ствол нужен.', 'I need a gun.', { goto: 'f2' }),
        C('Я от Неда.', 'I’m from Ned.', { goto: 'f2' }),
        C('Через несколько минут здесь всё сгорит. Открой.', 'In a few minutes this whole place burns. Open up.', { ifKnow: 'fomaFire', goto: 'f3' }),
      ],
    }),
    f2: N('f2', 'foma', 'Мне тоже много чего нужно. Иди.', 'I need a lot of things too. Go away.', { end: true, effect: 'foma_refused' }),
    f3: N('f3', 'foma', '(пауза) Ты пьяный? Иди отсюда, пока я полицию… (смешок) Полиции нет. Ну и иди.', '(pause) Are you drunk? Get out before I call the police… (laughs) There’s no police. Just go.', { close: true }),
  },
};

const fomaRuin: Scene = {
  id: 'foma_ruin',
  start: 'fr1',
  nodes: {
    fr1: N('fr1', 'foma', 'Тридцать лет. Тридцать лет в долг давал, а сам ни у кого не брал.', 'Thirty years. Thirty years lending, never borrowing from anyone.', {
      choices: [C('Сочувствую.', 'I’m sorry.', { goto: 'fr2' }), C('Ствол у тебя был.', 'You had a gun.', { goto: 'fr2' })],
    }),
    fr2: N('fr2', 'foma', 'Был. Под половицей. (машет рукой на огонь) Теперь там — бери, если достанешь.', 'There was. Under the floorboard. (waves at the fire) Now it’s there — take it, if you can reach it.', { effect: 'foma_hint', end: true }),
  },
};

// --- Гейл -----------------------------------------------------------------
const galeWounded: Scene = {
  id: 'gale_wounded',
  start: 'gw1',
  nodes: {
    gw1: N('gw1', 'gale', '(видит Тика) Не… не трогай. Больно.', '(sees Tik) Don’t… don’t touch me. It hurts.', {
      choices: [
        C('Кто тебя?', 'Who did this?', { goto: 'gw2' }),
        C('Где сейф?', 'Where’s the safe?', { goto: 'gw3' }),
        C('Держись. Я помогу.', 'Hold on. I’ll help.', { goto: 'gw4' }),
      ],
    }),
    gw2: N('gw2', 'gale', 'Вошёл по жетону… Жетон Неда… Я думал — Нед. Шрам у него. Через лицо.', 'Came in with a tag… Ned’s tag… I thought it was Ned. The scar. Across his face.', { next: 'gw4' }),
    gw3: N('gw3', 'gale', '(смеётся, кашляет) Сейф… Нет сейфа. Взорвал. Всё горит.', '(laughs, coughs) Safe… No safe. Blew it. Everything’s burning.', { next: 'gw4' }),
    gw4: N('gw4', 'gale', '(хватает за рукав) Анна. Жена. Сестрой в приюте на Лукии. Скажи ей — пусть уходит. Сегодня. Прямо сейчас. За ней придут, как за мной.', '(grabs your sleeve) Anna. My wife. A sister at St Lucia. Tell her to leave. Today. Right now. They’ll come for her like they came for me.', {
      next: 'gw5',
    }),
    gw5: N('gw5', 'gale', '(снимает кольцо, кладёт в ладонь) Отдай. Она поймёт, что от меня.', '(takes off his ring, puts it in your palm) Give her this. She’ll know it’s from me.', { effect: 'gale_ring', end: true }),
  },
};

const galeHealthy: Scene = {
  id: 'gale_healthy',
  start: 'gh1',
  nodes: {
    gh1: N('gh1', 'gale', 'Контора закрыта. Курьеров по жетонам.', 'The office is closed. Couriers by tag only.', {
      choices: [
        C('У меня к тебе дело.', 'I have business with you.', { goto: 'gh2' }),
        C('Анна. Сестра в приюте на Лукии. Твоя жена.', 'Anna. A sister at St Lucia. Your wife.', { ifKnow: 'anna', goto: 'gh3' }),
        C('Через семь минут тут всё взлетит.', 'In seven minutes this place blows up.', { ifKnow: 'explosion', goto: 'gh3' }),
      ],
    }),
    gh2: N('gh2', 'gale', 'Дела днём. (закрывает окошко)', 'Business in the daytime. (closes the window)', { close: true }),
    gh3: N('gh3', 'gale', '(окошко застыло на полпути) …Откуда ты знаешь мою жену?', '(the window stops halfway) …How do you know my wife?', { next: 'gh4' }),
    gh4: N('gh4', 'gale', 'Чего ты хочешь?', 'What do you want?', {
      choices: [
        C('Открой сейф.', 'Open the safe.', { goto: 'gh5' }),
        C('Мне нужен Харроу.', 'I need Harrow.', { goto: 'gh5' }),
        C('Уходи отсюда. Сейчас.', 'Get out of here. Now.', { goto: 'gh6' }),
      ],
    }),
    gh5: N('gh5', 'gale', '(стоит у сейфа, не открывает) Если я открою — меня убьют. …Бери. Мне это никогда не было нужно.', '(stands at the safe, doesn’t open it) If I open it, they’ll kill me. …Take it. I never needed it.', { effect: 'open_safe', end: true }),
    gh6: N('gh6', 'gale', '(снимает пальто с крюка) А курьеры? У меня двое в подвале спят. …Ладно. Иди к Анне, скажи — я иду.', '(takes his coat off the hook) And the couriers? I have two asleep downstairs. …Fine. Go to Anna, tell her I’m coming.', { effect: 'anna_warned_gale', end: true }),
  },
};

// --- Приют ----------------------------------------------------------------
const agnia: Scene = {
  id: 'agnia',
  start: 'a1',
  nodes: {
    a1: N('a1', 'agnia', '(поднимает голову от книги, щурится) Кто?.. (встаёт медленно) Тимоша? Тимофей?', '(lifts her head from the book, squints) Who?.. (rises slowly) Timosha? Timofey?', {
      choices: [
        C('Здравствуйте, матушка.', 'Hello, mother.', { goto: 'a2' }),
        C('Узнали.', 'You recognised me.', { goto: 'a2' }),
        C('Не надо так меня звать.', 'Don’t call me that.', { goto: 'a2' }),
      ],
    }),
    a2: N('a2', 'agnia', 'Зачем пришёл? Ночью.', 'Why did you come? At night.', {
      choices: [
        C('Куда везут детей?', 'Where are the children being taken?', { goto: 'a3' }),
        C('Кто велел?', 'Who ordered it?', { goto: 'a4' }),
        C('Пирс семь. Баржа «Вера». Это не школа.', 'Pier seven. The barge Vera. That’s not a school.', { ifItem: 'list', goto: 'a5' }),
      ],
    }),
    a3: N('a3', 'agnia', 'В монастырскую школу. В Ольховку. Им там будет лучше, у нас печи не топлены.', 'To the monastery school. In Olkhovka. They’ll be better there, our stoves are cold.', { next: 'a6' }),
    a4: N('a4', 'agnia', 'Госпожа Крайн. Попечительский совет. У нас всё по бумагам.', 'Madame Krain. The board of trustees. Everything is on paper here.', { next: 'a6' }),
    a5: N('a5', 'agnia', '(смотрит на лист долго) Не знаю я никакой «Веры». Мне сказали — школа. Мне двадцать лет говорят — школа.', '(looks at the paper a long time) I don’t know any Vera. They told me school. For twenty years they’ve told me school.', { effect: 'agnia_book', next: 'a6' }),
    a6: N('a6', 'tik', 'Двадцать лет?', 'Twenty years?', { next: 'a7' }),
    a7: N('a7', 'agnia', '(молчит, потом гладит книгу) Иди, Тимоша. Не надо тебе этого.', '(silent, then strokes the book) Go, Timosha. You don’t need this.', {
      choices: [
        C('Покажите книгу.', 'Show me the book.', { goto: 'a8' }),
        C('(Взять книгу самому)', '(Take the book myself)', { goto: 'a8' }),
        C('Я уйду. С детьми.', 'I’m leaving. With the children.', { goto: 'a9' }),
      ],
    }),
    a8: N('a8', 'agnia', '(отодвигает книгу к нему) Смотри. Я всё равно не смогла бы прочесть тебе вслух.', '(pushes the book toward you) Look. I couldn’t have read it aloud anyway.', { effect: 'book_seen', next: 'a10' }),
    a9: N('a9', 'agnia', 'С тремя стволами во дворе? (качает головой) Не дури.', 'With three guns in the yard? (shakes her head) Don’t be a fool.', { close: true }),
    a10: N('a10', 'agnia', 'Ты сбежал за два дня. Я тогда думала — к лучшему.', 'You ran two days later. I thought then it was for the best.', { close: true }),
  },
};

const anna: Scene = {
  id: 'anna',
  start: 'an1',
  nodes: {
    an1: N('an1', 'anna', '(встаёт между Тиком и кроватями) Вы кто? Сюда нельзя.', '(stands between you and the beds) Who are you? You can’t come in here.', {
      choices: [
        C('(Протянуть кольцо) От Гейла.', '(Hold out the ring) From Gale.', { ifItem: 'ring', goto: 'an2' }),
        C('Гейл просил передать — уходи.', 'Gale asked me to say — leave.', { goto: 'an2' }),
        C('Склад взорвали. Гейл ранен.', 'The warehouse was blown up. Gale is wounded.', { ifKnow: 'explosion', goto: 'an3' }),
      ],
    }),
    an2: N('an2', 'anna', '(берёт кольцо двумя руками) Где он? Он живой?', '(takes the ring in both hands) Where is he? Is he alive?', { effect: 'anna_met', next: 'an4' }),
    an3: N('an3', 'anna', '(садится на край кровати) Я ему говорила. Я ему говорила.', '(sits on the edge of a bed) I told him. I told him.', { effect: 'anna_met', next: 'an4' }),
    an4: N('an4', 'anna', 'Он показывал мне бумаги. Я сказала: это не школа. Он сказал: молчи, Анна, это не наше. (смотрит на детей) Они одеты. Им сказали — поедут к морю.', 'He showed me the papers. I said: that’s not a school. He said: be quiet, Anna, it’s not ours. (looks at the children) They’re dressed. They were told they’re going to the sea.', {
      choices: [
        C('Выведи их. Сейчас. Через прачечную.', 'Get them out. Now. Through the laundry.', { goto: 'an5' }),
        C('Сколько охраны?', 'How many guards?', { goto: 'an6' }),
      ],
    }),
    an5: N('an5', 'anna', 'Четырнадцать. Через окно. Ночью. В дождь. (пауза) …Задняя калитка. Если двор будет пустой хоть минуту.', 'Fourteen. Through the window. At night. In the rain. (pause) …The back gate. If the yard is empty for even a minute.', { effect: 'anna_warned', end: true }),
    an6: N('an6', 'anna', 'Трое и возница. Курят за воротами, когда матушка не видит. Минуту, не больше.', 'Three and a driver. They smoke outside the gate when mother isn’t looking. A minute, no more.', { effect: 'anna_guard_count', end: true }),
  },
};

const anka: Scene = {
  id: 'anka',
  start: 'ak1',
  nodes: {
    ak1: N('ak1', 'anka', '(смотрит снизу) Вы с мамой знакомы?', '(looks up) Do you know my mother?', {
      choices: [
        C('Знаком. Её зовут Тильда.', 'I do. Her name is Tilda.', { goto: 'ak2' }),
        C('Нет.', 'No.', { goto: 'ak3' }),
      ],
    }),
    ak2: N('ak2', 'anka', '(улыбается) Она меня заберёт? Тут сказали — к морю.', '(smiles) Will she come for me? They said we’re going to the sea.', {
      choices: [
        C('Заберёт.', 'She will.', { goto: 'ak4' }),
        C('Не знаю.', 'I don’t know.', { goto: 'ak4' }),
      ],
    }),
    ak3: N('ak3', 'anka', 'А. (отворачивается к повозке)', 'Oh. (turns back to the wagon)', { close: true }),
    ak4: N('ak4', 'anka', '(снимает ленту с косы) Передайте ей. Чтобы не волновалась.', '(takes the ribbon off her braid) Give her this. So she won’t worry.', { effect: 'anka_ribbon', end: true }),
  },
};

const guardWagon: Scene = {
  id: 'guard_wagon',
  start: 'g1',
  nodes: {
    g1: N('g1', 'guard1', 'Отойди от повозки.', 'Step away from the wagon.', {
      choices: [
        C('Куда везёте?', 'Where are you taking them?', { goto: 'g2' }),
        C('Чьи вы люди?', 'Whose people are you?', { goto: 'g3' }),
        C('(Отойти)', '(Step away)', { close: true }),
      ],
    }),
    g2: N('g2', 'guard1', 'В школу. Отойди.', 'To school. Step away.', { close: true }),
    g3: N('g3', 'guard1', '(показывает бумагу с печатью совета) Видишь печать? Вот чьи. Отойди.', '(shows a paper with the board seal) See the seal? That’s whose. Step away.', { effect: 'guard_tag', end: true }),
  },
};

// --- Пирс 7 ---------------------------------------------------------------
const lukyan: Scene = {
  id: 'lukyan',
  start: 'lu1',
  nodes: {
    lu1: N('lu1', 'lukyan', 'Чего надо? Баржа не возит.', 'What do you want? The barge isn’t carrying.', {
      choices: [
        C('Кого ты сегодня ждёшь?', 'Who are you waiting for tonight?', { goto: 'lu2' }),
        C('Через несколько минут тебе выстрелят в живот. Прачка. Из мужниного револьвера.', 'In a few minutes you get a bullet in the gut. The laundress. Her husband’s revolver.', { ifKnow: 'tildaGun', goto: 'lu3' }),
        C('(Показать лист)', '(Show the paper)', { ifItem: 'list', goto: 'lu4' }),
      ],
    }),
    lu2: N('lu2', 'lukyan', 'Груз. Как всегда.', 'Cargo. As always.', { next: 'lu5' }),
    lu3: N('lu3', 'lukyan', '(оглядывается на пирс) …Чего ты мелешь.', '(glances at the pier) …What are you babbling.', { next: 'lu5' }),
    lu4: N('lu4', 'lukyan', '(читает, сплёвывает) Ну, лист. Мне такой каждый месяц дают.', '(reads, spits) So it’s a paper. They give me one every month.', { next: 'lu5' }),
    lu5: N('lu5', 'tik', 'Кто платит?', 'Who pays?', { next: 'lu6' }),
    lu6: N('lu6', 'lukyan', 'Человек от приюта. Конверт с печатью совета. Деньги — новые, банковские. Я в трюм не смотрю. Мне за это и платят.', 'A man from the shelter. An envelope with the board’s seal. The money is new, bank money. I don’t look in the hold. That’s what I’m paid for.', { effect: 'lukyan_talked', end: true }),
  },
};

const tildaPier: Scene = {
  id: 'tilda_pier',
  start: 'tp1',
  nodes: {
    tp1: N('tp1', 'tilda', '(узнаёт) Вы… из переулка. Вы её видели?', '(recognises you) You… from the alley. Did you see her?', {
      choices: [
        C('(Протянуть ленту)', '(Hold out the ribbon)', { ifItem: 'ribbon', goto: 'tp2' }),
        C('Видел. Она в приюте.', 'I saw her. She’s at the shelter.', { goto: 'tp3' }),
        C('Не ходи к барже.', 'Don’t go to the barge.', { goto: 'tp3' }),
      ],
    }),
    tp2: N('tp2', 'tilda', '(берёт ленту, прижимает к лицу) Это её. Это её лента. Где?', '(takes the ribbon, presses it to her face) It’s hers. It’s her ribbon. Where?', { next: 'tp3' }),
    tp3: N('tp3', 'tik', 'В приюте. До двадцати двух сорока. Потом её посадят в повозку. Сюда.', 'At the shelter. Until twenty to eleven. Then they put her in a wagon. Here.', { next: 'tp4' }),
    tp4: N('tp4', 'tilda', '(смотрит на баржу, на Тика) …Почему ты мне помогаешь?', '(looks at the barge, then at you) …Why are you helping me?', {
      choices: [
        C('Я там вырос.', 'I grew up there.', { goto: 'tp5' }),
        C('Иди. Время.', 'Go. There’s no time.', { goto: 'tp5' }),
      ],
    }),
    tp5: N('tp5', 'tilda', '(кивает) Задняя калитка. У прачечной. Я знаю, я там стирала. (уходит быстро)', '(nods) The back gate. By the laundry. I know it, I washed there. (leaves fast)', { effect: 'tilda_warned', end: true }),
  },
};

// --- Тихон ----------------------------------------------------------------
const tikhon: Scene = {
  id: 'tikhon',
  start: 'ti1',
  nodes: {
    ti1: N('ti1', 'tikhon', '(за дверью) Кто?', '(behind the door) Who is it?', {
      choices: [
        C('Я от Гейла.', 'I’m from Gale.', { goto: 'ti2' }),
        C('Открой. Поговорить.', 'Open up. We need to talk.', { goto: 'ti2' }),
        C('Про Яна.', 'About Jan.', { ifKnow: 'jan', goto: 'ti3' }),
      ],
    }),
    ti2: N('ti2', 'tikhon', '(открывает на цепочку) От Гейла? Ключ я забрал уже. Чего ещё?', '(opens on the chain) From Gale? I already picked up the key. What else?', { next: 'ti4' }),
    ti3: N('ti3', 'tikhon', '(открывает) Тише. Ребёнок спит. Что с Яном?', '(opens) Quiet. The child is asleep. What about Jan?', { next: 'ti4' }),
    ti4: N('ti4', 'tikhon', '(шёпотом, оглядываясь на кровать) Говори.', '(whispering, glancing at the bed) Talk.', {
      choices: [
        C('Яна убили на пристани. Как только катер встал.', 'Jan was killed at the pier. As soon as the launch docked.', { ifKnow: 'jan', goto: 'ti5' }),
        C('В списке у Гейла: «Ян — списать». «Тихон — после рейса списать».', 'On Gale’s list: “Jan — write off”. “Tikhon — write off after the run”.', { ifItem: 'list', goto: 'ti5' }),
        C('Мне нужна твоя кепка и твой ключ.', 'I need your cap and your key.', { goto: 'ti6' }),
      ],
    }),
    ti5: N('ti5', 'tikhon', '(садится на табурет) Не может… Ян двадцать лет у них. Двадцать лет… «После рейса». (смотрит на Пип)', '(sits on a stool) Can’t be… Jan’s been with them twenty years. Twenty years… “After the run.” (looks at Pip)', { next: 'ti6' }),
    ti6: N('ti6', 'tikhon', 'А ещё что? Жену? Иди отсюда.', 'What else? My wife? Get out.', {
      choices: [
        C('Не ходи сегодня. Останься с ней. Я пойду вместо тебя.', 'Don’t go tonight. Stay with her. I’ll go instead.', { goto: 'ti7' }),
        C('Отдай кепку и ключ. И уходи с ней из города до утра.', 'Give me the cap and key. Take her out of town before morning.', { goto: 'ti8' }),
        C('Кепку. Ключ. Молча.', 'The cap. The key. Quietly.', { ifFlag: 'weapon', goto: 'ti9' }),
      ],
    }),
    ti7: N('ti7', 'tikhon', 'А ты кто ей такой, чтобы за неё умирать?', 'And who are you to her, to die for her?', {
      choices: [
        C('Никто. Я из Лукии. Как она будет, если ты не вернёшься.', 'Nobody. I’m from Lucia. What happens to her if you don’t come back?', { goto: 'ti10' }),
        C('Мне за это платят.', 'I’m paid for this.', { goto: 'ti10' }),
      ],
    }),
    ti10: N('ti10', 'tikhon', '(долго смотрит) …Охрана меня не знает в лицо. Кепку вперёд надвинь. Бушлат бери. Ключ — вот. Двигатель любит, чтобы газ плавно. Если спросят — нет пароля. Спрашивают «Ты Тихон?». Скажи «Я». И не смотри им в лицо.', '(stares a long time) …The guards don’t know my face. Pull the cap down. Take the coat. Here’s the key. The engine likes a gentle throttle. If they ask — there’s no password. They ask “Are you Tikhon?” Say “I am.” And don’t look at their faces.', { effect: 'tikhon_turned', end: true }),
    ti8: N('ti8', 'tikhon', 'Из города — куда? С ребёнком, ночью. К сестре в Ольшаны. (отдаёт кепку и ключ)', 'Out of town — where? With a child, at night. To my sister in Olshany. (hands over the cap and key)', { effect: 'tikhon_turned', end: true }),
    ti9: N('ti9', 'tikhon', '(отдаёт) Ты их не обманешь. Они тебя убьют, и меня потом.', '(hands them over) You won’t fool them. They’ll kill you, and then me.', { effect: 'tikhon_threatened', end: true }),
  },
};

// --- Ферн / Лидия / Штерн ------------------------------------------------
const fern: Scene = {
  id: 'fern',
  start: 'f1',
  nodes: {
    f1: N('f1', 'fern', '(держит фонарь, смотрит на башню) Ты слышишь?', '(holds a lantern, looks at the tower) Do you hear it?', {
      choices: [C('Что?', 'What?', { goto: 'f2' }), C('Ничего не слышу.', 'I hear nothing.', { goto: 'f2' })],
    }),
    f2: N('f2', 'fern', 'Вот и я ничего. Половина одиннадцатого — а колокол молчит. Сорок лет не молчал. Механизм от сети. Сеть пустая. Как будто кто-то пьёт ток.', 'Neither do I. Half past ten and the bell is silent. Silent for the first time in forty years. The mechanism runs on the grid. The grid is empty. Like someone’s drinking the current.', { effect: 'fern_talked', end: true }),
  },
};

const lydia: Scene = {
  id: 'lydia',
  start: 'l1',
  nodes: {
    l1: N('l1', 'lydia', '(не поднимает голову) Работает?', '(without looking up) Does it work?', {
      choices: [
        C('Работает.', 'It works.', { goto: 'l2' }),
        C('Что ты сделала?', 'What have you done?', { goto: 'l2' }),
      ],
    }),
    l2: N('l2', 'lydia', 'Мне принесли записку. С печатью совета. «Впустить техника в 21:55. После — брат дома». Миша в приюте, ему девять. Я его туда отдала, когда мама умерла.', 'They brought me a note. With the board’s seal. “Let the technician in at 21:55. After that, your brother comes home.” Misha is at the shelter, he’s nine. I gave him up when mother died.', { effect: 'lydia_talked', next: 'l3' }),
    l3: N('l3', 'lydia', 'Предохранитель. Красный. В коробке слева. Если выдернуть, пока он не ушёл… Нет. Уже поздно. Для этого мира — поздно.', 'The fuse. Red. In the box on the left. If you pull it before he leaves… No. Too late. For this world — too late.', { effect: 'tap_known', end: true }),
  },
};

const stern: Scene = {
  id: 'stern',
  start: 's1',
  nodes: {
    s1: N('s1', 'stern', '(не оборачиваясь, крутит клемму) Свет не загораживай.', '(without turning, turning a terminal) Don’t block the light.', {
      choices: [
        C('Кто ты?', 'Who are you?', { goto: 's2' }),
        C('(Выдернуть предохранитель)', '(Pull the fuse)', { goto: 's3' }),
        C('(Поднять револьвер)', '(Raise the revolver)', { ifFlag: 'weapon', goto: 's4' }),
      ],
    }),
    s2: N('s2', 'stern', 'Подстанция. Плановые работы.', 'The substation. Scheduled work.', { close: true }),
    s3: N('s3', 'stern', '(хватает за руку) Ты что делаешь?! …Ладно. Ладно. Мне заплатили, я сделал. Кто — не знаю. Конверт. Печать. (пятится к двери)', '(grabs your hand) What are you doing?! …Fine. Fine. I was paid, I did it. Who — I don’t know. An envelope. A seal. (backs to the door)', { effect: 'tap_cut', end: true }),
    s4: N('s4', 'stern', '(медленно поднимает руки) Ладно. Ладно. Конверт. Печать. (пятится к двери)', '(slowly raises his hands) Fine. Fine. An envelope. A seal. (backs to the door)', { effect: 'tap_cut', end: true }),
  },
};

// --- Пристань и финал -----------------------------------------------------
const pier3Guard: Scene = {
  id: 'pier3_guard',
  start: 'p1',
  nodes: {
    p1: N('p1', 'guard1', 'Ты Тихон?', 'Are you Tikhon?', {
      choices: [
        C('Я.', 'I am.', { goto: 'p2' }),
        C('Тихон заболел. Я вместо.', 'Tikhon is sick. I’m taking his shift.', { goto: 'p3' }),
        C('(Молча кивнуть)', '(Nod silently)', { goto: 'p2' }),
      ],
    }),
    p2: N('p2', 'guard1', 'Ключ есть? Заводи. Хозяин не любит ждать.', 'You have the key? Start her up. The master hates waiting.', { effect: 'board_boat', end: true }),
    p3: N('p3', 'guard1', '(рука к кобуре) Вместо кого? Нам вместо не говорили.', '(hand to holster) Instead of who? Nobody told us about a replacement.', {
      choices: [
        C('(Показать список) Гейл прислал. Вот список.', '(Show the list) Gale sent me. Here’s the list.', { ifItem: 'list', goto: 'p4' }),
        C('(Отступить)', '(Back away)', { close: true }),
      ],
    }),
    p4: N('p4', 'guard1', '(читает при фонаре) …Ладно. Заводи. Но я рядом сяду.', '(reads by the lantern) …Fine. Start her. But I’m sitting right by you.', { effect: 'board_boat_guard', end: true }),
  },
};

const finale: Scene = {
  id: 'finale',
  start: 'h1',
  nodes: {
    h1: N('h1', 'krayn', 'СИНХРОНИЗАЦИЯ УДЕРЖАНА', 'SYNCHRONISATION HELD', { effect: 'sync_locked', next: 'h2' }),
    h2: N('h2', 'harrow', '(смотрит на огни, не на Тика) Мы не к Маяку идём.', '(watching the lights, not you) We’re not going to the Lighthouse.', {
      choices: [
        C('Сядь.', 'Sit down.', { goto: 'h3' }),
        C('Не к Маяку.', 'Not to the Lighthouse.', { goto: 'h4' }),
        C('(Поднять револьвер)', '(Raise the revolver)', { ifFlag: 'weapon', goto: 'h5' }),
      ],
    }),
    h3: N('h3', 'harrow', '(садится на ящик у двери) Сяду.', '(sits on a crate by the door) I’ll sit.', { next: 'h6' }),
    h4: N('h4', 'harrow', 'Знаю. Я эти огни сорок лет вижу. Пирс семь.', 'I know. I’ve seen those lights for forty years. Pier seven.', { next: 'h6' }),
    h5: N('h5', 'harrow', '(смотрит на ствол спокойно) Убери. Если бы ты хотел, я бы уже лежал.', '(looks at the gun calmly) Put it away. If you wanted to, I’d already be down.', { next: 'h6' }),
    h6: N('h6', 'harrow', 'Ты не Тихон. Тихон бы руль держал двумя руками. Ты держишь одной. Во второй у тебя… (смотрит на Створку) А. Вот как. Значит, всё-таки работает.', 'You’re not Tikhon. Tikhon holds the wheel with both hands. You hold it with one. In the other you have… (looks at the Створка) Ah. So it works after all.', {
      choices: [
        C('Ты знаешь, что это?', 'You know what this is?', { goto: 'h7' }),
        C('Не твоё дело.', 'None of your business.', { goto: 'h7' }),
        C('Ян лежит в воде у пристани. Твои люди.', 'Jan is in the water at the pier. Your people.', { ifKnow: 'jan', goto: 'h8' }),
      ],
    }),
    h7: N('h7', 'harrow', 'Я знаю, сколько она за это заплатила. Половину города.', 'I know what she paid for it. Half the city.', { next: 'h9' }),
    h8: N('h8', 'harrow', '(долгая пауза) …Корд. Корд распорядился. (тише) Я не спрашивал, куда деваются рулевые. Я многое не спрашивал.', '(a long pause) …Kord. Kord gave the order. (quieter) I never asked where the helmsmen went. I never asked a lot of things.', { next: 'h9' }),
    h9: N('h9', 'harrow', 'Знаешь, что я двадцать лет возил? Ящики попечительского совета. Склад номер два, баржа «Вера», пирс семь. Деньги хорошие. Ящики не открываю. Весной один ящик упал со сходни. Там была девочка. Живая. Шесть лет.', 'Know what I hauled for twenty years? The board’s crates. Warehouse two, the barge Vera, pier seven. Good money. I never opened the crates. In spring one fell off the gangway. There was a girl inside. Alive. Six years old.', { next: 'h10' }),
    h10: N('h10', 'harrow', 'Ты сам из Лукии. Тимофей, да? Ян рассказывал. Мальчишка выбил окно в прачечной и ушёл в одной рубашке, за два дня до «перевода».', 'You’re from Lucia yourself. Timofey, yes? Jan told me. A boy broke the laundry window and walked out in his shirt, two days before his “transfer”.', { next: 'h11' }),
    h11: N('h11', 'harrow', 'Эта штука у тебя в руке — поводок. Пока она работает, она видит, где ты. И выбирает, в каком мире тебе жить. И в каком мне умереть. Сломай. И правь к барже.', 'That thing in your hand is a leash. While it works, she sees where you are. And chooses which world you live in. And which one I die in. Break it. And steer for the barge.', {
      choices: [
        C('Верю.', 'I believe you.', { effect: 'believe', end: true }),
        C('Не верю.', 'I don’t believe you.', { effect: 'disbelieve', end: true }),
      ],
    }),
  },
};

export const SCENES: Record<string, Scene> = {
  prologue, orven, orven_key: orvenKey, tilda, ned, foma, foma_ruin: fomaRuin,
  gale_wounded: galeWounded, gale_healthy: galeHealthy,
  agnia, anna, anka, guard_wagon: guardWagon,
  lukyan, tilda_pier: tildaPier, tikhon, fern, lydia, stern,
  pier3_guard: pier3Guard, finale,
};

export const scene = (id: string): Scene | null => SCENES[id] ?? null;
