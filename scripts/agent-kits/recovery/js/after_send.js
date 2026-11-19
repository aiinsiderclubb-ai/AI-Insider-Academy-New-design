// After Send: письмо не ушло — черновик помечается failed, счёт не трогаем.
const a = $('Telegram Act').first().json;
const res = $input.first().json;
if (!res.error) return [{ json: a }];
const err = String(res.error.message || res.error).slice(0, 200);
const updates = a.updates.filter((u) => u.range.startsWith('Drafts!')).map((u) => {
  const row = [...u.values[0]];
  row[10] = 'failed';
  row[12] = 'smtp: ' + err;
  return { range: u.range, values: [row] };
});
return [{ json: { ...a, action: 'reply', updates, activity: a.activity.map((r) => [r[0], r[1], 'send_failed', err, r[4]]),
  notice: `❌ Не отправлено ${a.draft_id}: ${err}. Черновик помечен failed — проверьте SMTP и создайте напоминание заново завтра.` } }];
