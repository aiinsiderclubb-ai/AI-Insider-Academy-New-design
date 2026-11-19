"""
Builds the workflows, tool schema and provider files of voice-agent-kit-restaurant.

The booking backend is the one the other voice kits share (tested in
tests/voice-kit-backend.test.ts), with patches for a restaurant: a booking is
a table, not a service. The party size decides how long the table is held and
which tables fit; tables play the part the specialists play in a salon. Every
patch asserts the text it replaces, so a change in the shared backend makes
this build fail instead of drifting silently.
"""
import copy

from common import plain_telegram, PRODUCTS, SALON, config_code, dump, load, node, rep, write_providers

SLUG = "voice-agent-kit-restaurant"
KIT = PRODUCTS / SLUG

CONFIG = {
    "timezone": "Europe/Kyiv",
    "locale": "ru-RU",
    "calendar_api_base": "https://www.googleapis.com/calendar/v3",
    "calendar_id": "primary",
    "staff_chat_id": "REPLACE_WITH_TELEGRAM_CHAT_ID",
    "phone": {"country_code": "380", "national_prefix": "0"},
    "slot_step_min": 30,
    "lead_time_min": 60,
    "buffer_min": 15,
    "booking_window_days": 30,
    "offer_slots": 3,
    "closed_dates": [],
    "require_caller_match": True,
    "callback_promise": "в течение часа в рабочее время",
    "hours": {
        "mon": {"open": "12:00", "close": "23:00"},
        "tue": {"open": "12:00", "close": "23:00"},
        "wed": {"open": "12:00", "close": "23:00"},
        "thu": {"open": "12:00", "close": "23:00"},
        "fri": {"open": "12:00", "close": "23:30"},
        "sat": {"open": "12:00", "close": "23:30"},
        "sun": {"open": "12:00", "close": "22:00"},
    },
    "cancel_min_hours": 3,
    "late_cancel_note": "",
    "address": "улица Примерная, дом десять, вход со двора",
    "max_guests": 8,
    "durations": [
        {"max_guests": 2, "minutes": 90},
        {"max_guests": 4, "minutes": 120},
        {"max_guests": 8, "minutes": 150},
    ],
    "deposit_note": "без депозита",
    "zones": [
        {"id": "hall", "name": "основной зал"},
        {"id": "terrace", "name": "терраса"},
    ],
    "tables": [
        {"id": "t1", "name": "стол у окна, на двоих", "seats": 2, "zone": "hall"},
        {"id": "t2", "name": "стол на двоих", "seats": 2, "zone": "hall"},
        {"id": "t3", "name": "стол на четверых", "seats": 4, "zone": "hall"},
        {"id": "t4", "name": "стол на четверых у камина", "seats": 4, "zone": "hall"},
        {"id": "t5", "name": "большой стол", "seats": 8, "min_guests": 5, "zone": "hall"},
        {"id": "t6", "name": "стол на террасе, на двоих", "seats": 2, "zone": "terrace"},
        {"id": "t7", "name": "стол на террасе, на четверых", "seats": 4, "zone": "terrace"},
    ],
    "detail_fields": ["guests", "zone", "occasion", "wishes"],
    "detail_labels": {"guests": "Гостей", "zone": "Зона", "occasion": "Повод", "wishes": "Пожелания"},
    "required_details": [],
}

CONFIG_COMMENT = (
    "// Config — the only node you edit. Opening hours, tables, party sizes and rules.\n"
    "// Everything below this node reads its settings from here. Guide: docs/02-backend-n8n.md")

# Which tables fit a party, smallest first, and how long the table is held.
TABLE_SERVICE = """
// A restaurant books a table, not a service: the party size decides how long the table
// is held and which tables fit, smallest first so a couple does not take a table for eight.
function tableService(guests, zone) {
  const rule = (cfg.durations || []).find((d) => guests <= d.max_guests) || (cfg.durations || []).slice(-1)[0] || { minutes: 120 };
  const fits = (cfg.tables || [])
    .filter((t) => t.seats >= guests && (t.min_guests || 1) <= guests && (!zone || t.zone === zone))
    .sort((x, y) => x.seats - y.seats);
  return { id: 'table', name: 'Столик, гостей: ' + guests, duration_min: rule.minutes, price: cfg.deposit_note || '', staff: fits.map((t) => t.id) };
}
const zoneList = () => (cfg.zones || []).map((z) => z.id + ' — ' + z.name).join('; ');
"""

