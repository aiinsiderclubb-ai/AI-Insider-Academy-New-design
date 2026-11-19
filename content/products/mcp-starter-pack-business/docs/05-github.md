# GitHub

Официальный сервер GitHub — github.com/github/github-mcp-server. Работает в двух вариантах:

| Вариант | Адрес или команда | Когда |
|---|---|---|
| удалённый | `https://api.githubcopilot.com/mcp/readonly` | Claude Code, Cursor, n8n |
| локальный | `docker run … ghcr.io/github/github-mcp-server:2.2.0` | Claude Desktop (только локальные серверы через файл), закрытые сети |

Архивный `@modelcontextprotocol/server-github` не используйте: GitHub перенёс разработку в свой репозиторий.

## Только чтение

- Удалённый: адрес с `/readonly` на конце. У каждого набора инструментов есть свой адрес, например `https://api.githubcopilot.com/mcp/x/issues/readonly` — только задачи.
- Локальный: переменная `GITHUB_READ_ONLY=1` и список наборов `GITHUB_TOOLSETS=repos,issues,pull_requests`. Мы проверили: версия 2.2.0 в таком режиме отдаёт 22 инструмента, все — на чтение.

Меньше наборов — меньше инструментов в контексте модели и меньше путаницы.

## Токен

github.com → Settings → Developer settings → **Fine-grained tokens** → Generate:
- Repository access — только нужные репозитории;
- Permissions — Contents, Issues, Pull requests, Metadata: **Read-only**;
- срок — 90 дней, потом выпустите новый.

Положите токен в переменную окружения `GITHUB_PAT`. Claude Code подставит его из `.mcp.json` (`Bearer ${GITHUB_PAT}`), Cursor — из `${env:GITHUB_PAT}`.

Если токен неверный, удалённый сервер отвечает 401. Если у токена нет доступа к репозиторию, вызовы вернут пустой результат или «Not Found» — проверьте Repository access.

## Claude Desktop

Claude Desktop берёт локальные серверы из `claude_desktop_config.json` — блок `github` в `clients/claude-desktop.json` запускает Docker-образ. Нужен установленный и запущенный Docker Desktop.

## n8n

Узел MCP Client Tool: Endpoint `https://api.githubcopilot.com/mcp/readonly`, HTTP Streamable, Bearer Auth с токеном. `docs/06-n8n.md`.

## GitHub Enterprise

GitHub Enterprise Cloud с хранением данных в регионе использует свой адрес вида `https://copilot-api.ВАШ-ТЕНАНТ.ghe.com/mcp`. GitHub Enterprise Server удалённый сервер не поддерживает — только локальный с переменной `GITHUB_HOST`.
