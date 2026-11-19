// Ticket Result: что модель узнает о созданном обращении.
const t = $('Ticket Row').first().json;
const res = $input.first().json;
if (res.error) {
  return [{ json: { ok: false, service_error: String(res.error.message || res.error).slice(0, 300), note: 'Обращение не сохранилось. Передай вопрос менеджеру (handoff_to_human) и скажи клиенту, что его вопрос не потерян.' } }];
}
return [{ json: { ok: true, ticket_id: t.ticket_id, priority: t.priority, note: 'Назови клиенту номер обращения и срок ответа по часам работы поддержки.' } }];
