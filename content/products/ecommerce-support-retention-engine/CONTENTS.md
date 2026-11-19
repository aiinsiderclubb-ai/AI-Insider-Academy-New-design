# Состав набора

```
ecommerce-support-retention-engine/
├── README.md                       что это и что умеет
├── QUICKSTART.md                   запуск за 1,5–2 часа
├── CONTENTS.md                     этот файл
├── agent/
│   ├── system-prompt.md            инструкция ассистента; она же в узле AI Agent
│   ├── cart-copy-prompt.md         инструкция для первой фразы письма о корзине; она же в узле Cart Copy
│   ├── tools.openai.json           схемы пяти инструментов, формат OpenAI
│   └── tools.anthropic.json        те же схемы, формат Anthropic
├── workflows/
│   ├── store-engine.n8n.json       движок: ассистент, инструменты, корзины, отзывы, вебхуки
│   └── error-alert.n8n.json        сигнал об ошибке в Telegram
├── templates/
│   ├── policies.csv                14 демо-правил магазина товаров для дома
│   ├── orders-example.csv          6 демо-заказов для платформы «таблица» и для evals
│   ├── returns-header.csv          заголовки листа Returns
│   ├── carts-header.csv            заголовки листа Carts
│   ├── messages-header.csv         заголовки листа Messages
│   ├── suppress-header.csv         заголовки листа Suppress
│   ├── log-header.csv              заголовки листа Log
│   └── chat-widget.html            чат-виджет для сайта
├── evals/
│   ├── dataset.jsonl               30 случаев: правила, заказы, возвраты, передача, атаки
│   └── run_evals.py                прогон на вашем ассистенте (Python 3.8+, без пакетов)
└── docs/
    ├── 01-how-it-works.md          четыре части движка и путь каждого запроса
    ├── 02-setup.md                 все параметры Config, листы, ключи по платформам
    ├── 03-channels-and-events.md   чат, Telegram, API, события корзины, отписка
    ├── 04-returns.md               как работают правила возврата
    ├── 05-carts-and-reviews.md     правила рассылок, согласие, тексты
    ├── 06-retention-playbook.md    плейбук удержания: что запускать и как мерить
    ├── 07-models.md                OpenAI, совместимые API, Claude
    └── 08-evals-and-operations.md  проверка, журналы, неполадки
```

## Листы таблицы

| Лист | Кто пишет | Зачем |
|---|---|---|
| Policies | вы | правила магазина для ответов ассистента |
| Orders | вы или выгрузка | заказы — только для платформы «таблица» |
| Returns | ассистент | заявки на возврат: статус меняете вы |
| Carts | вебхук `store-cart-event` | корзины с сайтов без API корзин |
| Messages | движок | все письма о корзинах и отзывах |
| Suppress | ссылка «отписаться» и вы | кому больше не писать |
| Log | ассистент | все ответы ассистента |
