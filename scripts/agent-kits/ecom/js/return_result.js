// Return Result: что модель узнаёт о заявке.
const p = $('Return Alert').first().json;
const saved = $('Append Return').first().json;
if (saved.error) {
  return [{ json: { ok: false, service_error: String(saved.error.message || saved.error).slice(0, 300), note: 'Заявка не сохранилась. Передай вопрос менеджеру (handoff_to_human).' } }];
}
return [{ json: {
  ok: true,
  rma: p.rma,
  decision: p.decision,
  note: `Назови клиенту номер заявки ${p.rma}. Скажи, что менеджер проверит её и пришлёт инструкцию по отправке. Деньги возвращаются только после получения и проверки товара — не обещай ни сумму, ни срок.`,
} }];
