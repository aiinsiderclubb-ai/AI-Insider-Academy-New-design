// Return Policy: решает по правилам из Config, можно ли вернуть. Деньги не возвращает никогда.
// Итог: eligible — подходит по правилам, ineligible — не подходит, needs_human — решает менеджер.
// @include text.js
const { config, input } = $('Config').first().json;
const r = $input.first().json;
const rules = config.returns;
const now = Date.now();
function out(decision, extra) {
  const asked = input.tool === 'create_return_request';
  const create = asked && (extra.create ?? (decision !== 'ineligible' && decision !== 'unknown'));
  const note = asked && !create ? `Заявка НЕ создана. ${extra.note || ''}` : extra.note;
  return [{ json: { tool: input.tool, decision, ...extra, create, note } }];
}

if (r.service_error) {
  return out('unknown', { create: false, service_error: r.service_error, note: 'Магазин сейчас не отвечает. Предложи передать вопрос менеджеру (handoff_to_human).' });
}
if (!r.found) return out('unknown', { create: false, note: 'Заказ не найден. Попроси клиента проверить номер заказа.' });
if (!r.verified) return out('unknown', { create: false, note: 'Email не совпадает с заказом. Ничего не сообщай о заказе, попроси email, указанный при оформлении.' });

const o = r.order;
const reasons = [];
const reason = String(input.reason || '');
const condition = String(input.condition || 'unknown').toLowerCase();
const DEFECT = /(брак|слом|полом|поврежд|разбит|трещин|не работа|не включа|дефект|не тот|не та |не то |другой товар|перепутал|недоклад|не хватает|defect|broken|damag|wrong item|missing)/i;
const defect = DEFECT.test(reason) || condition === 'damaged';

// какие товары
const wanted = String(input.items || '').trim();
let items = o.items;
if (wanted && !/^(все|всё|весь заказ|all)$/i.test(wanted)) {
  const asked = wanted.split(/[,;]|\sи\s/).map((s) => terms(s)).filter((t) => t.length);
  const picked = o.items.filter((it) => {
    const t = new Set(terms(it.title));
    return asked.some((a) => a.filter((w) => t.has(w)).length >= Math.min(2, a.length));
  });
  if (picked.length) items = picked;
  else reasons.push(`Не нашёл в заказе «${wanted}» — проверь название с клиентом.`);
}

const deliveredDays = o.delivered_at ? Math.floor((now - Date.parse(o.delivered_at)) / 86400000) : null;
const deadline = o.delivered_at ? new Date(Date.parse(o.delivered_at) + rules.window_days * 86400000).toISOString().slice(0, 10) : '';
const finalSale = o.tags.some((t) => rules.final_sale_tags.map((x) => x.toLowerCase()).includes(t));
const blocked = items.filter((it) =>
  rules.non_returnable_types.some((t) => t.toLowerCase() === String(it.type).toLowerCase()) ||
  it.tags.some((t) => rules.final_sale_tags.map((x) => x.toLowerCase()).includes(t)));
const allowed = finalSale ? [] : items.filter((it) => !blocked.includes(it));
const base = { order_id: o.order_id, items: items.map((i) => i.title), allowed_items: allowed.map((i) => i.title), deadline, delivered_days: deliveredDays };

if (o.cancelled) return out('ineligible', { ...base, reasons: ['Заказ отменён — возвращать нечего.'], create: false, note: 'Объясни, что заказ отменён. Если клиент видит списание — передай менеджеру.' });
if (o.refunded) return out('ineligible', { ...base, reasons: ['По заказу уже оформлен возврат денег.'], create: false, note: 'Скажи, что возврат уже оформлен; вопросы по срокам зачисления — менеджеру.' });
if (deliveredDays === null) {
  return out('needs_human', { ...base, reasons: ['Заказ ещё не доставлен.'], note: 'Заказ ещё в пути. Подскажи, что от посылки можно отказаться при получении; если клиент хочет отменить — передай менеджеру.' });
}
if (defect) {
  return out('needs_human', { ...base, reasons: ['Брак, повреждение или не тот товар — решает менеджер после фото.'], priority: 'high',
    note: 'Попроси фото товара и упаковки. Создай заявку (create_return_request), менеджер решит: замена или возврат. Ничего не обещай.' });
}
if (deliveredDays > rules.window_days) {
  return out('ineligible', { ...base, reasons: [`Прошло ${deliveredDays} дн. с доставки, срок возврата — ${rules.window_days} дн.`],
    note: 'Объясни срок вежливо. Если клиент не согласен — предложи передать менеджеру.' });
}
if (finalSale || !allowed.length) {
  return out('ineligible', { ...base, reasons: [finalSale ? 'Товар из финальной распродажи — возврату не подлежит.' : `Не возвращаются: ${blocked.map((b) => b.title).join(', ')}.`],
    note: 'Объясни, почему эти товары не возвращаются. Если клиент не согласен — передай менеджеру.' });
}
if (rules.require_unused && condition === 'used') {
  return out('ineligible', { ...base, reasons: ['Товар был в использовании — по правилам магазина возврат только неиспользованного.'],
    note: 'Объясни правило. Если клиент считает, что это брак, — уточни и проверь снова.' });
}
if (o.total > rules.human_review_over) reasons.push(`Сумма заказа выше ${rules.human_review_over} — проверяет менеджер.`);
if (blocked.length) reasons.push(`Не возвращаются: ${blocked.map((b) => b.title).join(', ')}.`);
if (condition === 'unknown') reasons.push('Не знаю, был ли товар в использовании — уточни у клиента.');

const decision = o.total > rules.human_review_over ? 'needs_human' : 'eligible';
return out(decision, {
  ...base,
  reasons: reasons.length ? reasons : [`Подходит: ${rules.window_days} дн. с доставки, товар можно вернуть до ${deadline}.`],
  create: condition !== 'unknown',
  note: decision === 'eligible'
    ? `По правилам возврат возможен до ${deadline}. Заявку создавай только после согласия клиента, с причиной и состоянием товара. Деньги возвращает менеджер после получения и проверки товара — не обещай ни сумму, ни срок.`
    : 'Нужна проверка менеджера. Создай заявку после согласия клиента. Не обещай результат.',
});
