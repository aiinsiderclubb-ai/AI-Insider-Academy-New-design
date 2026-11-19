# Подключение за вечер

Не нужно подключать всё сразу. Начните с одной системы — обычно с базы или CRM, — проверьте её на запросах из `prompts/sample-prompts.md`, потом добавляйте следующую.

## 1. Выберите клиент

| Клиент | Для кого | Что подключается |
|---|---|---|
| Claude Code | разработчики, аналитики | все четыре системы через `.mcp.json` |
| Claude Desktop | менеджеры, руководители | HubSpot и Slack — встроенные коннекторы (Settings → Connectors); Postgres и GitHub — `clients/claude-desktop.json` |
| Cursor | разработчики | все четыре через `clients/cursor.mcp.json` |
| n8n | автоматизации без человека | все четыре через узлы MCP Client |

## 2. Postgres (40 минут)

1. Выполните `configs/postgres-readonly-role.sql.txt` от владельца базы, предварительно заменив пароль:
   `psql -d ВАША_БАЗА -f postgres-readonly-role.sql.txt`
2. В `configs/dbhub.toml` впишите адрес базы. Пароль — в переменную `AGENT_DB_PASSWORD`.
3. Проверьте: `AGENT_DB_PASSWORD=... npx -y @bytebase/dbhub@2 --config ./dbhub.toml` — в выводе должно быть `MCP server running on stdio` и замок 🔒 у `execute_sql`. Ctrl+C.

Подробно — `docs/03-postgres.md`.

## 3. GitHub (15 минут)

1. github.com → Settings → Developer settings → Fine-grained tokens: только нужные репозитории, права Contents, Issues, Pull requests — Read-only.
2. `export GITHUB_PAT=...` — дальше его подставит клиент.

Подробно — `docs/05-github.md`.

## 4. HubSpot (30 минут)

1. В HubSpot создайте MCP-коннектор: `docs/02-hubspot.md`. Redirect URL для Claude Code — `http://localhost:3118/callback`.
2. Сохраните Client ID и Client secret.

Для Claude Desktop и claude.ai ничего этого не нужно: Settings → Connectors → HubSpot.

## 5. Slack (30 минут, нужен администратор)

1. api.slack.com/apps → Create New App во своём рабочем пространстве — это «внутреннее приложение».
2. Redirect URL — `http://localhost:3119/callback`, права пользователя — `docs/04-slack.md`.
3. Администратор одобряет приложение.

Для Claude Desktop: Settings → Connectors → Slack.

## 6. Подключение к Claude Code

```bash
export GITHUB_PAT=... AGENT_DB_PASSWORD=... DBHUB_CONFIG=/полный/путь/к/dbhub.toml
export HUBSPOT_CLIENT_ID=... SLACK_CLIENT_ID=...
sh clients/claude-code-add.sh
claude
```

Скрипт спросит client secret HubSpot и Slack и сохранит их в защищённом хранилище, не в файле. В Claude Code: `/mcp` → hubspot → Authenticate, то же для slack.

Ненужные системы закомментируйте в скрипте.

## 7. Проверка

```bash
python3 scripts/check_mcp_config.py .mcp.json
```

Затем запросы из `prompts/sample-prompts.md` — по одному на систему: «Какие таблицы есть в базе?», «Покажи 5 последних сделок в HubSpot», «Найди в Slack обсуждение релиза», «Какие открытые pull request в репозитории X?».
