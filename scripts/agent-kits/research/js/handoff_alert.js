// Handoff Alert: сообщение команде, когда агент передаёт диалог человеку.
// @include text.js
const { input } = $('Config').first().json;
const urgency = { high: '🔴', normal: '🟡', low: '⚪️' }[String(input.urgency || '').toLowerCase()] || '🟡';
const lines = [
  `<b>${urgency} Исследование: нужен человек</b>`,
  `Задание <code>${escapeHtml(input.job_id)}</code> · ${escapeHtml(input.requester)}`,
  '',
  `<b>Причина:</b> ${escapeHtml(input.reason || 'не указана')}`,
  `<b>Суть:</b> ${escapeHtml(input.summary || '')}`,
  input.last_message && `\n<blockquote>${escapeHtml(input.last_message)}</blockquote>`,
].filter(Boolean);
return [{ json: { alert_html: lines.join('\n') } }];
