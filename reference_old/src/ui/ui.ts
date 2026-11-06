import './style.css';
import { t, npcName, locName, getLang, setLang, onLang } from '../i18n';
import { fmt } from '../sim/util';
import { drawPortrait } from './portrait';
import type { Anomaly } from '../sim/anomalies';
import type { Ev } from '../sim/types';

export function evText(e: Ev): string {
  const a = e.actors.filter(x => x !== 'player').map(npcName).join(', ');
  return t('ev.' + e.type, { a, loc: locName(e.loc), route: String(e.data?.route ?? '') });
}

export interface Choice { label: string; cls?: string; run: () => void }

export class UI {
  el = (id: string) => document.getElementById(id)!;
  onJump: (t: number) => void = () => {};
  onTravel: (v: string) => void = () => {};
  onMenu: (a: string) => void = () => {};
  t0 = 0; t1 = 0; now = 0; target = 0;
  marks: { t: number; story: boolean }[] = [];

  constructor(root: HTMLElement, t0: number, t1: number) {
    this.t0 = t0; this.t1 = t1; this.target = t0;
    root.innerHTML = `
    <div id="clock" class="panel"><div class="time" id="tm">14:00</div>
      <div class="row"><span id="iv"></span><span class="spd" id="sp"></span></div><div class="keyh" id="kh"></div></div>
    <div id="mission" class="panel"><div id="mtxt"></div><div id="obj"></div></div>
    <div id="news" class="panel"><b></b><div class="mq"><span></span></div></div>
    <div id="emp" class="panel"><b></b><span></span></div><div id="tut" class="panel"><b></b><span></span></div>
    <div id="log" class="panel"></div>
    <div id="toast" class="panel"></div>
    <div id="opts" class="panel"></div>
    <div id="carry" class="panel"></div>
    <div id="res" class="panel"></div>
    <div id="win" class="panel">
      <div class="wtop"><h2 id="wt"></h2><span class="wnow" id="wnow"></span><span class="arrow">→</span><span class="wtar" id="wtar"></span></div>
      <div class="bar" id="bar"><div class="fill" id="bfill"></div><div class="marks" id="bmarks"></div><div class="nowm" id="bnow"></div><div class="tar" id="btar"></div></div>
      <div class="ticks"><span>14:00</span><span>15:00</span><span>16:00</span><span>17:00</span><span>18:00</span><span>19:00</span><span>20:00</span><span>21:00</span><span>22:00</span></div>
      <div class="wrow">
        <button data-d="-600">−10′</button><button data-d="-60">−1′</button><button data-d="60">+1′</button><button data-d="600">+10′</button><button id="w0"></button>
        <label class="carry"><span id="tl2"></span> <select id="tsel"></select></label>
        <button id="jb" class="big"></button>
      </div>
      <div class="whelp" id="whelp"></div>
    </div>
    <div id="pick"><div class="box panel"><h2 id="pk_t"></h2><div id="pk_l"></div><p class="ctl" id="pk_h"></p></div></div>
    <div id="menu"><div class="box panel"><h1 id="m_t"></h1>
      <button data-m="resume" id="m_r"></button><button data-m="lang" id="m_l"></button><button data-m="sound" id="m_s"></button>
      <button data-m="quality" id="m_q"></button><button data-m="restart" id="m_x"></button><p class="ctl" id="m_c"></p></div></div>
    <div id="dlg"><canvas id="por"></canvas><div class="tx"><div class="who"></div><div class="body"></div><div class="acts"></div><div class="cont"></div></div></div>
    <div id="start"><div class="box"><h1 id="st_t"></h1><p class="sub" id="st_s"></p><p id="st_x"></p><p class="ctl" id="st_c"></p>
      <div class="row2"><button id="st_b"></button><button id="st_tut"></button><button id="st_l"></button><button id="st_g"></button></div></div></div>
    <canvas id="mini" width="200" height="200"></canvas><canvas id="bigmap" width="1000" height="640"></canvas>
    <div id="cross"></div><div id="wpn"></div><div id="labels"></div><div id="ff"><span>◀◀ ◀◀ ◀◀</span></div>`;
    const bar = this.el('bar');
    const fromX = (x: number) => { const r = bar.getBoundingClientRect(); return this.t0 + Math.round(((x - r.left) / r.width) * (this.t1 - this.t0) / 60) * 60; };
    let drag = false;
    bar.onpointerdown = e => { drag = true; bar.setPointerCapture(e.pointerId); this.setTarget(fromX(e.clientX)); };
    bar.onpointermove = e => { if (drag) this.setTarget(fromX(e.clientX)); };
    bar.onpointerup = () => { drag = false; };
    this.el('win').querySelectorAll<HTMLElement>('[data-d]').forEach(b => (b.onclick = () => this.setTarget(this.target + +b.dataset.d!)));
    this.el('w0').onclick = () => this.setTarget(this.t0);
    this.el('jb').onclick = () => this.onJump(this.target);
    (this.el('tsel') as HTMLSelectElement).onchange = e => this.onTravel((e.target as HTMLSelectElement).value);
    this.el('st_l').onclick = () => setLang(getLang() === 'ru' ? 'en' : 'ru');
    this.el('menu').querySelectorAll<HTMLElement>('[data-m]').forEach(b => (b.onclick = () => this.onMenu(b.dataset.m!)));
    onLang(() => this.static());
    this.static();
  }

