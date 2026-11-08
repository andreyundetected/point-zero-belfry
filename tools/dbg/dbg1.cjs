const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5195, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { const t = m.text(); if (!/PropertyBinding|vite|deprecated/.test(t)) console.log('c:', t.slice(0, 200)); });
  await p.goto('http://127.0.0.1:5195/?at=-70,-56.2,-71,-59.8&y=roof&t=3:30'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  await p.waitForTimeout(6000);
  const o = await p.evaluate(() => { const g = window.game; for (let i = 0; i < 10; i++) g.update(1 / 60); return { active: [...g.npcs.active.keys()], crane: g.npcs.pose('crane'), loading: [...g.npcs.loading], t: g.s.t }; });
  console.log(JSON.stringify(o)); await b.close(); await srv.close();
})();
