// Registry: лист Documents после переиндексации — какие документы в индексе.
// Колонки: code | title | url | source_id | modified | chunks | chars | status | indexed_at
const built = $('Build Docs').all().map((i) => i.json);
const summary = built[0].summary;
const chunks = {};
for (const item of $input.all()) {
  const code = item.json.metadata?.code ?? item.json.document?.metadata?.code;
  if (code) chunks[code] = (chunks[code] || 0) + 1;
}
const now = new Date().toISOString();
const rows = [['code', 'title', 'url', 'source_id', 'modified', 'chunks', 'chars', 'status', 'indexed_at']];
for (const d of built.filter((b) => !b.tombstone)) {
  rows.push([d.code, d.title, d.url, d.source_id, d.modified, String(chunks[d.code] || 0), String(d.chars || 0), d.truncated ? 'обрезан' : 'ok', now]);
}
for (const f of summary.failed) rows.push(['', f.title, f.url || '', '', '', '0', '0', 'ошибка: ' + f.reason, now]);
for (const s of summary.skipped) rows.push(['', s.title, '', '', '', '0', '0', 'пропущен: ' + s.reason, now]);

// Старые строки ниже новых затираются пустыми.
const old = ($('Read Registry').first().json.values || []).length;
while (rows.length < old) rows.push(['', '', '', '', '', '', '', '', '']);
const total = Object.values(chunks).reduce((a, b) => a + b, 0);
return [{ json: { rows, total_chunks: built[0].tombstone ? 0 : total, summary } }];
