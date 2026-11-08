// usage: node tools/shot.cjs "/?shot=1" docs/screenshots/x.png   (dev server is started automatically)
const { chromium } = require('playwright'); const { createServer } = require('vite'); const fs = require('fs');
(async () => {
  const srv = await createServer({ server: { port: 5199, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 700 } });
  p.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => console.log('console', m.text()));
  await p.goto('http://127.0.0.1:5199' + (process.argv[2] || '/'));
  await p.waitForFunction('window.done', null, { timeout: 240000 });
  await p.evaluate('window.FREEZE=true'); await p.waitForTimeout(2000);
  const data = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  fs.writeFileSync(process.argv[3] || 'shot.png', Buffer.from(data.split(',')[1], 'base64'));
  await b.close(); await srv.close();
})();
