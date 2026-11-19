// ---- письма: тихие часы, ссылка «отписаться», журнал отправок ----
function localHour(config, now) {
  return new Date(now + config.timezone_offset_hours * 3600000).getUTCHours();
}

function quietNow(config, now) {
  const [from, to] = config.quiet_hours || [];
  if (from === undefined || from === to) return false;
  const h = localHour(config, now);
  return from > to ? h >= from || h < to : h >= from && h < to;
}

function unsubSig(config, email) {
  return hmacSha256Hex(config.unsubscribe_secret, String(email).trim().toLowerCase()).slice(0, 32);
}

function unsubLink(config, email) {
  return `${String(config.public_n8n_url).replace(/\/$/, '')}/webhook/store-unsubscribe?e=${encodeURIComponent(email)}&s=${unsubSig(config, email)}`;
}

/** Messages: time | kind | ref | email | step | status | subject | detail */
function messageLog(values) {
  return sheetRows(values).map((r) => ({ ...r, step: Number(r.step || 0), t: Date.parse(r.time) || 0 }));
}

function suppressed(values) {
  return new Set(sheetRows(values).map((r) => String(r.email || '').toLowerCase()).filter(Boolean));
}
