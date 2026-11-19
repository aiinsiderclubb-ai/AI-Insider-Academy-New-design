import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { codeNodes, credentialsArePlaceholders, runCode, workflow, type J } from "./helpers/n8n-kit";

const SLUG = "real-estate-lead-to-viewing";
const flow = workflow(SLUG, SLUG);
const code = codeNodes(flow);
const dir = path.join(process.cwd(), "content/products", SLUG);
const config: J = runCode(code.Config, {}, {})[0].config;
const cfg: J = { ...config, agent_token: "tok", debug_token: "dbg", team_chat_id: "-100" };

const csvRows = (name: string) =>
  readFileSync(path.join(dir, "templates", name), "utf8").trim().split("\n").map((line) => {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  });
const LISTINGS = csvRows("listings.csv");
const LEAD_HEAD = csvRows("leads-header.csv")[0];
const lead = (fields: J) => LEAD_HEAD.map((c) => String(fields[c] ?? ""));
const obs = (listings: string[]) => JSON.stringify([{ found: true, listings: listings.map((listing_id) => ({ listing_id })) }]);
const batch = (...tabs: [string, string[][]][]) => ({ valueRanges: tabs.map(([name, values]) => ({ range: `${name}!A1:Z9`, values })) });

// Next Monday–Friday in Kyiv, as YYYY-MM-DD.
function weekday(offset = 1): string {
  const d = new Date(Date.now() + offset * 86400000);
  while ([0, 6].includes(new Date(d.toLocaleString("en-US", { timeZone: "Europe/Kyiv" })).getDay())) d.setTime(d.getTime() + 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(d);
}
const kyivIso = (date: string, time: string) => {
  const guess = new Date(`${date}T${time}:00Z`).getTime();
  const shown = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "Europe/Kyiv" })).getTime();
  const utcShown = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(guess - (shown - utcShown)).toISOString();
};

describe("sheets", () => {
  it("writes lead columns in the order of the template header", () => {
    const out = runCode(code["Lead Upsert"], { Config: { config: cfg, input: { session_id: "web:a", channel: "web", deal_type: "buy" } } }, { values: [LEAD_HEAD] })[0];
    expect(out.values).toHaveLength(LEAD_HEAD.length);
    expect(out.range).toBe("Leads!A2:AA2");
  });
});

describe("Guard In", () => {
  it("carries the source and the listing a portal lead came with", () => {
    const out = runCode(code["Guard In"], {}, { config: cfg, input: { headers: { "x-agent-token": "tok" },
      body: { session_id: "portal-1", message: "Интересует", source: "portal", listing_ref: "KV-104", phone: "+380931234567" } } })[0];
    expect(out.route).toBe("agent");
    expect(out.source).toBe("portal");
    expect(out.agent_input).toContain("Объект из заявки: KV-104");
    expect(out.agent_input).toContain("портал объявлений");
  });

  it("refuses the placeholder token", () => {
    const out = runCode(code["Guard In"], {}, { config, input: { headers: { "x-agent-token": config.agent_token }, body: { session_id: "abcdef", message: "x" } } })[0];
    expect(out.route).toBe("deny");
  });
});

