const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5196, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 480, height: 300 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console.error ' + m.text()); });
  p.on('response', r => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
  await p.addInitScript(() => { try { localStorage.setItem('okno.lang', 'ru'); } catch (e) {} }); await p.goto('http://127.0.0.1:5196/?noprologue=1'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const out = await p.evaluate(async () => { const g = window.game, P = window.player; window.FREEZE = true; const o = {};
    for (let i = 0; i < 120; i++) g.update(1 / 60);
    o.start = [P.body.x.toFixed(1), P.body.y.toFixed(2), P.body.z.toFixed(1), g.s.t.toFixed(1)];
    o.interact = g.findInteract()?.label; o.thread = g.s.thread;
    // jump test on the roof
    P.keys = {}; P.jumpQueued = true; let pk = P.body.y; const y0 = P.body.y; for (let i = 0; i < 60; i++) { g.update(1 / 60); pk = Math.max(pk, P.body.y); } o.roofJump = +(pk - y0).toFixed(2);
    // walk to the parapet and try to leave the roof
    P.place(-70, -56.6, -70, -70, 0, P.body.y); P.keys = { KeyW: true, ShiftLeft: true }; for (let i = 0; i < 300; i++) g.update(1 / 60); P.keys = {}; o.parapet = [P.body.x.toFixed(2), P.body.z.toFixed(2), P.body.y.toFixed(2)];
    // npcs
    await new Promise(r => setTimeout(r, 2500)); for (let i = 0; i < 30; i++) g.update(1 / 60);
    o.people = [...g.npcs.active.keys()];
    return o; });
  console.log(JSON.stringify(out)); console.log('errors:', errs.length, errs.slice(0, 8)); await b.close(); await srv.close();
})();
