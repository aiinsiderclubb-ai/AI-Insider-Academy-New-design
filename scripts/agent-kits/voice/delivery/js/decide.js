// Decide — reads the order sheet and either answers the tool or prepares one write.
const cfg = $('Config').first().json;
const ctx = $('Plan').first().json;
const feed = $input.first().json || {};
// @include _time.js
const a = ctx.args;
const now = nowMs();
const done = (result) => [{ json: Object.assign({}, ctx, { needs_write: false, result }) }];
const write = (cells, onSuccess, staffMessage) => [{ json: Object.assign({}, ctx, {
  needs_write: true, on_success: onSuccess, staff_message: staffMessage || '',
  http: { method: 'POST', url: `${cfg.sheets_api_base}/${encodeURIComponent(cfg.spreadsheet_id)}/values:batchUpdate`,
    body: { valueInputOption: 'RAW', data: cells } },
}) }];

// ---- the sheet: columns are found by their header, so their order does not matter ----
const COLUMNS = ['order_id', 'phone', 'customer_name', 'city', 'address', 'apartment', 'entrance', 'floor', 'intercom', 'courier_note',
  'delivery_date', 'window', 'status', 'items', 'total', 'payment', 'confirmed', 'confirmed_at', 'calls', 'last_call', 'history'];
const values = Array.isArray(feed.values) ? feed.values : [];
const head = (values[0] || []).map((h) => String(h).trim().toLowerCase());
const missingCols = COLUMNS.filter((c) => !head.includes(c));
if (missingCols.length) {
  return [{ json: Object.assign({}, ctx, { needs_write: false, needs_notify: true,
    staff_message: ['Таблица заказов не по шаблону', 'Нет колонок: ' + missingCols.join(', '), `Звонок: ${ctx.call_id || '—'}`].join('\n'),
    result: { ok: false, error: 'tool_unavailable', say: 'Система заказов сейчас недоступна. Извинитесь, не называйте результат, предложите связаться с оператором через request_callback.' } }) }];
}
const letter = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
const sheet = `'${String(cfg.sheet_name || 'Orders').replace(/'/g, "''")}'`;
const cell = (order, col, value) => ({ range: `${sheet}!${letter(head.indexOf(col))}${order._row}`, values: [[value]] });

