// Handoff Result: что модель узнает о передаче.
const { config } = $('Config').first().json;
const res = $input.first().json;
if (res.error || res.ok === false) {
  return [{ json: { ok: false, service_error: String(res.error?.message || res.error || res.description || 'telegram').slice(0, 300), note: 'Не удалось уведомить менеджера. Попроси клиента написать на почту поддержки и извинись.' } }];
}
return [{ json: { ok: true, note: `Менеджер получил уведомление. Скажи клиенту, что передал вопрос; ответ — в рабочее время: ${config.support_hours}. Не обещай точное время.` } }];
