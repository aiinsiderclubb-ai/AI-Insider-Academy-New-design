// Cards: каждый черновик — карточка в Telegram с кнопками.
// @include text.js
// @include inv.js
const { config } = $('Config').first().json;
const icon = { low: '🟢', medium: '🟡', high: '🔴' };
return $('Check Draft').all().map(({ json: d }) => ({ json: {
  draft_id: d.draft_id,
  chat_id: String(config.approver_chat_ids[0]),
  text: [
    `<b>${icon[d.risk] || ''} ${escapeHtml(d.client)} · счёт ${escapeHtml(d.invoice_id)}</b>`,
    `${escapeHtml(d.amount_text)} · просрочка ${d.overdue} дн. · письмо №${d.step} (${escapeHtml(TONE_RU[d.tone] || d.tone)})`,
    `Риск: <b>${d.risk}</b> — ${escapeHtml(d.reasons.join('; '))}`,
    d.flags.length ? `Пометки: ${escapeHtml(d.flags.join(', '))}` : '',
    `Кому: ${escapeHtml(d.email)}`,
    '',
    `<b>${escapeHtml(d.subject)}</b>`,
    escapeHtml(d.body).slice(0, 3000),
    '',
    `Черновик ${d.draft_id}. Чтобы изменить текст — нажмите «Изменить» или ответьте на это сообщение новым текстом.`,
  ].filter((x) => x !== '').join('\n'),
} }));