PARSE_SERVICE_OLD = """const service = (cfg.services || []).find((item) => item.id === args.service_id);
if (verdict.ok && (tool === 'check_availability' || tool === 'create_booking') && !service) {
  verdict = fail('unknown_service', 'Такой услуги нет в каталоге. Доступные: ' + (cfg.services || []).map((s) => s.id + ' — ' + s.name).join('; '));
}
if (verdict.ok && args.staff_id && !(cfg.staff || []).some((person) => person.id === args.staff_id)) {
  verdict = fail('unknown_staff', 'Такого специалиста нет. Доступные: ' + (cfg.staff || []).map((s) => s.id + ' — ' + s.name).join('; '));
}"""

PARSE_SERVICE_NEW = TABLE_SERVICE + """if (args.table_id !== undefined && args.table_id !== '') args.staff_id = args.table_id;
delete args.table_id;
let service = null;
const needsTable = tool === 'check_availability' || tool === 'create_booking' || (tool === 'reschedule_booking' && args.guests !== undefined && args.guests !== '');
if (verdict.ok && needsTable) {
  const guests = Number(args.guests);
  if (!Number.isInteger(guests) || guests < 1) {
    verdict = fail('bad_guests', 'Уточните, сколько будет гостей, и передайте число.');
  } else if (guests > (cfg.max_guests || 8)) {
    verdict = fail('party_too_large', `Компанию больше ${cfg.max_guests || 8} человек бронирует менеджер: банкет, объединение столов, меню. Предложите request_callback.`);
  } else if (args.zone && !(cfg.zones || []).some((z) => z.id === args.zone)) {
    verdict = fail('unknown_zone', 'Такой зоны нет. Доступные: ' + zoneList());
  } else {
    args.guests = guests;
    args.service_id = 'table';
    service = tableService(guests, args.zone);
    if (!service.staff.length) verdict = fail('no_table', 'Для такой компании в этой зоне столов нет. Предложите другую зону: ' + zoneList());
  }
}
if (verdict.ok && args.staff_id && !(cfg.tables || []).some((t) => t.id === args.staff_id)) {
  verdict = fail('unknown_table', 'Такого стола нет. Не передавайте table_id или возьмите его из check_availability.');
}
if (verdict.ok && args.staff_id && service && !service.staff.includes(args.staff_id)) {
  verdict = fail('table_unfit', 'Этот стол не подходит для такой компании или зоны. Вызовите ещё раз без table_id.');
}"""


def patch_parse(code):
    code = rep(code, "  check_availability: ['service_id', 'date'],", "  check_availability: ['guests', 'date'],")
    code = rep(code, "  create_booking: ['service_id', 'slot_start', 'customer_name', 'customer_phone'],",
               "  create_booking: ['guests', 'slot_start', 'customer_name', 'customer_phone'],")
    code = rep(code, PARSE_SERVICE_OLD, PARSE_SERVICE_NEW)
    code = rep(code, "verdict = fail('no_consent', 'Сначала повторите клиенту услугу, дату, время и цену и получите явное «да». Затем вызовите инструмент с consent: true.');",
               "verdict = fail('no_consent', 'Сначала повторите клиенту дату, время, число гостей и имя и получите явное «да». Затем вызовите инструмент с consent: true.');")
    code = rep(code, "verdict = fail('caller_mismatch', 'Изменить запись можно только с номера, на который она оформлена. Предложите перезвонить с него или передайте администратору через request_callback.');",
               "verdict = fail('caller_mismatch', 'Изменить бронь можно только с номера, на который она оформлена. Предложите перезвонить с него или передайте администратору через request_callback.');")
    code = rep(code, "// Parse Request — turns the three providers' tool-call formats into one shape",
               "// Parse Request — turns the three providers' tool-call formats into one shape\n// (restaurant: a party size and an optional zone instead of a service)")
    return code


