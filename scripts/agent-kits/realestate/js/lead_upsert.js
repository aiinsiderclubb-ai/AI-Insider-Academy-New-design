// Lead Upsert: обновляет карточку лида, считает балл и назначает риелтора.
// @include text.js
// @include re.js
const { config, input } = $('Config').first().json;
const read = $input.first().json;
if (read.error) {
  return [{ json: { ok: false, result: { ok: false, service_error: String(read.error.message || read.error).slice(0, 300), note: 'Таблица лидов недоступна. Продолжай разговор, но не говори, что данные сохранены.' } } }];
}
const rows = sheetRows(read.values);
const now = new Date().toISOString();
const sessionPhone = input.customer_phone || '';
let lead = findLead(rows, input.session_id, input.phone || sessionPhone);
const isNew = !lead;
lead = lead ? { ...lead } : {
  created: now, lead_id: 'RL-' + Date.now().toString(36).toUpperCase().slice(-6), session_id: input.session_id, channel: input.channel,
  source: input.source || input.channel, stage: 'new', follow_ups: '0', currency: config.currency,
  _row: rows.length + 2,
};

// Поле обновляется, только если агент его прислал; пустое — оставляем как было.
const pick = (v, allowed) => {
  const s = norm(v);
  if (!s || s === 'unknown') return '';
  return allowed ? (allowed.includes(s) ? s : '') : String(v).trim().slice(0, 200);
};
const set = (key, v) => { if (v) lead[key] = v; };
set('deal_type', pick(input.deal_type, ['buy', 'rent']));
set('property_type', pick(input.property_type, ['apartment', 'house', 'commercial', 'land', 'any']));
set('area', pick(input.area));
set('rooms', pick(input.rooms));
if (num(input.budget_max)) lead.budget_max = String(num(input.budget_max));
set('currency', pick(input.currency));
set('timeline', pick(input.timeline, ['now', '1-3m', '3-6m', 'later']));
set('mortgage', pick(input.mortgage, ['cash', 'preapproved', 'needed', 'no']));
set('name', pick(input.name) || pick(input.customer_name));
const phone = digits(input.phone || sessionPhone);
if (phone.length >= 9) lead.phone = '+' + phone.replace(/^0/, config.phone_country || '380');
set('email', pick(input.email));
if (input.channel === 'telegram') set('telegram', input.customer_contact || input.session_id);
if (input.notes) lead.notes = [lead.notes, String(input.notes).slice(0, 300)].filter(Boolean).join(' | ').slice(-1000);

// Балл: видимые правила, не мнение модели.
const reasons = [];
let score = 0;
const add = (p, why) => { score += p; reasons.push(`${why} +${p}`); };
if (lead.phone || lead.telegram || lead.email) add(15, 'есть контакт');
if (lead.deal_type) add(5, 'понятна цель');
if (lead.area) add(10, 'район');
if (lead.rooms || (lead.property_type && lead.property_type !== 'any')) add(10, 'тип или комнаты');
if (num(lead.budget_max)) add(20, 'бюджет');
if (lead.timeline === 'now') add(20, 'ищет сейчас');
else if (lead.timeline === '1-3m') add(10, 'в ближайшие 3 месяца');
else if (lead.timeline === '3-6m') add(5, 'через 3–6 месяцев');
if (['cash', 'no', 'preapproved'].includes(lead.mortgage) || lead.deal_type === 'rent') add(20, lead.deal_type === 'rent' ? 'аренда без ипотеки' : 'деньги готовы');
else if (lead.mortgage === 'needed') add(5, 'нужна ипотека');
lead.score = String(score);
lead.segment = score >= config.hot_score ? 'hot' : score >= 40 ? 'warm' : 'cold';

// Риелтор: закреплённый — остаётся; новый — по району и цели, иначе по очереди (по хэшу диалога).
if (!lead.agent_id) {
  const agents = config.agents || [];
  const byDeal = agents.filter((a) => !lead.deal_type || !a.deal_types?.length || a.deal_types.includes(lead.deal_type));
  const byArea = byDeal.filter((a) => lead.area && (a.areas || []).some((x) => norm(lead.area).includes(norm(x)) || norm(x).includes(norm(lead.area))));
  const pool = byArea.length ? byArea : byDeal.length ? byDeal : agents;
  let h = 0;
  for (const ch of String(lead.session_id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  if (pool.length && lead.deal_type) lead.agent_id = pool[h % pool.length].id;
}
if (['new', ''].includes(lead.stage || '') && lead.deal_type && lead.area && num(lead.budget_max)) lead.stage = 'qualified';
lead.last_contact = now;

const missing = [];
if (!lead.deal_type) missing.push('покупка или аренда');
if (!lead.area) missing.push('район');
if (!num(lead.budget_max)) missing.push('бюджет');
if (!lead.rooms && !lead.property_type) missing.push('комнат или тип жилья');
if (!lead.timeline) missing.push('когда планирует');
if (lead.deal_type === 'buy' && !lead.mortgage) missing.push('наличные или ипотека');
if (!lead.phone && input.channel !== 'telegram') missing.push('телефон');

const agent = (config.agents || []).find((a) => a.id === lead.agent_id);
let alert_html = '';
let chat_id = '';
if (lead.segment === 'hot' && !lead.notified) {
  lead.notified = now;
  chat_id = (agent && agent.chat_id) || config.team_chat_id;
  alert_html = [
    `<b>🔥 Горячий лид ${score}/100</b>${agent ? ` → ${escapeHtml(agent.name)}` : ''}`,
    `${escapeHtml(lead.name || 'Без имени')} · ${escapeHtml(lead.phone || lead.telegram || lead.email || 'контакт не указан')}`,
    `${lead.deal_type === 'rent' ? 'Аренда' : 'Покупка'} · ${escapeHtml(lead.area || '')} · ${escapeHtml(lead.rooms || lead.property_type || '')} · до ${escapeHtml(lead.budget_max || '?')} ${escapeHtml(lead.currency || '')}`,
    `Срок: ${escapeHtml(lead.timeline || '?')} · Ипотека: ${escapeHtml(lead.mortgage || '?')}`,
    `<code>${escapeHtml(lead.lead_id)}</code>`,
  ].join('\n');
}

const row = lead._row;
return [{ json: {
  ok: true,
  row,
  range: leadRange(row),
  values: leadValues(lead),
  alert_html,
  chat_id,
  result: {
    ok: true,
    lead_id: lead.lead_id,
    new_lead: isNew,
    segment: lead.segment,
    stage: lead.stage,
    agent: agent ? agent.name : '',
    missing,
    score_reasons: reasons,
    note: missing.length
      ? `Сохранено. Не хватает: ${missing.join(', ')}. Спроси одно-два из этого, не всё сразу. Балл и сегмент клиенту не называй.`
      : 'Анкета заполнена. Предложи подобрать объекты (search_listings). Балл и сегмент клиенту не называй.',
  },
} }];
