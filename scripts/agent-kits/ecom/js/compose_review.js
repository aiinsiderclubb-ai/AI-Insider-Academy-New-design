// Compose Review Email: просьба об отзыве — один раз на заказ, без скидок за отзыв.
// @include text.js
// @include hmac.js
// @include mailer.js
const { config } = $('Config').first().json;
const plans = $input.all().map((i) => i.json);
return plans.map((p, i) => {
  const what = p.items.length === 1 ? `«${p.items[0]}»` : 'ваш заказ';
  const text = [
    `${p.name ? p.name + ', з' : 'З'}дравствуйте!`, '',
    `Надеемся, ${what} уже радует. Расскажите, как он вам — это займёт минуту и поможет другим покупателям выбрать.`, '',
    `Оставить отзыв: ${p.url}`, '',
    'Если что-то не так с заказом — просто ответьте на это письмо, разберёмся.', config.store_name, '', '—',
    `Не хотите получать такие письма: ${unsubLink(config, p.email)}`,
  ].join('\n');
  return { json: { ...p, subject: `Как вам покупка в ${config.store_name}?`, text } };
});
