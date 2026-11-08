const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5191, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { const t = m.text(); if (/anim|warn/i.test(m.type()) && !/PropertyBinding: Can not bind to bones/.test(t)) console.log('c:', t.slice(0, 160)); });
  await p.goto('http://127.0.0.1:5191/?at=-44,-37.6,-36,-33&t=10:00'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  await p.waitForTimeout(8000);
  const o = await p.evaluate(() => { const g = window.game, { THREE } = window.dbg; for (let i = 0; i < 20; i++) g.update(1 / 30); const out = {};
    for (const id of ['orven', 'tilda']) { const per = g.npcs.active.get(id); if (!per) { out[id] = 'none'; continue; } let arm; per.root.traverse(o => { if (o.name === 'mixamorigLeftForeArm') arm = o; });
      const w = (n) => { const v = new THREE.Vector3(); arm.getWorldPosition(v); return v.toArray().map(x => +x.toFixed(3)); }; const a = w(); for (let i = 0; i < 10; i++) g.update(1 / 20); const b2 = w();
      out[id] = { cur: per.cur, pose: g.npcs.pose(id).a, running: per.action?.isRunning(), time: per.action?.time, w: per.action?.getEffectiveWeight(), armMoved: Math.hypot(a[0] - b2[0], a[1] - b2[1], a[2] - b2[2]).toFixed(3), tracks: per.action?.getClip().tracks.length, first: per.action?.getClip().tracks[0]?.name }; }
    return out; });
  console.log(JSON.stringify(o)); await b.close(); await srv.close();
})();
