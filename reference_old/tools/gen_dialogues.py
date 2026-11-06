"""Authoring source for dialogue trees (RU/EN). Generates src/data/dialogues.json and the 'dlg' / fact keys in i18n."""
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..')
D = {}       # npc -> {start: [[cond,node]], nodes: {id: {...}}}
TXT = {'ru': {}, 'en': {}}
FACTS = {}
cnt = [0]

def key(npc, ru, en):
    cnt[0] += 1; k = f'{npc}.k{cnt[0]}'
    TXT['ru'][k] = ru; TXT['en'][k] = en; return k

def npc(id, start):
    D[id] = {'start': start, 'nodes': {}}
    def node(nid, lines, choices=(), **eff):
        n = {'lines': [[v, key(id, ru, en)] for v, ru, en in lines]}
        ch = []
        for c in choices:
            ru, en, props = c[0], c[1], (c[2] if len(c) > 2 else {})
            ch.append({'k': key(id, ru, en), **props})
        n['choices'] = ch
        n.update(eff)
        D[id]['nodes'][nid] = n
    return node

def fact(k, ru, en): FACTS[k] = (ru, en)

# ---------------- LEA ----------------
n = npc('lea', [['lost_pass loc:market', 'lost'], ['loc:substation', 'atwork'], ['always', 'hello']])
n('lost', [('narr', 'Девочка лет девяти шарит по карманам куртки. Губы дрожат, капюшон сбился.', 'A girl of about nine pats her jacket pockets. Her lips tremble, hood askew.'),
           ('npc', 'Мой проездной… Курьер налетел, и всё рассыпалось. Я всё собрала, а проездного нет.', 'My tram pass… The courier crashed into me and everything spilled. I picked it all up, but the pass is gone.')],
  [('Я помогу найти.', "I'll help you find it.", {'to': 'help'}),
   ('Куда ты так спешишь?', "Where are you rushing to?", {'to': 'why'}),
   ('[Логика] Без проездного — пешком. Далеко?', '[Logic] Without the pass you walk. Is it far?', {'check': ['logic', 4], 'to': 'walk', 'fail': 'walk_f'})])
n('help', [('npc', 'Правда? Он жёлтый, с котиком в наушниках. Если найдёте — я буду у школы до десяти минут шестого.', "Really? It's yellow, with a cat in headphones. If you find it — I'll be at school until ten past five.")], [], trust=1)
n('why', [('npc', 'Папа опять забыл пропуск дома. Он работает на подстанции, новенький. Без пропуска его ругают.', "Dad forgot his badge at home again. He's new at the substation. Without it he gets told off."),
          ('emp', 'Для неё это вопрос жизни и смерти. Для отца — тоже, но он об этом пока не знает.', "For her it's life and death. For her father too — he just doesn't know it yet.")], [('А потом?', 'And then?', {'to': 'help'})], fact=['pike_badge', 'lea'])
n('walk', [('logic', 'Школа → Промзона: тридцать минут пешком. Трамвай №7 — вдвое быстрее. Разница решит, застанет ли она кого-то на смене.', 'School → Industrial Zone: thirty minutes on foot. Tram #7 is twice as fast. The difference decides who will still be on shift when she arrives.')], [], fact=['walk_time', 'x'])
n('walk_f', [('logic', 'Что-то про время и расстояние ускользает. Слишком много шума на рынке.', 'Something about time and distance slips away. Too much market noise.')], [])
n('hello', [('npc', 'Мама говорит, нельзя разговаривать с незнакомыми. Особенно с теми, у кого светится рука.', "Mom says I mustn't talk to strangers. Especially ones whose arm glows.")],
  [('Как зовут твоего папу?', "What's your dad's name?", {'to': 'dad'})])
n('dad', [('npc', 'Пайк. Он на подстанции «Гелион-4». Он хороший, только всё время нервничает.', "Pike. He's at the Helion-4 substation. He's nice, he's just always nervous.")], [], fact=['pike_badge', 'lea'])
n('atwork', [('npc', 'Папа говорит, тут нельзя ходить. Но здесь так красиво гудит.', "Dad says I can't walk around here. But it hums so nicely."),
             ('obs', 'Она стоит в метре от пульта. Отец смотрит то на неё, то на красный рубильник.', "She's a metre from the console. Her father keeps glancing from her to the red switch.")])

# ---------------- PIKE ----------------
n = npc('pike', [['blackout loc:substation', 'after'], ['always', 'main']])
n('main', [('narr', 'Новичок вытирает ладони о комбинезон и всё время оглядывается на пульт.', 'The rookie wipes his palms on his overalls and keeps glancing at the console.'),
           ('npc', 'Вы кто? Здесь режимный объект, сюда нельзя.', "Who are you? This is a restricted site, you can't be here.")],
  [('[Хладнокровие] Спокойно. Плановая проверка.', '[Composure] Relax. Routine inspection.', {'check': ['cool', 4], 'to': 'calm', 'fail': 'tense'}),
   ('Что это за красный рубильник?', "What's that red switch?", {'to': 'switch'}),
   ('Твоя дочь принесёт пропуск?', 'Is your daughter bringing the badge?', {'if': 'fact:pike_badge', 'to': 'daughter'})])
n('calm', [('npc', 'Проверка… Ладно. Я всё делаю по инструкции. Диспетчер звонит — я выполняю. В шесть — профилактика, тоже по инструкции.', "An inspection… Fine. I do everything by the book. The dispatcher calls — I comply. Maintenance at six, by the book too."),
           ('logic', 'Он выполнит любой приказ, если тот придёт «от диспетчера».', "He'll follow any order that comes 'from the dispatcher'.")], [], trust=1, fact=['pike_obeys', 'x'])
n('tense', [('cool', 'Ты слишком резко подошёл. Он отступил к пульту. Его рука легла рядом с красным рубильником.', 'You came on too strong. He backed towards the console. His hand rests next to the red switch.')], [])
n('switch', [('npc', 'Аварийный. Весь район одним движением: клиника, светофоры, башня, депо. Ян говорит — даже не смотри на него.', "Emergency cut-off. The whole district in one motion: clinic, traffic lights, tower, depot. Yan says don't even look at it."),
             ('emp', 'Он смотрит. Постоянно. Как на обрыв.', 'He looks. All the time. Like at a cliff edge.')], [])
n('daughter', [('npc', 'Лея? Я забыл пропуск… Она принесёт после школы. Только бы успела до конца смены Яна — иначе он опять устроит инцидент по регламенту, и мы все тут застрянем.', "Lea? I forgot the badge… She'll bring it after school. As long as she makes it before Yan's shift ends — otherwise he files an incident by the book and we're all stuck here.")], [], fact=['yan_regulation', 'x'])
n('after', [('npc', 'Я… я не хотел. Они стояли там, двое, смотрели. И Лея. И рука сама…', "I… I didn't mean to. They were standing there, two of them, staring. And Lea. And my hand just…"),
            ('emp', 'Он ещё не понял, сколько людей сейчас в темноте из-за одного движения.', "He hasn't grasped yet how many people are in the dark because of one motion.")])

