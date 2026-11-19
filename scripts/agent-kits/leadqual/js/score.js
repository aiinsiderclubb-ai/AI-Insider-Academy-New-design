// Score: баллы по рубрике. Факты из формы считает код, суждения берутся из принятой оценки модели.
// @include text.js
const { config } = $('Config').first().json;
const d = $('Dedupe').first().json;
const lead = d.lead;
const result = $input.first().json || {};
const steps = Array.isArray(result.intermediateSteps) ? result.intermediateSteps : [];
const parse = (o) => { try { o = typeof o === 'string' ? JSON.parse(o) : o; } catch { return null; } return Array.isArray(o) ? (o[0]?.json ?? o[0]) : o; };
const accepted = [...steps].reverse().find((s) => s.action?.tool === 'submit_assessment' && parse(s.observation)?.ok === true);
const a = accepted ? accepted.action.toolInput : null;
const pages = steps.filter((s) => s.action?.tool === 'fetch_page' && parse(s.observation)?.ok === true).map((s) => s.action.toolInput.url);

function amount(text) {
  const t = String(text || '').toLowerCase();
  const m = /(\d+(?:[ .,]\d{3})*(?:[.,]\d+)?)\s*(k|к|тыс|тысяч|thousand|m|млн|million)?/.exec(t);
  if (!m) return null;
  let n = Number(m[1].replace(/[ ,](?=\d{3}\b)/g, '').replace(',', '.').replace(/\.(?=\d{3}\b)/g, ''));
  if (/^(k|к|тыс|тысяч|thousand)$/.test(m[2] || '')) n *= 1000;
  if (/^(m|млн|million)$/.test(m[2] || '')) n *= 1000000;
  return isFinite(n) ? n : null;
}
const budget = amount(lead.budget);
const total = config.rubric.reduce((s, r) => s + r.weight, 0) || 1;
let points = 0;
const reasons = [];
for (const r of config.rubric) {
  let share = 0;
  let why = '';
  if (r.type === 'model') {
    const v = a ? String(a[r.field] || '').toLowerCase() : '';
    share = a ? (r.points[v] ?? 0) : 0;
    why = a ? v : 'нет оценки модели';
  } else if (r.type === 'budget') {
    share = budget === null ? 0 : budget >= r.min ? 1 : 0.4;
    why = budget === null ? 'не указан' : String(budget);
  } else if (r.type === 'corporate_email') {
    share = lead.corporate_email ? 1 : 0;
    why = lead.corporate_email ? lead.email.split('@')[1] : 'нет';
  } else if (r.type === 'present') {
    share = lead[r.field] ? 1 : 0;
    why = lead[r.field] ? 'есть' : 'нет';
  }
  const got = Math.round(r.weight * share * 100 / total);
  points += r.weight * share;
  reasons.push(`${got > 0 ? '+' : '±'}${got} ${r.label}: ${why}`);
}
const score = Math.round((points * 100) / total);
const flags = a ? String(a.red_flags || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
const disq = flags.filter((f) => (config.disqualify_flags || []).includes(f));
let tier = score >= config.hot_score ? 'hot' : score >= config.warm_score ? 'warm' : 'cold';
if (disq.length) tier = 'disqualified';
const review = [];
if (!a) review.push('оценка модели не получена — проверьте лида вручную');
if (d.crm_error) review.push('CRM не прочиталась: проверка на дубли не выполнена');

const size = a ? a.company_size : 'unknown';
const segment = (config.enterprise_sizes || []).includes(size) || (budget !== null && budget >= config.enterprise_budget) ? 'enterprise' : 'smb';
const questions = a ? String(a.questions || '').split(/\n|;|\?\s/).map((q) => q.trim()).filter(Boolean).slice(0, 3).map((q) => (q.endsWith('?') ? q : q + '?')) : [];
return [{ json: {
  lead, debug: d.debug, duplicate: d.duplicate, score, tier, segment, reasons, flags, disqualified: disq, review,
  assessment: a ? { fit: a.fit, intent: a.intent, company_size: a.company_size, urgency: a.urgency, summary: String(a.summary || '').slice(0, 600), questions } : null,
  pages,
} }];
