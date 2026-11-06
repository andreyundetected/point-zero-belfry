import * as THREE from 'three';
import { hrand } from '../sim/util';
import { t } from '../i18n';

export const NEON = ['#35f2e6', '#ff4fd8', '#ffe14a', '#9b6bff', '#ff3b5c', '#6aa0ff', '#7dff9b', '#ff8a3d'];
const R = (k: number, ...a: (string | number)[]) => hrand(900 + k, ...a);

function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const; }
function tex(c: HTMLCanvasElement, repeat = true, srgb = true) {
  const tx = new THREE.CanvasTexture(c);
  if (repeat) tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  if (srgb) tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 8; tx.generateMipmaps = true; tx.minFilter = THREE.LinearMipmapLinearFilter;
  return tx;
}

/** Facade tile = 16 window modules x 16 floors; 3.2 m x 3.6 m per module -> 51.2 m x 57.6 m per texture tile. */
export const FACADE_W = 51.2, FACADE_H = 57.6;
export interface Facade { map: THREE.Texture; emissive: THREE.Texture; rough: number; metal: number }

export function makeFacades(): Facade[] {
  const out: Facade[] = [];
  const N = 16, S = 64; // px per module
  const styles = 5;
  for (let st = 0; st < styles; st++) {
    const [c, g] = canvas(N * S, N * S), [ce, ge] = canvas(N * S, N * S);
    ge.fillStyle = '#000'; ge.fillRect(0, 0, N * S, N * S);
    // wall base
    const walls = ['#0e1522', '#2a2626', '#3a3d44', '#1a1716', '#141a24'];
    g.fillStyle = walls[st]; g.fillRect(0, 0, N * S, N * S);
    // wall noise / stains
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${R(1, st, i) > 0.5 ? 255 : 0},${R(1, st, i) > 0.5 ? 255 : 0},${R(1, st, i) > 0.5 ? 255 : 0},${0.015 + R(2, st, i) * 0.03})`; g.fillRect(R(3, st, i) * N * S, R(4, st, i) * N * S, 2 + R(5, st, i) * 30, 2 + R(6, st, i) * 50); }
    for (let fy = 0; fy < N; fy++) {
      const floorLit = R(7, st, fy);
      for (let fx = 0; fx < N; fx++) {
        const x = fx * S, y = fy * S, r = R(8, st, fx, fy);
        let ww = 0, wh = 0, wx = 0, wy = 0;
        if (st === 0) { ww = S - 6; wh = S - 10; wx = 3; wy = 4; }          // glass curtain wall
        else if (st === 1) { ww = S * 0.5; wh = S * 0.5; wx = S * 0.25; wy = S * 0.2; } // concrete residential
        else if (st === 2) { ww = S * 0.62; wh = S * 0.46; wx = S * 0.19; wy = S * 0.22; } // panel block
        else if (st === 3) { if (fx % 3) continue; ww = S * 0.8; wh = S * 0.3; wx = S * 0.1; wy = S * 0.3; } // industrial
        else { ww = S - 14; wh = S * 0.55; wx = 7; wy = S * 0.2; }        // dark office bands
        // window glass (unlit)
        const glass = st === 0 ? '#14263a' : st === 4 ? '#0b1626' : '#0d1118';
        g.fillStyle = glass; g.fillRect(x + wx, y + wy, ww, wh);
        g.fillStyle = 'rgba(120,170,220,0.07)'; g.fillRect(x + wx, y + wy, ww, wh * 0.4);
        // lit?
        const pLit = st === 0 ? (floorLit > 0.55 ? 0.55 : 0.12) : st === 3 ? 0.2 : st === 4 ? (floorLit > 0.5 ? 0.6 : 0.1) : 0.42;
        if (r < pLit) {
          const k = R(9, st, fx, fy);
          let col = st === 0 || st === 4 ? (k < 0.5 ? '#7fb8e8' : k < 0.8 ? '#5fc8ff' : k < 0.92 ? '#cfe8ff' : '#ff9fe0') : (k < 0.55 ? '#ffc070' : k < 0.75 ? '#ffe2a8' : k < 0.85 ? '#ff6fd0' : k < 0.93 ? '#6fd8ff' : '#9a7bff');
          if (st === 3) col = '#ffd27a';
          const grd = g.createLinearGradient(0, y + wy, 0, y + wy + wh); grd.addColorStop(0, col); grd.addColorStop(1, shade(col, 0.55));
          g.fillStyle = grd; g.fillRect(x + wx, y + wy, ww, wh);
          ge.fillStyle = col; ge.globalAlpha = 0.55 + k * 0.45; ge.fillRect(x + wx, y + wy, ww, wh); ge.globalAlpha = 1;
          // curtains / silhouettes
          if (st !== 0 && R(10, st, fx, fy) < 0.35) { g.fillStyle = 'rgba(30,10,20,0.55)'; g.fillRect(x + wx, y + wy, ww * (0.3 + R(11, st, fx, fy) * 0.4), wh); ge.fillStyle = '#000'; ge.globalAlpha = 0.6; ge.fillRect(x + wx, y + wy, ww * 0.35, wh); ge.globalAlpha = 1; }
          if (R(12, st, fx, fy) < 0.08) { g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x + wx + ww * 0.4, y + wy + wh * 0.3, ww * 0.18, wh * 0.7); }
        }
        // frames / mullions
        g.strokeStyle = st === 0 ? 'rgba(160,200,230,0.35)' : 'rgba(0,0,0,0.6)'; g.lineWidth = st === 0 ? 2 : 3; g.strokeRect(x + wx, y + wy, ww, wh);
        if (st === 0 || st === 4) { g.beginPath(); g.moveTo(x + wx + ww / 2, y + wy); g.lineTo(x + wx + ww / 2, y + wy + wh); g.stroke(); }
        // AC units & balconies
        if ((st === 1 || st === 2) && R(13, st, fx, fy) < 0.18) { g.fillStyle = '#5a5f66'; g.fillRect(x + wx + ww * 0.6, y + wy + wh + 2, ww * 0.38, S * 0.14); g.fillStyle = '#2a2d33'; g.fillRect(x + wx + ww * 0.62, y + wy + wh + 4, ww * 0.1, S * 0.1); }
        if (st === 2 && fx % 4 === 1) { g.fillStyle = 'rgba(80,85,95,0.9)'; g.fillRect(x + 2, y + wy + wh, S - 4, 6); }
      }
      // floor slab line
      g.fillStyle = st === 0 ? 'rgba(10,20,30,0.9)' : 'rgba(0,0,0,0.35)'; g.fillRect(0, fy * S + S - 3, N * S, 3);
    }
    if (st === 2) for (let i = 0; i <= N; i++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(i * S * 4 - 1, 0, 2, N * S); }
    if (st === 3) { for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,200,40,0.25)'; g.fillRect(0, R(14, i) * N * S, N * S, 6); } }
    out.push({ map: tex(c), emissive: tex(ce), rough: [0.18, 0.75, 0.7, 0.8, 0.3][st], metal: [0.7, 0.05, 0.05, 0.1, 0.6][st] });
  }
  return out;
}
function shade(hex: string, f: number) { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) * f, g = ((n >> 8) & 255) * f, b = (n & 255) * f; return `rgb(${r | 0},${g | 0},${b | 0})`; }

/** Shopfront strip: 16 shops x 6 m wide x 4.5 m high per tile (96 m). Texts come from i18n. */
export const SHOP_W = 96, SHOP_H = 4.5;
export function drawShops(c: HTMLCanvasElement, ce: HTMLCanvasElement) {
  const g = c.getContext('2d')!, ge = ce.getContext('2d')!;
  const W = c.width, H = c.height, n = 16, sw = W / n;
  const names = (t('signs.shops') as string).split('|');
  g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H); ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  for (let i = 0; i < n; i++) {
    const x = i * sw, col = NEON[Math.floor(R(20, i) * NEON.length)], closed = R(21, i) < 0.18;
    // frame
    g.fillStyle = '#1a1c24'; g.fillRect(x, 0, sw, H);
    if (closed) {
      g.fillStyle = '#3a3c44'; g.fillRect(x + 6, H * 0.32, sw - 12, H * 0.68);
      for (let y = H * 0.32; y < H; y += 6) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 6, y, sw - 12, 2); }
      g.fillStyle = 'rgba(255,79,216,0.5)'; g.font = `bold ${H * 0.12}px monospace`; g.fillText('///', x + 14, H * 0.6);
    } else {
      const inner = ['#ffd9a0', '#bfe9ff', '#ffc2ef', '#d6ffd0', '#fff3b0'][Math.floor(R(22, i) * 5)];
      const grd = g.createLinearGradient(0, H * 0.32, 0, H); grd.addColorStop(0, inner); grd.addColorStop(1, shade('#' + 'a0a0a0', 0.4));
      g.fillStyle = grd; g.fillRect(x + 6, H * 0.32, sw - 12, H * 0.68);
      ge.fillStyle = inner; ge.globalAlpha = 0.45; ge.fillRect(x + 6, H * 0.32, sw - 12, H * 0.68); ge.globalAlpha = 1;
      // shelves / people silhouettes
      for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(40,30,40,0.5)'; g.fillRect(x + 10 + k * (sw - 20) / 4, H * 0.55 + R(23, i, k) * H * 0.2, (sw - 20) / 5, H * 0.45); }
      if (R(24, i) < 0.5) { g.fillStyle = 'rgba(10,10,20,0.75)'; g.beginPath(); g.ellipse(x + sw * 0.6, H * 0.62, sw * 0.06, H * 0.08, 0, 0, 7); g.fill(); g.fillRect(x + sw * 0.55, H * 0.68, sw * 0.1, H * 0.32); }
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x + sw / 2 - 1, H * 0.32, 2, H * 0.68); // door split
    }
    // sign band
    g.fillStyle = '#0c0d12'; g.fillRect(x + 2, 4, sw - 4, H * 0.26);
    const name = names[Math.floor(R(25, i) * names.length)];
    g.font = `500 ${H * 0.13}px Oswald, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = col; g.shadowBlur = 14; g.fillStyle = col; g.fillText(name, x + sw / 2, 4 + H * 0.13, sw - 12); g.shadowBlur = 0;
    ge.font = g.font; ge.textAlign = 'center'; ge.textBaseline = 'middle'; ge.fillStyle = col; ge.fillText(name, x + sw / 2, 4 + H * 0.13, sw - 12);
    g.fillStyle = col; g.fillRect(x + 4, H * 0.29, sw - 8, 2); ge.fillStyle = col; ge.fillRect(x + 4, H * 0.29, sw - 8, 2);
  }
}
export function makeShops() {
  const [c] = canvas(2048, 192), [ce] = canvas(2048, 192);
  drawShops(c, ce);
  return { map: tex(c), emissive: tex(ce), redraw: () => drawShops(c, ce) };
}