# ---------------- YAN ----------------
n = npc('yan', [['always', 'main']])
n('main', [('npc', 'Смена до половины шестого, потом — бар. Регламент есть регламент.', 'Shift till half five, then the bar. Rules are rules.')],
  [('Что будет, если на объекте окажется ребёнок?', 'What happens if a child turns up on site?', {'to': 'reg'}),
   ('[Хладнокровие] Ты должен Моку.', '[Composure] You owe Mok.', {'check': ['cool', 4], 'to': 'debt', 'fail': 'debt_f'}),
   ('[Наблюдательность] Схема фидеров в шкафчике?', '[Perception] The feeder chart in the locker?', {'check': ['obs', 4], 'to': 'feeders'})])
n('reg', [('npc', 'Инцидент. Сорок минут бумаг, и я торчу тут, хоть небо рухни. Ребёнок на объекте — это не шутки.', "An incident. Forty minutes of paperwork, and I'm stuck here even if the sky falls. A child on site is no joke.")], [], fact=['yan_regulation', 'x'])
n('debt', [('npc', 'Тише ты. Должен. Если опоздаю к нему — пришлёт своих. На работу. Он всегда присылает на работу, чтобы все видели.', "Keep it down. I do. If I'm late — he sends his boys. To my work. He always sends them to work, so everyone sees.")], [], fact=['mok_collectors', 'x'])
n('debt_f', [('npc', 'Не твоё дело.', 'None of your business.')], [], trust=-1)
n('feeders', [('npc', 'Схема в шкафчике устарела. Клиника сейчас на третьем фидере, светофоры на пятом, тоннельная вентиляция на первом. Я помню наизусть.', "The chart in the locker is outdated. The clinic is on feeder three now, traffic lights on five, tunnel ventilation on one. I know it by heart.")], [], fact=['feeders', 'x'])

# ---------------- MOK ----------------
n = npc('mok', [['always', 'main']])
n('main', [('narr', 'Тучный человек в бархатном пиджаке. На пальцах — кольца с разъёмами под чипы.', 'A heavy man in a velvet jacket. His rings have chip sockets.'),
           ('npc', 'Садись. Долги — это дружба, которую можно измерить.', 'Sit. Debts are friendship you can measure.')],
  [('Кто тебе должен?', 'Who owes you?', {'to': 'debtors'}),
   ('Что у тебя на полках?', "What's on your shelves?", {'to': 'shelves'}),
   ('Мне нужен редкий чип памяти.', 'I need a rare memory chip.', {'to': 'chip'}),
   ('Дана Корф собирается тебя кинуть.', 'Dana Korf is going to stiff you.', {'if': 'fact:dana_debt !flag:mok_rumor', 'to': 'rumor'})])
n('debtors', [('npc', 'Половина района. Ян с подстанции — сегодня к без десяти шесть, и лучше бы ему не опаздывать. Дана Корф из «Гелиона», вся такая важная. Ты — пока нет.', "Half the district. Yan from the substation — due ten to six today, and he'd better not be late. Dana Korf from Helion, so very important. You — not yet.")], [], fact=['dana_debt', 'x'])
n('shelves', [('narr', 'Полки уходят в темноту. Импланты в пакетах с бирками. Чипы памяти — тысячи, подписанные именами.', 'Shelves vanish into the dark. Implants in tagged bags. Memory chips — thousands, labelled with names.'),
              ('npc', 'Чип с чужими воспоминаниями стоит дороже руки. Руку можно вырастить.', "A chip of someone's memories costs more than an arm. You can regrow an arm.")], [], fact=['pawn_shelves', 'x'])
n('chip', [('npc', 'Редкий? Поставщик приносит их к двадцати минутам девятого. Раньше — только мусор.', 'Rare? My supplier brings them by twenty past eight. Before that — only junk.'),
           ('logic', 'В 20:20 чип появится на полке. Нисе он нужен раньше. Окно знает способ.', "At 20:20 the chip hits the shelf. Nisa needs it earlier. The Window knows a way.")], [], fact=['chip_time', 'x'])
n('rumor', [('npc', '…Вот как. Интересно. В девять я ей позвоню — пусть понервничает при своих мальчиках.', "…Is that so. Interesting. At nine I'll give her a call — let her sweat in front of her boys.")], [], act='rumor_mok')

# ---------------- RO ----------------
n = npc('ro', [['always', 'main']])
n('main', [('npc', 'Что будешь? Синтетика или настоящая боль?', 'What will it be? Synthetic or real pain?')],
  [('Слухи.', 'Rumors.', {'to': 'gossip'}),
   ('[Эмпатия] Как жена?', '[Empathy] How is your wife?', {'check': ['emp', 3], 'to': 'wife'}),
   ('Кто такой Харт?', 'Who is Hart?', {'if': 'trust>=1', 'to': 'hart'})])
n('gossip', [('npc', 'Слухи — за услуги. Ладно, первый бесплатно: Дана Корф из охраны «Гелиона» должна Моку. И Мок любит звонить в самый неудобный момент.', "Rumors cost favors. Fine, first one's free: Dana Korf from Helion security owes Mok. And Mok loves to call at the worst moment.")], [], fact=['dana_debt', 'x'])
n('wife', [('npc', 'Кашляет. Третью неделю. Если ей станет хуже — закрою бар, и пусть Мок ищет другую контору.', "Coughing. Third week. If she gets worse — I close the bar, and Mok can find another office."),
           ('emp', 'Он благодарен, что ты спросил. Это что-то меняет между вами.', "He's grateful you asked. Something shifts between you.")], [], trust=1)
n('hart', [('npc', 'Харт — оператор камер на мосту. С ним не договоришься, он женат на мониторах. Камеры пропадут — сразу тревога. Его можно только… выключить. И камеры зациклить.', "Hart runs the bridge cameras. No deal with him, he's married to the monitors. Cameras go dark — instant alarm. You can only… switch him off. And loop the cameras.")], [], fact=['hart_info', 'x'])

# ---------------- NISA ----------------
n = npc('nisa', [['flag:nisa_deal', 'done'], ['always', 'main']])
n('main', [('narr', 'Лоток с проводами, глаза с серебристой каймой. Пальцы не останавливаются ни на секунду.', 'A stall of wires, eyes with a silver rim. Her fingers never stop moving.'),
           ('npc', 'Я делаю то, чего не делают другие.', "I do what others don't.")],
  [('Что ты умеешь?', 'What can you do?', {'to': 'skills'}),
   ('Твоя цена?', 'Your price?', {'to': 'price'}),
   ('Вот редкий чип.', "Here's a rare chip.", {'if': 'has:memory_chip', 'to': 'deal'})])
n('skills', [('hack', 'Поддельный вызов «от диспетчера» на любой пульт. Чип-петля для камер. Устройство для сервисного порта бронемашины.', "A forged 'dispatcher' call to any console. A loop chip for cameras. A device for an armored car's service port."),
             ('npc', 'Звонки ставлю на время. Вентиляцию тоннеля, например, можно выключить в 20:15 руками одного нервного новичка.', "I schedule calls. The tunnel ventilation, for example, can be shut off at 20:15 by the hands of one nervous rookie.")], [], fact=['nisa_services', 'x'])
