// Reindex Report: итог переиндексации для чата команды.
// @include text.js
const built = $('Build Docs').first().json;
let lines;
if (built.abort) {
  lines = [`<b>⚠️ Переиндексация остановлена</b>`, escapeHtml(built.reason), 'Индекс не изменён — агент отвечает по прежним документам.'];
  for (const f of (built.failed || []).slice(0, 10)) lines.push(`• ${escapeHtml(f.title)}: ${escapeHtml(f.reason)}`);
} else {
  const r = $('Registry').first().json;
  const s = r.summary;
  lines = [`<b>📚 Индекс обновлён</b>`, `Документов: ${s.docs} · фрагментов: ${r.total_chunks}`];
  if (s.failed.length) {
    lines.push('', `<b>Не прочитаны (${s.failed.length}):</b>`);
    for (const f of s.failed.slice(0, 15)) lines.push(`• ${escapeHtml(f.title)}: ${escapeHtml(f.reason)}`);
  }
  if (s.skipped.length) {
    lines.push('', `<b>Пропущены (${s.skipped.length}):</b>`);
    for (const f of s.skipped.slice(0, 15)) lines.push(`• ${escapeHtml(f.title)}: ${escapeHtml(f.reason)}`);
  }
  for (const w of s.warnings) lines.push('', `⚠️ ${escapeHtml(w)}`);
}
return [{ json: { text: lines.join('\n'), ok: !built.abort } }];
