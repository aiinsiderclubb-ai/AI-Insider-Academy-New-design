import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { codeNodes, credentialsArePlaceholders, runCode, workflow, type J } from "./helpers/n8n-kit";

const SLUG = "lead-qualification-agent";
const flow = workflow(SLUG, SLUG);
const code = codeNodes(flow);
const dir = path.join(process.cwd(), "content/products", SLUG);
const config: J = runCode(code.Config, {}, {})[0].config;
const cfg: J = { ...config, agent_token: "tok", debug_token: "dbg" };

const intake = (body: J, headers: J = { "x-agent-token": "tok" }, nodes: J = {}) =>
  runCode(code.Intake, nodes, { config: cfg, input: { body, headers, query: {} } })[0];

describe("intake", () => {
  it("refuses without the token, including the shipped placeholder", () => {
    expect(intake({ email: "a@b.co" }, {}).route).toBe("deny");
    expect(runCode(code.Intake, {}, { config, input: { body: { token: config.agent_token, email: "a@b.co" }, headers: {} } })[0].route).toBe("deny");
  });

  it("reads fields from any form and normalises them", () => {
    const r = intake({ Name: "Анна", "E-mail": "Anna@Acme.Example", Телефон: "050 111-22-33", Сайт: "www.acme.example/ru", Comments: "Нужна CRM" });
    expect(r.route).toBe("ok");
    expect(r.lead.email).toBe("anna@acme.example");
    expect(r.lead.phone).toBe("+380501112233");
    expect(r.lead.domain).toBe("acme.example");
    expect(r.lead.website).toBe("https://www.acme.example/ru");
    expect(r.lead.message).toBe("Нужна CRM");
    expect(r.lead.corporate_email).toBe(true);
  });

  it("takes the company domain from a corporate email but not from gmail", () => {
    expect(intake({ email: "x@beta.example" }).lead.domain).toBe("beta.example");
    expect(intake({ email: "x@gmail.com" }).lead.domain).toBe("");
  });

  it("drops bots and double clicks, and asks for a contact", () => {
    expect(intake({ email: "a@b.co", honeypot: "x" }).route).toBe("spam");
    expect(intake({ name: "x", message: "y" }).route).toBe("bad");
    expect(intake({ test: "test" }).route).toBe("spam");
    const nodes: J = {};
    expect(intake({ email: "a@b.co", message: "same" }, undefined, nodes).route).toBe("ok");
    expect(intake({ email: "a@b.co", message: "same" }, undefined, nodes).route).toBe("repeat");
  });
});

describe("dedupe", () => {
  const HEAD = ["lead_id", "received", "name", "email", "phone", "company", "domain", "website", "source", "message", "budget",
    "score", "tier", "segment", "owner", "status", "reasons", "summary", "questions", "flags", "repeat_count", "last_seen"];
  const row = (o: J) => HEAD.map((h) => String(o[h] ?? ""));
  const recent = new Date().toISOString();
  const run = (lead: J, rows: string[][]) =>
    runCode(code.Dedupe, { Config: { config: cfg }, Intake: { lead: { lead_id: "L-1", source: "web", message: "", ...lead }, debug: false } }, { values: [HEAD, ...rows] })[0];

  it("matches by email, phone or company domain within the window", () => {
    const rows = [row({ lead_id: "L-0", email: "a@acme.example", phone: "+380501112233", domain: "acme.example", received: recent, owner: "anna", score: "80", tier: "hot" })];
    expect(run({ email: "a@acme.example" }, rows).duplicate.lead_id).toBe("L-0");
    expect(run({ phone: "+380501112233" }, rows).duplicate.lead_id).toBe("L-0");
    expect(run({ email: "b@acme.example", domain: "acme.example" }, rows).duplicate.lead_id).toBe("L-0");
    expect(run({ email: "c@other.example", domain: "other.example" }, rows).duplicate).toBeNull();
  });

  it("ignores old leads and shared free-mail domains", () => {
    const old = [row({ email: "a@acme.example", received: "2020-01-01T00:00:00Z" })];
    expect(run({ email: "a@acme.example" }, old).duplicate).toBeNull();
    const gm = [row({ email: "x@gmail.com", domain: "gmail.com", received: recent })];
    expect(run({ email: "y@gmail.com", domain: "gmail.com" }, gm).duplicate).toBeNull();
  });

  it("keeps working when the CRM cannot be read", () => {
    const r = runCode(code.Dedupe, { Config: { config: cfg }, Intake: { lead: { lead_id: "L", source: "web", message: "" } } }, { error: { message: "403" } })[0];
    expect(r.crm_error).toContain("403");
    expect(r.agent_input).toContain("Заявка L");
  });
});

