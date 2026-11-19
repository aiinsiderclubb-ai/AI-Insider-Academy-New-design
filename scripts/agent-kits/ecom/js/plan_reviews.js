// Plan Reviews: кого попросить об отзыве. Доставлено days_after_delivery..max_age_days дней назад,
// не отменён и не возвращён, нет заявки на возврат, не отписан, раньше не просили, тихие часы.
// @include text.js
// @include order_norm.js
// @include hmac.js
// @include mailer.js
const { config } = $('Config').first().json;
const r = config.reviews;
const now = Date.now();
if (!r.enabled || quietNow(config, now)) return [];

const sheets = $input.first().json.valueRanges || [];
const log = messageLog(sheets[0]?.values);
const blocked = suppressed(sheets[1]?.values);
const returns = new Set(sheetRows(sheets[2]?.values).map((x) => String(x.order_id)));
const source = $('Fetch Delivered').isExecuted ? $('Fetch Delivered') : $('Fetch Completed').isExecuted ? $('Fetch Completed') : $('Read Orders for Reviews');
// WooCommerce отдаёт список — n8n делает из него по элементу на заказ
const found = ordersFrom(config.platform, config.platform === 'woocommerce' ? source.all().map((i) => i.json) : source.first().json);
if (found.error) throw new Error('Заказы для отзывов: ' + found.error);

const asked = new Set(log.filter((m) => m.kind === 'review').map((m) => m.ref));
const plan = [];
for (const o of found.orders) {
  const days = daysSince(o.delivered_at, now);
  if (days === null || days < r.days_after_delivery || days > r.max_age_days) continue;
  if (o.cancelled || o.refunded || !o.email) continue;
  if (returns.has(o.order_id) || asked.has(o.order_id) || blocked.has(o.email.toLowerCase())) continue;
  if (r.require_consent && o.consent !== true) continue;
  const handle = o.items.find((i) => i.handle)?.handle || '';
  const url = r.review_url.replace('{handle}', encodeURIComponent(handle)).replace('{order}', encodeURIComponent(o.order_id))
    .replace(/\/products\/#/, '/#');
  plan.push({ kind: 'review', ref: o.order_id, email: o.email.toLowerCase(), name: o.first_name, step: 1,
    items: o.items.map((i) => i.title), url });
}
return plan.slice(0, r.per_run_limit).map((p) => ({ json: p }));
