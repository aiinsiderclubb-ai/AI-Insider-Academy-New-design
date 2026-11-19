// ---- time helpers (business time zone, no libraries) ----
const TZ = cfg.timezone;
const MIN = 60000;
const DAY = 24 * 60 * MIN;
const pad = (n) => String(n).padStart(2, '0');
const nowMs = () => (cfg.now_override ? Date.parse(cfg.now_override) : Date.now());
function offsetMin(utcMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const p = {};
  for (const part of parts) p[part.type] = part.value;
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs) / MIN);
}
function localToUtc(y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - offsetMin(guess) * MIN;
  return guess - offsetMin(first) * MIN; // second pass settles days when clocks change
}
function local(ms) {
  const shifted = new Date(ms + offsetMin(ms) * MIN);
  return {
    y: shifted.getUTCFullYear(), mo: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(),
    h: shifted.getUTCHours(), mi: shifted.getUTCMinutes(), dow: shifted.getUTCDay(),
  };
}
const localIso = (ms) => { const t = local(ms); return `${t.y}-${pad(t.mo)}-${pad(t.d)}T${pad(t.h)}:${pad(t.mi)}`; };
const localDate = (ms) => localIso(ms).slice(0, 10);
const dayStart = (dateText) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateText); return localToUtc(+m[1], +m[2], +m[3], 0, 0); };
const at = (dateText, hhmm) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateText); const [h, mi] = String(hhmm).split(':').map(Number); return localToUtc(+m[1], +m[2], +m[3], h, mi); };
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const spokenDay = (dateText) => new Intl.DateTimeFormat(cfg.locale || 'ru-RU', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(dayStart(dateText) + 12 * 60 * MIN));
const windowOf = (id) => (cfg.windows || []).find((w) => w.id === id);
const spokenWindow = (dateText, id) => {
  const w = windowOf(id);
  return w ? `${spokenDay(dateText)}, с ${w.start} до ${w.end}` : `${spokenDay(dateText)}, интервал ${id || 'не назначен'}`;
};
