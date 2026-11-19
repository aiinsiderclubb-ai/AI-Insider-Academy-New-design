// Slots: свободные окна риелтора считает код, а не модель.
// @include re.js
const { config } = $('Config').first().json;
const plan = $('Slot Plan').first().json;
if (!plan.ok) return [{ json: plan.result }];
const fb = $input.first().json;
if (fb.error) {
  return [{ json: { ok: false, service_error: String(fb.error.message || fb.error).slice(0, 300), note: 'Календарь не ответил. Не называй время. Предложи, что риелтор перезвонит и договорится (handoff_to_human).' } }];
}
const cal = (fb.calendars || {})[plan.calendar_id] || {};
if (cal.errors && cal.errors.length) {
  return [{ json: { ok: false, service_error: `календарь ${plan.calendar_id}: ${JSON.stringify(cal.errors).slice(0, 200)}`, note: 'Календарь риелтора недоступен. Не называй время, передай запрос человеку (handoff_to_human).' } }];
}
const now = Date.now();
let slots = freeSlots(config, cal.busy || [], plan.from, plan.days, now, config.offer_slots);
let nearest = false;
if (!slots.length && plan.days === 1) {
  slots = freeSlots(config, cal.busy || [], addDays(plan.from, 1), 7, now, config.offer_slots);
  nearest = true;
}
return [{ json: {
  ok: true,
  listing_id: plan.listing_id,
  agent: plan.agent_name,
  available: slots.length > 0 && !nearest,
  slots: slots.map((ms) => ({ slot_start: localIso(ms, config.timezone), spoken: spoken(ms, config.timezone) })),
  note: !slots.length
    ? 'Свободного времени в ближайшую неделю нет. Предложи, что риелтор свяжется (handoff_to_human).'
    : (nearest ? 'На этот день мест нет — это ближайшие варианты, скажи об этом. ' : '')
      + 'Предложи клиенту эти варианты. Когда он выберет время, повтори объект, адрес, дату и время и спроси явное подтверждение. Только после «да» вызывай book_viewing с slot_start из этого списка.',
} }];
