#!/usr/bin/env node
/**
 * One fake for every outside service the agent kits call, so a kit can run
 * end to end in a local n8n:
 *
 *  - OpenAI-compatible chat completions with tool calls  POST /v1/chat/completions
 *  - Anthropic messages with tool use                     POST /v1/messages
 *  - embeddings (deterministic hashed bag of words)       POST /v1/embeddings
 *  - Google Sheets values API, in memory                  /sheets/v4/spreadsheets/:id/values/...
 *  - Google Calendar freeBusy + events                    /calendar/v3/...
 *  - Telegram Bot API (records every call)                /bot<token>/<method>
 *  - anything else under /hook/... is recorded and answered with {ok:true}
 *
 * The model is scripted, not clever. POST /__script registers
 *   { match: "text in the last user message", steps: [ {tool, args} ..., {final} ] }
 * Each model call answers with the step whose index equals the number of tool
 * results already sent after the last user message. `{final}` may contain
 * {{result}} (the last tool result as text) and {{result.field}}.
 *
 * Control: GET /__log, POST /__reset, POST /__sheet {tab, rows}, GET /__sheet?tab=,
 *          POST /__fail {contains} — every later request whose path contains it gets a 500; {} clears
 *
 * Usage: node mock.cjs <port>
 */
const http = require("node:http");

const port = Number(process.argv[2] || 5699);
let log = [];
let scripts = [];
let sheets = {};
let events = [];
let failing = [];

function reset() {
  log = [];
  scripts = [];
  sheets = {};
  events = [];
  failing = [];
}

/* ---------- scripted model ---------- */

function pickScript(text) {
  const t = text.toLowerCase();
  return scripts.find((s) => t.includes(s.match.toLowerCase()));
}

function fill(template, result) {
  return template.replace(/\{\{result(?:\.([\w.]+))?\}\}/g, (_, path) => {
    if (!path) return typeof result === "string" ? result : JSON.stringify(result);
    let v = typeof result === "string" ? safeJson(result) : result;
    for (const key of path.split(".")) v = v == null ? v : v[key];
    return v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  });
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Normalised view of a conversation: the last user text, the tool results after it, the system prompt. */
function openaiView(body) {
  const msgs = body.messages || [];
  let lastUser = -1;
  msgs.forEach((m, i) => {
    if (m.role === "user") lastUser = i;
  });
  const text = lastUser >= 0 ? contentText(msgs[lastUser].content) : "";
  const results = msgs.slice(lastUser + 1).filter((m) => m.role === "tool").map((m) => contentText(m.content));
  const system = msgs.filter((m) => m.role === "system").map((m) => contentText(m.content)).join("\n");
  return { text, results, system, tools: (body.tools || []).map((t) => t.function?.name) };
}

function anthropicView(body) {
  const msgs = body.messages || [];
  let lastUser = -1;
  msgs.forEach((m, i) => {
    const blocks = Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }];
    if (m.role === "user" && blocks.some((b) => b.type === "text")) lastUser = i;
  });
  const text = lastUser >= 0 ? contentText(msgs[lastUser].content) : "";
  const results = [];
  for (const m of msgs.slice(lastUser + 1)) {
    for (const b of Array.isArray(m.content) ? m.content : []) {
      if (b.type === "tool_result") results.push(contentText(b.content));
    }
  }
  const system = Array.isArray(body.system) ? body.system.map((b) => b.text).join("\n") : body.system || "";
  return { text, results, system, tools: (body.tools || []).map((t) => t.name) };
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((b) => (typeof b === "string" ? b : b.text ?? contentText(b.content ?? ""))).join("");
  return "";
}

function unwrap(v) {
  return Array.isArray(v) && v.length === 1 ? v[0] : v;
}

