// Finish: результат записи в календарь.
const d = $('Decide').first().json;
const res = $input.first().json;
if (res.error) {
  return [{ json: { result: { ok: false, service_error: String(res.error.message || res.error).slice(0, 300),
    note: 'Календарь не принял изменение. Ничего не обещай: извинись и предложи передать запрос менеджеру (handoff_to_human).' }, team_message: '' } }];
}
const result = { ...d.on_success };
if (res.hangoutLink) { result.where = res.hangoutLink; result.note += ` Ссылка на встречу: ${res.hangoutLink}.`; }
return [{ json: { result, team_message: d.team_message } }];
