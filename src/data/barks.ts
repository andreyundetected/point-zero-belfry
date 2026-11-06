// Короткие реплики над головой («болтовня на ходу»): barks.<npc>.<n>, barks.rain.<n>
export const BARK_TEXTS: Record<string, [string, string]> = {};
export const BARKS: Record<string, string[]> = {};
const B = (npc: string, lines: [string, string][]) => { BARKS[npc] = lines.map((l, i) => { const k = `barks.${npc}.${i}`; BARK_TEXTS[k] = l; return k; }); };
B('ignat', [['Согласно уставу…', 'By regulation…'], ['Дождь — не повод нарушать порядок.', 'Rain is no excuse to break order.'], ['Ключ? Ключ при мне. Всегда.', 'The key? On me. Always.']]);
B('matvey', [['Двадцать лет фонари зажигаю!', 'Twenty years I have lit these lamps!'], ['Трубы старые, спешка — враг.', 'The pipes are old, haste is the enemy.'], ['Ещё чаю, и пойду.', 'One more tea, then I go.']]);
B('orven', [['Без флага сигнал не поднять.', 'No flag, no signal.'], ['Где же швея?', 'Where is the seamstress?']]);
B('boris', [['Бочки с маслом — не картошка.', 'Barrels of oil are not potatoes.'], ['Мачта молчит — значит, швартуюсь.', 'The mast is silent — so I moor.']]);
B('luka', [['Без билета не пущу!', 'No ticket, no ride!'], ['Трамвай не ждёт!', 'The tram waits for no one!']]);
B('foma', [['А вот я слыхал…', 'Now I heard that…'], ['Вчера было… или позавчера?', 'Yesterday it was… or the day before?']]);
B('tilda', [['Тяжёлое. Но я справлюсь.', 'Heavy. But I’ll manage.'], ['Только бы успеть к сигналу…', 'If only I make it before the signal…'], ['Где же мой проездной?', 'Where is my pass?']]);
B('agata', [['Не стой у плиты!', 'Don’t stand by the stove!'], ['Рагу не любит спешки.', 'Stew hates haste.']]);
B('mira', [['Билеты! Свежий «Вестник»!', 'Tickets! Fresh Herald!'], ['Два гроша, и ни медяком меньше!', 'Two coins, not a copper less!']]);
B('pip', [['Блестящее! Где-то блестит…', 'Shiny! Something shines somewhere…'], ['Я не скажу!', 'I won’t tell!']]);
B('zoya', [['Дождь смывает следы.', 'Rain washes away tracks.'], ['Маленькая беда тянет большую.', 'A small trouble drags a big one.']]);
B('klara', [['Сцена не готова!', 'The stage isn’t ready!'], ['Фонари! Где фонари?!', 'The lamps! Where are the lamps?!']]);
B('rain', [['Ну и дождь…', 'What a downpour…'], ['Лужи по колено!', 'Puddles up to the knee!'], ['Мокро, как в колодце.', 'Wet as a well.'], ['Туман сегодня — хоть ножом режь.', 'The fog tonight — you could cut it.']]);
B('alarm', [['Пожар!', 'Fire!'], ['Все на улицу!', 'Everyone out!']]);
