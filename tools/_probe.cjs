const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5176, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  p.on('console', m => { const t = m.text(); if (/anim|person|warn/i.test(t)) console.log('console', t); });
  await p.goto('http://127.0.0.1:5176' + process.argv[2]); await p.waitForFunction('window.done', null, { timeout: 300000 }); await p.waitForTimeout(+(process.argv[4] || 7000));
  console.log(await p.evaluate(process.argv[3])); await b.close(); await srv.close();
})();
