// Slot Plan: какой объект, чей календарь и за какие дни смотреть занятость.
// @include text.js
// @include re.js
const { config, input } = $('Config').first().json;
const res = $input.first().json;
const fail = (result) => [{ json: { ok: false, result } }];
if (res.error) return fail({ ok: false, service_error: String(res.error.message || res.error).slice(0, 300), note: 'База объектов недоступна. Предложи, что риелтор свяжется для записи (handoff_to_human).' });
const listing = sheetRows(res.values).find((l) => normId(l.listing_id) === normId(input.listing_id));
if (!listing) return fail({ ok: false, error: 'listing_not_found', note: 'Такого объекта нет в базе. Не придумывай: возьми номер из результатов search_listings.' });
if (norm(listing.status) !== 'active') return fail({ ok: false, error: 'listing_inactive', note: 'Объект уже снят с продажи или аренды. Скажи клиенту и предложи похожие (search_listings).' });
const agent = (config.agents || []).find((a) => a.id === listing.agent_id);
if (!agent || !agent.calendar_id) return fail({ ok: false, error: 'no_agent', note: 'У объекта нет риелтора с календарём. Передай запрос на просмотр человеку (handoff_to_human).' });

const now = Date.now();
const today = tzParts(now, config.timezone).date;
const when = resolveDate(input.date, today);
if (!when) return fail({ ok: false, error: 'bad_date', note: 'Не понял дату. Спроси у клиента день: сегодня, завтра, день недели или число.' });
if (when.from < today) return fail({ ok: false, error: 'date_in_past', note: 'Эта дата уже прошла. Спроси другой день.' });
if (when.from > addDays(today, config.booking_window_days)) return fail({ ok: false, error: 'too_far', note: `Записываем не дальше чем на ${config.booking_window_days} дней вперёд. Предложи ближе.` });

const timeMin = new Date(zonedToMs(when.from, '00:00', config.timezone)).toISOString();
const timeMax = new Date(zonedToMs(addDays(when.from, when.days + 7), '00:00', config.timezone)).toISOString();
return [{ json: {
  ok: true,
  listing_id: listing.listing_id,
  address: listing.address,
  agent_id: agent.id,
  agent_name: agent.name,
  calendar_id: agent.calendar_id,
  from: when.from,
  days: when.days,
  freebusy: { timeMin, timeMax, timeZone: config.timezone, items: [{ id: agent.calendar_id }] },
} }];
