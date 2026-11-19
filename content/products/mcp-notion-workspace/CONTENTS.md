# Состав набора

```
mcp-notion-workspace/
├── README.md                       что это и что проверено
├── QUICKSTART.md                   запуск примерно за час
├── CONTENTS.md                     этот файл
├── server/
│   ├── notion_workspace_mcp.py     MCP-сервер: поиск, чтение, одна таблица для записи
│   └── mcp_lite.py                 протокол MCP (stdio и HTTP) на стандартной библиотеке
├── config/
│   ├── notion.example.json         базы знаний и таблица записи
│   └── allowed-databases.md        список разрешённых баз: что, кем, зачем
├── checks/
│   └── test-questions.md           14 проверочных вопросов и просьб
├── clients/
│   ├── claude-code.mcp.json        для Claude Code
│   ├── claude-desktop.json         для Claude Desktop
│   └── cursor.mcp.json             для Cursor
└── docs/
    ├── 01-how-it-works.md          инструменты, поиск, проверки записи
    ├── 02-notion-setup.md          подключение, доступ, ID, все поля notion.json
    ├── 03-clients.md               Claude Code, Claude Desktop, Cursor, n8n
    └── 04-security.md              уровни ограничений, токены, данные
```
