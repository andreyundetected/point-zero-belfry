import ru from './data/i18n/ru.json';
import en from './data/i18n/en.json';
export type Lang = 'ru' | 'en';
const dicts = { ru, en } as const;
let lang: Lang = (() => { try { return (localStorage.getItem('lang') as Lang) || 'ru'; } catch { return 'ru'; } })();
const listeners: (() => void)[] = [];
export const getLang = () => lang;
export function setLang(l: Lang) { lang = l; try { localStorage.setItem('lang', l); } catch { /* ignore */ } listeners.forEach(f => f()); }
export const onLang = (f: () => void) => listeners.push(f);
function dig(o: any, path: string): any { return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
export function t(path: string, params: Record<string, string> = {}): string {
  let s = dig(dicts[lang], path) ?? dig(dicts.en, path) ?? path;
  if (typeof s !== 'string') return path;
  for (const k of Object.keys(params)) s = s.replace(`{${k}}`, params[k]);
  return s;
}
function h(str: string) { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x; }
const pick = (list: string, k: number) => { const a = t(list).split('|'); return a[k % a.length]; };
export const npcName = (id: string) => {
  const m = /^c_([a-z0-9]+)_(\d+)$/.exec(id);
  return m ? `${pick('names.first', h(id))} ${pick('names.last', h(id + 'L'))}` : t('npc.' + id);
};
export const locName = (id: string) => {
  const m = /^([hwk])_(\d+)$/.exec(id);
  if (!m) return t('loc.' + id);
  const kind = { h: 'home', w: 'office', k: 'cafe' }[m[1]]!;
  return t('place.' + kind, { s: pick('names.streets', h(id)), n: String(2 + h(id + 'n') % 60) });
};