n('price', [('npc', 'Редкий чип из ломбарда Мока. Не деньги — память. Только сделка нужна мне до 20:15, иначе звонок в тоннель не успею поставить.', "A rare chip from Mok's pawnshop. Not money — memory. And I need the deal before 20:15, or I can't set up the tunnel call.")], [])
n('deal', [('npc', 'Хороший. Чьё-то детство, кажется. Договорились.', "Nice one. Someone's childhood, I think. Deal.")], [], act='deal_nisa', next='done')
n('done', [('npc', 'Петля и устройство у меня. Звонки ставлю по слову. Что берёшь?', 'Loop and device are ready. Calls by word. What do you need?')],
  [('Давай чип-петлю.', 'Give me the loop chip.', {'act': 'get_loop'}),
   ('Давай устройство для порта.', 'Give me the port device.', {'act': 'get_port'}),
   ('Поставь звонок Пайку (вентиляция, 20:15).', 'Set the call to Pike (ventilation, 20:15).', {'act': 'order_vent'}),
   ('Поставь ложный вызов полиции (21:20).', 'Set a false police call (21:20).', {'act': 'order_police'}),
   ('Как работает петля?', 'How does the loop work?', {'to': 'loopinfo'})])
n('loopinfo', [('npc', 'Камеры моста будут показывать вчерашний дождь. Ставь её до того, как Харт увидит пустой стул. И не оставляй его на виду — Гас вернётся за инструментом.', "The bridge cameras will show yesterday's rain. Plug it in before Hart sees an empty chair. And don't leave him in plain sight.")], [])

# ---------------- OSIP ----------------
n = npc('osip', [['always', 'main']])
n('main', [('npc', 'Не мешай. У меня машина.', "Don't get in the way. I've got a car to look after.")],
  [('[Эмпатия] Как Мара?', '[Empathy] How is Mara?', {'check': ['emp', 3], 'to': 'mara', 'fail': 'mara_f'}),
   ('[Наблюдательность] Что за «Омега-9»?', "[Perception] What's the Omega-9?", {'check': ['obs', 5], 'to': 'omega', 'fail': 'omega_f'}),
   ('Кто тебя подменит, если что?', 'Who replaces you if something happens?', {'to': 'feld'})])
n('mara', [('npc', 'Стабильна. Пока ток ровный. «Гелион» оплачивает её контур, поэтому я за рулём у Лаша. Вот и вся моя верность.', "Stable. As long as the current is even. Helion pays for her loop, so I drive for Lash. That's all my loyalty is."),
           ('emp', 'Если с Марой что-то случится — он не отойдёт от неё. Ни за какие деньги.', "If anything happens to Mara — he won't leave her side. Not for any money.")], [], trust=1, fact=['osip_loyalty', 'x'])
n('mara_f', [('npc', 'Не твоё дело.', 'Not your business.')], [])
n('omega', [('npc', 'Броня, полный привод. И протокол «аварийная эвакуация»: при угрозе столкновения открывает пассажирскую дверь. Глупость инженеров. Осматриваю её в 19:05, каждый день.', "Armor, full drive. And an 'emergency evacuation' protocol: on collision threat it opens the passenger door. Engineers' idiocy. I inspect it at 19:05, every day."),
            ('logic', 'Если что-то поставить в порт до 19:05 — он найдёт. После — нет.', "Plug something into the port before 19:05 — he'll find it. After — he won't.")], [], fact=['omega_protocol', 'x'])
n('omega_f', [('npc', 'Машина как машина.', 'A car is a car.')], [])
n('feld', [('npc', 'Фельд. Педант. По протоколу он на мосту не остановится ни на секунду, хоть трамвай на дороге.', "Feld. A pedant. By protocol he won't stop on the bridge for a second, even with a tram in the way.")], [], fact=['feld_strict', 'x'])

# ---------------- SOL ----------------
n = npc('sol', [['always', 'main']])
n('main', [('npc', 'Посещения до восьми. Что вам?', 'Visiting hours till eight. What do you want?')],
  [('Как Мара Ренн?', 'How is Mara Renn?', {'to': 'mara'}),
   ('[Наблюдательность] Что за ободок у пациентов на запястьях?', '[Perception] What are those bands on the patients\' wrists?', {'check': ['obs', 4], 'to': 'band'})])
n('mara', [('npc', 'Стабильна при ровном питании. Генератор держит сорок минут. Дальше — я ничего не обещаю.', 'Stable while the power is even. The generator holds forty minutes. Beyond that — I promise nothing.')], [], fact=['clinic_gen', 'x'])
n('band', [('npc', 'Тестовый контур «Гелиона». У всех в этой палате. Иногда они говорят во сне одно и то же слово. Одновременно.', "Helion's test loop. Everyone on this ward has one. Sometimes they say the same word in their sleep. At the same time."),
           ('mem', 'Ты помнишь это слово. Ты не знаешь, откуда.', "You remember that word. You don't know from where.")], [], fact=['test_loop', 'x'])

# ---------------- KAY ----------------
n = npc('kay', [['always', 'main']])
n('main', [('npc', 'Ты не из «Гелиона»? Хорошо. Здесь все либо из «Гелиона», либо им должны.', "You're not Helion? Good. Here everyone is either Helion or owes them.")],
  [('Что у тебя на них?', 'What do you have on them?', {'to': 'docs'}),
   ('Как ты попадёшь внутрь?', 'How will you get inside?', {'to': 'plan'}),
   ('Ила с тобой встречается?', 'Is Ila meeting you?', {'to': 'ila'})])
n('docs', [('npc', 'Документы о тестовом контуре. Люди в «Сердце-7» — подопытные. «Единая сеть» включит их всех одновременно. Мне нужен экран в холле башни. На минуту.', "Documents on the test loop. The people in Heart-7 are test subjects. The Unified Grid will switch them all on at once. I need the hall screen in the tower. For one minute.")], [])
n('plan', [('npc', 'Если у входа не будет патруля — пройду. Берн каждый вечер с половины восьмого стоит там как гвоздь. Разве что светофоры сдохнут — тогда он на перекрёстке.', "If there's no patrol at the entrance — I'm in. Bern stands there like a nail every evening from half seven. Unless the traffic lights die — then he's at the junction.")], [], fact=['kay_plan', 'x'])
n('ila', [('npc', 'В половине четвёртого, у Юны. Она боится и приносит пустышки. Пока её кабинет пустует — терминал никто не сторожит.', "Half past three, at Yuna's. She's scared and brings blanks. While her office is empty — nobody guards the terminal.")], [], fact=['office_empty', 'x'])

# ---------------- ILA ----------------
n = npc('ila', [['always', 'main']])
n('main', [('npc', 'Простите, мне нужно идти.', "Sorry, I have to go.")],
  [('[Эмпатия] Чего ты боишься?', '[Empathy] What are you afraid of?', {'check': ['emp', 4], 'to': 'fear', 'fail': 'fear_f'}),
   ('Кай — твой друг?', 'Is Kai your friend?', {'to': 'kay'})])
n('fear', [('npc', 'Лаш знает всё, что набирают в башне. Даже пароль моего терминала — номер места первой машины, что вернётся в гараж после семи. Он считает это остроумным.', "Lash knows everything typed in the tower. Even my terminal password — the bay number of the first car back in the garage after seven. He thinks it's witty."),
           ('logic', 'Пароль появится после 19:00. Терминал без присмотра — в 15:45. Без Окна не связать.', "The password appears after 19:00. The terminal is unattended at 15:45. Impossible to connect without the Window.")], [], fact=['password_rule', 'x'], trust=1)
