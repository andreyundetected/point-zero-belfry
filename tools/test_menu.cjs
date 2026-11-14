// menu flow: title -> new game -> prologue starts; pause via Esc; save/continue restores time, place and knowledge
const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5187, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 800, height: 500 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('okno.lang', 'ru'); if (location.search.includes('fresh=1')) localStorage.removeItem('okno.save'); } catch (e) {} });
  await p.goto('http://127.0.0.1:5187/?fresh=1'); await p.waitForFunction('window.done', null, { timeout: 300000 }); await p.waitForTimeout(1500);
  const out = [];
  const ok = (n, c) => out.push((c ? 'ok   ' : 'FAIL ') + n);
  ok('title shown', await p.evaluate(() => window.game.menu.screen === 'title' && window.game.menu.onTitle));
  ok('hands hidden on title', await p.evaluate(() => !window.player.cam.children.some(c => c.visible && c.children.length > 3)));
  await p.evaluate(() => window.game.menu.act('new')); await p.waitForTimeout(2500);
  ok('new game: prologue running, hands back', await p.evaluate(() => window.game.runner.active && window.game.runner.cur === 'prologue' && window.player.body.y > 20));
  // finish the prologue quickly via the runner (press keys), then test save
  await p.evaluate(async () => { const g = window.game; const k = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })); let n = 0; while (g.runner.active && n++ < 400) { await new Promise(r => setTimeout(r, 60)); k('Digit1'); k('KeyE'); } });
  await p.waitForTimeout(600);
  // still in prologue2 after the lesson jump? keep pressing
  await p.evaluate(async () => { const g = window.game; const k = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })); let n = 0; while (!g.s.knows('prologue_done') && n++ < 900) { await new Promise(r => setTimeout(r, 60)); if (g.runner.active) { k('Digit1'); k('KeyE'); } } });
  const st = await p.evaluate(() => ({ done: window.game.s.knows('prologue_done'), t: window.game.s.t, thread: window.game.s.thread }));
  ok('prologue finished through the menu flow (' + JSON.stringify(st) + ')', st.done);
  await p.evaluate(() => { window.game.learn('know_ned'); window.game.s.pocket = 'key'; window.player.body.x = -40; window.player.body.z = -30; window.game.s.t = 1000; });
  ok('autosave works after prologue', await p.evaluate(() => window.game.autosave(true)));
  await p.evaluate(() => { window.game.hadLock = true; window.game.menu.pause(); }); await p.waitForTimeout(200);
  ok('pause opens, game paused', await p.evaluate(() => window.game.menu.screen === 'pause' && window.game.paused));
  await p.evaluate(() => window.game.menu.resume()); await p.waitForTimeout(200);
  ok('resume', await p.evaluate(() => !window.game.menu.open && !window.game.paused));
  ok('save stored in localStorage', await p.evaluate(() => !!localStorage.getItem('okno.save')));
  // reload and continue (keep the save this time)
  await p.goto('http://127.0.0.1:5187/'); await p.waitForFunction('window.done', null, { timeout: 300000 }); await p.waitForTimeout(1500);
  ok('continue offered', await p.evaluate(() => !!document.querySelector('[data-act=continue]')));
  await p.evaluate(() => window.game.menu.act('continue')); await p.waitForTimeout(800);
  const ld = await p.evaluate(() => ({ t: window.game.s.t, x: window.player.body.x, z: window.player.body.z, know: window.game.s.knows('know_ned'), pocket: window.game.s.pocket, running: !window.game.frozen && !window.game.menu.open }));
  ok('loaded: time, place, knowledge, pocket, running ' + JSON.stringify(ld), Math.abs(ld.t - 1000) < 30 && Math.abs(ld.x + 40) < 0.5 && ld.know && ld.pocket === 'key' && ld.running);
  console.log(out.join('\n')); console.log('errors', JSON.stringify(errs.slice(0, 5))); await b.close(); await srv.close(); process.exit(out.some(l => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
