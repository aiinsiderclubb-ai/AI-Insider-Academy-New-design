// Split Messages: одно сообщение — один элемент для узла Telegram.
return $('Plan Follow-ups').first().json.messages.map((m) => ({ json: m }));
