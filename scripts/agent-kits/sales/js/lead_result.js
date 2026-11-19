// Lead Result: запись прошла? Если нет — модель узнаёт, команда получит сигнал через Guard Out.
const u = $('Upsert Lead').first().json;
const res = $input.first().json;
if (u.skip) return [{ json: { result: u.result, team_message: '' } }];
if (res.error) {
  return [{ json: { result: { ok: false, service_error: String(res.error.message || res.error).slice(0, 300), note: 'Лид не сохранился. Продолжай разговор; если клиент готов к сделке — передай менеджеру.' }, team_message: u.team_message } }];
}
return [{ json: { result: u.result, team_message: u.team_message } }];
