# Поиск и источники

## Tavily

По умолчанию поиск — Tavily: API для поиска под AI-агентов, отдаёт заголовок, адрес, дату и фрагмент текста. Узел **Search API** делает:

```
POST https://api.tavily.com/search
Authorization: Bearer tvly-…

{"query": "…", "max_results": 10, "search_depth": "basic", "topic": "general",
 "include_answer": false, "time_range": "week"}
```

`time_range` добавляется, если агент попросил свежие результаты (`recent_days`): до 1 дня → `day`, до 7 → `week`, до 31 → `month`, больше → `year`. Узел построен по документации Tavily; с настоящим Tavily мы его не запускали — проверьте первым исследованием. `search_depth: advanced` даёт более точные фрагменты, но стоит дороже в кредитах Tavily.

## Другой поиск

Поиск меняется в двух узлах: **Search API** (запрос) и **Search Results** (разбор ответа). Search Results ждёт массив `results` с полями `title`, `url`, `content`, `published_date`. Для другого API замените одну строку в начале Search Results — где берутся результаты:

**Brave Search API** — `GET https://api.search.brave.com/res/v1/web/search?q=…&count=10`, заголовок `X-Subscription-Token`:

```js
const res = { results: ($input.first().json.web?.results || []).map((r) => ({ title: r.title, url: r.url, content: r.description, published_date: r.age })) };
```

**SearXNG** (свой сервер, бесплатно) — `GET https://ВАШ-SEARXNG/search?q=…&format=json`:

```js
const res = { results: ($input.first().json.results || []).map((r) => ({ title: r.title, url: r.url, content: r.content, published_date: r.publishedDate })) };
```

Exa, SerpAPI, Google Programmable Search — так же: свой запрос в Search API и одна строка разбора.

## Правила источников

- `blocked_domains` — результаты с этих доменов (и поддоменов) не доходят до модели, страницы не открываются.
- `preferred_domains` — такие результаты идут первыми. Сюда — регуляторы, статистические службы, отраслевые издания вашей сферы.
- Инструкция просит первоисточники, даты к цифрам и обе версии, если источники расходятся.
- `min_sources` — меньше разных доменов среди ссылок отчёта → «предварительный» с предупреждением в начале и сигнал команде.
- В списке источников видно, какие страницы агент прочитал, а какие видел только во фрагменте поиска: «по сниппету поиска». Такие ссылки — повод перепроверить.

## Что не читается

- страницы, которые собираются скриптами в браузере (текста в HTML почти нет) — агент получает «на странице почти нет текста» и берёт другой источник;
- страницы за входом, пейволом или защитой от ботов;
- PDF и файлы: `fetch_page` читает HTML. PDF-отчёт агент увидит только по фрагменту поиска.
