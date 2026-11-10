import { BOUNDS, CANAL, ROADS, RECTS, PIER3, PIER7, DECK_Y } from '../world/layout';
import { placed } from '../world/city';
import { THREADS, threadMarkers } from '../content/threads';
import { pick } from './strings';

// Schematic map (spec 2.5): one cached drawing, drawn big in the Stvorka and as a small rotating-free minimap on the HUD.
const PPM = 5, X0 = BOUNDS.x0 - 6, Z0 = BOUNDS.z0 - 4, X1 = BOUNDS.x1 + 6, Z1 = 96;
let cache: HTMLCanvasElement | undefined;
const W = () => (X1 - X0) * PPM, H = () => (Z1 - Z0) * PPM;
const px = (x: number) => (x - X0) * PPM, pz = (z: number) => (z - Z0) * PPM;
function build() {
  const c = document.createElement('canvas'); c.width = W(); c.height = H(); const g = c.getContext('2d')!;
  g.fillStyle = '#0a0b0d'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#0e141b'; g.fillRect(px(CANAL.x0), pz(CANAL.z0), (CANAL.x1 - CANAL.x0) * PPM, (58 - CANAL.z0) * PPM); g.fillRect(0, pz(58), c.width, c.height);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const r of ROADS) { g.strokeStyle = '#26282b'; g.lineWidth = (r.w + 2 * (r.walk ?? 2)) * PPM; g.beginPath(); r.pts.forEach(([x, z], i) => i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z))); g.stroke(); }
  for (const r of ROADS) { g.strokeStyle = '#3b3d40'; g.lineWidth = r.w * PPM; g.beginPath(); r.pts.forEach(([x, z], i) => i ? g.lineTo(px(x), pz(z)) : g.moveTo(px(x), pz(z))); g.stroke(); }
  for (const r of RECTS) { g.fillStyle = r.kind === 'setts' ? '#3b3d40' : '#2c2e31'; g.fillRect(px(r.x0), pz(r.z0), (r.x1 - r.x0) * PPM, (r.z1 - r.z0) * PPM); }
  g.fillStyle = '#4a4538'; g.fillRect(px(-9), pz(-3), 18 * PPM, 6 * PPM);                                   // Old Bridge
  g.fillStyle = '#4a4538'; for (const p of [PIER3, PIER7]) g.fillRect(px(p.x - p.w / 2), pz(p.z0), p.w * PPM, (p.z1 - p.z0) * PPM);
  void DECK_Y;
  for (const b of placed) { if (b.id === 'blk' || b.id === 'ob') continue; g.save(); g.translate(px(b.x), pz(b.z)); g.rotate(-b.ry); g.fillStyle = '#17181a'; g.strokeStyle = '#4a4a46'; g.lineWidth = 1; g.fillRect(-b.w / 2 * PPM, -b.depth * PPM, b.w * PPM, b.depth * PPM); g.strokeRect(-b.w / 2 * PPM, -b.depth * PPM, b.w * PPM, b.depth * PPM); g.restore(); }
  g.font = 'italic 15px "OldStd", Georgia, serif'; g.textAlign = 'center';
  const lab: [string, number, number][] = [['Башня-каланча', -70, -65], ['Башенная площадь', -68, -40], ['Лавка Орвена', -46, -39], ['Лавка Фомы', -40, -23], ['Почта', -22, -21], ['Рыночная ул.', -52, -5], ['Старый мост', 0, 9], ['Набережная Заречья', 22, -30], ['Таверна «Якорь»', 24, 2], ['Склад Харроу', 66, 46], ['Контора', 44, 33], ['Приют св. Лукии', 50, -80], ['Канатная ул.', -38, 33], ['Дом Тихона', -38, 48], ['Пристань №3', -42, 90], ['Пирс 7', -9, 82], ['Гавань', 40, 76], ['Канал', 0, -50]];
  for (const [t, x, z] of lab) { g.lineWidth = 4; g.strokeStyle = '#0a0b0d'; g.strokeText(t, px(x), pz(z)); g.fillStyle = '#a9a28f'; g.fillText(t, px(x), pz(z)); }
  return c;
}
export interface MapState { x: number; z: number; yaw: number; thread: string; time: number; t?: number; }
const glow = (g: CanvasRenderingContext2D, x: number, y: number, r: number, a = 1) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,70,50,${0.95 * a})`); gr.addColorStop(0.25, `rgba(255,40,30,${0.55 * a})`); gr.addColorStop(1, 'rgba(255,20,10,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = `rgba(255,150,130,${a})`; g.beginPath(); g.arc(x, y, Math.max(1.6, r * 0.14), 0, 7); g.fill(); };
function arrow(g: CanvasRenderingContext2D, x: number, y: number, yaw: number, s: number) { g.save(); g.translate(x, y); g.rotate(-yaw); g.fillStyle = '#e8e2d2'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.62, s * 0.7); g.lineTo(0, s * 0.35); g.lineTo(-s * 0.62, s * 0.7); g.closePath(); g.fill(); g.stroke(); g.restore(); }
function markers(st: MapState) { return threadMarkers(st.thread, st.t ?? 0); }
/** nearest marker the dashed guide line points at */
function nearest(st: MapState) { let best: { x: number; z: number } | undefined, d = 1e9; for (const m of markers(st)) { const dd = Math.hypot(m.x - st.x, m.z - st.z); if (dd < d) { d = dd; best = m; } } return best; }
export function drawMain(cv: HTMLCanvasElement, st: MapState) {
  cache ??= build(); const g = cv.getContext('2d')!; const k = Math.min(cv.width / cache.width, cv.height / cache.height); const ox = (cv.width - cache.width * k) / 2, oy = (cv.height - cache.height * k) / 2;
  g.fillStyle = '#07080a'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(cache, ox, oy, cache.width * k, cache.height * k);
  const X = (x: number) => ox + px(x) * k, Z = (z: number) => oy + pz(z) * k, pulse = 0.75 + 0.25 * Math.sin(st.time * 3);
  const n = nearest(st); if (n) { g.setLineDash([6, 7]); g.strokeStyle = 'rgba(255,70,50,.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(st.x), Z(st.z)); g.lineTo(X(n.x), Z(n.z)); g.stroke(); g.setLineDash([]); }
  for (const m of markers(st)) { glow(g, X(m.x), Z(m.z), 22 * pulse, 1); g.strokeStyle = `rgba(255,80,60,${0.5 * pulse})`; g.lineWidth = 1; g.beginPath(); g.arc(X(m.x), Z(m.z), 12 + 5 * pulse, 0, 7); g.stroke(); }
  arrow(g, X(st.x), Z(st.z), st.yaw, 11);
}
export function drawMini(cv: HTMLCanvasElement, st: MapState) {
  cache ??= build(); const g = cv.getContext('2d')!, R = 46, S = cv.width / (2 * R * PPM) ; // 92 m window
  g.save(); g.fillStyle = '#07080a'; g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(cache, px(st.x - R), pz(st.z - R), 2 * R * PPM, 2 * R * PPM, 0, 0, cv.width, cv.height);
  const X = (x: number) => (x - st.x + R) * PPM * S, Z = (z: number) => (z - st.z + R) * PPM * S, pulse = 0.75 + 0.25 * Math.sin(st.time * 3);
  const n = nearest(st);
  for (const m of markers(st)) { const x = X(m.x), z = Z(m.z), inside = x > 6 && z > 6 && x < cv.width - 6 && z < cv.height - 6;
    if (inside) glow(g, x, z, 13 * pulse, 1);
    else { const a = Math.atan2(m.x - st.x, -(m.z - st.z)); const cx = cv.width / 2, cy = cv.height / 2, e = cv.width / 2 - 9; g.save(); g.translate(cx + Math.sin(a) * e, cy - Math.cos(a) * e); g.rotate(a); glow(g, 0, 0, 10, 0.9); g.fillStyle = 'rgba(255,110,90,.95)'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 3); g.lineTo(-4, 3); g.fill(); g.restore(); } }
  if (n) { g.setLineDash([3, 5]); g.strokeStyle = 'rgba(255,70,50,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cv.width / 2, cv.height / 2); g.lineTo(X(n.x), Z(n.z)); g.stroke(); g.setLineDash([]); }
  arrow(g, cv.width / 2, cv.height / 2, st.yaw, 8);
  const vg = g.createRadialGradient(cv.width / 2, cv.height / 2, cv.width * 0.3, cv.width / 2, cv.height / 2, cv.width * 0.72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = vg; g.fillRect(0, 0, cv.width, cv.height); g.restore();
}
export const threadText = (k: string) => (THREADS[k] ? pick(THREADS[k]) : '');
