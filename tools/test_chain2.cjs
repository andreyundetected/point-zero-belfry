// integration, the other road through the night: token stolen -> no raid -> Gayl opens the safe himself -> Anna warned without the ring;
// Ned left alone (jumps); Tikhon threatened (cap taken by force) -> the pier guards; the finale answered "Верю" -> ending "Утро".
// Plus the fail-safes: death ending offers the save; a wrong-time visit gets a bark, not a crash; the 23:00 banner; jump refused in fire.
const { chromium } = require('playwright'); const { createServer } = require('vite');
(async () => {
  const srv = await createServer({ server: { port: 5186, host: '127.0.0.1' }, logLevel: 'error' }); await srv.listen();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); if (m.text().startsWith('STEP')) console.log(m.text()); });
  await p.addInitScript(() => { try { localStorage.setItem('okno.lang', 'ru'); localStorage.removeItem('okno.save'); } catch (e) {} }); await p.goto('http://127.0.0.1:5186/?noprologue=1&gun=1'); await p.waitForFunction('window.done', null, { timeout: 300000 });
  const res = await p.evaluate(async () => {
    const g = window.game, P = window.player, out = [], k = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c }));
    const mm = (m, s = 0) => m * 60 + s; const tick = (n = 5) => { for (let i = 0; i < n; i++) g.update(1 / 60); };
    const play = async (conv, picks = [], npc) => { g.runner.start(conv, npc); let n = 0, pi = 0; while (g.runner.active && n++ < 800) { await new Promise(r => setTimeout(r, 30)); const opts = [...document.querySelectorAll('#dlg .opt, #dlg .sys')]; if (opts.length) { const want = picks[pi]; let i = want ? opts.findIndex(o => o.textContent.includes(want)) : -1; if (i < 0) i = 0; else pi++; opts[i].click(); } else k('KeyE'); } };
    const ok = (name, cond) => { const l = (cond ? 'ok   ' : 'FAIL ') + name; out.push(l); console.log('STEP ' + l); };
    const reset = (t) => { g.s.flags = new (g.s.flags.constructor)(); g.s.changes = []; g.sim.setFlags(g.s.flags); g.s.t = t; g.s.worldItems.clear(); g.s.talks.clear(); g.s.topics.clear(); g.s.thoughts.clear(); tick(); };
    const inter = async (id) => (await import('/src/world/interiors.ts')).interactables.find(i => i.id === id);
    // 1. token stolen during the row -> Scar cannot buy it -> no raid: Gayl alive in the office at 22:14
    reset(mm(3, 20)); (await inter('tav.jeton')).use(g); ok('token stolen', g.s.pocket === 'jeton' && g.s.flags.has('jetonStolen'));
    g.s.t = mm(14); tick(3); const gq = g.npcs.pose('gayl'); ok('no raid: Gayl is not lying in the yard at 22:14', gq && gq.a !== 'die');
    // 2. Gayl at the window at 22:05 with the token: the door opens
    reset(mm(5)); g.s.pocket = 'jeton'; g.s.flags.put('jetonStolen', 200); g.sim.setFlags(g.s.flags); g.s.learn('know_gayl_wife'); g.s.learn('know_scar_raid'); await play('gayl.window', ['Показать жетон', 'Человек со шрамом'], 'gayl'); ok('Gayl opens the office: token + pressure (the raid he does not yet know about)', g.s.flags.has('officeOpen'));
    // 3. Anna warned by words (no ring), children out: flag
    reset(mm(25)); g.s.pocket = undefined; g.s.learn('know_gayl_wife'); await play('anna', ['Гейл просил передать', 'Выведи']); ok('Anna warned without the ring', g.s.flags.has('annaWarned'));
    // 4. Ned left alone: at 22:15 he is gone (jumped)
    reset(mm(12)); g.s.t = mm(15); tick(3); ok('Ned not kept: gone by 22:15', g.npcs.pose('ned').hidden);
    // 5. Tikhon threatened at gunpoint: cap handed over, flag threatened; the pier guards then catch the lie unless he is locked in
    reset(mm(25)); g.s.learn('know_helmsmen'); g.s.pocket = 'helmsmen'; await play('tikhon.door', ['Я от Гейла', 'Поднять револьвер', 'Кепку. Ключ. Молча']); ok('Tikhon threatened: cap in pocket, flag', g.s.pocket === 'cap' && g.s.flags.has('tikhonThreatened'));
    // 6. wrong-time visits never crash: Foma's door at 22:45, Orven at 22:30, Lukyan at 22:50
    reset(mm(45)); const { pickConv, doorTalk } = await import('/src/content/index.ts'); const a1 = doorTalk('foma.door', g), a2 = pickConv('orven', g), a3 = pickConv('lukyan', g); ok('wrong-time visits give null or a bark (' + [a1, a2, a3].join(' | ') + ')', [a1, a2, a3].every(x => x === null || typeof x === 'string'));
    // 7. jump refused into a burning house: stand in Foma's shop spot at 22:55 (ruins), jump to 22:35 (flames)
    reset(mm(55)); P.place(-40, -17, -40, -20, 0, 0.4); tick(5); const j0 = g.s.jumps; await g.doJump(mm(35)); await new Promise(r => setTimeout(r, 1500)); ok('jump into flames refused', g.s.jumps === j0 && Math.abs(g.s.t - mm(55)) < 60);
    // 8. 23:00: the Stvorka opens itself with the banner; Stay -> 'empty' ending offers the save
    reset(mm(59, 58)); g.s.learn('prologue_done'); g.autosave(true); for (let i = 0; i < 400 && !g.open; i++) { tick(2); await new Promise(r => setTimeout(r, 5)); } ok('23:00 opens the Stvorka', g.open && g.stv.tab === 'time');
    g.stay(); await new Promise(r => setTimeout(r, 1600)); ok('empty hour ending with a way back to the save', g.s.ended === 'empty' && !!document.getElementById('end-load'));
    return out; });
  console.log(res.join('\n')); console.log('errors', JSON.stringify(errs.slice(0, 5))); await b.close(); await srv.close(); process.exit(res.some(l => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
