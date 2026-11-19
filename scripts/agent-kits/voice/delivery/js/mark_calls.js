// Mark Calls — counts the attempt on each order and builds one write for the sheet.
const cfg = $('Config').first().json;
const picked = $('Pick Calls').all();
const answers = $input.all();
// @include _time.js
const now = nowMs();
const head = ($('Read Orders').first().json.values || [[]])[0].map((h) => String(h).trim().toLowerCase());
const letter = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
const sheet = `'${String(cfg.sheet_name || 'Orders').replace(/'/g, "''")}'`;
const cell = (row, col, value) => ({ range: `${sheet}!${letter(head.indexOf(col))}${row}`, values: [[value]] });
const data = [];
const started = [];
const failed = [];
picked.forEach((item, i) => {
  const p = item.json;
  const answer = (answers[i] && answers[i].json) || {};
  const ok = !answer.error && (answer.id || answer.call_id);
  (ok ? started : failed).push(p.order_id);
  const entry = `${localIso(now)} исходящий звонок: ${ok ? 'начат, ' + (answer.id || answer.call_id) : 'не начат — ' + JSON.stringify(answer.error || answer).slice(0, 120)}`;
  // A call that never started does not use up an attempt; last_call still stops a retry the same day.
  data.push(cell(p.row, 'calls', String(ok ? p.calls + 1 : p.calls)), cell(p.row, 'last_call', localIso(now)),
    cell(p.row, 'history', ((p.history ? p.history + '\n' : '') + entry).slice(-2000)));
});
const report = ['Звонки для подтверждения доставки', `Начато: ${started.length}`, failed.length ? `Не начато: ${failed.length} (${failed.join(', ')})` : ''].filter(Boolean).join('\n');
return [{ json: { body: { valueInputOption: 'RAW', data }, report } }];
