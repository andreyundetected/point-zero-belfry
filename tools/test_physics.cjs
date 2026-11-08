// Hitbox / movement checks in a real page: node tools/test_physics.cjs
const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5198, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 320, height: 200 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://127.0.0.1:5198/?at=-34,-3,-60,-8.5'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const res = await p.evaluate(() => {
    const P = window.player; window.FREEZE = true; const out = {}; const walk = (key, secs, extra = {}) => { P.keys = { [key]: true, ...extra }; for (let i = 0; i < secs * 60; i++) P.update(1 / 60); P.keys = {}; };
    const face = (x, z, lx, lz) => P.place(x, z, lx, lz);
    // 1. walk into a building wall (south side of Rynok: house fronts at z~-1.6.. facing north) from the road: must stop at the wall
    face(-40, -8, -40, 8); walk('KeyW', 4, { ShiftLeft: true }); out.intoSouthHouse = [+P.body.x.toFixed(2), +P.body.z.toFixed(2)];
    // 2. canal parapet: run east from the promenade at z=-20
    face(-8.5, -20, 10, -20); walk('KeyW', 4, { ShiftLeft: true }); out.canalEdge = [+P.body.x.toFixed(2), +P.body.y.toFixed(2)];
    // 3. jump peak on flat street
    face(-30, -8, -50, -8); P.update(1 / 60); P.jumpQueued = true; let peak = P.body.y, y0 = P.body.y; for (let i = 0; i < 90; i++) { P.update(1 / 60); peak = Math.max(peak, P.body.y); } out.jumpPeak = +(peak - y0).toFixed(2); out.landedOk = P.body.grounded;
    // 4. bridge: run across from west to east, must end on the east side at deck level and never fall
    face(-12, 0, 12, 0); let minY = 9, maxY = -9; P.keys = { KeyW: true, ShiftLeft: true }; for (let i = 0; i < 360; i++) { P.update(1 / 60); minY = Math.min(minY, P.body.y); maxY = Math.max(maxY, P.body.y); } P.keys = {}; out.bridge = { x: +P.body.x.toFixed(1), minY: +minY.toFixed(2), maxY: +maxY.toFixed(2) };
    // 5. bridge parapet: try to leave the deck sideways at the middle
    face(0, 0, 0, 20); P.body.y = 1.3; P.body.x = 0; P.keys = { KeyW: true, ShiftLeft: true }; for (let i = 0; i < 240; i++) P.update(1 / 60); P.keys = {}; out.bridgeSide = [+P.body.z.toFixed(2), +P.body.y.toFixed(2)];
    // 6. jump over a parapet must fail (1.1 m), jump onto 0.7 m crate should work
    face(0, 0, 0, 20); P.body.y = 1.3; P.keys = { KeyW: true, ShiftLeft: true }; let jumped = 0; for (let i = 0; i < 240; i++) { if (i % 20 === 0) P.jumpQueued = true; P.update(1 / 60); } P.keys = {}; out.parapetJump = [+P.body.z.toFixed(2), +P.body.y.toFixed(2)];
    // 7. quay edge on the harbour
    face(-25, 52, -25, 80); P.keys = { KeyW: true, ShiftLeft: true }; for (let i = 0; i < 240; i++) { if (i % 20 === 0) P.jumpQueued = true; P.update(1 / 60); } P.keys = {}; out.quay = [+P.body.z.toFixed(2), +P.body.y.toFixed(2)];
    // 8. pier 3 walkable
    face(-42, 55, -42, 85); P.keys = { KeyW: true }; for (let i = 0; i < 480; i++) P.update(1 / 60); P.keys = {}; out.pier3 = [+P.body.z.toFixed(2), +P.body.y.toFixed(2)];
    return out;
  });
  console.log(JSON.stringify(res, null, 1)); await b.close(); await srv.close();
})();