n('fear_f', [('npc', 'Ничего. Я ничего не боюсь.', "Nothing. I'm not afraid of anything.")], [])
n('kay', [('npc', '…Он хороший. Слишком хороший для этого города. Я не могу дать ему настоящие документы.', "…He's good. Too good for this city. I can't give him the real documents.")], [])

# ---------------- DANA ----------------
n = npc('dana', [['always', 'main']])
n('main', [('npc', 'Проходи мимо.', 'Keep walking.')],
  [('[Хладнокровие] Какой маршрут у кортежа?', "[Composure] What's the convoy route?", {'check': ['cool', 7], 'to': 'route', 'fail': 'route_f'}),
   ('Говорят, ты должна Моку.', 'They say you owe Mok.', {'if': 'fact:dana_debt', 'to': 'debt'}),
   ('[Наблюдательность] Осмотреться.', '[Perception] Look around.', {'check': ['obs', 3], 'to': 'badge'})])
n('route', [('npc', 'В 20:30 решаю я. Тоннель закрыт — мост, если мост в норме. Иначе тоннель.', "At 20:30 I decide. Tunnel closed — the bridge, if the bridge is normal. Otherwise the tunnel.")], [], fact=['route_rule', 'x'])
n('route_f', [('npc', 'Ты задаёшь неправильные вопросы неправильному человеку.', "You're asking the wrong questions to the wrong person.")], [], trust=-1)
n('debt', [('npc', 'Ещё раз скажешь это вслух — узнаешь, как работает моя охрана.', "Say that out loud again — and you'll learn how my security works.")], [], trust=-1)
n('badge', [('obs', 'Бейдж на поясе висит слишком удобно. Она замечает каждый взгляд на него. Это приманка.', "The badge on her belt hangs too conveniently. She notices every glance at it. It's bait.")], [])

# ---------------- BURN ----------------
n = npc('burn', [['always', 'main']])
n('main', [('npc', 'Проходите, гражданин.', 'Move along, citizen.')],
  [('Где вы дежурите вечером?', 'Where are you posted tonight?', {'to': 'sched'})])
n('sched', [('npc', 'В 19:20 — у башни. В 21:20 — сопровождение на мосту. Если светофоры не сдохнут — тогда я на перекрёстке, хоть ты тресни.', "19:20 — at the tower. 21:20 — escort on the bridge. Unless the traffic lights die — then I'm stuck at the junction.")], [], fact=['burn_schedule', 'x'])

# ---------------- HART ----------------
n = npc('hart', [['always', 'main']])
n('main', [('narr', 'Харт не отрывается от мониторов. Двенадцать квадратов дождя, двенадцать квадратов моста.', "Hart doesn't look away from the monitors. Twelve squares of rain, twelve squares of bridge."),
           ('logic', 'С ним не договориться. Только тихо. И камеры нужно зациклить заранее.', 'No deal with him. Only quietly. And the cameras must be looped first.')])

# ---------------- GAS ----------------
n = npc('gas', [['always', 'main']])
n('main', [('npc', 'Мост в ремонте. Щиты, опоры, камеры. Всё хрупкое.', 'The bridge is under repair. Billboards, pillars, cameras. Everything is fragile.')],
  [('Что у третьей опоры?', "What's at pillar three?", {'to': 'pillar'}), ('Когда уходишь?', 'When do you leave?', {'to': 'leave'})])
n('pillar', [('npc', 'Будка камер, там Харт. Рядом рекламный щит — с него весь мост как на ладони. Хорошее место, если ты фотограф.', "The camera booth, Hart's there. Next to it — a billboard; you see the whole bridge from it. Nice spot if you're a photographer.")], [], fact=['billboard', 'x'])
n('leave', [('npc', 'В восемь. После меня там только Харт и дождь.', "At eight. After me there's only Hart and the rain.")], [])

# ---------------- YUNA / TODD / COURIER / VERA / EMIL / LIOR / FELD / others ----------------
n = npc('yuna', [['always', 'main']])
n('main', [('npc', 'Лапша-24! Горячая, острая, почти натуральная!', 'Noodle-24! Hot, spicy, almost natural!')],
  [('Видела девочку с проездным?', 'Seen a girl with a tram pass?', {'to': 'lea'}), ('Кто тут встречается днём?', 'Who meets here in the afternoon?', {'to': 'meet'})])
n('lea', [('npc', 'Лею? Мой курьер её сбил в восемь минут третьего. Он вечно летит, как будто от этого зарплата растёт.', "Lea? My courier knocked her over at eight past two. He always flies like it raises his pay.")], [])
n('meet', [('npc', 'Кай-журналист и девушка из башни, в половине четвёртого. Она всегда берёт чай и не пьёт.', "Kai the reporter and a girl from the tower, at half past three. She always orders tea and never drinks it.")], [], fact=['office_empty', 'x'])
n = npc('todd', [['always', 'main']])
n('main', [('npc', 'Играю для дождя. Дождь платит нерегулярно.', 'I play for the rain. The rain pays irregularly.')], [('Сыграй что-нибудь.', 'Play something.', {'to': 'song'})])
n('song', [('narr', 'Он трогает струны. Мелодия похожа на что-то, что ты слышал в другой ветке. Или ещё услышишь.', "He touches the strings. The tune resembles something you heard in another branch. Or will hear.")], [])
n = npc('courier', [['always', 'main']])
n('main', [('npc', 'Некогда! Заказы горят!', 'No time! Orders are burning!')], [('Ты сбил девочку.', 'You knocked over a girl.', {'to': 'guilt'})])
n('guilt', [('npc', 'Я? Она сама! …Ну, может, задел. Я же не специально.', "Me? She did it herself! …Well, maybe I clipped her. Not on purpose.")], [])
n = npc('vera', [['always', 'main']])
n('main', [('npc', 'Центр-112. Все вызовы проходят через меня.', 'Center-112. Every call goes through me.')], [('Как вы отличаете ложный вызов?', 'How do you spot a false call?', {'to': 'calls'})])
n('calls', [('npc', 'Звонок — я назначаю ближайший патруль. Проверяю потом. Когда успеваю. Я никогда не успеваю.', "A call comes in — I assign the nearest patrol. I verify later. When I have time. I never have time.")], [], fact=['false_calls', 'x'])
n = npc('emil', [['always', 'main']])
n('main', [('npc', 'Седьмой ходит по расписанию. Пока на складе есть деталь.', 'The 7th runs on schedule. As long as the part is in stock.')], [('А если детали не будет?', 'And if the part goes missing?', {'to': 'part'})])
n('part', [('npc', 'Следующий рейс из депо встанет на первом подъёме. Это мост. Двадцать минут, пока не пригонят тягач.', "The next run from the depot stalls on the first incline. That's the bridge. Twenty minutes until the tow arrives.")], [], fact=['tram_stall', 'x'])
n = npc('lior', [['always', 'main']])
n('main', [('npc', 'Склад — это память депо.', "The storeroom is the depot's memory.")], [('Что в ящике находок?', "What's in the lost-and-found?", {'to': 'lost'}), ('Где деталь седьмого?', "Where's the 7th's spare part?", {'to': 'part'})])
n('lost', [('npc', 'Ключи, жетоны. Около 19:40 кто-нибудь из «Гелиона» обязательно что-то теряет. Пропажу хватятся только утром.', "Keys, tokens. Around 19:40 someone from Helion always loses something. Nobody notices until morning.")], [], fact=['jeton_time', 'x'])
n('part', [('npc', 'На стеллаже у входа. Без неё седьмой встанет на ближайшем подъёме.', "On the rack by the door. Without it the 7th stalls on the nearest incline.")], [], fact=['tram_stall', 'x'])
n = npc('feld', [['always', 'main']])
n('main', [('npc', 'Я запасной. По протоколу, до последней точки. Никаких остановок на мостах.', "I'm the backup. By protocol, to the last full stop. No stops on bridges.")])
for sid, ru, en in [('mara', 'Мара спит. Мониторы мягко мигают в такт чему-то, что не похоже на её сердце.', "Mara sleeps. The monitors blink gently in time with something that isn't her heart."),
                    ('lash', 'Вы не должны были подойти так близко. Охрана уже смотрит.', 'You were not supposed to get this close. Security is already watching.'),
                    ('ro_wife', 'Женщина кашляет и крепче кутается в плед.', 'The woman coughs and pulls her blanket tighter.'),
                    ('collector1', 'Молчаливый человек с тяжёлым взглядом. «Мок передаёт привет».', "A silent man with a heavy stare. 'Mok sends his regards.'"),
                    ('collector2', 'Молчаливый человек с тяжёлым взглядом. Костяшки в шрамах.', 'A silent man with a heavy stare. Scarred knuckles.'),
                    ('convoy', 'Бронированная машина молчит. Тонированные стёкла.', 'The armored car is silent. Tinted windows.')]:
    n = npc(sid, [['always', 'main']]); n('main', [('narr', ru, en)])


