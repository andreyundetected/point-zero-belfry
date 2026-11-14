// npm run check (F4): world sanity in the real build — NPCs/props vs walls, floating items, doors in the facade openings, walkable reference route
const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5181, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 320, height: 200 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:5181/?noprologue=1&at=0,30,0,0'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const r = await p.evaluate(async () => {
    const { world } = await import('/src/world/colliders.ts'); const { NPCS } = await import('/src/sim/npcs.ts'); const { allFields, loadModel } = await import('/src/world/props.ts');
    const { doors } = await import('/src/world/interiors.ts'); const phys = await import('/src/game/physics.ts'); const nav = await import('/src/sim/nav.ts'); const { groundH } = await import('/src/world/terrain.ts');
    const g = window.game; const out = { npcInWalls: [], floating: [], propsInWalls: [], doors: [], route: [] };
    const WALL = new Set(['building', 'cellar']);
    const hit = (x, z, y0, y1, r, kinds) => { for (const bx of world.near(x, z)) { if (bx.off || !kinds.has(bx.kind) || y1 <= bx.y0 || y0 >= bx.y1) continue; const dx = x - bx.cx, dz = z - bx.cz, lx = dx * bx.cos - dz * bx.sin, lz = dx * bx.sin + dz * bx.cos; const nx = Math.max(-bx.hx, Math.min(bx.hx, lx)), nz = Math.max(-bx.hz, Math.min(bx.hz, lz)); if ((lx - nx) ** 2 + (lz - nz) ** 2 < r * r) return bx; } return null; };
    // 1. NPCs never inside walls over the whole hour, walking or not, in every main branch; standing ones also not inside furniture
    const { Flags } = await import('/src/sim/flags.ts'); const { SimWorld } = await import('/src/sim/world.ts');
    const SCEN = { base: [], saved: [['nedKept', 700], ['talk_ned', 690]], early: [['nedLeftEarly', 200], ['jetonStolen', 190]], tilda: [['tildaWarned', 1330], ['annaWarned', 1300]], tap: [['tapCut', 40], ['tikhonTurned', 1500], ['wagonPinPulled', 1500]], warned: [['gaylWarned', 330], ['fomaWarned', 1300], ['talk_orven', 100], ['talk_foma', 1200], ['prologueOver', 200]], brawl: [['ignatDead', 760], ['lovchiyDead', 765], ['scarAlert', 250], ['tikhonDead', 1600]] };
    for (const [sn, fl] of Object.entries(SCEN)) { const F = new Flags(); for (const [k, t] of fl) F.put(k, t); const sim = new SimWorld(F);
      for (const d of NPCS) for (let t = 0; t <= 3600; t += 5) { const q = sim.pose(d.id, t); if (q.hidden || q.y < -4) continue; const sit = /sit|cry|die|kneel/.test(q.a);
        const w = hit(q.x, q.z, q.y + 0.5, q.y + 1.5, q.walking ? 0.12 : 0.2, WALL); if (w) { out.npcInWalls.push([sn, d.id, t, +q.x.toFixed(1), +q.z.toFixed(1), q.a, w.kind]); break; }
        if (!sit && !q.walking) { const f = hit(q.x, q.z, q.y + 0.3, q.y + 1.2, 0.18, new Set(['furn'])); if (f) { out.npcInWalls.push([sn, d.id, t, +q.x.toFixed(1), +q.z.toFixed(1), q.a, 'furn']); break; } } } }
    for (const d of []) for (let t = 0; t <= 3600; t += 30) { const q = g.sim.pose(d.id, t); if (q.hidden || q.walking || q.y < -4) continue; const sit = /sit|cry|die|kneel/.test(q.a); const w = hit(q.x, q.z, q.y + 0.3, q.y + 1.6, 0.2, WALL); if (w) { out.npcInWalls.push([d.id, t, +q.x.toFixed(1), +q.z.toFixed(1), w.kind]); break; }
      if (!sit) { const f = hit(q.x, q.z, q.y + 0.3, q.y + 1.2, 0.18, new Set(['furn'])); if (f) { out.npcInWalls.push([d.id, t, +q.x.toFixed(1), +q.z.toFixed(1), 'furn']); break; } } }
    // 2. props: explicit y must rest on a support (ground, floor box, shelf board) within 2 cm; nothing solid stands inside a building
    for (const pf of allFields) for (const it of pf.inst) { const y = it.o.y; let sup = groundH(it.x, it.z); for (const bx of world.near(it.x, it.z)) { if (bx.off || bx.y1 > (y ?? sup) + 0.03) continue; const dx = it.x - bx.cx, dz = it.z - bx.cz, lx = dx * bx.cos - dz * bx.sin, lz = dx * bx.sin + dz * bx.cos; if (Math.abs(lx) <= bx.hx && Math.abs(lz) <= bx.hz) sup = Math.max(sup, bx.y1); }
      if (y !== undefined && y - sup > 0.02 && !/bell|light_ceiling|dungeon\/key|boats\//.test(it.path)) out.floating.push([it.path, +it.x.toFixed(2), +it.z.toFixed(2), +(y - sup).toFixed(2)]);
      if (it.o.collide && hit(it.x, it.z, (y ?? sup) + 0.1, (y ?? sup) + 0.5, 0.05, WALL)) out.propsInWalls.push([it.path, +it.x.toFixed(1), +it.z.toFixed(1)]); }
    for (const bx of world.boxes) if (bx.kind === 'solid' && hit(bx.cx, bx.cz, bx.y0 + 0.2, bx.y1 - 0.1, 0.05, WALL)) out.propsInWalls.push(['solid', +bx.cx.toFixed(1), +bx.cz.toFixed(1)]);
    // 3. doors: closed = blocked, open = walk straight through; a step 1.1 m to the side of the opening is a wall
    for (const d of doors) { const nx = Math.sin(d.hingeRy), nz = Math.cos(d.hingeRy), tx = Math.cos(d.hingeRy), tz = -Math.sin(d.hingeRy);
      const tryWalk = (ox) => { const body = phys.newBody(d.x + nx * 1.4 + tx * ox, d.z + nz * 1.4 + tz * ox); body.y = d.y + 0.05; for (let i = 0; i < 90; i++) phys.stepBody(body, -nx, -nz, false, false, 1 / 30); const along = (body.x - d.x) * nx + (body.z - d.z) * nz; return along < -0.6; };
      d.box.off = true; const through = tryWalk(0), side = tryWalk(d.box.hx + 0.65) && tryWalk(-(d.box.hx + 0.65)); d.box.off = false; const closed = tryWalk(0);
      if (!through || side || closed) out.doors.push([d.id, { through, side, closed }]); }
    // 4. the reference route is walkable for a 0.3 m capsule (nav grid, no straight-line fallback)
    const PTS = [['tower foot', -70, -51.5], ['Orven door', -47.25, -32.2], ['bridge west', -10, 1.5], ['Ned rail', 0.6, 1.3], ['bridge east', 10, 1.5], ['Anchor door', 18.8, 9.3], ['Foma door', -40, -12.8], ['tower foot', -70, -51.5]];
    for (let i = 0; i < PTS.length - 1; i++) { const [an, ax, az] = PTS[i], [bn, bx, bz] = PTS[i + 1]; const w = nav.route(ax, az, bx, bz); let ok = true, px = ax, pz = az; for (const [x, z] of w) { if (!nav.clear(px, pz, x, z)) { ok = false; break; } px = x; pz = z; } if (!ok) out.route.push(`${an} -> ${bn}`); }
    return out; });
  const bad = r.npcInWalls.length + r.floating.length + r.propsInWalls.length + r.doors.length + r.route.length + errs.length;
  for (const [k, v] of Object.entries(r)) console.log(k.padEnd(13), v.length ? JSON.stringify(v.slice(0, 12)) : 'ok');
  if (errs.length) console.log('page errors', errs);
  console.log(bad ? `check FAILED (${bad})` : 'check ok'); await b.close(); await srv.close(); process.exit(bad ? 1 : 0);
})();
