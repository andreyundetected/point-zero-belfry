const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5189, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://127.0.0.1:5189/?at=-70.4,-56.6,-71.2,-60.4&y=roof&t=1:00'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  await p.waitForTimeout(3000);
  const o = await p.evaluate(() => { const g = window.game; for (let i = 0; i < 20; i++) g.update(1 / 60); const b = g.player.body; return { inside: g.sceneInside, hemi: g.hemi.intensity, moon: g.moon.intensity, y: b.y, pos: [b.x, b.z], lights: g.pool.lights.map(l => [+l.intensity.toFixed(1), +l.position.x.toFixed(1), +l.position.y.toFixed(1), +l.position.z.toFixed(1)]) }; });
  console.log(JSON.stringify(o)); await b.close(); await srv.close();
})();