/** Vertical neon blade signs & horizontal neon signs atlas: 8 x 4 cells */
export function drawSigns(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!, W = c.width, H = c.height, cw = W / 8, ch = H / 4;
  g.clearRect(0, 0, W, H);
  const words = (t('signs.neon') as string).split('|');
  for (let i = 0; i < 32; i++) {
    const x = (i % 8) * cw, y = Math.floor(i / 8) * ch, col = NEON[i % NEON.length], col2 = NEON[(i * 3 + 2) % NEON.length];
    const word = words[i % words.length];
    g.fillStyle = 'rgba(4,4,10,0.92)'; g.fillRect(x + 4, y + 4, cw - 8, ch - 8);
    g.strokeStyle = col2; g.lineWidth = 4; g.shadowColor = col2; g.shadowBlur = 16; g.strokeRect(x + 10, y + 10, cw - 20, ch - 20);
    g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 22;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (i < 16) { // vertical text
      const letters = [...word].slice(0, 7); const fs = Math.min(cw * 0.6, (ch - 30) / letters.length);
      g.font = `500 ${fs}px Oswald, sans-serif`;
      letters.forEach((L, k) => g.fillText(L, x + cw / 2, y + 18 + fs * (k + 0.5)));
    } else { g.font = `500 ${ch * 0.22}px Oswald, sans-serif`; g.save(); g.translate(x + cw / 2, y + ch / 2); g.rotate(-Math.PI / 2); g.fillText(word, 0, 0, ch - 30); g.restore(); }
    g.shadowBlur = 0;
  }
}
export function makeSigns() {
  const [c] = canvas(1024, 1024); drawSigns(c);
  const tx = tex(c, false); return { map: tx, redraw: () => { drawSigns(c); tx.needsUpdate = true; } };
}

