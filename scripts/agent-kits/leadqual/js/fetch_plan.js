// Fetch Plan: можно ли открыть эту страницу. Только сайт самого лида, только http(s), без внутренних адресов.
// @include url.js
const { config, input } = $('Config').first().json;
const res = (ok, extra) => [{ json: { ok, ...extra } }];
const url = parseUrl(input.url);
if (!url) return res(false, { result: { ok: false, note: 'Неверный адрес. Передай полный URL со страницы сайта лида, с http:// или https://.' } });
const host = url.hostname.toLowerCase().replace(/^www\./, '');
const domain = String(input.lead_domain || '').toLowerCase();
const privateHost = /^(localhost|.*\.local|.*\.internal|.*\.lan)$/.test(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^\[/.test(url.hostname) || /^\d+$/.test(host);
if (!/^https?:$/.test(url.protocol)) return res(false, { result: { ok: false, note: 'Только http и https.' } });
if (privateHost && !config.fetch_allow_private) return res(false, { result: { ok: false, note: 'Этот адрес открыть нельзя.' } });
if (!domain || !(host === domain || host.endsWith('.' + domain))) {
  return res(false, { result: { ok: false, note: `Открывать можно только сайт лида (${domain || 'сайта нет'}). Оценивай по тому, что уже известно.` } });
}
return res(true, { url: url.href });
