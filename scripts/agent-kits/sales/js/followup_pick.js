// Pick Follow-ups: кому из замолчавших лидов пора написать. Правила остановки — здесь, в коде.
// @include text.js
// @include lead_cols.js
const { config: cfg } = $('Config').first().json;
const feed = $input.first().json;
if (!cfg.followup_enabled || feed.error) return [];
const ranges = feed.valueRanges || [];
const leads = sheetRows(ranges[0]?.values);
const optout = sheetRows(ranges[1]?.values);
const log = sheetRows(ranges[2]?.values);
const names = Object.fromEntries(sheetRows(ranges[3]?.values).map((p) => [p.id, p.name]));
const now = cfg.now_override ? Date.parse(cfg.now_override) : Date.now();

// Тихие часы и дни — по часовому поясу компании
const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: cfg.timezone, hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' })
  .formatToParts(new Date(now)).map((p) => [p.type, p.value]));
const minutes = Number(parts.hour) * 60 + Number(parts.minute);
const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const qf = toMin(cfg.followup_quiet_from);
const qt = toMin(cfg.followup_quiet_to);
const quiet = qf > qt ? minutes >= qf || minutes < qt : minutes >= qf && minutes < qt;
const day = parts.weekday.toLowerCase().slice(0, 3);
if (quiet || !(cfg.followup_weekdays || []).includes(day)) return [];

const stopped = new Set();
for (const o of optout) for (const k of [o.session_id, o.chat_id, o.contact]) if (k) stopped.add(String(k).toLowerCase());
const lastSeen = {};
for (const l of log) {
  const t = Date.parse(l.time);
  if (l.session_id && !isNaN(t) && (!lastSeen[l.session_id] || t > lastSeen[l.session_id])) lastSeen[l.session_id] = t;
}

const delays = cfg.followup_delays_hours || [];
const touchCol = colLetter(LEAD_COLS.indexOf('touches'));
const out = [];
for (const lead of leads) {
  if (out.length >= cfg.followup_max_per_run) break;
  if (!(cfg.followup_stages || []).includes(lead.stage)) continue;
  if ([lead.session_id, lead.chat_id, lead.email, lead.phone].some((k) => k && stopped.has(String(k).toLowerCase()))) continue;
  const touches = Number(lead.touches || 0);
  if (touches >= delays.length) continue;
  const last = Math.max(lastSeen[lead.session_id] || 0, Date.parse(lead.last_touch_at) || 0, Date.parse(lead.created) || 0);
  if (!last || now - last < delays[touches] * 3600000) continue;
  let via = '';
  if (lead.channel === 'telegram' && lead.chat_id) via = 'telegram';
  else if (cfg.email_followups && lead.email) via = 'email';
  if (!via) continue;
  const product = names[lead.product_id] || 'наше предложение';
  const text = String(cfg.followup_messages[touches] || cfg.followup_messages[cfg.followup_messages.length - 1])
    .replace(/\{name\}/g, lead.name || 'Здравствуйте').replace(/\{product\}/g, product)
    .replace(/^Здравствуйте, здравствуйте!/, 'Здравствуйте!');
  out.push({ json: {
    via, chat_id: lead.chat_id, email: lead.email, text, text_html: escapeHtml(text), subject: `${cfg.company}: ${product}`,
    session_id: lead.session_id, touch: touches + 1,
    update: { path: encodeURIComponent(`Leads!${touchCol}${lead._row}`) + '?valueInputOption=RAW', body: { values: [[String(touches + 1), new Date(now).toISOString()]] } },
  } });
}
return out;
