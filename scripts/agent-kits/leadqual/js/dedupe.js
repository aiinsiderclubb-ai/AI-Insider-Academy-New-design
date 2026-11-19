// Dedupe: была ли заявка от этого человека или компании за последние dedupe_days дней.
// @include text.js
// @include cols.js
const { config } = $('Config').first().json;
const { lead, debug } = $('Intake').first().json;
const feed = $input.first().json;
const crm_error = feed.error ? String(feed.error.message || feed.error).slice(0, 300) : '';
const rows = feed.error ? [] : sheetRows(feed.values);
const since = Date.now() - config.dedupe_days * 86400000;
const free = new Set(config.free_email_domains || []);
const digits = (p) => String(p || '').replace(/\D/g, '');
const match = rows
  .filter((r) => (Date.parse(r.last_seen || r.received) || 0) >= since)
  .filter((r) => (lead.email && r.email === lead.email) || (lead.phone && digits(r.phone) && digits(r.phone) === digits(lead.phone))
    || (lead.domain && !free.has(lead.domain) && r.domain === lead.domain))
  .sort((a, b) => (Date.parse(b.last_seen || b.received) || 0) - (Date.parse(a.last_seen || a.received) || 0))[0];

const history = match ? `Повторная заявка: ранее ${match.received.slice(0, 10)}, оценка ${match.score} (${match.tier}), менеджер ${match.owner || '—'}, статус ${match.status || '—'}.` : 'Новый лид, раньше заявок не было.';
const research = config.research_website && lead.website ? `Сайт: ${lead.website}. Открой главную страницу и при необходимости ещё ${config.max_pages - 1} — о компании, услугах, ценах.` : 'Сайта нет: оценивай по форме.';
const agent_input = [
  `Заявка ${lead.lead_id}`,
  `Имя: ${lead.name || '—'}`, `Email: ${lead.email || '—'}${lead.corporate_email ? ' (корпоративный)' : ''}`, `Телефон: ${lead.phone || '—'}`,
  `Компания: ${lead.company || '—'}`, `Домен: ${lead.domain || '—'}`, `Бюджет из формы: ${lead.budget || '—'}`, `Источник: ${lead.source}`,
  `Сообщение:\n<<<\n${lead.message || '—'}\n>>>`,
  history, research,
].join('\n');
return [{ json: { lead, debug, duplicate: match || null, crm_error, agent_input } }];
