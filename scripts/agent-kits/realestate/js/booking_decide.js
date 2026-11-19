// Booking Decide: запись уже есть? время ещё свободно?
// @include re.js
const { config } = $('Config').first().json;
const plan = $('Booking Plan').first().json;
const existing = $('Find Existing').first().json;
const fb = $input.first().json;
if (existing.error || fb.error) {
  const e = existing.error || fb.error;
  return [{ json: { create: false, result: { ok: false, service_error: String(e.message || e).slice(0, 300), note: 'Календарь не ответил, запись не создана. Не говори, что записал. Передай человеку (handoff_to_human).' } } }];
}
const same = (existing.items || []).find((e) => e.status !== 'cancelled');
if (same) {
  return [{ json: { create: false, result: { ok: true, already: true, viewing_id: same.id, spoken: spoken(Date.parse(plan.start), config.timezone),
    address: plan.listing.address, agent: plan.agent_name, note: 'Эта запись уже создана — повтор не нужен. Подтверди клиенту дату, время и адрес.' } } }];
}
const busy = ((fb.calendars || {})[plan.calendar_id] || {}).busy || [];
const buf = config.buffer_minutes * 60000;
const s = Date.parse(plan.start);
const e = Date.parse(plan.end);
if (busy.some((b) => s < Date.parse(b.end) + buf && e > Date.parse(b.start) - buf)) {
  const alt = freeSlots(config, busy, plan.day, 1, Date.now(), config.offer_slots);
  return [{ json: { create: false, result: { ok: false, error: 'slot_taken', slots: alt.map((ms) => ({ slot_start: localIso(ms, config.timezone), spoken: spoken(ms, config.timezone) })),
    note: 'Это время только что заняли. Запись не создана. Предложи варианты из slots (или другой день через check_viewing_slots) и снова спроси подтверждение.' } } }];
}
return [{ json: { create: true } }];
