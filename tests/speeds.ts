// E2: walking NPCs move at 1.0-1.5 m/s (wagon escort may crawl), running only up to 4 m/s
import { Flags } from '../src/sim/flags';
import { NPCS } from '../src/sim/npcs';
let bad = 0;
for (const d of NPCS) { const k = d.sched(new Flags()); for (let i = 0; i < k.length - 1; i++) { const a = k[i], b = k[i + 1]; if (!a.go || a.hide) continue; const v = Math.hypot(b.x - a.x, b.z - a.z) / Math.max(1e-3, b.t - a.t); if (v < 0.05 || a.a === 'push' || a.a === 'die') continue;
  const ok = a.a === 'run' ? v <= 4.01 : a.a === 'walk' ? v <= 1.55 && (v >= 0.85 || d.role === 'guard') : true; if (!ok) { bad++; if (bad < 15) console.log('speed', d.id, a.a, v.toFixed(2)); } } }
console.log(bad ? `speeds FAILED (${bad})` : 'speeds ok'); process.exit(bad ? 1 : 0);
