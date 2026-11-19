// Parse Request — turns the three providers' tool-call formats into one shape
// and rejects anything the tools must never act on.
const cfg = $('Config').first().json;
const hook = $('Voice Tool Webhook').first().json;
const body = hook.body || {};

let provider = 'generic', callId = '', toolCallId = '', tool = '', args = {}, caller = '', extra = 0;

if (body.message && body.message.type === 'tool-calls') {
  provider = 'vapi';
  const list = body.message.toolCallList || body.message.toolCalls || [];
  const first = list[0] || {};
  extra = Math.max(0, list.length - 1);
  toolCallId = first.id || '';
  tool = (first.function && first.function.name) || first.name || '';
  args = (first.function && first.function.arguments) || first.arguments || {};
  const call = body.message.call || {};
  callId = call.id || '';
  caller = (call.customer && call.customer.number) || '';
} else if (body.name && body.args !== undefined) {
  provider = 'retell';
  tool = body.name;
  args = body.args || {};
  const call = body.call || {};
  callId = call.call_id || '';
  caller = call.direction === 'outbound' ? (call.to_number || '') : (call.from_number || '');
} else {
  // ElevenLabs and anything else: a flat JSON body that names the tool itself.
  // The tool name may also come in the URL (?tool=find_order), one URL per tool.
  provider = body.provider || 'elevenlabs';
  tool = body.tool || (hook.query && hook.query.tool) || '';
  args = body.args || body;
  callId = body.conversation_id || body.call_id || '';
  caller = body.caller_number || '';
}

if (typeof args === 'string') {
  try { args = JSON.parse(args); } catch (e) { args = {}; }
}
args = Object.assign({}, args);
delete args.tool; delete args.provider; delete args.conversation_id; delete args.caller_number;

const digits = (value) => String(value || '').replace(/[^\d]/g, '');
// Callers dictate numbers in the national form; orders are matched in the international one.
const phoneRules = cfg.phone || {};
const phone = (value) => {
  let d = digits(value);
  if (d.startsWith('00')) d = d.slice(2);
  else if (phoneRules.national_prefix && phoneRules.country_code && d.startsWith(phoneRules.national_prefix) && !d.startsWith(phoneRules.country_code)) {
    d = phoneRules.country_code + d.slice(phoneRules.national_prefix.length);
  }
  return d.length >= 9 && d.length <= 15 ? '+' + d : '';
};
const fail = (code, say) => ({ ok: false, error: code, say });

const REQUIRED = {
  find_order: ['customer_phone'],
  confirm_delivery: ['order_id', 'customer_phone'],
  update_address: ['order_id', 'customer_phone'],
  check_windows: ['order_id', 'customer_phone', 'date'],
  change_window: ['order_id', 'customer_phone', 'date', 'window_id'],
  request_callback: ['customer_name', 'customer_phone', 'topic'],
};
const ADDRESS_FIELDS = ['city', 'address', 'apartment', 'entrance', 'floor', 'intercom', 'courier_note'];

let verdict = { ok: true };
if (!REQUIRED[tool]) {
  verdict = fail('unknown_tool', 'Этот запрос я выполнить не могу. Изменить состав заказа, отменить его или вернуть деньги может только оператор: предложите request_callback.');
} else {
  const missing = REQUIRED[tool].filter((key) => args[key] === undefined || args[key] === null || String(args[key]).trim() === '');
  if (missing.length) verdict = fail('missing_fields', 'Не хватает данных: ' + missing.join(', ') + '. Уточните у клиента и повторите.');
}

if (verdict.ok && args.customer_phone !== undefined) {
  const normal = phone(args.customer_phone);
  if (!normal) verdict = fail('bad_phone', 'Номер телефона не распознан. Попросите продиктовать его ещё раз по цифрам.');
  else args.customer_phone = normal;
}
if (args.order_id !== undefined) {
  args.order_ref = String(args.order_id).trim().slice(0, 40); // as said, for people
  args.order_id = args.order_ref.replace(/[\s#№-]/g, '').toUpperCase(); // for matching
}

// Models miscount dates. They may pass a word instead and let the backend resolve it.
if (verdict.ok && (tool === 'check_windows' || tool === 'change_window')) {
  args.date = String(args.date).trim().toLowerCase();
  if (!/^(\d{4}-\d{2}-\d{2}|today|tomorrow|mon|tue|wed|thu|fri|sat|sun|\+\d{1,2})$/.test(args.date)) {
    verdict = fail('bad_date', 'Дата: ГГГГ-ММ-ДД, today, tomorrow, день недели (mon…sun) или +N дней.');
  }
}
if (verdict.ok && tool === 'change_window' && !(cfg.windows || []).some((w) => w.id === String(args.window_id))) {
  verdict = fail('unknown_window', 'Такого интервала нет. Возьмите window_id из ответа check_windows.');
}
if (verdict.ok && tool === 'update_address') {
  for (const key of ADDRESS_FIELDS) if (args[key] !== undefined) args[key] = String(args[key]).replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!ADDRESS_FIELDS.some((key) => args[key])) verdict = fail('missing_fields', 'Что меняем в адресе? Передайте хотя бы одно поле: ' + ADDRESS_FIELDS.join(', ') + '.');
  else if (args.city && !args.address) verdict = fail('missing_fields', 'Новый город без улицы и дома не принимаю. Уточните полный адрес и передайте address.');
}
if (verdict.ok && ['confirm_delivery', 'update_address', 'change_window'].includes(tool) && args.consent !== true && args.consent !== 'true') {
  verdict = fail('no_consent', 'Сначала повторите клиенту то, что меняете или подтверждаете, и получите явное «да». Затем вызовите инструмент с consent: true.');
}

// Only the order's own number may see or change it: the address is personal data.
const callerPhone = phone(caller);
if (verdict.ok && cfg.require_caller_match && tool !== 'request_callback') {
  if (!callerPhone || callerPhone !== args.customer_phone) {
    verdict = fail('caller_mismatch', 'Данные заказа доступны только с номера, на который он оформлен. Предложите перезвонить с него или передайте оператору через request_callback.');
  }
}

return [{ json: Object.assign({ provider, call_id: callId, tool_call_id: toolCallId, tool, args, caller: callerPhone, extra_calls: extra }, verdict) }];
