import { createRequire } from 'node:module';
const require = createRequire('/opt/node-tools/node_modules/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:5173/?shot=' + (process.argv[2] || 'plaza'), { waitUntil: 'load' }); await page.waitForFunction('window.READY===true', null, { timeout: 240000 }); await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => { const i = window.__game.eng.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, geoms: i.memory.geometries, textures: i.memory.textures }; })), errs.join(';'));
await browser.close();
