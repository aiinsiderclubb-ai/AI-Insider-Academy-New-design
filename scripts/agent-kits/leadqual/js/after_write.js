// After Write: если CRM не приняла строку — лид целиком уходит в чат отдела, чтобы не потеряться.
const { config } = $('Config').first().json;
const r = $('Route').first().json;
const res = $input.first().json;
const notify = [...r.notify];
if (res.error) {
  notify.push({ chat_id: config.team_chat_id, text: `<b>⚠️ Лид не записан в CRM</b>\n${String(res.error.message || res.error).slice(0, 200).replace(/</g, '&lt;')}\n\n` + (r.notify[0]?.text || r.response.lead_id) });
  if (r.debug) r.response.crm_error = true;
}
return [{ json: { ...r, notify } }];
