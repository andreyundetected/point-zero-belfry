const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5174, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5174/?noprologue=1&at=0,30,0,0&scale=0.3'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const r = await p.evaluate(async (paths) => { const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'); const L = new GLTFLoader(); const out = {};
    for (const path of paths) { const g = await L.loadAsync('/models/' + path + '.glb'); const ms = []; g.scene.traverse(o => { if (o.isMesh) ms.push(o.name + ' / ' + (o.material.name) + ' #' + o.material.color?.getHexString() + ' e' + o.material.emissive?.getHexString() + ' tris ' + (o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3)); }); out[path] = ms; }
    return out; }, process.argv.slice(2));
  console.log(JSON.stringify(r, null, 1)); await b.close(); await srv.close();
})();
