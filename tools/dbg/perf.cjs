const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5187, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  await p.addInitScript(() => { try { localStorage.setItem('okno.lang', 'ru'); } catch (e) {} });
  await p.goto('http://127.0.0.1:5187/?noprologue=1&at=-34,-3,-60,-9&t=3:00'); await p.waitForFunction('window.done', null, { timeout: 300000 }); await p.waitForTimeout(6000);
  const spots = { street: [-34, -3, -60, -9], tavern: [20.5, 12.6, 25.5, 6.5], bridge: [-12, 0.2, 30, -10], square: [-60, -35, -75, -50] };
  const out = {}; for (const [k, v] of Object.entries(spots)) { out[k] = await p.evaluate(async (v) => { const g = window.game, P = window.player; P.place(v[0], v[1], v[2], v[3], 0); for (let i = 0; i < 5; i++) g.update(1 / 60); await new Promise(r => setTimeout(r, 4000)); for (let i = 0; i < 5; i++) g.update(1 / 60); const r = window.renderer; r.info.autoReset = false; r.info.reset(); window.dispatchEvent(new Event('x')); await new Promise(r2 => requestAnimationFrame(r2)); const snap = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.autoReset = true; return { ...snap, __: 0 }; return { calls: r.info.render.calls, tris: r.info.render.triangles, people: g.npcs.active.size }; }, v); }
  console.log(JSON.stringify(out)); await b.close(); await srv.close();
})();
