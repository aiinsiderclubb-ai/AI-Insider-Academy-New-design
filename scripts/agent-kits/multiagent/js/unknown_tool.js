const { input } = $('Config').first().json;
return [{ json: { ok: false, note: `Инструмент ${input.tool || '(пусто)'} не существует. Используй только инструменты из списка.` } }];
