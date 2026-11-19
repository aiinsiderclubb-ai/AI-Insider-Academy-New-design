// Pick Due: по каждой записи — пора ли напоминать. Одно напоминание за раз; отправленные отмечаются в событии.
// @include text.js
const { config: cfg } = $('Config').first().json;
// @include time.js
const feed = $input.first().json || {};
if (feed.error) return [];
const now = nowMs();
const hours = [...(cfg.reminder_hours || [])].sort((x, y) => y - x);
const out = [];
for (const e of feed.items || []) {
  const p = (e.extendedProperties && e.extendedProperties.private) || {};
  if (e.status === 'cancelled' || p.source !== 'chat-agent' || !p.code || !e.start || !e.start.dateTime) continue;
  const start = Date.parse(e.start.dateTime);
  const left = (start - now) / (60 * MIN);
  if (left <= 0) continue;
  const sent = String(p.reminded || '').split(',').filter(Boolean);
  const due = hours.filter((h) => left <= h && !sent.includes('h' + h));
  if (!due.length) continue;
  const marks = [...new Set([...sent, ...due.map((h) => 'h' + h)])].join(',');
  const when = spoken(start);
  const where = e.hangoutLink || (cfg.create_meet ? '' : cfg.address || cfg.meeting_link || '');
  const text = [`Напоминаем о записи: ${String(e.summary || '').split(' — ')[0]}`, `Когда: ${when} (${TZ})`, where && `Где: ${where}`,
    `Код записи: ${p.code}. Перенести или отменить — напишите нам с этим кодом.`].filter(Boolean).join('\n');
  let via = 'none';
  if (p.channel === 'telegram' && p.chat_id) via = 'telegram';
  else if (cfg.email_reminders && p.email) via = 'email';
  out.push({ json: {
    via, chat_id: p.chat_id, email: p.email, subject: `Напоминание: ${when}`, text, text_html: escapeHtml(text), code: p.code,
    patch: { url: `${cfg.calendar_api_base}/calendars/${encodeURIComponent(cfg.calendar_id)}/events/${encodeURIComponent(e.id)}`,
      body: { extendedProperties: { private: { ...p, reminded: marks } } } },
  } });
}
return out;
