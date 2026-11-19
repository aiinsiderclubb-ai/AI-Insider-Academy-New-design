import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { codeNodes, credentialsArePlaceholders, workflow, type J } from "./helpers/n8n-kit";

const SLUG = "knowledge-base-agent";
const flow = workflow(SLUG, SLUG);
const code = codeNodes(flow);
const dir = path.join(process.cwd(), "content/products", SLUG);

/** Like helpers' runCode, plus `$('Node').all()` and several input items — the reindex nodes need both. */
function run(name: string, nodes: J, input: J | J[]): J[] {
  const items = (Array.isArray(input) ? input : [input]).map((json) => ({ json }));
  const $ = (node: string) => {
    const value = nodes[node];
    const list = Array.isArray(value) ? value : [value];
    return {
      isExecuted: node in nodes,
      first: () => {
        if (!(node in nodes)) throw new Error(`node ${node} has not run`);
        return { json: list[0] };
      },
      all: () => list.map((json: J) => ({ json })),
    };
  };
  const $input = { first: () => items[0], all: () => items };
  const staticData = () => (nodes.$static ??= {});
  return (new Function("$", "$input", "$getWorkflowStaticData", code[name])($, $input, staticData) as { json: J }[]).map((i) => i.json);
}

const config: J = run("Config", {}, {})[0].config;
const cfg: J = { ...config, agent_token: "secret-token", allowed_telegram_ids: [555] };
const tg = (from: number, text: string) => ({ update_id: 1, message: { chat: { id: from }, from: { id: from, first_name: "U" }, text } });
const web = (body: J, token = "secret-token") => ({ body, headers: { "x-agent-token": token } });

describe("Guard In", () => {
  it("lets in only listed Telegram users and tells the stranger their ID", () => {
    expect(run("Guard In", {}, { config: cfg, input: tg(555, "Как оформить отпуск?") })[0].route).toBe("agent");
    const nodes: J = {};
    const first = run("Guard In", nodes, { config: cfg, input: tg(777, "дай доступ") })[0];
    expect(first.kind).toBe("no_access");
    expect(first.reply).toContain("777");
    expect(run("Guard In", nodes, { config: cfg, input: tg(777, "ну дай") })[0].kind).toBe("no_access_quiet");
  });

  it("refuses the web without the token, and the shipped placeholder token", () => {
    expect(run("Guard In", {}, { config: cfg, input: web({ session_id: "abcdef", message: "q" }, "x") })[0].route).toBe("deny");
    expect(run("Guard In", {}, { config, input: web({ session_id: "abcdef", message: "q" }, config.agent_token) })[0].route).toBe("deny");
  });

  it("hands a request for a person to the team", () => {
    expect(run("Guard In", {}, { config: cfg, input: web({ session_id: "abcdef", message: "Соедините с живым человеком" }) })[0].kind).toBe("handoff");
  });
});

