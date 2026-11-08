// NPC routes must not cut through buildings: sample every NPC pose over the night and check it is on a free nav cell
const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5183, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 320, height: 200 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.addInitScript(() => { try { localStorage.setItem('okno.lang', 'ru'); } catch (e) {} });
  await p.goto('http://127.0.0.1:5183/?noprologue=1'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const r = await p.evaluate(async () => { const g = window.game; const nav = await import('/src/sim/nav.ts'); const m = await import('/src/world/navbuild.ts'); const grid = m.buildNav(); const { NPCS } = await import('/src/sim/npcs.ts');
    let bad = 0, n = 0; const ex = []; for (const d of NPCS) for (let t = 0; t <= 3600; t += 6) { const q = g.sim.pose(d.id, t); if (q.hidden || q.y > 3 || q.y < -1.2 && q.x > -3 && q.x < 3) continue; n++; const walking = q.walking; const i = Math.floor((q.x - grid.x0) / grid.cs), j = Math.floor((q.z - grid.z0) / grid.cs); if (nav.isBlocked(grid, i, j) && walking) { bad++; if (ex.length < 12) ex.push([d.id, t, +q.x.toFixed(1), +q.z.toFixed(1)]); } }
    return { samples: n, inWalls: bad, ex }; });
  console.log(JSON.stringify(r), errs); await b.close(); await srv.close();
})();
