import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { codeNodes, credentialsArePlaceholders, runCode, workflow, type J } from "./helpers/n8n-kit";

const SLUG = "sales-agent-template";
const flow = workflow(SLUG, SLUG);
const code = codeNodes(flow);
const dir = path.join(process.cwd(), "content/products", SLUG);
const config: J = runCode(code.Config, {}, {})[0].config;
const cfg: J = { ...config, agent_token: "secret-token" };

const HEAD = ["session_id", "channel", "chat_id", "name", "email", "phone", "need", "budget", "timeline", "authority",
  "product_id", "score", "tier", "stage", "touches", "last_touch_at", "notes", "updated", "created"];
const sheet = (rows: string[][]) => ({ values: rows });
const leadRow = (over: J) => HEAD.map((h) => String(over[h] ?? ""));

function upsert(input: J, rows: string[][] = [HEAD]) {
  return runCode(code["Upsert Lead"], { Config: { config: cfg, input: { session_id: "web:s1", channel: "web", ...input } } }, sheet(rows))[0];
}

describe("qualification score", () => {
  it("is computed by code from need, budget, timeline and authority", () => {
    expect(upsert({ need: "CRM" }).result.score).toBe(25);
    const full = upsert({ need: "CRM", budget: "около 2 тыс €", timeline: "в этом месяце", authority: "решаю я", email: "a@b.co" }).result;
    expect(full.score).toBe(100);
    expect(full.tier).toBe("hot");
    expect(full.missing).toEqual([]);
  });

  it("reads budgets the way people write them", () => {
    const pts = (budget: string) => upsert({ budget }).result.parts.budget;
    expect(pts("2k")).toBe(25);
    expect(pts("1 500 €")).toBe(25);
    expect(pts("300")).toBe(10);
    expect(pts("пока не знаю")).toBe(10);
    expect(pts("")).toBe(0);
  });

  it("weighs timelines and decision makers", () => {
    expect(upsert({ timeline: "срочно" }).result.parts.timeline).toBe(25);
    expect(upsert({ timeline: "через 2 месяца" }).result.parts.timeline).toBe(15);
    expect(upsert({ timeline: "когда-нибудь" }).result.parts.timeline).toBe(5);
    expect(upsert({ authority: "я владелец" }).result.parts.authority).toBe(25);
    expect(upsert({ authority: "вместе с партнёром" }).result.parts.authority).toBe(10);
  });

  it("flags a large deal for the manager", () => {
    const r = upsert({ budget: "50 тыс €" }).result;
    expect(r.large_deal).toBe(true);
    expect(r.note).toContain("handoff_to_human");
  });

  it("asks for a contact on the site, not in Telegram", () => {
    expect(upsert({}).result.missing.join()).toContain("контакт");
    expect(upsert({ channel: "telegram", chat_id: "5" }).result.missing.join()).not.toContain("контакт");
  });
});

describe("lead row", () => {
  it("appends a new lead and updates the same row later", () => {
    const first = upsert({ need: "CRM" });
    expect(first.http.method).toBe("POST");
    const existing = [HEAD, leadRow({ session_id: "web:x" }), leadRow({ session_id: "web:s1", need: "CRM", stage: "qualifying", touches: "1", created: "2026-01-01" })];
    const next = upsert({ budget: "5000", stage: "offer_sent" }, existing);
    expect(next.http.method).toBe("PUT");
    expect(decodeURIComponent(next.http.path)).toMatch(/^Leads!A3\?/);
    const row = next.http.body.values[0];
    expect(row[HEAD.indexOf("need")]).toBe("CRM");
    expect(row[HEAD.indexOf("stage")]).toBe("offer_sent");
    expect(row[HEAD.indexOf("touches")]).toBe("1");
  });

  it("ignores an unknown stage", () => {
    expect(upsert({ stage: "bought-everything" }).result.stage).toBe("new");
  });

  it("alerts once, when a lead first becomes hot", () => {
    const hot = { need: "CRM", budget: "2000", timeline: "сейчас", authority: "я" };
    expect(upsert(hot).team_message).toContain("Горячий лид");
    const again = upsert(hot, [HEAD, leadRow({ session_id: "web:s1", tier: "hot" })]);
    expect(again.team_message).toBe("");
  });
});

describe("catalog and offers", () => {
  const products = sheet([
    ["id", "name", "description", "price", "currency", "url", "payment_link", "tags", "in_stock"],
    ["crm-start", "CRM Старт", "CRM для отдела продаж", "49", "EUR", "", "https://pay.example.com/a", "crm продажи", "да"],
    ["crm-pro", "CRM Про", "CRM для большой команды", "149", "EUR", "", "", "crm команда", "нет"],
  ]);
  const run = (input: J) => runCode(code.Products, { Config: { config: cfg, input: { session_id: "web:s1", ...input } } }, products)[0];

  it("finds products and reports stock", () => {
    const r = run({ tool: "search_catalog", query: "crm для отдела продаж" }).result;
    expect(r.products[0].product_id).toBe("crm-start");
    expect(r.products.find((p: J) => p.product_id === "crm-pro")?.in_stock ?? false).toBe(false);
    expect(run({ tool: "search_catalog", query: "экскаватор" }).result.found).toBe(false);
  });

  it("gives only the catalog's payment link", () => {
    const ok = run({ tool: "send_offer", product_id: "CRM-START", kind: "payment" });
    expect(ok.result.payment_link).toBe("https://pay.example.com/a");
    expect(ok.team_message).toContain("Ссылка на оплату");
    expect(run({ tool: "send_offer", product_id: "crm-pro", kind: "payment" }).result.error).toBe("no_payment_link");
    expect(run({ tool: "send_offer", product_id: "nope", kind: "payment" }).result.error).toBe("unknown_product");
    expect(run({ tool: "send_offer", product_id: "crm-pro", kind: "quote", email: "" }).result.error).toBe("no_email");
  });

  it("answers objections only from approved facts", () => {
    const facts = sheet([["id", "topic", "approved_answer", "tags"], ["F-1", "Гарантия", "14 дней теста", "гарантия"]]);
    const hit = runCode(code["Rank Facts"], { Config: { config: cfg, input: { topic: "какие гарантии" } } }, facts)[0].result;
    expect(hit.facts[0].id).toBe("F-1");
    const miss = runCode(code["Rank Facts"], { Config: { config: cfg, input: { topic: "сертификат ISO" } } }, facts)[0].result;
    expect(miss.found).toBe(false);
    expect(miss.note).toContain("Не придумывай");
  });

  it("refuses the placeholder call link", () => {
    expect(runCode(code["Call Link"], { Config: { config, input: {} } }, {})[0].result.error).toBe("no_booking_link");
  });
});