def patch_decide(code):
    code = rep(code, "const serviceOf = (id) => (cfg.services || []).find((s) => s.id === id);",
               "const serviceOf = (id) => (cfg.services || []).find((s) => s.id === id);" + TABLE_SERVICE)
    code = rep(code, "if (service && Array.isArray(service.staff) && service.staff.length) pool = pool.filter((id) => service.staff.includes(id));",
               "// Tables in the order that fits the party best, not the order of Config.\n"
               "  if (service && Array.isArray(service.staff)) pool = service.staff.filter((id) => pool.includes(id));")
    code = rep(code, "found.push({ slot_start: localIso(start), spoken: spoken(start), staff_id: staff[0], staff: staffName(staff[0]) });",
               "found.push({ slot_start: localIso(start), spoken: spoken(start), table_id: staff[0], table: staffName(staff[0]) });")
    code = rep(code, "service_id: priv(event.raw).service_id || '',",
               "service_id: priv(event.raw).service_id || '', guests: priv(event.raw).guests || '',")
    code = rep(code, "staff: staffName(", "table: staffName(", count=4)
    code = rep(code, "return done({ ok: true, available: true, today: localDate(now), date: a.date, service: ctx.service.name, price: ctx.service.price, duration_min: ctx.service.duration_min, slots: sameDay,\n      say: 'Предложите клиенту эти варианты, не больше двух за раз. В create_booking передайте slot_start выбранного.' });",
               "return done({ ok: true, available: true, today: localDate(now), date: a.date, guests: a.guests, table_minutes: ctx.service.duration_min, slots: sameDay,\n      say: 'Предложите клиенту эти варианты, не больше двух за раз. В create_booking передайте slot_start и table_id выбранного.' });")
    code = rep(code, "return done({ ok: true, available: false, today: localDate(now), date: a.date, service: ctx.service.name, slots: other,\n    say: other.length ? 'На запрошенное время мест нет. Предложите ближайшие варианты из slots.' : 'Свободных мест на ближайшую неделю нет. Предложите request_callback.' });",
               "return done({ ok: true, available: false, today: localDate(now), date: a.date, guests: a.guests, slots: other,\n    say: other.length ? 'На запрошенное время свободных столов нет. Предложите ближайшие варианты из slots.' : 'Свободных столов на ближайшую неделю нет. Предложите request_callback.' });")
    code = rep(code, "say: 'Эта запись уже создана. Подтвердите клиенту услугу, дату и время.' });",
               "say: 'Эта бронь уже создана. Подтвердите клиенту дату, время и число гостей.' });")
    code = rep(code, "const why = { too_soon: 'Это время слишком близко или уже прошло.', outside_hours: 'В это время мы не работаем.', off_grid: 'На это время записать нельзя.', slot_taken: 'Это время только что заняли.' }[problem];",
               "const why = { too_soon: 'Это время слишком близко или уже прошло.', outside_hours: 'В это время стол не забронировать: ресторан закрыт или стол не успеют освободить до закрытия.', off_grid: 'На это время забронировать нельзя.', slot_taken: 'Подходящий стол на это время уже заняли.' }[problem];")
    code = rep(code, "const lines = [`Клиент: ${a.customer_name}`, `Телефон: ${a.customer_phone}`, `Услуга: ${ctx.service.name}`, staffId ? `Специалист: ${staffName(staffId)}` : '']",
               "const lines = [`Гость: ${a.customer_name}`, `Телефон: ${a.customer_phone}`, `Гостей: ${a.guests}`, staffId ? `Стол: ${staffName(staffId)}` : '']")
    code = rep(code, "id, summary: `${ctx.service.name} — ${a.customer_name}`, description: lines.join('\\n'),",
               "id, summary: `Бронь: ${a.guests} гост. — ${a.customer_name}`, description: lines.join('\\n'),")
    code = rep(code, "say: 'Запись создана. Подтвердите клиенту услугу, дату и время' + (cfg.address ? ' и назовите адрес: ' + cfg.address : '') + '.' },\n  ['Новая запись', spoken(start)].concat(lines).join('\\n'));",
               "say: 'Стол забронирован. Подтвердите клиенту дату, время и число гостей' + (cfg.address ? ' и назовите адрес: ' + cfg.address : '') + '. Скажите, что стол держим ' + ctx.service.duration_min + ' минут.' },\n  ['Новая бронь', spoken(start)].concat(lines).join('\\n'));")
    code = rep(code, "say: mine.length ? 'Назовите клиенту найденные записи и уточните, о какой речь.' : 'На этот номер предстоящих записей нет. Уточните номер, на который записывались.' });",
               "say: mine.length ? 'Назовите клиенту найденные брони и уточните, о какой речь.' : 'На этот номер предстоящих броней нет. Уточните номер, на который бронировали.' });")
    code = rep(code, "return done({ ok: false, error: 'booking_not_found', say: 'Запись с таким номером на этот телефон не найдена. Вызовите find_booking и уточните.' });",
               "return done({ ok: false, error: 'booking_not_found', say: 'Брони с таким номером на этот телефон нет. Вызовите find_booking и уточните.' });")
    code = rep(code, "{ ok: true, cancelled: info, late_cancellation: Boolean(late), say: 'Запись отменена. Подтвердите это клиенту' + (late && cfg.late_cancel_note ? '. ' + cfg.late_cancel_note : '') + ' и предложите записаться на другое время.' },\n    ['Отмена записи',",
               "{ ok: true, cancelled: info, late_cancellation: Boolean(late), say: 'Бронь отменена. Подтвердите это клиенту' + (late && cfg.late_cancel_note ? '. ' + cfg.late_cancel_note : '') + ' и предложите забронировать на другое время.' },\n    ['Отмена брони',")
    code = rep(code, "const service = serviceOf(info.service_id) || { duration_min: Math.round((booking.end - booking.start) / MIN), name: info.service };",
               "// The party may have grown: a new guests value picks the tables again.\n"
               "const guestsNow = Number(a.guests) || Number(priv(booking.raw).guests) || 2;\n"
               "const service = tableService(guestsNow, a.zone || priv(booking.raw).zone || undefined);\n"
               "if (!service.staff.length) return done({ ok: false, error: 'no_table', say: 'Для такой компании в этой зоне столов нет. Прежняя бронь сохранена.' });")
    code = rep(code, "return done({ ok: false, error: problem, slots: other, say: 'На это время перенести нельзя. Предложите варианты из slots. Прежняя запись сохранена.' });",
               "return done({ ok: false, error: problem, slots: other, say: 'На это время перенести нельзя. Предложите варианты из slots. Прежняя бронь сохранена.' });")
    code = rep(code, "  extendedProperties: { private: { staff_id: staffId || '' } },",
               "  summary: `Бронь: ${guestsNow} гост. — ${(booking.raw.summary || '').split(' — ').slice(1).join(' — ')}`,\n"
               "  extendedProperties: { private: { staff_id: staffId || '', guests: String(guestsNow) } },")
    code = rep(code, "say: 'Запись перенесена. Назовите клиенту новые дату и время.' },\n['Перенос записи',",
               "guests: guestsNow, say: 'Бронь перенесена. Назовите клиенту новые дату, время и число гостей.' },\n['Перенос брони',")
    code = rep(code, "`Клиент: ${a.customer_phone}`, service.name].join('\\n'));",
               "`Телефон: ${a.customer_phone}`, `Гостей: ${guestsNow}`].join('\\n'));")
    return code