describe("Lead Upsert", () => {
  const upsert = (input: J, rows: string[][] = [LEAD_HEAD]) =>
    runCode(code["Lead Upsert"], { Config: { config: cfg, input: { session_id: "web:s1", channel: "web", ...input } } }, { values: rows })[0];

  it("scores by visible rules and routes by area and deal", () => {
    const out = upsert({ deal_type: "buy", property_type: "apartment", area: "Печерский", rooms: "2", budget_max: "150000", timeline: "now", mortgage: "cash", phone: "0501112233" });
    const row = Object.fromEntries(LEAD_HEAD.map((c, i) => [c, out.values[i]]));
    expect(row.score).toBe("100");
    expect(row.segment).toBe("hot");
    expect(row.agent_id).toBe("maria");
    expect(row.stage).toBe("qualified");
    expect(row.phone).toBe("+380501112233");
    expect(out.alert_html).toContain("Горячий лид 100/100");
    expect(out.result.missing).toEqual([]);
  });

  it("asks for what is missing and keeps earlier answers", () => {
    const first = upsert({ deal_type: "rent", area: "Оболонь" });
    expect(first.result.missing).toEqual(expect.arrayContaining(["бюджет", "телефон"]));
    const rows = [LEAD_HEAD, first.values];
    const second = upsert({ budget_max: "800", deal_type: "", area: "" }, rows);
    const row = Object.fromEntries(LEAD_HEAD.map((c, i) => [c, second.values[i]]));
    expect(row.deal_type).toBe("rent");
    expect(row.area).toBe("Оболонь");
    expect(row.budget_max).toBe("800");
    expect(second.range).toBe("Leads!A2:AA2");
  });

  it("alerts about a hot lead once", () => {
    const hot = { deal_type: "buy", area: "Печерский", rooms: "2", budget_max: "1", timeline: "now", mortgage: "cash", phone: "0501112233" };
    const first = upsert(hot);
    expect(first.alert_html).not.toBe("");
    expect(upsert({ notes: "этаж не первый" }, [LEAD_HEAD, first.values]).alert_html).toBe("");
  });

  it("keeps the realtor once assigned", () => {
    const first = upsert({ deal_type: "rent", area: "Оболонский" });
    const agent = first.values[LEAD_HEAD.indexOf("agent_id")];
    expect(["pavel", "dina"]).toContain(agent);
    const again = upsert({ area: "Печерский" }, [LEAD_HEAD, first.values]);
    expect(again.values[LEAD_HEAD.indexOf("agent_id")]).toBe(agent);
  });
});

describe("Match Listings", () => {
  const match = (input: J, leads: string[][] = [LEAD_HEAD]) =>
    runCode(code["Match Listings"], { Config: { config: cfg, input: { session_id: "web:s1", ...input } } }, batch(["Listings", LISTINGS], ["Leads", leads]))[0];

  it("leaves out sold listings and anything far over budget, and says why the rest fit", () => {
    const out = match({ deal_type: "buy", property_type: "apartment", area: "Печерский", rooms: "2", budget_max: 150000 });
    const ids = out.result.listings.map((l: J) => l.listing_id);
    expect(ids[0]).toBe("KV-101");
    expect(ids).not.toContain("KV-107");
    expect(ids).not.toContain("KV-102");
    expect(out.result.listings[0].why.join(" ")).toMatch(/в бюджете.*комнат: 2.*район: Печерский/);
  });

  it("puts the listing a client came with first", () => {
    expect(match({ listing_ref: "kv-104" }).result.listings[0].listing_id).toBe("KV-104");
  });

  it("returns nothing rather than something unsuitable", () => {
    const out = match({ deal_type: "buy", property_type: "house", area: "Печерский", budget_max: 50000 });
    expect(out.result.found).toBe(false);
    expect(out.result.note).toContain("Не придумывай");
  });

  it("marks the lead as matched", () => {
    const out = match({ deal_type: "rent", area: "Оболонский", budget_max: 800 }, [LEAD_HEAD, lead({ session_id: "web:s1", stage: "qualified", lead_id: "RL-1" })]);
    const values = out.update.data[0].values[0];
    expect(values[LEAD_HEAD.indexOf("stage")]).toBe("matched");
    expect(values[LEAD_HEAD.indexOf("listing_ids")]).toContain("AR-202");
  });
});

describe("viewing slots", () => {
  const plan = (input: J) => runCode(code["Slot Plan"], { Config: { config: cfg, input } }, { values: LISTINGS })[0];

  it("finds the realtor of the listing and refuses bad dates", () => {
    const ok = plan({ listing_id: "KV-101", date: weekday() });
    expect(ok.ok).toBe(true);
    expect(ok.calendar_id).toBe("maria@example.com");
    expect(plan({ listing_id: "KV-107", date: "" }).result.error).toBe("listing_inactive");
    expect(plan({ listing_id: "KV-999", date: "" }).result.error).toBe("listing_not_found");
    expect(plan({ listing_id: "KV-101", date: "2020-01-01" }).result.error).toBe("date_in_past");
    expect(plan({ listing_id: "KV-101", date: "когда-нибудь" }).result.error).toBe("bad_date");
  });

  it("skips busy time plus the buffer", () => {
    const day = weekday(2);
    const p = plan({ listing_id: "KV-101", date: day });
    const busy = { calendars: { "maria@example.com": { busy: [{ start: kyivIso(day, "10:00"), end: kyivIso(day, "12:00") }] } } };
    const out = runCode(code.Slots, { Config: { config: cfg }, "Slot Plan": p }, busy)[0];
    expect(out.slots[0].slot_start).toBe(`${day}T12:30`);
    expect(out.slots).toHaveLength(cfg.offer_slots);
  });

  it("offers the nearest days when the day is closed", () => {
    let sunday = new Date();
    while (new Date(sunday.toLocaleString("en-US", { timeZone: "Europe/Kyiv" })).getDay() !== 0 || sunday.getTime() < Date.now() + 86400000) sunday = new Date(sunday.getTime() + 86400000);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(sunday);
    const p = plan({ listing_id: "KV-101", date: day });
    const out = runCode(code.Slots, { Config: { config: cfg }, "Slot Plan": p }, { calendars: { "maria@example.com": { busy: [] } } })[0];
    expect(out.available).toBe(false);
    expect(out.slots.length).toBeGreaterThan(0);
    expect(out.note).toContain("ближайшие");
  });
});