# ---------------- contextual follow-ups (state of the current branch) ----------------
def ctx(npc_id, cond, nid, lines):
    D[npc_id]['start'].insert(0, [cond, nid])
    n = {'lines': [[v, key(npc_id, ru, en)] for v, ru, en in lines], 'choices': []}
    D[npc_id]['nodes'][nid] = n
ctx('osip', 'event:osip_stays', 'stay', [('npc', 'Я не оставлю её. Пусть Лаша везёт Фельд — у него протокол, у меня жена.', "I won't leave her. Let Feld drive Lash — he has a protocol, I have a wife."), ('emp', 'Его мир сузился до одной палаты. Кортеж сегодня поедет по-другому.', 'His world has shrunk to one ward. The convoy will drive differently tonight.')])
ctx('kay', 'event:documents_shown', 'shown', [('npc', 'Они видели. Весь холл видел! Пусть теперь попробуют включить свою сеть.', "They saw it. The whole hall saw it! Let them try switching on their grid now.")])
ctx('kay', 'event:kay_dispersed', 'dispersed', [('npc', 'Берн опять. Стоял у входа, как будто знал, что я приду.', 'Bern again. Standing at the door as if he knew I was coming.'), ('logic', 'Пока патруль у входа — Кай снаружи. Нужен повод увести Берна.', 'While the patrol holds the door, Kai stays outside. Bern needs a reason to leave.')])
ctx('mok', 'event:collectors_sent', 'sent', [('npc', 'Ян думает, что регламент его спасёт. Мои мальчики уже едут к нему на работу.', "Yan thinks regulations will save him. My boys are already on their way to his work.")])
ctx('yan', 'event:incident_filed loc:substation', 'incident', [('npc', 'Ребёнок на объекте. Сорок минут бумаги. Мок меня убьёт.', 'A child on site. Forty minutes of paperwork. Mok will kill me.'), ('logic', 'Ян опоздает в бар. Мок ждёт ровно полчаса.', 'Yan will be late to the bar. Mok waits exactly half an hour.')])
ctx('dana', 'event:mok_calls_dana', 'call', [('npc', 'Не сейчас! …Мок, я заплачу, слышишь? Отвали от моих людей.', "Not now! …Mok, I'll pay, you hear? Stay away from my people."), ('obs', 'Вторая машина сопровождения разворачивается за ней.', 'The second escort car turns around after her.')])
ctx('lea', 'event:incident_filed loc:substation', 'paper', [('npc', 'Дядя Ян пишет про меня бумагу. Я что-то сделала не так?', "Uncle Yan is writing a paper about me. Did I do something wrong?")])
ctx('sol', 'blackout', 'gen', [('npc', 'Генератор! Сорок минут, слышите? Кто-нибудь, найдите топливо!', 'The generator! Forty minutes, do you hear? Somebody find fuel!')])
ctx('sol', 'event:patients_wake', 'word', [('npc', 'Вы это слышали? Все сразу. Одно слово.', 'Did you hear that? All of them at once. One word.'), ('mem', '«Окно». Они сказали «Окно».', "'Window'. They said 'Window'.")])
ctx('vera', 'event:false_call', 'false', [('npc', 'Вызов из тоннеля… Берн, проверь. Да, сейчас. Нет, проверить некогда.', "A call from the tunnel… Bern, check it. Yes, now. No, no time to verify.")])
ctx('ila', 'event:documents_shown', 'thanks', [('npc', 'Он сделал это… Кай сделал это. Кто бы вы ни были — спасибо.', 'He did it… Kai did it. Whoever you are — thank you.')])
ctx('emil', 'event:tram_stalled', 'stalled', [('npc', 'Встал на подъёме, как я и говорил. На мосту. Двадцать минут.', 'Stalled on the incline, like I said. On the bridge. Twenty minutes.')])
ctx('burn', 'blackout', 'busy', [('npc', 'Не до вас! Перекрёсток мёртв, весь район стоит!', "No time! The junction is dead, the whole district is jammed!")])
ctx('pike', 'event:fake_call loc:substation', 'call', [('npc', 'Диспетчер велел отключить вентиляцию тоннеля. Я… я отключил. Это же по инструкции?', 'The dispatcher told me to shut the tunnel ventilation. I… I did. That is by the book, right?')])
ctx('mara', 'event:mara_critical', 'crit', [('narr', 'Мониторы мигают красным. Сол кричит что-то в коридор. Осип держит её за руку.', 'The monitors flash red. Sol shouts something into the corridor. Osip holds her hand.')])
ctx('hart', 'flag:loop', 'loop', [('narr', 'На мониторах Харта — вчерашний дождь. Он не замечает разницы.', "Hart's monitors show yesterday's rain. He doesn't notice the difference.")])


# ---------------- deeper branches (added) ----------------
def nodes_of(id):
    def node(nid, lines, choices=(), **eff):
        n = {'lines': [[v, key(id, ru, en)] for v, ru, en in lines], 'choices': []}
        for c in choices:
            ru, en, props = c[0], c[1], (c[2] if len(c) > 2 else {})
            n['choices'].append({'k': key(id, ru, en), **props})
        n.update(eff); D[id]['nodes'][nid] = n
    return node
def addch(id, nid, ru, en, props):
    D[id]['nodes'][nid]['choices'].insert(-0 if False else len(D[id]['nodes'][nid]['choices']), {'k': key(id, ru, en), **props})

n = nodes_of('ro')
addch('ro', 'main', 'Расскажи про Мока.', 'Tell me about Mok.', {'to': 'mok'})
addch('ro', 'main', 'Что говорят о запуске «Единой сети»?', 'What do people say about the Unified Grid launch?', {'if': 'trust>=1', 'to': 'grid'})
n('mok', [('npc', 'Мок держит этот бар, как держат собаку на цепи: кормит и не отпускает. Половина моих клиентов ему должны. Другая половина — будет.', 'Mok holds this bar like a dog on a chain: feeds it and never lets go. Half my customers owe him. The other half will.'),
          ('emp', 'Ро не боится Мока. Он устал от него.', "Ro isn't afraid of Mok. He's tired of him.")], [('А если Мок исчезнет?', 'And if Mok disappeared?', {'to': 'mok2'})])
