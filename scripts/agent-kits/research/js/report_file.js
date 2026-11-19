// Report File: отчёт в Markdown как файл — для Telegram и для ответа по callback.
const r = $input.first().json;
const name = `${r.job_id}-${r.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 50) || 'report'}.md`;
return [{
  json: { ...r, file_name: name },
  binary: { data: { data: Buffer.from(r.report_md, 'utf8').toString('base64'), mimeType: 'text/markdown', fileName: name, fileExtension: 'md' } },
}];
