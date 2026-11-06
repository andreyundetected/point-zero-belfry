import { createRequire } from 'node:module';
const require = createRequire('/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
await page.goto('http://localhost:5173/?shot=' + (process.argv[2] || 'plaza'), { waitUntil: 'load' }); await page.waitForFunction('window.READY===true', null, { timeout: 240000 });
const r = await page.evaluate(async () => { const g = window.__game; const R = g.eng.renderer; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); await sleep(1500); const a = R.info.render.calls; g.eng.scene.traverse((o) => { if (o.isLight && o.castShadow) o.castShadow = false; }); await sleep(2500); const b = R.info.render.calls; return { withShadow: a, withoutShadow: b, tris: R.info.render.triangles }; });
console.log(JSON.stringify(r)); await browser.close();
