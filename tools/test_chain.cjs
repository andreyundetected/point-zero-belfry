// integration: plays the main chain of the story through the real game objects (dialogues, items, flags, jumps, pilot, ending)
const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5190, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); if (m.text().startsWith('STEP')) console.log(m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('okno.lang', 'ru'); } catch (e) {} }); await p.goto('http://127.0.0.1:5190/?noprologue=1&gun=1'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const res = await p.evaluate(async () => {
    const g = window.game, P = window.player, out = [], k = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c }));
    const mm = (m, s = 0) => m * 60 + s; const tick = (n = 5) => { for (let i = 0; i < n; i++) g.update(1 / 60); };
    const play = async (conv, picks = [], npc) => { console.log('STEP play ' + conv + ' active=' + g.runner.active + ' cur=' + g.runner.cur); g.runner.start(conv, npc); let n = 0, pi = 0; while (g.runner.active && n++ < 800) { await new Promise(r => setTimeout(r, 12)); const opts = [...document.querySelectorAll('#dlg .opt')], sys = [...document.querySelectorAll('#dlg .sys')]; if (opts.length || sys.length) { const want = picks[pi++]; if (want !== undefined && sys.some(o => o.textContent.includes(want))) { k('Escape'); } else { let idx = 0; if (want !== undefined) { const f = opts.findIndex(o => o.textContent.includes(want)); idx = f >= 0 ? f : 0; } k('Digit' + (idx + 1)); } } else k('Space'); tick(1); } };
    const ok = (name, cond) => { const l = (cond ? 'ok   ' : 'FAIL ') + name; out.push(l); console.log('STEP ' + l); };
    const reset = (t) => { g.s.flags = new (g.s.flags.constructor)(); g.s.changes = []; g.sim.setFlags(g.s.flags); g.s.t = t; g.s.worldItems.clear(); tick(); };
    // 1. Orven at the door 22:09:30
    reset(mm(1, 50)); await play('orven', ['Я от Крайн', 'Чьи ключи', 'Как он выглядит', 'Хватит', 'Передам'], 'orven'); ok('Orven: thread -> ned, knowledge', g.s.thread === 'ned' && g.s.knows('know_ned') && g.s.knows('know_ned_desc'));
    { reset(mm(2, 30)); const before = g.s.talks.get('orven') ?? 0; await play('orven', [], 'orven'); ok('Orven remembers: second talk is short', (g.s.talks.get('orven') ?? 0) === before + 1 && !g.s.journal.some(j => j.id === 'x')); }
    // 1b. gating: a player who skipped Orven cannot ask Ned about the key or his name
    { const saved = [...g.s.know]; g.s.know = new Set(['name_agnia']); reset(mm(12, 30)); g.runner.start('ned', 'ned'); await new Promise(r => setTimeout(r, 300)); k('KeyE'); await new Promise(r => setTimeout(r, 300)); k('KeyE'); await new Promise(r => setTimeout(r, 300)); const texts = [...document.querySelectorAll('#dlg .opt')].map(o => o.textContent); ok('Ned without Orven: no "Ты Нед?" option', !texts.some(t => t.includes('Ты Нед')) && texts.length >= 2); for (let i = 0; i < 40 && g.runner.active; i++) { k('Escape'); await new Promise(r => setTimeout(r, 40)); } g.s.know = new Set(saved); }
    // 2. Ned on the bridge, saved with the blast argument
    reset(mm(12, 30)); g.s.talks.clear(); await play('ned', ['Ты Нед', 'Мне сказали, у тебя ключ', 'Дальше', 'Склад сгорел'], 'ned'); ok('Ned: saved by the pressure argument', g.s.flags.has('nedSaved') && g.s.thread === 'gun'); out.push('  (ned debug: ' + JSON.stringify({ flags: g.s.flags.entries(), thread: g.s.thread, t: g.s.t }) + ')');
    // 3. steal the token while everybody watches the row (22:04:30)
    reset(mm(3, 20)); const tb = { x: 24.3, z: 9.2 }; P.place(tb.x - 1.2, tb.z, tb.x, tb.z, 0, g.npcs.pose('ned') ? 0.1 : 0.1); tick(3); const it = window.__items = null;
    const inter = (await import('/src/world/interiors.ts')).interactables.find(i => i.id === 'tav.jeton'); inter.use(g); ok('Token stolen at 22:04:30: pocket + flag', g.s.pocket === 'jeton' && g.s.flags.has('jetonStolen'));
    // 4. default branch: wounded Gayl, ring, thread anna
    reset(mm(14, 30)); await play('gayl.wounded'); ok('Gayl: ring in the pocket, thread anna', g.s.pocket === 'ring' && g.s.thread === 'anna');
    // 5. Anna with the ring; warned -> flags
    reset(mm(25)); g.s.pocket = 'ring'; await play('anna', ['Протянуть кольцо', 'Выведи']); ok('Anna: warned, ring handed over', g.s.flags.has('annaWarned') && g.s.pocket !== 'ring');
    // 6. Anka's ribbon, Tilda intercepted
    reset(mm(31)); g.s.learn('name_tilda'); await play('anka', ['Знаком', 'Заберёт']); ok('Anka: ribbon in the pocket', g.s.pocket === 'ribbon');
    reset(mm(22, 30)); await play('tilda.pier', ['Протянуть ленту', 'Я там вырос']); ok('Tilda: warned with the ribbon', g.s.flags.has('tildaWarned') && g.s.pocket !== 'ribbon');
    // 7. Tikhon: talk him round
    reset(mm(25)); g.s.learn('saw_yan_killed'); g.s.learn('know_helmsmen'); g.s.pocket = 'helmsmen'; await play('tikhon.door', ['Я от Гейла', 'В списке', 'Не ходи сегодня', 'Никто']); ok('Tikhon: cap in the pocket, stays home', g.s.pocket === 'cap' && g.s.flags.has('tikhonTurned') && g.s.thread === 'pier3');
    // 8. pier 3 guard, then the helm
    reset(mm(36)); g.s.pocket = 'cap'; await play('guard.pier3', ['Я.']); ok('Guard: helm ok', g.s.knows('helm_ok'));
    g.pilot.board(); await new Promise(r => setTimeout(r, 300)); tick(10); ok('Pilot: aboard', g.pilot.aboard);
    g.s.t = mm(45, 25); for (let i = 0; i < 90; i++) { await new Promise(r => setTimeout(r, 40)); tick(2); if (g.pilot.harrow) break; }
    g.s.t = mm(46, 1); for (let i = 0; i < 40 && !g.runner.active; i++) { await new Promise(r => setTimeout(r, 50)); tick(2); } ok('Finale starts at 22:46 and jumps are blocked', g.runner.active && g.s.knows('sync_held'));
    await play('finale', ['Сядь', 'Ты знаешь', 'Почему не в полицию', 'Промолчать', 'Не верю', 'Промолчать']); await new Promise(r => setTimeout(r, 1500)); ok('Ending: "Отложен"', g.s.ended === 'otlozhen');
    out.push('facts: ' + g.facts().join(' | ')); const before = g.s.jumps; await g.doJump(100); ok('no jump after the lock', g.s.jumps === before);
    return out; });
  console.log(res.join('\n')); console.log('errors', errs); await b.close(); await srv.close();
})();