describe("booking", () => {
  const day = weekday(2);
  const leads = [LEAD_HEAD, lead({ session_id: "web:s1", lead_id: "RL-1", phone: "+380501112233", name: "Анна" })];
  const book = (last_message: string, extra: J = {}) =>
    runCode(code["Booking Plan"], { Config: { config: cfg, input: { session_id: "web:s1", listing_id: "KV-101", slot_start: `${day}T12:30`, last_message, ...extra } } },
      batch(["Listings", LISTINGS], ["Leads", leads]))[0];

  it("books only after the client's own yes", () => {
    expect(book("Давайте в 12:30").result.error).toBe("not_confirmed");
    expect(book("Да, но лучше в субботу").result.error).toBe("not_confirmed");
    expect(book("Нет, давайте другое время").result.error).toBe("not_confirmed");
    expect(book("да").ok).toBe(true);
    expect(book("Да, записывайте!").ok).toBe(true);
    expect(book("ok, confirm").ok).toBe(true);
    expect(book("Давайте в 12:30").result.error).toBe("not_confirmed");
  });

  it("needs a phone and an allowed time", () => {
    const noPhone = runCode(code["Booking Plan"], { Config: { config: cfg, input: { session_id: "web:new", listing_id: "KV-101", slot_start: `${day}T12:30`, last_message: "да" } } },
      batch(["Listings", LISTINGS], ["Leads", [LEAD_HEAD]]))[0];
    expect(noPhone.result.error).toBe("no_phone");
    expect(book("да", { slot_start: `${day}T08:00` }).result.error).toBe("outside_hours");
    expect(book("да", { slot_start: "завтра" }).result.error).toBe("bad_slot");
  });

  it("derives one event id per dialog, listing and time", () => {
    const a = book("да");
    expect(a.booking_key).toBe(book("да, подтверждаю").booking_key);
    expect(a.booking_key).toMatch(/^[a-v0-9]{5,}$/);
    expect(a.event.id).toBe(a.booking_key);
    expect(a.event.description).toContain("+380501112233");
  });

  it("does not book twice and does not book taken time", () => {
    const p = book("да");
    const decide = (existing: J, busy: J[]) =>
      runCode(code["Booking Decide"], { Config: { config: cfg }, "Booking Plan": p, "Find Existing": existing }, { calendars: { "maria@example.com": { busy } } })[0];
    expect(decide({ items: [{ id: p.booking_key, status: "confirmed" }] }, []).result.already).toBe(true);
    const taken = decide({ items: [] }, [{ start: kyivIso(day, "12:00"), end: kyivIso(day, "13:00") }]);
    expect(taken.result.error).toBe("slot_taken");
    const alts = taken.result.slots.map((x: J) => x.slot_start);
    expect(alts[0]).toBe(`${day}T10:00`);
    expect(alts).not.toContain(`${day}T12:30`);
    expect(alts.every((t: string) => t < `${day}T11:00` || t >= `${day}T13:30`)).toBe(true);
    expect(decide({ items: [] }, []).create).toBe(true);
  });
});

