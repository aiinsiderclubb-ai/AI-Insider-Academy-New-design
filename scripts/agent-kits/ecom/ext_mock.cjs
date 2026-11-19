#!/usr/bin/env node
/**
 * Kit-local fakes the shared mock.cjs does not cover:
 *  - Shopify Admin GraphQL  POST /shopify/admin/api/<version>/graphql.json  (orders, abandonedCheckouts)
 *  - WooCommerce REST v3    GET  /woo/wp-json/wc/v3/orders[/<id>]
 *  - an SMTP sink on <port+1> that keeps every message
 * Control: POST /__shop {orders, checkouts, woo}, GET /__mail, POST /__reset, GET /__log
 *
 * Usage: node ext_mock.cjs <port>
 */
const http = require("node:http");
const net = require("node:net");

const port = Number(process.argv[2] || 5762);
let shop = { orders: [], checkouts: [], woo: [] };
let mail = [];
let log = [];

function json(res, data, status = 200) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

/* Shopify search syntax, the part the kits use: name:#1001, updated_at:>=ISO, created_at:>=ISO */
function shopifyFilter(list, q) {
  if (!q) return list;
  let out = list;
  const name = /name:(\S+)/.exec(q);
  if (name) out = out.filter((o) => o.name.replace("#", "") === name[1].replace(/["']/g, "").replace("#", ""));
  const upd = /updated_at:>=['"]?([^'"\s]+)/.exec(q);
  if (upd) out = out.filter((o) => (o.updatedAt || o.createdAt) >= upd[1]);
  const cr = /created_at:>=['"]?([^'"\s]+)/.exec(q);
  if (cr) out = out.filter((o) => o.createdAt >= cr[1]);
  return out;
}

function graphql(body) {
  const q = body.query || "";
  const v = body.variables || {};
  if (/abandonedCheckouts\s*\(/.test(q)) return { data: { abandonedCheckouts: { nodes: shopifyFilter(shop.checkouts, v.q) } } };
  if (/orders\s*\(/.test(q)) return { data: { orders: { nodes: shopifyFilter(shop.orders, v.q) } } };
  return { errors: [{ message: "mock: unsupported query" }] };
}

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = raw;
      }
      const p = url.pathname;
      if (!p.startsWith("/__")) log.push({ method: req.method, path: p, query: Object.fromEntries(url.searchParams), headers: req.headers, body });
      if (p === "/__shop") return (shop = { orders: [], checkouts: [], woo: [], ...body }), json(res, { ok: true });
      if (p === "/__mail") return json(res, mail);
      if (p === "/__log") return json(res, log);
      if (p === "/__reset") return (shop = { orders: [], checkouts: [], woo: [] }), (mail = []), (log = []), json(res, { ok: true });

      if (p.startsWith("/shopify/admin/api/") && p.endsWith("/graphql.json")) {
        if (!req.headers["x-shopify-access-token"]) return json(res, { errors: "[API] Invalid API key or access token" }, 401);
        return json(res, graphql(body));
      }
      const woo = /^\/woo\/wp-json\/wc\/v3\/orders(?:\/(\d+))?$/.exec(p);
      if (woo) {
        if (!req.headers.authorization) return json(res, { code: "woocommerce_rest_cannot_view" }, 401);
        if (woo[1]) {
          const o = shop.woo.find((x) => String(x.id) === woo[1] || String(x.number) === woo[1]);
          return o ? json(res, o) : json(res, { code: "woocommerce_rest_shop_order_invalid_id", message: "Invalid ID.", data: { status: 404 } }, 404);
        }
        let list = shop.woo;
        const status = url.searchParams.get("status");
        if (status) list = list.filter((o) => o.status === status);
        const after = url.searchParams.get("modified_after") || url.searchParams.get("after");
        if (after) list = list.filter((o) => (o.date_modified_gmt || o.date_created_gmt) >= after.replace("Z", ""));
        return json(res, list);
      }
      return json(res, { error: "not found" }, 404);
    });
  })
  .listen(port, "127.0.0.1");

/* ---------- SMTP sink: no TLS, no auth required ---------- */
net
  .createServer((socket) => {
    let state = "cmd";
    let current = { from: "", to: [], data: "" };
    const say = (line) => socket.write(line + "\r\n");
    say("220 sink ESMTP");
    let buf = "";
    socket.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (state === "data") {
          if (line === ".") {
            mail.push({ ...current, data: current.data, subject: decodeSubject(current.data) });
            current = { from: "", to: [], data: "" };
            state = "cmd";
            say("250 OK queued");
          } else current.data += (line.startsWith("..") ? line.slice(1) : line) + "\n";
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO" || cmd === "HELO") say("250-sink\r\n250-8BITMIME\r\n250 AUTH PLAIN LOGIN");
        else if (cmd === "AUTH") say("235 OK");
        else if (cmd === "MAIL") (current.from = line.slice(10).trim()), say("250 OK");
        else if (cmd === "RCPT") current.to.push(line.slice(8).trim()), say("250 OK");
        else if (cmd === "DATA") (state = "data"), say("354 go");
        else if (cmd === "RSET") (current = { from: "", to: [], data: "" }), say("250 OK");
        else if (cmd === "QUIT") say("221 bye"), socket.end();
        else say("250 OK");
      }
    });
    socket.on("error", () => {});
  })
  .listen(port + 1, "127.0.0.1");

function decodeSubject(data) {
  const m = /^Subject: (.*(?:\n[ \t].*)*)/m.exec(data);
  if (!m) return "";
  return m[1].replace(/\n[ \t]/g, "").replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi, (_, enc, text) =>
    enc.toLowerCase() === "b" ? Buffer.from(text, "base64").toString("utf8") : decodeQ(text)).replace(/\s+/g, " ").trim();
}

function decodeQ(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "=") {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(text[i] === "_" ? 32 : text.charCodeAt(i));
  }
  return Buffer.from(bytes).toString("utf8");
}

console.log(`ext mock on ${port}, smtp on ${port + 1}`);
