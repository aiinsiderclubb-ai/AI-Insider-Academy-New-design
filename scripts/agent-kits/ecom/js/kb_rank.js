// Rank Policies: ищет в листе Policies правила магазина под запрос модели.
// Колонки: id | question | answer | tags | updated. Поиск по словам с учётом окончаний,
// без векторной базы: для FAQ до нескольких сотен статей этого достаточно.
// @include text.js
const { config, input } = $('Config').first().json;
const failed = $input.first().json.error;
if (failed) {
  return [{ json: { found: false, service_error: String(failed.message || failed).slice(0, 300), note: 'Сейчас база недоступна. Извинись и предложи передать вопрос менеджеру (handoff_to_human). Не отвечай по памяти.' } }];
}
const rows = sheetRows($input.first().json.values).filter((r) => r.answer);
const query = terms(input.query || '');

if (!rows.length) {
  return [{ json: { found: false, articles: [], note: 'Правила магазина не найдены: лист Policies пуст. Не отвечай по памяти — предложи передать вопрос менеджеру (handoff_to_human).' } }];
}
if (!query.length) {
  return [{ json: { found: false, articles: [], note: 'Пустой запрос. Переформулируй вопрос клиента ключевыми словами и вызови поиск ещё раз.' } }];
}

const docs = rows.map((r) => ({ r, head: terms(`${r.question} ${r.tags}`), body: terms(r.answer) }));
const df = {};
for (const d of docs) for (const t of new Set([...d.head, ...d.body])) df[t] = (df[t] || 0) + 1;
const idf = (t) => Math.log(1 + docs.length / (df[t] || 0.5));
const unique = [...new Set(query)];
const total = unique.reduce((a, t) => a + idf(t), 0);

const scored = docs.map((d) => {
  const head = new Set(d.head);
  const body = new Set(d.body);
  let hit = 0;
  for (const t of unique) {
    if (head.has(t)) hit += idf(t);
    else if (body.has(t)) hit += idf(t) * 0.6;
  }
  return { id: d.r.id || `row-${d.r._row}`, question: d.r.question, answer: d.r.answer, updated: d.r.updated, score: Math.round((hit / total) * 100) / 100 };
}).filter((a) => a.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

const found = scored.length > 0 && scored[0].score >= config.kb_min_score;
return [{ json: {
  found,
  articles: found ? scored : [],
  note: found
    ? 'Отвечай только по этим статьям. Если они не отвечают на вопрос полностью — скажи, чего не хватает, и предложи передать менеджеру.'
    : 'В правилах магазина нет ответа на этот вопрос. Не придумывай ответ: предложи передать вопрос менеджеру (handoff_to_human).',
} }];