n('mok2', [('npc', 'Тогда придёт другой Мок. Город так устроен: долги не исчезают, меняются только люди, которым ты должен.', "Then another Mok would come. That's how the city works: debts never vanish, only the people you owe change.")], [])
n('grid', [('npc', 'Говорят, после 22:00 импланты будут слушать одну сеть. Моя жена говорит — это как общий сон. Я говорю — это как общий поводок.', 'They say after 22:00 implants will listen to one grid. My wife says it is like a shared dream. I say it is like a shared leash.'),
           ('mem', 'Ты уже слышал эту фразу. В другой ветке её говорил не Ро.', 'You have heard this line before. In another branch it was not Ro who said it.')], [], trust=1)

n = nodes_of('nisa')
addch('nisa', 'main', '[Эмпатия] Кто ты на самом деле?', '[Empathy] Who are you really?', {'check': ['emp', 4], 'to': 'who', 'fail': 'who_f'})
addch('nisa', 'main', '[Память] Ты знаешь, что такое Окно?', '[Memory] Do you know what the Window is?', {'check': ['mem', 4], 'to': 'window', 'fail': 'who_f'})
n('who', [('npc', 'Я была инженером тестового контура «Гелиона». Пока не увидела, что именно мы тестируем. Теперь я продаю чужую память, чтобы не продать свою.', "I was an engineer on Helion's test loop. Until I saw what we were testing. Now I sell other people's memories so I don't have to sell mine.")], [], trust=1)
n('who_f', [('npc', 'Ты задаёшь вопросы, на которые у тебя нет денег.', "You're asking questions you can't afford.")], [])
n('window', [('npc', '…Устройство на руке. Я видела чертежи. Контур «Гелиона» и твоё Окно — одна технология. Ты прыгаешь по времени, а они хотят, чтобы все прыгали по одной команде.', "…The device on your arm. I've seen the blueprints. Helion's loop and your Window are the same technology. You jump through time; they want everyone to jump on one command."),
              ('mem', 'Наниматель никогда этого не говорил.', 'The Employer never told you this.')], [], fact=['window_truth', 'x'])

n = nodes_of('kay')
addch('kay', 'main', 'Я могу помочь тебе попасть в холл.', 'I can help you get into the hall.', {'to': 'help'})
addch('kay', 'main', '[Логика] Почему экран в холле, а не сеть?', '[Logic] Why the hall screen and not the net?', {'check': ['logic', 4], 'to': 'why'})
n('help', [('npc', 'Правда? Тогда убери Берна от входа. Как — не моё дело. Я буду там с половины восьмого.', "Really? Then get Bern away from the entrance. How is not my business. I'll be there from half past seven.")], [], trust=1, fact=['kay_plan', 'x'])
n('why', [('npc', 'Сеть принадлежит «Гелиону». Всё, что я выложу, исчезнет за минуту. А экран в холле — это сотня глаз в момент запуска. Люди помнят то, что видели сами.', 'The net belongs to Helion. Anything I post disappears in a minute. The hall screen is a hundred pairs of eyes at the launch. People remember what they saw themselves.')], [])

n = nodes_of('osip')
addch('osip', 'main', 'Что ты сделаешь, если Маре станет хуже?', 'What will you do if Mara gets worse?', {'if': 'trust>=1', 'to': 'worse'})
addch('osip', 'main', '[Хладнокровие] Каким маршрутом поедете?', '[Composure] Which route will you take?', {'check': ['cool', 5], 'to': 'route', 'fail': 'mara_f'})
n('worse', [('npc', 'Останусь с ней. Пусть увольняют. Пусть Лаш едет с Фельдом — тот не остановится, даже если мост рухнет.', "I'll stay with her. Let them fire me. Let Lash ride with Feld — he won't stop even if the bridge collapses.")], [], fact=['feld_strict', 'x'])
n('route', [('npc', 'Решает Дана в половине девятого. Если тоннель закрыт и мост в норме — мост. Там всегда трамвай мешает. Я ненавижу этот мост.', "Dana decides at half eight. If the tunnel is closed and the bridge is normal — the bridge. There's always a tram in the way. I hate that bridge.")], [], fact=['route_rule', 'x'])

n = nodes_of('mok')
addch('mok', 'main', 'Есть работа?', 'Got any work?', {'to': 'job'})
n('job', [('npc', 'Принеси мне старые импланты — плачу. Золотые чипы — плачу больше. Кошельки… кошельки тоже несут. Город щедрый, если не задавать вопросов.', "Bring me old implants — I pay. Gold chips — I pay more. Wallets… people bring wallets too. The city is generous if you don't ask questions."),
          ('logic', 'Лом, осколки данных, кошельки валяются у депо, тоннеля, стоянки такси. Ломбард и «Импланты 24/7» их скупают.', 'Scrap, data shards and wallets lie around the depot, the tunnel, the taxi stand. The pawnshop and Implants 24/7 buy them.')], [])

n = nodes_of('pike')
addch('pike', 'main', 'Давно здесь работаешь?', 'Been working here long?', {'to': 'long'})
n('long', [('npc', 'Третью неделю. До этого собирал дронов на заводе, пока завод не купил «Гелион». Они всё покупают. Даже меня, получается.', 'Third week. Before that I assembled drones at a plant, until Helion bought the plant. They buy everything. Even me, it seems.'),
           ('emp', 'Ему одиноко. Дочь — единственное, что держит его на ногах.', "He's lonely. His daughter is the only thing keeping him upright.")], [], trust=1)

n = nodes_of('yuna')
addch('yuna', 'main', 'Посоветуй что-нибудь.', 'Recommend something.', {'to': 'rec'})
n('rec', [('npc', 'Лапшу с острым маслом — и стим «Рывок», если опаздываешь. У меня всё есть, заходи внутрь, под вывеску.', 'Noodles with chili oil — and a Dash stim if you are running late. I have it all, come inside, under the sign.')], [])

n = nodes_of('sol')
addch('sol', 'main', 'Кто платит за палату Мары?', "Who pays for Mara's ward?", {'to': 'pay'})
n('pay', [('npc', '«Гелион». Вся палата — их. Пациенты подписали согласие, которое никто не читал. Я тоже подписал — как врач.', "Helion. The whole ward is theirs. The patients signed a consent nobody read. I signed too — as the doctor."),
          ('emp', 'Ему стыдно. Он ждёт, что кто-нибудь это остановит.', "He's ashamed. He's waiting for someone to stop it.")], [], trust=1)

n = nodes_of('dana')
addch('dana', 'main', '[Хладнокровие] Мне нужен твой бейдж.', '[Composure] I need your badge.', {'check': ['cool', 8], 'to': 'badge2', 'fail': 'badge_f'})
n('badge2', [('npc', 'Смелый. Глупый, но смелый. Бейдж с маячком, дружок. Через секунду после кражи вся охрана знает, где ты.', 'Brave. Stupid, but brave. The badge has a tracker, friend. A second after it is stolen all of security knows where you are.')], [])
n('badge_f', [('npc', 'Ещё одно слово — и ты в наручниках.', 'One more word and you are in cuffs.')], [], trust=-2)

