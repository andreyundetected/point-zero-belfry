// usage: node tools/shot_ui.cjs "<url>" out.png "<js to run in page>" [waitMs]   (full page screenshot, DOM overlays included)
const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5185, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1280, height: 640 } });
  await p.addInitScript(() => { try { localStorage.setItem('okno.lang', 'ru'); } catch (e) {} });
  await p.goto('http://127.0.0.1:5185' + process.argv[2]); await p.waitForFunction('window.done', null, { timeout: 300000 }); await p.waitForTimeout(+(process.argv[5] || 6000));
  await p.evaluate(process.argv[4] || '0'); await p.waitForTimeout(1500); await p.screenshot({ path: process.argv[3] }); await b.close(); await srv.close();
})();
