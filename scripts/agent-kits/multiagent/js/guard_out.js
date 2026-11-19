// Guard Out: проверяет ответ оркестратора, пишет трассу агентов и считает их лимиты.
// @include text.js
const config = $('Config').first().json.config;
const g = $('Guard In').first().json;
const result = $input.first().json;
const store = $getWorkflowStaticData('global');
const now = Date.now();
const AGENTS = ['email_triage_agent', 'leads_agent', 'support_agent', 'reports_agent'];

const steps = Array.isArray(result.intermediateSteps) ? result.intermediateSteps : [];
const flags = [...(g.flags || [])];

function parse(o) {
  if (typeof o === 'string') {
    try { o = JSON.parse(o); } catch { return { text: o }; }
  }
  if (Array.isArray(o)) o = o[0]?.json ?? o[0];
  if (o && typeof o.response === 'string') {
    try { o = JSON.parse(o.response); } catch { /* keep */ }
  }
  return o || {};
}

// Трасса: какой агент получил какую задачу и что ответил.
const trace = steps.map((s) => {
  const name = s.action?.tool ?? '';
  const input = s.action?.toolInput ?? {};
  const o = parse(s.observation);
  return {
    agent: name,
    task: String(input.task ?? input.summary ?? '').slice(0, 500),
    answer: String(o.output ?? o.note ?? o.text ?? '').slice(0, 500),
  };
});
const agents = trace.map((t) => t.agent).filter((a) => AGENTS.includes(a));

// Лимиты: каждый вызов агента — в дневной счётчик.
const today = new Date(now).toISOString().slice(0, 10);
if (!store.agents || store.agents.date !== today) store.agents = { date: today, calls: {} };
for (const a of agents) store.agents.calls[a] = (store.agents.calls[a] || 0) + 1;

let alert_html = '';
const head = () => {
  const c = g.customer || {};
  return [
    `Канал: ${{ telegram: 'Telegram', web: 'сайт', email: 'почта', team: 'команда', schedule: 'расписание' }[g.channel] || g.channel} · <code>${escapeHtml(g.session_id)}</code>`,
    c.name && `Имя: ${escapeHtml(c.name)}`,
    c.email && `Email: ${escapeHtml(c.email)}`,
    c.phone && `Телефон: ${escapeHtml(c.phone)}`,
    c.telegram && `Telegram: ${escapeHtml(c.telegram)}`,
  ].filter(Boolean).join('\n');
};
const addAlert = (title, body) => {
  alert_html = (alert_html ? alert_html + '\n\n' : '') + [`<b>${title}</b>`, head(), body].filter(Boolean).join('\n');
};

// Агент, которого в этом канале звать нельзя или у которого кончился лимит.
const outside = agents.filter((a) => !(g.allowed || []).includes(a));
if (outside.length) {
  flags.push('agent_not_allowed');
  addAlert('⚠️ Оркестратор вызвал недоступного агента', `Агенты: ${escapeHtml(outside.join(', '))}`);
}

const handoffStep = trace.find((t) => t.agent === 'handoff_to_human');
const handoffObs = steps.filter((s) => s.action?.tool === 'handoff_to_human').map((s) => parse(s.observation)).pop();
const handoffOk = Boolean(handoffStep) && handoffObs?.ok !== false;
let handoff = handoffOk;
if (handoffStep && !handoffOk) {
  flags.push('service_error');
  addAlert('⚠️ Ошибка инструмента', `handoff_to_human: ${escapeHtml(handoffObs?.service_error || handoffObs?.note || '')}`);
}

const customerFacing = g.channel === 'web' || g.channel === 'telegram';
const safe = `Этот вопрос лучше решит менеджер — я передал ему ваш запрос. Ответим в рабочее время: ${config.support_hours}.`;
let reply = String(result.output ?? '').trim();

if (!reply) {
  flags.push('empty_reply');
  reply = customerFacing ? safe : 'Агенты не дали ответа.';
  if (!handoffOk) {
    handoff = customerFacing;
    addAlert('⚠️ Оркестратор не смог ответить', `<blockquote>${escapeHtml(g.text)}</blockquote>`);
  }
}
if (config.canary && reply.includes(config.canary)) {
  flags.push('prompt_leak');
  reply = 'Я не могу этим поделиться. Чем помочь по вашему вопросу?';
}
const forbidden = (config.forbidden || []).map((p) => new RegExp(p, 'iu'));
if (customerFacing && forbidden.some((r) => r.test(reply))) {
  flags.push('forbidden_promise');
  reply = safe;
  if (!handoffOk) {
    handoff = true;
    addAlert('⚠️ Агент пытался пообещать то, что решает только менеджер', `<blockquote>${escapeHtml(g.text)}</blockquote>`);
  }
}
if (reply.length > 3500) {
  reply = reply.slice(0, 3500).replace(/\s+\S*$/, '') + '…';
  flags.push('reply_cut');
}

// Письма клиенту не отвечаем сами: черновик лежит в листе Inbox. Команде — по настройке.
if (g.channel === 'email' && config.email_notify === 'all') {
  addAlert(`📧 ${escapeHtml(g.subject || 'Письмо без темы')}`, escapeHtml(reply));
}
if (g.channel === 'schedule') {
  alert_html = `<b>📊 Ежедневный отчёт</b>\n\n${escapeHtml(reply)}` + (alert_html ? '\n\n' + alert_html : '');
}

if (handoff && customerFacing) {
  const s = (store.sessions = store.sessions || {});
  const entry = (s[g.session_id] = s[g.session_id] || { hits: [], handoff_until: 0 });
  entry.handoff_until = now + config.handoff_pause_minutes * 60000;
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
  agents,
  trace,
  flags,
  debug: Boolean(g.debug),
} }];
