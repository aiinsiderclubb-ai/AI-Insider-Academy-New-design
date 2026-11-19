// Compose Cart Email: письмо о брошенной корзине. Первая фраза — от модели, если она прошла проверку,
// иначе из шаблона. Цены, скидки и ссылки модель не пишет: их подставляет шаблон.
// @include text.js
// @include hmac.js
// @include mailer.js
const { config } = $('Config').first().json;
const plans = $('Plan Carts').all().map((i) => i.json);
const ai = $('Cart Copy').isExecuted ? $input.all().map((i) => i.json) : [];
const forbidden = (config.forbidden || []).map((p) => new RegExp(p, 'iu'));

function checkLine(text, plan) {
  const line = String(text || '').trim().replace(/^["«]|["»]$/g, '');
  if (!line) return [null, 'empty'];
  if (line.length > 280) return [null, 'too_long'];
  if (/https?:|www\.|@/.test(line)) return [null, 'link'];
  if (/\d/.test(line)) return [null, 'numbers'];              // цены, проценты, сроки — только из шаблона
  if (/(скидк|промокод|купон|бесплатн|discount|coupon|free)/i.test(line)) return [null, 'discount'];
  if (/[{}<>]/.test(line)) return [null, 'markup'];
  if (forbidden.some((r) => r.test(line))) return [null, 'forbidden'];
  return [line, ''];
}

const out = plans.map((p, i) => {
  const name = p.name ? `${p.name}, з` : 'З';
  const fallback = p.step === 1
    ? 'вы выбрали товары, но не завершили заказ. Мы сохранили корзину — можно вернуться к ней в один клик.'
    : 'напоминаем о корзине: товары пока ждут вас, но наличие не резервируется.';
  const [line, rejected] = ai.length ? checkLine(ai[i]?.text, p) : [null, 'ai_off'];
  const opening = line || fallback;
  const subject = p.step === 1 ? `Вы оставили товары в корзине — ${config.store_name}` : `Ваша корзина в ${config.store_name} всё ещё ждёт`;
  const lines = [
    `${name}дравствуйте!`, '', line ? opening : opening.charAt(0).toUpperCase() + opening.slice(1), '',
    'В корзине:', ...p.items.map((t) => `• ${t}`), '',
    p.total ? `Сумма: ${p.total} ${p.currency}`.trim() : '',
    `Вернуться к заказу: ${p.url}`,
    p.discount_code ? `\nПромокод на этот заказ: ${p.discount_code}` : '',
    '', `Вопросы — просто ответьте на это письмо.`, config.store_name, '', '—',
    `Не хотите получать такие письма: ${unsubLink(config, p.email)}`,
  ];
  return { json: { ...p, subject, text: lines.join('\n').replace(/\n{3,}/g, '\n\n'), ai_used: Boolean(line), ai_rejected: line ? '' : rejected } };
});
return out;
