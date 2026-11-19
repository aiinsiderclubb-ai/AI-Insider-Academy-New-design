// Telegram Act: кнопки под черновиками и команды. Отправка — только по нажатию «Отправить»,
// и только если счёт всё ещё не оплачен и не остановлен.
// @include text.js
// @include inv.js
const { config, input } = $('Config').first().json;
const sheets = $input.first().json.valueRanges || [];
const now = new Date();
const day = today(config, now.getTime());
const all = invoices(sheets[0]?.values);
const drafts = sheetRows(sheets[1]?.values);
const approvers = config.approver_chat_ids.map(String);

const cb = input.callback_query;
const msg = input.message || input.edited_message;
const chat_id = String(cb?.message?.chat?.id ?? msg?.chat?.id ?? '');
const user = cb?.from || msg?.from || {};
const who = [user.first_name, user.last_name].filter(Boolean).join(' ') || String(user.id || '');
const base = { chat_id, callback_id: cb?.id || '', updates: [], activity: [], reply_text: '', action: 'reply' };

if (!chat_id) return [{ json: { ...base, action: 'ignore' } }];
if (!approvers.includes(chat_id) && !approvers.includes(String(user.id))) {
  return [{ json: { ...base, action: cb ? 'reply' : 'ignore', reply_text: cb ? 'Нет доступа' : '' } }];
}

const DRAFT_COLS = ['draft_id', 'created', 'invoice_id', 'step', 'tone', 'risk', 'reasons', 'to', 'subject', 'body', 'status', 'decided_at', 'decided_by'];
const draftRow = (d) => DRAFT_COLS.map((k) => String(d[k] ?? ''));
const setDraft = (d, patch) => {
  Object.assign(d, patch);
  base.updates.push({ range: `Drafts!A${d._row}:M${d._row}`, values: [draftRow(d)] });
};
const setInvoice = (inv, patch) => {
  Object.assign(inv, patch);
  base.updates.push({ range: `Invoices!A${inv._row}:P${inv._row}`, values: [invoiceRow(inv)] });
};
const act = (invoice_id, action, detail) => base.activity.push([now.toISOString(), invoice_id, action, String(detail).slice(0, 500), who]);
const cancelDrafts = (invoice_id, why) => {
  for (const d of drafts.filter((x) => x.invoice_id === invoice_id && ['pending', 'editing'].includes(x.status))) {
    setDraft(d, { status: 'cancelled', decided_at: now.toISOString(), decided_by: why });
  }
};
const signature = ['', config.payment_details, '', 'С уважением,', config.sender_name, config.company].join('\n');
const out = (extra) => [{ json: { ...base, ...extra } }];

// ---------- кнопки ----------
if (cb) {
  const m = /^(send|edit|skip):(D-[A-Z0-9]+)$/.exec(String(cb.data || ''));
  const d = m && drafts.find((x) => x.draft_id === m[2]);
  if (!d) return out({ reply_text: 'Черновик не найден' });
  if (!['pending', 'editing'].includes(d.status)) return out({ reply_text: `Уже обработан: ${d.status}` });
  const inv = all.find((x) => x.invoice_id === d.invoice_id);
  if (m[1] === 'skip') {
    setDraft(d, { status: 'skipped', decided_at: now.toISOString(), decided_by: who });
    act(d.invoice_id, 'skipped', d.draft_id);
    return out({ reply_text: 'Пропущено', notice: `⏭ ${d.draft_id} по счёту ${d.invoice_id} пропущен.` });
  }
  if (m[1] === 'edit') {
    setDraft(d, { status: 'editing' });
    return out({ action: 'ask_edit', reply_text: 'Пришлите новый текст ответом', draft_id: d.draft_id,
      notice: `✏️ Черновик ${d.draft_id}. Ответьте на это сообщение новым текстом письма — без подписи и реквизитов, их добавлю сам.` });
  }
  // send
  const stop = inv ? stopReason(inv, day) : 'счёт не найден в листе Invoices';
  if (stop) {
    setDraft(d, { status: 'cancelled', decided_at: now.toISOString(), decided_by: 'stop: ' + stop });
    act(d.invoice_id, 'not_sent', stop);
    return out({ reply_text: 'Не отправлено', notice: `⛔️ Не отправил ${d.draft_id}: ${stop}.` });
  }
  setDraft(d, { status: 'sent', decided_at: now.toISOString(), decided_by: who });
  setInvoice(inv, { stage: String(Math.max(inv.stage_n, Number(d.step) || 0)), last_contact: day });
  act(d.invoice_id, 'sent', `${d.draft_id} → ${d.to}`);
  return out({ action: 'send', reply_text: 'Отправляю', draft_id: d.draft_id,
    email: { to: d.to, subject: d.subject, text: d.body },
    notice: `✅ Отправлено: ${d.draft_id}, счёт ${d.invoice_id} → ${d.to}` });
}

