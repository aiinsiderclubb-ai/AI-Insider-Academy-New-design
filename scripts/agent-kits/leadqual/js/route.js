// Route: менеджер, строка в CRM, сообщение менеджеру и решение о письме лиду.
// @include text.js
// @include cols.js
const { config } = $('Config').first().json;
const s = $input.first().json;
const lead = s.lead;
const store = $getWorkflowStaticData('global');
store.rr = store.rr || {};
const now = new Date().toISOString();
const active = (config.owners || []).filter((o) => o.active);

let owner = null;
let routing = '';
if (s.duplicate && active.find((o) => o.id === s.duplicate.owner)) {
  owner = active.find((o) => o.id === s.duplicate.owner);
  routing = 'повторная заявка — тому же менеджеру';
} else if (s.tier !== 'disqualified') {
  const pool = active.filter((o) => (o.segments || []).includes(s.segment));
  if (pool.length) {
    const i = (store.rr[s.segment] || 0) % pool.length;
    owner = pool[i];
    store.rr[s.segment] = i + 1;
    routing = `по кругу в сегменте ${s.segment}`;
  } else {
    routing = `в сегменте ${s.segment} нет активных менеджеров`;
  }
} else {
  routing = 'дисквалифицирован: ' + s.disqualified.join(', ');
}

const row = {
  lead_id: lead.lead_id, received: lead.received, name: lead.name, email: lead.email, phone: lead.phone, company: lead.company,
  domain: lead.domain, website: lead.website, source: lead.source, message: lead.message, budget: lead.budget,
  score: String(s.score), tier: s.tier, segment: s.segment, owner: owner ? owner.id : '', status: s.tier === 'disqualified' ? 'disqualified' : 'new',
  reasons: s.reasons.join('; '), summary: s.assessment?.summary || '', questions: (s.assessment?.questions || []).join(' '),
  flags: [...s.flags, ...s.review].join(', '), repeat_count: '0', last_seen: now,
};
let http;
if (s.duplicate) {
  const d = s.duplicate;
  const merged = { ...d };
  for (const k of COLS) if (row[k] && !['lead_id', 'received', 'repeat_count', 'status'].includes(k)) merged[k] = row[k];
  merged.message = [d.message, `${now.slice(0, 10)}: ${lead.message}`].filter(Boolean).join('\n---\n').slice(0, 5000);
  merged.repeat_count = String(Number(d.repeat_count || 0) + 1);
  merged.owner = owner ? owner.id : d.owner;
  http = { method: 'PUT', path: `${encodeURIComponent(`Leads!A${d._row}`)}?valueInputOption=RAW`, body: { values: [COLS.map((k) => merged[k] ?? '')] } };
} else {
  http = { method: 'POST', path: `${encodeURIComponent('Leads!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, body: { values: [COLS.map((k) => row[k] ?? '')] } };
}

const icon = { hot: '🔥', warm: '🟡', cold: '⚪️', disqualified: '⛔️' }[s.tier];
const card = [
  `<b>${icon} ${escapeHtml(lead.name || 'Без имени')}${lead.company ? ' · ' + escapeHtml(lead.company) : ''} — ${s.score}/100</b>`,
  s.duplicate ? `↩️ Повторная заявка (${Number(s.duplicate.repeat_count || 0) + 1}-я), первая — ${escapeHtml(s.duplicate.received.slice(0, 10))}` : '',
  [lead.email, lead.phone].filter(Boolean).map(escapeHtml).join(' · '),
  lead.website ? escapeHtml(lead.website) : '',
  '',
  s.assessment ? `<b>Суть:</b> ${escapeHtml(s.assessment.summary)}` : '',
  `<blockquote>${escapeHtml(lead.message.slice(0, 700) || '—')}</blockquote>`,
  `<b>Баллы:</b>\n${s.reasons.map(escapeHtml).join('\n')}`,
  s.assessment?.questions?.length ? `<b>Спросить на звонке:</b>\n${s.assessment.questions.map((q) => '• ' + escapeHtml(q)).join('\n')}` : '',
  s.flags.length || s.review.length ? `<b>Флаги:</b> ${escapeHtml([...s.flags, ...s.review].join(', '))}` : '',
  `<i>${escapeHtml(lead.lead_id)} · ${escapeHtml(lead.source)} · ${escapeHtml(routing)}</i>`,
].filter(Boolean).join('\n');

const notify = [];
if (owner) notify.push({ chat_id: owner.chat_id, text: card });
if (config.team_chat_id && (s.tier === 'hot' || !owner && s.tier !== 'disqualified' || s.review.length)) notify.push({ chat_id: config.team_chat_id, text: card });

const clarify = Boolean(config.clarify_by_email && lead.email && !s.duplicate && (config.clarify_tiers || []).includes(s.tier) && s.assessment?.questions?.length);
const email = clarify ? {
  to: lead.email,
  subject: `${config.company}: пара вопросов по вашей заявке`,
  text: [`Здравствуйте${lead.name ? ', ' + lead.name : ''}!`, '', `Спасибо за заявку в ${config.company}. Чтобы предложить подходящее решение, ответьте, пожалуйста, на несколько вопросов:`, '',
    ...s.assessment.questions.map((q, i) => `${i + 1}. ${q}`), '', 'Можно ответить прямо на это письмо.', '', config.clarify_from_name].join('\n'),
} : null;

const response = { ok: true, lead_id: lead.lead_id };
const report = { ...response, score: s.score, tier: s.tier, segment: s.segment, owner: owner ? owner.id : '', duplicate: Boolean(s.duplicate),
  reasons: s.reasons, flags: s.flags, review: s.review, assessment: s.assessment, pages: s.pages, email_sent: clarify, routing };
return [{ json: { http, notify, email, debug: s.debug, response: s.debug ? report : response } }];
