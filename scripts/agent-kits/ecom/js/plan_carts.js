// Plan Carts: кому и какое письмо о брошенной корзине отправить сейчас.
// Правила: согласие, не купил, не отписан, не старше max_age, одно письмо на адрес за раз,
// шаг 1 через first_after_minutes, шаг 2 через second_after_hours, тихие часы.
// @include text.js
// @include hmac.js
// @include mailer.js
const { config } = $('Config').first().json;
const c = config.carts;
const now = Date.now();
if (!c.enabled || quietNow(config, now)) return [];

const sheets = $input.first().json.valueRanges || [];
const log = messageLog(sheets[0]?.values);
const blocked = suppressed(sheets[1]?.values);

let carts = [];
if ($('Fetch Checkouts').isExecuted) {
  const res = $('Fetch Checkouts').first().json;
  if (res.error || res.errors) throw new Error('Shopify: ' + JSON.stringify(res.error || res.errors).slice(0, 300));
  carts = (res.data?.abandonedCheckouts?.nodes || []).map((x) => ({
    ref: String(x.id).split('/').pop(),
    email: String(x.customer?.defaultEmailAddress?.emailAddress || x.email || '').toLowerCase(),
    name: x.customer?.firstName || '',
    consent: x.customer?.defaultEmailAddress?.marketingState === 'SUBSCRIBED',
    completed: Boolean(x.completedAt),
    at: Date.parse(x.updatedAt || x.createdAt),
    items: (x.lineItems?.nodes || []).map((i) => `${i.title} ×${i.quantity}`),
    total: parseFloat(x.totalPriceSet?.shopMoney?.amount || 0),
    currency: x.totalPriceSet?.shopMoney?.currencyCode || '',
    url: x.abandonedCheckoutUrl || '',
  }));
} else {
  const res = $('Read Carts').first().json;
  if (res.error) throw new Error('Лист Carts: ' + String(res.error.message || res.error).slice(0, 300));
  const rows = sheetRows(res.values);
  const orders = rows.filter((r) => r.event === 'order');
  const latest = {};
  for (const r of rows.filter((r) => r.event === 'cart')) latest[r.cart_id] = r;
  carts = Object.values(latest).map((r) => {
    const at = Date.parse(r.time);
    const email = String(r.email || '').toLowerCase();
    return {
      ref: r.cart_id, email, name: r.name, consent: /^(yes|да|true|1)$/i.test(r.consent),
      completed: orders.some((o) => o.cart_id === r.cart_id || (email && String(o.email).toLowerCase() === email && Date.parse(o.time) >= at)),
      at, items: String(r.items || '').split(';').map((s) => s.trim()).filter(Boolean),
      total: parseFloat(String(r.total).replace(',', '.')) || 0, currency: r.currency, url: r.checkout_url,
    };
  });
}

const plan = [];
const skipped = {};
const skip = (why) => (skipped[why] = (skipped[why] || 0) + 1);
// одна (самая свежая) корзина на адрес
const byEmail = {};
for (const cart of carts.sort((a, b) => b.at - a.at)) if (cart.email && !byEmail[cart.email]) byEmail[cart.email] = cart;

for (const cart of Object.values(byEmail)) {
  const age = (now - cart.at) / 60000;
  const sent = log.filter((m) => m.kind === 'cart' && m.ref === cart.ref && m.status === 'sent');
  const lastToEmail = Math.max(0, ...log.filter((m) => m.kind === 'cart' && m.email === cart.email && m.status === 'sent').map((m) => m.t));
  if (cart.completed) { skip('купил'); continue; }
  if (blocked.has(cart.email)) { skip('отписан'); continue; }
  if (c.require_consent && !cart.consent) { skip('нет согласия'); continue; }
  if (!cart.url) { skip('нет ссылки на корзину'); continue; }
  if (cart.total < c.min_total) { skip('маленькая сумма'); continue; }
  if (age > c.max_age_hours * 60) { skip('слишком старая'); continue; }
  let step = 0;
  if (!sent.length && age >= c.first_after_minutes) step = 1;
  else if (sent.length === 1 && age >= c.second_after_hours * 60 && now - sent[0].t >= 6 * 3600000) step = 2;
  if (!step) { skip(sent.length >= 2 ? 'уже два письма' : 'ещё рано'); continue; }
  if (step === 1 && now - lastToEmail < 12 * 3600000) { skip('недавно писали'); continue; }
  plan.push({ kind: 'cart', ref: cart.ref, email: cart.email, name: cart.name, step, items: cart.items, total: cart.total,
    currency: cart.currency, url: cart.url, discount_code: step === 2 ? c.discount_code : '' });
}

return plan.slice(0, c.per_run_limit).map((p) => ({ json: p }));
