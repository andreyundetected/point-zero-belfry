const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5175, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5175/?noprologue=1&at=0,30,0,0&scale=0.3'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const r = await p.evaluate(async () => { const T = window.dbg.THREE; const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'); const L = new GLTFLoader();
    const g = await L.loadAsync('/models/people/mixamo/mixamo_anims.glb'); const u1 = await L.loadAsync('/models/people/universal/anims/ual1.glb'); const u2 = await L.loadAsync('/models/people/universal/anims/ual2.glb');
    const info = c => c.name + ' ' + c.duration.toFixed(2) + 's ' + c.tracks.length + 'tr ' + (c.tracks.find(t=>/Hips.position/.test(t.name)) ? 'hipsPos' : '');
    return { mix: g.animations.map(info), ual: [...u1.animations, ...u2.animations].map(c => c.name + ' ' + c.duration.toFixed(2)) }; });
  console.log(JSON.stringify(r, null, 1)); await b.close(); await srv.close();
})();