/** Billboard ads atlas 2 x 4 */
export function drawAds(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!, W = c.width, H = c.height, cw = W / 2, ch = H / 4;
  const ads = (t('signs.ads') as string).split('|');
  for (let i = 0; i < 8; i++) {
    const x = (i % 2) * cw, y = Math.floor(i / 2) * ch, c1 = NEON[i % NEON.length], c2 = NEON[(i + 3) % NEON.length];
    const grd = g.createLinearGradient(x, y, x + cw, y + ch); grd.addColorStop(0, shade(c1, 0.35)); grd.addColorStop(1, shade(c2, 0.25));
    g.fillStyle = grd; g.fillRect(x, y, cw, ch);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${R(30, i, k) * 0.05})`; g.fillRect(x, y + R(31, i, k) * ch, cw, 2); }
    // face/figure silhouette
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.ellipse(x + cw * 0.78, y + ch * 0.45, ch * 0.2, ch * 0.26, 0, 0, 7); g.fill();
    g.fillRect(x + cw * 0.66, y + ch * 0.66, cw * 0.24, ch * 0.34);
    g.strokeStyle = c1; g.lineWidth = 3; g.shadowColor = c1; g.shadowBlur = 14; g.beginPath(); g.ellipse(x + cw * 0.78, y + ch * 0.45, ch * 0.2, ch * 0.26, 0, -1.2, 1.2); g.stroke();
    const [head, sub] = (ads[i % ads.length] || '').split('/');
    g.fillStyle = '#fff'; g.font = `500 ${ch * 0.2}px Oswald, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.shadowColor = c1; g.shadowBlur = 18;
    g.fillText(head ?? '', x + cw * 0.05, y + ch * 0.45, cw * 0.58);
    g.font = `${ch * 0.09}px "JetBrains Mono", monospace`; g.fillStyle = c2; g.shadowBlur = 6; g.fillText(sub ?? '', x + cw * 0.05, y + ch * 0.66, cw * 0.58);
    g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
  }
}
export function makeAds() { const [c] = canvas(1024, 1024); drawAds(c); const tx = tex(c, false); return { map: tx, redraw: () => { drawAds(c); tx.needsUpdate = true; } }; }

