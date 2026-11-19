// Email Result: что агент разбора почты узнает о сохранённом письме.
const e = $('Email Row').first().json;
const saved = $('Append Email').first().json;
if (saved.error) {
  return [{ json: { ok: false, service_error: String(saved.error.message || saved.error).slice(0, 300), note: 'Разбор письма не сохранился. Сообщи об этом оркестратору.' } }];
}
return [{ json: { ok: true, category: e.category, priority: e.priority, alerted: Boolean(e.alert_html), note: 'Письмо разобрано, черновик ответа сохранён. Клиенту ничего не отправлено — ответ отправит человек.' } }];
