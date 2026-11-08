// the "through the wall via time" puzzle (spec 8.1): ruins at 22:45 -> jump to 22:15 on the same spot -> inside the closed storeroom -> take the revolver
const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5192, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:5192/?noprologue=1&t=45:00&at=-40,-17,-40,-21'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const r = await p.evaluate(async () => {
    const g = window.game, P = window.player, o = {}; const spot = { x: -40 + 0 }; for (let i = 0; i < 30; i++) g.update(1 / 60);
    o.ruin = g.fomaRuin; o.t0 = g.s.t.toFixed(0);
    // walk into the ruin from the street: front wall remnants have a door gap in the middle
    P.place(-40, -12.5, -40, -22, 0); P.keys = { KeyW: true }; for (let i = 0; i < 420; i++) g.update(1 / 60); P.keys = {}; o.inside = [P.body.x.toFixed(1), P.body.z.toFixed(1)];
    // stand on the storeroom spot (lx 2.2, lz -6.8) and jump to 22:15
    const sx = -40 + 2.2, sz = -14.4 - 6.8; P.place(sx, sz, sx, sz - 3, 0); for (let i = 0; i < 20; i++) g.update(1 / 60);
    const before = [P.body.x, P.body.z]; await g.doJump(15 * 60); await new Promise(r => setTimeout(r, 1800)); for (let i = 0; i < 30; i++) g.update(1 / 60);
    o.afterJump = { t: g.s.t.toFixed(0), ruin: g.fomaRuin, moved: Math.hypot(P.body.x - before[0], P.body.z - before[1]).toFixed(2), y: P.body.y.toFixed(2) };
    const it = g.findInteract(); o.prompt = it?.label; it?.fn(); o.gun = g.s.hasGun; o.ammo = [g.s.mag, g.s.ammo];
    // try to walk out through the wall: must be blocked
    P.keys = { KeyS: true, ShiftLeft: true }; P.yaw = 0; for (let i = 0; i < 240; i++) g.update(1 / 60); P.keys = {}; o.afterWalkOut = [P.body.x.toFixed(1), P.body.z.toFixed(1)];
    return o; });
  console.log(JSON.stringify(r)); console.log('errors', errs); await b.close(); await srv.close();
})();
