// sim:hash — детерминизм: seed + вмешательства → один хэш на каждый тик; 20 сидов.
import { createWorld, step } from '../src/sim/world';
import { Session } from '../src/sim/session';
import * as P from '../src/sim/plans';
import { hashState, hrand } from '../src/sim/rng';
import { Iv } from '../src/sim/core';
import { T1 } from '../src/sim/map';

let fails = 0;
const hashes = new Set<string>();
for (let seed = 1; seed <= 20; seed++) {
  // сценарий: вмешательства из сидированного хэша (не Math.random)
  const ivs: Iv[] = [];
  for (let i = 0; i < 40; i++) {
    const t = Math.floor(hrand(seed, 'iv', i) * 2300 / 0.5) * 0.5;
    const k = Math.floor(hrand(seed, 'k', i) * 3);
    if (k === 0) ivs.push({ t, k: 'move', x: Math.round((hrand(seed, 'x', i) - 0.5) * 120), z: Math.round((hrand(seed, 'z', i) - 0.5) * 60), st: i % 3 });
    else if (k === 1) ivs.push({ t, k: 'take', item: ['pass', 'key', 'keyring'][i % 3] });
    else ivs.push({ t, k: 'use', obj: 'ks1_door', arg: 'unlock' });
  }
  ivs.sort((a, b) => a.t - b.t);
  const run = () => {
    const w = createWorld(seed, { sealed: false }); const hs: string[] = []; let i = 0;
    while (w.t < T1) { const b: Iv[] = []; while (i < ivs.length && ivs[i].t <= w.t + 1e-9) b.push(ivs[i++]); step(w, b); if (w.tick % 8 === 0) hs.push(hashState(w)); }
    return hs;
  };
  const a = run(), b = run();
  const same = a.length === b.length && a.every((h, i) => h === b[i]);
  hashes.add(a[a.length - 1]);
  if (!same) { fails++; console.log('FAIL seed', seed, 'расхождение хэшей'); }
}
// запись → воспроизведение: вмешательства Session, проигранные заново, дают тот же хэш мира
for (const seed of [1, 7, 13]) {
  const S = new Session(seed, { sealed: false });
  S.gotoObj('bench'); S.take('pass'); S.waitUntil(370); S.gotoNpc('tilda'); S.give('tilda'); S.gotoObj('kiosk'); S.inspect('kiosk'); S.advanceTo(T1);
  const rec = S.ivs; const w = createWorld(seed, { sealed: false }); let i = 0;
  while (w.t < T1 - 1e-9) { const b: Iv[] = []; while (i < rec.length && rec[i].t <= w.t + 1e-9) b.push(rec[i++]); step(w, b); }
  if (hashState(w) !== hashState(S.w)) { fails++; console.log('FAIL replay', seed); }
}
// чувствительность: разные сиды дают разные хэши
if (hashes.size < 15) { fails++; console.log('FAIL: хэши разных сидов слишком похожи', hashes.size); }
console.log(fails ? `sim:hash — ${fails} провалов` : `sim:hash — зелёный (20 сидов × 2 прогона, хэш каждые 4 с; уникальных итоговых хэшей: ${hashes.size})`);
process.exit(fails ? 1 : 0);
