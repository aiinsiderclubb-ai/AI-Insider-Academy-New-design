// Notify Each: одно сообщение — один элемент; чаты-заглушки пропускаются.
const r = $input.first().json;
const seen = new Set();
return r.notify
  .filter((n) => n.chat_id && !String(n.chat_id).startsWith('ВСТАВЬТЕ') && !seen.has(n.chat_id + n.text.length) && seen.add(n.chat_id + n.text.length))
  .map((n) => ({ json: n }));
