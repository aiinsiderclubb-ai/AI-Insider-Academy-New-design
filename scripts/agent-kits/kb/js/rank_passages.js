// Rank Passages: фрагменты из индекса для модели — с кодами документов для ссылок.
const { config, input } = $('Config').first().json;
const items = $input.all().map((i) => i.json).filter((j) => j.document);
const hits = items
  .filter((j) => !j.document.metadata?.tombstone)
  .map((j) => ({ ...j.document.metadata, text: j.document.pageContent, score: Math.round(Number(j.score || 0) * 100) / 100 }))
  .sort((a, b) => b.score - a.score);

if (!items.length || !hits.length) {
  return [{ json: { found: false, passages: [], note: 'Индекс пуст: документы ещё не загружены. Скажи, что база пока пуста, и предложи передать вопрос команде (handoff_to_human).' } }];
}
const good = hits.filter((h) => h.score >= config.min_score).slice(0, config.max_passages);
if (!good.length) {
  return [{ json: {
    found: false,
    passages: [],
    best_score: hits[0].score,
    note: 'В документах нет ответа на этот запрос. Если вопрос можно переформулировать — попробуй поиск ещё раз другими словами. Иначе прямо скажи, что в документах этого нет, и не отвечай по памяти.',
  } }];
}
return [{ json: {
  found: true,
  passages: good.map((h) => ({ cite: `[${h.code}]`, document: h.title, url: h.url || '', text: h.text, score: h.score })),
  note: 'Отвечай только по этим фрагментам. После каждого утверждения ставь ссылку на документ, например [d3]. Ссылки и адреса документов сам не пиши — список источников добавит система. Если фрагменты отвечают не полностью — скажи, чего в документах нет.',
} }];
