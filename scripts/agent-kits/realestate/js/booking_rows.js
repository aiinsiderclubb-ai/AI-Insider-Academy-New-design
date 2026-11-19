// Booking Rows: строка в Viewings, обновление карточки лида и сообщение риелтору.
// Колонки Viewings: created | viewing_id | listing_id | slot_start | agent_id | name | phone | session_id | address | status
// @include text.js
// @include re.js
const { config, input } = $('Config').first().json;
const plan = $('Booking Plan').first().json;
const event = $input.first().json;
const now = new Date().toISOString();
const viewing = [now, event.id || plan.booking_key, plan.listing.listing_id, plan.slot_local, plan.agent_id, plan.name, plan.phone, input.session_id, plan.listing.address, 'scheduled'];
const base = plan.lead || { created: now, lead_id: 'RL-' + Date.now().toString(36).toUpperCase().slice(-6), session_id: input.session_id, channel: input.channel,
  source: input.source || input.channel, follow_ups: '0', currency: config.currency };
const ids = [...new Set([...String(base.listing_ids || '').split(',').map((x) => x.trim()).filter(Boolean), plan.listing.listing_id])];
const lead = { ...base, name: base.name || plan.name, phone: base.phone || plan.phone, agent_id: plan.agent_id, stage: 'viewing_booked',
  viewing_id: event.id || plan.booking_key, listing_ids: ids.join(', '), last_contact: now };
const when = spoken(Date.parse(plan.start), config.timezone);
const alert_html = [
  `<b>📅 Просмотр записан</b> → ${escapeHtml(plan.agent_name)}`,
  `${escapeHtml(when)}`,
  `Объект: <b>${escapeHtml(plan.listing.listing_id)}</b> · ${escapeHtml(plan.listing.address)}`,
  `Клиент: ${escapeHtml(plan.name || '—')} · ${escapeHtml(plan.phone)}`,
  base.budget_max ? `Бюджет: до ${escapeHtml(base.budget_max)} ${escapeHtml(base.currency || '')} · Ипотека: ${escapeHtml(base.mortgage || '?')}` : '',
  `<code>${escapeHtml(input.session_id)}</code>`,
].filter(Boolean).join('\n');
return [{ json: {
  viewing,
  lead_update: { valueInputOption: 'RAW', data: [{ range: leadRange(plan.lead_row), values: [leadValues(lead)] }] },
  alert_html,
  chat_id: plan.agent_chat,
  spoken: when,
} }];