  static() {
    this.el('wt').textContent = t('ui.window'); this.el('jb').textContent = t('ui.jump'); this.el('w0').textContent = t('ui.point0');
    this.el('whelp').textContent = t('ui.window_help');
    this.el('mtxt').textContent = t('ui.mission');
    this.el('kh').textContent = t('ui.key_hint');
    document.documentElement.lang = getLang();
    this.el('st_t').textContent = t('ui.intro_title'); this.el('st_s').textContent = t('ui.intro_sub'); this.el('st_x').textContent = t('ui.intro_text'); this.el('st_c').textContent = t('ui.controls');
    this.el('st_b').textContent = t('ui.m_new'); this.el('st_l').textContent = t('ui.lang'); this.el('st_tut').textContent = t('ui.m_tut');
    this.el('m_t').textContent = t('ui.menu'); this.el('m_r').textContent = t('ui.resume'); this.el('m_x').textContent = t('ui.restart');
    this.el('m_c').textContent = t('ui.controls');
    this.menuState(this.lastMenu.sound, this.lastMenu.quality);
  }
  lastMenu = { sound: true, quality: 'high' };
  menuState(sound: boolean, quality: string) {
    this.lastMenu = { sound, quality };
    this.el('m_l').textContent = `${t('ui.language')}: ${getLang().toUpperCase()}`;
    this.el('m_s').textContent = `${t('ui.sound')}: ${t(sound ? 'ui.on' : 'ui.off')}`;
    this.el('m_q').textContent = `${t('ui.quality')}: ${t('ui.' + quality)}`;
    const sg = document.getElementById('st_g'); if (sg) sg.textContent = `${t('ui.m_gfx')}: ${t('ui.' + quality)}`;
  }
  objective(txt: string) { const el = this.el('obj'); if (el.textContent !== txt) el.textContent = txt; }
  tutorial(step: string | null, txt: string) { const el = this.el('tut'); if (!step) { el.style.display = 'none'; return; } el.style.display = 'block'; el.querySelector('b')!.textContent = `${t('tut.title')} ${step}`; el.querySelector('span')!.textContent = txt; }
  weapon(txt: string) { const el = this.el('wpn'); if (el.textContent !== txt) el.textContent = txt; el.style.display = txt ? 'block' : 'none'; }
  pickOpen() { return this.el('pick').classList.contains('on'); }
  pick(title: string, items: { label: string; run: () => void }[]) {
    const el = this.el('pick'); el.classList.add('on'); this.el('pk_t').textContent = title; this.el('pk_h').textContent = t('ui.pick_help');
    const l = this.el('pk_l'); l.innerHTML = '';
    items.forEach((it, i) => { const b = document.createElement('div'); b.className = 'ch'; b.innerHTML = `<b>${i + 1}.</b> ${it.label}`; b.onclick = () => { this.closePick(); it.run(); }; l.appendChild(b); });
    (el as any)._items = items;
  }
  pickKey(i: number) { const it = (this.el('pick') as any)._items?.[i]; if (it) { this.closePick(); it.run(); } }
  closePick() { this.el('pick').classList.remove('on'); }
  menuOpen() { return this.el('menu').classList.contains('on'); }
  showMenu(on: boolean) { this.el('menu').classList.toggle('on', on); }

  // ---------- Window (time jump) ----------
  winOpen() { return this.el('win').classList.contains('on'); }
  showWin(on: boolean) { this.el('win').classList.toggle('on', on); if (on) this.setTarget(this.now); }
  setTarget(v: number) {
    this.target = Math.max(this.t0, Math.min(this.t1, Math.round(v / 60) * 60));
    const f = (this.target - this.t0) / (this.t1 - this.t0);
    this.el('btar').style.left = `${f * 100}%`;
    this.el('wtar').textContent = fmt(this.target);
    this.el('wtar').className = 'wtar ' + (this.target < this.now ? 'back' : this.target > this.now ? 'fwd' : '');
  }
  setMarks(m: { t: number; story: boolean }[]) {
    const sig = m.map(x => x.t).join(',');
    if ((this.el('bmarks') as any)._sig === sig) return; (this.el('bmarks') as any)._sig = sig;
    this.el('bmarks').innerHTML = m.map(x => `<i class="${x.story ? 's' : ''}" style="left:${((x.t - this.t0) / (this.t1 - this.t0)) * 100}%"></i>`).join('');
  }

