const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5194, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://127.0.0.1:5194/?at=20.5,9,26,9&t=1:00&y=0.1'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  await p.waitForTimeout(8000);
  const o = await p.evaluate(async () => { const g = window.game, { THREE } = window.dbg; for (let i = 0; i < 90; i++) g.update(1 / 30); const out = {}; { const per = g.npcs.active.get('ned'); let n = null; per.root.traverse(o => { if (o.name === 'mixamorigHead') n = o; }); const ch = []; while (n && n !== per.root.parent) { ch.push([n.name, +n.scale.x.toFixed(4), +n.position.y.toFixed(3), n.type]); n = n.parent; } out.chain = ch.slice(0, 14); }
    for (const id of ['ned', 'ignat', 'agata']) { const per = g.npcs.active.get(id); if (!per) { out[id] = 'none'; continue; } per.root.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(per.root); let head; per.root.traverse(o => { if (o.name === 'mixamorigHead') head = o; }); const hv = new THREE.Vector3(); head.getWorldPosition(hv);
      const inner = per.root.children[0]; const hs = new THREE.Vector3(); head.getWorldScale(hs); const hp = head.position.clone(); const sk = per.body.skeleton; const hips = sk.bones.find(b => b.name === 'mixamorigHips'); const hw = new THREE.Vector3(); hips.getWorldPosition(hw); out[id + '_dbg'] = { innerScale: inner.scale.x, headScale: hs.x, headLocal: [hp.x, hp.y, hp.z], hipsWorld: [hw.x, hw.y, hw.z], rootPos: per.root.position.toArray(), rootScale: per.root.scale.x }; out[id] = { cur: per.cur, y: +per.root.position.y.toFixed(2), top: +bb.max.y.toFixed(2), headY: +hv.y.toFixed(2), floor: +g.npcs.pose(id).y.toFixed(2) }; }
    return out; });
  console.log(JSON.stringify(o)); await b.close(); await srv.close();
})();
