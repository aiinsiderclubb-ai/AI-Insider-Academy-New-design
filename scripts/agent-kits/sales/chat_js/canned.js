// Canned: ответ без модели (приветствие, лимит, просьба позвать человека).
// @include text.js
const g = $input.first().json;
const alerts = {
  handoff: '🙋 Клиент просит человека',
  forward: '💬 Новое сообщение в диалоге, переданном вам',
};
const title = alerts[g.kind];
let alert_html = '';
if (title) {
  const c = g.customer || {};
  alert_html = [
    `<b>${title}</b>`,
    `Канал: ${g.channel === 'telegram' ? 'Telegram' : 'сайт'} · <code>${escapeHtml(g.session_id)}</code>`,
    c.name && `Имя: ${escapeHtml(c.name)}`,
    c.email && `Email: ${escapeHtml(c.email)}`,
    c.phone && `Телефон: ${escapeHtml(c.phone)}`,
    c.telegram && `Telegram: ${escapeHtml(c.telegram)}`,
    '',
    `<blockquote>${escapeHtml(g.text || '')}</blockquote>`,
    g.flags?.includes('daily_limit') ? '\n⚠️ Исчерпан дневной лимит ответов модели (daily_agent_runs).' : '',
  ].filter((x) => x !== false && x !== undefined && x !== null).join('\n').trim();
}
return [{ json: {
  kind: g.kind,
  channel: g.channel,
  session_id: g.session_id,
  customer: g.customer,
  text: g.text || '',
  reply: g.reply,
  reply_html: escapeHtml(g.reply),
  handoff: g.kind === 'handoff' || g.kind === 'forward',
  alert_html,
  tools: [],
  flags: g.flags || [],
  expose: {},
  debug: Boolean(g.debug),
} }];