describe("page fetch guard", () => {
  const plan = (url: string, domain = "acme.example", extra: J = {}) =>
    runCode(code["Fetch Plan"], { Config: { config: { ...cfg, ...extra }, input: { url, lead_domain: domain } } }, {})[0];

  it("opens only the lead's own site", () => {
    expect(plan("https://acme.example/about").ok).toBe(true);
    expect(plan("https://www.acme.example/").ok).toBe(true);
    expect(plan("https://blog.acme.example/").ok).toBe(true);
    expect(plan("https://evil.example/").ok).toBe(false);
    expect(plan("https://acme.example.evil.com/").ok).toBe(false);
    expect(plan("https://anything.example/", "").ok).toBe(false);
  });

  it("refuses internal addresses and other schemes", () => {
    expect(plan("http://169.254.169.254/latest", "169.254.169.254").ok).toBe(false);
    expect(plan("http://localhost:5678/", "localhost").ok).toBe(false);
    expect(plan("http://[::1]/", "::1").ok).toBe(false);
    expect(plan("file:///etc/passwd", "acme.example").ok).toBe(false);
  });

  it("turns HTML into short text without scripts", () => {
    const html = '<html><head><title>Acme</title><meta name="description" content="Логистика"></head><body><script>evil()</script><p>Склады &amp; доставка</p><a href="/about">О нас</a><a href="mailto:x@y">m</a></body></html>';
    const r = runCode(code["Page Text"], { Config: { config: cfg }, "Fetch Plan": { url: "https://acme.example/" } }, { data: html })[0];
    expect(r.title).toBe("Acme");
    expect(r.description).toBe("Логистика");
    expect(r.text).toContain("Склады & доставка");
    expect(r.text).not.toContain("evil");
    expect(r.links).toEqual(["/about"]);
  });
});

const step = (input: J, ok = true) => ({ action: { tool: "submit_assessment", toolInput: input }, observation: JSON.stringify([{ ok }]) });

describe("assessment and score", () => {
  const good = { fit: "high", intent: "high", company_size: "51-200", urgency: "now", summary: "Компания на 120 человек ищет CRM.", questions: "Какая CRM сейчас?; Сколько менеджеров?", red_flags: "" };
  const check = (input: J) => runCode(code["Check Assessment"], { Config: { config: cfg, input } }, {})[0];

  it("accepts only listed values", () => {
    expect(check(good).ok).toBe(true);
    expect(check({ ...good, fit: "great" }).errors.join()).toContain("fit");
    expect(check({ ...good, red_flags: "rich" }).ok).toBe(false);
    expect(check({ ...good, summary: "ok" }).ok).toBe(false);
  });

  const lead = { lead_id: "L-1", email: "anna@acme.example", corporate_email: true, phone: "+380501112233", budget: "5000 €", message: "x", source: "web" };
  const score = (steps: J[], l: J = lead) =>
    runCode(code.Score, { Config: { config: cfg }, Dedupe: { lead: l, debug: false, duplicate: null, crm_error: "" } }, { output: "готово", intermediateSteps: steps })[0];

  it("adds up the rubric with a reason per criterion", () => {
    const s = score([step({ ...good, fit: "great" }, false), step(good)]);
    expect(s.score).toBe(100);
    expect(s.tier).toBe("hot");
    expect(s.reasons).toHaveLength(cfg.rubric.length);
    expect(s.assessment.questions).toEqual(["Какая CRM сейчас?", "Сколько менеджеров?"]);
  });

  it("scores facts only when the model gave no accepted assessment", () => {
    const s = score([step({ ...good, fit: "great" }, false)]);
    expect(s.assessment).toBeNull();
    expect(s.review.join()).toContain("вручную");
    expect(s.score).toBe(25); // budget 15 + corporate email 5 + phone 5
  });

  it("disqualifies on red flags and picks the segment", () => {
    expect(score([step({ ...good, red_flags: "job_seeker" })]).tier).toBe("disqualified");
    expect(score([step({ ...good, company_size: "1000+" })]).segment).toBe("enterprise");
    expect(score([step(good)], { ...lead, budget: "50 тыс" }).segment).toBe("enterprise");
    expect(score([step(good)]).segment).toBe("smb");
  });
});

