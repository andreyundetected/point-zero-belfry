// plays the prologue headlessly: dialogue -> time jump -> second dialogue -> thread "orven"
const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5193, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('okno.lang', 'ru'); } catch (e) {} }); await p.goto('http://127.0.0.1:5193/?noprologue=1'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const res = await p.evaluate(async () => {
    const g = window.game, k = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })); const log = [];
    const play = async (id) => { g.runner.start(id); let n = 0; while (g.runner.active && n++ < 400) { await new Promise(r => setTimeout(r, 30)); if (document.querySelector('#dlg .opt')) { const opts = document.querySelectorAll('#dlg .opt'); const last = opts.length; k('Digit' + (log.length % 3 === 0 ? 1 : Math.min(last, 1))); } else k('KeyE'); for (let i = 0; i < 5; i++) g.update(1 / 60); } };
    await play('prologue'); await new Promise(r => setTimeout(r, 2500)); const afterJump = { t: g.s.t, jumps: g.s.jumps };
    await play('prologue2'); return { afterJump, thread: g.s.thread, done: g.s.knows('prologue_done'), t: g.s.t, jumps: g.s.jumps, journal: g.s.journal.length };
  });
  console.log(JSON.stringify(res)); console.log('errors', errs); await b.close(); await srv.close();
})();
