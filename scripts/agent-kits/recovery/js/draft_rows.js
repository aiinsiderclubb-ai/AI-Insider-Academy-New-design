// Draft Rows: черновики — в лист Drafts одной записью.
// Drafts: draft_id | created | invoice_id | step | tone | risk | reasons | to | subject | body | status | decided_at | decided_by
const now = new Date().toISOString();
const rows = $input.all().map(({ json: d }) => [d.draft_id, now, d.invoice_id, String(d.step), d.tone, d.risk, d.reasons.join('; '),
  d.email, d.subject, d.body, 'pending', '', '']);
return [{ json: { rows } }];