n = nodes_of('vera')
addch('vera', 'main', 'Тяжёлая смена?', 'Hard shift?', {'to': 'shift'})
n('shift', [('npc', 'Двенадцать часов, четыре патруля на весь район, дроны уходят на зарядку в восемь. Если что-то случится между восемью и половиной девятого — я слепая.', "Twelve hours, four patrols for the whole district, drones go to charge at eight. If anything happens between eight and half past — I'm blind.")], [])

n = nodes_of('gas')
addch('gas', 'main', 'Что с Хартом?', "What's with Hart?", {'to': 'hart'})
n('hart', [('npc', 'Харт? Не спит, не ест, смотрит в мониторы. Говорят, у него имплант прямо в сеть камер. Если камеры моргнут — он поднимет весь город.', "Hart? Doesn't sleep, doesn't eat, stares at monitors. They say he's implanted straight into the camera net. If the cameras blink — he raises the whole city.")], [], fact=['hart_info', 'x'])

n = nodes_of('lea')
addch('lea', 'hello', 'Хочешь лапши?', 'Want some noodles?', {'to': 'noodles'})
n('noodles', [('npc', 'Мне нельзя брать у незнакомых… но Юна делает лучшую лапшу. Спасибо!', "I'm not supposed to take things from strangers… but Yuna makes the best noodles. Thank you!")], [], trust=1)

# ---------------- crowd barks ----------------
BARKS = {
 'trader': [('Синтетический манго, свежайший, только с принтера!', 'Synthetic mango, freshest, straight off the printer!'), ('Дождь — плохо для торговли, хорошо для зонтов.', 'Rain is bad for trade, good for umbrellas.')],
 'noodle': [('Ещё две порции рамена на третий столик!', 'Two more ramen for table three!'), ('Юна опять подняла цены.', 'Yuna raised prices again.')],
 'shopper': [('Говорят, в 22:00 импланты синхронизируют. Мои старые — вдруг не потянут?', "They say implants sync at 22:00. What if my old ones can't handle it?"), ('Где тут нормальный кофе?', 'Where can you get decent coffee here?')],
 'clerk': [('Лаш сегодня лично на запуске. Все на нервах.', "Lash is at the launch in person today. Everyone's on edge."), ('Пароли меняются каждый день. Издевательство.', 'Passwords change every day. Torture.')],
 'guard': [('Проходите, не задерживайтесь.', "Move along, don't linger."), ('Вечером тут будет весь город.', 'The whole city will be here tonight.')],
 'cleaner': [('В холле опять кто-то пролил кофе на сканер.', 'Someone spilled coffee on the hall scanner again.')],
 'engineer': [('Новенький опять дёргается у пульта.', "The rookie's twitching at the console again."), ('Если фидеры перегрузить — весь центр ляжет.', 'Overload the feeders and the whole downtown goes down.')],
 'nurse': [('Пациенты тест-контура сегодня беспокойные.', 'The test-loop patients are restless today.'), ('Генератор старый. Сорок минут, не больше.', 'The generator is old. Forty minutes, no more.')],
 'orderly': [('Палата четырнадцать опять разговаривает во сне.', 'Ward fourteen is talking in their sleep again.')],
 'patron': [('Мок сегодня злой. Кто-то опять опаздывает.', "Mok's angry today. Someone's late again."), ('Ро, повтори.', 'Ro, same again.')],
 'pawnclerk': [('Залог на тридцать дней. Не выкупите — чип уйдёт.', "Thirty-day pledge. Don't redeem it — the chip goes.")],
 'student': [('Лея опять потеряла проездной!', 'Lea lost her pass again!'), ('После школы — на рынок!', 'Market after school!')],
 'teacher': [('Дети, не бегайте под дождём.', "Children, don't run in the rain.")],
 'taxi': [('Такси? До Промзоны по двойному тарифу.', 'Taxi? Industrial Zone, double fare.'), ('Ян опять напьётся — повезу домой.', "Yan will get drunk again — I'll drive him home.")],
 'mechanic': [('«Омегу» сегодня осматривают дважды. Лаш едет.', "They're checking the Omega twice today. Lash is riding.")],
 'dispatcher': [('Вера опять не успевает проверять вызовы.', "Vera can't keep up with verifying calls again.")],
 'crew': [('Опору три не трогать — там Харт со своими камерами.', "Don't touch pillar three — Hart and his cameras are there.")],
 'depotman': [('Без детали седьмой встанет. Лиор её бережёт как ребёнка.', 'Without the part the 7th stops. Lior guards it like a child.')],
 'neighbor': [('В «Кольце» опять лифт стоит.', 'The Ring elevator is stuck again.'), ('Видели Мару Ренн? Бедная.', "Seen Mara Renn? Poor thing.")],
 'busker': [('Монетку за песню о дожде?', 'A coin for a song about rain?')],
 'drifter': [('Мне снилось, что сегодня уже было. Два раза.', 'I dreamed today already happened. Twice.'), ('Тоннель тёплый, когда вентиляция работает.', 'The tunnel is warm when the ventilation runs.')],
 'lookout': [('Мок всё видит. Мок всё помнит.', 'Mok sees everything. Mok remembers everything.')],
 'dronetech': [('Дроны в восемь на зарядку. Полчаса город без глаз.', 'Drones charge at eight. Half an hour the city has no eyes.')],
 'commuter': [('Седьмой опять опаздывает.', 'The 7th is late again.'), ('На мосту ремонт уже год.', "The bridge has been under repair for a year.")],
 'resident': [('Свет мигает с утра. Не к добру.', "Lights have been flickering since morning. Not a good sign."), ('Слышали про «Единую сеть»? Говорят, станет лучше.', "Heard about the Unified Grid? They say things will get better.")],
}
CTX = {
 'blackout': [('Темно! Светофоры сдохли, всё стоит!', 'Dark! The lights are dead, everything has stopped!'), ('Опять «Гелион». Всегда «Гелион».', 'Helion again. Always Helion.'), ('Домой, быстрее домой.', 'Home, hurry home.')],
 'rain': [('Этот дождь не кончится никогда.', 'This rain will never end.'), ('Кислотный сегодня. Чувствуешь?', "Acidic today. Can you feel it?")],
 'alarm': [('Слышал сирены? У башни что-то случилось.', 'Hear the sirens? Something happened at the tower.')],
 'echo': [('Странно… Мне кажется, я вас уже видел. Здесь. Сегодня.', "Strange… I feel I've seen you before. Here. Today.")],
}
bark_keys = {}
for arch, lines in BARKS.items(): bark_keys[arch] = [key('bark', ru, en) for ru, en in lines]
ctx_keys = {c: [key('bark', ru, en) for ru, en in lines] for c, lines in CTX.items()}

