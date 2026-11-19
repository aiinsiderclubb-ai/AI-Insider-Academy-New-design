// Guard Out: проверяет отчёт — ссылки только на найденные источники, их число, бюджет, утечку
// инструкции — и собирает список источников.
// @include text.js
const config = $('Config').first().json.config;
const g = $('Guard In').first().json;
const result = $input.first().json;

const steps = Array.isArray(result.intermediateSteps) ? result.intermediateSteps : [];
const tools = steps.map((s) => ({ name: s.action?.tool ?? '', input: s.action?.toolInput ?? {} }));
const flags = [...(g.flags || [])];
function parse(o) {
  if (typeof o === 'string') {
    try { o = JSON.parse(o); } catch { return { text: o }; }
  }
  if (Array.isArray(o)) o = o[0]?.json ?? o[0];
  return o || {};
}
const obs = steps.map((s) => ({ tool: s.action?.tool, o: parse(s.observation) }));

// источники, которые агент видел: из поиска (сниппет) и прочитанные страницы
const seen = new Map();
for (const { tool, o } of obs) {
  if (tool === 'web_search') {
    for (const r of o.results || []) {
      const ref = r.ref.replace(/[[\]]/g, '');
      if (!seen.has(ref)) seen.set(ref, { title: r.title, url: r.url, domain: r.domain, published: r.published, read: false });
    }
  }
  if (tool === 'fetch_page' && o.ok) {
    const ref = o.ref.replace(/[[\]]/g, '');
    const prev = seen.get(ref) || {};
    seen.set(ref, { ...prev, title: prev.title || o.title, url: o.url, domain: prev.domain || (String(o.url).split('/')[2] || '').split(':')[0].replace(/^www\./, ''), read: true });
  }
}
const searches = tools.filter((t) => t.name === 'web_search').length;
const pages = tools.filter((t) => t.name === 'fetch_page').length;
if (searches > g.budget.searches || pages > g.budget.pages) flags.push('over_budget');
if (obs.some(({ o }) => o.service_error)) flags.push('service_error');
const handoff = tools.some((t) => t.name === 'handoff_to_human') && obs.some(({ tool, o }) => tool === 'handoff_to_human' && o.ok !== false);

let body = String(result.output ?? '').trim();
let status = 'ok';
if (!body) {
  status = 'failed';
  flags.push('empty_reply');
  body = '# Отчёт не готов\n\nАгент не смог закончить исследование. Команда получила сигнал.';
}
if (config.canary && body.includes(config.canary)) {
  flags.push('prompt_leak');
  body = body.split(config.canary).join('[удалено]');
}
// ссылки: только на источники, которые реально встречались; нумерация по первому упоминанию
const order = [];
body = body.replace(/\[(s[0-9a-f]{4})\]/g, (m, ref) => {
  if (!seen.has(ref)) {
    if (!flags.includes('bad_citation')) flags.push('bad_citation');
    return '';
  }
  if (!order.includes(ref)) order.push(ref);
  return `[${order.indexOf(ref) + 1}]`;
});
// модель могла вставить свой список источников — система ставит свой
body = body.replace(/\n#{1,3}\s*(Источники|Sources)(?=\s|$)[\s\S]*$/i, '').replace(/[ \t]+([.,;:!?])/g, '$1').trim();

const sources = order.map((ref, i) => ({ n: i + 1, ref, ...seen.get(ref) }));
const domains = new Set(sources.map((s) => s.domain));
if (status === 'ok' && domains.size < config.min_sources) {
  status = 'preliminary';
  flags.push('few_sources');
}
const banner = status === 'preliminary'
  ? `> ⚠️ Предварительный отчёт: использовано источников — ${domains.size}, нужно не меньше ${config.min_sources}. Выводы проверьте.\n\n`
  : '';
const header = `<!-- ${g.job_id} · ${g.started.slice(0, 10)} · глубина: ${g.budget.label} · поисков: ${searches}, страниц: ${pages} -->\n\n`;
const list = sources.length
  ? '\n\n## Источники\n\n' + sources.map((s) => `${s.n}. [${s.title.replace(/[[\]]/g, '')}](${s.url}) — ${s.domain}${s.published ? ', ' + String(s.published).slice(0, 10) : ''}${s.read ? '' : ' · по сниппету поиска'}`).join('\n')
  : '';
const report_md = header + banner + body + list + `\n\n---\nЗапрос: ${g.text}\n`;

// короткая версия для Telegram: раздел «Коротко» или начало отчёта
const short = (/##\s*Коротко\s*\n([\s\S]*?)(\n##|$)/i.exec(body)?.[1] || body.replace(/^#.*\n/, '')).trim();
const title = (/^#\s+(.+)$/m.exec(body)?.[1] || 'Отчёт').trim();
let summary = short.replace(/\*\*/g, '').replace(/\[(\d+)\]\(([^)]+)\)/g, '[$1]');
if (summary.length > 700) summary = summary.slice(0, 700).replace(/\s+\S*$/, '') + '…';
const statusLine = { ok: '✅', preliminary: '⚠️ предварительный', failed: '❌ не готов' }[status];
const caption_html = `<b>${escapeHtml(title)}</b> ${statusLine}\n\n${escapeHtml(summary)}\n\nИсточников: ${sources.length} · полный отчёт — в файле`;

let alert_html = '';
if (status !== 'ok' || handoff || flags.includes('service_error') || flags.includes('over_budget') || flags.includes('bad_citation')) {
  const why = [
    status === 'failed' && 'агент не закончил отчёт',
    status === 'preliminary' && `мало источников (${domains.size})`,
    flags.includes('over_budget') && `превышен бюджет: поисков ${searches}/${g.budget.searches}, страниц ${pages}/${g.budget.pages}`,
    flags.includes('service_error') && 'сбой поиска или Telegram',
    flags.includes('bad_citation') && 'агент сослался на несуществующий источник — ссылка удалена',
  ].filter(Boolean);
  if (why.length) {
    alert_html = `<b>🔎 Исследование ${escapeHtml(g.job_id)}</b>\n${why.map((w) => '• ' + escapeHtml(w)).join('\n')}\n\n<blockquote>${escapeHtml(g.text.slice(0, 500))}</blockquote>`;
  }
}

return [{ json: {
  job_id: g.job_id, channel: g.channel, requester: g.requester, chat_id: g.chat_id, callback_url: g.callback_url, wait: Boolean(g.wait),
  request: g.text, depth: g.depth, started: g.started, finished: new Date().toISOString(),
  status, title, report_md, caption_html, sources,
  stats: { searches, pages, cited: sources.length, domains: domains.size },
  flags, alert_html, tools, debug: g.debug,
} }];
