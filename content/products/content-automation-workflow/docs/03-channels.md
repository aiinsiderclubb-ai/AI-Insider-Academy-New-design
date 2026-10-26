# Каналы

Каналы описываются в Config → `channels`. Ключ (`telegram`, `blog`, `linkedin`) — то, что пишется в колонку `channel` таблицы. Каналов одного типа может быть несколько: `telegram_ru` и `telegram_en`, `blog` и `blog_shop`.

Общие поля:

- `type` — `telegram`, `wordpress` или `webhook`;
- `max_chars` — предел длины. Черновик длиннее не принимается, бот пишет заново;
- `style` — формат для модели. Это главная настройка качества: длина, структура, первая строка, эмодзи, хэштеги.

## Telegram-канал

```json
"telegram": {
  "type": "telegram",
  "chat_id": "@mychannel",
  "link_base": "https://t.me/mychannel",
  "max_chars": 2000,
  "style": "пост для Telegram-канала: 600–1500 знаков, короткие абзацы, первая строка цепляет, без Markdown-разметки"
}
```

- Бот — администратор канала с правом публиковать.
- Для закрытого канала `chat_id` — числовой id (начинается с `-100`), `link_base` — `https://t.me/c/ЧИСЛО` без `-100`.
- Картинка из `image_url`: если текст до 1024 знаков — фото с подписью; если длиннее — фото, затем текст отдельным сообщением.
- Текст публикуется как есть, без разметки — поэтому в `style` сказано «без Markdown».

## WordPress

```json
"blog": {
  "type": "wordpress",
  "url": "https://myblog.com",
  "status": "draft",
  "max_chars": 12000,
  "style": "статья для блога 4000–8000 знаков в Markdown: ## подзаголовки, списки, короткие абзацы, вывод в конце"
}
```

- Запись создаётся через REST API: `https://myblog.com/wp-json/wp/v2/posts`.
- `status: "draft"` — запись появится черновиком в WordPress, опубликуете вы; `"publish"` — сразу на сайте. Для начала оставьте `draft`.
- Модель пишет в Markdown; подзаголовки, абзацы, списки, жирный и ссылки превращаются в HTML.
- Картинка из `image_url` вставляется в начало статьи. Обложку записи (featured image) задайте в WordPress.

## Вебхук: LinkedIn, Instagram, Facebook, X и всё остальное

```json
"linkedin": {
  "type": "webhook",
  "url": "https://hook.eu2.make.com/ваш-адрес",
  "max_chars": 3000,
  "style": "деловой пост для LinkedIn: 800–1500 знаков, первая строка — тезис, абзацы по 1–2 предложения, вопрос к читателю в конце"
}
```

Публикация в эти сети требует одобренного приложения у каждой платформы. Проще отдать текст сервису, у которого такое приложение уже есть. Publisher отправляет POST с JSON:

```json
{ "id": "…", "channel": "linkedin", "title": "…", "text": "…", "image_url": "…", "topic": "…", "publish_at": "2026-10-29 09:00" }
```

- **Make:** сценарий Custom webhook → модуль LinkedIn / Instagram / Facebook «Create a post» → Webhook response с `{"url": "ссылка на пост"}`.
- **Zapier:** Catch Hook → нужное приложение.
- **Свой сервер:** любой адрес, который принимает JSON.

Ответ 2xx — `published`; поле `url` или `link` из ответа попадёт в колонку `link`. Любой другой ответ — `failed` и текст ошибки. Адрес вебхука Make или Zapier — по сути пароль: не публикуйте его.

## Слоты

```json
"slots": [
  { "day": "mon", "time": "10:00", "channel": "telegram" },
  { "day": "fri", "time": "18:00", "channel": "telegram", "pillar": "Изнутри" },
  { "day": "sat", "time": "11:00", "channel": "blog" }
]
```

`pillar` — рубрика для этого слота; без него модель выбирает сама. Слот, на который уже есть строка с тем же каналом и временем, пропускается.