describe("reindex", () => {
  const drive = {
    files: [
      { id: "g1", name: "Регламент", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-01-01", webViewLink: "https://docs/g1" },
      { id: "p1", name: "Policy.pdf", mimeType: "application/pdf" },
      { id: "m1", name: "notes.md", mimeType: "application/octet-stream" },
      { id: "x1", name: "photo.png", mimeType: "image/png" },
    ],
  };
  const sources = { values: [["url", "title", "enabled"], ["https://site/a", "A", "да"], ["https://site/b", "B", "нет"], ["ftp://x", "", ""]] };
  const plan = (d: J = drive, s: J = sources) => run("Plan Sources", { Config: { config: cfg }, "List Drive Files": d, "Read Sources": s }, {});

  it("plans supported files and enabled links, skips the rest with a reason", () => {
    const items = plan();
    expect(items.map((i) => i.fetch).sort()).toEqual(["gdoc", "pdf", "text", "url"]);
    expect(items.find((i) => i.fetch === "pdf")?.title).toBe("Policy");
    const skipped = items[0].skipped.map((s: J) => s.title);
    expect(skipped).toContain("photo.png");
    expect(skipped).toContain("ftp://x");
    expect(items.some((i) => i.url === "https://site/b")).toBe(false);
  });

  it("stops before touching the index when the folder cannot be read", () => {
    expect(plan({ error: { message: "403" } })[0].abort).toBe(true);
  });

  it("an empty folder empties the index", () => {
    const items = plan({ files: [] }, { values: [["url"]] });
    expect(items[0].empty).toBe(true);
    const built = run("Build Docs", { "Plan Sources": items }, items);
    expect(built[0].tombstone).toBe("1");
  });

  it("extracts readable text from a page", () => {
    const input = { source_id: "url:x", title: "x", url: "https://x", fetch: "url" };
    const html = "<html><title>Help</title><script>evil()</script><nav>menu</nav><p>Пароль — 12 символов &amp; больше.</p><p>Второй абзац текста.</p></html>";
    const out = run("Doc Text", { Config: { config: cfg, input } }, { data: html })[0];
    expect(out.ok).toBe(true);
    expect(out.text).toContain("Пароль — 12 символов & больше.");
    expect(out.text).not.toContain("evil");
    expect(out.text).not.toContain("menu");
    expect(run("Doc Text", { Config: { config: cfg, input } }, { data: "<p>x</p>" })[0].ok).toBe(false);
    expect(run("Doc Text", { Config: { config: cfg, input } }, { error: { message: "404" } })[0].error).toContain("404");
  });

  it("numbers documents, keeps going past a broken one, and refuses to wipe the index when all fail", () => {
    const items = plan();
    const results = items.map((p, i) => (i === 1 ? { ok: false, error: "broken" } : { ok: true, text: "t".repeat(50), chars: 50 }));
    const built = run("Build Docs", { "Plan Sources": items }, results);
    expect(built.map((b) => b.code)).toEqual(["d1", "d2", "d3"]);
    expect(built[0].summary.failed).toHaveLength(1);
    const none = run("Build Docs", { "Plan Sources": items }, items.map(() => ({ ok: false, error: "x" })));
    expect(none[0].abort).toBe(true);
  });

  it("writes the registry with chunk counts and blanks the old rows", () => {
    const built = [
      { code: "d1", title: "A", url: "u1", source_id: "s1", modified: "", chars: 10, summary: { failed: [{ title: "B", reason: "x" }], skipped: [], warnings: [] } },
      { code: "d2", title: "C", url: "u2", source_id: "s2", modified: "", chars: 20 },
    ];
    const chunks = [{ metadata: { code: "d1" } }, { metadata: { code: "d1" } }, { metadata: { code: "d2" } }];
    const out = run("Registry", { "Build Docs": built, "Read Registry": { values: Array.from({ length: 8 }, () => ["x"]) } }, chunks)[0];
    expect(out.rows[1].slice(0, 2)).toEqual(["d1", "A"]);
    expect(out.rows[1][5]).toBe("2");
    expect(out.rows[3][7]).toContain("ошибка");
    expect(out.rows).toHaveLength(8);
    expect(out.total_chunks).toBe(3);
  });
});

const hit = (doc: string, score: number, extra: J = {}) => ({ document: { pageContent: `text ${doc}`, metadata: { code: doc, title: `T${doc}`, url: `u${doc}`, ...extra } }, score });
const search = (passages: J[], found = true) => ({ action: { tool: "search_documents", toolInput: { query: "q" } }, observation: JSON.stringify([{ found, passages }]) });
const passage = (doc: string) => ({ cite: `[${doc}]`, document: `Doc ${doc}`, url: `https://d/${doc}`, text: "t", score: 0.9 });

describe("search", () => {
  const rank = (items: J[]) => run("Rank Passages", { Config: { config: cfg, input: { query: "q" } } }, items)[0];

  it("keeps passages above the threshold, best first, with citation codes", () => {
    const out = rank([hit("d1", 0.2), hit("d2", 0.8), hit("d3", 0.5)]);
    expect(out.found).toBe(true);
    expect(out.passages.map((p: J) => p.cite)).toEqual(["[d2]", "[d3]"]);
  });

  it("says the documents do not have it instead of passing weak matches", () => {
    const out = rank([hit("d1", 0.1)]);
    expect(out.found).toBe(false);
    expect(out.note).toContain("не отвечай по памяти");
  });

  it("treats an empty index and the placeholder entry as no documents", () => {
    expect(rank([{}]).note).toContain("Индекс пуст");
    expect(rank([hit("d0", 0.9, { tombstone: "1" })]).found).toBe(false);
  });
});

describe("Guard Out", () => {
  const g = { channel: "web", session_id: "web:s1", customer: {}, text: "вопрос", flags: [], debug: false };
  const guard = (output: string, steps: J[]) => run("Guard Out", { Config: { config: cfg }, "Guard In": g }, { output, intermediateSteps: steps })[0];

  it("renumbers citations and appends the sources the agent actually used", () => {
    const out = guard("Срок 14 дней [d7]. Согласует руководитель [d2]. Ещё раз [d7].", [search([passage("d2"), passage("d7")])]);
    expect(out.reply).toMatch(/^Срок 14 дней \[1\]\. Согласует руководитель \[2\]\. Ещё раз \[1\]\./);
    expect(out.reply).toContain("Источники:\n1. Doc d7 — https://d/d7\n2. Doc d2 — https://d/d2");
    expect(out.reply_html).toContain('<a href="https://d/d7">Doc d7</a>');
  });

  it("drops a citation to a document the search did not return", () => {
    const out = guard("Факт [d9].", [search([passage("d2")])]);
    expect(out.reply).not.toContain("d9");
    expect(out.flags).toContain("bad_citation");
    expect(out.flags).toContain("no_citation");
  });

  it("marks a question the documents do not answer", () => {
    const out = guard("В документах этого нет.", [search([], false)]);
    expect(out.flags).toContain("not_found");
    const log = run("Log Row", { "Guard Out": out }, {})[0];
    expect(log.gap[1]).toBe("вопрос");
  });

  it("never lets the canary out and hands over on an empty answer", () => {
    expect(guard(`метка ${cfg.canary}`, []).flags).toContain("prompt_leak");
    const empty = guard("", []);
    expect(empty.handoff).toBe(true);
    expect(empty.alert_html).toContain("не смог ответить");
  });
});

describe("package", () => {
  it("ships placeholder credentials only", () => {
    expect(credentialsArePlaceholders(flow)).toBe(true);
    expect(credentialsArePlaceholders(workflow(SLUG, "error-alert"))).toBe(true);
  });

  it("offers the model the same tools the schemas describe", () => {
    const openai = JSON.parse(readFileSync(path.join(dir, "agent/tools.openai.json"), "utf8"));
    const anthropic = JSON.parse(readFileSync(path.join(dir, "agent/tools.anthropic.json"), "utf8"));
    const nodes = flow.nodes.filter((n: J) => n.type === "@n8n/n8n-nodes-langchain.toolWorkflow");
    expect(nodes.map((n: J) => n.name).sort()).toEqual(openai.map((t: J) => t.function.name).sort());
    expect(anthropic.map((t: J) => t.name).sort()).toEqual(openai.map((t: J) => t.function.name).sort());
    for (const t of openai) {
      const node = nodes.find((n: J) => n.name === t.function.name);
      const fromAi = Object.values(node.parameters.workflowInputs.value as J)
        .map((v) => /\$fromAI\('(\w+)'/.exec(String(v))?.[1])
        .filter(Boolean)
        .sort();
      expect(fromAi, t.function.name).toEqual(Object.keys(t.function.parameters.properties).sort());
    }
  });

  it("fills every prompt placeholder from Config", () => {
    const prompt = readFileSync(path.join(dir, "agent/system-prompt.md"), "utf8");
    for (const [, key] of prompt.matchAll(/\{\{(\w+)\}\}/g)) expect(config, key).toHaveProperty(key);
  });

  it("searches and indexes through one embeddings node and one index key", () => {
    const stores = flow.nodes.filter((n: J) => n.type === "@n8n/n8n-nodes-langchain.vectorStoreInMemory");
    expect(stores.map((n: J) => n.parameters.mode).sort()).toEqual(["insert", "load"]);
    expect(new Set(stores.map((n: J) => n.parameters.memoryKey.value)).size).toBe(1);
    const targets = flow.connections.Embeddings.ai_embedding[0].map((c: J) => c.node).sort();
    expect(targets).toEqual(["Insert Index", "Search Index"]);
  });
});
