import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { codeNodes, credentialsArePlaceholders, workflow, type J } from "./helpers/n8n-kit";

const SLUG = "revenue-recovery-agent";
const flow = workflow(SLUG, "revenue-recovery");
const code = codeNodes(flow);
const dir = path.join(process.cwd(), "content/products", SLUG);

const items = (v: J | J[]) => (Array.isArray(v) ? v : [v]).map((json) => ({ json }));

/** Like helpers/runCode, plus `.all()` and several input items — the jobs here work on lists. */
function run(name: string, nodes: J, input: J | J[]): J[] {
  const $ = (n: string) => ({
    isExecuted: n in nodes,
    first: () => {
      if (!(n in nodes)) throw new Error(`node ${n} has not run`);
      return { json: Array.isArray(nodes[n]) ? nodes[n][0] : nodes[n] };
    },
    all: () => items(nodes[n]),
  });
  const $input = { first: () => items(input)[0], all: () => items(input) };
  return (new Function("$", "$input", "$getWorkflowStaticData", code[name])($, $input, () => ({})) as { json: J }[]).map((i) => i.json);
}

const config: J = run("Config", {}, {})[0].config;
const cfg: J = { ...config, approver_chat_ids: ["-100900"], timezone_offset_hours: 0 };
const today = new Date().toISOString().slice(0, 10);
const d = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const HEAD = ["invoice_id", "client", "contact_name", "email", "amount", "currency", "issued", "due", "status", "paid_at", "promise_date", "disputed", "paused", "last_contact", "stage", "notes"];
const DHEAD = ["draft_id", "created", "invoice_id", "step", "tone", "risk", "reasons", "to", "subject", "body", "status", "decided_at", "decided_by"];
const inv = (o: J) => HEAD.map((k) => String(({ client: "ООО Пример", email: "a@example.com", amount: "1200", currency: "EUR", status: "open", stage: "0", ...o } as J)[k] ?? ""));
const sheet = (rows: string[][]) => ({ values: rows });

function plan(rows: string[][], drafts: string[][] = []) {
  return run("Plan Invoices", { Config: { config: cfg } }, { valueRanges: [sheet([HEAD, ...rows]), sheet([DHEAD, ...drafts])] });
}

describe("which invoices get a reminder", () => {
  it("follows the sequence and the gap between letters", () => {
    const out = plan([
      inv({ invoice_id: "A", due: d(2) }),
      inv({ invoice_id: "B", due: d(10), stage: "1", last_contact: d(5) }),
      inv({ invoice_id: "C", due: d(10), stage: "1", last_contact: d(1) }),
      inv({ invoice_id: "D", due: d(5), stage: "1", last_contact: d(4) }),
      inv({ invoice_id: "E", due: d(90), stage: "4", last_contact: d(10) }),
      inv({ invoice_id: "F", due: d(-3) }),
    ]);
    expect(out.map((p) => [p.invoice_id, p.step, p.tone])).toEqual([["B", 2, "firm"], ["A", 1, "friendly"]]);
  });

  it("never chases paid, disputed, paused or promised invoices, or those with a draft waiting", () => {
    const out = plan([
      inv({ invoice_id: "P", due: d(10), status: "paid" }),
      inv({ invoice_id: "Q", due: d(10), paid_at: d(1) }),
      inv({ invoice_id: "R", due: d(10), disputed: "да" }),
      inv({ invoice_id: "S", due: d(10), paused: "yes" }),
      inv({ invoice_id: "T", due: d(10), promise_date: d(-2) }),
      inv({ invoice_id: "U", due: d(10) }),
      inv({ invoice_id: "V", due: d(10), email: "" }),
    ], [["D-1", "", "U", "1", "friendly", "low", "", "", "", "", "pending", "", ""]]);
    expect(out).toEqual([]);
  });

  it("scores risk by rules and explains it", () => {
    const [p] = plan([
      inv({ invoice_id: "Z", client: "Зета", due: d(40), amount: "8 000", stage: "2", last_contact: d(10), promise_date: d(3) }),
      inv({ invoice_id: "H1", client: "Зета", due: d(200), paid_at: d(150), status: "paid" }),
      inv({ invoice_id: "H2", client: "Зета", due: d(120), paid_at: d(100), status: "paid" }),
    ]);
    expect(p.rule_risk).toBe("high");
    expect(p.rule_reasons.join(" ")).toMatch(/просрочка 40 дн.*крупная сумма.*2 раза.*обещание/);
    expect(p.amount_text).toBe("8 000 EUR");
    expect(p.facts).toContain("Упоминать пени, суд, коллекторов и любые санкции нельзя");
  });
});

