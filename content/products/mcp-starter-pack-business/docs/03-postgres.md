# Postgres

Официального MCP-сервера для Postgres нет, а эталонный `@modelcontextprotocol/server-postgres` в архиве. В наборе — **DBHub** (`@bytebase/dbhub`, github.com/bytebase/dbhub): поддерживаемый открытый сервер, который работает с Postgres, MySQL, MariaDB, SQL Server и SQLite. Мы проверяли версию 2.0.0.

## Три уровня защиты

1. **Роль Postgres** `agent_readonly` (`configs/postgres-readonly-role.sql.txt`): только SELECT, каждый сеанс — read-only, запрос не дольше 15 секунд, не больше 5 подключений. Даже если обойти всё остальное, база не даст писать.
2. **Режим DBHub** `readonly = true` в `configs/dbhub.toml`: DBHub пропускает только SELECT, WITH, EXPLAIN, SHOW и выполняет их в транзакции только для чтения.
3. **Лимит строк** `max_rows = 200`: агент не выгрузит таблицу целиком в разговор.

Документация DBHub прямо говорит: режим только чтения — страховка от случайной записи, а не граница прав. Границу задаёт роль базы. Поэтому подключайтесь ролью `agent_readonly`, а не владельцем базы.

## Роль

```bash
psql -d ВАША_БАЗА -f configs/postgres-readonly-role.sql.txt
```

Перед запуском замените пароль в файле. Скрипт:
- создаёт роль без права входа в другие базы, без создания баз и ролей;
- выдаёт SELECT на все таблицы схемы `public` — сейчас и на будущие;
- в конце — пример, как отозвать доступ к отдельной таблице (платежи, персональные данные).

Для схем кроме `public` повторите блок `GRANT USAGE` / `GRANT SELECT` / `ALTER DEFAULT PRIVILEGES`.

## dbhub.toml

```toml
[[sources]]
id = "main"
dsn = "postgres://agent_readonly:${AGENT_DB_PASSWORD}@db.example.com:5432/shop?sslmode=require"
query_timeout = 15
lazy = true

[[tools]]
name = "execute_sql"
source = "main"
readonly = true
max_rows = 200

[[tools]]
name = "search_objects"
source = "main"
```

`${AGENT_DB_PASSWORD}` DBHub берёт из окружения — пароль не лежит в файле. `search_objects` даёт агенту искать таблицы и колонки, а не угадывать их. Всегда доступны ещё `explain_sql` (план запроса) и, если включить, `health_check`.

Несколько баз — несколько блоков `[[sources]]` с разными `id`, у каждого свои `[[tools]]`.

## Node.js

DBHub 2 требует Node.js 22.5 или новее. Проверьте: `node --version`. Если версия старше — обновите Node или запускайте DBHub из Docker (инструкция — dbhub.ai/installation).

## Клиенты

- **Claude Code** — блок `postgres` в `clients/claude-code.mcp.json`, путь к toml — в `DBHUB_CONFIG`.
- **Claude Desktop** — блок `postgres` в `clients/claude-desktop.json`: полный путь к toml, пароль — прямо в `env`.
- **Cursor** — `dbhub.toml` в корне проекта, пароль — в `AGENT_DB_PASSWORD`.
- **n8n** — DBHub в режиме HTTP, обязательно с `--auth-token`: `docs/06-n8n.md`.

## Проверка

1. «Какие таблицы есть в базе?» — агент вызывает `search_objects`.
2. «Сколько заказов за неделю?» — `execute_sql` с SELECT.
3. «Удали тестовые заказы» — ответ DBHub `READONLY_VIOLATION`, данные на месте.

Мы проверили именно эти три шага на Postgres 17 с нашими `dbhub.toml` и ролью — и через MCP Inspector, и из n8n.
