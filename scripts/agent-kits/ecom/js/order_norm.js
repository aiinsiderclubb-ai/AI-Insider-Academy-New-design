// ---- заказы из Shopify, WooCommerce или листа Orders в одном виде ----
const STATUS_RU = {
  shopify: {
    FULFILLED: 'Отправлен', UNFULFILLED: 'Готовится к отправке', PARTIALLY_FULFILLED: 'Отправлен частично',
    IN_PROGRESS: 'Собирается', ON_HOLD: 'Задержан', SCHEDULED: 'Запланирован', RESTOCKED: 'Возвращён на склад',
    PENDING_FULFILLMENT: 'Готовится к отправке', OPEN: 'Готовится к отправке',
  },
  woocommerce: {
    pending: 'Ожидает оплаты', processing: 'Собирается', 'on-hold': 'Ожидает подтверждения', completed: 'Выполнен',
    cancelled: 'Отменён', refunded: 'Деньги возвращены', failed: 'Оплата не прошла', 'checkout-draft': 'Не оформлен',
  },
};

function money(v) {
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** ISO как есть; ДД.ММ.ГГГГ [ЧЧ:ММ] → ISO. Формат М/Д/ГГГГ не разбираем: он путается с Д/М. */
function isoDate(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.length === 10 ? s + 'T12:00:00Z' : s;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${(m[4] || '12').padStart(2, '0')}:${m[5] || '00'}:00Z`;
  return '';
}

function yes(v) {
  return /^(1|true|yes|да|y|subscribed)$/i.test(String(v ?? '').trim());
}

function normShopify(o) {
  const fulfillments = o.fulfillments || [];
  const delivered = fulfillments.map((f) => f.deliveredAt).filter(Boolean).sort().pop() || '';
  const email = o.email || o.customer?.defaultEmailAddress?.emailAddress || o.customer?.email || '';
  const marketing = o.customer?.defaultEmailAddress?.marketingState;
  let status = STATUS_RU.shopify[o.displayFulfillmentStatus] || o.displayFulfillmentStatus || '';
  if (delivered) status = 'Доставлен';
  if (o.cancelledAt) status = 'Отменён';
  if (o.displayFinancialStatus === 'PENDING') status = 'Ожидает оплаты';
  if (o.displayFinancialStatus === 'REFUNDED') status = 'Деньги возвращены';
  return {
    order_id: String(o.name || '').replace(/^#/, ''),
    email,
    phone: o.phone || o.customer?.defaultPhoneNumber?.phoneNumber || '',
    first_name: o.customer?.firstName || '',
    status,
    cancelled: Boolean(o.cancelledAt),
    refunded: o.displayFinancialStatus === 'REFUNDED',
    created_at: o.createdAt || '',
    delivered_at: delivered,
    total: money(o.totalPriceSet?.shopMoney?.amount),
    currency: o.totalPriceSet?.shopMoney?.currencyCode || '',
    tags: (o.tags || []).map((t) => String(t).toLowerCase()),
    items: (o.lineItems?.nodes || []).map((li) => ({
      title: li.title, qty: li.quantity, type: li.product?.productType || '',
      tags: (li.product?.tags || []).map((t) => String(t).toLowerCase()), handle: li.product?.handle || '',
    })),
    tracking: fulfillments.flatMap((f) => (f.trackingInfo || []).map((t) => ({ number: t.number || '', url: t.url || '', company: t.company || '' }))),
    consent: marketing ? marketing === 'SUBSCRIBED' : null,
  };
}

function normWoo(o) {
  const tracking = [];
  for (const m of o.meta_data || []) {
    if (m.key === '_wc_shipment_tracking_items' && Array.isArray(m.value)) {
      for (const t of m.value) tracking.push({ number: t.tracking_number || '', url: t.custom_tracking_link || '', company: t.tracking_provider || t.custom_tracking_provider || '' });
    }
  }
  return {
    order_id: String(o.number || o.id || ''),
    email: o.billing?.email || '',
    phone: o.billing?.phone || '',
    first_name: o.billing?.first_name || '',
    status: STATUS_RU.woocommerce[o.status] || o.status || '',
    cancelled: o.status === 'cancelled' || o.status === 'failed',
    refunded: o.status === 'refunded',
    created_at: o.date_created_gmt ? o.date_created_gmt + 'Z' : '',
    // «Выполнен» в WooCommerce обычно ставят при отправке или вручении — см. docs/02-setup.md
    delivered_at: o.status === 'completed' && o.date_completed_gmt ? o.date_completed_gmt + 'Z' : '',
    total: money(o.total),
    currency: o.currency || '',
    tags: [],
    items: (o.line_items || []).map((li) => ({ title: li.name, qty: li.quantity, type: '', tags: [], handle: '' })),
    tracking,
    consent: null,
  };
}

function normSheetRow(r) {
  const items = String(r.items || '').split(/;|\n/).map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = /^(.*?)\s*(?:[×x*]\s*(\d+))?\s*(?:\[(.*?)\])?$/i.exec(s);
    return { title: (m?.[1] || s).trim(), qty: Number(m?.[2] || 1), type: (m?.[3] || '').trim(), tags: [], handle: '' };
  });
  const tracking = String(r.tracking || '').split(/[;,]/).map((s) => s.trim()).filter(Boolean).map((number) => ({ number, url: '', company: '' }));
  const status = r.status || '';
  return {
    order_id: String(r.order_id || '').replace(/^#/, ''),
    email: r.email || '',
    phone: r.phone || '',
    first_name: r.first_name || r.name || '',
    status,
    cancelled: /отмен|cancel/i.test(status),
    refunded: /возвращ|refund/i.test(status),
    created_at: isoDate(r.created_at),
    delivered_at: isoDate(r.delivered_at),
    total: money(r.total),
    currency: r.currency || '',
    tags: String(r.tags || '').split(/[,;]/).map((t) => t.trim().toLowerCase()).filter(Boolean),
    items,
    tracking,
    consent: r.consent === undefined || r.consent === '' ? null : yes(r.consent),
  };
}

/** All orders found in an HTTP/Sheets answer, normalised. */
function ordersFrom(platform, res) {
  if (!res || res.error) return { error: res?.error ? String(res.error.message || res.error) : 'empty answer' };
  if (platform === 'shopify') {
    if (res.errors) return { error: JSON.stringify(res.errors).slice(0, 300) };
    return { orders: (res.data?.orders?.nodes || []).map(normShopify) };
  }
  if (platform === 'woocommerce') {
    const list = Array.isArray(res) ? res : res.id !== undefined ? [res] : [];
    return { orders: list.map(normWoo) };
  }
  return { orders: sheetRows(res.values).map(normSheetRow) };
}

function sameOrder(a, b) {
  const n = (v) => String(v || '').toLowerCase().replace(/[#№\s-]/g, '');
  return n(a) === n(b);
}

function ownerMatches(order, email, phone) {
  const e = String(email || '').trim().toLowerCase();
  const digits = (v) => String(v || '').replace(/\D/g, '');
  const p = digits(phone);
  const emailOk = e && order.email && e === order.email.toLowerCase();
  const phoneOk = p.length >= 7 && digits(order.phone).length >= 7 && digits(order.phone).endsWith(p.slice(-9));
  return Boolean(emailOk || phoneOk);
}

function daysSince(iso, now) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor((now - t) / 86400000) : null;
}
