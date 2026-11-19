// Check Assessment: проверяет оценку модели. Значения — только из списков; иначе модель исправит и пришлёт снова.
const { input } = $('Config').first().json;
const ENUMS = {
  fit: ['high', 'medium', 'low'],
  intent: ['high', 'medium', 'low'],
  company_size: ['1', '2-10', '11-50', '51-200', '201-1000', '1000+', 'unknown'],
  urgency: ['now', 'quarter', 'later', 'unknown'],
};
const FLAGS = ['spam', 'job_seeker', 'student', 'competitor', 'vendor_pitch', 'out_of_area', 'existing_customer', 'test'];
const errors = [];
for (const [k, allowed] of Object.entries(ENUMS)) {
  const v = String(input[k] ?? '').trim().toLowerCase();
  if (!allowed.includes(v)) errors.push(`${k}: одно из ${allowed.join(', ')}`);
}
const flags = String(input.red_flags || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const badFlags = flags.filter((f) => !FLAGS.includes(f));
if (badFlags.length) errors.push(`red_flags: только ${FLAGS.join(', ')} через запятую или пусто`);
if (String(input.summary || '').trim().length < 10) errors.push('summary: 1–3 предложения о лиде');
if (errors.length) return [{ json: { ok: false, errors, note: 'Оценка не принята. Исправь поля и вызови submit_assessment снова.' } }];
return [{ json: { ok: true, note: 'Оценка принята. Больше инструментов не вызывай, ответь одним словом: готово.' } }];
