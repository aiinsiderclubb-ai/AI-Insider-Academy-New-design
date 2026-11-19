// Call Link: ссылка на запись к менеджеру и сигнал в чат продаж.
const { config, input } = $('Config').first().json;
if (!config.booking_link || /ваша-компания/.test(config.booking_link)) {
  return [{ json: { result: { ok: false, error: 'no_booking_link', note: 'Ссылки на запись нет. Передай клиента менеджеру (handoff_to_human): он договорится о звонке сам.' }, team_message: '' } }];
}
return [{ json: {
  result: { ok: true, booking_link: config.booking_link, expose: { booking_link: config.booking_link },
    note: 'Дай клиенту эту ссылку: он сам выберет удобное время. Сохрани этап call_booked (save_lead), когда клиент скажет, что записался.' },
  team_message: [`📞 Клиент выбирает время звонка`, `Имя: ${input.customer_name || '—'}`, `Контакт: ${input.customer_contact || '—'}`,
    input.topic ? `Тема: ${String(input.topic).slice(0, 300)}` : '', input.preferred_time ? `Удобно: ${String(input.preferred_time).slice(0, 100)}` : '', `Сессия: ${input.session_id}`].filter(Boolean).join('\n'),
} }];
