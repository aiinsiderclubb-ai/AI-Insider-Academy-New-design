// Tool Failed — the sheet did not answer or refused. Never invent a result.
const failure = $input.first().json || {};
let ctx = {};
try { ctx = $('Decide').first().json; } catch (e) { ctx = $('Plan').first().json; }
const text = JSON.stringify(failure.error || failure).slice(0, 600);
return [{ json: Object.assign({}, ctx, { needs_notify: true,
  staff_message: ['Сбой инструмента голосового агента доставки', `Инструмент: ${ctx.tool}`, ctx.args && ctx.args.order_ref ? `Заказ: ${ctx.args.order_ref}` : '', `Звонок: ${ctx.call_id || '—'}`, text].filter(Boolean).join('\n'),
  result: { ok: false, error: 'tool_unavailable', say: 'Система заказов сейчас недоступна. Извинитесь, не называйте результат, предложите связаться с оператором через request_callback.' } }) }];
