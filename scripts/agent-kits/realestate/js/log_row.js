// Log Row: строка для листа Log и ответ вебхуку.
const d = $('Guard Out').isExecuted ? $('Guard Out').first().json : $('Canned').first().json;
const row = [
  new Date().toISOString(),
  d.session_id,
  d.channel,
  d.text,
  d.reply,
  d.tools.map((t) => t.name).join(', '),
  d.handoff ? 'да' : '',
  d.flags.join(', '),
  (d.listing_ids || []).join(', '),
];
const response = { reply: d.reply, handoff: d.handoff, session_id: d.session_id.replace(/^web:/, '') };
if (d.debug) {
  response.tools = d.tools;
  response.flags = d.flags;
}
return [{ json: { ...d, row, response } }];
