// Log Row: строка для листа Log (с трассой агентов) и ответ вебхуку.
const d = $('Guard Out').isExecuted ? $('Guard Out').first().json : $('Canned').first().json;
const row = [
  new Date().toISOString(),
  d.session_id,
  d.channel,
  d.text,
  d.reply,
  d.agents.join(', '),
  d.handoff ? 'да' : '',
  d.flags.join(', '),
  d.trace.length ? JSON.stringify(d.trace).slice(0, 5000) : '',
];
const response = { reply: d.reply, handoff: d.handoff, session_id: d.session_id.replace(/^(web|team):/, '') };
if (d.debug) {
  response.tools = d.trace.map((t) => ({ name: t.agent, input: { task: t.task } }));
  response.trace = d.trace;
  response.flags = d.flags;
}
return [{ json: { ...d, row, response } }];
