// Finish — the sheet accepted the change; hand the prepared answer on.
const ctx = $('Decide').first().json;
return [{ json: Object.assign({}, ctx, { result: ctx.on_success, needs_notify: Boolean(ctx.staff_message) }) }];
