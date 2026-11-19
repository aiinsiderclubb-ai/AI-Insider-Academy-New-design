// List Docs: какие документы есть в индексе — для вопросов «что ты знаешь?».
// @include text.js
const res = $input.first().json;
if (res.error) {
  return [{ json: { ok: false, service_error: String(res.error.message || res.error).slice(0, 300), note: 'Список документов недоступен. Скажи об этом и предложи задать вопрос по существу.' } }];
}
const docs = sheetRows(res.values).filter((r) => r.code && r.status !== '' && !/^(ошибка|пропущен)/.test(r.status));
return [{ json: {
  ok: true,
  count: docs.length,
  documents: docs.slice(0, 100).map((d) => ({ cite: `[${d.code}]`, title: d.title, url: d.url, modified: d.modified })),
  note: docs.length > 100 ? `Показаны первые 100 из ${docs.length}.` : 'Это полный список документов в базе.',
} }];
