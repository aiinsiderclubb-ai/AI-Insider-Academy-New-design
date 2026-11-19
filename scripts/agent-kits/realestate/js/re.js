// ---- агентство: общие функции (встраиваются в узлы Code сборщиком) ----
const LEAD_COLS = ['created', 'lead_id', 'session_id', 'channel', 'source', 'name', 'phone', 'email', 'telegram', 'deal_type',
  'property_type', 'area', 'rooms', 'budget_max', 'currency', 'timeline', 'mortgage', 'score', 'segment', 'agent_id', 'stage',
  'listing_ids', 'viewing_id', 'last_contact', 'follow_ups', 'notified', 'notes'];
const colLetter = (index) => {
  let s = '';
  let n = index + 1;
  while (n) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
const LEAD_LAST = colLetter(LEAD_COLS.length - 1);
const leadRange = (row) => `Leads!A${row}:${LEAD_LAST}${row}`;
const leadValues = (lead) => LEAD_COLS.map((c) => String(lead[c] ?? ''));

const normId = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
const norm = (v) => String(v || '').toLowerCase().replace(/ё/g, 'е').trim();
const digits = (v) => String(v || '').replace(/\D/g, '');
const num = (v) => {
  const d = String(v ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  return d ? Number(d) : 0;
};

// Ищем лида этого диалога, а если его нет — по телефону.
function findLead(rows, session_id, phone) {
  const bySession = rows.find((r) => r.session_id === session_id);
  if (bySession) return bySession;
  const p = digits(phone);
  return p.length >= 9 ? rows.find((r) => digits(r.phone).endsWith(p.slice(-9))) : null;
}

// ---- время в часовом поясе агентства ----
function tzParts(ms, tz) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(new Date(ms))) parts[p.type] = p.value;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday: parts.weekday.toLowerCase().slice(0, 3) };
}
// Местное время → момент в UTC (с учётом перехода на летнее время).
function zonedToMs(date, time, tz) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const p = tzParts(guess, tz);
    const [py, pmo, pd] = p.date.split('-').map(Number);
    const [ph, pmi] = p.time.split(':').map(Number);
    const shown = Date.UTC(py, pmo - 1, pd, ph, pmi);
    guess += Date.UTC(y, mo - 1, d, h, mi) - shown;
  }
  return guess;
}
const addDays = (date, n) => new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const weekdayOf = (date) => WEEK[new Date(date + 'T12:00:00Z').getUTCDay()];
const RU_DAYS = { mon: 'понедельник', tue: 'вторник', wed: 'среда', thu: 'четверг', fri: 'пятница', sat: 'суббота', sun: 'воскресенье' };
function spoken(ms, tz) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}

// «сегодня», «завтра», «пятница», «2026-11-21», «+3» → дата; пусто — ближайшие дни.
function resolveDate(word, today) {
  const w = norm(word);
  if (!w) return { from: today, days: 7 };
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return { from: w, days: 1 };
  if (['today', 'сегодня'].includes(w)) return { from: today, days: 1 };
  if (['tomorrow', 'завтра'].includes(w)) return { from: addDays(today, 1), days: 1 };
  if (['послезавтра'].includes(w)) return { from: addDays(today, 2), days: 1 };
  const plus = /^\+(\d{1,2})$/.exec(w);
  if (plus) return { from: addDays(today, Number(plus[1])), days: 1 };
  const names = { mon: ['mon', 'monday', 'понедельник', 'пн'], tue: ['tue', 'tuesday', 'вторник', 'вт'], wed: ['wed', 'wednesday', 'среда', 'среду', 'ср'],
    thu: ['thu', 'thursday', 'четверг', 'чт'], fri: ['fri', 'friday', 'пятница', 'пятницу', 'пт'], sat: ['sat', 'saturday', 'суббота', 'субботу', 'сб'],
    sun: ['sun', 'sunday', 'воскресенье', 'вс'] };
  const day = Object.keys(names).find((k) => names[k].includes(w));
  if (day) {
    for (let i = 0; i < 7; i++) if (weekdayOf(addDays(today, i)) === day) return { from: addDays(today, i), days: 1 };
  }
  if (['week', 'неделя', 'на неделе', 'this week'].includes(w)) return { from: today, days: 7 };
  return null;
}

// Свободные окна риелтора: часы просмотров минус занятость с зазором.
function freeSlots(config, busy, from, days, nowMs, limit) {
  const tz = config.timezone;
  const today = tzParts(nowMs, tz).date;
  const last = addDays(today, config.booking_window_days);
  const dur = config.viewing_minutes * 60000;
  const buf = config.buffer_minutes * 60000;
  const blocks = busy.map((b) => [Date.parse(b.start) - buf, Date.parse(b.end) + buf]);
  const out = [];
  for (let i = 0; i < days && out.length < limit; i++) {
    const date = addDays(from, i);
    if (date > last) break;
    const hours = config.viewing_hours[weekdayOf(date)];
    if (!hours) continue;
    const open = zonedToMs(date, hours[0], tz);
    const close = zonedToMs(date, hours[1], tz);
    for (let t = open; t + dur <= close && out.length < limit; t += 30 * 60000) {
      if (t < nowMs + config.lead_time_minutes * 60000) continue;
      if (blocks.some(([s, e]) => t < e && t + dur > s)) continue;
      out.push(t);
      t += dur - 30 * 60000; // следующий вариант — после этого просмотра, без пересечений
    }
  }
  return out;
}

const localIso = (ms, tz) => {
  const p = tzParts(ms, tz);
  return `${p.date}T${p.time}`;
};