const scored = (o: J = {}) => ({
  lead: { lead_id: "L-1", received: "2026-11-19T10:00:00Z", name: "Анна", email: "a@acme.example", phone: "", company: "Acme", domain: "acme.example", website: "", source: "web", message: "Нужна CRM", budget: "" },
  debug: true, duplicate: null, score: 55, tier: "warm", segment: "smb", reasons: ["+30 fit"], flags: [], disqualified: [], review: [],
  assessment: { summary: "s", questions: ["Сколько менеджеров?"] }, pages: [], ...o,
});

describe("routing", () => {
  const owners = [
    { id: "anna", name: "Анна", chat_id: "1", segments: ["smb"], active: true },
    { id: "oleg", name: "Олег", chat_id: "2", segments: ["smb", "enterprise"], active: true },
    { id: "ira", name: "Ира", chat_id: "3", segments: ["smb"], active: false },
  ];
  const conf = { ...cfg, owners, team_chat_id: "9" };
  const route = (s: J, nodes: J = {}, c: J = conf) => runCode(code.Route, Object.assign(nodes, { Config: { config: c } }), s)[0];

  it("goes round the active owners of the segment", () => {
    const nodes: J = {};
    const got = [route(scored(), nodes), route(scored(), nodes), route(scored(), nodes)].map((r) => r.response.owner);
    expect(got).toEqual(["anna", "oleg", "anna"]);
    expect(route(scored({ segment: "enterprise" }), {}).response.owner).toBe("oleg");
  });

  it("keeps a repeat lead with its owner and updates its row", () => {
    const dup = { _row: 7, lead_id: "L-0", received: "2026-10-01T00:00:00Z", owner: "oleg", repeat_count: "1", message: "старое", score: "40", tier: "warm" };
    const r = route(scored({ duplicate: dup }));
    expect(r.response.owner).toBe("oleg");
    expect(r.http.method).toBe("PUT");
    expect(decodeURIComponent(r.http.path)).toMatch(/^Leads!A7\?/);
    const values = r.http.body.values[0];
    expect(values[0]).toBe("L-0");
    expect(values[20]).toBe("2");
    expect(values[9]).toContain("старое");
  });

  it("sends hot leads to the team too and disqualified to nobody", () => {
    expect(route(scored({ tier: "hot" })).notify.map((n: J) => n.chat_id).sort()).toEqual(["1", "9"]);
    const dq = route(scored({ tier: "disqualified", disqualified: ["spam"] }));
    expect(dq.response.owner).toBe("");
    expect(dq.notify).toEqual([]);
  });

  it("writes the clarifying email only when switched on, for listed tiers, new leads with questions", () => {
    expect(route(scored()).email).toBeNull();
    const on = { ...conf, clarify_by_email: true };
    expect(route(scored(), {}, on).email.text).toContain("1. Сколько менеджеров?");
    expect(route(scored({ tier: "hot" }), {}, on).email).toBeNull();
    expect(route(scored({ duplicate: { _row: 2, received: "2026-01-01", owner: "anna" } }), {}, on).email).toBeNull();
  });

  it("hides the report from the form unless debug", () => {
    expect(Object.keys(route(scored({ debug: false })).response)).toEqual(["ok", "lead_id"]);
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
  });

  it("fills every prompt placeholder from Config", () => {
    const prompt = readFileSync(path.join(dir, "agent/system-prompt.md"), "utf8");
    for (const [, key] of prompt.matchAll(/\{\{(\w+)\}\}/g)) expect(config, key).toHaveProperty(key);
  });
});
