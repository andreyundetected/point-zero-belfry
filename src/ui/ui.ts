import { t, getLang, setLang, onLang, has } from '../i18n';
import type { NodeView, InspectView } from '../sim/dialog';
import type { ChronItem, Chronicle } from '../sim/chronicle';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };

export interface Verb { key: string; label: string; run: () => void }

export class UI {
  root = document.getElementById('ui') ?? (() => { const d = el('div'); d.id = 'ui'; document.body.appendChild(d); return d; })();
  clock = el('div', 'clock'); hudR = el('div', 'hud-r'); promptEl = el('div', 'prompt'); toastEl = el('div', 'toast'); banner = el('div', 'banner'); hint = el('div', 'hint');
  modal: HTMLDivElement | null = null; barks: HTMLDivElement[] = [];
  private toastT = 0;
  constructor() {
    const top = el('div', 'hud-top'); top.append(this.clock, this.hudR);
    this.promptEl.style.display = 'none';
    this.root.append(top, this.promptEl, this.toastEl, this.banner, this.hint);
    this.hint.textContent = t('title.hint');
    onLang(() => { this.hint.textContent = t('title.hint'); });
  }
  get open() { return !!this.modal; }
  setHud(time: string, fast: boolean, hands: string, jumps: number, facts: number, flicker: boolean) {
    this.clock.innerHTML = `${time}<small>${fast ? t('hud.speed') : t('hud.speed1')} · ${t('hud.fast')}</small>`;
    this.hudR.innerHTML = `${t('hud.hands')}: <b>${hands}</b>${flicker ? ` <span class="flick">${t('hud.flicker')}</span>` : ''}<br>${t('hud.jumps')}: <b>${jumps}</b> · ${t('hud.facts')}: <b>${facts}</b><br><span style="opacity:.7">Q — ${t('jr.title')}</span>`;
  }
  prompt(name: string | null, verbs: Verb[] = []) {
    if (!name) { this.promptEl.style.display = 'none'; return; }
    this.promptEl.style.display = ''; this.promptEl.innerHTML = '';
    const n = el('span', 'nm', name); this.promptEl.append(n);
    verbs.forEach((v) => { const s = el('span', 'vb'); s.innerHTML = `<span class="key">${v.key}</span>${v.label}`; this.promptEl.append(s); });
  }
  toast(text: string, ms = 2600) { this.toastEl.textContent = text; this.toastEl.classList.add('on'); clearTimeout(this.toastT); this.toastT = window.setTimeout(() => this.toastEl.classList.remove('on'), ms); }
  setBanner(text: string) { this.banner.textContent = text; }
  bark(x: number, y: number, text: string) { const b = el('div', 'bark', text); b.style.left = x + 'px'; b.style.top = y + 'px'; this.root.append(b); this.barks.push(b); setTimeout(() => { b.remove(); this.barks = this.barks.filter((q) => q !== b); }, 3200); }
  closeModal() { this.modal?.remove(); this.modal = null; }
  private mk(center = false) { this.closeModal(); const m = el('div', 'modal' + (center ? ' center' : '')); const c = el('div', 'card'); m.append(c); this.root.append(m); this.modal = m; return c; }

