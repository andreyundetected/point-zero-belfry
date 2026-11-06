import { hrand } from '../sim/util';
const NEON = ['#35f2e6', '#ff4fd8', '#ffe14a', '#9b6bff', '#ff3b5c', '#6aa0ff', '#7dff9b'];
const SKIN = [[224, 185, 160], [198, 144, 119], [154, 107, 80], [110, 74, 54], [241, 210, 191], [141, 90, 60]];
const HAIR = ['#0d0d0f', '#2a1a12', '#5a3a20', '#b0a090', '#ff4fd8', '#35f2e6', '#8a2030', '#d8d8d8', '#3a2a5a'];
const rgb = (c: number[], f = 1) => `rgb(${Math.min(255, c[0] * f) | 0},${Math.min(255, c[1] * f) | 0},${Math.min(255, c[2] * f) | 0})`;

/** Procedural painted portrait: face with neon rim light, eyes/implants, hair, collar, bokeh background. */
export function drawPortrait(c: HTMLCanvasElement, id: string) {
  const W = (c.width = 300), H = (c.height = 380), g = c.getContext('2d')!;
  const r = (k: number) => hrand(41, id, k);
  const rim = NEON[Math.floor(r(1) * NEON.length)], rim2 = NEON[Math.floor(r(2) * NEON.length)];
  const child = id === 'lea' || id.includes('student'), old = ['mok', 'sol', 'gas', 'lior', 'yan', 'vera'].includes(id) || r(30) < 0.15;
  const fem = ['lea', 'mara', 'ila', 'dana', 'nisa', 'yuna', 'vera', 'ro_wife'].includes(id) || (!['pike', 'yan', 'mok', 'ro', 'lash', 'kay', 'burn', 'hart', 'gas', 'emil', 'lior', 'osip', 'feld', 'sol', 'todd', 'courier', 'collector1', 'collector2'].includes(id) && r(31) < 0.5);
  // background: rainy city bokeh
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#07080f'); bg.addColorStop(1, '#141030'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const x = r(100 + i) * W, y = r(200 + i) * H * 0.8, rr = 4 + r(300 + i) * 22; const col = NEON[i % NEON.length]; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, col + '55'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(160,190,255,0.12)'; g.beginPath(); const x = r(400 + i) * W, y = r(500 + i) * H; g.moveTo(x, y); g.lineTo(x - 3, y + 18); g.stroke(); }
  const skin = SKIN[Math.floor(r(3) * SKIN.length)], hair = HAIR[Math.floor(r(4) * HAIR.length)];
  const cx = W / 2 + (r(5) - 0.5) * 20, fy = child ? 175 : 160, fw = (child ? 58 : 66) + r(6) * 10 - (fem ? 6 : 0), fh = (child ? 74 : 88) + r(7) * 10;
  // shoulders / coat
  const coat = ['#1c1f2a', '#2a2230', '#30343e', '#3a2a24', '#1a2a2a', '#4a3a5a', '#14161e'][Math.floor(r(8) * 7)];
  g.fillStyle = coat; g.beginPath(); g.moveTo(cx - 150, H); g.quadraticCurveTo(cx - 130, fy + 120, cx - 40, fy + 92); g.lineTo(cx + 40, fy + 92); g.quadraticCurveTo(cx + 130, fy + 120, cx + 150, H); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.moveTo(cx - 30, fy + 95); g.lineTo(cx, H); g.lineTo(cx + 30, fy + 95); g.fill(); // collar shadow
  // neck
  g.fillStyle = rgb(skin, 0.6); g.fillRect(cx - fw * 0.32, fy + fh * 0.6, fw * 0.64, 50);
  // face with side lighting
  const fg = g.createLinearGradient(cx - fw, 0, cx + fw, 0); fg.addColorStop(0, rgb(skin, 0.35)); fg.addColorStop(0.55, rgb(skin, 0.85)); fg.addColorStop(1, rgb(skin, 1.05));
  g.fillStyle = fg; g.beginPath(); g.ellipse(cx, fy, fw, fh, 0, 0, Math.PI * 2); g.fill();
  // jaw shading
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(cx - fw * 0.35, fy + fh * 0.3, fw * 0.6, fh * 0.6, 0.3, 0, Math.PI * 2); g.fill();
  // eyes
  const ey = fy - fh * 0.08, ex = fw * 0.38, implant = r(9) < 0.4 || id === 'nisa' || id === 'hart';
  for (const s of [-1, 1]) {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx + s * ex, ey + 2, 15, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8e4e0'; g.beginPath(); g.ellipse(cx + s * ex, ey, 11, 5.5, 0, 0, Math.PI * 2); g.fill();
    const iris = implant && s === 1 ? rim : ['#3a2a1a', '#2a4a6a', '#2a5a3a', '#5a4030'][Math.floor(r(10) * 4)];
    g.fillStyle = iris; g.beginPath(); g.arc(cx + s * ex + 1, ey, 4.6, 0, Math.PI * 2); g.fill();
    if (implant && s === 1) { g.shadowColor = rim; g.shadowBlur = 16; g.fillRect(cx + s * ex - 1, ey - 1, 3, 3); g.shadowBlur = 0; }
    g.fillStyle = '#000'; g.beginPath(); g.arc(cx + s * ex + 1, ey, 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = hair === '#d8d8d8' ? '#888' : '#1a120c'; g.lineWidth = fem ? 2.5 : 4; g.beginPath(); g.moveTo(cx + s * (ex - 13), ey - 12 - (old ? 2 : 0)); g.quadraticCurveTo(cx + s * ex, ey - 17 - r(11) * 4, cx + s * (ex + 14), ey - 11); g.stroke();
  }
  // nose & mouth
  g.strokeStyle = rgb(skin, 0.45); g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx + 3, ey + 6); g.lineTo(cx + 8, fy + fh * 0.3); g.lineTo(cx - 2, fy + fh * 0.33); g.stroke();
  const my = fy + fh * 0.52, mood = r(12) - 0.5;
  g.strokeStyle = fem ? '#8a3a4a' : rgb(skin, 0.4); g.lineWidth = fem ? 4 : 3; g.beginPath(); g.moveTo(cx - 16, my); g.quadraticCurveTo(cx, my + mood * 10, cx + 16, my); g.stroke();
  if (old) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 22, fy + fh * 0.2); g.quadraticCurveTo(cx + s * 28, my, cx + s * 20, my + 14); g.stroke(); } }
  if (!fem && !child && r(13) < 0.4) { g.fillStyle = 'rgba(20,15,10,0.35)'; g.beginPath(); g.ellipse(cx, fy + fh * 0.62, fw * 0.7, fh * 0.4, 0, 0, Math.PI); g.fill(); } // stubble
  // hair
  g.fillStyle = hair; const hs = Math.floor(r(14) * 5);
  g.beginPath(); g.ellipse(cx, fy - fh * 0.55, fw * 1.08, fh * 0.6, 0, Math.PI, 0); g.fill();
  if (fem || hs === 1) { g.fillRect(cx - fw * 1.08, fy - fh * 0.55, fw * 0.32, fh * (fem ? 1.5 : 0.9)); g.fillRect(cx + fw * 0.76, fy - fh * 0.55, fw * 0.32, fh * (fem ? 1.5 : 0.9)); }
  if (hs === 2 && !fem) { g.fillStyle = rgb(skin, 0.7); g.beginPath(); g.ellipse(cx, fy - fh * 0.6, fw * 0.95, fh * 0.42, 0, Math.PI, 0); g.fill(); } // shaved
  if (hs === 3) { g.fillStyle = hair; g.fillRect(cx - 8, fy - fh * 1.2, 16, fh * 0.5); } // mohawk
  if (id === 'kay' || hs === 4) { g.fillStyle = '#16181f'; g.beginPath(); g.ellipse(cx, fy - fh * 0.55, fw * 1.25, fh * 0.75, 0, Math.PI, 0); g.fill(); g.fillRect(cx - fw * 1.25, fy - fh * 0.56, fw * 2.5, 10); } // hood/cap
  // implant lines / tattoo
  if (implant) { g.strokeStyle = rim; g.shadowColor = rim; g.shadowBlur = 10; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + fw * 0.55, ey + 8); g.lineTo(cx + fw * 0.85, ey + 8); g.lineTo(cx + fw * 0.9, fy + fh * 0.4); g.stroke(); g.shadowBlur = 0; }
  if (id === 'lash' || id === 'dana') { g.fillStyle = 'rgba(10,10,14,0.9)'; g.fillRect(cx - ex - 16, ey - 8, ex * 2 + 32, 15); g.fillStyle = rim2; g.globalAlpha = 0.6; g.fillRect(cx - ex - 16, ey - 2, ex * 2 + 32, 2); g.globalAlpha = 1; }
  // neon rim light on one side + coloured fill on the other
  g.globalCompositeOperation = 'lighter';
  const rg = g.createLinearGradient(cx + fw * 0.4, 0, cx + fw * 1.1, 0); rg.addColorStop(0, rim + '00'); rg.addColorStop(1, rim + '88');
  g.fillStyle = rg; g.beginPath(); g.ellipse(cx, fy, fw, fh, 0, 0, Math.PI * 2); g.fill();
  const lg = g.createLinearGradient(cx - fw * 1.1, 0, cx - fw * 0.3, 0); lg.addColorStop(0, rim2 + '55'); lg.addColorStop(1, rim2 + '00');
  g.fillStyle = lg; g.beginPath(); g.ellipse(cx, fy, fw, fh, 0, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = rim; g.shadowColor = rim; g.shadowBlur = 18; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, fy, fw, fh, 0, -1.0, 1.2); g.stroke();
  g.strokeStyle = rim2; g.shadowColor = rim2; g.beginPath(); g.moveTo(cx - 150, H); g.quadraticCurveTo(cx - 130, fy + 120, cx - 40, fy + 92); g.stroke(); g.shadowBlur = 0;
  // film grain + scanlines
  for (let y = 0; y < H; y += 3) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, y, W, 1); }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${r(600 + i) * 0.05})`; g.fillRect(r(700 + i) * W, r(800 + i) * H, 1, 1); }
}
