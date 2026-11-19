// Decide: читает календарь и либо отвечает модели, либо готовит одну запись в календарь.
const { config: cfg } = $('Config').first().json;
const ctx = $('Plan').first().json;
const feed = $input.first().json || {};
// @include time.js

const a = ctx.args;
const now = nowMs();
const done = (result) => [{ json: { tool: ctx.tool, needs_write: false, result } }];
const write = (http, onSuccess, teamMessage) => [{ json: { tool: ctx.tool, needs_write: true, http, on_success: onSuccess, team_message: teamMessage || '' } }];

if (feed.error) {
  return done({ ok: false, service_error: String(feed.error.message || feed.error).slice(0, 300),
    note: 'Календарь сейчас недоступен. Извинись и предложи передать запрос менеджеру (handoff_to_human). Время не обещай.' });
}

const items = Array.isArray(feed.items) ? feed.items : [];
const priv = (e) => (e.extendedProperties && e.extendedProperties.private) || {};
const edge = (x) => (x && x.dateTime ? Date.parse(x.dateTime) : x && x.date ? dayStart(x.date) : NaN);
const busy = items
  .filter((e) => e.status !== 'cancelled' && e.transparency !== 'transparent')
  .map((e) => ({ id: e.id, start: edge(e.start), end: edge(e.end), raw: e }))
  .filter((e) => !isNaN(e.start) && !isNaN(e.end));
const buffer = (cfg.buffer_min || 0) * MIN;
const step = (cfg.slot_step_min || 30) * MIN;
const lead = (cfg.lead_time_min || 0) * MIN;
const services = cfg.services || [];
const serviceOf = (id) => services.find((s) => s.id === id);
const clientTz = a.client_timezone && validTz(a.client_timezone) && a.client_timezone !== TZ ? a.client_timezone : null;

