import { UI } from './data/ui_texts';
import { TEXTS } from './sim/dialogData';
import { PROP_TEXTS } from './data/props_texts';
import { BARK_TEXTS } from './data/barks';

export type Lang = 'ru' | 'en';
const all: Record<string, [string, string]> = { ...UI, ...TEXTS, ...PROP_TEXTS, ...BARK_TEXTS };
export const ALL_TEXTS = all;
let lang: Lang = (() => { try { return (localStorage.getItem('lang') as Lang) || 'ru'; } catch { return 'ru'; } })();
const subs: (() => void)[] = [];
export const getLang = () => lang;
export function setLang(l: Lang) { lang = l; try { localStorage.setItem('lang', l); } catch { /* ignore */ } subs.forEach((f) => f()); }
export const onLang = (f: () => void) => subs.push(f);
export function t(key: string, params: Record<string, string | number> = {}): string {
  const e = all[key]; if (!e) return key;
  let s = e[lang === 'ru' ? 0 : 1] || e[0];
  for (const k of Object.keys(params)) s = s.split(`{${k}}`).join(String(params[k]));
  return s;
}
export const has = (key: string) => key in all;