  clock(now: number, speed: number) {
    this.now = now;
    this.el('tm').textContent = fmt(now);
    this.el('iv').textContent = `${fmt(this.t0)}–${fmt(this.t1)}`;
    this.el('sp').innerHTML = `${t('ui.speed')} <b>x${speed}</b>`;
    const f = (now - this.t0) / (this.t1 - this.t0);
    this.el('bnow').style.left = `${f * 100}%`; this.el('bfill').style.width = `${f * 100}%`;
    this.el('wnow').textContent = fmt(now);
  }

  inventory(inv: string[], sim: { doubleExists(i: string): boolean; vanishFor(i: string): number | null }, sel: string, money = 0) {
    const it = (x: string) => t('ui.items.' + x.replace('*', '')) + (x.endsWith('*') ? ' ✦' : '');
    this.el('carry').innerHTML = `<b>${t('ui.money')}</b> <span class="cr">${money} ${t('ui.cr')}</span><br><b>${t('ui.carry')}</b> ${inv.length ? inv.map(x => `<span class="${x.endsWith('*') ? 'trav' : ''}">${it(x)}</span>`).join(' · ') : t('ui.empty')}`;
    const tsel = this.el('tsel') as HTMLSelectElement; this.el('tl2').textContent = t('ui.travel');
    const opts = ['', ...inv.filter(x => !sim.doubleExists(x.replace('*', '')))];
    const cur = opts.includes(sel) ? sel : '';
    const html = opts.map(x => `<option value="${x}" ${x === cur ? 'selected' : ''}>${x ? it(x) : t('ui.none')}</option>`).join('');
    if ((tsel as any)._h !== html) { tsel.innerHTML = html; (tsel as any)._h = html; }
    this.onTravel(cur);
  }
  options(list: Choice[]) {
    const keys = ['E', 'F', 'G', 'H', 'J'];
    const el = this.el('opts'); el.style.display = list.length ? 'block' : 'none';
    el.innerHTML = list.slice(0, 5).map((o, i) => `<div class="opt ${o.cls ?? ''}" data-i="${i}"><b>${keys[i]}</b>${o.label}</div>`).join('');
    el.querySelectorAll<HTMLElement>('.opt').forEach(d => (d.onclick = () => list[+d.dataset.i!].run()));
  }
  result(r: string | null) {
    const el = this.el('res'); if (!r) { el.style.display = 'none'; (el as any)._r = null; return; }
    if ((el as any)._r === r + getLang()) return; (el as any)._r = r + getLang();
    el.style.display = 'block'; el.innerHTML = `<h1>${t('ui.result.' + r)}</h1><p>${t('ui.result_hint')}</p><p><button id="rs">${t('ui.restart')}</button></p>`;
    (el.querySelector('#rs') as HTMLElement).onclick = () => this.onJump(this.t0);
  }
  toast(msg: string) {
    const el = this.el('toast'); el.textContent = msg; el.style.display = 'block';
    clearTimeout((el as any)._t); (el as any)._t = setTimeout(() => (el.style.display = 'none'), 2600);
  }
  news(lines: string[] | null) {
    const el = this.el('news'); if (!lines) { el.style.display = 'none'; return; }
    el.style.display = 'flex'; el.querySelector('b')!.textContent = t('ui.news');
    const sp = el.querySelector('.mq span')!; const txt = lines.join('   ◆   ');
    if (sp.textContent !== txt) { sp.textContent = txt; (sp as HTMLElement).style.animationDuration = Math.max(14, txt.length * 0.22) + 's'; }
  }

