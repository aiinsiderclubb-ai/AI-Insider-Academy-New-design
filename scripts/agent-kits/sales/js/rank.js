// ---- поиск по строкам листа: слова с учётом окончаний, редкие весят больше ----
function rank(rows, query, headFields, bodyFields, limit) {
  const q = [...new Set(terms(query))];
  if (!q.length || !rows.length) return [];
  const docs = rows.map((r) => ({ r, head: terms(headFields.map((f) => r[f] || '').join(' ')), body: terms(bodyFields.map((f) => r[f] || '').join(' ')) }));
  const df = {};
  for (const d of docs) for (const t of new Set([...d.head, ...d.body])) df[t] = (df[t] || 0) + 1;
  const idf = (t) => Math.log(1 + docs.length / (df[t] || 0.5));
  const total = q.reduce((a, t) => a + idf(t), 0);
  return docs.map((d) => {
    const head = new Set(d.head);
    const body = new Set(d.body);
    let hit = 0;
    for (const t of q) hit += head.has(t) ? idf(t) : body.has(t) ? idf(t) * 0.6 : 0;
    return { row: d.r, score: Math.round((hit / total) * 100) / 100 };
  }).filter((x) => x.score > 0).sort((x, y) => y.score - x.score).slice(0, limit);
}
