const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5188, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('okno.lang', 'ru'); } catch (e) {} }); await p.goto('http://127.0.0.1:5188/?noprologue=1&gun=1&at=20.6,9,26,9&t=11:00&y=0.1'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const r = await p.evaluate(async () => { const g = window.game, P = window.player, o = {};
    for (let i = 0; i < 60; i++) g.update(1 / 60); o.inside = g.sceneInside; g.combat.alarm('test'); o.hunters = [...g.combat.dyn.keys()].length;
    // shoot at ignat: aim at his pose
    const ig = g.npcs.pose('ignat'); P.yaw = Math.atan2(-(ig.x - P.body.x), -(ig.z - P.body.z)); P.pitch = Math.atan2(ig.y + 0.9 - (P.body.y + 1.65), Math.hypot(ig.x - P.body.x, ig.z - P.body.z)); P.apply();
    g.combat.aiming = true; for (let i = 0; i < 8; i++) { g.combat.fireCool = 0; g.combat.shoot(); g.update(1 / 60); }
    o.ammo = g.s.mag; o.ignatMode = g.combat.dyn.get('ignat')?.mode; o.flag = g.s.flags.has('ignatDead');
    for (let i = 0; i < 1500; i++) { g.update(1 / 30); if (g.s.ended) break; } o.ended = g.s.ended; o.hits = g.combat.hits; return o; });
  console.log(JSON.stringify(r)); console.log('errors', errs); await b.close(); await srv.close();
})();
