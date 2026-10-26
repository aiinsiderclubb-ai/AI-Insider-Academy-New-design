#!/bin/sh
# Sends a WhatsApp-shaped test message to your n8n webhook, signed the way Meta signs it.
# Usage: APP_SECRET=... ./send-test-message.sh https://n8n.example.com/webhook/whatsapp 380501112233 "Сколько стоит?" PHONE_NUMBER_ID
# The app secret is read from the environment so it does not land in your shell history.
set -eu
URL="$1"; FROM="$2"; TEXT="$3"; PHONE_ID="${4:-}"
: "${APP_SECRET:?set APP_SECRET in the environment}"
NOW=$(date +%s)
BODY=$(printf '{"object":"whatsapp_business_account","entry":[{"id":"test","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","metadata":{"phone_number_id":"%s"},"contacts":[{"profile":{"name":"Тест"},"wa_id":"%s"}],"messages":[{"from":"%s","id":"wamid.test%s","timestamp":"%s","type":"text","text":{"body":"%s"}}]}}]}]}' "$PHONE_ID" "$FROM" "$FROM" "$NOW" "$NOW" "$TEXT")
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$APP_SECRET" | sed 's/^.* //')
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -X POST "$URL" -H "Content-Type: application/json" -H "X-Hub-Signature-256: sha256=$SIG" --data-binary "$BODY"
