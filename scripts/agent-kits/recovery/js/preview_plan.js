// Preview Plan: один счёт из запроса — для evals и проверки тона. Ничего не сохраняет и не отправляет.
// @include text.js
// @include inv.js
const { config, input } = $input.first().json;
const body = input.body || {};
const token = (input.headers || {})['x-preview-token'] || body.token;
if (!config.preview_token || token !== config.preview_token) return [{ json: { route: 'deny' } }];
const i = body.invoice || {};
const header = INVOICE_COLS;
const history = Array.isArray(body.history) ? body.history : [];
const rows = [header, header.map((k) => String(i[k] ?? '')), ...history.map((h) => header.map((k) => String(h[k] ?? '')))];
const all = invoices(rows);
const inv = all[0];
if (!inv || !inv.due_d || !inv.email) return [{ json: { route: 'bad', error: 'invoice: нужны invoice_id, email, amount, due' } }];
const day = parseDate(body.today) || today(config, Date.now());
const stop = stopReason(inv, day);
const step = config.sequence[Math.min(inv.stage_n, config.sequence.length - 1)];
const risk = ruleRisk(inv, all, day, config);
return [{ json: {
  route: 'ok', mode: 'preview', stop, invoice_id: inv.invoice_id, client: inv.client, contact_name: inv.contact_name, email: inv.email,
  amount: inv.amount_n, amount_text: `${fmtAmount(inv.amount_n)} ${inv.currency}`.trim(), currency: inv.currency,
  issued: parseDate(inv.issued), due: inv.due_d, overdue: daysBetween(inv.due_d, day), step: Math.min(inv.stage_n + 1, config.sequence.length),
  tone: step.tone, final_step: inv.stage_n + 1 >= config.sequence.length, broken_promise: Boolean(inv.promise_d && inv.promise_d < day),
  notes: String(inv.notes || '').slice(0, 500), rule_risk: risk.risk, rule_reasons: risk.reasons, late_count: risk.late_count,
} }].map((item) => ((item.json.facts = factsText(item.json, config)), item));
