import { fmt } from '../sim/time';
import { getLang, tr } from './strings';
const $ = (id: string) => document.getElementById(id)!;
export class Hud {
  private subT = 0; private toastT = 0; private threadT = 0; private lastBark = -99;
  constructor() { $('hint').textContent = tr('hint.controls'); }
  clock(t: number) { $('clock').textContent = fmt(t, true); }
  prompt(text: string | null, key = 'E') { const p = $('prompt'); if (!text) { p.style.display = 'none'; return; } p.style.display = 'block'; p.innerHTML = `<b>${key}</b>${text}`; }
  sub(who: string, text: string, secs = 3.5) { const s = $('sub'); s.style.display = 'block'; s.innerHTML = (who ? `<span class="n">${who}</span>` : '') + text; this.subT = secs; }
  /** Tik's own voice: at most one line per 30 real seconds (spec 12.3) unless forced */
  bark(text: string, force = false) { const n = performance.now() / 1000; if (!force && n - this.lastBark < 30) return false; this.lastBark = n; this.sub('', `<i>${text}</i>`, 3); return true; }
  toast(text: string, secs = 3) { const t = $('toast'); t.textContent = text; t.style.opacity = '1'; this.toastT = secs; }
  thread(text: string, secs = 6) { const t = $('thread'); t.textContent = text; t.style.opacity = '1'; this.threadT = secs; }
  fade(on: boolean, ms = 500) { const f = $('fade'); f.style.transition = `opacity ${ms}ms`; f.style.opacity = on ? '1' : '0'; }
  flash(on: number) { $('flash').style.opacity = String(on); }
  hurt(v: number) { $('red').style.opacity = String(v); }
  ghost(on: boolean) { $('ghost').style.display = on ? 'block' : 'none'; }
  sync(on: boolean) { const s = $('sync'); s.style.display = on ? 'block' : 'none'; s.textContent = tr('sync'); }
  update(dt: number) {
    if (this.subT > 0 && (this.subT -= dt) <= 0) $('sub').style.display = 'none';
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) $('toast').style.opacity = '0';
    if (this.threadT > 0 && (this.threadT -= dt) <= 0) $('thread').style.opacity = '0';
  }
  lang() { return getLang(); }
  refresh() { $('hint').textContent = tr('hint.controls'); }
}
