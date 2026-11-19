// ---- время в часовом поясе бизнеса, без библиотек ----
const TZ = cfg.timezone;
const MIN = 60000;
const DAY = 24 * 60 * MIN;
const pad = (n) => String(n).padStart(2, '0');
const nowMs = () => (cfg.now_override ? Date.parse(cfg.now_override) : Date.now());
function offsetMin(utcMs, tz = TZ) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const p = {};
  for (const part of parts) p[part.type] = part.value;
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs) / MIN);
}
function localToUtc(y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - offsetMin(guess) * MIN;
  return guess - offsetMin(first) * MIN; // второй проход — для дней перевода часов
}
function local(ms) {
  const shifted = new Date(ms + offsetMin(ms) * MIN);
  return { y: shifted.getUTCFullYear(), mo: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(),
    h: shifted.getUTCHours(), mi: shifted.getUTCMinutes(), dow: shifted.getUTCDay() };
}
const localIso = (ms) => { const t = local(ms); return `${t.y}-${pad(t.mo)}-${pad(t.d)}T${pad(t.h)}:${pad(t.mi)}`; };
const localDate = (ms) => localIso(ms).slice(0, 10);
function spoken(ms, tz = TZ) {
  return new Intl.DateTimeFormat(cfg.locale || 'ru-RU', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}
function validTz(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}
function parseSlot(text) {
  const s = String(text || '');
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return Date.parse(s);
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
  return m ? localToUtc(+m[1], +m[2], +m[3], +m[4], +m[5]) : NaN;
}
const dayStart = (dateText) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateText); return m ? localToUtc(+m[1], +m[2], +m[3], 0, 0) : NaN; };
const eventsUrl = (query) => `${cfg.calendar_api_base}/calendars/${encodeURIComponent(cfg.calendar_id)}/events?` +
  Object.keys(query).map((key) => `${key}=${encodeURIComponent(query[key])}`).join('&');
