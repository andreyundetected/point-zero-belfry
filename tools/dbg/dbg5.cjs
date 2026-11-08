const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5186, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5186/?noprologue=1&at=20.5,12.6,25.5,6.5&t=3:00&y=0.1'); await p.waitForFunction('window.done', null, { timeout: 300000 }); await p.waitForTimeout(6000);
  const o = await p.evaluate(() => { const g = window.game; for (let i = 0; i < 5; i++) g.update(1 / 60); const out = {}; for (const id of ['ned', 'ignat', 'agata']) { const per = g.npcs.active.get(id); if (!per) continue; const parts = []; per.root.traverse(m => { if (m.isMesh && m.visible) { const n = m.geometry.index ? m.geometry.index.count / 3 : m.geometry.attributes.position.count / 3; parts.push([m.name || m.type, Math.round(n), Array.isArray(m.material) ? m.material.length : 1]); } }); out[id] = parts; } return out; });
  console.log(JSON.stringify(o)); await b.close(); await srv.close();
})();
