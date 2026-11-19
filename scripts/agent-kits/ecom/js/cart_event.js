// Cart Event: магазин сообщает о корзине или заказе — строка в лист Carts.
// Для WooCommerce, Tilda и своих сайтов, где нет API брошенных корзин.
// Колонки Carts: time | event | cart_id | email | name | consent | items | total | currency | checkout_url
const { config, input } = $input.first().json;
const body = input.body || {};
const token = (input.headers || {})['x-agent-token'] || body.token;
if (!config.agent_token || config.agent_token.startsWith('ЗАМЕНИТЕ') || token !== config.agent_token) return [{ json: { route: 'deny' } }];
const event = String(body.event || '');
const cart_id = String(body.cart_id || '').slice(0, 100);
const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
if (!['cart', 'order'].includes(event)) return [{ json: { route: 'bad', error: 'event: cart или order' } }];
if (!cart_id) return [{ json: { route: 'bad', error: 'cart_id обязателен' } }];
if (event === 'cart' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return [{ json: { route: 'bad', error: 'email обязателен для события cart' } }];
const items = Array.isArray(body.items)
  ? body.items.slice(0, 30).map((i) => `${String(i.title || i.name || '').slice(0, 120)} ×${Number(i.qty || i.quantity || 1)}`).join('; ')
  : String(body.items || '').slice(0, 1000);
const url = String(body.checkout_url || '');
if (url && !/^https:\/\//.test(url)) return [{ json: { route: 'bad', error: 'checkout_url должен начинаться с https://' } }];
const row = [new Date().toISOString(), event, cart_id, email, String(body.name || '').slice(0, 100), body.consent ? 'yes' : 'no',
  items, String(body.total ?? ''), String(body.currency || ''), url];
return [{ json: { route: 'ok', row } }];
