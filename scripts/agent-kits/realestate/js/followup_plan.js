// Plan Follow-ups: кому напомнить о себе и какие просмотры завтра. Без модели — по правилам.
// @include text.js
// @include re.js
const { config } = $('Config').first().json;
const res = $input.first().json;
if (res.error) {
  return [{ json: { ok: false, updates: null, messages: [], digest_html: `<b>⚠️ Follow-up не выполнен</b>\nТаблица недоступна: ${escapeHtml(String(res.error.message || res.error).slice(0, 300))}` } }];
}
const ranges = res.valueRanges || [];
const tab = (name) => sheetRows((ranges.find((r) => decodeURIComponent(r.range || '').replace(/'/g, '').startsWith(name + '!')) || {}).values);
const now = Date.now();
const tz = config.timezone;
const tomorrow = addDays(tzParts(now, tz).date, 1);
const agentName = (id) => ((config.agents || []).find((a) => a.id === id) || {}).name || 'без риелтора';

const data = [];
const messages = [];
const calls = [];
for (const lead of tab('Leads')) {
  if (!['new', 'qualified', 'matched'].includes(lead.stage)) continue;
  const n = Number(lead.follow_ups || 0);
  if (n >= config.follow_up_days.length) continue;
  const quiet = (now - Date.parse(lead.last_contact || lead.created)) / 86400000;
  if (!(quiet >= config.follow_up_days[n])) continue;
  const next = { ...lead, follow_ups: String(n + 1), last_contact: new Date(now).toISOString() };
  data.push({ range: leadRange(lead._row), values: [leadValues(next)] });
  if (String(lead.session_id).startsWith('tg:')) {
    messages.push({ chat_id: lead.session_id.slice(3), text: escapeHtml(config.follow_up_texts[n] || config.follow_up_texts.at(-1)) });
  } else {
    calls.push(`• ${escapeHtml(lead.name || 'Без имени')} · ${escapeHtml(lead.phone || lead.email || '—')} · ${escapeHtml(lead.area || '')} до ${escapeHtml(lead.budget_max || '?')} → ${escapeHtml(agentName(lead.agent_id))} (напоминание ${n + 1})`);
  }
}

const viewings = tab('Viewings').filter((v) => v.status === 'scheduled' && String(v.slot_start).startsWith(tomorrow));
const reminders = [];
for (const v of viewings) {
  const time = String(v.slot_start).slice(11, 16);
  reminders.push(`• ${time} · ${escapeHtml(v.listing_id)} · ${escapeHtml(v.address)} · ${escapeHtml(v.name || '—')} ${escapeHtml(v.phone)} → ${escapeHtml(agentName(v.agent_id))}`);
  if (String(v.session_id).startsWith('tg:')) {
    messages.push({ chat_id: v.session_id.slice(3), text: escapeHtml(`Напоминаем: завтра в ${time} просмотр по адресу ${v.address}. Если планы изменились — напишите здесь.`) });
  }
}

const parts = [];
if (calls.length) parts.push(`<b>📞 Позвонить (клиенты без Telegram)</b>\n${calls.join('\n')}`);
if (messages.length) parts.push(`Напоминаний в Telegram отправлено: ${messages.length}`);
if (reminders.length) parts.push(`<b>📅 Просмотры завтра</b>\n${reminders.join('\n')}`);
return [{ json: {
  ok: true,
  updates: data.length ? { valueInputOption: 'RAW', data } : null,
  messages,
  digest_html: parts.length ? `<b>Follow-up на сегодня</b>\n\n${parts.join('\n\n')}` : '',
} }];
