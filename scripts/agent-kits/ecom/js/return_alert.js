// Return Alert: команде — заявка на возврат.
// @include text.js
const { input } = $('Config').first().json;
const p = $input.first().json;
const head = p.decision === 'eligible' ? '📦 Заявка на возврат — подходит по правилам' : '📦 Заявка на возврат — нужен менеджер';
const text = [
  `<b>${head}</b>`,
  `Заявка <code>${escapeHtml(p.rma)}</code> · заказ ${escapeHtml(p.order_id)}`,
  `Товары: ${escapeHtml(p.row[6])}`,
  `Причина: ${escapeHtml(input.reason || '—')} · состояние: ${escapeHtml(input.condition || '—')}`,
  `Правила: ${escapeHtml((p.reasons || []).join(' '))}`,
  input.customer_name && `Клиент: ${escapeHtml(input.customer_name)}`,
  `Контакт: ${escapeHtml(input.email || input.customer_contact || '—')}`,
  '',
  'Деньги автоматически не возвращаются: проверьте заявку и оформите возврат в админке магазина.',
].filter(Boolean).join('\n');
return [{ json: { ...p, alert_html: text } }];
