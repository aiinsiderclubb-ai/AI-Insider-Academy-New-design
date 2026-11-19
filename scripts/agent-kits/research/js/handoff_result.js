// Handoff Result: что модель узнает о передаче.
const res = $input.first().json;
if (res.error || res.ok === false) {
  return [{ json: { ok: false, service_error: String(res.error?.message || res.error || res.description || 'telegram').slice(0, 300), note: 'Не удалось уведомить команду. Продолжи отчёт и напиши в начале, какой вопрос требует решения человека.' } }];
}
return [{ json: { ok: true, note: 'Команда получила уведомление. Заверши отчёт тем, что удалось собрать, и отметь, что именно передано людям.' } }];
