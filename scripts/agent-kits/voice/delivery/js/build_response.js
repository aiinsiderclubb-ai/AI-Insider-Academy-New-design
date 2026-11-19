// Build Response — each provider expects its own envelope.
const item = $input.first().json;
const result = item.result || { ok: false, error: 'no_result', say: 'Не удалось выполнить запрос. Предложите перезвонить.' };
let response = result;
if (item.provider === 'vapi') {
  response = { results: [{ toolCallId: item.tool_call_id, result: JSON.stringify(result) }] };
}
return [{ json: { response } }];
