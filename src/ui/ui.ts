import type { Sim } from '../sim/types';
import { fmt, fmtMin, WINDOW } from '../sim/types';
import type { ThreadInfo } from '../sim/sim';
import { threadText } from '../sim/sim';
import { tr, type Lang, ITEM_TEXT } from '../content/i18n';
import { PLACES } from '../content/places';

const $ = (id: string) => document.getElementById(id)!;

export class Hud {
  private thread = $('thread-line');
  private hintEl = $('hint');
  private subEl = $('subtitle');
  private clock = $('clock-mini');
  private interactEl = $('interact');
  private damageEl = $('damage');
  private hintTimer = 0;
  private subTimer = 0;

  setThread(text: string) {
    this.thread.textContent = text;
  }

  setClock(t: number) {
    this.clock.textContent = fmtMin(t);
  }

  hint(text: string, ms = 4200) {
    this.hintEl.textContent = text;
    this.hintEl.classList.add('on');
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => this.hintEl.classList.remove('on'), ms);
  }

  subtitle(text: string, ms = 3400) {
    this.subEl.textContent = text;
    this.subEl.classList.add('on');
    clearTimeout(this.subTimer);
    this.subTimer = window.setTimeout(() => this.subEl.classList.remove('on'), ms);
  }

  interact(text: string | null) {
    if (!text) {
      this.interactEl.classList.remove('on');
      this.interactEl.textContent = '';
      return;
    }
    this.interactEl.innerHTML = `<b>E</b> · ${text}`;
    this.interactEl.classList.add('on');
  }

  hurt() {
    this.damageEl.style.opacity = '1';
    setTimeout(() => (this.damageEl.style.opacity = '0'), 220);
  }

  hideBoot() {
    const b = document.getElementById('boot');
    if (!b) return;
    b.classList.add('hide');
    setTimeout(() => b.remove(), 900);
  }
}

// --- Створка --------------------------------------------------------------
export type Tab = 'time' | 'thread' | 'people' | 'map' | 'pocket' | 'messages';

export interface DeviceState {
  sim: Sim;
  thread: ThreadInfo;
  lang: Lang;
  tab: Tab;
  target: number;
  bookmarks: number[];
  events: { t: number; ru: string; en: string }[];
  px: number;
  pz: number;
  portrait: (id: string) => string | null;
  itemName: (id: string) => { name: string; desc: string } | null;
  names: Record<string, { ru: string; en: string }>;
}

export class DeviceUI {
  el = $('device');
  open = false;
  tab: Tab = 'time';
  state: DeviceState | null = null;
  onJump: (t: number) => void = () => {};
  onClose: () => void = () => {};
  onBookmark: () => void = () => {};
  onPreviewStart: (t: number) => void = () => {};
  onPreviewEnd: (commit: boolean) => void = () => {};
  private target = -1;
  private holdTimer = 0;
  private holding = false;
  private previewing = false;

  toggle(v?: boolean) {
    this.open = v ?? !this.open;
    this.el.classList.toggle('open', this.open);
    document.body.classList.toggle('ui-open', this.open);
    if (this.open && this.state) {
      this.target = this.state.target;
      this.render(this.state);
    }
  }

  setTarget(t: number) {
    this.target = Math.max(0, Math.min(WINDOW, Math.round(t / 10) * 10));
    if (this.state) this.render(this.state);
  }

