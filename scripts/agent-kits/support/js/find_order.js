// Find Order: статус заказа из листа Orders. Данные заказа отдаются, только если
// email или телефон клиента совпадает с заказом.
// Колонки: order_id | email | phone | status | items | total | carrier | tracking | eta | updated
// @include text.js
const { input } = $('Config').first().json;
const failed = $input.first().json.error;
if (failed) {
  return [{ json: { found: false, service_error: String(failed.message || failed).slice(0, 300), note: 'Сейчас база недоступна. Извинись и предложи передать вопрос менеджеру (handoff_to_human). Не отвечай по памяти.' } }];
}
const rows = sheetRows($input.first().json.values);
const norm = (v) => String(v || '').toLowerCase().replace(/[#№\s-]/g, '');
const digits = (v) => String(v || '').replace(/\D/g, '');
const wanted = norm(input.order_id);

if (!wanted) return [{ json: { found: false, note: 'Нет номера заказа. Спроси его у клиента.' } }];
const order = rows.find((r) => norm(r.order_id) === wanted);
if (!order) {
  return [{ json: { found: false, note: 'Заказ с таким номером не найден. Попроси клиента проверить номер; если номер верный — создай обращение (create_ticket).' } }];
}

const email = String(input.email || input.customer_email || '').trim().toLowerCase();
const phone = digits(input.customer_phone);
const emailOk = email && order.email && email === order.email.toLowerCase();
const phoneOk = phone.length >= 7 && digits(order.phone).endsWith(phone.slice(-9));
if (!emailOk && !phoneOk) {
  return [{ json: {
    found: true,
    verified: false,
    note: email
      ? 'Email не совпадает с заказом. Не сообщай никаких данных заказа. Попроси клиента написать email, указанный при оформлении.'
      : 'Чтобы показать заказ, нужен email, указанный при оформлении. Спроси его у клиента. Данные заказа до проверки не сообщай.',
  } }];
}

return [{ json: {
  found: true,
  verified: true,
  order: {
    order_id: order.order_id,
    status: order.status,
    items: order.items,
    total: order.total,
    carrier: order.carrier,
    tracking: order.tracking,
    eta: order.eta,
    updated: order.updated,
  },
  note: 'Сообщи клиенту статус своими словами. Если статус непонятен клиенту или есть проблема — предложи создать обращение.',
} }];
