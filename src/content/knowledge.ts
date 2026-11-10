import { at } from '../sim/time';
// B1/B2: everything the player learns is announced and written down. `t` = the minute the fact is about (⟲ when it is ahead of "now").
export interface Fact { ru: string; en: string; t?: number; who?: string; }
export const FACTS: Record<string, Fact> = {
  name_ned: { ru: 'Курьера зовут Нед', en: 'The courier is called Ned', who: 'ned' },
  know_ned_desc: { ru: 'Нед — рыжий, фуражка с медной бляхой', en: 'Ned: red hair, courier cap with a brass badge', who: 'ned' },
  know_ned_key: { ru: 'У Неда ключ, который точил Орвен. Нед пошёл в «Якорь»', en: 'Ned has the key Orven cut. He went to the Anchor', who: 'ned' },
  know_orven_left: { ru: 'Орвен ушёл в 22:02, записка «Буду через 3 часа»', en: 'Orven left at 22:02, note: "Back in 3 hours"', t: at(22, 2), who: 'orven' },
  know_ned_lost: { ru: 'Нед проиграл людям Корда часы, жетон и ключ', en: 'Ned lost his watch, token and key to Cord\'s men', t: at(22, 3), who: 'ned' },
  know_cord_men: { ru: 'В «Якоре» с вечера сидят восемь людей Корда', en: 'Eight of Cord\'s men have been sitting in the Anchor since evening' },
  name_ignat: { ru: 'Старший у людей Корда — Игнат: жилет, без шляпы', en: 'The senior of Cord\'s men is Ignat: waistcoat, no hat', who: 'ignat' },
  saw_blast: { ru: 'В 22:12 взрывается склад Харроу', en: 'Harrow\'s warehouse blows up at 22:12', t: at(22, 12) },
  know_foma_guns: { ru: 'Ствол — у Фомы на Рыночной', en: 'A gun: Foma on Rynochnaya', who: 'foma' },
  know_fire_2230: { ru: 'В 22:30 Рыночная и лавка Фомы горят', en: 'At 22:30 Rynochnaya and Foma\'s shop burn', t: at(22, 30) },
  know_gun_under_floor: { ru: 'Ствол Фомы — в кладовке, под половицей', en: 'Foma\'s gun is in the storeroom, under a floorboard', who: 'foma' },
  saw_ned_jump: { ru: 'В 22:14 Нед прыгает с моста', en: 'At 22:14 Ned jumps from the bridge', t: at(22, 14), who: 'ned' },
  know_tilda: { ru: 'Тильда ищет дочь Анку, 8 лет, красная лента', en: 'Tilda is looking for her daughter Anka, 8, a red ribbon', who: 'tilda' },
  know_lukyan: { ru: 'Детей грузят на баржу Лукьяна «Вера», пирс 7', en: 'Children are loaded onto Lukyan\'s barge Vera, pier 7' },
  know_safe: { ru: 'Ключ — от сейфа Гейла в курьерской конторе', en: 'The key opens Gayl\'s safe at the courier office', who: 'gayl' },
  know_gayl_wife: { ru: 'Жена Гейла Анна — сестра в приюте', en: 'Gayl\'s wife Anna is a nurse at the orphanage', who: 'anna' },
  know_scar_raid: { ru: 'Человек со шрамом входит в контору по жетону Неда в 22:10', en: 'A man with a scar enters the office on Ned\'s token at 22:10', t: at(22, 10), who: 'scar' },
  know_helmsmen: { ru: 'Рулевой катера — Тихон, Канатная 4; «после рейса списать»', en: 'The launch helmsman is Tikhon, Kanatnaya 4: "write off after the trip"', who: 'tikhon' },
  know_manifest: { ru: 'Дети приюта: 22:40 повозка → пирс 7, баржа «Вера»', en: 'Orphanage children: 22:40 wagon → pier 7, barge Vera', t: at(22, 40) },
  saw_yan_killed: { ru: 'В 22:35 на пристани №3 убивают рулевого Яна', en: 'At 22:35 helmsman Yan is killed on pier 3', t: at(22, 35), who: 'yan' },
  know_tap_man: { ru: 'Около 22:00 человек с чемоданом был в подвале башни', en: 'Around 22:00 a man with a suitcase was in the tower cellar', t: at(22, 0) },
  know_fuse: { ru: 'Красный предохранитель отвода — в подвале башни', en: 'The red fuse of the tap is in the tower cellar' },
  know_anka_orphanage: { ru: 'Анка — в приюте, ещё там', en: 'Anka is at the orphanage, still there', who: 'anka' },
  know_ledger: { ru: 'В книге приюта: «Тимофей, 7 лет — отложен»', en: 'In the ledger: "Timofey, 7 — set aside"' },
};
