const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5184, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5184/?noprologue=1&at=-44.4,-37.5,-47.3,-34.2&t=5:00&thread=orven'); await p.waitForFunction('window.done', null, { timeout: 300000 }); await p.waitForTimeout(3000);
  const o = await p.evaluate(async () => { const g = window.game; for (let i = 0; i < 30; i++) g.update(1 / 20); const m = await import('/src/world/interiors.ts'); const d = m.doors.find(x => x.id === 'orven.door'); const leaf = d.pivot.inner.children[0]; return { thread: g.s.thread, color: leaf.material.color.getHexString(), emissive: leaf.material.emissive?.getHexString(), pos: [d.x, d.y, d.z], vis: leaf.visible, parentVis: d.pivot.visible, markT: g.markT }; });
  console.log(JSON.stringify(o)); await b.close(); await srv.close();
})();