describe("follow-up", () => {
  // Wednesday 2026-11-18 12:00 in Kyiv
  const NOW = "2026-11-18T10:00:00Z";
  const ago = (h: number) => new Date(Date.parse(NOW) - h * 3600000).toISOString();
  const pick = (leads: string[][], extra: J = {}, optout: string[][] = [], log: string[][] = []) =>
    runCode(code["Pick Follow-ups"], { Config: { config: { ...cfg, now_override: NOW, ...extra } } }, {
      valueRanges: [
        { values: [HEAD, ...leads] },
        { values: [["time", "session_id", "channel", "chat_id", "contact"], ...optout] },
        { values: [["time", "session_id", "channel"], ...log] },
        { values: [["id", "name"], ["crm-start", "CRM Старт"]] },
      ],
    });
  const tg = (over: J = {}) => leadRow({ session_id: "tg:1", channel: "telegram", chat_id: "1", name: "Олег", product_id: "crm-start", stage: "qualifying", touches: "0", created: ago(30), ...over });

  it("writes after the first pause, with the product name", () => {
    const out = pick([tg()]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain("Олег");
    expect(out[0].text).toContain("CRM Старт");
    expect(decodeURIComponent(out[0].update.path)).toMatch(/^Leads!O2\?/);
    expect(out[0].update.body.values[0][0]).toBe("1");
  });

  it("follows the pause for each touch and stops at the last", () => {
    expect(pick([tg({ touches: "1", last_touch_at: ago(30) })])).toHaveLength(0);
    expect(pick([tg({ touches: "1", last_touch_at: ago(73), created: ago(100) })])).toHaveLength(1);
    expect(pick([tg({ touches: "3", last_touch_at: ago(500) })])).toHaveLength(0);
  });

  it("counts the pause from the customer's last message", () => {
    expect(pick([tg()], {}, [], [[ago(2), "tg:1", "telegram"]])).toHaveLength(0);
  });

  it("never writes to the stop list, closed deals, quiet hours or weekends", () => {
    expect(pick([tg()], {}, [[ago(1), "", "telegram", "1", ""]])).toHaveLength(0);
    expect(pick([tg({ stage: "won" })])).toHaveLength(0);
    expect(pick([tg()], { now_override: "2026-11-18T20:00:00Z" })).toHaveLength(0); // 22:00 Kyiv
    expect(pick([tg()], { now_override: "2026-11-21T10:00:00Z" })).toHaveLength(0); // Saturday
  });

  it("uses email only when switched on, and caps a run", () => {
    const web = leadRow({ session_id: "web:1", channel: "web", email: "a@b.co", stage: "offer_sent", touches: "0", created: ago(30) });
    expect(pick([web])).toHaveLength(0);
    expect(pick([web], { email_followups: true })[0].via).toBe("email");
    const many = Array.from({ length: 5 }, (_, i) => tg({ session_id: `tg:${i}`, chat_id: String(i) }));
    expect(pick(many, { followup_max_per_run: 2 })).toHaveLength(2);
  });
});

describe("opt-out", () => {
  it("stops follow-ups without asking the model", () => {
    const g = runCode(code["Guard In"], {}, { config: cfg, input: { body: { session_id: "opt-01", message: "Стоп" }, headers: { "x-agent-token": "secret-token" } } })[0];
    expect(g.kind).toBe("optout");
    const g2 = runCode(code["Guard In"], {}, { config: cfg, input: { body: { session_id: "opt-02", message: "Пожалуйста, не пишите мне больше" }, headers: { "x-agent-token": "secret-token" } } })[0];
    expect(g2.kind).toBe("optout");
    const g3 = runCode(code["Guard In"], {}, { config: cfg, input: { body: { session_id: "opt-03", message: "Какой стоп-лист в вашей CRM?" }, headers: { "x-agent-token": "secret-token" } } })[0];
    expect(g3.route).toBe("agent");
  });

  it("blocks fake scarcity and discounts in the reply", () => {
    const g = { channel: "web", session_id: "web:s", customer: {}, text: "q", flags: [], debug: false };
    for (const reply of ["Осталось всего 3 места!", "Дадим скидку 15%", "Только сегодня цена ниже"]) {
      const out = runCode(code["Guard Out"], { Config: { config: cfg }, "Guard In": g }, { output: reply, intermediateSteps: [] })[0];
      expect(out.flags, reply).toContain("forbidden_promise");
    }
    const fine = runCode(code["Guard Out"], { Config: { config: cfg }, "Guard In": g }, { output: "При оплате за год — минус 10% по прайсу.", intermediateSteps: [] })[0];
    expect(fine.flags).not.toContain("forbidden_promise");
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
});
