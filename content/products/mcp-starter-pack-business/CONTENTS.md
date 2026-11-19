# Состав набора

```
mcp-starter-pack-business/
├── README.md                          что это и что проверено
├── QUICKSTART.md                      подключение за вечер
├── CONTENTS.md                        этот файл
├── clients/
│   ├── claude-code.mcp.json           Claude Code: .mcp.json проекта, все четыре системы
│   ├── claude-code-add.sh             то же командами claude mcp add, с OAuth для HubSpot и Slack
│   ├── claude-desktop.json            Claude Desktop: Postgres и GitHub (Docker)
│   ├── cursor.mcp.json                Cursor: все четыре системы
│   └── n8n-agent-mcp.n8n.json         n8n: AI Agent + MCP Client (db, github, hubspot)
├── configs/
│   ├── dbhub.toml                     DBHub: только чтение, лимит строк, таймауты
│   └── postgres-readonly-role.sql.txt роль Postgres только для чтения
├── scripts/
│   └── check_mcp_config.py            проверка MCP-конфигов на архивные серверы и токены
├── prompts/
│   └── sample-prompts.md              24 запроса к агенту
└── docs/
    ├── 01-mcp-basics.md               удалённые и локальные серверы, права, архивные пакеты
    ├── 02-hubspot.md                  HubSpot: коннекторы, OAuth, только чтение
    ├── 03-postgres.md                 Postgres через DBHub: роль, toml, клиенты
    ├── 04-slack.md                    Slack: внутреннее приложение, права, аудит
    ├── 05-github.md                   GitHub: удалённый и Docker, токен, только чтение
    ├── 06-n8n.md                      n8n: узлы MCP Client, DBHub по HTTP, OAuth
    └── 07-security.md                 чек-лист безопасности
```
