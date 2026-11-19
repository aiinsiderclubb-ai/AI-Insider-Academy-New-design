// Mark Reindex: помечает запуск переиндексации (по расписанию или по запросу).
const input = $input.first().json;
return [{ json: { op: 'reindex', via: input.body !== undefined || input.headers !== undefined ? 'webhook' : 'schedule', request: input } }];