  // ---------- dialogue ----------
  private dlgTimer = 0; private dlgFull = '';
  dialogLine(npc: string, name: string, voice: string, text: string, choices: Choice[], check?: string) {
    const el = this.el('dlg'); el.classList.add('on');
    if ((el as any)._npc !== npc) { drawPortrait(this.el('por') as HTMLCanvasElement, npc); (el as any)._npc = npc; }
    const skill = !['narr', 'npc', 'you'].includes(voice);
    const who = el.querySelector('.who') as HTMLElement, body = el.querySelector('.body') as HTMLElement;
    who.textContent = voice === 'npc' ? name : voice === 'you' ? t('npc.player') : skill ? t('ui.voice.' + voice) + (check ? ` [${check}]` : '') : '';
    who.className = 'who ' + (skill ? 'v-' + voice : 'v-' + voice);
    body.className = 'body ' + (skill ? 'v-' + voice : voice === 'narr' ? 'v-narr' : voice === 'you' ? 'v-you' : '');
    this.dlgFull = text; body.textContent = '';
    clearInterval(this.dlgTimer); let i = 0;
    this.dlgTimer = window.setInterval(() => { i += 2; body.textContent = text.slice(0, i); if (i >= text.length) clearInterval(this.dlgTimer); }, 14);
    const ac = el.querySelector('.acts') as HTMLElement; ac.innerHTML = '';
    choices.forEach((c, k) => { const b = document.createElement('div'); b.className = 'ch ' + (c.cls ?? ''); b.innerHTML = `<b>${k + 1}.</b> ${c.label}`; b.onclick = e => { e.stopPropagation(); c.run(); }; ac.appendChild(b); });
    (el.querySelector('.cont') as HTMLElement).textContent = choices.length ? '' : t('ui.continue');
  }
  skipTyping() { clearInterval(this.dlgTimer); (this.el('dlg').querySelector('.body') as HTMLElement).textContent = this.dlgFull; }
  typing() { return (this.el('dlg').querySelector('.body') as HTMLElement).textContent !== this.dlgFull; }
  dialogClose() { clearInterval(this.dlgTimer); this.el('dlg').classList.remove('on'); (this.el('dlg') as any)._npc = null; }

  employer(msg: string) {
    const el = this.el('emp'); el.style.display = 'block'; el.querySelector('b')!.textContent = t('ui.employer');
    const sp = el.querySelector('span') as HTMLElement; sp.textContent = '';
    let i = 0; const iv = setInterval(() => { i += 2; sp.textContent = msg.slice(0, i); if (i >= msg.length) clearInterval(iv); }, 22);
    clearTimeout((el as any)._t); (el as any)._t = setTimeout(() => (el.style.display = 'none'), 9000 + msg.length * 40);
  }
  toggleLog() { this.el('log').classList.toggle('on'); }
  logOn() { return this.el('log').classList.contains('on'); }
  fastForward(on: boolean, back = true) {
    const el = this.el('ff'); el.style.display = on ? 'flex' : 'none';
    el.querySelector('span')!.textContent = back ? '◀◀ ◀◀ ◀◀' : '▶▶ ▶▶ ▶▶'; el.className = back ? 'back' : 'fwd';
  }

  /** anomaly tree: roots (player actions) branch into cascades; each depth animates in later */
  renderLog(events: Ev[], an: Anomaly[], facts: Map<string, string> = new Map(), leads: string[] = []) {
    const el = this.el('log');
    const ld = leads.length ? `<h2>${t('ui.leads')}</h2><ul class="facts">${leads.map(x => `<li style="animation-delay:0s"><span class="n">${x}</span></li>`).join('')}</ul>` : '';
    const fl = ld + (facts.size ? `<h2>${t('ui.facts')}</h2><ul class="facts">${[...facts].map(([k, v]) => `<li style="animation-delay:0s"><span class="n story">${t('ui.fact.' + k, { v })}</span></li>`).join('')}</ul>` : '');
    if (!an.length) { el.innerHTML = `${fl}<h2>${t('ui.journal')}</h2><p>${t('ui.no_anomalies')}</p>`; return; }
    const hide = (id: number) => ['depart', 'arrive', 'crowd_goes_home'].includes(events[id].type);
    const top = an.filter(a => !hide(a.ev.id)).slice(0, 16);
    const kids = new Map<number, number[]>(); const roots: number[] = [];
    const mark = new Set(top.map(a => a.ev.id));
    for (const a of top) {
      const ch = a.chain.filter(id => !hide(id));
      for (let i = 0; i < ch.length; i++) {
        const id = ch[i];
        if (i === 0) { if (!roots.includes(id)) roots.push(id); }
        else { const p = ch[i - 1]; const l = kids.get(p) ?? kids.set(p, []).get(p)!; if (!l.includes(id)) l.push(id); }
      }
    }
    const rec = (id: number, d: number): string => {
      const e = events[id], story = e.tags.includes('story');
      const cls = `n${d === 0 ? ' root' : ''}${story && mark.has(id) ? ' story' : ''}`;
      const line = `<span class="t">${fmt(e.t)}</span> · ${locName(e.loc)} · ${evText(e)}`;
      const ch = (kids.get(id) ?? []).sort((a, b) => events[a].t - events[b].t).map(c => rec(c, d + 1)).join('');
      return `<li style="animation-delay:${d * 0.28}s"><span class="${cls}">${line}</span>${ch ? `<ul>${ch}</ul>` : ''}</li>`;
    };
    el.innerHTML = `${fl}<h2>${t('ui.journal')}</h2><ul>${roots.map(r => rec(r, 0)).join('')}</ul>`;
  }
}
