// static check of every dialogue graph: targets exist, nothing unreachable, no dead ends, pressure choices carry a time
import { Conv } from '../src/game/dialogue';
import { prologue, prologue2 } from '../src/content/d_prologue';
import * as W from '../src/content/d_west';
import * as T from '../src/content/d_tavern';
import * as E from '../src/content/d_east';
import * as P from '../src/content/d_pier';
import { finale } from '../src/content/d_finale';
import * as C from '../src/content/d_core';
const all: Conv[] = [prologue, prologue2, ...Object.values(W), ...Object.values(T), ...Object.values(E), ...Object.values(P), ...Object.values(C), finale].filter((c): c is Conv => !!c && typeof (c as Conv).id === 'string');
let bad = 0, lines = 0, choices = 0, pressure = 0;
for (const c of all) {
  // all entry points: every start the NPC's memory can produce (0, 1, 2+ talks) and every interrupt node
  const starts = new Set<string>(); if (typeof c.start === 'string') starts.add(c.start); else for (const n of [0, 1, 2]) for (const e of [0, 1]) for (const fl of [false, true]) { const mock: any = { count: () => n, ever: () => e, fl: () => fl, knows: () => false, has: () => false, t: () => 0, talked: () => false }; try { starts.add((c.start as any)(mock)); } catch { /* */ } }
  for (const it of c.interrupts ?? []) starts.add(it.node);
  const seen = new Set<string>(); const q = [...starts];
  while (q.length) { const id = q.pop()!; if (seen.has(id)) continue; seen.add(id); const n = c.nodes[id]; if (!n) { console.log('MISSING node', c.id, id); bad++; continue; }
    lines += n.say?.length ?? 0; if (n.next) q.push(n.next); for (const ch of n.choices ?? []) { choices++; if (ch.know) { pressure++; if (!ch.kt) { console.log('pressure choice without time', c.id, ch.ru); bad++; } } if (ch.next) q.push(ch.next); }
    if (!n.end && !n.next && !(n.choices?.length)) { console.log('dead end (add end:true)', c.id, id); bad++; } }
  for (const id of Object.keys(c.nodes)) if (!seen.has(id) && !(c.id === 'tikhon.door' && id === 'in')) { console.log('unreachable', c.id, id); bad++; }
}
console.log(`${all.length} conversations, ${lines} lines, ${choices} choices, ${pressure} pressure choices (⟲ + time)`); console.log(bad ? `FAILED: ${bad}` : 'dialogues ok'); process.exit(bad ? 1 : 0);
