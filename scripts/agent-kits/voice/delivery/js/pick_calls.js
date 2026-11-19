// Pick Calls — tomorrow's orders that still need a confirmation call.
const cfg = $('Config').first().json;
const out = cfg.outbound || {};
const feed = $input.first().json || {};
// @include _time.js
const now = nowMs();
const today = localDate(now);
const nowHm = localIso(now).slice(11);
if (nowHm < (out.call_from || '10:00') || nowHm >= (out.call_until || '20:00')) return [];

const values = Array.isArray(feed.values) ? feed.values : [];
const head = (values[0] || []).map((h) => String(h).trim().toLowerCase());
const col = (row, name) => String(row[head.indexOf(name)] ?? '').trim();
const digits = (value) => String(value || '').replace(/[^\d]/g, '');
const phoneRules = cfg.phone || {};
const phone = (value) => {
  let d = digits(value);
  if (d.startsWith('00')) d = d.slice(2);
  else if (phoneRules.national_prefix && phoneRules.country_code && d.startsWith(phoneRules.national_prefix) && !d.startsWith(phoneRules.country_code)) {
    d = phoneRules.country_code + d.slice(phoneRules.national_prefix.length);
  }
  return d.length >= 9 && d.length <= 15 ? '+' + d : '';
};
const tomorrow = localDate(dayStart(today) + DAY + 12 * 60 * MIN);
const picked = [];
values.slice(1).forEach((row, i) => {
  const number = phone(col(row, 'phone'));
  const calls = Number(col(row, 'calls')) || 0;
  if (!col(row, 'order_id') || !number) return;
  if (col(row, 'delivery_date') !== tomorrow) return;
  if (!(cfg.changeable_statuses || []).includes(col(row, 'status').toLowerCase())) return;
  if (/^(да|yes|1|true)$/i.test(col(row, 'confirmed'))) return;
  if (calls >= (out.max_attempts || 2)) return;
  if (col(row, 'last_call').startsWith(today)) return; // one attempt a day; the next run tries again tomorrow
  const address = [col(row, 'city'), col(row, 'address'), col(row, 'apartment') && 'квартира ' + col(row, 'apartment')].filter(Boolean).join(', ');
  const vars = {
    order_id: col(row, 'order_id'), customer_name: col(row, 'customer_name') || 'клиент',
    delivery: spokenWindow(col(row, 'delivery_date'), col(row, 'window')), address,
  };
  const request = out.provider === 'retell'
    ? { url: `${out.retell_api_base}/v2/create-phone-call`, body: { from_number: out.retell_from_number, to_number: number, override_agent_id: out.retell_agent_id, retell_llm_dynamic_variables: vars } }
    : { url: `${out.vapi_api_base}/call`, body: { assistantId: out.vapi_assistant_id, phoneNumberId: out.vapi_phone_number_id,
        customer: { number, name: vars.customer_name }, assistantOverrides: { variableValues: vars } } };
  picked.push({ json: { row: i + 2, order_id: vars.order_id, calls, history: col(row, 'history'), request } });
});
return picked.slice(0, out.max_calls_per_run || 50);
