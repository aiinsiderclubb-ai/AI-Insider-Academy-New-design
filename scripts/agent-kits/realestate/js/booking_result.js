// Booking Result: что агент узнает о записи.
const plan = $('Booking Plan').first().json;
if (!plan.ok) return [{ json: plan.result }];
const decide = $('Booking Decide').first().json;
if (!decide.create) return [{ json: decide.result }];
const created = $('Create Event').first().json;
if (created.error || !$('Booking Rows').isExecuted) {
  const e = created.error || 'event not created';
  return [{ json: { ok: false, service_error: String(e.message || e).slice(0, 300), note: 'Календарь не создал запись. Не говори, что записал. Передай человеку (handoff_to_human).' } }];
}
const rows = $('Booking Rows').first().json;
return [{ json: {
  ok: true,
  viewing_id: rows.viewing[1],
  spoken: rows.spoken,
  address: plan.listing.address,
  agent: plan.agent_name,
  note: 'Запись создана, риелтор получил уведомление. Подтверди клиенту дату, время, адрес и имя риелтора; скажи, что риелтор позвонит накануне. Ничего не обещай про цену и торг.',
} }];