  render(state: DeviceState) {
    this.state = state;
    if (!this.open) return;
    state.tab = this.tab;
    if (this.target < 0) this.target = state.target;
    const { sim, lang } = state;
    const tabs: { id: Tab; label: string }[] = [
      { id: 'time', label: tr('tab.time', lang) },
      { id: 'thread', label: tr('tab.thread', lang) },
      { id: 'people', label: tr('tab.people', lang) },
      { id: 'map', label: tr('tab.map', lang) },
      { id: 'pocket', label: tr('tab.pocket', lang) },
      { id: 'messages', label: tr('tab.messages', lang) },
    ];
    const tabHtml = tabs.map((t) => `<button class="tab ${t.id === state.tab ? 'on' : ''}" data-tab="${t.id}">${t.label}</button>`).join('');
    let body = '';
    if (state.tab === 'time') body = this.timeTab(state);
    else if (state.tab === 'thread') body = this.threadTab(state);
    else if (state.tab === 'people') body = this.peopleTab(state);
    else if (state.tab === 'map') body = this.mapTab(state);
    else if (state.tab === 'pocket') body = this.pocketTab(state);
    else body = this.messagesTab(state);

    this.el.innerHTML = `
      <div class="device-shell">
        <div class="device-top">
          <span class="device-title">${tr('device.title', lang)}</span>
          ${tabHtml}
        </div>
        <div class="device-body">${body}</div>
        <div class="device-foot">
          <span>${tr('device.close', lang)} · ${tr('device.bookmark', lang)}</span>
          <span>
            <button class="btn" data-act="bookmark">${tr('device.bookmark', lang)}</button>
            <button class="btn red" data-act="jump">${tr('device.jump', lang)} · ${fmtMin(this.target)}</button>
          </span>
        </div>
      </div>`;

    this.el.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      b.onclick = () => {
        this.tab = b.dataset.tab as Tab;
        this.render(state);
      };
    });
    this.el.querySelector<HTMLButtonElement>('[data-act="bookmark"]')!.onclick = () => this.onBookmark();
    const jumpBtn = this.el.querySelector<HTMLButtonElement>('[data-act="jump"]')!;
    jumpBtn.onpointerdown = (e) => {
      e.preventDefault();
      if (this.holding) return;
      this.holding = true;
      this.holdTimer = window.setTimeout(() => {
        this.previewing = true;
        this.el.classList.add('previewing');
        this.onPreviewStart(this.target);
      }, 900);
    };
    jumpBtn.onpointerup = () => {
      if (!this.holding) return;
      this.holding = false;
      clearTimeout(this.holdTimer);
      if (this.previewing) {
        this.previewing = false;
        this.el.classList.remove('previewing');
        this.onPreviewEnd(true);
        this.onJump(this.target);
      } else {
        this.onJump(this.target);
      }
    };
    jumpBtn.onpointerleave = () => {
      if (!this.holding) return;
      this.holding = false;
      clearTimeout(this.holdTimer);
      if (this.previewing) {
        this.previewing = false;
        this.el.classList.remove('previewing');
        this.onPreviewEnd(false);
      }
    };

    if (state.tab === 'time') {
      this.el.querySelectorAll<HTMLElement>('[data-min]').forEach((el) => {
        el.onclick = (e) => {
          e.stopPropagation();
          this.setTarget(Number(el.dataset.min) * 60);
        };
      });
      const scale = this.el.querySelector<HTMLElement>('#time-scale');
      if (scale) {
        scale.onclick = (e) => {
          const r = scale.getBoundingClientRect();
          this.setTarget(((e.clientX - r.left) / r.width) * WINDOW);
        };
      }
    }
    if (state.tab === 'map') this.drawMap(state);
  }

  private timeTab(s: DeviceState) {
    const { sim, lang } = s;
    const pct = (t: number) => `${Math.max(0, Math.min(100, (t / WINDOW) * 100))}%`;
    let ticks = '';
    for (let m = 0; m <= 60; m += 5) {
      ticks += `<div class="scale-tick" style="left:${(m / 60) * 100}%"><span>${String(22 + Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}</span></div>`;
    }
    const marks = s.events.map((e) => `<div class="scale-mark" style="left:${pct(e.t)}" data-min="${Math.round(e.t / 60)}"><span>${fmtMin(e.t)}</span></div>`).join('');
    const bm = s.bookmarks.map((t) => `<div class="scale-mark" style="left:${pct(t)};background:#7a6a4a" data-min="${Math.round(t / 60)}"><span>${fmtMin(t)}</span></div>`).join('');
    const choices = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) =>
      `<button class="time-choice ${Math.abs(this.target - m * 60) < 20 ? 'on' : ''}" data-min="${m}">22:${String(m).padStart(2, '0')}</button>`).join('');
    return `
      <div class="time-head">
        <div><div class="time-now">${fmt(sim.t)}</div><div class="time-hint">${tr('device.now', lang)} · ×4${sim.pocket ? ' · ' + tr('tab.pocket', lang) : ''}</div></div>
        <div style="text-align:right"><div class="time-now" style="font-size:22px">${fmtMin(this.target)}</div><div class="time-hint">${tr('device.target', lang)}</div></div>
      </div>
      <div class="scale" id="time-scale">
        <div class="scale-line"></div>${ticks}${marks}${bm}
        <div class="scale-hand" style="left:${pct(sim.t)}"></div>
      </div>
      <div class="time-choices">${choices}</div>
      <div class="preview-note">${tr('device.hold', lang)}. ${tr('device.jump', lang)}: ${fmtMin(this.target)}${sim.jumps ? ` · ${sim.jumps}` : ''}</div>`;
  }

  private threadTab(s: DeviceState) {
    return `<h3 style="font-weight:normal;font-size:22px;margin:0 0 12px">${threadText(s.thread, s.lang)}</h3>
      <p style="color:#8d8168;font-size:13px;line-height:1.6">${s.sim.jumps ? `прыжков: ${s.sim.jumps}` : ''}</p>`;
  }

  private peopleTab(s: DeviceState) {
    const ids = Object.keys(s.sim.journal);
    if (!ids.length) return `<p style="color:#8d8168">${tr('device.people.empty', s.lang)}</p>`;
    return ids.map((id) => {
      const e = s.sim.journal[id];
      const name = s.names[id]?.[s.lang] ?? id;
      const img = s.portrait(id);
      const quotes = e.quotes.slice(-4).map((q) => `<p class="quote"><time>${fmtMin(q.t)}</time>${s.lang === 'ru' ? q.ru : q.en}</p>`).join('');
      const acts = e.acts.map((a) => `<span class="meta">· ${a}</span>`).join(' ');
      return `<div class="person ${e.quotes.length > 1 ? 'key' : ''}">
        <div>${img ? `<img src="${img}" width="78" height="78" style="filter:grayscale(1)" />` : ''}</div>
        <div><h4>${name} ${e.quotes.length > 1 ? '<span style="color:#a3231a">●</span>' : ''}</h4>
        <div class="meta">${PLACES[e.place]?.ru ?? e.place} · ${fmtMin(e.firstSeen)}–${fmtMin(e.lastSeen)}</div>
        ${quotes}${acts ? `<div class="meta" style="margin-top:4px">${acts}</div>` : ''}</div>
      </div>`;
    }).join('');
  }

  private mapTab(s: DeviceState) {
    return `<div class="map-wrap"><canvas id="map-canvas" width="760" height="440"></canvas></div>`;
  }

  private drawMap(s: DeviceState) {
    const c = document.getElementById('map-canvas') as HTMLCanvasElement | null;
    if (!c) return;
    const g = c.getContext('2d')!;
    const W = c.width, H = c.height;
    g.fillStyle = '#0a0d10';
    g.fillRect(0, 0, W, H);
    const x0 = -96, x1 = 96, z0 = -92, z1 = 72;
    const X = (x: number) => ((x - x0) / (x1 - x0)) * W;
    const Z = (z: number) => ((z - z0) / (z1 - z0)) * H;
    // канал
    g.fillStyle = '#06121c';
    g.fillRect(X(-6.2), 0, X(6.2) - X(-6.2), H);
    // мост
    g.strokeStyle = '#6a5a3c';
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(X(-9.4), Z(0)); g.lineTo(X(9.4), Z(0)); g.stroke();

    const line = (pts: [number, number][], w = 6) => {
      g.strokeStyle = '#241f17';
      g.lineWidth = w;
      g.beginPath();
      pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
      g.stroke();
    };
    line([[-90, -8], [-10, -8]], 9);
    line([[-14, -80], [-14, 58]]);
    line([[14, -60], [14, 40]]);
    line([[12, 18], [88, 18]], 9);
    line([[-62, 36], [-16, 36]]);
    line([[20, -5], [46, -52]], 7);
    line([[-56, -41], [-30, -30]], 4);
    line([[-83, -40], [-53, -40]], 8);

    // маркеры
    const markers = s.thread.marker;
    for (const m of markers) {
      const p = PLACES[m];
      if (!p) continue;
      g.fillStyle = '#c21a13';
      g.beginPath(); g.arc(X(p.x), Z(p.z), 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8dfc8';
      g.font = '11px Georgia';
      g.fillText(p.ru, X(p.x) + 9, Z(p.z) + 4);
    }
    // игрок
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(X(s.px), Z(s.pz), 4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#c21a13';
    g.beginPath(); g.arc(X(s.px), Z(s.pz), 9, 0, Math.PI * 2); g.stroke();
  }

  private pocketTab(s: DeviceState) {
    if (!s.sim.pocket) return `<div class="pocket"><div class="pocket-icon"></div><div><h3>${tr('device.empty', s.lang)}</h3><p>${tr('device.pocket.empty', s.lang)}</p></div></div>`;
    const info = s.itemName(s.sim.pocket);
    return `<div class="pocket red"><div class="pocket-icon" style="border-color:#5a1a10"></div><div>
      <h3>${info?.name ?? s.sim.pocket}</h3><p>${info?.desc ?? ''}</p>
      <p class="meta" style="margin-top:10px">${s.sim.weapon ? (s.lang === 'ru' ? 'Револьвер при вас. 6 патронов в барабане.' : 'Revolver on you. Six rounds.') : ''}</p>
    </div></div>`;
  }

  private messagesTab(s: DeviceState) {
    if (!s.sim.messages.length) return `<p style="color:#8d8168">${tr('device.messages.empty', s.lang)}</p>`;
    return s.sim.messages.map((m) => {
      const text = s.lang === 'ru' ? MESSAGES_RU[m.key] ?? m.key : MESSAGES_EN[m.key] ?? m.key;
      return `<div class="msg"><time>${fmtMin(m.t)}</time><p>${text}</p></div>`;
    }).join('');
  }
}

const MESSAGES_RU: Record<string, string> = {
  krayn1: 'Пальто ничего не значит. Без ствола к людям Корда не суйся. У Фомы есть.',
  krayn2: 'Ключи — Орвен.',
  krayn3: 'Вижу тебя. Пирс 7. Ни слова ему.',
  krayn4: 'Синхронизация удержана. Без фокусов, Тимоша.',
};
const MESSAGES_EN: Record<string, string> = {
  krayn1: 'The coat means nothing. Don’t face Kord’s men without a gun. Foma has one.',
  krayn2: 'Keys are Orven.',
  krayn3: 'I see you. Pier seven. Not a word to him.',
  krayn4: 'Synchronisation held. No tricks, Timosha.',
};

// --- Диалоги --------------------------------------------------------------
export interface ChoiceView { label: string; hint?: string; index: number; }

export class DialogUI {
  el = $('dialog');
  onChoose: (i: number) => void = () => {};
  onNext: () => void = () => {};
  private choices: ChoiceView[] = [];
  private open = false;

  show(who: string, text: string, choices: ChoiceView[], canNext: boolean, lang: Lang) {
    this.open = true;
    this.choices = choices;
    this.el.classList.add('open');
    document.body.classList.add('ui-open');
    this.el.innerHTML = `<div class="dlg-box">
      <div class="dlg-who">${who}</div>
      <div class="dlg-line">${text}</div>
      <div class="dlg-choices">${choices.map((c) =>
        `<button class="dlg-choice" data-i="${c.index}"><span class="k">${c.index}.</span>${c.label}${c.hint ? `<span class="kn">${c.hint}</span>` : ''}</button>`).join('')}</div>
      <div class="dlg-next">${canNext ? tr('dlg.continue', lang) : choices.length ? tr('dlg.choose', lang) : ''}</div>
    </div>`;
    this.el.querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) => {
      b.onclick = () => this.onChoose(Number(b.dataset.i));
    });
    const box = this.el.querySelector<HTMLElement>('.dlg-box')!;
    box.onclick = (e) => {
      if ((e.target as HTMLElement).closest('[data-i]')) return;
      if (canNext || !choices.length) this.onNext();
    };
  }

  hide() {
    this.open = false;
    this.el.classList.remove('open');
    document.body.classList.remove('ui-open');
  }

  get isOpen() { return this.open; }
}

