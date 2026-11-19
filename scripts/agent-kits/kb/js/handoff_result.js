// Handoff Result: что модель узнает о передаче.
const { config } = $('Config').first().json;
const res = $input.first().json;
if (res.error || res.ok === false) {
  return [{ json: { ok: false, service_error: String(res.error?.message || res.error || res.description || 'telegram').slice(0, 300), note: 'Не удалось уведомить команду. Скажи, к кому обратиться напрямую: ' + config.owner_contact } }];
}
return [{ json: { ok: true, note: `Команда получила уведомление. Скажи, что передал вопрос (${config.owner_contact}). Не обещай время ответа.` } }];
