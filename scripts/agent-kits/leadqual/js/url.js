// ---- разбор адреса без глобального URL (его нет в песочнице узла Code) ----
function parseUrl(text) {
  const m = /^(https?|ftp|file):\/\/(\[[^\]]*\]|[^/?#:@\s]*)(?::(\d{1,5}))?([/?#][^\s]*)?$/i.exec(String(text || '').trim());
  if (!m) return null;
  const protocol = m[1].toLowerCase() + ':';
  const hostname = m[2].toLowerCase();
  const path = m[4] || '/';
  return { protocol, hostname, port: m[3] || '', href: `${protocol}//${hostname}${m[3] ? ':' + m[3] : ''}${path}` };
}
