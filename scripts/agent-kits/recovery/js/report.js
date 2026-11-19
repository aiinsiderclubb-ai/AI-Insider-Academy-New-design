// Weekly Report: сколько просрочено, что вернулось за неделю, что ждёт решения.
// @include text.js
// @include inv.js
const { config } = $('Config').first().json;
const sheets = $input.first().json.valueRanges || [];
const now = Date.now();
const day = today(config, now);
const weekAgo = new Date(Date.parse(day) - 7 * DAY).toISOString().slice(0, 10);
const all = invoices(sheets[0]?.values);
const drafts = sheetRows(sheets[1]?.values);
const activity = sheetRows(sheets[2]?.values);

const open = all.filter((i) => !i.closed && i.due_d && daysBetween(i.due_d, day) >= 1);
const sum = (list) => list.reduce((a, i) => a + i.amount_n, 0);
const cur = [...new Set(all.map((i) => i.currency).filter(Boolean))];
const money = (n) => `${fmtAmount(n)} ${cur.length === 1 ? cur[0] : ''}`.trim();
const bucket = (lo, hi) => open.filter((i) => { const d = daysBetween(i.due_d, day); return d >= lo && d <= hi; });
const chased = new Set(drafts.filter((d) => d.status === 'sent').map((d) => d.invoice_id));
const recovered = all.filter((i) => i.paid_d && i.paid_d > weekAgo && i.paid_d <= day && chased.has(i.invoice_id));
const sentWeek = activity.filter((a) => a.action === 'sent' && String(a.time).slice(0, 10) > weekAgo).length;
const pending = drafts.filter((d) => ['pending', 'editing'].includes(d.status)).length;
const promises = all.filter((i) => !i.closed && i.promise_d && i.promise_d >= day && daysBetween(day, i.promise_d) <= 7);
const broken = all.filter((i) => !i.closed && i.promise_d && i.promise_d < day);
const disputed = open.filter((i) => yesish(i.disputed));
const top = [...open].map((i) => ({ i, r: ruleRisk(i, all, day, config) })).sort((a, b) => RISK_ORDER[b.r.risk] - RISK_ORDER[a.r.risk] || b.i.amount_n - a.i.amount_n).slice(0, 5);

const lines = [
  `<b>📊 Дебиторка за неделю · ${day}</b>`,
  '',
  `Просрочено: <b>${money(sum(open))}</b> в ${open.length} счетах`,
  `  1–30 дн.: ${money(sum(bucket(1, 30)))} · 31–60: ${money(sum(bucket(31, 60)))} · 61–90: ${money(sum(bucket(61, 90)))} · 90+: ${money(sum(bucket(91, 100000)))}`,
  `Вернулось после напоминаний за 7 дней: <b>${money(sum(recovered))}</b> (${recovered.length} счетов)`,
  `Отправлено напоминаний: ${sentWeek} · ждут решения: ${pending}`,
  promises.length ? `Обещали оплатить на этой неделе: ${promises.map((i) => `${escapeHtml(i.invoice_id)} (${i.promise_d})`).join(', ')}` : '',
  broken.length ? `Обещание не выполнено: ${broken.map((i) => escapeHtml(i.invoice_id)).join(', ')}` : '',
  disputed.length ? `Спорные: ${disputed.map((i) => escapeHtml(i.invoice_id)).join(', ')}` : '',
  top.length ? '\n<b>Самые рискованные:</b>' : '',
  ...top.map(({ i, r }) => `${{ low: '🟢', medium: '🟡', high: '🔴' }[r.risk]} ${escapeHtml(i.invoice_id)} · ${escapeHtml(i.client)} · ${fmtAmount(i.amount_n)} ${escapeHtml(i.currency)} · ${daysBetween(i.due_d, day)} дн.`),
].filter((x) => x !== '');
return [{ json: { chat_id: String(config.approver_chat_ids[0]), text: lines.join('\n'),
  totals: { overdue: sum(open), overdue_count: open.length, recovered: sum(recovered), recovered_count: recovered.length, sent: sentWeek, pending } } }];
