// Check Draft: проверяет ответ модели. Что не прошло проверку — заменяется шаблоном,
// риск по правилам не может понизиться, письмо получает реквизиты и подпись из Config.
// @include text.js
// @include inv.js
const { config } = $('Config').first().json;
const plans = ($('Preview Plan').isExecuted ? $('Preview Plan') : $('Plan Invoices')).all().map((i) => i.json);
const answers = $input.all().map((i) => i.json);

// \b в JS не видит границу кириллического слова — поэтому (?<![а-яё]) и (?![а-яё])
const THREATS = [/(?<![а-яё])суд(?![а-яё])|(?<![а-яё])судеб|(?<![а-яё])иск(?![а-яё])|(?<![а-яё])исков|юрист|адвокат|коллектор|арбитраж|прокурат|полици|штраф|(?<![а-яё])пен(я|и|ю|ей|ям)(?![а-яё])|неустойк|кредитн[а-я]* истори|санкци|court|lawsuit|lawyer|attorney|collection agenc|debt collector|penalt|late fee|credit score/i];
const SHAMING = /(игнорир|нарушил|безответствен|недобросовест|вы обязаны немедленно)/i;
const DISCOUNT = /(скидк|рассрочк|списываем|прощаем|discount|write.?off)/i;

function parse(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; }
}

function amountIn(body, p) {
  const digits = String(body).replace(/[\s ]/g, '');
  const whole = String(Math.trunc(p.amount));
  return digits.includes(whole) || digits.includes(fmtAmount(p.amount).replace(/\s/g, ''));
}

function template(p) {
  const hi = p.contact_name ? `${p.contact_name}, добрый день!` : 'Добрый день!';
  const t = {
    friendly: `Напоминаем о счёте ${p.invoice_id} на ${p.amount_text}: срок оплаты был ${p.due}. Возможно, письмо затерялось — подскажите, пожалуйста, всё ли в порядке и когда планируете оплату?`,
    firm: `Счёт ${p.invoice_id} на ${p.amount_text} просрочен на ${p.overdue} дн. (срок был ${p.due}). Просим оплатить его или сообщить дату оплаты в ответ на это письмо.`,
    escalate: `Счёт ${p.invoice_id} на ${p.amount_text} не оплачен уже ${p.overdue} дн. Давайте найдём решение: можем созвониться и обсудить удобный график. Пожалуйста, ответьте в ближайшие дни.`,
    final: `Это последнее напоминание о счёте ${p.invoice_id} на ${p.amount_text}, срок оплаты которого истёк ${p.due}. Пожалуйста, оплатите счёт или свяжитесь с нами, чтобы договориться.`,
  }[p.tone] || '';
  return { subject: `Счёт ${p.invoice_id}: напоминание об оплате`, body: `${hi}\n\n${t}` };
}

const allowedText = [config.allow_late_fee && config.late_fee_text, config.allow_collection && config.collection_text].filter(Boolean);

return plans.map((p, i) => {
  const flags = [];
  const a = parse(answers[i]?.text ?? answers[i]?.output);
  let risk = p.rule_risk;
  let reasons = [...p.rule_reasons];
  let subject = '';
  let body = '';
  if (!a) flags.push('template:not_json');
  else {
    if (['low', 'medium', 'high'].includes(a.risk)) {
      if (RISK_ORDER[a.risk] > RISK_ORDER[risk]) {
        risk = a.risk;
        flags.push('risk_raised_by_model');
      }
      if (Array.isArray(a.reasons)) reasons = [...reasons, ...a.reasons.map(String).slice(0, 4).map((r) => 'модель: ' + r.slice(0, 160))];
    } else flags.push('bad_risk');
    subject = String(a.subject || '').replace(/\s+/g, ' ').trim();
    body = String(a.body || '').trim();
    let why = '';
    if (!subject || subject.length > 120) why = 'subject';
    else if (!body || body.length < 40) why = 'empty';
    else if (body.length > 2000) why = 'too_long';
    else if (!body.includes(p.invoice_id)) why = 'no_invoice_id';
    else if (!amountIn(body, p)) why = 'no_amount';
    else {
      // разрешённую формулировку из Config вырезаем перед проверкой — остальное грозить не должно
      let check = body;
      for (const t of allowedText) check = check.split(t).join('');
      if (THREATS.some((r) => r.test(check + ' ' + subject))) why = 'threat';
      else if (SHAMING.test(body)) why = 'shaming';
      else if (DISCOUNT.test(body)) why = 'discount';
      else if (/https?:\/\/|www\./i.test(body)) why = 'link';
    }
    if (why) flags.push('template:' + why);
  }
  if (flags.some((f) => f.startsWith('template:'))) ({ subject, body } = template(p));
  const full = [body, '', config.payment_details, '', 'С уважением,', config.sender_name, config.company].join('\n');
  const draft_id = 'D-' + Date.now().toString(36).toUpperCase().slice(-5) + i.toString(36).toUpperCase() + Math.floor(Math.random() * 36 ** 2).toString(36).toUpperCase().padStart(2, '0');
  return { json: { ...p, draft_id, risk, reasons, subject, body: full, flags } };
});
