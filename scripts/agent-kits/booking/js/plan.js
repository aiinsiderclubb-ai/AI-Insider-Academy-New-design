// Plan: проверяет вызов инструмента и решает, что прочитать из календаря.
const { config: cfg, input: a } = $('Config').first().json;
// @include time.js

const done = (result) => [{ json: { tool: a.tool, needs_calendar: false, result } }];
const read = (fromMs, toMs, extra) => [{ json: { tool: a.tool, needs_calendar: true, args: a,
  http: { url: eventsUrl(Object.assign({ timeMin: new Date(fromMs).toISOString(), timeMax: new Date(toMs).toISOString(),
    singleEvents: 'true', orderBy: 'startTime', maxResults: '2500' }, extra || {})) } } }];

const now = nowMs();
const windowEnd = now + (cfg.booking_window_days || 30) * DAY;
const service = (cfg.services || []).find((s) => s.id === a.service_id);
const code = String(a.booking_code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Согласие клиента проверяет код, а не модель: последнее сообщение должно быть «да».
function confirmed() {
  const text = String(a.last_message || '').trim();
  const yes = (cfg.confirm_words || []).some((p) => new RegExp(p, 'iu').test(text));
  const no = (cfg.deny_words || []).some((p) => new RegExp(p, 'iu').test(text));
  return yes && !no;
}
const needYes = (what) => done({ ok: false, error: 'not_confirmed',
  note: `Клиент ещё не подтвердил ${what}. Повтори ему детали (услуга, день, время, часовой пояс) одним сообщением и спроси «Подтверждаете?». Вызывай инструмент снова только после его «да».` });

if (a.tool === 'list_services') {
  return done({ ok: true, timezone: cfg.timezone, services: (cfg.services || []).map((s) => ({ service_id: s.id, name: s.name, duration_min: s.duration_min, price: s.price, description: s.description || '' })),
    note: 'Назови услуги коротко. Цены — только эти.' });
}

if (a.tool === 'check_availability') {
  if (!service) return done({ ok: false, error: 'unknown_service', note: 'Нет такой услуги. Вызови list_services и возьми service_id оттуда.' });
  const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const today = dayStart(localDate(now));
  const raw = String(a.date || '').trim().toLowerCase();
  let date = raw;
  if (!raw || raw === 'today') date = localDate(now);
  else if (raw === 'tomorrow') date = localDate(today + DAY + 12 * 60 * MIN);
  else if (/^\+\d{1,2}$/.test(raw)) date = localDate(today + Number(raw.slice(1)) * DAY + 12 * 60 * MIN);
  else if (names.includes(raw)) date = localDate(today + ((names.indexOf(raw) - local(now).dow + 7) % 7) * DAY + 12 * 60 * MIN);
  const start = dayStart(date);
  if (isNaN(start)) return done({ ok: false, error: 'bad_date', note: 'Дата: YYYY-MM-DD, today, tomorrow, +N или день недели по-английски (mon…sun).' });
  if (start + DAY <= now) return done({ ok: false, error: 'date_in_past', note: `Эта дата прошла. Сегодня ${localDate(now)}.` });
  if (start > windowEnd) return done({ ok: false, error: 'too_far', note: `Запись открыта до ${localDate(windowEnd)}.` });
  const out = read(Math.max(start, now), Math.min(start + 8 * DAY, windowEnd + DAY));
  out[0].json.date = date;
  return out;
}

if (a.tool === 'book_appointment') {
  if (!service) return done({ ok: false, error: 'unknown_service', note: 'Нет такой услуги. Вызови list_services.' });
  const slot = parseSlot(a.slot_start);
  if (isNaN(slot)) return done({ ok: false, error: 'bad_slot', note: 'Возьми slot_start из результата check_availability.' });
  const email = String(a.email || a.customer_email || '').trim();
  const phone = String(a.phone || a.customer_phone || '').trim();
  if (!email && !phone && a.channel !== 'telegram') {
    return done({ ok: false, error: 'no_contact', note: 'Нужен email или телефон клиента, чтобы прислать подтверждение. Спроси его.' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return done({ ok: false, error: 'bad_email', note: 'Email выглядит неверно. Уточни его у клиента.' });
  if (!String(a.name || a.customer_name || '').trim()) return done({ ok: false, error: 'no_name', note: 'Спроси, как зовут клиента.' });
  if (!confirmed()) return needYes('запись');
  return read(dayStart(localDate(slot)), dayStart(localDate(slot)) + DAY);
}

if (['find_booking', 'reschedule_booking', 'cancel_booking'].includes(a.tool)) {
  if (code.length < 6) return done({ ok: false, error: 'no_code', note: 'Спроси код записи: 6 символов из сообщения с подтверждением.' });
  if (a.tool !== 'find_booking' && !confirmed()) return needYes(a.tool === 'cancel_booking' ? 'отмену' : 'перенос');
  if (a.tool === 'reschedule_booking') return read(now - 60 * MIN, windowEnd + DAY); // и запись, и занятость нового дня
  return read(now - 60 * MIN, windowEnd + DAY, { privateExtendedProperty: 'code=' + code });
}

return done({ ok: false, error: 'unknown_tool', note: `Инструмента ${a.tool} нет.` });
