// Plan — decides whether the order sheet has to be read before the tool can answer.
const cfg = $('Config').first().json;
const req = $input.first().json;
// @include _time.js
const done = (result) => [{ json: Object.assign({}, req, { needs_sheet: false, needs_notify: false, result }) }];

if (!req.ok) return done({ ok: false, error: req.error, say: req.say });

const now = nowMs();
const a = req.args;

if (req.tool === 'request_callback') {
  const lines = [
    'Просят связаться с оператором', `Имя: ${a.customer_name}`, `Телефон: ${a.customer_phone}`, a.order_ref ? `Заказ: ${a.order_ref}` : '', `Тема: ${a.topic}`,
    a.urgency ? `Срочность: ${a.urgency}` : '', a.details ? `Детали: ${a.details}` : '', `Звонок: ${req.call_id || '—'}`,
  ].filter(Boolean);
  return [{ json: Object.assign({}, req, { needs_sheet: false, needs_notify: true, staff_message: lines.join('\n'),
    result: { ok: true, say: 'Передал оператору. Скажите клиенту, что с ним свяжутся ' + (cfg.callback_promise || 'в рабочее время') + '.' } }) }];
}

if (req.tool === 'check_windows' || req.tool === 'change_window') {
  const today = dayStart(localDate(now));
  let resolved = a.date;
  if (a.date === 'today') resolved = localDate(now);
  else if (a.date === 'tomorrow') resolved = localDate(today + DAY + 12 * 60 * MIN);
  else if (a.date[0] === '+') resolved = localDate(today + Number(a.date.slice(1)) * DAY + 12 * 60 * MIN);
  else if (DOW.includes(a.date)) {
    const ahead = (DOW.indexOf(a.date) - local(now).dow + 7) % 7;
    resolved = localDate(today + ahead * DAY + 12 * 60 * MIN);
  }
  req.args = Object.assign({}, a, { date: resolved });
  const start = dayStart(resolved);
  const last = today + (cfg.delivery_window_days || 7) * DAY;
  if (start + DAY <= now) return done({ ok: false, error: 'date_in_past', say: 'Эта дата уже прошла. Сегодня ' + localDate(now) + '. Уточните дату.' });
  if (start > last) return done({ ok: false, error: 'too_far', say: `Доставку можно назначить не дальше ${localDate(last)}.` });
}

const range = encodeURIComponent(`'${cfg.sheet_name || 'Orders'}'!A1:U5000`);
return [{ json: Object.assign({}, req, {
  needs_sheet: true, needs_notify: false,
  http: { method: 'GET', url: `${cfg.sheets_api_base}/${encodeURIComponent(cfg.spreadsheet_id)}/values/${range}` },
}) }];
