// Booking Plan: проверки до записи. Главная — клиент явно сказал «да» в последнем сообщении.
// @include text.js
// @include re.js
const { config, input } = $('Config').first().json;
const res = $input.first().json;
const fail = (result) => [{ json: { ok: false, result } }];
if (res.error) return fail({ ok: false, service_error: String(res.error.message || res.error).slice(0, 300), note: 'База недоступна, запись не создана. Не говори, что записал. Передай человеку (handoff_to_human).' });

// Подтверждение берётся из сообщения клиента, а не из слов модели.
const said = norm(input.last_message);
// «Давайте в 12:30» — это выбор времени, а не согласие: такие слова здесь не считаются.
const YES = /(^|[\s,.!])(да|ага|угу|подтверждаю|подтвердить|записывай(те)?|ок(ей)?|хорошо|договорились|согласен|согласна|yes|yep|ok(ay)?|confirm(ed)?|sure)(?=$|[\s,.!])/i;
// «Да, но лучше в субботу» — согласие с условием: переспросить.
const NO = /(^|[\s,.!])(нет|не надо|не могу|не подходит|не получится|отмен\S*|друг(ое|ой) (время|день)|позже|но|лучше|а можно|вместо|no|not|cancel|but|instead)(?=$|[\s,.!])/i;
if (!YES.test(said) || NO.test(said)) {
  return fail({ ok: false, error: 'not_confirmed', note: 'Клиент ещё не подтвердил запись в последнем сообщении. Повтори объект, адрес, дату и время и спроси: «Записываю?». Вызывай book_viewing только после его «да».' });
}

const ranges = res.valueRanges || [];
const tab = (name) => sheetRows((ranges.find((r) => decodeURIComponent(r.range || '').replace(/'/g, '').startsWith(name + '!')) || {}).values);
const listing = tab('Listings').find((l) => normId(l.listing_id) === normId(input.listing_id));
if (!listing || norm(listing.status) !== 'active') return fail({ ok: false, error: 'listing_not_found', note: 'Объекта нет в базе или он снят. Запись не создана.' });
const agent = (config.agents || []).find((a) => a.id === listing.agent_id);
if (!agent || !agent.calendar_id) return fail({ ok: false, error: 'no_agent', note: 'У объекта нет риелтора с календарём. Передай человеку (handoff_to_human).' });

const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(input.slot_start || ''));
if (!m) return fail({ ok: false, error: 'bad_slot', note: 'Нужно время из ответа check_viewing_slots (поле slot_start). Сначала вызови check_viewing_slots.' });
const tz = config.timezone;
const start = zonedToMs(m[1], m[2], tz);
const now = Date.now();
const hours = config.viewing_hours[weekdayOf(m[1])];
const end = start + config.viewing_minutes * 60000;
if (!hours || start < zonedToMs(m[1], hours[0], tz) || end > zonedToMs(m[1], hours[1], tz)) {
  return fail({ ok: false, error: 'outside_hours', note: 'Это время вне часов просмотров. Возьми время из check_viewing_slots.' });
}
if (start < now + config.lead_time_minutes * 60000) return fail({ ok: false, error: 'too_soon', note: 'Слишком скоро. Возьми время из check_viewing_slots.' });
if (m[1] > addDays(tzParts(now, tz).date, config.booking_window_days)) return fail({ ok: false, error: 'too_far', note: 'Слишком далеко вперёд.' });

const leads = tab('Leads');
const lead = findLead(leads, input.session_id, input.phone || input.customer_phone);
const phoneDigits = digits(input.phone || (lead && lead.phone) || input.customer_phone);
if (phoneDigits.length < 9) return fail({ ok: false, error: 'no_phone', note: 'Для записи нужен телефон клиента: риелтор позвонит перед просмотром. Спроси телефон, затем вызови book_viewing снова.' });
const phone = '+' + phoneDigits.replace(/^0/, config.phone_country || '380');
const name = String(input.name || (lead && lead.name) || input.customer_name || '').slice(0, 100);

// Один и тот же диалог, объект и время дают одну и ту же запись — повтор не создаст вторую.
let h1 = 2166136261;
let h2 = 5381;
for (const ch of `${input.session_id}|${normId(listing.listing_id)}|${m[1]}T${m[2]}`) {
  h1 = Math.imul(h1 ^ ch.charCodeAt(0), 16777619) >>> 0;
  h2 = ((h2 * 33) ^ ch.charCodeAt(0)) >>> 0;
}
const booking_key = 'rv' + h1.toString(32) + h2.toString(32);

const startIso = new Date(start).toISOString();
const endIso = new Date(end).toISOString();
const dayStart = new Date(zonedToMs(m[1], '00:00', tz)).toISOString();
const dayEnd = new Date(zonedToMs(addDays(m[1], 1), '00:00', tz)).toISOString();
return [{ json: {
  ok: true,
  booking_key,
  calendar_id: agent.calendar_id,
  agent_id: agent.id,
  agent_name: agent.name,
  agent_chat: agent.chat_id || config.team_chat_id,
  listing,
  slot_local: `${m[1]}T${m[2]}`,
  start: startIso,
  end: endIso,
  day: m[1],
  name,
  phone,
  lead_row: lead ? lead._row : leads.length + 2,
  lead: lead || null,
  freebusy: { timeMin: dayStart, timeMax: dayEnd, timeZone: tz, items: [{ id: agent.calendar_id }] },
  event: {
    id: booking_key,
    summary: `Просмотр ${listing.listing_id}: ${name || 'клиент'}`,
    location: listing.address,
    description: [`Клиент: ${name || '—'}`, `Телефон: ${phone}`, `Объект: ${listing.listing_id} — ${listing.address}`, listing.url && `Ссылка: ${listing.url}`, `Диалог: ${input.session_id}`].filter(Boolean).join('\n'),
    start: { dateTime: startIso, timeZone: tz },
    end: { dateTime: endIso, timeZone: tz },
    extendedProperties: { private: { booking_key, session_id: input.session_id, listing_id: listing.listing_id } },
  },
} }];