def booking_tools():
    wf = load(SALON / "workflows" / "booking-tools.n8n.json")
    wf["name"] = "Restaurant Voice Agent — Booking Tools"
    node(wf, "Config")["parameters"]["jsCode"] = config_code(CONFIG, CONFIG_COMMENT)
    p = node(wf, "Parse Request")["parameters"]
    p["jsCode"] = patch_parse(p["jsCode"])
    d = node(wf, "Decide")["parameters"]
    d["jsCode"] = patch_decide(d["jsCode"])
    # Tables stand where the specialists stood.
    d["jsCode"] = rep(d["jsCode"], "(cfg.staff || [])", "(cfg.tables || [])", count=None)
    assert "cfg.staff ||" not in p["jsCode"] + d["jsCode"]
    node(wf, "About")["parameters"]["content"] = (
        "## Restaurant Voice Agent — бронирование столов\n\n"
        "Принимает вызовы инструментов от Vapi, Retell и ElevenLabs и ведёт брони в Google Календаре.\n\n"
        "**Настройте:**\n1. Узел **Config** — часы, столы, зоны, сколько держим стол.\n"
        "2. Учётные данные: секрет вебхука, Google Calendar, Telegram.\n3. Settings → Error Workflow → «Error Alert».\n\n"
        "**Владелец:** впишите имя · **Версия:** 1.0.0")
    node(wf, "How it works")["parameters"]["content"] = (
        "## Как это работает\n\n**Parse Request** приводит запрос к одному виду, проверяет число гостей и подбирает подходящие столы.\n"
        "**Plan** решает, что прочитать из календаря.\n**Decide** ищет время, когда свободен подходящий стол, или готовит одно изменение.\n"
        "**Calendar Write** — единственный узел, который что-то меняет.\n\n"
        "Логика проверена тестами — см. `tests/backend-scenarios.md`.")
    node(wf, "Failure path")["parameters"]["content"] = (
        "## Если календарь не ответил\n\nАгент получает `tool_unavailable` и не называет гостю выдуманный результат. "
        "Администратору уходит сообщение в Telegram.")
    return wf


