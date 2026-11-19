// Canned: ответ без модели — помощь, отказ, лимит, нет доступа.
// @include text.js
const g = $input.first().json;
let alert_html = '';
if (g.kind === 'refused' || g.kind === 'no_access') {
  const c = g.customer || {};
  alert_html = [
    `<b>${g.kind === 'refused' ? '🚫 Исследование отклонено' : '🔒 Запрос без доступа'}</b>`,
    g.reason && `Причина: ${escapeHtml(g.reason)}`,
    `Кто: ${escapeHtml(g.requester || '')} ${escapeHtml(c.name || '')} ${escapeHtml(c.telegram || '')}`.trim(),
    '',
    `<blockquote>${escapeHtml((g.text || '').slice(0, 500))}</blockquote>`,
  ].filter(Boolean).join('\n');
}
const status = { refused: 'refused', limit: 'limited', no_access: 'denied' }[g.kind] || 'info';
return [{ json: {
  channel: g.channel, chat_id: g.customer?.chat_id ?? null, reply: g.reply, reply_html: escapeHtml(g.reply),
  alert_html, response: { status, reply: g.reply },
} }];
