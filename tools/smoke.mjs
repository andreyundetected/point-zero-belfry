// Дымовой тест в браузере: загрузка, диалог, Окно, журнал, прыжок. Без скриншотов.
import { createRequire } from 'node:module';
const require = createRequire('/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
await page.goto(process.argv[2] || 'http://localhost:5173/', { waitUntil: 'load' });
await page.waitForFunction('window.READY!==undefined', null, { timeout: 240000 });
const r = await page.evaluate(async () => {
  const g = window.__game; const out = [];
  g.begin(); out.push('begin ok');
  // диалог с Игнатом
  g.pos.set(-36, 12.5); g.floor = 0; g.S.move(-36, 12.5, 0, 0); g.S.advance(1);
  g.openDialog('ignat'); out.push('dialog open: ' + (document.querySelector('.modal') ? 'yes' : 'no'));
  document.querySelectorAll('.choices .btn')[2]?.click(); out.push('dialog choice -> facts ' + g.w.player.facts.join(','));
  g.closeModal();
  // журнал
  g.openJournal(); out.push('journal: ' + (document.querySelector('.tab') ? 'yes' : 'no')); g.closeModal();
  // осмотр
  g.pos.set(12, 17.2); g.S.move(12, 17.2, 0, 0); g.updateTarget(1); g.inspectObj('bench', 'bench'); out.push('inspect ok'); g.closeModal();
  // Окно (запечатано)
  g.pos.set(0, -28.6); g.floor = 2; g.S.move(0, -28.6, 2, 0); g.openWindow(); out.push('window: ' + document.querySelector('.card h2')?.textContent); g.closeModal();
  // быстрый прогон до T1 и финал
  g.S.advanceTo(2400); await new Promise((r) => setTimeout(r, 600)); out.push('ended=' + g.S.ended + ' ending=' + g.S.ending + ' modal=' + !!document.querySelector('.modal'));
  return out;
});
console.log(r.join('\n')); console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await browser.close();