function hoursFor(ms) {
  const t = local(ms);
  const date = `${t.y}-${pad(t.mo)}-${pad(t.d)}`;
  if ((cfg.closed_dates || []).includes(date)) return null;
  const day = (cfg.hours || {})[['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][t.dow]];
  if (!day) return null;
  const [oh, om] = day.open.split(':').map(Number);
  const [ch, cm] = day.close.split(':').map(Number);
  return { open: localToUtc(t.y, t.mo, t.d, oh, om), close: localToUtc(t.y, t.mo, t.d, ch, cm) };
}
function slotError(start, service, ignoreId) {
  const length = service.duration_min * MIN;
  const hours = hoursFor(start);
  if (start < now + lead) return 'too_soon';
  if (start > now + (cfg.booking_window_days || 30) * DAY) return 'too_far';
  if (!hours || start < hours.open || start + length > hours.close) return 'outside_hours';
  if ((start - hours.open) % step !== 0) return 'off_grid';
  if (busy.some((e) => e.id !== ignoreId && e.start < start + length + buffer && e.end > start - buffer)) return 'slot_taken';
  return null;
}
function slotView(start) {
  const v = { slot_start: localIso(start), spoken: spoken(start) };
  if (clientTz) v.client_time = spoken(start, clientTz);
  return v;
}
function daySlots(day, service, part, ignoreId) {
  const hours = hoursFor(day);
  if (!hours) return [];
  const found = [];
  for (let s = hours.open; s + service.duration_min * MIN <= hours.close; s += step) {
    const h = local(s).h;
    if (part === 'morning' && h >= 12) continue;
    if (part === 'afternoon' && (h < 12 || h >= 17)) continue;
    if (part === 'evening' && h < 17) continue;
    if (!slotError(s, service, ignoreId)) found.push(slotView(s));
  }
  return found;
}
function pick(slots, count) {
  if (slots.length <= count) return slots;
  const chosen = [];
  for (let i = 0; i < count; i += 1) chosen.push(slots[Math.round((i * (slots.length - 1)) / (count - 1))]);
  return chosen;
}
function nearest(fromDay, service, ignoreId, days) {
  for (let i = 0; i < days; i += 1) {
    const slots = daySlots(fromDay + i * DAY + 12 * 60 * MIN, service, 'any', ignoreId);
    if (slots.length) return pick(slots, cfg.offer_slots || 4);
  }
  return [];
}
function describe(e) {
  const p = priv(e.raw);
  const service = serviceOf(p.service_id);
  return { booking_code: p.code, service: service ? service.name : e.raw.summary || '', service_id: p.service_id || '', ...slotView(e.start) };
}
const why = { too_soon: 'Это время слишком близко или уже прошло.', too_far: 'Так далеко запись ещё не открыта.', outside_hours: 'В это время мы не работаем.',
  off_grid: 'Встречи начинаются по сетке расписания.', slot_taken: 'Это время уже занято.', bad_slot: 'Не понял время.' };
const tzNote = clientTz ? ` Время дано в часовом поясе компании (${TZ}); в client_time — по времени клиента (${clientTz}), называй его.` : ` Время — по ${TZ}.`;

// ---------- свободное время ----------
if (ctx.tool === 'check_availability') {
  const service = serviceOf(a.service_id);
  const part = ['morning', 'afternoon', 'evening'].includes(a.part_of_day) ? a.part_of_day : 'any';
  const sameDay = pick(daySlots(dayStart(ctx.date) + 12 * 60 * MIN, service, part), cfg.offer_slots || 4);
  if (sameDay.length) {
    return done({ ok: true, available: true, date: ctx.date, today: localDate(now), service: service.name, duration_min: service.duration_min, price: service.price, slots: sameDay,
      note: 'Предложи клиенту 2–3 варианта из slots. Для записи передай slot_start выбранного.' + tzNote });
  }
  const other = nearest(dayStart(ctx.date), service, null, 8);
  return done({ ok: true, available: false, date: ctx.date, today: localDate(now), service: service.name, slots: other,
    note: (other.length ? 'На этот день мест нет. Предложи ближайшие варианты из slots.' : 'Свободного времени на ближайшую неделю нет. Предложи передать запрос менеджеру.') + tzNote });
}

// ---------- новая запись ----------
if (ctx.tool === 'book_appointment') {
  const service = serviceOf(a.service_id);
  const start = parseSlot(a.slot_start);
  // id события выводится из диалога, времени и услуги: повтор того же вызова не создаст вторую запись
  const key = [a.session_id, localIso(start), service.id].join('|');
  let h1 = 2166136261, h2 = 5381;
  for (let i = 0; i < key.length; i += 1) {
    h1 = Math.imul(h1 ^ key.charCodeAt(i), 16777619) >>> 0;
    h2 = (Math.imul(h2, 33) ^ key.charCodeAt(key.length - 1 - i)) >>> 0;
  }
  const id = 'c' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let n = (h1 ^ ((h2 << 7) | (h2 >>> 25))) >>> 0;
  let code = '';
  for (let i = 0; i < 6; i += 1) { code += alphabet[n % alphabet.length]; n = Math.floor(n / alphabet.length); }

  const existing = busy.find((e) => e.id === id);
  if (existing) {
    return done({ ok: true, booking_code: priv(existing.raw).code, ...describe(existing), expose: { booking_code: priv(existing.raw).code },
      note: 'Эта запись уже создана. Повтори клиенту детали и код.' });
  }
  const problem = slotError(start, service);
  if (problem) {
    const other = nearest(dayStart(localDate(start)), service, null, 8);
    return done({ ok: false, error: problem, slots: other, note: `${why[problem]} Запись не создана. Извинись и предложи варианты из slots, затем снова спроси подтверждение.` });
  }
  const end = start + service.duration_min * MIN;
  const name = String(a.name || a.customer_name).trim().slice(0, 100);
  const email = String(a.email || a.customer_email || '').trim().slice(0, 200);
  const phone = String(a.phone || a.customer_phone || '').trim().slice(0, 40);
  const where = cfg.create_meet ? 'Google Meet (ссылка в приглашении)' : cfg.address || cfg.meeting_link || '';
  const lines = [`Клиент: ${name}`, email && `Email: ${email}`, phone && `Телефон: ${phone}`, a.chat_id && a.channel === 'telegram' ? `Telegram: ${a.customer_contact || a.chat_id}` : '',
    `Услуга: ${service.name}`, where && `Где: ${where}`, a.notes ? `Комментарий: ${String(a.notes).slice(0, 500)}` : '', `Код записи: ${code}`, 'Источник: чат-агент'].filter(Boolean);
  const body = {
    id, summary: `${service.name} — ${name}`, description: lines.join('\n'),
    start: { dateTime: new Date(start).toISOString(), timeZone: TZ }, end: { dateTime: new Date(end).toISOString(), timeZone: TZ },
    extendedProperties: { private: { code, service_id: service.id, session_id: a.session_id, channel: a.channel, chat_id: a.chat_id || '', email, phone, name, source: 'chat-agent', reminded: '' } },
  };
  if (cfg.address) body.location = cfg.address;
  const query = [];
  if (cfg.invite_customer && email) { body.attendees = [{ email, displayName: name }]; query.push('sendUpdates=all'); }
  if (cfg.create_meet) { body.conferenceData = { createRequest: { requestId: id, conferenceSolutionKey: { type: 'hangoutsMeet' } } }; query.push('conferenceDataVersion=1'); }
  const url = `${cfg.calendar_api_base}/calendars/${encodeURIComponent(cfg.calendar_id)}/events${query.length ? '?' + query.join('&') : ''}`;
  return write({ method: 'POST', url, body },
    { ok: true, booking_code: code, service: service.name, ...slotView(start), price: service.price, where,
      invite_sent: Boolean(cfg.invite_customer && email), expose: { booking_code: code },
      note: `Запись создана. Назови клиенту услугу, день и время, место встречи и код записи ${code} — он нужен для переноса и отмены.` + tzNote },
    ['🗓 Новая запись', spoken(start)].concat(lines).join('\n'));
}

// ---------- поиск, перенос, отмена ----------
const code = String(a.booking_code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const booking = busy.find((e) => priv(e.raw).code === code && e.end > now);
if (!booking) {
  return done({ ok: false, error: 'booking_not_found', note: 'Предстоящей записи с таким кодом нет. Попроси клиента проверить код в сообщении с подтверждением.' });
}
const info = describe(booking);
const eventUrl = `${cfg.calendar_api_base}/calendars/${encodeURIComponent(cfg.calendar_id)}/events/${encodeURIComponent(booking.id)}`;
const sendUpdates = cfg.invite_customer && priv(booking.raw).email ? '?sendUpdates=all' : '';

if (ctx.tool === 'find_booking') return done({ ok: true, booking: info, note: 'Назови клиенту услугу, день и время записи.' + tzNote });

if (ctx.tool === 'cancel_booking') {
  const late = cfg.cancel_min_hours && (booking.start - now) / (60 * MIN) < cfg.cancel_min_hours;
  return write({ method: 'PATCH', url: eventUrl + sendUpdates, body: { status: 'cancelled' } },
    { ok: true, cancelled: info, late_cancellation: Boolean(late), expose: { cancelled_code: code },
      note: 'Запись отменена. Подтверди это клиенту' + (late && cfg.late_cancel_note ? '. ' + cfg.late_cancel_note : '') + ' и предложи записаться на другое время.' },
    ['❌ Отмена записи', info.spoken, info.service, `Код: ${code}`, a.reason ? `Причина: ${a.reason}` : ''].filter(Boolean).join('\n'));
}

// reschedule_booking
const service = serviceOf(info.service_id) || { id: info.service_id, name: info.service, duration_min: Math.round((booking.end - booking.start) / MIN) };
const start = parseSlot(a.new_slot_start);
const problem = isNaN(start) ? 'bad_slot' : slotError(start, service, booking.id);
if (problem) {
  const other = isNaN(start) ? [] : nearest(dayStart(localDate(start)), service, booking.id, 8);
  return done({ ok: false, error: problem, slots: other, note: `${why[problem]} Запись не перенесена, прежнее время сохранено. Предложи варианты из slots.` });
}
const end = start + service.duration_min * MIN;
return write({ method: 'PATCH', url: eventUrl + sendUpdates, body: {
  start: { dateTime: new Date(start).toISOString(), timeZone: TZ }, end: { dateTime: new Date(end).toISOString(), timeZone: TZ },
  extendedProperties: { private: { ...priv(booking.raw), reminded: '' } },
} }, { ok: true, booking_code: code, service: service.name, ...slotView(start), previous: info.spoken, expose: { booking_code: code },
  note: 'Запись перенесена. Назови клиенту новые день и время; код записи прежний.' + tzNote },
['🔁 Перенос записи', `Было: ${info.spoken}`, `Стало: ${spoken(start)}`, service.name, `Код: ${code}`].join('\n'));
