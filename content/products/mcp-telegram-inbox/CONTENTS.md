# Состав набора

```
mcp-telegram-inbox/
├── README.md                       что это и что проверено
├── QUICKSTART.md                   запуск за 30–40 минут
├── CONTENTS.md                     этот файл
├── server/
│   ├── telegram_inbox_mcp.py       MCP-сервер: 5 инструментов, правила, хранилище
│   └── mcp_lite.py                 протокол MCP (stdio и HTTP) на стандартной библиотеке
├── config/
│   └── inbox.example.json          чаты, чат менеджера, CRM, правила эскалации
├── clients/
│   ├── claude-code.mcp.json        для Claude Code (.mcp.json проекта)
│   ├── claude-desktop.json         блок для claude_desktop_config.json
│   ├── cursor.mcp.json             для Cursor
│   └── n8n-inbox-triage.n8n.json   n8n: разбор чата каждые 15 минут
├── rules/
│   └── escalation-rules.md         когда агент передаёт сообщение менеджеру
├── prompts/
│   └── agent-request.md            запрос агенту и тестовые сообщения
└── docs/
    ├── 01-how-it-works.md          инструменты, статусы, что проверяет сервер
    ├── 02-setup.md                 настройки, бот, ID чатов
    ├── 03-clients.md               Claude Code, Claude Desktop, Cursor, n8n
    ├── 04-crm.md                   вебхук, CRM Automation Kit, HubSpot, без CRM
    └── 05-security.md              доступы, токены, персональные данные
```