/** Road segment (80 m x 18 m between intersections): lanes, double centre line, crosswalks at both ends. */
export function makeRoad() {
  const [c, g] = canvas(1024, 256);
  g.fillStyle = '#16171c'; g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 4000; i++) { const v = 18 + R(40, i) * 26; g.fillStyle = `rgba(${v},${v},${v + 6},0.5)`; g.fillRect(R(41, i) * 1024, R(42, i) * 256, 2, 2); }
  for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(0,0,0,${0.15 + R(43, i) * 0.2})`; g.beginPath(); g.ellipse(R(44, i) * 1024, R(45, i) * 256, 20 + R(46, i) * 60, 6 + R(47, i) * 14, 0, 0, 7); g.fill(); }
  g.fillStyle = '#d8b030'; g.fillRect(110, 124, 804, 3); g.fillRect(110, 130, 804, 3);
  g.fillStyle = 'rgba(230,230,230,0.8)';
  for (let x = 120; x < 900; x += 60) { g.fillRect(x, 62, 30, 3); g.fillRect(x, 192, 30, 3); }
  g.fillRect(110, 8, 804, 3); g.fillRect(110, 245, 804, 3);
  for (const x0 of [10, 940]) for (let y = 12; y < 244; y += 22) g.fillRect(x0, y, 70, 12); // zebra crossings
  g.fillRect(96, 128, 4, 120); g.fillRect(924, 8, 4, 120); // stop lines
  return tex(c);
}
export function makeConcrete(dark = false) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = dark ? '#121318' : '#2a2c33'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2000; i++) { const v = (dark ? 20 : 40) + R(50, i, +dark) * 30; g.fillStyle = `rgba(${v},${v},${v + 8},0.6)`; g.fillRect(R(51, i, +dark) * 256, R(52, i, +dark) * 256, 2, 2); }
  g.strokeStyle = dark ? 'rgba(0,0,0,0.5)' : 'rgba(10,10,14,0.65)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
  return tex(c);
}
/** Wet roughness map: dark = glossy puddles */
export function makePuddles() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    const x = R(60, i) * 512, y = R(61, i) * 512, r = 10 + R(62, i) * 60;
    const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, '#0a0a0a'); grd.addColorStop(0.7, '#202020'); grd.addColorStop(1, 'rgba(154,154,154,0)');
    g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, r * 1.6, r, R(63, i) * 3, 0, 7); g.fill();
  }
  return tex(c, true, false);
}
export function makeGlow(color = 'rgba(255,220,170,1)') {
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, color); grd.addColorStop(0.35, color.replace(',1)', ',0.3)')); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128); return tex(c, false);
}
export function makeTextTexture(text: string, color: string, w = 1024, h = 256, font = 'Oswald') {
  const [c, g] = canvas(w, h);
  const draw = (txt: string) => {
    g.clearRect(0, 0, w, h); g.font = `500 ${h * 0.62}px ${font}, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = h * 0.12; g.fillStyle = color; g.fillText(txt, w / 2, h / 2, w * 0.94); g.shadowBlur = 0; g.fillStyle = '#fff'; g.globalAlpha = 0.5; g.fillText(txt, w / 2, h / 2, w * 0.94); g.globalAlpha = 1;
  };
  draw(text); const tx = tex(c, false);
  return { map: tx, set: (s: string) => { draw(s); tx.needsUpdate = true; } };
}
