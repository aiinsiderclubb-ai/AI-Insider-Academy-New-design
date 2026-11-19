// Tool Alert: сбой таблицы или Telegram внутри инструмента — сигнал команде.
// @include text.js
const { input } = $('Config').first().json;
const r = $input.first().json;
return [{ json: { alert_html: `<b>⚠️ Ошибка инструмента ${escapeHtml(input.tool)}</b>\n${escapeHtml(r.service_error)}\nАгент: ${escapeHtml(input.agent || '')} · <code>${escapeHtml(input.session_id || '')}</code>` } }];