def side_workflows():
    out = {}
    for name in ("call-summary", "error-alert"):
        wf = load(SALON / "workflows" / f"{name}.n8n.json")
        wf["name"] = wf["name"].replace("Beauty Salon", "Restaurant")
        for n in wf["nodes"]:
            if n["type"].endswith("stickyNote"):
                n["parameters"]["content"] = n["parameters"]["content"].replace("Beauty Salon", "Restaurant")
        out[name] = wf
    return out


DATE = "Дата: ГГГГ-ММ-ДД, либо today, tomorrow, день недели (mon, tue, wed, thu, fri, sat, sun), либо +N дней. Не вычисляй дату сам."
PHONE = "Телефон гостя цифрами, как он его продиктовал."


def schema():
    zones = "; ".join(f"{z['id']} — {z['name']}" for z in CONFIG["zones"])
    guests = {"type": "integer", "description": f"Сколько будет гостей, числом. Больше {CONFIG['max_guests']} — не бронируй, вызывай request_callback."}
    zone = {"type": "string", "description": f"Зона, если гость попросил: {zones}. Не спрашивай сам, если гостю всё равно."}
    return [
        {"name": "check_availability",
         "description": "Найти свободный стол на дату для компании. Вызывай перед тем, как предлагать время. Никогда не называй время без этого вызова.",
         "parameters": {"type": "object", "properties": {
             "guests": guests, "date": {"type": "string", "description": DATE},
             "part_of_day": {"type": "string", "enum": ["any", "morning", "afternoon", "evening"],
                             "description": "Время суток, если гость назвал: afternoon — с 12 до 17, evening — после 17."},
             "zone": zone},
             "required": ["guests", "date"]}},
        {"name": "create_booking",
         "description": "Забронировать стол. Вызывай только после того, как повторил гостю дату, время, число гостей и имя и получил явное «да».",
         "parameters": {"type": "object", "properties": {
             "guests": guests,
             "slot_start": {"type": "string", "description": "Значение slot_start из ответа check_availability, без изменений."},
             "table_id": {"type": "string", "description": "table_id выбранного времени из ответа check_availability."},
             "zone": zone,
             "customer_name": {"type": "string", "description": "Имя гостя, как он назвал."},
             "customer_phone": {"type": "string", "description": PHONE},
             "occasion": {"type": "string", "description": "Повод, если гость сам назвал: день рождения, годовщина, деловая встреча."},
             "wishes": {"type": "string", "description": "Пожелания словами гостя: детский стул, тихий стол, торт к десерту. Без сведений о здоровье и платёжных данных."},
             "consent": {"type": "boolean", "description": "true — только после подтверждения гостем."}},
             "required": ["guests", "slot_start", "customer_name", "customer_phone", "consent"]}},
        {"name": "find_booking",
         "description": "Найти предстоящие брони гостя по номеру телефона. Вызывай перед переносом или отменой.",
         "parameters": {"type": "object", "properties": {"customer_phone": {"type": "string", "description": PHONE}},
                        "required": ["customer_phone"]}},
        {"name": "reschedule_booking",
         "description": "Перенести бронь на новое время или изменить число гостей. Сначала find_booking и check_availability.",
         "parameters": {"type": "object", "properties": {
             "booking_id": {"type": "string", "description": "booking_id из ответа find_booking."},
             "customer_phone": {"type": "string", "description": PHONE},
             "new_slot_start": {"type": "string", "description": "slot_start нового времени из ответа check_availability. Если меняется только число гостей — прежнее время брони."},
             "guests": {"type": "integer", "description": "Новое число гостей, если изменилось. Иначе не передавай."}},
             "required": ["booking_id", "customer_phone", "new_slot_start"]}},
        {"name": "cancel_booking",
         "description": "Отменить бронь после того, как гость подтвердил отмену.",
         "parameters": {"type": "object", "properties": {
             "booking_id": {"type": "string", "description": "booking_id из ответа find_booking."},
             "customer_phone": {"type": "string", "description": PHONE},
             "reason": {"type": "string", "description": "Причина словами гостя, если назвал."}},
             "required": ["booking_id", "customer_phone"]}},
        {"name": "request_callback",
         "description": "Передать администратору просьбу перезвонить: банкет и большая компания, жалоба, вопрос без ответа в базе знаний, сбой, нет свободных столов.",
         "parameters": {"type": "object", "properties": {
             "customer_name": {"type": "string", "description": "Имя гостя."},
             "customer_phone": {"type": "string", "description": PHONE},
             "topic": {"type": "string", "description": "О чём просят перезвонить, одной фразой."},
             "urgency": {"type": "string", "description": "Срочность словами: сегодня, в течение дня, не срочно."},
             "details": {"type": "string", "description": "Что важно знать администратору до звонка: дата, число гостей, повод."}},
             "required": ["customer_name", "customer_phone", "topic"]}},
    ]


