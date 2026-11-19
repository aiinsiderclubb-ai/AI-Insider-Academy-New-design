# Состав набора

```
mcp-google-calendar/
├── README.md                       что это и что проверено
├── QUICKSTART.md                   запуск примерно за час
├── CONTENTS.md                     этот файл
├── server/
│   ├── calendar_mcp.py             MCP-сервер: слоты, подготовка, подтверждение
│   ├── get_refresh_token.py        доступ к календарю через браузер, один раз
│   └── mcp_lite.py                 протокол MCP (stdio и HTTP) на стандартной библиотеке
├── config/
│   └── calendar.example.json       календари, часовой пояс, рабочие часы, правила
├── rules/
│   └── confirmation-rule.md        правило подтверждения: что считается «да»
├── checks/
│   └── test-dialogue.md            тестовый диалог: 15 шагов и ожидаемые вызовы
├── clients/
│   ├── claude-code.mcp.json        для Claude Code
│   ├── claude-desktop.json         для Claude Desktop
│   └── cursor.mcp.json             для Cursor
└── docs/
    ├── 01-how-it-works.md          инструменты, расчёт слотов, все настройки
    ├── 02-google-setup.md          проект Google, права, срок жизни доступа
    ├── 03-clients.md               Claude Code, Claude Desktop, Cursor, n8n
    └── 04-security.md              доступы, токены, данные, ошибки модели
```
