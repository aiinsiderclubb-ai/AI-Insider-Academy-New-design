// Tool Return: ответ инструмента агенту — результат той ветки, что сработала.
const RESULTS = ['Rank Articles', 'Ticket Result', 'Lead Result', 'Email Result', 'Metrics', 'Handoff Result', 'Unknown Tool'];
const name = RESULTS.find((n) => $(n).isExecuted);
return [{ json: name ? $(name).first().json : { ok: false, note: 'Инструмент не вернул результат.' } }];
