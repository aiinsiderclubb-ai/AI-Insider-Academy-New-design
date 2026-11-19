// Plan Sources: список документов для индекса — файлы папки Drive и ссылки из листа Sources.
// @include text.js
const { config } = $('Config').first().json;
const drive = $('List Drive Files').first().json;
const sourcesSheet = $('Read Sources').first().json;

const TYPES = {
  'application/vnd.google-apps.document': 'gdoc',
  'application/pdf': 'pdf',
  'text/plain': 'text',
  'text/markdown': 'text',
  'text/x-markdown': 'text',
  'text/html': 'html',
};

if (drive.error) {
  return [{ json: { abort: true, reason: `Не удалось прочитать папку Google Drive: ${String(drive.error.message || drive.error).slice(0, 300)}` } }];
}

const plan = [];
const skipped = [];
for (const f of drive.files || []) {
  const fetch = TYPES[f.mimeType] || (/\.(md|txt)$/i.test(f.name) ? 'text' : null);
  if (!fetch) {
    skipped.push({ title: f.name, reason: `формат ${f.mimeType} не поддерживается` });
    continue;
  }
  plan.push({
    tool: 'extract_document',
    source_kind: 'drive',
    source_id: 'drive:' + f.id,
    drive_id: f.id,
    title: f.name.replace(/\.(pdf|md|txt)$/i, ''),
    url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    mime: f.mimeType,
    modified: f.modifiedTime || '',
    fetch,
  });
}

const yes = (v) => !/^(нет|no|false|0|off|выкл)$/i.test(String(v || '').trim());
const sourceRows = sourcesSheet.error ? [] : sheetRows(sourcesSheet.values).filter((r) => r.url);
for (const r of sourceRows) {
  if (!yes(r.enabled)) continue;
  if (!/^https?:\/\//i.test(r.url)) {
    skipped.push({ title: r.url, reason: 'ссылка должна начинаться с http:// или https://' });
    continue;
  }
  plan.push({
    tool: 'extract_document',
    source_kind: 'url',
    source_id: 'url:' + r.url,
    drive_id: '',
    title: r.title || r.url.replace(/^https?:\/\//, ''),
    url: r.url,
    mime: 'text/html',
    modified: '',
    fetch: 'url',
  });
}

plan.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
const warnings = sourcesSheet.error ? ['Лист Sources не прочитан — ссылки не проиндексированы'] : [];
if (!plan.length) {
  // Пустой индекс — тоже результат: старые фрагменты удалятся.
  return [{ json: { empty: true, skipped, warnings } }];
}
return plan.map((p, i) => ({ json: { ...p, plan_index: i, skipped: i === 0 ? skipped : [], warnings: i === 0 ? warnings : [] } }));
