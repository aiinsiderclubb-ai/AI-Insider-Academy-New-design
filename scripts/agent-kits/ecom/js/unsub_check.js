// Unsubscribe Check: ссылка из письма подписана секретом — чужой адрес так не отписать.
// @include hmac.js
// @include mailer.js
const { config, input } = $('Config').first().json;
const q = input.query || {};
const email = String(q.e || '').trim().toLowerCase();
const ok = Boolean(email) && !config.unsubscribe_secret.startsWith('ЗАМЕНИТЕ') && String(q.s || '') === unsubSig(config, email);
const page = (title, text) => `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#111"><h1 style="font-size:22px">${title}</h1><p>${text}</p></body></html>`;
return [{ json: {
  ok,
  row: [new Date().toISOString(), email, 'unsubscribe link'],
  html: ok ? page('Вы отписаны', 'Больше не будем присылать письма о корзине и просьбы об отзывах. Письма о ваших заказах продолжат приходить.')
           : page('Ссылка недействительна', 'Не получилось отписаться по этой ссылке. Ответьте на любое наше письмо словом «отписаться» — сделаем вручную.'),
} }];
