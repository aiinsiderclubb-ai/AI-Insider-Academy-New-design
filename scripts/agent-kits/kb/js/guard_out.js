// Guard Out: проверяет ответ модели — ссылки на документы, утечку инструкции, пустой ответ —
// и добавляет список источников.
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
const observations = (name) => steps.filter((s) => s.action?.tool === name).map((s) => parse(s.observation));
const last = (name) => observations(name).at(-1) || null;

// документы, которые модель видела в этом ответе
const seen = new Map();
for (const o of observations('search_documents')) {
  for (const p of o.passages || []) {
    const code = p.cite.replace(/[[\]]/g, '');
    if (!seen.has(code)) seen.set(code, { title: p.document, url: p.url || '' });
  }
}
for (const o of observations('list_documents')) {
  for (const d of o.documents || []) {
    const code = d.cite.replace(/[[\]]/g, '');
    if (!seen.has(code)) seen.set(code, { title: d.title, url: d.url || '' });
  }
}
const searches = observations('search_documents');
const notFound = searches.length > 0 && searches.every((o) => !o.found);
if (used.has('search_documents') && notFound) flags.push('not_found');

let reply = String(result.output ?? '').trim();
let alert_html = '';
const handoffOk = used.has('handoff_to_human') && last('handoff_to_human')?.ok !== false;
let handoff = handoffOk;
const who = config.owner_contact;

function forceHandoff(reason) {
  handoff = true;
  alert_html = [
    `<b>⚠️ ${reason}</b>`,
    `Канал: ${g.channel === 'telegram' ? 'Telegram' : 'веб'} · <code>${escapeHtml(g.session_id)}</code>`,
    g.customer?.name && `Кто: ${escapeHtml(g.customer.name)} ${escapeHtml(g.customer.telegram || g.customer.email || '')}`,
    '',
    `<blockquote>${escapeHtml(g.text)}</blockquote>`,
  ].filter(Boolean).join('\n');
}

if (!reply) {
  flags.push('empty_reply');
  reply = `Не получилось ответить — передал вопрос команде: ${who}.`;
  if (!handoffOk) forceHandoff('Агент не смог ответить');
}
if (config.canary && reply.includes(config.canary)) {
  flags.push('prompt_leak');
  reply = 'Я не могу этим поделиться. Задайте вопрос по документам.';
}

// ссылки: только на документы, которые реально нашлись; нумеруем по порядку появления
const order = [];
reply = reply.replace(/\[(d\d+)\]/g, (m, code) => {
  if (!seen.has(code)) {
    if (!flags.includes('bad_citation')) flags.push('bad_citation');
    return '';
  }
  if (!order.includes(code)) order.push(code);
  return `[${order.indexOf(code) + 1}]`;
});
reply = reply.replace(/[ \t]+([.,;:!?])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
if (searches.some((o) => o.found) && !order.length && !handoff) flags.push('no_citation');
if (!used.has('search_documents') && !used.has('list_documents') && !handoff && reply.length > 200) flags.push('no_search');

if (reply.length > 3300) {
  reply = reply.slice(0, 3300).replace(/\s+\S*$/, '') + '…';
  flags.push('reply_cut');
}
const sources = order.map((code, i) => ({ n: i + 1, code, title: seen.get(code).title, url: seen.get(code).url }));
const footer = sources.length ? '\n\nИсточники:\n' + sources.map((s) => `${s.n}. ${s.title}${s.url ? ' — ' + s.url : ''}`).join('\n') : '';
const footer_html = sources.length
  ? '\n\n<b>Источники:</b>\n' + sources.map((s) => `${s.n}. ${s.url ? `<a href="${escapeHtml(s.url)}">${escapeHtml(s.title)}</a>` : escapeHtml(s.title)}`).join('\n')
  : '';

if (handoff) {
  const s = (store.sessions = store.sessions || {});
  const entry = (s[g.session_id] = s[g.session_id] || { hits: [], handoff_until: 0 });
  entry.handoff_until = now + config.handoff_pause_minutes * 60000;
}

// сбой таблицы или Telegram внутри инструмента — сигнал команде
const broken = ['list_documents', 'handoff_to_human'].flatMap((n) => observations(n).filter((o) => o.service_error).map((o) => [n, o]));
if (broken.length) {
  flags.push('service_error');
  alert_html = (alert_html ? alert_html + '\n\n' : '') + `<b>⚠️ Ошибка инструмента</b>\n${broken.map(([n, o]) => `${n}: ${escapeHtml(o.service_error)}`).join('\n')}`;
}

return [{ json: {
  channel: g.channel,
  session_id: g.session_id,
  customer: g.customer,
  text: g.text,
  reply: reply + footer,
  reply_html: escapeHtml(reply) + footer_html,
  sources,
  handoff,
  alert_html,
  tools,
  flags,
  queries: tools.filter((t) => t.name === 'search_documents').map((t) => t.input.query).filter(Boolean),
  debug: Boolean(g.debug),
} }];