// ---------- новый текст ответом на карточку ----------
const text = String(msg?.text || '').trim();
const replied = String(msg?.reply_to_message?.text || '');
const ref = /Черновик (D-[A-Z0-9]+)/.exec(replied);
if (ref && text && !text.startsWith('/')) {
  const d = drafts.find((x) => x.draft_id === ref[1]);
  if (!d || !['pending', 'editing'].includes(d.status)) return out({ notice: 'Этот черновик уже обработан.' });
  setDraft(d, { body: text.slice(0, 3000) + '\n' + signature, status: 'pending' });
  act(d.invoice_id, 'edited', d.draft_id);
  const inv = all.find((x) => x.invoice_id === d.invoice_id);
  return out({ action: 'card', draft_id: d.draft_id, card: [
    `<b>✏️ ${escapeHtml(inv?.client || '')} · счёт ${escapeHtml(d.invoice_id)} — новый текст</b>`,
    `Кому: ${escapeHtml(d.to)}`, '', `<b>${escapeHtml(d.subject)}</b>`, escapeHtml(d.body).slice(0, 3000), '',
    `Черновик ${d.draft_id}. Чтобы изменить текст — нажмите «Изменить» или ответьте на это сообщение новым текстом.`,
  ].join('\n') });
}

// ---------- команды ----------
const [cmd, id, ...rest] = text.split(/\s+/);
const inv = id && all.find((x) => x.invoice_id.toLowerCase() === id.toLowerCase());
const help = [
  'Команды:',
  '/paid СЧЁТ [ГГГГ-ММ-ДД] — оплачен',
  '/promise СЧЁТ ГГГГ-ММ-ДД — клиент обещал оплатить к дате',
  '/dispute СЧЁТ [причина] — клиент оспаривает, напоминания стоп',
  '/pause СЧЁТ, /resume СЧЁТ — пауза и снятие паузы',
  '/status СЧЁТ — что со счётом',
].join('\n');
if (!cmd || !cmd.startsWith('/') || cmd === '/help' || cmd === '/start') return out({ notice: help });
if (!inv) return out({ notice: id ? `Счёт ${id} не найден в листе Invoices.` : help });

if (cmd === '/paid') {
  const date = parseDate(rest[0]) || day;
  setInvoice(inv, { status: 'paid', paid_at: date });
  cancelDrafts(inv.invoice_id, 'paid');
  act(inv.invoice_id, 'paid', date);
  return out({ notice: `💰 ${inv.invoice_id} отмечен оплаченным ${date}. Напоминания по нему остановлены.` });
}
if (cmd === '/promise') {
  const date = parseDate(rest[0]);
  if (!date || date < day) return out({ notice: 'Нужна будущая дата: /promise СЧЁТ ГГГГ-ММ-ДД' });
  setInvoice(inv, { promise_date: date });
  cancelDrafts(inv.invoice_id, 'promise');
  act(inv.invoice_id, 'promise', date);
  return out({ notice: `🤝 ${inv.invoice_id}: ждём оплату до ${date}. Если её не будет — напоминания продолжатся, риск вырастет.` });
}
if (cmd === '/dispute') {
  const note = rest.join(' ');
  setInvoice(inv, { disputed: 'yes', notes: [inv.notes, note && `спор: ${note}`].filter(Boolean).join('; ') });
  cancelDrafts(inv.invoice_id, 'dispute');
  act(inv.invoice_id, 'dispute', note || '—');
  return out({ notice: `⚠️ ${inv.invoice_id}: спор. Напоминания остановлены, пока не выполните /resume.` });
}
if (cmd === '/pause') {
  setInvoice(inv, { paused: 'yes' });
  cancelDrafts(inv.invoice_id, 'pause');
  act(inv.invoice_id, 'pause', '');
  return out({ notice: `⏸ ${inv.invoice_id}: напоминания на паузе.` });
}
if (cmd === '/resume') {
  setInvoice(inv, { paused: '', disputed: '' });
  act(inv.invoice_id, 'resume', '');
  return out({ notice: `▶️ ${inv.invoice_id}: напоминания снова включены.` });
}
if (cmd === '/status') {
  const sent = drafts.filter((x) => x.invoice_id === inv.invoice_id && x.status === 'sent').length;
  const stop = stopReason(inv, day);
  return out({ notice: [
    `${inv.invoice_id} · ${inv.client} · ${fmtAmount(inv.amount_n)} ${inv.currency}`,
    `Срок: ${inv.due_d || '—'}${inv.due_d ? `, просрочка ${Math.max(0, daysBetween(inv.due_d, day))} дн.` : ''}`,
    `Отправлено напоминаний: ${sent}`,
    stop ? `Напоминания не идут: ${stop}` : 'Напоминания идут по графику',
  ].join('\n') });
}
return out({ notice: help });
