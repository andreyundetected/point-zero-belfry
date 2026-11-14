import { EventDef, EVENTS } from '../sim/events';
import { fmt, WINDOW } from '../sim/time';
import { GameState } from './state';
import { THREADS } from '../content/threads';
import { pick, tr, getLang } from './strings';
import { ROADS, CANAL, BOUNDS } from '../world/layout';
import { placed } from '../world/city';
import { NPCS } from '../sim/npcs';
import { nameOf } from './dialogue';
import { drawMain } from './mapview';
import { threadMarkers } from '../content/threads';
import { branchHtml, mapPlaces } from '../content/branch';
import { FACTS } from '../content/knowledge';

const $ = (id: string) => document.getElementById(id)!;
export type Tab = 'time' | 'thread' | 'people' | 'map' | 'pocket' | 'messages' | 'branch';
const TABS: Tab[] = ['time', 'thread', 'people', 'map', 'pocket', 'messages', 'branch'];
const KEYS: Partial<Record<Tab, string>> = { time: 'Tab', map: 'M', people: 'J', pocket: 'I', thread: 'N' };
const ITEM_TXT: Record<string, { ru: string; en: string; d: { ru: string; en: string } }> = {
  key: { ru: 'Стальной ключ', en: 'Steel key', d: { ru: 'Бородка с четырьмя зубцами, косой срез. Точён на заказ.', en: 'Four teeth, a slanted cut. Cut to order.' } },
  jeton: { ru: 'Жетон курьера №17', en: 'Courier token #17', d: { ru: 'Медный жетон. Пропуск в контору Гейла.', en: 'A copper token. A pass into Gayl\'s office.' } },
  ring: { ru: 'Кольцо Гейла', en: "Gayl's ring", d: { ru: 'Обручальное. «Отдай Анне, она поймёт».', en: 'A wedding ring. "Give it to Anna. She\'ll understand."' } },
  ribbon: { ru: 'Лента Анки', en: "Anka's ribbon", d: { ru: 'Красная лента из косы.', en: 'A red ribbon from her braid.' } },
  manifest: { ru: 'Перевозочный лист', en: 'Transport sheet', d: { ru: 'Приют → пирс 7, 22:40. 14 мест. Подпись Гейла, печать склада.', en: 'Orphanage → pier 7, 22:40. 14 places. Gayl signed, warehouse seal.' } },
  helmsmen: { ru: 'Список рулевых', en: 'List of helmsmen', d: { ru: '«Ян Вилк — списать. Тихон Мерц — после рейса списать».', en: '"Yan Vilk — write off. Tikhon Merts — write off after the trip."' } },
  spareKey: { ru: 'Запасной ключ «Сокол-2»', en: 'Spare ignition key "Falcon-2"', d: { ru: 'Зажигание катера.', en: 'The launch ignition.' } },
  cap: { ru: 'Кепка рулевого', en: "Helmsman's cap", d: { ru: 'Не поднимать голову.', en: 'Keep your head down.' } },
  note: { ru: 'Записка с печатью совета', en: 'Note with the council seal', d: { ru: '«Впустить техника в 21:55. После — брат дома».', en: '"Let the technician in at 21:55. After — brother home."' } },
  watch: { ru: 'Часы Неда', en: "Ned's watch", d: { ru: 'Отцовские.', en: "His father's." } },
  ledger: { ru: 'Страница книги', en: 'Ledger page', d: { ru: '«Тимофей, 7 лет, родных нет — отложен».', en: '"Timofey, 7, no kin — set aside."' } },
};
export const itemName = (i: string) => pick(ITEM_TXT[i] ?? { ru: i, en: i });

