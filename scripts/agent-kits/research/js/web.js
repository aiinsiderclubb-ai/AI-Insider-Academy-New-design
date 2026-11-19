// ---- web helpers (inlined by the builder) ----
function refOf(url) {
  let h = 2166136261;
  for (const ch of String(url).replace(/#.*$/, '').replace(/\/$/, '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return 's' + (h % 0xffff).toString(16).padStart(4, '0');
}
// URL is not available in the Code node sandbox, so the host is parsed by hand.
function hostOf(url) {
  const m = /^https?:\/\/(?:[^@/?#]*@)?(\[[^\]]+\]|[^:/?#]+)/i.exec(String(url).trim());
  return m ? m[1].toLowerCase().replace(/^www\./, '') : '';
}
function matchesDomain(host, list) {
  return (list || []).some((d) => host === d || host.endsWith('.' + d));
}
function isPrivateHost(host) {
  host = host.replace(/^\[|\]$/g, '');
  // 2130706433, 0x7f000001, 0177.0.0.1 — numeric spellings of local addresses
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host) || /^0\d/.test(host)) return true;
  return host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host === '::1' || /^\[?(fc|fd|fe80)/i.test(host) ||
    host === 'metadata.google.internal';
}
