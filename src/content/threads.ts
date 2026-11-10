import { ThreadDef } from '../game/state';
import { at } from '../sim/time';
// Nit (spec 12.1): one line + a red marker on the map.
export const THREADS: Record<string, ThreadDef> = {
  prologue: { key: 'prologue', ru: 'Крыша башни. Поговорить с Крайн', en: 'Tower roof. Talk to Crane', marker: [{ x: -70, z: -58 }] },
  orven: { key: 'orven', ru: 'Орвен, ключник. Переулок Ключников', en: 'Orven, the locksmith. Kluchnikov alley', marker: [{ x: -46, z: -33.3 }] },
  orven_late: { key: 'orven_late', ru: 'Орвен ушёл в 22:02. Вернуться к 22:01 — прямо у его двери', en: 'Orven left at 22:02. Go back to 22:01, right at his door', marker: [{ x: -46, z: -33.3 }], timeHint: at(22, 1, 30) },
  ned: { key: 'ned', ru: 'Нед: рыжий, фуражка с медной бляхой. «Якорь», за мостом', en: 'Ned: red hair, courier cap with a brass badge. The Anchor, across the bridge', marker: [{ x: 0, z: 2.6 }, { x: 19.9, z: 9 }] },
  tavern: { key: 'tavern', ru: 'Таверна «Якорь»: люди Корда, ключ', en: 'The Anchor: Cord\'s men, the key', marker: [{ x: 19.9, z: 9 }] },
  gun: { key: 'gun', ru: 'Ствол. Лавка Фомы, Рыночная — потом «Якорь»', en: 'A gun. Foma\'s pawnshop, Rynochnaya — then the Anchor', marker: [{ x: -40, z: -14.4 }] },
  fight: { key: 'fight', ru: 'Вернуться в «Якорь», пока они там (до 22:12)', en: 'Back to the Anchor while they are still there (before 22:12)', marker: [{ x: 19.9, z: 9 }], timeHint: at(22, 3) },
  key: { key: 'key', ru: 'Что открывает ключ? Орвен точил ключи (до 22:10)', en: 'What does the key open? Orven cut keys (before 22:10)', marker: [{ x: -46, z: -33.3 }], timeHint: at(22, 8, 30) },
  safe: { key: 'safe', ru: 'Сейф Гейла. Курьерская контора', en: 'Gayl\'s safe. The courier office', marker: [{ x: 44, z: 23.2 }] },
  safe_early: { key: 'safe_early', ru: 'Сейф: нужно раньше 22:10', en: 'The safe: get there before 22:10', marker: [{ x: 44, z: 23.2 }], timeHint: at(22, 5) },
  anna: { key: 'anna', ru: 'Предупредить Анну. Приют св. Лукии', en: 'Warn Anna. St. Lucia orphanage', marker: [{ x: 50, z: -58 }] },
  tikhon: { key: 'tikhon', ru: 'Рулевой Тихон. Канатная, 4', en: 'Helmsman Tikhon. Kanatnaya 4', marker: [{ x: -38, z: 40.1 }] },
  wagon: { key: 'wagon', ru: 'Повозка в 22:40 → пирс 7', en: 'The wagon at 22:40 → pier 7', marker: [{ x: 50, z: -58 }, { x: 0, z: 0 }, { x: -9.5, z: 62 }] },
  tilda: { key: 'tilda', ru: 'Тильда у баржи. Лента Анки', en: 'Tilda at the barge. Anka\'s ribbon', marker: [{ x: -9.5, z: 62 }], timeHint: at(22, 22) },
  pier3: { key: 'pier3', ru: 'Пристань №3, 22:35. Стать рулевым', en: 'Pier 3 at 22:35. Become the helmsman', marker: [{ x: -42, z: 60 }], timeHint: at(22, 35) },
  pier7: { key: 'pier7', ru: 'Пирс 7. Ни слова ему', en: 'Pier 7. Not a word to him', marker: [{ x: -9.5, z: 64 }] },
};

export interface Marker { x: number; z: number; label?: string; }
/** B3: markers follow where the person really is at this minute; outside his window the place is marked with "will be here at ..." */
export function threadMarkers(key: string, t: number): Marker[] {
  const P = { tavern: { x: 19.9, z: 9 }, bridge: { x: 0.6, z: 1.85 }, orven: { x: -46, z: -33.3 } };
  switch (key) {
    case 'ned': if (t < at(22, 4)) return [{ ...P.tavern, label: 'Нед в «Якоре» до 22:04' }]; if (t < at(22, 6)) return [{ ...P.bridge, label: 'Нед будет здесь в 22:06' }]; if (t < at(22, 14, 30)) return [{ ...P.bridge, label: 'Нед у перил до 22:14' }]; return [{ ...P.bridge, label: 'Нед был здесь 22:06–22:14' }];
    case 'orven': case 'orven_late': return [{ ...P.orven, label: t < at(22, 2, 10) ? 'Орвен у двери до 22:02' : 'Орвен ушёл в 22:02' }];
    case 'fight': return [{ ...P.tavern, label: t < at(22, 12) ? 'люди Корда здесь до 22:12' : 'пусто после 22:15' }];
    default: return (THREADS[key]?.marker ?? []).map(m => ({ ...m }));
  }
}
