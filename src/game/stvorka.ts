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

const $ = (id: string) => document.getElementById(id)!;
export type Tab = 'time' | 'thread' | 'people' | 'map' | 'pocket' | 'messages' | 'branch';
const TABS: Tab[] = ['time', 'thread', 'people', 'map', 'pocket', 'messages', 'branch'];
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
  getYaw(): number; s: GameState; open: boolean; targetT: number; getPos(): { x: number; z: number }; jumpTo(t: number, preview: boolean): void; previewing: boolean; holdBegin(): void; holdEnd(): void;
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
    const s = this.host.s, tabs = TABS.map(t => `<div class="tab ${t === this.tab ? 'on' : ''}" data-tab="${t}">${tr('tab.' + (t === 'branch' ? 'branch' : t))}</div>`).join('');
    this.root.innerHTML = `<div class="panel"><div class="tabs">${tabs}<div style="flex:1"></div><div class="tab dim">Tab — ${tr('close')}</div></div><div class="body" id="stvb"></div></div>`;
    const b = $('stvb'); const lang = getLang();
    if (this.tab === 'time') this.renderTime(b);
    else if (this.tab === 'thread') { const th = THREADS[s.thread]; b.innerHTML = `<h3 class="red">${th ? pick(th) : '—'}</h3><p class="dim">${lang === 'ru' ? 'Красный маркер на карте показывает, куда идти.' : 'The red marker on the map shows where to go.'}</p>`; }
    else if (this.tab === 'people') this.renderPeople(b);
    else if (this.tab === 'map') { b.style.padding = '0'; b.innerHTML = '<canvas class="map" id="mapcv" width="1100" height="640"></canvas>'; this.mapCv = $('mapcv') as HTMLCanvasElement; this.drawMap(); }
    else if (this.tab === 'pocket') { const p = s.pocket; b.innerHTML = p ? `<h3 class="red">${itemName(p)}</h3><p>${pick(ITEM_TXT[p].d)}</p>` : `<p class="dim">${tr('pocket.empty')}</p>${s.hasGun ? `<p>${lang === 'ru' ? 'Револьвер при себе' : 'Revolver on you'}: ${s.mag}/${s.ammo}</p>` : ''}`; }
    else if (this.tab === 'messages') b.innerHTML = s.messages.length ? s.messages.map(m => `<p><span class="dim">${fmt(m.t)}</span> — ${pick(m)}</p>`).join('') : `<p class="dim">—</p>`;
    else b.innerHTML = s.changes.length ? s.changes.map(c => `<p>• ${c}</p>`).join('') : `<p class="dim">${tr('branch.none')}</p>`;
  }
  private renderTime(b: HTMLElement) {
    const s = this.host.s, lang = getLang(); const x = (t: number) => (t / WINDOW * 100).toFixed(2) + '%';
    const seen = [...EVENTS.filter(e => s.seenEvents.has(e.id)).map(e => ({ t: e.t, big: !!e.big, label: pick(e) })), ...s.bookmarks.map(m => ({ t: m.t, big: false, label: m.label }))];
    const marks = seen.map(m => `<div class="mk ${m.big ? 'big' : ''}" style="left:${x(m.t)}" title="${fmt(m.t)} ${m.label}"></div>`).join('');
    const hours = [0, 15, 30, 45, 60].map(m => `<div class="lbl" style="left:${x(m * 60)}">${fmt(m * 60)}</div>`).join('');
    b.innerHTML = `<div style="display:flex;justify-content:space-between"><div>${tr('now')}: <b>${fmt(this.nowT, true)}</b></div><div>${tr('target')}: <b class="red" id="tsel">${fmt(this.host.targetT, true)}</b></div></div>
    <div class="tl"><div class="bar"></div>${marks}<div class="now" style="left:${x(this.nowT)}"></div><div class="sel" id="selmark" style="left:${x(this.host.targetT)}"></div>${hours}</div>
    <input id="rng" type="range" min="0" max="${WINDOW}" step="10" value="${Math.round(this.host.targetT / 10) * 10}">
    <p><button class="go" id="jbtn">${tr('jump')} — ${lang === 'ru' ? 'держать 1 с' : 'hold 1 s'} [Enter]</button><button id="bm">${tr('bookmark')}</button><span class="dim">${tr('jump.hold')}</span></p>
    <div>${seen.sort((a, c) => a.t - c.t).map(m => `<div class="ev" data-t="${m.t}"><span class="dim">${fmt(m.t)}</span> ${m.big ? '<span class="red">●</span>' : '○'} ${m.label}</div>`).join('') || `<span class="dim">${lang === 'ru' ? 'Событий пока не видел.' : 'No events seen yet.'}</span>`}</div>`;
    const rng = $('rng') as HTMLInputElement; rng.oninput = () => this.setTarget(+rng.value);
    b.querySelectorAll('.ev').forEach(el => (el as HTMLElement).onclick = () => { this.setTarget(+(el as HTMLElement).dataset.t!); rng.value = String(this.host.targetT); });
    const jb = $('jbtn'); jb.onmousedown = () => this.host.holdBegin(); jb.onmouseup = jb.onmouseleave = () => this.host.holdEnd();
    $('bm').onclick = () => { this.host.s.bookmarks.push({ t: this.nowT, label: fmt(this.nowT) }); this.render(); };
  }
  setTarget(t: number) { this.host.targetT = Math.max(0, Math.min(WINDOW, t)); this.sel = this.host.targetT; const e = document.getElementById('tsel'); if (e) e.textContent = fmt(this.host.targetT, true); const m = document.getElementById('selmark'); if (m) m.style.left = (this.host.targetT / WINDOW * 100) + '%'; }
  /** released the jump button: a short hold = preview was cancelled, a full hold = jump */
  release() { if (!this.hold) return; this.hold = false; this.host.jumpTo(this.host.targetT, false); }
  private renderPeople(b: HTMLElement) {
    const s = this.host.s; const rows = s.journal.filter(j => j.who);
    const who = new Map<string, typeof rows>(); for (const j of rows) (who.get(j.who!) ?? who.set(j.who!, []).get(j.who!)!).push(j);
    if (!who.size) { b.innerHTML = `<p class="dim">${tr('journal.none')}</p>`; return; }
    b.innerHTML = [...who].map(([id, es]) => { const d = NPCS.find(n => n.id === id); const nm = nameOf(id); return `<div class="person ${d?.key ? 'key' : ''}">${s.portraits[id] ? `<img src="${s.portraits[id]}" style="width:64px;height:64px;border:2px solid ${d?.key ? '#a01010' : '#333'};filter:grayscale(1)">` : `<div style="width:60px;height:64px;background:#17181a;border:2px solid ${d?.key ? '#a01010' : '#333'};text-align:center;line-height:64px;font-size:26px">${nm[0]}</div>`}<div><b>${nm}</b>${es.map(e => `<div class="dim">${fmt(e.t)} — <span style="color:#d8d2c4">${pick(e)}</span></div>`).join('')}</div></div>`; }).join('');
  }
  drawMap() { const p = this.host.getPos(); drawMain(this.mapCv!, { x: p.x, z: p.z, yaw: this.host.getYaw(), thread: this.host.s.thread, time: performance.now() / 1000 }); }
}
export function eventsAt(): EventDef[] { return EVENTS; }
