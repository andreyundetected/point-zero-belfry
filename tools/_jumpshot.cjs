const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5171, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const p = await b.newPage({ viewport: { width: 1600, height: 700 } });
  await p.goto('http://127.0.0.1:5171/?noprologue=1&at=-5,-0.6,8,4.2&y=1.0&t=09:00'); await p.waitForFunction('window.done', null, { timeout: 300000 }); await p.waitForTimeout(5000);
  await p.evaluate(() => { window.game.jumpFx = 0.55; }); await p.waitForTimeout(300);
  const data = await p.evaluate(() => window.renderer.domElement.toDataURL('image/png')); require('fs').writeFileSync(process.argv[2], Buffer.from(data.split(',')[1], 'base64'));
  await b.close(); await srv.close();
})();
