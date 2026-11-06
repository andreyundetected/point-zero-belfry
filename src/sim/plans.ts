// Программы ветки для солвера/автопилота: макро-действия игрока поверх Session.
import { Session } from './session';
import { T1, TIMES, hm } from './map';

export type Prog = (S: Session) => void;

/** Урок ключа: ключ с крюка после 21:36 → Окно (запечатано до первого прыжка с ключом). */
export const lesson: Prog = (S) => {
  S.gotoNpc('ignat', 1); S.talk('ignat', ['tea']);
  S.waitUntil(TIMES.ignatTea + 8);
  S.gotoObj('booth_hook', 1); S.take('key');
  S.goto('window'); if (!S.returnT0()) throw new Error('lesson: Окно не сработало');
};

/** Наблюдение: собирает K2..K10 и доживает до T1 (K1). */
export const observe: Prog = (S) => {
  S.gotoObj('bureau_journal'); S.inspect('bureau_journal');            // K10
  S.gotoObj('kiosk'); S.inspect('kiosk');                              // K7
  S.gotoObj('ks1', 1); S.use('ks1_door', 'unlock'); S.inspect('ks1'); S.use('ks1_door', 'lock'); // K3 (нужен ключ)
  S.gotoObj('tilda_shelf'); S.inspect('tilda_shelf');                  // K6
  S.gotoObj('rug'); S.use('rug'); S.gotoObj('tav_valve'); S.inspect('tav_valve'); // K9
  S.waitUntil(TIMES.pipStash + 6); S.gotoObj('chest'); S.inspect('chest');        // K8
  S.gotoNpc('matvey'); S.talk('matvey', ['mem']);                      // K5
  if (S.w.player.hands && S.w.items[S.w.player.hands].kind === 'key') {  // вернуть ключ Игнату: иначе фонарщик не откроет шкаф и ночь пойдёт иначе
    S.waitUntil(TIMES.ignatBack + 15); S.gotoNpc('ignat'); S.talk('ignat', ['give']);
  }
  S.gotoObj('kit_joint', 1); while (!S.w.gas.leakOn && S.t < T1 - 30) S.wait(5); S.wait(5); S.inspect('kit_joint'); // K2 (стык течёт)
  S.advanceTo(T1);                                                     // K1 (пожар виден в T1)
};

export const carryKey: Prog = (S) => {
  if (S.w.player.hands) S.do({ k: 'drop' }, 2);
  S.waitUntil(TIMES.ignatTea + 8); S.gotoObj('booth_hook', 1); S.take('key');
  S.goto('window'); if (!S.returnT0()) throw new Error('carryKey: Окно не сработало');
};
export const carryCoin: Prog = (S) => {
  if (S.w.player.hands) S.do({ k: 'drop' }, 2);
  S.gotoObj('rug'); S.use('rug'); S.gotoObj('chest');
  S.waitUntil(TIMES.pipStash + 6); S.take('coinstack');
  S.goto('window'); if (!S.returnT0()) throw new Error('carryCoin: Окно не сработало');
};

export interface AOpts { bleedAt: number; keyTo: 'none' | 'ignat' | 'matvey'; keyAt: number }
/** A «Стравить давление»: ключ-двойник открывает КШ-1, стравливание ДО 21:36, шкаф запирается. */
export const finalA = (o: AOpts): Prog => (S) => {
  S.gotoObj('ks1', 1); S.waitUntil(o.bleedAt);
  S.use('ks1_door', 'unlock'); S.use('ks1_bleed', 1); S.use('ks1_door', 'lock');
  S.goto('emb_b', 1); S.goto('sq_c');
  if (o.keyTo !== 'none') {
    S.waitUntil(o.keyAt);
    if (o.keyTo === 'ignat') { S.gotoNpc('ignat'); S.talk('ignat', ['give']); }
    else { S.gotoNpc('matvey'); S.give('matvey'); }
  }
  S.advanceTo(T1);
};
export interface COpts { releaseAt: number }
/** C «Буквальный приказ»: кружка → доверие Матвея → «не открывай» → запереть вентиль таверны → «открывай». */
export const finalC = (o: COpts): Prog => (S) => {
  S.gotoObj('bar'); S.do({ k: 'buy', what: 'mug' }, 3);
  S.gotoNpc('matvey'); S.talk('matvey', ['toast']); S.talk('matvey', ['hold']);
  S.waitUntil(TIMES.ignatTea + 8); S.gotoObj('booth_hook', 1); S.take('key');
  S.gotoObj('rug'); S.use('rug'); S.gotoObj('tav_valve'); S.use('tav_valve', 0); S.do({ k: 'use', obj: 'tav_valve_lock', arg: 1 }, 4);
  S.waitUntil(o.releaseAt);
  S.gotoNpc('matvey'); S.give('matvey'); S.talk('matvey', ['release']);
  S.advanceTo(T1);
};
/** B «Вернуть дорогу Тильде»: билет за монеты → Тильде до 21:27. */
export const finalB: Prog = (S) => {
  S.gotoObj('kiosk'); S.do({ k: 'buy', what: 'ticket' }, 3);
  S.gotoNpc('tilda'); S.give('tilda');
  S.advanceTo(T1);
};
