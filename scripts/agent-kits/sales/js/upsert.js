// Upsert Lead: создаёт или дополняет строку лида и считает баллы. Баллы считает код, не модель.
// @include text.js
// @include lead_cols.js
const { config, input } = $('Config').first().json;
const feed = $input.first().json;
if (feed.error) {
  return [{ json: { skip: true, result: { ok: false, service_error: String(feed.error.message || feed.error).slice(0, 300),
    note: 'Лид не сохранился: таблица недоступна. Продолжай разговор; если клиент готов к сделке — передай менеджеру (handoff_to_human).' } } }];
}
const rows = sheetRows(feed.values);
const existing = rows.find((r) => r.session_id === input.session_id);
const STAGES = ['new', 'qualifying', 'offer_sent', 'call_booked', 'won', 'lost'];
const clean = (v, n = 300) => String(v ?? '').trim().slice(0, n);

// Бюджет: «около 2 тыс», «2k €», «1 500» → число
function amount(text) {
  const t = String(text || '').toLowerCase().replace(/\s+/g, ' ');
  const m = /(\d+(?:[ .,]\d{3})*(?:[.,]\d+)?)\s*(k|к|тыс|тысяч|thousand|m|млн|million)?/.exec(t);
  if (!m) return null;
  let n = Number(m[1].replace(/[ ,](?=\d{3}\b)/g, '').replace(',', '.').replace(/\.(?=\d{3}\b)/g, ''));
  if (/^(k|к|тыс|тысяч|thousand)$/.test(m[2] || '')) n *= 1000;
  if (/^(m|млн|million)$/.test(m[2] || '')) n *= 1000000;
  return isFinite(n) ? n : null;
}
function timelinePoints(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return 0;
  if (/(сейчас|срочно|сегодня|завтра|на этой неделе|эт(а|ой) недел|в этом месяце|asap|now|this week|this month|сразу)/.test(t)) return 25;
  if (/(следующ|через (1|2|3|один|два|три|месяц|пару)|1[-–]3|в течение (месяца|квартала)|next month|quarter|1-3)/.test(t)) return 15;
  return 5; // позже, «не знаю», «когда-нибудь»
}
function authorityPoints(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return 0;
  if (/(^да|я решаю|решаю я|сам|сама|владел|собственник|директор|основател|owner|founder|ceo|yes|i decide)/.test(t)) return 25;
  if (/(вместе|с партн|с руковод|согласов|совместн|together|with my)/.test(t)) return 10;
  return 0;
}

const now = new Date().toISOString();
const lead = Object.fromEntries(LEAD_COLS.map((c) => [c, existing ? existing[c] || '' : '']));
const set = (key, value) => { const v = clean(value, key === 'notes' || key === 'need' ? 1000 : 300); if (v) lead[key] = v; };
lead.session_id = input.session_id;
lead.channel = input.channel || lead.channel;
lead.chat_id = input.chat_id || lead.chat_id;
set('name', input.name || input.customer_name);
set('email', input.email || input.customer_email);
set('phone', input.phone || input.customer_phone);
for (const k of ['need', 'budget', 'timeline', 'authority', 'product_id']) set(k, input[k]);
if (input.notes) lead.notes = clean([lead.notes, input.notes].filter(Boolean).join(' | '), 1000);
const stage = String(input.stage || '').toLowerCase();
if (STAGES.includes(stage)) lead.stage = stage;
if (!lead.stage) lead.stage = 'new';
if (!existing) { lead.created = now; lead.touches = '0'; }
lead.updated = now;

const budgetValue = amount(lead.budget);
const parts = {
  need: lead.need ? 25 : 0,
  budget: budgetValue === null ? (lead.budget ? 10 : 0) : budgetValue >= config.min_budget ? 25 : 10,
  timeline: timelinePoints(lead.timeline),
  authority: authorityPoints(lead.authority),
};
const score = parts.need + parts.budget + parts.timeline + parts.authority;
const tier = score >= config.hot_score ? 'hot' : score >= config.warm_score ? 'warm' : 'cold';
lead.score = String(score);
lead.tier = tier;

const missing = [];
if (!parts.need) missing.push('need — какую задачу решает клиент');
if (!lead.budget) missing.push('budget — бюджет');
if (!lead.timeline) missing.push('timeline — когда нужно');
if (!lead.authority) missing.push('authority — кто принимает решение');
if (!lead.email && !lead.phone && lead.channel !== 'telegram') missing.push('контакт — email или телефон');

const large = budgetValue !== null && budgetValue >= config.large_deal_budget;
const becameHot = tier === 'hot' && (!existing || existing.tier !== 'hot');
const values = [LEAD_COLS.map((c) => lead[c] ?? '')];
const http = existing
  ? { method: 'PUT', path: `${encodeURIComponent(`Leads!A${existing._row}`)}?valueInputOption=RAW`, body: { values } }
  : { method: 'POST', path: `${encodeURIComponent('Leads!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, body: { values } };

let note = missing.length
  ? `Сохранено. Ещё не известно: ${missing.join('; ')}. Спрашивай по одному вопросу за раз, в ходе разговора, не анкетой.`
  : 'Сохранено, квалификация полная. Предложи следующий шаг: ссылку на оплату (send_offer), КП или звонок (book_call).';
if (large) note += ' Бюджет крупный: передай сделку менеджеру (handoff_to_human) после того, как узнаешь контакт.';

const team_message = becameHot
  ? [`🔥 Горячий лид: ${score}/100`, `Имя: ${lead.name || '—'}`, `Контакт: ${[lead.email, lead.phone].filter(Boolean).join(' · ') || (lead.channel === 'telegram' ? 'Telegram' : '—')}`,
     `Задача: ${lead.need || '—'}`, `Бюджет: ${lead.budget || '—'} · Сроки: ${lead.timeline || '—'} · Решение: ${lead.authority || '—'}`, `Сессия: ${lead.session_id}`].join('\n')
  : '';
return [{ json: { skip: false, http, team_message,
  result: { ok: true, score, tier, parts, stage: lead.stage, missing, large_deal: large, note } } }];
