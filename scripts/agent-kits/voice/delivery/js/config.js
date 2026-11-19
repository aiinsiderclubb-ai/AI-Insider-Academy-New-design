// Config — the only node you edit. Delivery days, windows, cities and rules.
// Everything below this node reads its settings from here. Guide: docs/02-backend-n8n.md
return [{ json: {
  "timezone": "Europe/Kyiv",
  "locale": "ru-RU",
  "sheets_api_base": "https://sheets.googleapis.com/v4/spreadsheets",
  "spreadsheet_id": "REPLACE_WITH_SPREADSHEET_ID",
  "sheet_name": "Orders",
  "staff_chat_id": "REPLACE_WITH_TELEGRAM_CHAT_ID",
  "phone": { "country_code": "380", "national_prefix": "0" },
  "require_caller_match": true,
  "callback_promise": "в течение часа в рабочее время",
  "service_cities": ["Киев", "Київ", "Kyiv", "Бровары", "Ирпень"],
  "delivery_days": ["mon", "tue", "wed", "thu", "fri", "sat"],
  "closed_dates": [],
  "delivery_window_days": 7,
  "windows": [
    { "id": "09-12", "start": "09:00", "end": "12:00", "capacity": 25 },
    { "id": "12-15", "start": "12:00", "end": "15:00", "capacity": 25 },
    { "id": "15-18", "start": "15:00", "end": "18:00", "capacity": 25 },
    { "id": "18-21", "start": "18:00", "end": "21:00", "capacity": 20 }
  ],
  "change_cutoff_hours": 3,
  "changeable_statuses": ["new", "packed"],
  "status_labels": {
    "new": "принят",
    "packed": "собран",
    "out_for_delivery": "у курьера",
    "delivered": "доставлен",
    "cancelled": "отменён"
  },
  "notify_on_confirm": false,
  "outbound": {
    "provider": "vapi",
    "vapi_api_base": "https://api.vapi.ai",
    "vapi_assistant_id": "REPLACE_WITH_VAPI_ASSISTANT_ID",
    "vapi_phone_number_id": "REPLACE_WITH_VAPI_PHONE_NUMBER_ID",
    "retell_api_base": "https://api.retellai.com",
    "retell_agent_id": "REPLACE_WITH_RETELL_AGENT_ID",
    "retell_from_number": "REPLACE_WITH_RETELL_NUMBER_E164",
    "call_from": "10:00",
    "call_until": "20:00",
    "max_attempts": 2,
    "max_calls_per_run": 50
  }
} }];
