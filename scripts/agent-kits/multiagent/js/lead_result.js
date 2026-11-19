// Lead Result: что агент по лидам узнает о сохранённом лиде.
const lead = $('Lead Row').first().json;
const saved = $('Append Lead').first().json;
if (saved.error) {
  return [{ json: { ok: false, service_error: String(saved.error.message || saved.error).slice(0, 300), note: 'Лид не сохранился. Скажи оркестратору, что нужна передача человеку.' } }];
}
return [{ json: {
  ok: true,
  lead_id: lead.lead_id,
  score: lead.score,
  hot: lead.hot,
  duplicate: lead.duplicate,
  reasons: lead.reasons,
  note: lead.hot
    ? 'Лид горячий: команда уже получила сигнал. Скажи клиенту, что с ним свяжутся в рабочее время. Не называй балл.'
    : 'Лид сохранён. Если не хватает данных (бюджет, срок, контакт) — задай клиенту один уточняющий вопрос. Балл клиенту не называй.',
} }];
