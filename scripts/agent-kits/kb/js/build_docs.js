// Build Docs: собирает тексты для индекса, присваивает документам коды d1, d2…
// и решает, можно ли перестраивать индекс.
const planned = $('Plan Sources').all().map((i) => i.json);
if (planned[0]?.abort) return [{ json: { abort: true, reason: planned[0].reason } }];

const results = $input.all().map((i) => i.json);
const docs = [];
const failed = [];
const skipped = planned[0]?.skipped || [];
const warnings = planned[0]?.warnings || [];

if (!planned[0]?.empty) {
  planned.forEach((p, i) => {
    const r = results[i] || {};
    if (r.ok) docs.push({ ...r, source_id: p.source_id, title: r.title || p.title, url: p.url, modified: p.modified });
    else failed.push({ title: p.title, url: p.url, reason: r.error || 'не удалось прочитать' });
  });
  if (!docs.length) {
    return [{ json: { abort: true, reason: `Ни один из ${planned.length} документов не прочитан — старый индекс оставлен как есть.`, failed } }];
  }
}

const summary = { docs: docs.length, failed, skipped, warnings };
if (!docs.length) {
  // Источников нет: индекс очищается, в нём остаётся одна пустая запись-заглушка.
  return [{ json: { abort: false, code: 'd0', tombstone: '1', source_id: '', title: '', url: '', modified: '', text: 'пустой индекс', summary } }];
}
return docs.map((d, i) => ({ json: { abort: false, code: 'd' + (i + 1), tombstone: '', ...d, summary: i === 0 ? summary : undefined } }));
