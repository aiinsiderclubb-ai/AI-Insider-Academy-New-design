// Products: поиск по каталогу (search_catalog) и ссылка на оплату (send_offer).
// Лист Products: id | name | description | price | currency | url | payment_link | tags | in_stock
// @include text.js
// @include rank.js
const { config, input } = $('Config').first().json;
const feed = $input.first().json;
const out = (result, team_message = '') => [{ json: { result, team_message } }];
if (feed.error) {
  return out({ ok: false, service_error: String(feed.error.message || feed.error).slice(0, 300),
    note: 'Каталог сейчас недоступен. Извинись, цен и наличия не называй, предложи звонок с менеджером (book_call) или передачу (handoff_to_human).' });
}
const rows = sheetRows(feed.values).filter((r) => r.id && r.name);
const view = (r) => ({ product_id: r.id, name: r.name, description: r.description, price: r.price ? `${r.price} ${r.currency || config.currency}` : 'по запросу',
  url: r.url, in_stock: !/^(нет|no|false|0)$/i.test(r.in_stock || 'да'), can_pay_online: Boolean(r.payment_link) });

if (input.tool === 'search_catalog') {
  const found = rank(rows, input.query, ['name', 'tags'], ['description'], 4).filter((x) => x.score >= 0.25);
  if (!found.length) {
    return out({ ok: true, found: false, products: [], note: 'В каталоге нет подходящего. Не придумывай товар и цену: уточни задачу клиента или предложи звонок с менеджером.' });
  }
  return out({ ok: true, found: true, products: found.map((x) => view(x.row)),
    note: 'Цены и условия — только эти. Порекомендуй один вариант под задачу клиента и объясни почему, одним-двумя предложениями.' });
}

// send_offer
const product = rows.find((r) => r.id.toLowerCase() === String(input.product_id || '').trim().toLowerCase());
if (!product) return out({ ok: false, error: 'unknown_product', note: 'Нет товара с таким product_id. Вызови search_catalog и возьми product_id оттуда.' });
const kind = String(input.kind || '').toLowerCase();
if (kind === 'payment') {
  if (!product.payment_link) {
    return out({ ok: false, error: 'no_payment_link', note: 'Для этого товара нет онлайн-оплаты. Предложи коммерческое предложение (kind=quote) или звонок (book_call).' });
  }
  return out({ ok: true, product: view(product), payment_link: product.payment_link, expose: { payment_link: product.payment_link },
    note: 'Дай клиенту эту ссылку на оплату ровно как есть. Другие ссылки не придумывай. Затем сохрани этап offer_sent (save_lead).' },
    `💳 Ссылка на оплату отправлена\n${product.name} — ${view(product).price}\nКлиент: ${input.customer_name || '—'} · ${input.customer_contact || input.email || '—'}\nСессия: ${input.session_id}`);
}
if (kind === 'quote') {
  const email = String(input.email || input.customer_email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return out({ ok: false, error: 'no_email', note: 'Для КП нужен email клиента. Спроси его.' });
  return out({ ok: true, product: view(product), quote_requested: true,
    note: `Менеджер подготовит предложение и пришлёт на ${email} в рабочее время (${config.team_hours}). Точный срок не обещай. Сохрани этап offer_sent (save_lead).` },
    `📄 Запрос КП\n${product.name}\nКлиент: ${input.customer_name || '—'} · ${email}\nСессия: ${input.session_id}\nЗаметка агента: ${String(input.notes || '').slice(0, 500)}`);
}
return out({ ok: false, error: 'bad_kind', note: 'kind — payment или quote.' });
