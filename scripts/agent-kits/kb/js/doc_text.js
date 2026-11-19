// Doc Text: текст документа из ответа Drive или страницы — для одного источника.
// @include text.js
const { config, input } = $('Config').first().json;
const res = $input.first().json;
const meta = { source_id: input.source_id, title: input.title, url: input.url, modified: input.modified };

if (res.error) {
  return [{ json: { ok: false, ...meta, error: String(res.error.message || res.error).slice(0, 300) } }];
}

let text = typeof res.text === 'string' ? res.text : typeof res.data === 'string' ? res.data : '';
if (input.fetch === 'url' || input.fetch === 'html' || /^\s*<(!doctype|html)/i.test(text)) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text);
  if (title && input.title === input.url.replace(/^https?:\/\//, '')) meta.title = title[1].trim();
  text = text
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
text = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

if (text.length < 20) {
  return [{ json: { ok: false, ...meta, error: 'в документе нет текста (скан без распознавания или пустая страница)' } }];
}
let truncated = false;
if (text.length > config.max_doc_chars) {
  text = text.slice(0, config.max_doc_chars);
  truncated = true;
}
return [{ json: { ok: true, ...meta, text, chars: text.length, truncated } }];