  // -------- диалог --------
  dialog(npcName: string, role: string, view: NodeView, onPick: (id: string) => void, onClose: () => void, extra: string[] = []) {
    const c = this.mk(); const h = el('h2', '', `${npcName}`); const sub = el('div', '', role); sub.style.cssText = 'color:var(--dim);font-size:14px;margin-bottom:8px'; c.append(h, sub);
    for (const l of view.lines) {
      const isSkill = l.who !== 'npc';
      const d = el('div', 'line' + (isSkill ? ' skill' : '')); const w = el('span', 'who', isSkill ? `[${t('skill.' + l.who)}]` : npcName + ':'); d.append(w, document.createTextNode(' ' + t(l.k))); c.append(d);
    }
    for (const e of extra) c.append(el('div', 'line skill', e));
    const box = el('div', 'choices');
    view.choices.forEach((ch, i) => {
      const b = el('button', 'btn'); b.innerHTML = `<span class="key">${i + 1}</span>${esc(t(ch.k))}`;
      if (ch.check) { const s = el('span', 'chk ' + (ch.check.ok ? 'ok' : 'no')); s.textContent = `${t('skill.' + ch.check.skill)} ${ch.check.have}/${ch.check.dc}`; b.append(s); }
      b.onclick = () => onPick(ch.id); box.append(b);
    });
    if (!view.choices.length) { const b = el('button', 'btn'); b.innerHTML = `<span class="key">1</span>${t('ui.close')}`; b.onclick = onClose; box.append(b); }
    c.append(box);
    const keyHandler = (e: KeyboardEvent) => { const n = Number(e.key); if (n >= 1 && n <= 9) { if (!view.choices.length) { onClose(); } else if (view.choices[n - 1]) onPick(view.choices[n - 1].id); } if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', keyHandler, { once: true });
    (this.modal as HTMLElement).dataset.k = '1';
  }
  // -------- осмотр --------
  inspect(v: { name: string; desc: string; voices: { skill: string; text: string }[]; facts: string[] }, onClose: () => void) {
    const c = this.mk(); c.append(el('h2', '', v.name)); if (v.desc) c.append(el('div', 'line', v.desc));
    for (const x of v.voices) { const d = el('div', 'line skill'); d.append(el('span', 'who', `[${t('skill.' + x.skill)}]`), document.createTextNode(' ' + x.text)); c.append(d); }
    for (const f of v.facts) { const x = el('div', 'fact'); x.innerHTML = `<i>${f}</i>${esc(t('k.' + f))}`; c.append(x); }
    const b = el('button', 'btn', t('ui.close')); b.onclick = onClose; appendRow(c, b); b.focus();
  }
  note(title: string, body: string, onClose: () => void) { const c = this.mk(); c.append(el('h2', '', title)); const d = el('div', 'line', body); c.append(d); const b = el('button', 'btn', t('ui.close')); b.onclick = onClose; appendRow(c, b); b.focus(); }
  // -------- вентили --------
  valves(state: { P: number; v: number; w: number; open: boolean; locked: boolean }, act: (kind: string, val?: number) => void, onClose: () => void) {
    const c = this.mk(); c.append(el('h2', '', t('valve.title')));
    const g = el('div', 'gauge', `${state.P.toFixed(2)}`); const gl = el('div', '', t('valve.gauge')); gl.style.color = 'var(--dim)'; c.append(g, gl);
    if (!state.open) { c.append(el('div', 'line', t('valve.closed'))); const b = el('button', 'btn', t('valve.unlock')); b.onclick = () => act('unlock'); c.append(b); }
    else {
      for (const [k, label, val] of [['supply', t('valve.supply'), state.v], ['bleed', t('valve.bleed'), state.w]] as [string, string, number][]) {
        const r = el('div', 'slider'); const lab = el('span', '', label); lab.style.minWidth = '230px'; const inp = document.createElement('input'); inp.type = 'range'; inp.min = '0'; inp.max = '100'; inp.value = String(Math.round(val * 100));
        const out = el('span', 'key', inp.value + '%'); inp.oninput = () => { out.textContent = inp.value + '%'; }; inp.onchange = () => act(k, Number(inp.value) / 100); r.append(lab, inp, out); c.append(r);
      }
      const b = el('button', 'btn', t('valve.lock')); b.onclick = () => act('lock'); c.append(b);
    }
    const bc = el('button', 'btn', t('ui.close')); bc.onclick = onClose; appendRow(c, bc);
  }
  tavValve(state: { open: boolean; locked: boolean }, act: (k: string) => void, onClose: () => void) {
    const c = this.mk(); c.append(el('h2', '', t('valve.tav.title'))); c.append(el('div', 'line', state.open ? t('valve.tav.open') : t('valve.tav.closed') + (state.locked ? ' 🔒' : '')));
    const row = el('div', 'row');
    for (const [k, label] of [['open', t('valve.tav.open')], ['close', t('valve.tav.closed')], ['lock', t('valve.tav.lock')], ['unlock', t('valve.tav.unlock')]]) { const b = el('button', 'btn', label); b.onclick = () => act(k); row.append(b); }
    const bc = el('button', 'btn', t('ui.close')); bc.onclick = onClose; row.append(bc); c.append(row);
  }
  // -------- Окно --------
  windowPanel(o: { sealed: boolean; canLook: boolean; canBack: boolean; looked: boolean; carry: string; carryLost: boolean; cordon: boolean; headline?: [string, string] }, act: (k: string) => void) {
    const c = this.mk(true); c.append(el('h2', '', t('win.title')), el('div', 'line', t('win.sub')));
    if (o.sealed) c.append(el('div', 'line skill', t('win.sealed')));
    if (o.looked && o.headline) { c.append(el('div', 'line', t('ui.t1view'))); const nw = el('div', 'news'); nw.innerHTML = `<b>${esc(t(o.headline[0]))}</b><span>${esc(t(o.headline[1]))}</span>`; c.append(nw); }
    c.append(el('div', 'line', o.carryLost ? t('win.carry.lost') : o.carry ? t('win.carry', { item: o.carry }) : t('win.carry.none')));
    if (o.cordon && !o.looked) c.append(el('div', 'line skill', t('win.cordon')));
    const row = el('div', 'row');
    const mkb = (k: string, label: string, on: boolean) => { const b = el('button', 'btn' + (on ? '' : ' off'), label); if (on) b.onclick = () => act(k); row.append(b); };
    if (!o.looked) mkb('look', t('win.look'), o.canLook);
    mkb('back', t('win.back'), o.canBack);
    mkb('cancel', t('win.cancel'), true); c.append(row);
  }
  // -------- журнал --------
  journal(d: { facts: string[]; chron: Chronicle; tab: number; hl: number[] }, setTab: (n: number) => void, showChain: (it: ChronItem) => void, onClose: () => void, clock: (tm: number) => string, evText: (ev: ChronItem['ev']) => string) {
    const c = this.mk(true); c.append(el('h2', '', t('jr.title')));
    const tabs = el('div', 'tabs'); [t('jr.facts'), t('jr.threads'), t('jr.chronicle')].forEach((n, i) => { const b = el('div', 'tab' + (d.tab === i ? ' on' : ''), n); b.onclick = () => setTab(i); tabs.append(b); }); c.append(tabs);
    if (d.tab === 0) { if (!d.facts.length) c.append(el('div', 'line', t('jr.none'))); for (const f of d.facts) { const x = el('div', 'fact'); x.innerHTML = `<i>${f}</i>${esc(t('k.' + f))}`; c.append(x); } }
    if (d.tab === 1) {
      c.append(el('div', 'line skill', t('jr.thread.hint')));
      const th: [string, string[]][] = [['th.1', ['K6', 'K8', 'K10']], ['th.2', ['K10', 'K5', 'K2']], ['th.3', ['K4', 'K3', 'K5']]];
      let any = false; for (const [k, need] of th) if (need.every((f) => d.facts.includes(f))) { any = true; const x = el('div', 'fact'); x.innerHTML = `<i>⟷</i>${esc(t(k))} <span style="color:var(--dim)">(${need.join(' · ')})</span>`; c.append(x); }
      if (!any) c.append(el('div', 'line', t('jr.none')));
    }
    if (d.tab === 2) {
      const ch = d.chron;
      c.append(el('div', 'line skill', t('jr.diff')));
      if (!ch.items.length) c.append(el('div', 'line', t('jr.none')));
      for (const it of ch.items) {
        const r = el('div', 'ev' + (it.witnessed ? '' : ' un') + (d.hl.includes(it.ev.id) ? ' chain' : ''));
        r.append(el('span', 't', clock(it.ev.t)), el('span', '', it.witnessed ? evText(it.ev) : t('jr.unseen')), el('span', 'sg', `${t('jr.sig')} ${it.significance}`));
        const b = el('button', 'smallbtn', t('jr.chain')); b.onclick = () => showChain(it); r.append(b); c.append(r);
      }
      if (d.hl.length) { c.append(el('h3', '', t('jr.chain'))); for (const id of d.hl) { const it = ch.all.find((a) => a.ev.id === id); if (!it) continue; const r = el('div', 'ev' + (it.witnessed ? '' : ' un')); r.append(el('span', 't', clock(it.ev.t)), el('span', '', it.witnessed ? evText(it.ev) : t('jr.unseen')), el('span', ''), el('span', '')); c.append(r); } }
      if (ch.prevented.length) { c.append(el('h3', '', t('jr.prevented'))); for (const e of ch.prevented) { const r = el('div', 'ev un'); r.append(el('span', 't', clock(e.t)), el('span', '', evText(e)), el('span', ''), el('span', '')); c.append(r); } }
    }
    const b = el('button', 'btn', t('ui.close')); b.onclick = onClose; appendRow(c, b);
  }
  // -------- финал --------
  ending(o: { kind: string; headline: [string, string]; items: string[]; onAgain: () => void; locked: boolean }) {
    const c = this.mk(true); c.append(el('h2', '', t('end.title')));
    c.append(el('div', 'endk ' + o.kind, t('end.' + o.kind)), el('div', 'line', t('end.' + o.kind + '.t')));
    const nw = el('div', 'news'); nw.innerHTML = `<b>${esc(t(o.headline[0]))}</b><span>${esc(t(o.headline[1]))}</span>`; c.append(nw);
    c.append(el('h3', '', t('end.shifted')));
    if (!o.items.length) c.append(el('div', 'line', t('end.noshift'))); for (const s of o.items) c.append(el('div', 'fact', s));
    if (!o.locked) { const b = el('button', 'btn', t('end.again')); b.onclick = o.onAgain; appendRow(c, b); b.focus(); }
  }
  // -------- титульный экран --------
  title(onStart: () => void): { setProgress(p: number): void; ready(): void } {
    const m = el('div', 'title'); const render = () => {
      m.innerHTML = ''; m.append(el('h1', '', t('title.name')), el('p', '', t('title.sub')));
      const bar = el('div', 'bar'); const fill = el('i'); bar.append(fill); m.append(bar); (m as any)._fill = fill;
      const start = el('button', 'btn', t('title.loading')); start.disabled = true; (m as any)._start = start; start.onclick = onStart;
      const lang = el('button', 'btn', t('title.lang')); lang.onclick = () => { setLang(getLang() === 'ru' ? 'en' : 'ru'); render(); }; m.append(start, lang, el('div', 'small', t('title.hint')));
      if ((m as any)._isReady) { start.textContent = t('title.start'); start.disabled = false; fill.style.width = '100%'; }
    };
    this.root.append(m); render();
    return { setProgress: (p) => { ((m as any)._fill as HTMLElement).style.width = Math.round(p * 100) + '%'; }, ready: () => { (m as any)._isReady = true; render(); }, };
  }
  removeTitle() { this.root.querySelector('.title')?.remove(); }
}
const appendRow = (c: HTMLElement, ...els: HTMLElement[]) => { const r = el('div', 'row'); r.append(...els); c.append(r); };
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
export { has };
export type { InspectView };