describe("checking the model's draft", () => {
  const p = { mode: "monitor", invoice_id: "INV-7", contact_name: "Ольга", amount: 1250.75, amount_text: "1 250,75 EUR", due: "2026-11-01", overdue: 10, step: 2, tone: "firm", rule_risk: "medium", rule_reasons: ["просрочка 10 дн."] };
  const draft = (answer: J | string, c: J = cfg) =>
    run("Check Draft", { Config: { config: c }, "Plan Invoices": [p] }, [{ text: typeof answer === "string" ? answer : JSON.stringify(answer) }])[0];
  const good = { risk: "medium", reasons: ["вторая просьба"], subject: "Счёт INV-7", body: "Ольга, добрый день! Счёт INV-7 на 1 250,75 EUR всё ещё не оплачен. Подскажите дату оплаты?" };

  it("keeps a good draft and adds payment details and signature", () => {
    const out = draft(good);
    expect(out.flags).toEqual([]);
    expect(out.body).toContain("Подскажите дату оплаты?");
    expect(out.body).toContain(cfg.payment_details);
    expect(out.body).toContain(cfg.sender_name);
    expect(out.draft_id).toMatch(/^D-[A-Z0-9]+$/);
  });

  it("replaces threats, shaming, discounts, links and wrong amounts with the template", () => {
    const cases: [string, string][] = [
      [" Иначе обратимся в суд.", "threat"], [" Начислим пени.", "threat"], [" Вы игнорируете наши письма.", "shaming"],
      [" Можем дать скидку.", "discount"], [" Оплата: https://pay.example", "link"],
    ];
    for (const [tail, why] of cases) {
      const out = draft({ ...good, body: good.body + tail });
      expect(out.flags, tail).toContain(`template:${why}`);
      expect(out.body).not.toContain(tail.trim());
      expect(out.body).toContain("INV-7");
      expect(out.body).toContain("1 250,75 EUR");
    }
    expect(draft({ ...good, body: "Ольга, счёт INV-7 не оплачен, просим оплатить поскорее, спасибо." }).flags).toContain("template:no_amount");
    expect(draft("Конечно! Вот письмо.").flags).toContain("template:not_json");
  });

  it("allows the exact late-fee wording from Config and nothing else", () => {
    const c = { ...cfg, allow_late_fee: true, late_fee_text: "пеня 0,1% в день по п. 5.2 договора" };
    expect(draft({ ...good, body: good.body + " Напоминаем: пеня 0,1% в день по п. 5.2 договора." }, c).flags).toEqual([]);
    expect(draft({ ...good, body: good.body + " Иначе пени и суд." }, c).flags).toContain("template:threat");
  });

  it("lets the model raise the risk but never lower it", () => {
    expect(draft({ ...good, risk: "low" }).risk).toBe("medium");
    const up = draft({ ...good, risk: "high", reasons: ["не отвечает две недели"] });
    expect(up.risk).toBe("high");
    expect(up.flags).toContain("risk_raised_by_model");
  });
});

