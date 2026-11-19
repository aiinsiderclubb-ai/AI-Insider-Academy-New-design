// Handoff Alert: сообщение команде, когда агент передаёт диалог человеку.
// @include text.js
const { input } = $('Config').first().json;
const urgency = { high: '🔴', normal: '🟡', low: '⚪️' }[String(input.urgency || '').toLowerCase()] || '🟡';
const lines = [
  `<b>${urgency} Передача человеку</b>`,
  `Канал: ${input.channel === 'telegram' ? 'Telegram' : 'веб'} · <code>${escapeHtml(input.session_id)}</code>`,
  input.customer_name && `Имя: ${escapeHtml(input.customer_name)}`,
  input.customer_contact && `Контакт: ${escapeHtml(input.customer_contact)}`,
  '',
  `<b>Причина:</b> ${escapeHtml(input.reason || 'не указана')}`,
  `<b>Суть:</b> ${escapeHtml(input.summary || '')}`,
  input.last_message && `\n<blockquote>${escapeHtml(input.last_message)}</blockquote>`,
].filter(Boolean);
return [{ json: { alert_html: lines.join('\n') } }];
