// Metrics: цифры для отчёта считаются здесь, а не моделью.
// @include text.js
const { config, input } = $('Config').first().json;
const res = $input.first().json;
if (res.error) {
  return [{ json: { ok: false, service_error: String(res.error.message || res.error).slice(0, 300), note: 'Таблица недоступна. Скажи, что отчёт не собран, и не придумывай цифры.' } }];
}
const ranges = res.valueRanges || [];
const tab = (name) => sheetRows((ranges.find((r) => decodeURIComponent(r.range || '').replace(/'/g, '').startsWith(name + '!')) || {}).values);
const days = { yesterday: 1, '7d': 7, '30d': 30 }[input.period] || 1;
const dayStart = (ms) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  return parts; // YYYY-MM-DD в часовом поясе компании
};
const localDate = (iso) => (iso ? dayStart(Date.parse(iso)) : '');
const today = dayStart(Date.now());
const from = dayStart(Date.now() - days * 86400000);
const inPeriod = (iso) => {
  const d = localDate(iso);
  return d && d >= from && d < today;
};

const log = tab('Log').filter((r) => inPeriod(r.time) && r.channel !== 'schedule');
const leads = tab('Leads').filter((r) => inPeriod(r.created));
const tickets = tab('Tickets').filter((r) => inPeriod(r.created));
const inbox = tab('Inbox').filter((r) => inPeriod(r.received));
const count = (rows, key) => rows.reduce((acc, r) => ((acc[r[key] || '—'] = (acc[r[key] || '—'] || 0) + 1), acc), {});
const agentCalls = {};
for (const r of log) for (const a of String(r.agents || '').split(',').map((x) => x.trim()).filter(Boolean)) agentCalls[a] = (agentCalls[a] || 0) + 1;

return [{ json: {
  ok: true,
  period: { from, to_exclusive: today, days },
  conversations: {
    messages: log.length,
    sessions: new Set(log.map((r) => r.session_id)).size,
    by_channel: count(log, 'channel'),
    handed_to_people: log.filter((r) => r.handoff).length,
    flagged: log.filter((r) => /forbidden_promise|injection|service_error|empty_reply/.test(r.flags)).length,
  },
  agent_calls: agentCalls,
  leads: {
    total: leads.length,
    hot: leads.filter((r) => r.hot).length,
    average_score: leads.length ? Math.round(leads.reduce((a, r) => a + Number(r.score || 0), 0) / leads.length) : 0,
    top: leads.filter((r) => r.hot).slice(0, 5).map((r) => ({ lead_id: r.lead_id, name: r.name, need: r.need.slice(0, 120), score: Number(r.score) })),
  },
  tickets: { total: tickets.length, by_priority: count(tickets, 'priority'), open: tickets.filter((r) => r.status === 'open').length },
  inbox: { total: inbox.length, by_category: count(inbox, 'category'), urgent: inbox.filter((r) => r.priority === 'urgent').length },
  note: 'Используй только эти цифры. Если раздел пустой — так и напиши. Не считай проценты, которых здесь нет, кроме простых долей от total.',
} }];
