// Lead Row: балл лида по понятным правилам и строка для листа Leads.
// Колонки: created | lead_id | score | hot | name | contact | company | need | budget_eur | timeline | decision_maker | channel | session_id | status | score_reasons
// @include text.js
const { config, input } = $('Config').first().json;
const existing = sheetRows($input.first().json.values);
const contact = String(input.contact || input.customer_contact || '').trim();
const norm = (v) => String(v || '').toLowerCase().replace(/[\s()+-]/g, '');
const duplicate = contact ? existing.find((r) => r.contact && norm(r.contact).includes(norm(contact).slice(-9))) : null;

const budget = Number(String(input.budget_eur || '').replace(/[^\d.]/g, '')) || 0;
const timeline = String(input.timeline || 'unknown').toLowerCase();
const dm = String(input.decision_maker || 'unknown').toLowerCase();
const reasons = [];
let score = 0;
const add = (points, why) => { score += points; reasons.push(`${why} +${points}`); };
if (contact) add(20, 'есть контакт');
if (String(input.need || '').trim().length >= 10) add(15, 'понятна задача');
if (budget >= config.min_budget_eur) add(25, `бюджет от ${config.min_budget_eur} €`);
else if (budget > 0) add(10, 'назван бюджет');
if (timeline === 'now') add(25, 'начать сейчас');
else if (timeline === 'month') add(15, 'в течение месяца');
else if (timeline === 'quarter') add(5, 'в течение квартала');
if (dm === 'yes') add(15, 'принимает решение');
const hot = score >= config.hot_lead_score;
const lead_id = 'L-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, '0');

const row = [
  new Date().toISOString(), lead_id, String(score), hot ? 'да' : '',
  String(input.name || input.customer_name || '').slice(0, 100), contact.slice(0, 200),
  String(input.company || '').slice(0, 200), String(input.need || '').slice(0, 1000),
  budget ? String(budget) : '', timeline, dm, input.channel || '', input.session_id || '',
  duplicate ? `повтор ${duplicate.lead_id}` : 'new', reasons.join('; '),
];
const alert_html = hot ? [
  `<b>🔥 Горячий лид ${score}/100</b>`,
  `${escapeHtml(row[4] || 'Без имени')} · ${escapeHtml(contact || 'контакт не указан')}`,
  input.company && `Компания: ${escapeHtml(input.company)}`,
  `Задача: ${escapeHtml(input.need || '')}`,
  budget ? `Бюджет: ${budget} €` : '',
  `Срок: ${escapeHtml(timeline)} · ЛПР: ${escapeHtml(dm)}`,
  duplicate ? `Уже был в базе: ${escapeHtml(duplicate.lead_id)}` : '',
  `<code>${escapeHtml(input.session_id || '')}</code>`,
].filter(Boolean).join('\n') : '';
return [{ json: { lead_id, score, hot, duplicate: duplicate?.lead_id || '', reasons, row, alert_html } }];
