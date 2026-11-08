// All UI strings are keys. Russian is the source language; English is kept short and conversational.
export type Lang = 'ru' | 'en';
export const UI: Record<string, { ru: string; en: string }> = {
  'hint.controls': { ru: 'WASD ходить · Shift бег · Пробел прыжок · C присесть · E действие · Tab Створка · T ждать', en: 'WASD move · Shift run · Space jump · C crouch · E use · Tab Device · T wait' },
  'tab.time': { ru: 'Время', en: 'Time' }, 'tab.thread': { ru: 'Нить', en: 'Thread' }, 'tab.people': { ru: 'Люди', en: 'People' },
  'tab.map': { ru: 'Карта', en: 'Map' }, 'tab.pocket': { ru: 'Карман', en: 'Pocket' }, 'tab.messages': { ru: 'Сообщения', en: 'Messages' }, 'tab.branch': { ru: 'Эта ветка', en: 'This branch' },
  'jump': { ru: 'Прыжок', en: 'Jump' }, 'jump.hold': { ru: 'Удерживай — предпросмотр', en: 'Hold to preview' },
  'jump.denied': { ru: 'Там нельзя стоять', en: "You can't stand there" },
  'now': { ru: 'Сейчас', en: 'Now' }, 'target': { ru: 'Выбрано', en: 'Selected' },
  'bookmark': { ru: 'Закладка (B)', en: 'Bookmark (B)' },
  'pocket.empty': { ru: 'Карман пуст. Один предмет переживёт прыжок.', en: 'Empty. One item survives a jump.' },
  'branch.none': { ru: 'С последнего прыжка ничего не изменилось.', en: 'Nothing has changed since the last jump.' },
  'journal.none': { ru: 'Пока никого не встретил.', en: 'Nobody met yet.' },
  'press.e': { ru: 'E', en: 'E' },
  'locked': { ru: 'Заперто', en: 'Locked' },
  'dead.title': { ru: 'Смерть окончательна', en: 'Death is final' },
  'empty.hour': { ru: 'Пустой час', en: 'The Empty Hour' },
  'sync': { ru: 'СИНХРОНИЗАЦИЯ УДЕРЖАНА', en: 'SYNCHRONISATION HELD' },
  'wait': { ru: 'ждать…', en: 'waiting…' },
  'close': { ru: 'Закрыть', en: 'Close' },
  'continue': { ru: 'Дальше', en: 'Continue' },
  'cant.wait': { ru: 'Рядом враг — ждать нельзя', en: 'An enemy is watching — no waiting' },
};
let lang: Lang = 'ru';
export const setLang = (l: Lang) => { lang = l; };
export const getLang = () => lang;
export const tr = (k: string) => UI[k]?.[lang] ?? UI[k]?.ru ?? k;
export const pick = (o: { ru: string; en: string }) => o[lang] || o.ru;
