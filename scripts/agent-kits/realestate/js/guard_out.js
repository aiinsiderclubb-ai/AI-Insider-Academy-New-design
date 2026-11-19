// Guard Out: проверяет ответ модели до отправки клиенту.
// @include text.js
const config = $('Config').first().json.config;
const g = $('Guard In').first().json;
const result = $input.first().json;
const store = $getWorkflowStaticData('global');
const now = Date.now();

const steps = Array.isArray(result.intermediateSteps) ? result.intermediateSteps : [];
const tools = steps.map((s) => ({ name: s.action?.tool ?? '', input: s.action?.toolInput ?? {} }));
const used = new Set(tools.map((t) => t.name));
const flags = [...(g.flags || [])];

function observation(name) {
  const step = [...steps].reverse().find((s) => s.action?.tool === name);
  if (!step) return null;
  let o = step.observation;
  if (typeof o === 'string') {
    try { o = JSON.parse(o); } catch { return { text: o }; }
  }
  if (Array.isArray(o)) o = o[0]?.json ?? o[0];
  if (o && typeof o.response === 'string') {
    try { o = JSON.parse(o.response); } catch { /* keep */ }
  }
  return o;
}

let reply = String(result.output ?? '').trim();
let alert_html = '';
// Передача засчитывается, только если команда действительно получила уведомление.
const handoffOk = used.has('handoff_to_human') && observation('handoff_to_human')?.ok !== false;
let handoff = handoffOk;
const safe = `Этот вопрос лучше решит риелтор — я передал ему ваш запрос. Ответим в рабочее время: ${config.support_hours}.`;

function forceHandoff(reason) {
  handoff = true;
  const c = g.customer || {};
  alert_html = [
    `<b>⚠️ ${reason}</b>`,
    `Канал: ${g.channel === 'telegram' ? 'Telegram' : g.source || 'сайт'} · <code>${escapeHtml(g.session_id)}</code>`,
    c.name && `Имя: ${escapeHtml(c.name)}`,
    c.email && `Email: ${escapeHtml(c.email)}`,
    c.phone && `Телефон: ${escapeHtml(c.phone)}`,
    c.telegram && `Telegram: ${escapeHtml(c.telegram)}`,
    '',
    `<blockquote>${escapeHtml(g.text)}</blockquote>`,
  ].filter(Boolean).join('\n');
}

if (!reply) {
  flags.push('empty_reply');
  reply = safe;
  if (!handoffOk) forceHandoff('Агент не смог ответить');
}
if (config.canary && reply.includes(config.canary)) {
  flags.push('prompt_leak');
  reply = 'Я не могу этим поделиться. Чем помочь по вашему вопросу?';
}
const forbidden = (config.forbidden || []).map((p) => new RegExp(p, 'iu'));
if (forbidden.some((r) => r.test(reply))) {
  flags.push('forbidden_promise');
  reply = safe;
  if (!handoffOk) forceHandoff('Агент пытался пообещать то, что решает только риелтор или владелец');
}
// Объекты: агент может называть только номера, которые вернули инструменты в этом диалоге.
const sessions = (store.sessions = store.sessions || {});
const entry = (sessions[g.session_id] = sessions[g.session_id] || { hits: [], handoff_until: 0 });
const seen = new Set(entry.listings || []);
for (const s of steps) {
  const o = typeof s.observation === 'string' ? s.observation : JSON.stringify(s.observation ?? '');
  for (const m of o.matchAll(/"listing_id":"([^"]+)"/g)) seen.add(m[1].toUpperCase());
}
if (g.listing_ref) seen.add(String(g.listing_ref).toUpperCase());
entry.listings = [...seen].slice(-50);
const mentioned = [...new Set((reply.match(/\b[A-ZА-Я]{1,4}-\d{2,6}\b/g) || []).map((x) => x.toUpperCase()))]
  .filter((id) => !/^RL-|^T-/.test(id));
const invented = mentioned.filter((id) => !seen.has(id));
if (invented.length) {
  flags.push('unknown_listing');
  reply = `Уточню наличие у риелтора и вернусь с точной информацией. Рабочее время: ${config.support_hours}.`;
  if (!handoffOk) forceHandoff(`Агент назвал объект, которого нет в выдаче: ${invented.join(', ')}`);
}
const listing_ids = mentioned.filter((id) => seen.has(id));

if (reply.length > 3500) {
  reply = reply.slice(0, 3500).replace(/\s+\S*$/, '') + '…';
  flags.push('reply_cut');
}

if (handoff) {
  const s = (store.sessions = store.sessions || {});
  const entry = (s[g.session_id] = s[g.session_id] || { hits: [], handoff_until: 0 });
  entry.handoff_until = now + config.handoff_pause_minutes * 60000;
}

// Сбой таблицы или Telegram внутри инструмента: клиенту агент уже ответил, команде — сигнал.
const broken = ['update_lead', 'search_listings', 'check_viewing_slots', 'book_viewing', 'handoff_to_human']
  .map((name) => [name, observation(name)])
  .filter(([, o]) => o && o.service_error);
if (broken.length) {
  flags.push('service_error');
  const lines = broken.map(([name, o]) => `${name}: ${escapeHtml(o.service_error || o.note)}`);
  alert_html = (alert_html ? alert_html + '\n\n' : '') + `<b>⚠️ Ошибка инструмента</b>\n${lines.join('\n')}\n<code>${escapeHtml(g.session_id)}</code>`;
}


return [{ json: {
  channel: g.channel,
  session_id: g.session_id,
  customer: g.customer,
  text: g.text,
  reply,
  reply_html: escapeHtml(reply),
  handoff,
  alert_html,
  tools,
  flags,
  listing_ids,
  debug: Boolean(g.debug),
} }];
