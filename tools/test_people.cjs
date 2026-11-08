const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5197, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (/warn|rt|anim|error/i.test(m.type())) console.log('console', m.text()); });
  await p.goto('http://127.0.0.1:5197/?at=-34,-3,-60,-8.5'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const res = await p.evaluate(async () => {
    const { createPerson, scene, THREE } = window.dbg; const out = {};
    for (const body of ['james', 'remy', 'liza', 'michelle']) {
      const t0 = performance.now(); const per = await createPerson({ body, coat: 0x2b2a28, long: true, hat: 'fedora' }, body); scene.add(per.root);
      await per.anim('idle'); await per.anim('walk'); per.update(0.5); per.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(per.root); const sz = box.getSize(new THREE.Vector3());
      out[body] = { h: +sz.y.toFixed(2), w: +sz.x.toFixed(2), ms: Math.round(performance.now() - t0) };
    }
    const kid = await createPerson({ body: 'liza', coat: 0x4a4238, skirt: true, hat: 'scarf', scale: 0.6 }, 'k'); scene.add(kid.root); kid.root.updateMatrixWorld(true);
    out.kid = +new THREE.Box3().setFromObject(kid.root).getSize(new THREE.Vector3()).y.toFixed(2);
    for (const a of ['talk', 'sit', 'fold', 'rail', 'drive', 'pistol', 'die', 'shoot', 'carry', 'lantern']) { await kid.anim(a); }
    return out;
  });
  console.log(JSON.stringify(res)); await b.close(); await srv.close();
})();
