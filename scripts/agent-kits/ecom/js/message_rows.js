// Message Rows: что отправлено — в лист Messages одной записью.
const composed = $('__COMPOSE__').all().map((i) => i.json);
const results = $input.all().map((i) => i.json);
const now = new Date().toISOString();
const rows = composed.map((m, i) => {
  const err = results[i]?.error;
  return [now, m.kind, m.ref, m.email, String(m.step), err ? 'failed' : 'sent', m.subject,
    err ? String(err.message || err).slice(0, 200) : (m.kind === 'cart' ? (m.ai_used ? 'ai' : `template:${m.ai_rejected}`) : '')];
});
const failed = rows.filter((r) => r[5] === 'failed').length;
return [{ json: { rows, sent: rows.length - failed, failed } }];
