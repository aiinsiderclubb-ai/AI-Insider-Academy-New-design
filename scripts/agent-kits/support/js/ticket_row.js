// Ticket Row: строка для листа Tickets.
// Колонки: created | ticket_id | status | priority | topic | summary | name | contact | channel | session_id
const { input } = $('Config').first().json;
const priorities = { low: 'low', normal: 'normal', high: 'high', urgent: 'urgent', низкий: 'low', обычный: 'normal', высокий: 'high', срочный: 'urgent' };
const priority = priorities[String(input.priority || '').toLowerCase()] || 'normal';
const ticket_id = 'T-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36 ** 2).toString(36).toUpperCase().padStart(2, '0');
const contact = [input.email, input.customer_contact].filter(Boolean).join(' · ');
const row = [
  new Date().toISOString(),
  ticket_id,
  'open',
  priority,
  String(input.topic || '').slice(0, 200),
  String(input.summary || '').slice(0, 2000),
  String(input.customer_name || ''),
  contact,
  input.channel || '',
  input.session_id || '',
];
return [{ json: { ticket_id, priority, row } }];