FACT_TEXT = {
 'pike_badge': ('Пайк забыл пропуск; Лея несёт его на подстанцию после школы', 'Pike forgot his badge; Lea brings it to the substation after school'),
 'walk_time': ('Школа → подстанция: пешком ~30 мин, трамваем №7 ~15', 'School → substation: ~30 min on foot, ~15 by tram #7'),
 'pike_obeys': ('Пайк выполняет любые приказы «диспетчера»', "Pike obeys any 'dispatcher' order"),
 'yan_regulation': ('Ребёнок на объекте → Ян оформляет инцидент и остаётся на 40 мин', 'Child on site → Yan files an incident and stays 40 min'),
 'mok_collectors': ('Опоздавшему должнику Мок посылает сборщиков на работу', 'Mok sends collectors to a late debtor\'s workplace'),
 'feeders': ('Фидеры: клиника — 3, светофоры — 5, вентиляция тоннеля — 1', 'Feeders: clinic 3, traffic lights 5, tunnel ventilation 1'),
 'chip_time': ('Редкий чип появляется у Мока в 20:20', "The rare chip appears at Mok's at 20:20"),
 'hart_info': ('Харта не уговорить: только тихо, и камеры нужно зациклить', "Hart can't be persuaded: only quietly, and the cameras must be looped"),
 'nisa_services': ('Ниса: поддельный звонок, чип-петля, устройство для порта', 'Nisa: forged call, loop chip, port device'),
 'osip_loyalty': ('Осип служит Лашу ради лечения Мары; если ей хуже — останется с ней', "Osip serves Lash for Mara's treatment; if she worsens he stays with her"),
 'omega_protocol': ('«Омега-9» открывает дверь при угрозе столкновения; осмотр в 19:05', 'Omega-9 opens its door on collision threat; inspected at 19:05'),
 'feld_strict': ('Фельд не остановится на мосту ни при каких условиях', 'Feld will not stop on the bridge under any circumstances'),
 'clinic_gen': ('Генератор клиники держит 40 минут', 'The clinic generator lasts 40 minutes'),
 'kay_plan': ('Кай прорвётся в холл, если у входа не будет патруля', 'Kai will break into the hall if no patrol is at the entrance'),
 'office_empty': ('15:30 Ила встречается с Каем на рынке — её кабинет пуст', "15:30 Ila meets Kai at the market — her office is empty"),
 'password_rule': ('Пароль Илы = место первой машины в гараже после 19:00', "Ila's password = bay of the first car back in the garage after 19:00"),
 'route_rule': ('20:30: тоннель закрыт и мост в норме → мост, иначе тоннель', '20:30: tunnel closed and bridge normal → bridge, else tunnel'),
 'burn_schedule': ('Берн: 19:20 у башни, 21:20 на мосту (если светофоры работают)', 'Bern: 19:20 at the tower, 21:20 on the bridge (if lights work)'),
 'billboard': ('Со щита у опоры 3 виден весь мост', 'The billboard at pillar 3 overlooks the whole bridge'),
 'false_calls': ('Вера не успевает проверять ложные вызовы', "Vera doesn't verify false calls in time"),
 'tram_stall': ('Без детали следующий трамвай встанет на мосту на 20 мин', 'Without the part the next tram stalls on the bridge for 20 min'),
 'window_truth': ('Контур «Гелиона» и Окно — одна технология', "Helion's loop and the Window are the same technology"),
 'jeton_time': ('Около 19:40 в ящике находок депо появляется жетон «Гелиона»', "Around 19:40 a Helion token turns up in the depot lost-and-found"),
}


# ---------------- information has a price: trust gates + small talk that builds trust ----------------
def gate(npc_id, ru_prefix, cond):
    for c in D[npc_id]['nodes']['main']['choices']:
        if TXT['ru'][c['k']].startswith(ru_prefix): c['if'] = (c.get('if', '') + ' ' + cond).strip()
gate('kay', 'Ила с тобой', 'trust>=1'); gate('yuna', 'Кто тут встречается', 'trust>=1'); gate('lior', 'Что в ящике', 'trust>=1')
gate('vera', 'Как вы отличаете', 'trust>=1'); gate('emil', 'А если детали', 'trust>=1'); gate('burn', 'Где вы дежурите', 'trust>=1')
SMALL = {
 'kay': ('[Эмпатия] Ты выглядишь вымотанным.', '[Empathy] You look exhausted.', 'Третьи сутки на ногах. Спасибо, что спросил. Немногие спрашивают.', "Third day on my feet. Thanks for asking. Few people do."),
 'yuna': ('[Эмпатия] Тяжёлый день?', '[Empathy] Rough day?', 'Курьер опять всё разлил, дождь, налоги «Гелиону»… Ладно. Ты хороший. Садись.', "The courier spilled everything again, rain, Helion taxes… Fine. You're alright. Sit."),
 'lior': ('[Эмпатия] Склад — твой дом, да?', '[Empathy] The storeroom is your home, isn\'t it?', 'Двадцать лет. Каждую гайку знаю по имени. Ты первый, кто это понял.', "Twenty years. I know every bolt by name. You're the first to get it."),
 'vera': ('[Эмпатия] Вы одна на весь район?', '[Empathy] You alone for the whole district?', 'Одна. Кофе и четыре патруля. Хоть кто-то заметил.', "Alone. Coffee and four patrols. At least someone noticed."),
 'emil': ('[Эмпатия] Любите свой трамвай?', '[Empathy] You love your tram?', 'Седьмой — как старый пёс. Скрипит, но везёт. Да, люблю.', "The 7th is like an old dog. Creaks, but carries on. Yes, I love it."),
 'burn': ('[Хладнокровие] Спокойная смена, офицер?', '[Composure] Quiet shift, officer?', 'Пока да. Вы вежливы — редкость. Чем помочь?', "So far. You're polite — that's rare. How can I help?"),
}
for nid, (ru, en, aru, aen) in SMALL.items():
    skl = 'cool' if nid == 'burn' else 'emp'
    D[nid]['nodes']['small'] = {'lines': [['npc', key(nid, aru, aen)]], 'choices': [], 'trust': 1}
    D[nid]['nodes']['small_f'] = {'lines': [['npc', key(nid, 'Мне некогда.', "I'm busy.")]], 'choices': []}
    D[nid]['nodes']['main']['choices'].insert(0, {'k': key(nid, ru, en), 'check': [skl, 2], 'to': 'small', 'fail': 'small_f', 'if': '!trust>=1'})

out = {'npcs': D, 'barks': bark_keys, 'ctx': ctx_keys}
json.dump(out, open(os.path.join(ROOT, 'src/data/dialogues.json'), 'w'), ensure_ascii=False, indent=1)
for lang, i in (('ru', 0), ('en', 1)):
    p = os.path.join(ROOT, f'src/data/i18n/{lang}.json'); d = json.load(open(p))
    nested = {}
    for k, v in TXT[lang].items():
        a, b = k.split('.'); nested.setdefault(a, {})[b] = v
    d['dlg'] = nested
    for k, v in FACT_TEXT.items(): d['ui']['fact'][k] = v[i]
    d['ui']['voice']['you'] = ''; d['ui']['voice']['npc'] = ''
    d['ui']['leave'] = ('[Уйти]', '[Leave]')[i]
    d['ui']['check_ok'] = ('успех', 'success')[i]; d['ui']['check_fail'] = ('провал', 'failure')[i]
    d['ui']['jumped_back'] = ('Окно: возврат в {t}', 'Window: rewound to {t}')[i]
    d['ui']['jumped_fwd'] = ('Окно: перемотка до {t}', 'Window: fast-forward to {t}')[i]
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('nodes', sum(len(v['nodes']) for v in D.values()), 'texts', len(TXT['ru']))
