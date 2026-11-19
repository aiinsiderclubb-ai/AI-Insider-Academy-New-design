// Normalize Order: заказ из магазина в одном виде + проверка, что спрашивает владелец.
// @include text.js
// @include order_norm.js
const { config, input } = $('Config').first().json;
const found = ordersFrom(config.platform, $input.first().json);
const base = { tool: input.tool };

if (found.error) {
  // WooCommerce отвечает 404 на несуществующий номер — это не сбой, а «не найден»
  if (config.platform === 'woocommerce' && /404|invalid.id|Invalid ID/i.test(found.error)) {
    return [{ json: { ...base, found: false } }];
  }
  return [{ json: { ...base, found: false, service_error: found.error.slice(0, 300) } }];
}
const order = found.orders.find((o) => sameOrder(o.order_id, input.order_id));
if (!order) return [{ json: { ...base, found: false } }];
const verified = ownerMatches(order, input.email || input.customer_email, input.customer_phone);
return [{ json: { ...base, found: true, verified, order } }];
