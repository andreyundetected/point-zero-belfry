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
  threadBar(text: string) { const t = $('threadbar'); const h = text ? `<b>НИТЬ</b>${text}` : ''; if (t.innerHTML !== h) t.innerHTML = h; }
  thread(text: string, secs = 6) { const t = $('thread'); t.textContent = text; t.style.opacity = '1'; this.threadT = secs; }
  fade(on: boolean, ms = 500) { const f = $('fade'); f.style.transition = `opacity ${ms}ms`; f.style.opacity = on ? '1' : '0'; }
  flash(on: number) { $('flash').style.opacity = String(on); }
  hurt(v: number) { $('red').style.opacity = String(v); }
  ghost(on: boolean) { $('ghost').style.display = on ? 'block' : 'none'; }
  sync(on: boolean) { const s = $('sync'); s.style.display = on ? 'block' : 'none'; s.textContent = tr('sync'); }
  update(dt: number) {
    this.tickNewp(dt); this.tickNotes(dt);
    if (this.subT > 0 && (this.subT -= dt) <= 0) $('sub').style.display = 'none';
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) $('toast').style.opacity = '0';
    if (this.threadT > 0 && (this.threadT -= dt) <= 0) $('thread').style.opacity = '0';
  }
  private newpT = 0;
  /** "a new person met" card (top right), portrait filled in when it has been rendered */
  newPerson(name: string, sub: string, img?: string) { const e = $('newp'); $('newp-n').textContent = name; $('newp-s').textContent = sub; const im = $('newp-img') as HTMLImageElement; im.style.display = img ? 'block' : 'none'; if (img) im.src = img; e.style.display = 'flex'; requestAnimationFrame(() => (e.style.opacity = '1')); this.newpT = 6; }
  setPortrait(img: string) { const im = $('newp-img') as HTMLImageElement; im.src = img; im.style.display = 'block'; }
  pocket(label: string | null) { const p = $('pocket'); p.classList.toggle('has', !!label); (p.querySelector('.nm') as HTMLElement).textContent = label ?? 'Карман пуст'; (p.querySelector('.ic') as HTMLElement).textContent = label ? '◉' : '◌'; }
  tickNewp(dt: number) { if (this.newpT > 0 && (this.newpT -= dt) <= 0) { const e = $('newp'); e.style.opacity = '0'; setTimeout(() => { if (this.newpT <= 0) e.style.display = 'none'; }, 500); } }
  /** B1: stacked notifications (max 3, 4 s each), top right under the new-person card */
  private notes: { el: HTMLElement; t: number }[] = [];
  notify(text: string, glyph = '') { const box = $('notes'); const el = document.createElement('div'); el.className = 'note'; el.innerHTML = (glyph ? `<span class="glyph">${glyph}</span> ` : '') + text; box.appendChild(el); this.notes.push({ el, t: 4.5 }); while (this.notes.length > 3) { this.notes.shift()!.el.remove(); } }
  tickNotes(dt: number) { for (const n of this.notes) { n.t -= dt; if (n.t < 0.6) n.el.style.opacity = String(Math.max(0, n.t / 0.6)); } this.notes = this.notes.filter(n => { if (n.t <= 0) { n.el.remove(); return false; } return true; }); }
  weapon(label: string | null) { const w = $('weapon'); w.style.display = label ? 'flex' : 'none'; if (label) (w.querySelector('.nm') as HTMLElement).textContent = label; }
  waiting(on: boolean) { $('wait').style.display = on ? 'block' : 'none'; }
  /** title/pause: the HUD steps aside */
  menuMode(on: boolean) { document.body.classList.toggle('menu-on', on); }
  lang() { return getLang(); }
  refresh() { $('hint').textContent = tr('hint.controls'); }
}
