// Lead Result: что агент узнает о сохранённой анкете.
const plan = $('Lead Upsert').first().json;
if (!plan.ok) return [{ json: plan.result }];
const saved = $('Save Lead').first().json;
if (saved.error) {
  return [{ json: { ok: false, service_error: String(saved.error.message || saved.error).slice(0, 300), note: 'Анкета не сохранилась. Продолжай подбор, но не говори, что данные записаны.' } }];
}
return [{ json: plan.result }];