export interface StvHost {
  getYaw(): number; s: GameState; open: boolean; targetT: number; getPos(): { x: number; z: number }; jumpTo(t: number, preview: boolean): void; previewing: boolean; togglePreview(): void; showGhosts?(t: number): void; stay?(): void;
  onClose?(): void; wait?: boolean;
}
export class Stvorka {
  tab: Tab = 'time'; root = $('stv'); previewTimer = 0; hold = false; private mapCv?: HTMLCanvasElement; private sel = 0; private nowT = 0;
  constructor(public host: StvHost) {
    this.root.addEventListener('click', e => { const t = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null; if (t) { this.tab = t.dataset.tab as Tab; this.render(); } });
  }
  drawMapIfOpen() { if (this.tab === 'map' && this.mapCv && this.mapCv.isConnected) this.drawMap(); }
  show(nowT: number) { this.nowT = nowT; this.sel = this.sel || nowT; this.host.targetT = Math.max(0, Math.min(WINDOW, this.sel)); this.root.style.display = 'flex'; this.render(); }
  hide() { this.root.style.display = 'none'; this.hold = false; }
  render() {
    const s = this.host.s, tabs = TABS.map(t => `<div class="tab ${t === this.tab ? 'on' : ''}" data-tab="${t}">${tr('tab.' + (t === 'branch' ? 'branch' : t))}${KEYS[t] ? `<kbd>${KEYS[t]}</kbd>` : ''}</div>`).join('');
    this.root.innerHTML = `<div class="panel"><div class="tabs">${tabs}<div style="flex:1"></div><div class="tab dim"><kbd>Esc</kbd> ${tr('close')}</div></div><div class="body" id="stvb"></div></div>`;
    const b = $('stvb'); const lang = getLang();
    if (this.tab === 'time') this.renderTime(b);
    else if (this.tab === 'thread') { const th = THREADS[s.thread]; b.innerHTML = `<h3 class="red">${th ? pick(th) : '—'}</h3><p class="dim">${lang === 'ru' ? 'Красный маркер на карте показывает, куда идти.' : 'The red marker on the map shows where to go.'}</p>`; }
    else if (this.tab === 'people') this.renderPeople(b);
    else if (this.tab === 'map') { b.style.padding = '0'; b.style.overflow = 'hidden'; this.renderMap(b); }
    else if (this.tab === 'pocket') { const p = s.pocket; const gun = s.hasGun ? `<p class="dim" style="margin-top:18px">${lang === 'ru' ? 'Оружие (не в Кармане)' : 'Weapon (not in the Pocket)'}: ${lang === 'ru' ? 'револьвер' : 'revolver'} ${s.mag}/${s.ammo}</p>` : ''; b.innerHTML = gun + (p ? `<h3 class="red">${itemName(p)}</h3><p>${pick(ITEM_TXT[p].d)}</p>` : `<p class="dim">${tr('pocket.empty')}</p>`); }
    else if (this.tab === 'messages') b.innerHTML = s.messages.length ? s.messages.map(m => `<p><span class="dim">${fmt(m.t)}</span> — ${pick(m)}</p>`).join('') : `<p class="dim">—</p>`;
    else b.innerHTML = branchHtml(s);
  }
  private renderTime(b: HTMLElement) {
    const s = this.host.s, lang = getLang(); const x = (t: number) => (t / WINDOW * 100).toFixed(2) + '%';
    // the scale carries what Tik knows with a time: events he saw (●/○), facts he was told (⟲) and the thread's own hint (↩)
    const seen: { t: number; big: boolean; label: string; kind: 'seen' | 'told' | 'thread' }[] = EVENTS.filter(e => s.seenEvents.has(e.id)).map(e => ({ t: e.t, big: !!e.big, label: pick(e), kind: 'seen' as const }));
    for (const [k, f] of Object.entries(FACTS)) if (f.t !== undefined && s.knows(k) && !seen.some(m => Math.abs(m.t - f.t!) < 20 && m.label === pick(f))) seen.push({ t: f.t, big: false, label: pick(f), kind: 'told' });
    const th = THREADS[s.thread]; if (th?.timeHint !== undefined) seen.push({ t: th.timeHint, big: false, label: (lang === 'ru' ? 'Нить: ' : 'Thread: ') + pick(th), kind: 'thread' });
    const glyph = (m: { big: boolean; kind: string }) => m.kind === 'thread' ? '<span class="red">↩</span>' : m.kind === 'told' ? '<span class="dim">⟲</span>' : m.big ? '<span class="red">●</span>' : '○';
    const marks = seen.map(m => `<div class="mk ${m.big || m.kind === 'thread' ? 'big' : ''}" style="left:${x(m.t)}" title="${fmt(m.t)} ${m.label}"></div>`).join('');
    const hours = [0, 15, 30, 45, 60].map(m => `<div class="lbl" style="left:${x(m * 60)}">${fmt(m * 60)}</div>`).join('');
    const closing = s.t >= WINDOW; const banner = closing ? `<div style="border:1px solid #a01810;padding:8px 12px;margin-bottom:10px"><b class="red">${lang === 'ru' ? 'Окно закрывается. Вернуться?' : 'The window is closing. Go back?'}</b> <span class="dim">${lang === 'ru' ? 'Выберите минуту и прыгайте — или останьтесь.' : 'Pick a minute and jump — or stay.'}</span> <button id="stay" style="float:right">${lang === 'ru' ? 'Остаться' : 'Stay'}</button></div>` : '';
    b.innerHTML = banner + `<div style="display:flex;justify-content:space-between"><div>${tr('now')}: <b>${fmt(this.nowT, true)}</b></div><div>${tr('target')}: <b class="red" id="tsel">${fmt(this.host.targetT, true)}</b></div></div>
    <div class="tl"><div class="bar"></div>${marks}<div class="now" style="left:${x(this.nowT)}"></div><div class="sel" id="selmark" style="left:${x(this.host.targetT)}"></div>${hours}</div>
    <input id="rng" type="range" min="0" max="${WINDOW}" step="10" value="${Math.round(this.host.targetT / 10) * 10}">
    <p><button class="go" id="jbtn">${tr('jump')} <kbd>Enter</kbd></button><span class="dim" style="font-size:13px">${lang === 'ru' ? '← → шаг 10 с · Shift+← → минута' : '← → 10 s · Shift+← → a minute'}</span></p>
    <div>${seen.sort((a, c) => a.t - c.t).map(m => `<div class="ev" data-t="${m.t}"><span class="dim">${fmt(m.t)}</span> ${glyph(m)} ${m.label}</div>`).join('') || `<span class="dim">${lang === 'ru' ? 'Отметки появятся, когда узнаешь о событиях с точным временем: увидишь сам или услышишь от людей. Клик по отметке ставит минуту.' : 'Marks appear as you learn of events with an exact time: seen yourself or told by people. Click a mark to set the minute.'}</span>`}</div>`;
    const rng = $('rng') as HTMLInputElement; rng.oninput = () => this.setTarget(+rng.value);
    b.querySelectorAll('.ev').forEach(el => (el as HTMLElement).onclick = () => { this.setTarget(+(el as HTMLElement).dataset.t!); rng.value = String(this.host.targetT); });
    $('jbtn').onclick = () => this.host.jumpTo(this.host.targetT, false); if (closing) { $('stay').onclick = () => this.host.stay?.(); if (this.host.targetT >= WINDOW - 5) this.setTarget(WINDOW - 600); }
  }
  setTarget(t: number) { this.host.targetT = Math.max(0, Math.min(WINDOW, t)); if (this.host.previewing) this.host.showGhosts?.(this.host.targetT); this.sel = this.host.targetT; const e = document.getElementById('tsel'); if (e) e.textContent = fmt(this.host.targetT, true); const m = document.getElementById('selmark'); if (m) m.style.left = (this.host.targetT / WINDOW * 100) + '%'; }
  /** released the jump button: a short hold = preview was cancelled, a full hold = jump */
  release() { if (!this.hold) return; this.hold = false; this.host.jumpTo(this.host.targetT, false); }
  private renderPeople(b: HTMLElement) {
    const s = this.host.s; const rows = s.journal.filter(j => j.who);
    const who = new Map<string, typeof rows>(); for (const j of rows) (who.get(j.who!) ?? who.set(j.who!, []).get(j.who!)!).push(j);
    if (!who.size) { b.innerHTML = `<p class="dim">${tr('journal.none')}</p>`; return; }
    b.innerHTML = [...who].map(([id, es]) => { const d = NPCS.find(n => n.id === id); const nm = nameOf(id); return `<div class="person ${d?.key ? 'key' : ''}">${s.portraits[id] ? `<img src="${s.portraits[id]}" style="width:64px;height:64px;border:2px solid ${d?.key ? '#a01010' : '#333'};filter:grayscale(1)">` : `<div style="width:60px;height:64px;background:#17181a;border:2px solid ${d?.key ? '#a01010' : '#333'};text-align:center;line-height:64px;font-size:26px">${nm[0]}</div>`}<div><b>${nm}</b>${es.map(e => `<div class="dim">${fmt(e.t)} — <span style="color:#d8d2c4">${pick(e)}</span></div>`).join('')}</div></div>`; }).join('');
  }
  // ---- B4: map with drag, wheel zoom (3 levels), search, legend; click a marker or a place for its description
  view = { cx: 0, cz: -5, zoom: 0 }; private picked: string | null = null;
  private renderMap(b: HTMLElement) {
    const ru = getLang() === 'ru';
    b.innerHTML = `<div style="position:relative;width:100%;height:100%"><canvas class="map" id="mapcv" width="1100" height="600" style="cursor:grab"></canvas>
      <input id="mapq" placeholder="${ru ? 'поиск: место или человек' : 'search: place or person'}" style="position:absolute;left:10px;top:10px;width:240px;background:#0c0d0f;color:#d8d2c4;border:1px solid #4a3a2a;padding:6px 8px;font:inherit;font-size:14px">
      <div id="mapres" style="position:absolute;left:10px;top:44px;width:260px;background:rgba(8,9,11,.92);font-size:14px"></div>
      <div style="position:absolute;right:10px;top:10px;background:rgba(8,9,11,.85);border:1px solid #3a3228;padding:6px 10px;font-size:13px;line-height:1.6"><b>${ru ? 'Легенда' : 'Legend'}</b><br><span style="color:#e8e2d2">▲</span> ${ru ? 'вы и куда смотрите' : 'you, facing'}<br><span class="red">●</span> ${ru ? 'Нить: куда идти' : 'Thread: where to go'}<br><span style="color:#c8b27a">◆</span> ${ru ? 'места (клик — описание)' : 'places (click)'}<br><span style="color:#8aa0b8">●</span> ${ru ? 'знакомые, где видели' : 'people, last seen'}<br><span class="dim">${ru ? 'колесо — масштаб · тянуть — двигать' : 'wheel zoom · drag to pan'}</span></div>
      <div id="mapinfo" style="position:absolute;left:10px;bottom:10px;max-width:420px;background:rgba(8,9,11,.92);border-left:3px solid #c02a20;padding:6px 10px;font-size:14px;display:none"></div></div>`;
    const cv = this.mapCv = $('mapcv') as HTMLCanvasElement; const p = this.host.getPos(); if (!this.picked) { this.view.cx = p.x; this.view.cz = p.z; }
    let drag: { x: number; y: number; cx: number; cz: number } | null = null;
    cv.onmousedown = e => { drag = { x: e.offsetX, y: e.offsetY, cx: this.view.cx, cz: this.view.cz }; cv.style.cursor = 'grabbing'; };
    cv.onmousemove = e => { if (!drag) return; const k = this.ppm(); this.view.cx = drag.cx - (e.offsetX - drag.x) * (cv.width / cv.clientWidth) / k; this.view.cz = drag.cz - (e.offsetY - drag.y) * (cv.height / cv.clientHeight) / k; this.drawMap(); };
    cv.onmouseup = cv.onmouseleave = e => { if (drag && Math.hypot(e.offsetX - drag.x, e.offsetY - drag.y) < 4) this.clickMap(e.offsetX * cv.width / cv.clientWidth, e.offsetY * cv.height / cv.clientHeight); drag = null; cv.style.cursor = 'grab'; };
    cv.onwheel = e => { e.preventDefault(); this.view.zoom = Math.max(0, Math.min(2, this.view.zoom + (e.deltaY < 0 ? 1 : -1))); this.drawMap(); };
    const q = $('mapq') as HTMLInputElement; q.onkeydown = e => e.stopPropagation();
    q.oninput = () => { const v = q.value.trim().toLowerCase(); const res = $('mapres'); if (!v) { res.innerHTML = ''; return; } const hits = this.places().filter((pl: any) => pl.name.toLowerCase().includes(v)).slice(0, 8);
      res.innerHTML = hits.map((h: any, i: number) => `<div class="ev" data-i="${i}" style="padding:4px 8px">${h.kind === 'person' ? '●' : '◆'} ${h.name}</div>`).join('') || `<div class="dim" style="padding:4px 8px">—</div>`;
      res.querySelectorAll('.ev').forEach(el => (el as HTMLElement).onclick = () => { const h = hits[+(el as HTMLElement).dataset.i!]; this.view.cx = h.x; this.view.cz = h.z; this.view.zoom = Math.max(1, this.view.zoom); this.showInfo(h); res.innerHTML = ''; this.drawMap(); }); };
    this.drawMap();
  }
  ppm() { const cv = this.mapCv!; return Math.min(cv.width / 200, cv.height / 175) * [1, 2.2, 4.5][this.view.zoom]; }
  places() { return mapPlaces(this.host.s); }
  private showInfo(h: { name: string; desc: string }) { const i = $('mapinfo'); i.style.display = 'block'; i.innerHTML = `<b>${h.name}</b><br><span class="dim">${h.desc}</span>`; }
  private clickMap(px: number, py: number) { const cv = this.mapCv!, k = this.ppm(); const x = this.view.cx + (px - cv.width / 2) / k, z = this.view.cz + (py - cv.height / 2) / k; let best: any = null, bd = 14 / k; for (const h of [...this.markers(), ...this.places()]) { const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = h; } } if (best) this.showInfo(best); else $('mapinfo').style.display = 'none'; }
  private markers() { const ru = getLang() === 'ru'; return threadMarkers(this.host.s.thread, this.host.s.t).map(m => ({ ...m, kind: 'thread', name: ru ? 'Нить' : 'Thread', desc: (THREADS[this.host.s.thread] ? pick(THREADS[this.host.s.thread]) : '') + (m.label ? ` — ${m.label}` : '') })); }
  drawMap() { if (!this.mapCv) return; const p = this.host.getPos(); drawMain(this.mapCv, { x: p.x, z: p.z, yaw: this.host.getYaw(), thread: this.host.s.thread, time: performance.now() / 1000, t: this.host.s.t, view: { cx: this.view.cx, cz: this.view.cz, ppm: this.ppm() }, places: this.places() }); }
}
export function eventsAt(): EventDef[] { return EVENTS; }
