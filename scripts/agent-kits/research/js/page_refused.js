const g = $input.first().json;
return [{ json: { ok: false, ref: g.ref, url: g.url, note: `Эту страницу читать нельзя: ${g.reason}. Возьми другой источник.` } }];
