// Урок ключа через интерфейс игры: ключ с крюка → Окно → прыжок → двойник → шкаф КШ-1.
import { createRequire } from 'node:module';
const require = createRequire('/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errs = []; page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
await page.goto('http://localhost:5173/', { waitUntil: 'load' }); await page.waitForFunction('window.READY!==undefined', null, { timeout: 240000 });
const out = await page.evaluate(async () => {
  const g = window.__game; const o = []; g.begin();
  const put = (x, z, f = 0) => { g.pos.set(x, z); g.floor = f; g.S.move(x, z, f, 0); g.S.advance(0.5); g.updateTarget(1); };
  g.S.advanceTo(975); put(-36, 11.2);
  o.push('кандидат: ' + (g.target ? g.target.kind + ':' + (g.target.id ?? g.target.p?.kind) : 'нет'));
  if (g.target?.kind === 'item') g.act(0);
  o.push('в руках: ' + g.w.player.hands);
  put(0, -28.6, 2);
  g.openWindow(); const btns = [...document.querySelectorAll('.card .btn')].map((b) => b.textContent); o.push('кнопки Окна: ' + btns.join(' | '));
  [...document.querySelectorAll('.card .btn')].find((b) => b.textContent.includes('T0'))?.click();
  o.push('после прыжка: sealed=' + g.S.sealed + ' jumps=' + g.S.jumps + ' t=' + g.w.t + ' hands=' + g.w.player.hands + ' double=' + g.w.items[g.w.player.hands]?.double);
  g.S.advanceTo(300); put(-33, 15.5);
  g.updateTarget(1); o.push('у шкафа: ' + (g.target ? g.target.id : 'нет'));
  g.S.do({ k: 'use', obj: 'ks1_door', arg: 'unlock' }, 4); o.push('шкаф открыт: ' + g.w.ks1Open);
  return o;
});
console.log(out.join('\n')); console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors'); await browser.close();