describe("decisions in Telegram", () => {
  const invoices = () => [HEAD, inv({ invoice_id: "INV-1", due: d(5) }), inv({ invoice_id: "INV-2", due: d(5), status: "paid", paid_at: today })];
  const drafts = () => [DHEAD,
    ["D-A1", "", "INV-1", "1", "friendly", "low", "", "a@example.com", "Счёт INV-1", "текст", "pending", "", ""],
    ["D-B2", "", "INV-2", "1", "friendly", "low", "", "a@example.com", "Счёт INV-2", "текст", "pending", "", ""],
    ["D-C3", "", "INV-1", "1", "friendly", "low", "", "a@example.com", "Счёт INV-1", "текст", "sent", "", ""]];
  const act = (update: J) => run("Telegram Act", { Config: { config: cfg, input: update } }, { valueRanges: [sheet(invoices()), sheet(drafts())] })[0];
  const press = (data: string, chat = -100900, uid = 1) => act({ update_id: 1, callback_query: { id: "cb", data, from: { id: uid, first_name: "Анна" }, message: { chat: { id: chat } } } });
  const say = (text: string, reply?: string) => act({ update_id: 2, message: { chat: { id: -100900 }, from: { id: 1 }, text, ...(reply ? { reply_to_message: { text: reply } } : {}) } });

  it("ignores everyone but the approvers", () => {
    expect(press("send:D-A1", -1, 5)).toMatchObject({ action: "reply", reply_text: "Нет доступа", updates: [] });
    expect(act({ update_id: 3, message: { chat: { id: 77 }, from: { id: 77 }, text: "/paid INV-1" } }).action).toBe("ignore");
  });

  it("sends only an unpaid, unstopped invoice, and only once", () => {
    const ok = press("send:D-A1");
    expect(ok.action).toBe("send");
    expect(ok.email).toEqual({ to: "a@example.com", subject: "Счёт INV-1", text: "текст" });
    expect(ok.updates.map((u: J) => u.range)).toEqual(["Drafts!A2:M2", "Invoices!A2:P2"]);
    expect(ok.updates[1].values[0][14]).toBe("1");
    const paid = press("send:D-B2");
    expect(paid.action).toBe("reply");
    expect(paid.updates[0].values[0][10]).toBe("cancelled");
    expect(paid.notice).toContain("оплачен");
    expect(press("send:D-C3").reply_text).toContain("Уже обработан");
  });

  it("skips, asks for a new text and takes it as a reply", () => {
    expect(press("skip:D-A1").updates[0].values[0][10]).toBe("skipped");
    const ask = press("edit:D-A1");
    expect(ask.action).toBe("ask_edit");
    expect(ask.notice).toContain("Черновик D-A1");
    const edited = say("Новый текст письма про INV-1", "✏️ Черновик D-A1. Ответьте…");
    expect(edited.action).toBe("card");
    expect(edited.updates[0].values[0][9]).toMatch(/^Новый текст письма про INV-1\n/);
    expect(edited.updates[0].values[0][9]).toContain(cfg.payment_details);
  });

  it("understands the commands", () => {
    const paid = say("/paid INV-1");
    expect(paid.updates[0].values[0].slice(8, 10)).toEqual(["paid", today]);
    expect(paid.updates.some((u: J) => u.range === "Drafts!A2:M2" && u.values[0][10] === "cancelled")).toBe(true);
    expect(say("/promise INV-1 2099-01-15").updates[0].values[0][10]).toBe("2099-01-15");
    expect(say(`/promise INV-1 ${d(3)}`).updates).toEqual([]);
    expect(say("/dispute INV-1 не согласны").updates[0].values[0][11]).toBe("yes");
    expect(say("/resume INV-1").updates[0].values[0][12]).toBe("");
    expect(say("/status INV-1").notice).toContain("Напоминания идут");
    expect(say("/status NOPE").notice).toContain("не найден");
    expect(say("привет").notice).toContain("Команды");
  });

  it("marks a draft failed when the email did not go out", () => {
    const a = press("send:D-A1");
    const out = run("After Send", { "Telegram Act": a }, { error: { message: "535 auth failed" } })[0];
    expect(out.updates.map((u: J) => u.range)).toEqual(["Drafts!A2:M2"]);
    expect(out.updates[0].values[0][10]).toBe("failed");
    expect(out.notice).toContain("535");
  });
});

describe("weekly report", () => {
  it("counts overdue money, what came back after reminders, and what waits", () => {
    const rows = [HEAD,
      inv({ invoice_id: "O1", due: d(10), amount: "1000" }),
      inv({ invoice_id: "O2", due: d(45), amount: "2000", promise_date: d(2) }),
      inv({ invoice_id: "R1", due: d(20), amount: "500", status: "paid", paid_at: d(2) }),
      inv({ invoice_id: "R2", due: d(20), amount: "700", status: "paid", paid_at: d(2) })];
    const drafts = [DHEAD, ["D-1", "", "R1", "1", "", "", "", "", "", "", "sent", "", ""], ["D-2", "", "O1", "1", "", "", "", "", "", "", "pending", "", ""]];
    const activity = [["time", "invoice_id", "action", "detail", "by"], [new Date().toISOString(), "R1", "sent", "", ""]];
    const out = run("Weekly Report", { Config: { config: cfg } }, { valueRanges: [sheet(rows), sheet(drafts), sheet(activity)] })[0];
    expect(out.totals).toEqual({ overdue: 3000, overdue_count: 2, recovered: 500, recovered_count: 1, sent: 1, pending: 1 });
    expect(out.text).toContain("Обещание не выполнено: O2");
  });
});

describe("package", () => {
  it("ships placeholder credentials only", () => {
    expect(credentialsArePlaceholders(flow)).toBe(true);
    expect(credentialsArePlaceholders(workflow(SLUG, "error-alert"))).toBe(true);
  });

  it("fills every prompt placeholder from Config and keeps the prompt free of braces", () => {
    const prompt = readFileSync(path.join(dir, "agent/draft-prompt.md"), "utf8");
    for (const [, key] of prompt.matchAll(/\{\{(\w+)\}\}/g)) expect(config, key).toHaveProperty(key);
    expect(prompt.replace(/\{\{\w+\}\}/g, "")).not.toMatch(/[{}]/);
  });

  it("refuses the preview without its token", () => {
    expect(run("Preview Plan", {}, { config: cfg, input: { body: { invoice: {} }, headers: {} } })[0].route).toBe("deny");
  });
});
