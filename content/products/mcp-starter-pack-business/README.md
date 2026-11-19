# MCP Starter Pack for Business

Готовые и проверенные подключения AI-агента к четырём рабочим системам: CRM HubSpot, база Postgres, Slack и GitHub. Для Claude Code, Claude Desktop, Cursor и n8n. С безопасными настройками по умолчанию: где можно — только чтение.

## Зачем этот набор

Половина инструкций по MCP в интернете до сих пор ставит серверы `@modelcontextprotocol/server-postgres`, `-slack` и `-github`. Их перенесли в архив ещё в 2025 году: без обновлений безопасности, со старой версией протокола. В этом наборе — только поддерживаемые серверы на ноябрь 2026:

| Система | Сервер | Как подключается |
|---|---|---|
| HubSpot | официальный удалённый, `https://mcp.hubspot.com` | OAuth через ваш MCP-коннектор HubSpot |
| Postgres | DBHub (`@bytebase/dbhub`, версия 2) — поддерживаемый открытый сервер | локально, режим «только чтение» в `dbhub.toml` |
| Slack | официальный удалённый, `https://mcp.slack.com/mcp` | OAuth через ваше внутреннее Slack-приложение |
| GitHub | официальный `github/github-mcp-server` — удалённый или в Docker | токен GitHub, адрес `/mcp/readonly` |

## Что внутри

- `clients/claude-code.mcp.json` и `clients/claude-code-add.sh` — Claude Code: файл проекта или команды.
- `clients/claude-desktop.json` — Claude Desktop: Postgres и GitHub локально; HubSpot и Slack — через встроенные коннекторы.
- `clients/cursor.mcp.json` — Cursor.
- `clients/n8n-agent-mcp.n8n.json` — n8n: AI Agent с тремя узлами MCP Client.
- `configs/dbhub.toml` — DBHub: только чтение, лимит строк, таймауты.
- `configs/postgres-readonly-role.sql.txt` — SQL роли Postgres только для чтения: последняя линия защиты.
- `scripts/check_mcp_config.py` — проверка ваших MCP-конфигов: архивные серверы, токены в файлах, http без шифрования, запись там, где хватит чтения.
- `prompts/sample-prompts.md` — 24 рабочих запроса к агенту по каждой системе и между ними.
- `docs/` — по одной инструкции на систему, n8n, безопасность.

## Как мы проверяли

- **Postgres:** DBHub 2.0.0 с нашим `dbhub.toml` и ролью из нашего SQL — на настоящем Postgres 17 в Docker, через официальный MCP Inspector, по stdio и HTTP с токеном. SELECT работает, UPDATE и DELETE отклоняет сам DBHub, а роль отклоняет запись и без него — данные не изменились.
- **n8n:** воркфлоу из `clients/` запускался в n8n 2.48. Узел MCP Client вызвал DBHub по HTTP: ответил на SELECT из Postgres и отказал в DELETE. Модель в этой проверке была подменной.
- **GitHub:** локальный сервер 2.2.0 из Docker в режиме только чтения отдал 22 инструмента и ни одного на запись. Удалённый адрес отвечает и требует авторизацию.
- **HubSpot, Slack:** адреса серверов отвечают и публикуют OAuth-метаданные по стандарту MCP.
- **Claude Code:** `clients/claude-code.mcp.json` совпадает с файлом, который пишет сам Claude Code 2.1.234 командами из `claude-code-add.sh`.
- **Проверка конфигов** находит архивные серверы, токены в файле и http без шифрования; наши конфиги проходят её без ошибок.

**Что мы не проверяли:** вход и работу с вашими аккаунтами HubSpot, Slack и GitHub — у нас нет ваших OAuth-приложений и данных; интерфейсы Claude Desktop и Cursor — их конфиги собраны по документации этих программ.

## Что нужно

- Node.js 22.5 или новее — для DBHub.
- Docker — если GitHub нужен локально (для Claude Desktop).
- Python 3.8+ — для проверки конфигов.
- Доступы: администратор HubSpot (создать MCP-коннектор), администратор Slack (создать и одобрить приложение), токен GitHub, роль в Postgres.

## С чего начать

1. `QUICKSTART.md` — подключение за вечер.
2. `CONTENTS.md` — что где лежит.

## Лицензия

Можно использовать в своём бизнесе и внедрять клиентам. Нельзя перепродавать набор и выкладывать его в открытый доступ.

Версия 1.0.0.