function decide(view) {
  const script = pickScript(view.text);
  if (!script) return { final: "OK" };
  const step = script.steps[Math.min(view.results.length, script.steps.length - 1)];
  if (step.tool) {
    if (view.tools.length && !view.tools.includes(step.tool)) {
      return { final: `MOCK: tool ${step.tool} is not offered (offered: ${view.tools.join(", ")})` };
    }
    return { tool: step.tool, args: step.args || {} };
  }
  const last = view.results.length ? view.results[view.results.length - 1] : "";
  return { final: fill(step.final, unwrap(safeJson(last))) };
}

let callId = 0;

function openaiAnswer(body) {
  const d = decide(openaiView(body));
  const message = d.tool
    ? { role: "assistant", content: null, tool_calls: [{ id: `call_${++callId}`, type: "function", function: { name: d.tool, arguments: JSON.stringify(d.args) } }] }
    : { role: "assistant", content: d.final };
  return {
    id: `chatcmpl_${callId}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: body.model,
    choices: [{ index: 0, message, finish_reason: d.tool ? "tool_calls" : "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  };
}

function anthropicAnswer(body) {
  const d = decide(anthropicView(body));
  const content = d.tool ? [{ type: "tool_use", id: `toolu_${++callId}`, name: d.tool, input: d.args }] : [{ type: "text", text: d.final }];
  return {
    id: `msg_${callId}`,
    type: "message",
    role: "assistant",
    model: body.model,
    content,
    stop_reason: d.tool ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

function embed(text) {
  const dims = 64;
  const v = new Array(dims).fill(0);
  for (const word of String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) {
    const stem = word.slice(0, 5);
    let h = 0;
    for (const ch of stem) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    v[h % dims] += 1;
  }
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

/* ---------- Google Sheets values API ---------- */

function tab(name) {
  return (sheets[name] ??= []);
}

function parseRange(text) {
  const decoded = decodeURIComponent(text).replace(/''/g, "'");
  const m = /^'?(.*?)'?(?:!([A-Z]+)(\d+)?(?::[A-Z]+\d*)?)?$/.exec(decoded);
  return { tab: m[1], col: m[2] ? m[2].charCodeAt(0) - 65 : 0, row: m[3] ? Number(m[3]) : 1 };
}

function sheetsApi(method, url, body) {
  const tail = url.pathname.split("/values")[1] ?? "";
  if (tail === ":batchUpdate") {
    for (const item of body.data) {
      const r = parseRange(item.range);
      item.values.forEach((values, i) => {
        const row = (tab(r.tab)[r.row - 1 + i] ??= []);
        values.forEach((value, j) => (row[r.col + j] = value));
      });
    }
    return { totalUpdatedRows: body.data.length };
  }
  if (tail === ":batchGet") {
    return {
      valueRanges: url.searchParams.getAll("ranges").map((range) => {
        const rows = tab(parseRange(range).tab);
        return rows.length ? { range, values: rows.map((row) => [...row]) } : { range };
      }),
    };
  }
  const target = tail.slice(1).replace(/:append$/, "");
  const r = parseRange(target);
  const rows = tab(r.tab);
  if (method === "GET") return rows.length ? { range: target, values: rows.map((row) => [...row]) } : { range: target };
  if (method === "POST") {
    const start = rows.length + 1;
    for (const row of body.values) rows.push([...row]);
    return { updates: { updatedRange: `${r.tab}!A${start}:Z${rows.length}`, updatedRows: body.values.length } };
  }
  if (method === "PUT") {
    body.values.forEach((values, i) => {
      const row = (rows[r.row - 1 + i] ??= []);
      values.forEach((value, j) => (row[r.col + j] = value));
    });
    return { updatedRows: body.values.length };
  }
  return {};
}

/* ---------- Google Calendar ---------- */

function calendarApi(method, url, body) {
  if (url.pathname.endsWith("/freeBusy")) {
    const busy = events
      .filter((e) => e.status !== "cancelled" && e.end.dateTime > body.timeMin && e.start.dateTime < body.timeMax)
      .map((e) => ({ start: e.start.dateTime, end: e.end.dateTime }));
    const calendars = {};
    for (const item of body.items || []) calendars[item.id] = { busy };
    return { kind: "calendar#freeBusy", timeMin: body.timeMin, timeMax: body.timeMax, calendars };
  }
  const m = /\/events(?:\/([^/]+))?$/.exec(url.pathname);
  if (m && method === "POST" && !m[1]) {
    const event = { id: `evt${events.length + 1}`, status: "confirmed", ...body };
    events.push(event);
    return event;
  }
  if (m && m[1]) {
    const event = events.find((e) => e.id === m[1]);
    if (!event) return { __status: 404, error: { code: 404, message: "Not Found" } };
    if (method === "DELETE") {
      event.status = "cancelled";
      return {};
    }
    if (method === "PATCH" || method === "PUT") Object.assign(event, body);
    return event;
  }
  if (m && method === "GET") {
    const q = url.searchParams;
    let items = events.filter((e) => e.status !== "cancelled");
    if (q.get("privateExtendedProperty")) {
      const [k, v] = q.get("privateExtendedProperty").split("=");
      items = items.filter((e) => e.extendedProperties?.private?.[k] === v);
    }
    return { items };
  }
  return {};
}

/* ---------- server ---------- */

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      let body = {};
      const type = req.headers["content-type"] || "";
      if (type.includes("json")) body = safeJson(raw) || {};
      else if (type.includes("x-www-form-urlencoded")) body = Object.fromEntries(new URLSearchParams(raw));
      else body = raw ? safeJson(raw) : {};
      const send = (data, status = 200) => {
        res.writeHead(data && data.__status ? data.__status : status, { "content-type": "application/json" });
        res.end(JSON.stringify(data));
      };
      const p = url.pathname;
      if (!p.startsWith("/__")) log.push({ method: req.method, path: p, query: Object.fromEntries(url.searchParams), headers: req.headers, body });

      if (p === "/__log") return send(log);
      if (p === "/__reset") return reset(), send({ ok: true });
      if (p === "/__script") return scripts.push(...(Array.isArray(body) ? body : [body])), send({ ok: true, count: scripts.length });
      if (p === "/__sheet" && req.method === "POST") return (sheets[body.tab] = body.rows.map((r) => r.map(String))), send({ ok: true });
      if (p === "/__sheet") return send(sheets[url.searchParams.get("tab")] || []);
      if (p === "/__events" && req.method === "POST") return events.push(...body), send({ ok: true });
      if (p === "/__events") return send(events);

      if (p === "/__fail") return body.contains ? failing.push(body.contains) : (failing = []), send({ ok: true });
      if (failing.some((f) => decodeURIComponent(p).includes(f))) return send({ error: { code: 500, message: "forced failure" } }, 500);

      if (p.endsWith("/chat/completions")) return send(openaiAnswer(body));
      if (p.endsWith("/v1/messages")) return send(anthropicAnswer(body));
      if (p.endsWith("/embeddings")) {
        const input = Array.isArray(body.input) ? body.input : [body.input];
        return send({ object: "list", data: input.map((t, i) => ({ object: "embedding", index: i, embedding: embed(t) })), model: body.model, usage: { prompt_tokens: 1, total_tokens: 1 } });
      }
      if (p.endsWith("/models")) return send({ object: "list", data: [{ id: "gpt-5-mini", object: "model" }] });
      if (p.startsWith("/sheets/")) return send(sheetsApi(req.method, url, body));
      if (p.startsWith("/calendar/")) return send(calendarApi(req.method, url, body));
      const bot = /^\/bot[^/]+\/(\w+)/.exec(p);
      if (bot) return send({ ok: true, result: { message_id: log.length, chat: { id: body.chat_id }, text: body.text } });
      if (p.startsWith("/fail")) return send({ error: "forced failure" }, 500);
      return send({ ok: true });
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`mock on ${port}`));