// --- Экраны ---------------------------------------------------------------
export class Screens {
  el = $('screen');
  showIntro(lang: Lang, onStart: () => void) {
    this.el.classList.add('open');
    this.el.innerHTML = `<div class="screen-inner">
      <h1>${tr('screen.intro.title', lang)}</h1>
      <h2>${tr('screen.intro.sub', lang)}</h2>
      <p>${tr('screen.intro.body', lang)}</p>
      <p style="max-width:52ch;margin:22px auto 30px">${lang === 'ru'
        ? 'Ночь, дождь. Вы на крыше каланчи. В левой руке — Створка: час, с десяти до одиннадцати. Каждый прыжок создаёт новый мир. Смерть окончательна.'
        : 'Night, rain. You are on the watchtower roof. In your left hand — the Shutter: one hour, ten to eleven. Every jump makes a new world. Death is final.'}</p>
      <button class="btn red" id="start-btn">${tr('action.start', lang)}</button>
      <p style="margin-top:26px;font-size:12px;color:#5f594c">${tr('hint.look', lang)}</p>
    </div>`;
    this.el.querySelector<HTMLButtonElement>('#start-btn')!.onclick = onStart;
  }

  showEnd(kind: 'empty' | 'death' | 'postponed' | 'morning', lang: Lang, facts: string[], detail: string, onRestart: () => void) {
    const title = tr(`screen.${kind}.title`, lang);
    const sub = kind === 'postponed' || kind === 'morning' ? tr(`screen.${kind}.sub`, lang) : '';
    this.el.classList.add('open');
    this.el.innerHTML = `<div class="screen-inner">
      <h1>${title}</h1>
      ${sub ? `<h2>${sub}</h2>` : ''}
      ${detail ? `<p style="margin-bottom:26px">${detail}</p>` : ''}
      <h2 style="color:#8d8168;margin-top:20px">${tr('screen.facts', lang)}</h2>
      <ul>${facts.length ? facts.map((f) => `<li>${f}</li>`).join('') : `<li>${tr('screen.facts.none', lang)}</li>`}</ul>
      <button class="btn red" id="restart-btn">${tr('action.restart', lang)}</button>
    </div>`;
    this.el.querySelector<HTMLButtonElement>('#restart-btn')!.onclick = onRestart;
  }

  hide() {
    this.el.classList.remove('open');
    this.el.innerHTML = '';
  }
}

export function itemText(id: string, lang: Lang) {
  const t = ITEM_TEXT[id];
  if (!t) return { name: id, desc: '' };
  return lang === 'ru' ? { name: t.ru, desc: t.ruDesc } : { name: t.en, desc: t.enDesc };
}

export { fmt, fmtMin, threadText };
