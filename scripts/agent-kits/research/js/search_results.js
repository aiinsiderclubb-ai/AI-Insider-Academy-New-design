// Search Results: результаты поиска для модели — без запрещённых доменов, с кодами для ссылок.
// @include text.js
// @include web.js
const { config, input } = $('Config').first().json;
const res = $input.first().json;
if (res.error) {
  return [{ json: { ok: false, results: [], service_error: String(res.error.message || res.error).slice(0, 300), note: 'Поиск сейчас недоступен. Не продолжай по памяти: заверши отчёт тем, что уже собрано, и честно напиши, что поиск не сработал.' } }];
}
const seen = new Set();
const results = [];
for (const r of res.results || []) {
  const host = hostOf(r.url);
  if (!host || matchesDomain(host, config.blocked_domains) || seen.has(r.url)) continue;
  seen.add(r.url);
  results.push({
    ref: `[${refOf(r.url)}]`,
    title: String(r.title || host).slice(0, 200),
    url: r.url,
    domain: host,
    preferred: matchesDomain(host, config.preferred_domains),
    published: r.published_date || '',
    snippet: String(r.content || '').replace(/\s+/g, ' ').slice(0, 600),
  });
}
results.sort((a, b) => Number(b.preferred) - Number(a.preferred));
const top = results.slice(0, config.results_per_search);
return [{ json: {
  ok: true,
  query: input.query,
  results: top,
  note: top.length
    ? 'Это сниппеты, а не страницы. Важные факты проверь через fetch_page. Ссылайся на источник его кодом, например [s1a2b].'
    : 'Ничего не найдено. Переформулируй запрос или сузь тему. Если и это не помогает — так и напиши в отчёте.',
} }];
