// frame cost / draw calls / triangles at a few places
const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5173, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const spots = { square: '/?noprologue=1&at=-62,-44,-66,-40&t=05:00', bridge: '/?noprologue=1&at=-5,-0.6,8,4.2&y=1.0&t=11:50', tavern: '/?noprologue=1&at=21.2,11.5,27,8&t=03:00', rynok: '/?noprologue=1&at=-40,-10.5,-40,-15&t=33:00', roof: '/?noprologue=1&at=-70,-56.3,-70,-64&y=roof&t=03:00' };
  for (const [n, u] of Object.entries(spots)) { const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
    await p.goto('http://127.0.0.1:5173' + u + '&scale=1'); await p.waitForFunction('window.done', null, { timeout: 300000 }); await p.waitForTimeout(6000);
    const r = await p.evaluate(() => { const R = window.renderer; R.info.autoReset = false; const g = window.game; let upd = 0, n = 0; const u0 = g.update.bind(g); g.update = dt => { const a = performance.now(); u0(dt); upd += performance.now() - a; n++; }; R.info.reset(); return new Promise(res => setTimeout(() => res({ calls: Math.round(R.info.render.calls / n), tris: Math.round(R.info.render.triangles / n), updMs: (upd / n).toFixed(1), frames: n }), 3000)); }); const r2 = await p.evaluate(() => { const R = window.renderer; const i = R.info; let people = 0; window.dbg.scene.traverse(o => { if (o.isSkinnedMesh && o.visible) people++; }); let lights = 0; window.dbg.scene.traverse(o => { if (o.isLight && o.intensity > 0) lights++; }); const t0 = performance.now(); let frames = 0; return new Promise(res => { const tick = () => { frames++; if (performance.now() - t0 > 2000) res({ calls: i.render.calls, tris: i.render.triangles, geoms: i.memory.geometries, tex: i.memory.textures, progs: i.programs.length, skinned: people, lights, ms: ((performance.now() - t0) / frames).toFixed(1) }); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }); });
    console.log(n.padEnd(8), JSON.stringify(r), JSON.stringify(r2)); await p.close(); }
  await b.close(); await srv.close();
})();
