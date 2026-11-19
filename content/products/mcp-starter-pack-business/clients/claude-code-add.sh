#!/bin/sh
# Подключение четырёх серверов к Claude Code командами вместо .mcp.json.
# Запускайте из папки проекта. --scope project пишет в .mcp.json (его можно закоммитить —
# секретов там нет), --scope user — во все ваши проекты.
# Перед запуском: export GITHUB_PAT=... AGENT_DB_PASSWORD=... DBHUB_CONFIG=/полный/путь/dbhub.toml
set -e
SCOPE="${SCOPE:-project}"

# GitHub: только чтение, токен из переменной окружения GITHUB_PAT (в файл не попадает)
claude mcp add --scope "$SCOPE" --transport http github https://api.githubcopilot.com/mcp/readonly \
  --header 'Authorization: Bearer ${GITHUB_PAT}'

# Postgres через DBHub: настройки и режим «только чтение» — в dbhub.toml
claude mcp add --scope "$SCOPE" postgres -e 'AGENT_DB_PASSWORD=${AGENT_DB_PASSWORD}' \
  -- npx -y @bytebase/dbhub@2 --config '${DBHUB_CONFIG}'

# HubSpot: OAuth через ваш MCP-коннектор HubSpot. Claude Code спросит client secret и сохранит
# его в защищённом хранилище, не в файле. Redirect URL коннектора: http://localhost:3118/callback
claude mcp add --scope "$SCOPE" --transport http --client-id "$HUBSPOT_CLIENT_ID" --client-secret \
  --callback-port 3118 hubspot https://mcp.hubspot.com

# Slack: OAuth через ваше внутреннее Slack-приложение. Redirect URL: http://localhost:3119/callback
claude mcp add --scope "$SCOPE" --transport http --client-id "$SLACK_CLIENT_ID" --client-secret \
  --callback-port 3119 slack https://mcp.slack.com/mcp

echo "Готово. Запустите claude, одобрите серверы проекта и выполните /mcp → Authenticate для hubspot и slack."
