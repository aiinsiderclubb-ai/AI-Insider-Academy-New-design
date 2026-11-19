// ---- счета: даты, правила остановки, риск по правилам ----
const DAY = 86400000;

function today(config, now) {
  return new Date(now + config.timezone_offset_hours * 3600000).toISOString().slice(0, 10);
}

function parseDate(v) {
  const s = String(v || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY);
}

function num(v) {
  const n = parseFloat(String(v ?? '').replace(/[\s ]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function yesish(v) {
  return /^(1|true|yes|да|y)$/i.test(String(v ?? '').trim());
}

function fmtAmount(n) {
  const [i, d] = n.toFixed(2).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d === '00' ? '' : ',' + d);
}

/** Invoices: invoice_id | client | contact_name | email | amount | currency | issued | due | status | paid_at | promise_date | disputed | paused | last_contact | stage | notes */
const INVOICE_COLS = ['invoice_id', 'client', 'contact_name', 'email', 'amount', 'currency', 'issued', 'due', 'status', 'paid_at', 'promise_date', 'disputed', 'paused', 'last_contact', 'stage', 'notes'];

function invoices(values) {
  return sheetRows(values).filter((r) => r.invoice_id).map((r) => ({
    ...r,
    amount_n: num(r.amount),
    due_d: parseDate(r.due),
    paid_d: parseDate(r.paid_at),
    promise_d: parseDate(r.promise_date),
    last_d: parseDate(r.last_contact),
    stage_n: Number(r.stage || 0),
    closed: /^(paid|оплачен|cancelled|отменён|отменен|written.off|списан)/i.test(r.status || '') || Boolean(parseDate(r.paid_at)),
  }));
}

function invoiceRow(inv) {
  return INVOICE_COLS.map((k) => String(inv[k] ?? ''));
}

/** Why an invoice must not be chased right now; '' — can be chased. */
function stopReason(inv, day) {
  if (inv.closed) return 'оплачен или закрыт';
  if (yesish(inv.disputed)) return 'клиент оспаривает счёт';
  if (yesish(inv.paused)) return 'напоминания на паузе';
  if (inv.promise_d && inv.promise_d >= day) return `клиент обещал оплатить до ${inv.promise_d}`;
  if (!inv.email) return 'нет email';
  if (!inv.due_d) return 'нет даты оплаты';
  return '';
}

/** Deterministic risk: low / medium / high with reasons in words. */
function ruleRisk(inv, all, day, config) {
  const reasons = [];
  let score = 0;
  const overdue = daysBetween(inv.due_d, day);
  if (overdue > 60) { score += 3; reasons.push(`просрочка ${overdue} дн.`); }
  else if (overdue > 30) { score += 2; reasons.push(`просрочка ${overdue} дн.`); }
  else if (overdue > 7) { score += 1; reasons.push(`просрочка ${overdue} дн.`); }
  if (inv.amount_n >= config.high_amount) { score += 1; reasons.push(`крупная сумма (${fmtAmount(inv.amount_n)} ${inv.currency})`); }
  const late = all.filter((x) => x.client === inv.client && x.invoice_id !== inv.invoice_id && x.paid_d && x.due_d && x.paid_d > x.due_d).length;
  if (late >= 2) { score += 1; reasons.push(`клиент уже ${late} раза платил с опозданием`); }
  if (inv.promise_d && inv.promise_d < day) { score += 2; reasons.push(`обещание оплатить до ${inv.promise_d} не выполнено`); }
  if (inv.stage_n >= 3) { score += 1; reasons.push(`уже ${inv.stage_n} напоминания без оплаты`); }
  const risk = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  return { risk, reasons: reasons.length ? reasons : ['небольшая просрочка, раньше проблем не было'], overdue, late_count: late };
}

const RISK_ORDER = { low: 0, medium: 1, high: 2 };

const TONE_RU = { friendly: 'дружеский', firm: 'деловой', escalate: 'настойчивый', final: 'последнее напоминание' };

/** What the model sees about one invoice. */
function factsText(p, config) {
  const allowed = [];
  if (config.allow_late_fee && config.late_fee_text) allowed.push(`пени по договору: ${config.late_fee_text}`);
  if (config.allow_collection && config.collection_text && p.final_step) allowed.push(`передача долга: ${config.collection_text}`);
  return [
    `Счёт: ${p.invoice_id}`,
    `Клиент: ${p.client}${p.contact_name ? ', контакт: ' + p.contact_name : ''}`,
    `Сумма: ${p.amount_text}`,
    `Выставлен: ${p.issued || 'не указано'}; срок оплаты: ${p.due}; просрочка: ${p.overdue} дн.`,
    `Письмо №${p.step} из ${config.sequence.length}, тон: ${p.tone} (${TONE_RU[p.tone] || p.tone})${p.final_step ? ', последнее в последовательности' : ''}`,
    p.broken_promise ? 'Клиент обещал оплатить к дате, которая уже прошла.' : '',
    p.late_count ? `Раньше клиент платил с опозданием: ${p.late_count} раз(а).` : 'Раньше просрочек по другим счетам не было.',
    `Риск по правилам: ${p.rule_risk} — ${p.rule_reasons.join('; ')}`,
    p.notes ? `Заметки менеджера: ${p.notes}` : 'Заметок нет.',
    allowed.length ? `Разрешено упомянуть дословно: ${allowed.join('; ')}` : 'Упоминать пени, суд, коллекторов и любые санкции нельзя.',
  ].filter(Boolean).join('\n');
}