const digits = (value) => String(value || '').replace(/[^\d]/g, '');
const phoneRules = cfg.phone || {};
const phone = (value) => {
  let d = digits(value);
  if (d.startsWith('00')) d = d.slice(2);
  else if (phoneRules.national_prefix && phoneRules.country_code && d.startsWith(phoneRules.national_prefix) && !d.startsWith(phoneRules.country_code)) {
    d = phoneRules.country_code + d.slice(phoneRules.national_prefix.length);
  }
  return d.length >= 9 && d.length <= 15 ? '+' + d : '';
};
const orders = values.slice(1).map((row, i) => {
  const o = { _row: i + 2 };
  for (const c of COLUMNS) o[c] = String(row[head.indexOf(c)] ?? '').trim();
  o.order_id_norm = o.order_id.replace(/[\s#№-]/g, '').toUpperCase();
  o.phone_norm = phone(o.phone);
  o.status = o.status.toLowerCase();
  return o;
}).filter((o) => o.order_id);

const CLOSED = ['delivered', 'cancelled'];
const label = (status) => (cfg.status_labels || {})[status] || status || 'не указан';
const addressSpoken = (o) => [
  [o.city, o.address].filter(Boolean).join(', '),
  o.apartment && `квартира ${o.apartment}`, o.entrance && `подъезд ${o.entrance}`, o.floor && `этаж ${o.floor}`, o.intercom && `домофон ${o.intercom}`,
].filter(Boolean).join(', ');
const windowStart = (o) => (o.delivery_date && windowOf(o.window) ? at(o.delivery_date, windowOf(o.window).start) : NaN);
const cutoff = (cfg.change_cutoff_hours || 0) * 60 * MIN;
function blocked(o, strict) {
  if (CLOSED.includes(o.status)) return { error: 'order_closed', say: `Заказ уже ${label(o.status)}. Изменить его нельзя.` };
  if (strict && !(cfg.changeable_statuses || []).includes(o.status)) {
    return { error: 'not_changeable', say: `Заказ сейчас «${label(o.status)}» — изменить адрес или время может только оператор. Предложите request_callback.` };
  }
  if (strict && windowStart(o) - now < cutoff) {
    return { error: 'too_late', say: `До доставки меньше ${cfg.change_cutoff_hours} ч — изменения принимает только оператор. Предложите request_callback.` };
  }
  return null;
}
const describe = (o) => {
  const block = blocked(o, true);
  return {
    order_id: o.order_id, status: label(o.status), delivery_date: o.delivery_date, window_id: o.window,
    delivery: o.delivery_date ? spokenWindow(o.delivery_date, o.window) : 'дата не назначена',
    address: addressSpoken(o), items: o.items.slice(0, 300), total: o.total, payment: o.payment,
    confirmed: /^(да|yes|1|true)$/i.test(o.confirmed), can_change: !block, change_note: block ? block.say : '',
  };
};
const history = (o, entry) => (o.history ? o.history + '\n' : '') + `${localIso(now)} ${entry} (голосовой агент${ctx.call_id ? ', звонок ' + ctx.call_id : ''})`;
const tail = (text) => (text.length > 2000 ? text.slice(-2000) : text);
const mine = orders.filter((o) => o.phone_norm && o.phone_norm === a.customer_phone);

if (ctx.tool === 'find_order') {
  let list = mine.filter((o) => !CLOSED.includes(o.status));
  if (a.order_id) list = mine.filter((o) => o.order_id_norm === a.order_id);
  list = list.slice(0, 3).map(describe);
  return done({ ok: true, orders: list,
    say: list.length ? 'Назовите клиенту заказ, дату с интервалом и адрес и спросите, всё ли верно. Состав заказа не обсуждайте и не меняйте.'
      : 'На этот номер активных заказов нет. Уточните номер телефона или номер заказа; если не найдётся — request_callback.' });
}

const order = mine.find((o) => o.order_id_norm === a.order_id);
if (!order) {
  return done({ ok: false, error: 'order_not_found', say: 'Заказа с таким номером на этот телефон нет. Вызовите find_order и уточните.' });
}

if (ctx.tool === 'confirm_delivery') {
  const block = blocked(order, false);
  if (block) return done(Object.assign({ ok: false }, block));
  if (/^(да|yes|1|true)$/i.test(order.confirmed)) {
    return done({ ok: true, order_id: order.order_id, delivery: describe(order).delivery, say: 'Доставка уже подтверждена. Поблагодарите клиента.' });
  }
  const entry = 'доставка подтверждена клиентом';
  return write([cell(order, 'confirmed', 'да'), cell(order, 'confirmed_at', localIso(now)), cell(order, 'history', tail(history(order, entry)))],
    { ok: true, order_id: order.order_id, delivery: describe(order).delivery, address: addressSpoken(order),
      say: 'Доставка подтверждена. Повторите клиенту дату, интервал и адрес и попрощайтесь.' },
    cfg.notify_on_confirm ? ['Доставка подтверждена', `Заказ: ${order.order_id}`, describe(order).delivery, addressSpoken(order)].join('\n') : '');
}

if (ctx.tool === 'update_address') {
  // Courier details (flat, intercom, note) may change until delivery; the street only while the order is changeable.
  const moving = Boolean(a.city || a.address);
  const block = blocked(order, moving);
  if (block) return done(Object.assign({ ok: false }, block));
  const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/^(г\.|город|м\.|місто)\s*/, '').trim();
  if (a.city && !(cfg.service_cities || []).some((c) => norm(c) === norm(a.city))) {
    return done({ ok: false, error: 'outside_zone', say: 'В этот город мы не доставляем по текущему заказу. Адрес вне зоны меняет только оператор: предложите request_callback.' });
  }
  const next = Object.assign({}, order);
  const cells = [];
  const changes = [];
  for (const key of ['city', 'address', 'apartment', 'entrance', 'floor', 'intercom', 'courier_note']) {
    if (a[key] === undefined || a[key] === '' || a[key] === order[key]) continue;
    next[key] = a[key];
    cells.push(cell(order, key, a[key]));
    changes.push(`${key}: «${order[key] || '—'}» → «${a[key]}»`);
  }
  const relocated = (a.address && a.address !== order.address) || (a.city && norm(a.city) !== norm(order.city));
  if (relocated && !a.apartment && order.apartment) {
    // A new street makes the old flat number wrong; keep it only if the caller repeated it.
    next.apartment = '';
    cells.push(cell(order, 'apartment', ''));
    changes.push(`apartment: «${order.apartment}» → «»`);
  }
  if (!cells.length) return done({ ok: true, order_id: order.order_id, address: addressSpoken(order), say: 'Адрес уже такой. Подтвердите его клиенту.' });
  cells.push(cell(order, 'confirmed', 'да'), cell(order, 'confirmed_at', localIso(now)));
  cells.push(cell(order, 'history', tail(history(order, 'адрес изменён: ' + changes.join('; ')))));
  return write(cells, { ok: true, order_id: order.order_id, address: addressSpoken(next), delivery: describe(order).delivery,
    say: 'Адрес изменён. Повторите клиенту новый адрес целиком и интервал доставки.' },
  [moving ? 'Изменён адрес доставки' : 'Уточнение для курьера', `Заказ: ${order.order_id}`, `Телефон: ${order.phone}`, `Было: ${addressSpoken(order)}`, `Стало: ${addressSpoken(next)}`,
    describe(order).delivery, order.status === 'out_for_delivery' ? 'Заказ уже у курьера — передайте ему.' : ''].filter(Boolean).join('\n'));
}

// ---- windows ----
const loadOf = (date, id) => orders.filter((o) => o.delivery_date === date && o.window === id && o.status !== 'cancelled' && o.order_id_norm !== order.order_id_norm).length;
function dateProblem(date) {
  if ((cfg.closed_dates || []).includes(date)) return 'closed_date';
  if (!(cfg.delivery_days || []).includes(DOW[local(dayStart(date) + 12 * 60 * MIN).dow])) return 'closed_date';
  return null;
}
function freeWindows(date) {
  if (dateProblem(date)) return [];
  return (cfg.windows || [])
    .filter((w) => at(date, w.start) - now >= cutoff && loadOf(date, w.id) < w.capacity)
    .map((w) => ({ date, window_id: w.id, spoken: spokenWindow(date, w.id) }));
}
function nearestWindows(fromDate) {
  const found = [];
  const last = dayStart(localDate(now)) + (cfg.delivery_window_days || 7) * DAY;
  for (let day = dayStart(fromDate) + 12 * 60 * MIN; day <= last + 12 * 60 * MIN && found.length < 3; day += DAY) {
    found.push(...freeWindows(localDate(day)).slice(0, 3 - found.length));
  }
  return found;
}

const block = blocked(order, true);
if (block) return done(Object.assign({ ok: false }, block));

if (ctx.tool === 'check_windows') {
  const same = freeWindows(a.date);
  if (same.length) {
    return done({ ok: true, available: true, order_id: order.order_id, current: describe(order).delivery, date: a.date, windows: same,
      say: 'Предложите клиенту эти интервалы, не больше двух за раз. В change_window передайте date и window_id выбранного.' });
  }
  const other = nearestWindows(localDate(dayStart(a.date) + DAY + 12 * 60 * MIN));
  return done({ ok: true, available: false, order_id: order.order_id, current: describe(order).delivery, date: a.date, windows: other,
    say: other.length ? 'На эту дату свободных интервалов нет. Предложите ближайшие из windows.' : 'Свободных интервалов на неделю вперёд нет. Предложите request_callback.' });
}

// change_window
const w = windowOf(String(a.window_id));
if (order.delivery_date === a.date && order.window === w.id) {
  return done({ ok: true, order_id: order.order_id, delivery: spokenWindow(a.date, w.id), say: 'Доставка уже назначена на этот интервал. Подтвердите его клиенту.' });
}
const problem = dateProblem(a.date) ? 'closed_date' : at(a.date, w.start) - now < cutoff ? 'too_soon' : loadOf(a.date, w.id) >= w.capacity ? 'window_full' : null;
if (problem) {
  const why = { closed_date: 'В этот день доставки нет.', too_soon: 'Этот интервал слишком близко.', window_full: 'Этот интервал уже заполнен.' }[problem];
  return done({ ok: false, error: problem, windows: nearestWindows(a.date), say: why + ' Предложите варианты из windows. Прежний интервал сохранён.' });
}
const was = describe(order).delivery;
return write([
  cell(order, 'delivery_date', a.date), cell(order, 'window', w.id), cell(order, 'confirmed', 'да'), cell(order, 'confirmed_at', localIso(now)),
  cell(order, 'history', tail(history(order, `интервал: ${order.delivery_date} ${order.window} → ${a.date} ${w.id}`))),
], { ok: true, order_id: order.order_id, delivery: spokenWindow(a.date, w.id), previous: was, address: addressSpoken(order),
  say: 'Интервал изменён. Назовите клиенту новые дату и интервал.' },
['Перенос доставки', `Заказ: ${order.order_id}`, `Телефон: ${order.phone}`, `Было: ${was}`, `Стало: ${spokenWindow(a.date, w.id)}`, addressSpoken(order)].join('\n'));
