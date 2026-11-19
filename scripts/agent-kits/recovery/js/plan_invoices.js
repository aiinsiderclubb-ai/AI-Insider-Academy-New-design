// Plan Invoices: какие счета пора напомнить сегодня и каким по счёту письмом.
// @include text.js
// @include inv.js
const { config } = $('Config').first().json;
const day = today(config, Date.now());
const sheets = $input.first().json.valueRanges || [];
const all = invoices(sheets[0]?.values);
const drafts = sheetRows(sheets[1]?.values);
const waiting = new Set(drafts.filter((d) => ['pending', 'editing'].includes(d.status)).map((d) => d.invoice_id));

const plan = [];
for (const inv of all) {
  if (stopReason(inv, day)) continue;
  const overdue = daysBetween(inv.due_d, day);
  if (overdue < 1) continue;
  if (waiting.has(inv.invoice_id)) continue;                       // черновик уже ждёт решения
  if (inv.last_d && daysBetween(inv.last_d, day) < config.min_gap_days) continue;
  const step = config.sequence[inv.stage_n];
  if (!step || overdue < step.day) continue;                       // все шаги пройдены или рано
  const risk = ruleRisk(inv, all, day, config);
  plan.push({
    mode: 'monitor', invoice_id: inv.invoice_id, row: inv._row, client: inv.client, contact_name: inv.contact_name, email: inv.email,
    amount: inv.amount_n, amount_text: `${fmtAmount(inv.amount_n)} ${inv.currency}`.trim(), currency: inv.currency,
    issued: parseDate(inv.issued), due: inv.due_d, overdue, step: inv.stage_n + 1, tone: step.tone,
    final_step: inv.stage_n + 1 === config.sequence.length, broken_promise: Boolean(inv.promise_d && inv.promise_d < day),
    notes: String(inv.notes || '').slice(0, 500), rule_risk: risk.risk, rule_reasons: risk.reasons, late_count: risk.late_count,
  });
  plan[plan.length - 1].facts = factsText(plan[plan.length - 1], config);
}
plan.sort((a, b) => RISK_ORDER[b.rule_risk] - RISK_ORDER[a.rule_risk] || b.overdue - a.overdue || b.amount - a.amount);
return plan.slice(0, config.max_drafts_per_run).map((p) => ({ json: p }));
