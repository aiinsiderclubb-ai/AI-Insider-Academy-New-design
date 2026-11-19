// Rank Facts: одобренные ответы на возражения и вопросы о гарантиях, кейсах, сравнениях.
// Лист Facts: id | topic | approved_answer | tags
// @include text.js
// @include rank.js
const { input } = $('Config').first().json;
const feed = $input.first().json;
if (feed.error) {
  return [{ json: { result: { ok: false, service_error: String(feed.error.message || feed.error).slice(0, 300),
    note: 'Одобренные ответы недоступны. Не приводи цифр, кейсов и гарантий — предложи звонок с менеджером.' } } }];
}
const rows = sheetRows(feed.values).filter((r) => r.approved_answer);
const found = rank(rows, input.topic, ['topic', 'tags'], ['approved_answer'], 3).filter((x) => x.score >= 0.25);
return [{ json: { result: found.length
  ? { ok: true, found: true, facts: found.map((x) => ({ id: x.row.id, topic: x.row.topic, approved_answer: x.row.approved_answer })),
      note: 'Опирайся только на эти формулировки: цифры, кейсы и условия из них можно называть, свои — нельзя.' }
  : { ok: true, found: false, facts: [], note: 'Одобренного ответа нет. Не придумывай гарантий, кейсов и цифр: признай вопрос, ответь общими словами о подходе или предложи звонок с менеджером.' } } }];
