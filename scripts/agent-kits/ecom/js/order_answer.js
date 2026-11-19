// Order Answer: что модель узнаёт о заказе. Данные — только владельцу.
const r = $input.first().json;
const { input } = $('Config').first().json;
if (r.service_error) {
  return [{ json: { found: false, service_error: r.service_error, note: 'Магазин сейчас не отвечает. Извинись и предложи передать вопрос менеджеру (handoff_to_human).' } }];
}
if (!String(input.order_id || '').trim()) return [{ json: { found: false, note: 'Нет номера заказа. Спроси его у клиента.' } }];
if (!r.found) return [{ json: { found: false, note: 'Заказ с таким номером не найден. Попроси клиента проверить номер (он есть в письме о заказе).' } }];
if (!r.verified) {
  return [{ json: { found: true, verified: false, note: 'Email или телефон не совпадает с заказом. Не сообщай ничего о заказе, даже что он существует. Попроси email, указанный при оформлении.' } }];
}
const o = r.order;
return [{ json: {
  found: true,
  verified: true,
  order: {
    order_id: o.order_id,
    status: o.status,
    created_at: o.created_at,
    delivered_at: o.delivered_at,
    total: `${o.total} ${o.currency}`.trim(),
    items: o.items.map((i) => `${i.title} ×${i.qty}`),
    tracking: o.tracking,
  },
  note: 'Сообщи статус своими словами. Ссылку для отслеживания давай только из поля tracking. Сроки доставки не обещай, если их нет в правилах (search_policies).',
} }];