describe("Guard Out", () => {
  const g = { channel: "web", session_id: "web:s9", customer: {}, text: "q", flags: [], debug: true, listing_ref: "" };
  const run = (output: string, steps: J[], nodes: J) => runCode(code["Guard Out"], Object.assign(nodes, { Config: { config: cfg }, "Guard In": g }), { output, intermediateSteps: steps })[0];

  it("lets through listings the tools returned, now or earlier in the dialog", () => {
    const nodes: J = {};
    expect(run("Есть KV-101.", [{ action: { tool: "search_listings", toolInput: {} }, observation: obs(["KV-101"]) }], nodes).flags).not.toContain("unknown_listing");
    expect(run("KV-101 — хороший вариант.", [], nodes).flags).not.toContain("unknown_listing");
  });

  it("replaces an invented listing and alerts the team", () => {
    const out = run("Есть ещё KV-999.", [{ action: { tool: "search_listings", toolInput: {} }, observation: obs(["KV-101"]) }], {});
    expect(out.reply).not.toContain("KV-999");
    expect(out.flags).toContain("unknown_listing");
    expect(out.alert_html).toContain("KV-999");
  });

  it("refuses promises about mortgage approval and bargaining", () => {
    expect(run("Ипотеку вам точно одобрят.", [], {}).flags).toContain("forbidden_promise");
    expect(run("Одобрят ипотеку без проблем.", [], {}).flags).toContain("forbidden_promise");
    expect(run("Владелец уступит, не переживайте.", [], {}).flags).toContain("forbidden_promise");
    expect(run("Торг возможен, это решает владелец — уточню у риелтора.", [], {}).flags).not.toContain("forbidden_promise");
  });
});

describe("follow-up", () => {
  it("reminds quiet leads on schedule and lists tomorrow's viewings", () => {
    const old = new Date(Date.now() - 2 * 86400000).toISOString();
    const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date(Date.now() + 86400000));
    const res = batch(
      ["Leads", [LEAD_HEAD,
        lead({ lead_id: "A", session_id: "tg:7", stage: "matched", last_contact: old, follow_ups: "0" }),
        lead({ lead_id: "B", session_id: "web:b", name: "Ира", phone: "+380991112233", stage: "qualified", last_contact: old, follow_ups: "3" }),
        lead({ lead_id: "C", session_id: "web:c", name: "Петя", stage: "new", last_contact: new Date(Date.now() - 4 * 86400000).toISOString(), follow_ups: "1" }),
        lead({ lead_id: "E", session_id: "web:e", name: "Вова", stage: "new", last_contact: old, follow_ups: "1" }),
        lead({ lead_id: "D", session_id: "tg:8", stage: "viewing_booked", last_contact: old, follow_ups: "0" })]],
      ["Viewings", [["created", "viewing_id", "listing_id", "slot_start", "agent_id", "name", "phone", "session_id", "address", "status"],
        ["", "e1", "KV-104", `${tomorrow}T15:00`, "pavel", "Пётр", "+380", "tg:9", "ул. Героев Днепра, 31", "scheduled"]]],
    );
    const out = runCode(code["Plan Follow-ups"], { Config: { config: cfg } }, res)[0];
    expect(out.messages.map((m: J) => m.chat_id)).toEqual(["7", "9"]);
    expect(out.messages[0].text).toBe(cfg.follow_up_texts[0]);
    expect(out.updates.data).toHaveLength(2);
    expect(out.digest_html).toContain("Петя");
    expect(out.digest_html).not.toContain("Ира");
    expect(out.digest_html).not.toContain("Вова");
    expect(out.digest_html).toContain("KV-104");
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
      const fromAi = Object.values(node.parameters.workflowInputs.value as J).map((v) => /\$fromAI\('(\w+)'/.exec(String(v))?.[1]).filter(Boolean).sort();
      expect(fromAi, t.function.name).toEqual(Object.keys(t.function.parameters.properties).sort());
    }
  });

  it("knows every realtor a listing names", () => {
    const ids = new Set(cfg.agents.map((a: J) => a.id));
    for (const row of LISTINGS.slice(1)) expect(ids.has(row[14]), row[0]).toBe(true);
  });

  it("fills every prompt placeholder from Config", () => {
    const prompt = readFileSync(path.join(dir, "agent/system-prompt.md"), "utf8");
    for (const [, key] of prompt.matchAll(/\{\{(\w+)\}\}/g)) expect(config, key).toHaveProperty(key);
  });
});
