// Title screen and pause menu: one overlay over the live scene. Title: a slow camera drift over Zaton. Pause: Esc in game.
import * as THREE from 'three';
import type { Game } from './game';
import { getLang, setLang } from './strings';
import { settings, setSetting, Quality } from './settings';
import { hasSave, saveMeta, loadGame, clearSave } from './save';
import { fmt } from '../sim/time';
import { THREADS } from '../content/threads';
import { pick } from './strings';

type Screen = 'title' | 'pause' | 'settings' | 'controls' | 'about' | null;
const $ = (id: string) => document.getElementById(id)!;
const T = (ru: string, en: string) => (getLang() === 'ru' ? ru : en);
/** camera path for the title: a slow drift along the quay looking at the tower, then over the bridge */
const SHOTS: { from: THREE.Vector3; to: THREE.Vector3; look: THREE.Vector3; dur: number }[] = [
  { from: new THREE.Vector3(-58, 3.2, -30), to: new THREE.Vector3(-64, 3.6, -38), look: new THREE.Vector3(-70, 12, -56), dur: 22 },   // Tower square, lamps, the tower
  { from: new THREE.Vector3(-11, 2.4, 7), to: new THREE.Vector3(-6, 2.2, 3), look: new THREE.Vector3(8, 1.5, -1), dur: 18 },           // the Old Bridge from the west bank
  { from: new THREE.Vector3(-30, 2.2, -8.2), to: new THREE.Vector3(-44, 2.4, -8.4), look: new THREE.Vector3(-70, 2.5, -9), dur: 20 },  // down Rynochnaya
  { from: new THREE.Vector3(14, 2.2, 10), to: new THREE.Vector3(14.5, 2.0, 5), look: new THREE.Vector3(20, 2.5, 9), dur: 16 },         // the Anchor's lit windows
  { from: new THREE.Vector3(-20, 2.6, 54), to: new THREE.Vector3(-14, 2.4, 56), look: new THREE.Vector3(-9, 0.5, 66), dur: 18 },       // pier 7, the barge
];
export class Menu {
  root = $('menu'); screen: Screen = null; onTitle = false; private shot = 0; private shotT = 0; private sel = 0; private items: HTMLElement[] = [];
  private back: Screen = null; fadeT = 0;
  constructor(public g: Game) {
    this.root.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null; if (b) this.act(b.dataset.act!, b); });
    this.root.addEventListener('mousemove', e => { const b = (e.target as HTMLElement).closest('.mi') as HTMLElement | null; if (b) { const i = this.items.indexOf(b); if (i >= 0) { this.sel = i; this.mark(); } } });
    addEventListener('keydown', e => this.key(e), true);
    this.root.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (el.dataset.set) this.set(el.dataset.set, el); });
  }
  get open() { return this.screen !== null; }
  showTitle() { try { if (sessionStorage.getItem('okno.continue') === '1' && hasSave()) { sessionStorage.removeItem('okno.continue'); this.onTitle = true; this.g.hud.menuMode(true); if (loadGame(this.g)) { this.startLoaded(); return; } } } catch { /* */ }
    this.onTitle = true; this.g.frozen = true; this.g.hud.menuMode(true); this.g.handsVisible(false); this.shot = Math.floor(Math.random() * SHOTS.length); this.shotT = 0; this.show('title'); document.exitPointerLock?.(); }
  pause() { if (this.open || this.g.s.ended || this.g.jumpBusy) return; this.g.paused = true; this.g.hud.menuMode(true); this.show('pause'); document.exitPointerLock?.(); }
  resume() { this.hide(); if (this.onTitle) return; this.g.paused = false; this.g.hud.menuMode(false); this.g.player.dom.requestPointerLock?.(); }
  hide() { this.screen = null; this.root.style.display = 'none'; }
  private show(sc: Screen) { this.screen = sc; this.root.style.display = 'flex'; this.render(); }
  /** the title drift: the camera is parked on a rail, the world runs (people walk, rain falls) */
  cinematic(dt: number) {
    if (!this.onTitle) return; const s = SHOTS[this.shot]; this.shotT += dt; const u = Math.min(1, this.shotT / s.dur); const e = u * u * (3 - 2 * u);
    const cam = this.g.cam; cam.position.lerpVectors(s.from, s.to, e); cam.lookAt(s.look); cam.rotation.z = 0;
    const fade = $('mfade'); fade.style.opacity = String(u < 0.08 ? 1 - u / 0.08 : u > 0.92 ? (u - 0.92) / 0.08 : 0);
    if (u >= 1) { this.shot = (this.shot + 1) % SHOTS.length; this.shotT = 0; }
    this.g.player.body.x = cam.position.x; this.g.player.body.z = cam.position.z; this.g.player.body.y = cam.position.y - 1.65;
  }
  private menu(items: [string, string, string?][]) { return `<div class="mlist">${items.map(([act, label, sub], i) => `<div class="mi${i === 0 ? ' on' : ''}" data-act="${act}">${label}${sub ? `<span class="ms">${sub}</span>` : ''}</div>`).join('')}</div>`; }
  render() {
    const ru = getLang() === 'ru'; const meta = saveMeta(); let body = '';
    const title = `<div class="mtitle"><div class="mt1">ОКНО</div><div class="mt2">${T('Затон · 1947', 'Zaton · 1947')}</div></div>`;
    if (this.screen === 'title') {
      const items: [string, string, string?][] = [];
      if (hasSave() && meta) items.push(['continue', T('Продолжить', 'Continue'), `${fmt(meta.t, true)} · ${THREADS[meta.thread] ? pick(THREADS[meta.thread]) : ''}`]);
      items.push(['new', T('Новая игра', 'New game'), hasSave() ? T('сохранение будет стёрто', 'the save will be erased') : undefined], ['settings', T('Настройки', 'Settings')], ['controls', T('Управление', 'Controls')], ['about', T('Об игре', 'About')]);
      body = title + this.menu(items) + `<div class="mfoot">${T('Одна ночь. Окно 22:00–23:00. Прыгай во времени, но помни: мир не переписывается — появляется ещё одна ветка.', 'One night. The window is 22:00–23:00. Jump through time, but remember: the world is not rewritten, another branch appears.')}</div>`;
    } else if (this.screen === 'pause') {
      body = `<div class="mtitle"><div class="mt1 small">${T('ПАУЗА', 'PAUSED')}</div><div class="mt2">${fmt(this.g.s.t, true)} · ${THREADS[this.g.s.thread] ? pick(THREADS[this.g.s.thread]) : ''}</div></div>` + this.menu([['resume', T('Продолжить', 'Resume')], ['save', T('Сохранить', 'Save'), meta ? T('последнее: ', 'last: ') + fmt(meta.t, true) : T('ещё не сохранялось', 'not saved yet')], ['settings', T('Настройки', 'Settings')], ['controls', T('Управление', 'Controls')], ['title', T('В главное меню', 'Main menu')]]);
    } else if (this.screen === 'settings') {
      const q = settings.quality; const opt = (v: Quality, l: string) => `<span class="seg${q === v ? ' on' : ''}" data-act="q:${v}">${l}</span>`;
      body = `<div class="mtitle"><div class="mt1 small">${T('НАСТРОЙКИ', 'SETTINGS')}</div></div><div class="mform">
        <label>${T('Качество', 'Quality')}<div class="segs">${opt('auto', T('авто', 'auto'))}${opt('low', T('низкое', 'low'))}${opt('medium', T('среднее', 'medium'))}${opt('high', T('высокое', 'high'))}</div><div class="mhint">${T('Авто подбирает разрешение по частоте кадров. Низкое выключает тени.', 'Auto picks the resolution from the frame rate. Low turns shadows off.')}</div></label>
        <label>${T('Чувствительность мыши', 'Mouse sensitivity')} <b id="v-sens">${settings.sens.toFixed(2)}</b><input type="range" min="0.3" max="2.5" step="0.05" value="${settings.sens}" data-set="sens"></label>
        <label>${T('Громкость', 'Volume')} <b id="v-volume">${Math.round(settings.volume * 100)}%</b><input type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-set="volume"></label>
        <label>${T('Поле зрения', 'Field of view')} <b id="v-fov">${settings.fov}°</b><input type="range" min="55" max="95" step="1" value="${settings.fov}" data-set="fov"></label>
        <label>${T('Язык', 'Language')}<div class="segs"><span class="seg${ru ? ' on' : ''}" data-act="lang:ru">Русский</span><span class="seg${!ru ? ' on' : ''}" data-act="lang:en">English</span></div></label>
        <label>${T('Подсказки клавиш на экране', 'Key hints on screen')}<div class="segs"><span class="seg${settings.hints ? ' on' : ''}" data-act="hints:1">${T('да', 'yes')}</span><span class="seg${!settings.hints ? ' on' : ''}" data-act="hints:0">${T('нет', 'no')}</span></div></label>
      </div>` + this.menu([['back', T('Назад', 'Back')]]);
    } else if (this.screen === 'controls') {
      const rows: [string, string][] = ru ? [['WASD', 'ходить'], ['Shift', 'бег'], ['Пробел', 'прыжок'], ['C / Ctrl', 'присесть'], ['E', 'действие: двери, предметы, разговор'], ['Tab', 'Створка: шкала времени, Enter — прыжок'], ['M / J / I', 'карта / люди / карман'], ['N', 'показать нить'], ['T (зажать)', 'ждать, время ×16'], ['1 / 2', 'револьвер / убрать'], ['ПКМ / ЛКМ / R', 'прицел / выстрел / перезарядка'], ['1–9, ↑↓ Enter, мышь', 'выбор реплики'], ['Esc', 'меню / закрыть Створку / уйти из разговора']]
        : [['WASD', 'move'], ['Shift', 'run'], ['Space', 'jump'], ['C / Ctrl', 'crouch'], ['E', 'use: doors, items, talk'], ['Tab', 'the Stvorka: time scale, Enter jumps'], ['M / J / I', 'map / people / pocket'], ['N', 'show the thread'], ['T (hold)', 'wait, time ×16'], ['1 / 2', 'revolver / put away'], ['RMB / LMB / R', 'aim / fire / reload'], ['1–9, ↑↓ Enter, mouse', 'pick a line'], ['Esc', 'menu / close the Stvorka / leave a talk']];
      body = `<div class="mtitle"><div class="mt1 small">${T('УПРАВЛЕНИЕ', 'CONTROLS')}</div></div><table class="mkeys">${rows.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>` + this.menu([['back', T('Назад', 'Back')]]);
    } else if (this.screen === 'about') {
      body = `<div class="mtitle"><div class="mt1 small">${T('ОБ ИГРЕ', 'ABOUT')}</div></div><div class="mabout">${ru
        ? '<p>Сарель, район Затон, осень 1947 года. Один час, одна ночь, устройство «Створка» в левой руке. Тик, воспитанник приюта св. Лукии, ищет человека по имени Харроу для женщины, которой должен. Каждый прыжок во времени — новая вселенная; знания остаются, мир — нет.</p><p>Стелс-детектив от первого лица. Никаких подсказок сверх того, что Тик видел и слышал сам: только то, что он узнал, можно использовать в разговоре.</p><p class="dim">Three.js · TypeScript · Vite. Шрифт Old Standard TT (OFL). Модели: Mixamo, Universal Animation Library, Kenney, KayKit, Quaternius.</p>'
        : '<p>Sarel, the Zaton district, autumn 1947. One hour, one night, the Stvorka in your left hand. Tik, raised at St Lucia\'s orphanage, is looking for a man called Harrow for a woman he owes. Every jump through time is a new universe; knowledge stays, the world does not.</p><p>A first-person stealth detective. No hints beyond what Tik saw and heard himself: only what he has learned can be used in a conversation.</p><p class="dim">Three.js · TypeScript · Vite. Old Standard TT (OFL). Models: Mixamo, Universal Animation Library, Kenney, KayKit, Quaternius.</p>'}</div>` + this.menu([['back', T('Назад', 'Back')]]);
    }
    this.root.innerHTML = `<div id="mfade"></div><div class="mpanel">${body}</div><div class="mver">v1.1</div>`;
    this.items = Array.from(this.root.querySelectorAll('.mi')) as HTMLElement[]; this.sel = 0; this.mark();
  }
  private mark() { this.items.forEach((el, i) => el.classList.toggle('on', i === this.sel)); }
  private set(k: string, el: HTMLInputElement) { const v = +el.value; if (k === 'sens') setSetting('sens', v); if (k === 'volume') setSetting('volume', v); if (k === 'fov') setSetting('fov', v); const lab = document.getElementById('v-' + k); if (lab) lab.textContent = k === 'volume' ? Math.round(v * 100) + '%' : k === 'fov' ? v + '°' : v.toFixed(2); }
  private act(a: string, el?: HTMLElement) {
    void el;
    if (a.startsWith('q:')) { setSetting('quality', a.slice(2) as Quality); this.render(); return; }
    if (a.startsWith('lang:')) { setLang(a.slice(5) as 'ru' | 'en'); this.g.hud.refresh(); this.render(); return; }
    if (a.startsWith('hints:')) { setSetting('hints', a.endsWith('1')); this.render(); return; }
    switch (a) {
      case 'new': clearSave(); this.startNew(); break;
      case 'continue': if (loadGame(this.g)) this.startLoaded(); else this.startNew(); break;
      case 'resume': this.resume(); break;
      case 'save': { const ok = this.g.autosave(true); this.g.hud.toast(ok ? T('Сохранено', 'Saved') : T('Сохранять можно после пролога', 'You can save after the prologue'), 2); this.render(); break; }
      case 'settings': case 'controls': case 'about': this.back = this.screen; this.show(a); break;
      case 'back': this.show(this.back ?? (this.onTitle ? 'title' : 'pause')); break;
      case 'title': this.g.autosave(true); location.reload(); break;
    }
  }
  private startNew() { this.onTitle = false; this.hide(); this.g.hud.menuMode(false); this.g.handsVisible(true); this.g.frozen = false; this.g.paused = false; $('mfade').style.opacity = '0'; this.g.startNewGame(); }
  private startLoaded() { this.onTitle = false; this.hide(); this.g.hud.menuMode(false); this.g.handsVisible(true); this.g.frozen = false; this.g.paused = false; this.g.hud.toast(T('Продолжаем', 'Continuing'), 2); setTimeout(() => this.g.player.dom.requestPointerLock?.(), 50); }
  private key(e: KeyboardEvent) {
    if (!this.open) { if (e.code === 'Escape' && !this.g.open && !this.g.ui.open && !this.g.runner.active && !this.g.s.ended && this.g.hadLock) { this.pause(); e.stopImmediatePropagation(); } return; }
    e.stopImmediatePropagation();
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { this.sel = (this.sel + 1) % this.items.length; this.mark(); }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { this.sel = (this.sel + this.items.length - 1) % this.items.length; this.mark(); }
    if (e.code === 'Enter' || e.code === 'Space') { const it = this.items[this.sel]; if (it) this.act(it.dataset.act!, it); }
    if (e.code === 'Escape') { if (this.screen === 'settings' || this.screen === 'controls' || this.screen === 'about') this.act('back'); else if (this.screen === 'pause') this.resume(); }
  }
}
