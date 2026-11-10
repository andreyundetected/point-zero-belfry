// prints conversations from src/content as Markdown in the 02_DIALOGUES.md format: npx tsx tools/dump_dialogues.ts > out.md
import * as core from '../src/content/d_core';
import * as pro from '../src/content/d_prologue';
import type { Conv } from '../src/game/dialogue';
const WHO: Record<string, string> = { tik: 'Тик', lidia: 'Лидия', crane: 'Крайн', orven: 'Орвен', tilda: 'Тильда', ned: 'Нед', agata: 'Агата', foma: 'Фома', ignat: 'Игнат' };
const dump = (c: Conv) => {
  const out: string[] = [`#### \`${c.id}\``, ''];
  const st = typeof c.start === 'string' ? c.start : `по состоянию: ${c.start.toString().replace(/\s+/g, ' ').replace(/^c\s*=>\s*/, '')}`;
  out.push(`_Начало: ${st}_`, '');
  for (const [k, n] of Object.entries(c.nodes)) {
    const body: string[] = [];
    for (const l of n.say ?? []) body.push(l.act || l.who === '' ? `*${l.ru}*` : `**${WHO[l.who] ?? l.who}:** ${l.ru}${l.if ? ' `[условие]`' : ''}`);
    (n.choices ?? []).forEach((ch, i) => { const tags = [ch.know ? `[знает ${ch.know}] ⟲ ${ch.kt ?? ''}`.trim() : '', ch.once ? `[тема «${ch.once}», один раз]` : '', ch.sys ? '[кнопка]' : '', ch.if ? '[условие]' : ''].filter(Boolean).join(' ');
      body.push(`${i + 1}. ${ch.sys || /^\(.*\)$/.test(ch.ru) ? ch.ru : '«' + ch.ru + '»'}${tags ? ' ' + tags : ''}${ch.next ? ` → ${ch.next}` : ''}`); });
    if (n.next) body.push(`→ ${n.next}`); if (n.end && !body.length) continue; if (n.end) body.push('→ конец');
    if (!body.length) continue; out.push(`\`${k}\``, '', ...body, '');
  }
  if (c.interrupts?.length) out.push(`_Прерывания: ${c.interrupts.map(i => i.node).join(', ')}_`, '');
  return out.join('\n');
};
const all = [...Object.values(pro), ...Object.values(core)].filter((v: any) => v && v.nodes) as Conv[];
for (const c of all) console.log(dump(c));
