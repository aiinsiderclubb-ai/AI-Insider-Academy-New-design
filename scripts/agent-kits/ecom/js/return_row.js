// Return Row: строка для листа Returns.
// Колонки: created | rma | status | decision | order_id | email | items | reason | condition | reasons | session_id | channel
const { input } = $('Config').first().json;
const p = $input.first().json;
const rma = 'R-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36 ** 2).toString(36).toUpperCase().padStart(2, '0');
const row = [
  new Date().toISOString(), rma, p.decision === 'eligible' ? 'pending_review' : 'needs_human', p.decision,
  p.order_id, String(input.email || input.customer_email || ''), (p.allowed_items.length ? p.allowed_items : p.items).join('; '),
  String(input.reason || '').slice(0, 500), String(input.condition || ''), (p.reasons || []).join(' '),
  input.session_id || '', input.channel || '',
];
return [{ json: { ...p, rma, row } }];
