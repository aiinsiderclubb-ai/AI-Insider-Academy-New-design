#!/usr/bin/env node
/**
 * Kit-local fake for what the shared mock.cjs does not cover: Google Drive,
 * web pages and a web search API (Tavily-style). Used by the knowledge-base
 * and research kits.
 *
 *  GET  /drive/v3/files?q=...                 files registered with POST /__files
 *  GET  /drive/v3/files/:id/export            Google Doc as text/plain
 *  GET  /drive/v3/files/:id?alt=media         PDF bytes (built on the fly) or text
 *  GET  /page/:slug                           HTML registered with POST /__pages {slug: html}
 *  POST /search                               results registered with POST /__search {match, results}
 *  POST /v1/embeddings                        word-stem hashing, 1024 dims — sharper than mock.cjs's
 *                                             64-dim vectors, so a relevance threshold can be tested
 *
 * Control: POST /__reset, POST /__fail {contains} ({} clears), GET /__log.
 * Usage: node mock_web.cjs <port>
 */
const http = require("node:http");

const port = Number(process.argv[2] || 5743);
let files = [];
let pages = {};
let searches = [];
let failing = [];
let log = [];

function pdf(lines) {
  // A one-page PDF with Helvetica text; enough for pdf.js to extract.
  const esc = (t) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const stream = "BT /F1 11 Tf 50 780 Td 14 TL " + lines.map((l) => `(${esc(l)}) '`).join(" ") + " ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

function embed(text) {
  const v = new Array(1024).fill(0);
  for (const word of String(text).toLowerCase().replace(/ё/g, "е").match(/[\p{L}\p{N}]+/gu) || []) {
    if (word.length < 3) continue;
    let h = 2166136261;
    for (const ch of word.slice(0, 6)) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
    v[h % 1024] += 1;
  }
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const p = url.pathname;
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = raw;
      }
      const json = (data, status = 200) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(data));
      };
      const text = (data, type = "text/plain; charset=utf-8", status = 200) => {
        res.writeHead(status, { "content-type": type });
        res.end(data);
      };
      if (!p.startsWith("/__")) log.push({ method: req.method, path: p, query: Object.fromEntries(url.searchParams), body });

      if (p === "/__reset") return (files = []), (pages = {}), (searches = []), (failing = []), (log = []), json({ ok: true });
      if (p === "/__files") return files.push(...body), json({ ok: true });
      if (p === "/__pages") return Object.assign(pages, body), json({ ok: true });
      if (p === "/__search") return searches.push(...(Array.isArray(body) ? body : [body])), json({ ok: true });
      if (p === "/__fail") return body.contains ? failing.push(body.contains) : (failing = []), json({ ok: true });
      if (p === "/__log") return json(log);
      if (failing.some((f) => decodeURIComponent(req.url).includes(f))) return json({ error: { code: 500, message: "forced failure" } }, 500);

      if (p.endsWith("/embeddings")) {
        const input = Array.isArray(body.input) ? body.input : [body.input];
        return json({ object: "list", model: body.model, usage: { prompt_tokens: 1, total_tokens: 1 },
          data: input.map((t, i) => {
            const v = embed(t);
            // the OpenAI SDK asks for base64 unless told otherwise and decodes Float32 bytes
            const embedding = body.encoding_format === "base64" ? Buffer.from(new Float32Array(v).buffer).toString("base64") : v;
            return { object: "embedding", index: i, embedding };
          }) });
      }
      if (p === "/drive/v3/files") {
        return json({ files: files.map(({ id, name, mimeType, modifiedTime }) => ({ id, name, mimeType, modifiedTime, webViewLink: `https://drive.google.com/file/d/${id}/view` })) });
      }
      const m = /^\/drive\/v3\/files\/([^/]+)(\/export)?$/.exec(p);
      if (m) {
        const f = files.find((x) => x.id === m[1]);
        if (!f) return json({ error: { code: 404, message: "File not found" } }, 404);
        if (m[2]) return text(f.content);
        if (f.mimeType === "application/pdf") return text(pdf(f.lines || f.content.split("\n")), "application/pdf");
        return text(f.content);
      }
      const pg = /^\/page\/(.+)$/.exec(p);
      if (pg) return pages[pg[1]] ? text(pages[pg[1]], "text/html; charset=utf-8") : text("<h1>404</h1>", "text/html", 404);
      if (p === "/search") {
        const q = String(body.query || "").toLowerCase();
        const hit = searches.find((s) => q.includes(String(s.match).toLowerCase()));
        return json({ query: body.query, results: hit ? hit.results.slice(0, body.max_results || 10) : [], response_time: 0.1 });
      }
      return json({ error: "not found" }, 404);
    });
  })
  .listen(port, () => console.log(`mock_web on ${port}`)); // all interfaces: localhost may resolve to ::1
