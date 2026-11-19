// Log Row: строка для листа Log, строка для листа Gaps (если ответа в документах нет) и ответ вебхуку.
const d = $('Guard Out').isExecuted ? $('Guard Out').first().json : $('Canned').first().json;
const time = new Date().toISOString();
const row = [time, d.session_id, d.channel, d.text, d.reply, d.tools.map((t) => t.name).join(', '), d.handoff ? 'да' : '', d.flags.join(', '), (d.sources || []).map((s) => s.code).join(', ')];
const gap = d.flags.includes('not_found') ? [time, d.text, (d.queries || []).join(' | '), d.handoff ? 'передан команде' : '', d.session_id] : null;
const response = { reply: d.reply, handoff: d.handoff, session_id: d.session_id.replace(/^web:/, ''), sources: d.sources || [] };
if (d.debug) {
  response.tools = d.tools;
  response.flags = d.flags;
}
return [{ json: { ...d, row, gap, response } }];
