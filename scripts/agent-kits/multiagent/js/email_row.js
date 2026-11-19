// Email Row: разбор письма для листа Inbox.
// Колонки: received | from | subject | category | priority | summary | draft_reply | status | session_id
// @include text.js
const { input } = $('Config').first().json;
const categories = ['lead', 'support', 'billing', 'partner', 'spam', 'other'];
const category = categories.includes(String(input.category).toLowerCase()) ? String(input.category).toLowerCase() : 'other';
const priority = ['low', 'normal', 'high', 'urgent'].includes(String(input.priority).toLowerCase()) ? String(input.priority).toLowerCase() : 'normal';
const row = [
  new Date().toISOString(), input.customer_contact || '', input.email_subject || '', category, priority,
  String(input.summary || '').slice(0, 1000), category === 'spam' ? '' : String(input.draft_reply || '').slice(0, 4000),
  category === 'spam' ? 'spam' : 'draft', input.session_id || '',
];
const alert_html = priority === 'urgent' || priority === 'high' ? [
  `<b>📧 ${priority === 'urgent' ? 'Срочное' : 'Важное'} письмо · ${escapeHtml(category)}</b>`,
  `От: ${escapeHtml(input.customer_contact || '')}`,
  `Тема: ${escapeHtml(input.email_subject || '')}`,
  '',
  escapeHtml(input.summary || ''),
  '',
  'Черновик ответа — в листе Inbox.',
].join('\n') : '';
return [{ json: { category, priority, row, alert_html } }];
