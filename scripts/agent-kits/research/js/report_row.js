// Report Row: строка листа Reports и тело для callback_url.
// Колонки: job_id | created | finished | requester | depth | status | request | sources | searches | pages | flags | report
const r = $('Report File').first().json;
const row = [r.job_id, r.started, r.finished, r.requester, r.depth, r.status, r.request, String(r.stats.cited),
  String(r.stats.searches), String(r.stats.pages), r.flags.join(', '), r.report_md.slice(0, 45000)];
const callback = { job_id: r.job_id, status: r.status, title: r.title, report_markdown: r.report_md, sources: r.sources, stats: r.stats };
if (r.debug) {
  callback.tools = r.tools;
  callback.flags = r.flags;
}
return [{ json: { row, callback, callback_url: r.callback_url, wait: r.wait, alert_html: r.alert_html } }];
