const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5174, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  await p.goto('http://127.0.0.1:5174/?noprologue=1&at=0,30,0,0&scale=0.3'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const r = await p.evaluate(async (paths) => { const { loadModel } = await import('/src/world/props.ts'); const out = {}; for (const path of paths) { try { const m = await loadModel(path); let tris = 0; m.parts.forEach(pt => tris += (pt.geo.index ? pt.geo.index.count : pt.geo.attributes.position.count) / 3); out[path] = m.size.toArray().map(v => +v.toFixed(2)).join('x') + ' tris ' + tris; } catch (e) { out[path] = 'ERR'; } } return out; }, process.argv.slice(2));
  console.log(JSON.stringify(r, null, 1)); await b.close(); await srv.close();
})();
