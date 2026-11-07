// Скриншоты игры на локальном дев-сервере: node tools/shot_game.cjs
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => { errors.push(e.stack || e.message); console.log('PAGEERROR', e.message); });
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  p.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });

  fs.mkdirSync('docs/screenshots', { recursive: true });
  await p.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('#start-btn', { timeout: 120000 });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'docs/screenshots/01_intro.png' });
  console.log('intro ok');

  await p.click('#start-btn');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'docs/screenshots/02_prologue.png' });
  console.log('prologue ok');

  // пролистать диалог пролога
  for (let i = 0; i < 12; i++) {
    const next = await p.$('.dlg-next, .dlg-choice');
    if (!next) break;
    await next.click();
    await p.waitForTimeout(350);
  }
  await p.waitForTimeout(1200);
  await p.screenshot({ path: 'docs/screenshots/03_roof.png' });
  console.log('roof ok');

  // Створка
  await p.keyboard.press('Tab');
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'docs/screenshots/04_shutter.png' });
  console.log('device ok');

  const state = await p.evaluate(() => {
    const g = window.__okno?.game;
    return g ? { mode: g.mode, t: g.sim.t, thread: g.hud, pos: g.player?.pos } : null;
  });
  console.log('state', JSON.stringify(state));
  console.log('errors', errors.length);
  await b.close();
})();
