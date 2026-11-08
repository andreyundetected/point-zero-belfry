// usage: node tools/shot.cjs out.png "/?shot=1"            (one shot)
//        node tools/shot.cjs --multi outdir name1="/?shot=1" name2="/?at=..."   (several shots, one browser)
const { chromium } = require('playwright'); const { createServer } = require('vite'); const fs = require('fs'); const path = require('path');
(async () => {
  let jobs = [];
  if (process.argv[2] === '--multi') { const dir = process.argv[3]; fs.mkdirSync(dir, { recursive: true }); jobs = process.argv.slice(4).map(a => { const i = a.indexOf('='); return [path.join(dir, a.slice(0, i) + '.png'), a.slice(i + 1)]; }); }
  else jobs = [[process.argv[2] || 'shot.png', process.argv[3] || '/']];
  const srv = await createServer({ server: { port: 5199, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [out, url] of jobs) {
    const p = await b.newPage({ viewport: { width: 1600, height: 700 } });
    p.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
    p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { const t = m.text(); if (!/vite|deprecated|PCFSoft/.test(t)) console.log('console', t); });
    await p.goto('http://127.0.0.1:5199' + url);
    await p.waitForFunction('window.done', null, { timeout: 300000 });
    await p.waitForTimeout(+(process.env.SHOT_WAIT||7000)); await p.evaluate('window.FREEZE=true'); await p.waitForTimeout(600);
    const data = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
    fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64')); console.log('saved', out); await p.close();
  }
  await b.close(); await srv.close();
})();