ELEVEN_INTRO = """# ElevenLabs: инструменты

Инструменты создаются в панели: Agents → Tools → Add tool → Webhook. Заполните по таблицам ниже. Имя инструмента передаётся в адресе.

Общие поля для всех шести:

- **Method:** POST
- **Headers:** `X-Voice-Secret` — тип Secret, значение — ваш секрет из n8n.
- **Body, дополнительные свойства для всех инструментов:**
  - `caller_number` — тип Dynamic variable, `system__caller_id`. Нужен, чтобы перенос и отмена работали только с номера гостя.
  - `conversation_id` — тип Dynamic variable, `system__conversation_id`. Нужен для защиты от повторной брони.
- **Response timeout:** 20 секунд.
"""


def eleven_tail():
    text = (SALON / "providers" / "elevenlabs-tools.md").read_text(encoding="utf8")
    tail = text[text.index("## Если переменные"):]
    return tail.replace("владельца записи", "владельца брони").replace("запись сможет отменить любой", "бронь сможет отменить любой")


def build():
    tools = plain_telegram(booking_tools())
    dump(KIT / "workflows" / "booking-tools.n8n.json", tools)
    for name, wf in side_workflows().items():
        dump(KIT / "workflows" / f"{name}.n8n.json", plain_telegram(wf))
    s = schema()
    dump(KIT / "tools" / "tools.schema.json", s)
    retell = load(SALON / "providers" / "retell-llm.json")
    retell["begin_message"] = "Ресторан «{{business_name}}», здравствуйте. Я {{agent_name}}, виртуальный администратор. Хотите забронировать стол?"
    for g in retell["general_tools"]:
        if g["type"] == "transfer_call":
            g["description"] = "Перевести на администратора: банкет, жалоба, просьба о человеке, вопрос вне рамок."
    write_providers(KIT, s, retell, ELEVEN_INTRO, eleven_tail())
    dump(KIT / "data" / "config.example.json", CONFIG)
    cfg = copy.deepcopy(CONFIG)
    return tools, cfg


if __name__ == "__main__":
    wf, _ = build()
    print("built", len(wf["nodes"]), "nodes")
