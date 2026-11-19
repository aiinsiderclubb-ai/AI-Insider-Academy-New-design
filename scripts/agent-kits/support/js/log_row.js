// Log Row: строка для листа Log и ответ вебхуку.
const d = $input.first().json;
const row = [
  new Date().toISOString(),
  d.session_id,
  d.channel,
  d.text,
  d.reply,
  d.tools.map((t) => t.name).join(', '),
  d.handoff ? 'да' : '',
  d.flags.join(', '),
  d.ticket_id,
];
const response = { reply: d.reply, handoff: d.handoff, session_id: d.session_id.replace(/^web:/, '') };
if (d.ticket_id) response.ticket_id = d.ticket_id;
if (d.debug) {
  response.tools = d.tools;
  response.flags = d.flags;
}
return [{ json: { ...d, row, response } }];
