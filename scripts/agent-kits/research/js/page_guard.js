// Page Guard: можно ли читать этот адрес — только http(s), без локальной сети, без запрещённых доменов.
// @include web.js
const { config, input } = $('Config').first().json;
const url = String(input.url || '').trim();
const host = hostOf(url);
let reason = '';
if (!/^https?:\/\//i.test(url) || !host) reason = 'адрес должен начинаться с http:// или https://';
else if (!config.allow_private_hosts && isPrivateHost(host)) reason = 'адреса локальной сети читать нельзя';
else if (matchesDomain(host, config.blocked_domains)) reason = `домен ${host} в списке запрещённых`;
else if (/\.(zip|rar|7z|exe|dmg|apk|mp4|mp3|avi|mov|iso|bin)(\?|$)/i.test(url)) reason = 'это файл, а не страница';
return [{ json: { allowed: !reason, url, host, ref: `[${refOf(url)}]`, reason } }];
