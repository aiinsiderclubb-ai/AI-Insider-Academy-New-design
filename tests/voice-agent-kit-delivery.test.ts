import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The delivery kit promises that the agent confirms and corrects a delivery
 * but never changes the order itself, shows an order only to its own number,
 * and cannot overfill a delivery window. That lives in the Code nodes of the
 * shipped workflows; these tests run them against an in-memory Google Sheet.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = Record<string, any>;

const SLUG = "voice-agent-kit-delivery";
const dir = path.join(process.cwd(), "content/products", SLUG);
const workflowOf = (file: string): J => JSON.parse(readFileSync(path.join(dir, "workflows", `${file}.n8n.json`), "utf8"));
const codeOf = (workflow: J): Record<string, string> =>
  Object.fromEntries(workflow.nodes.filter((node: J) => node.type === "n8n-nodes-base.code").map((node: J) => [node.name, node.parameters.jsCode]));

const tools = workflowOf("order-tools");
const calls = workflowOf("confirmation-calls");
const code = { ...codeOf(calls), ...codeOf(tools) };
const shipped: J = new Function(code.Config)()[0].json;

function run(node: string, nodes: J, input: J | J[]): J[] {
  const $ = (name: string) => ({
    first: () => {
      if (!(name in nodes)) throw new Error(`node ${name} has not run`);
      return { json: Array.isArray(nodes[name]) ? nodes[name][0] : nodes[name] };
    },
    all: () => (Array.isArray(nodes[name]) ? nodes[name] : [nodes[name]]).map((json: J) => ({ json })),
  });
  const items = Array.isArray(input) ? input : [input];
  const $input = { first: () => ({ json: items[0] }), all: () => items.map((json) => ({ json })) };
  return (new Function("$", "$input", code[node])($, $input) as { json: J }[]).map((item) => item.json);
}

const HEAD = ["order_id", "phone", "customer_name", "city", "address", "apartment", "entrance", "floor", "intercom", "courier_note",
  "delivery_date", "window", "status", "items", "total", "payment", "confirmed", "confirmed_at", "calls", "last_call", "history"];
type Order = Partial<Record<(typeof HEAD)[number], string>>;

class Sheet {
  rows: string[][];

  constructor(orders: Order[], head = HEAD) {
    this.rows = [head, ...orders.map((o) => head.map((h) => o[h] ?? ""))];
  }

  get(id: string): J {
    const row = this.rows.find((r) => r[0] === id)!;
    return Object.fromEntries(HEAD.map((h, i) => [h, row[i]]));
  }

  handle(http: J): { ok: boolean; json: J } {
    if (http.method === "GET") return { ok: true, json: { values: this.rows.map((r) => [...r]) } };
    for (const item of http.body.data) {
      const m = /!([A-Z]+)(\d+)$/.exec(item.range)!;
      this.rows[Number(m[2]) - 1][m[1].charCodeAt(0) - 65] = item.values[0][0];
    }
    return { ok: true, json: { totalUpdatedCells: http.body.data.length } };
  }
}

function call(cfg: J, sheet: Sheet, body: J, opts: { failRead?: boolean; query?: J } = {}) {
  const nodes: J = { Config: cfg, "Voice Tool Webhook": { body, query: opts.query ?? {} } };
  const [parsed] = run("Parse Request", nodes, {});
  const [plan] = run("Plan", nodes, parsed);
  nodes.Plan = plan;
  let last = plan;
  let writes = 0;
  if (plan.needs_sheet) {
    const read = opts.failRead ? { ok: false, json: { error: { httpCode: "503" } } } : sheet.handle(plan.http);
    if (!read.ok) [last] = run("Tool Failed", nodes, read.json);
    else {
      const [decided] = run("Decide", nodes, read.json);
      nodes.Decide = decided;
      last = decided;
      if (decided.needs_write) {
        writes += 1;
        sheet.handle(decided.http);
        [last] = run("Finish", nodes, {});
      }
    }
  }
  const notes: string[] = last.needs_notify ? [last.staff_message] : [];
  return { response: run("Build Response", nodes, last)[0].response as J, notes, plan, writes };
}

// Monday 2026-10-12, 10:00 in Kyiv.
const cfg: J = { ...shipped, now_override: "2026-10-12T07:00:00Z" };
const CALLER = "+380501112233";
const vapi = (name: string, args: J, number = CALLER) => ({
  message: { type: "tool-calls", toolCallList: [{ id: "tc_1", type: "function", function: { name, arguments: args } }], call: { id: "call_1", customer: { number } } },
});
const out = (r: { response: J }): J => JSON.parse(r.response.results[0].result);
const order = (extra: Order = {}): Order => ({
  order_id: "A-1001", phone: "050 111 22 33", customer_name: "Ира", city: "Киев", address: "улица Примерная, 5", apartment: "12",
  delivery_date: "2026-10-13", window: "12-15", status: "packed", items: "Кофемолка", total: "2400 грн", payment: "оплачен", ...extra,
});
const tool = (sheet: Sheet, name: string, args: J, number = CALLER) => call(cfg, sheet, vapi(name, { customer_phone: CALLER, ...args }, number));

describe("order tools", () => {
  it("finds the caller's active orders and says them aloud", () => {
    const sheet = new Sheet([order(), order({ order_id: "A-0999", status: "delivered" }), order({ order_id: "B-1", phone: "+380670000000" })]);
    const o = out(tool(sheet, "find_order", {}));
    expect(o.orders).toHaveLength(1);
    expect(o.orders[0]).toMatchObject({ order_id: "A-1001", status: "собран", can_change: true, confirmed: false });
    expect(o.orders[0].delivery).toMatch(/вторник.*с 12:00 до 15:00/);
    expect(o.orders[0].address).toBe("Киев, улица Примерная, 5, квартира 12");
  });

  it("shows nothing to another number", () => {
    const sheet = new Sheet([order()]);
    const r = tool(sheet, "find_order", {}, "+380990000000");
    expect(out(r).error).toBe("caller_mismatch");
    expect(r.plan.needs_sheet).toBe(false);
    expect(out(tool(sheet, "confirm_delivery", { order_id: "B-1", consent: true })).error).toBe("order_not_found");
  });

  it("confirms only after a yes, once", () => {
    const sheet = new Sheet([order()]);
    expect(out(tool(sheet, "confirm_delivery", { order_id: "A-1001" })).error).toBe("no_consent");
    const r = tool(sheet, "confirm_delivery", { order_id: "a 1001", consent: true });
    expect(out(r).ok).toBe(true);
    expect(sheet.get("A-1001")).toMatchObject({ confirmed: "да", confirmed_at: "2026-10-12T10:00" });
    expect(sheet.get("A-1001").history).toMatch(/доставка подтверждена клиентом \(голосовой агент, звонок call_1\)/);
    expect(tool(sheet, "confirm_delivery", { order_id: "A-1001", consent: true }).writes).toBe(0);
  });

  it("has no tool to change what was ordered", () => {
    const r = call(cfg, new Sheet([order()]), vapi("change_items", { order_id: "A-1001", items: "ещё две пачки" }));
    expect(out(r).error).toBe("unknown_tool");
    expect(out(r).say).toMatch(/оператор/);
    expect(r.plan.needs_sheet).toBe(false);
  });

  it("updates courier details and tells the operators", () => {
    const sheet = new Sheet([order()]);
    const r = tool(sheet, "update_address", { order_id: "A-1001", intercom: "12К", courier_note: "позвонить за 15 минут", consent: true });
    expect(out(r).address).toBe("Киев, улица Примерная, 5, квартира 12, домофон 12К");
    expect(sheet.get("A-1001")).toMatchObject({ intercom: "12К", courier_note: "позвонить за 15 минут", confirmed: "да" });
    expect(r.notes[0]).toMatch(/Уточнение для курьера/);
  });

  it("moves the address within the delivery area and drops the old flat number", () => {
    const sheet = new Sheet([order()]);
    const r = tool(sheet, "update_address", { order_id: "A-1001", city: "г. Ирпень", address: "улица Садовая, 3", consent: true });
    expect(out(r).ok).toBe(true);
    expect(sheet.get("A-1001")).toMatchObject({ city: "г. Ирпень", address: "улица Садовая, 3", apartment: "" });
    expect(r.notes[0]).toMatch(/Изменён адрес доставки[\s\S]*Было: Киев, улица Примерная, 5, квартира 12[\s\S]*Стало: г. Ирпень, улица Садовая, 3/);
    expect(out(tool(sheet, "update_address", { order_id: "A-1001", city: "Львов", address: "Рынок, 1", consent: true })).error).toBe("outside_zone");
    expect(out(tool(sheet, "update_address", { order_id: "A-1001", city: "Киев", consent: true })).error).toBe("missing_fields");
  });

  it("lets only an operator move an order that is already with the courier or too close", () => {
    const sheet = new Sheet([order({ status: "out_for_delivery" }), order({ order_id: "A-1002", delivery_date: "2026-10-12", window: "12-15" })]);
    expect(out(tool(sheet, "update_address", { order_id: "A-1001", address: "улица Новая, 1", consent: true })).error).toBe("not_changeable");
    expect(out(tool(sheet, "update_address", { order_id: "A-1001", intercom: "5", consent: true })).ok).toBe(true);
    expect(out(tool(sheet, "check_windows", { order_id: "A-1002", date: "tomorrow" })).error).toBe("too_late"); // its window starts in 2 hours
    const closed = new Sheet([order({ status: "delivered" })]);
    expect(out(tool(closed, "confirm_delivery", { order_id: "A-1001", consent: true })).error).toBe("order_closed");
  });

  it("offers only windows with room, after the cut-off, on delivery days", () => {
    const busy = Array.from({ length: 25 }, (_, i) => order({ order_id: `X-${i}`, phone: "+380670000001", window: "15-18" }));
    const sheet = new Sheet([order(), ...busy]);
    const o = out(tool(sheet, "check_windows", { order_id: "A-1001", date: "tomorrow" }));
    expect(o.windows.map((w: J) => w.window_id)).toEqual(["09-12", "12-15", "18-21"]);
    const today = out(tool(sheet, "check_windows", { order_id: "A-1001", date: "today" }));
    expect(today.windows.map((w: J) => w.window_id)).toEqual(["15-18", "18-21"]); // 10:00 now, 3-hour cut-off
    const sunday = out(tool(sheet, "check_windows", { order_id: "A-1001", date: "sun" }));
    expect(sunday.available).toBe(false);
    expect(sunday.windows[0].date).toBe("2026-10-19");
  });

  it("moves the window, refuses a full one and keeps the old window", () => {
    const busy = Array.from({ length: 25 }, (_, i) => order({ order_id: `X-${i}`, phone: "+380670000001", window: "15-18" }));
    const sheet = new Sheet([order(), ...busy]);
    const full = out(tool(sheet, "change_window", { order_id: "A-1001", date: "tomorrow", window_id: "15-18", consent: true }));
    expect(full.error).toBe("window_full");
    expect(full.windows.length).toBeGreaterThan(0);
    expect(sheet.get("A-1001").window).toBe("12-15");
    const r = tool(sheet, "change_window", { order_id: "A-1001", date: "wed", window_id: "18-21", consent: true });
    expect(out(r)).toMatchObject({ ok: true });
    expect(sheet.get("A-1001")).toMatchObject({ delivery_date: "2026-10-14", window: "18-21", confirmed: "да" });
    expect(r.notes[0]).toMatch(/Перенос доставки/);
    expect(out(tool(sheet, "change_window", { order_id: "A-1001", date: "tomorrow", window_id: "07-09", consent: true })).error).toBe("unknown_window");
  });

  it("never invents a result when the sheet is down or not laid out as expected", () => {
    const down = call(cfg, new Sheet([order()]), vapi("find_order", { customer_phone: CALLER }), { failRead: true });
    expect(out(down).error).toBe("tool_unavailable");
    expect(down.notes[0]).toMatch(/Сбой инструмента/);
    const wrong = tool(new Sheet([order()], HEAD.filter((h) => h !== "window")), "find_order", {});
    expect(out(wrong).error).toBe("tool_unavailable");
    expect(wrong.notes[0]).toMatch(/Нет колонок: window/);
  });

  it("passes everything else to an operator without reading the sheet", () => {
    const r = call(cfg, new Sheet([]), vapi("request_callback", { customer_name: "Ира", customer_phone: CALLER, order_id: "A-1001", topic: "добавить товар" }));
    expect(out(r).ok).toBe(true);
    expect(r.plan.needs_sheet).toBe(false);
    expect(r.notes[0]).toMatch(/Заказ: A-1001[\s\S]*Тема: добавить товар/);
  });

  it("takes the customer's number from an outbound Retell call and a flat ElevenLabs body", () => {
    const sheet = new Sheet([order()]);
    const retell = call(cfg, sheet, { name: "find_order", args: { customer_phone: "0501112233" }, call: { call_id: "r1", direction: "outbound", from_number: "+380440000000", to_number: CALLER } });
    expect(retell.response.orders).toHaveLength(1);
    const eleven = call(cfg, sheet, { customer_phone: CALLER, caller_number: CALLER, conversation_id: "e1" }, { query: { tool: "find_order" } });
    expect(eleven.response.orders[0].order_id).toBe("A-1001");
  });
});

describe("confirmation calls", () => {
  const sheetValues = (orders: Order[]) => ({ values: new Sheet(orders).rows });
  const pick = (orders: Order[], c: J = cfg) => run("Pick Calls", { Config: c }, sheetValues(orders));

  it("calls tomorrow's unconfirmed orders that still have attempts left", () => {
    const picked = pick([
      order(), order({ order_id: "A-2", confirmed: "да" }), order({ order_id: "A-3", delivery_date: "2026-10-14" }),
      order({ order_id: "A-4", calls: "2" }), order({ order_id: "A-5", status: "cancelled" }), order({ order_id: "A-6", last_call: "2026-10-12T09:00" }),
    ]);
    expect(picked.map((p) => p.order_id)).toEqual(["A-1001"]);
    expect(picked[0].request.url).toBe("https://api.vapi.ai/call");
    expect(picked[0].request.body.customer.number).toBe(CALLER);
    expect(picked[0].request.body.assistantOverrides.variableValues.delivery).toMatch(/с 12:00 до 15:00/);
  });

  it("builds a Retell request and stays quiet outside calling hours", () => {
    const retell = pick([order()], { ...cfg, outbound: { ...cfg.outbound, provider: "retell" } });
    expect(retell[0].request.url).toBe("https://api.retellai.com/v2/create-phone-call");
    expect(retell[0].request.body).toMatchObject({ to_number: CALLER, retell_llm_dynamic_variables: { order_id: "A-1001" } });
    expect(pick([order()], { ...cfg, now_override: "2026-10-12T19:00:00Z" })).toHaveLength(0); // 22:00 in Kyiv
  });

  it("counts an attempt only for a call that started", () => {
    const sheet = new Sheet([order(), order({ order_id: "A-2", phone: "+380670000002" })]);
    const picked = run("Pick Calls", { Config: cfg }, { values: sheet.rows });
    const [marked] = run("Mark Calls", { Config: cfg, "Pick Calls": picked, "Read Orders": { values: sheet.rows } }, [{ id: "vapi-call-1" }, { error: { message: "401" } }]);
    sheet.handle({ method: "POST", body: marked.body });
    expect(sheet.get("A-1001")).toMatchObject({ calls: "1", last_call: "2026-10-12T10:00" });
    expect(sheet.get("A-2")).toMatchObject({ calls: "0", last_call: "2026-10-12T10:00" });
    expect(marked.report).toMatch(/Начато: 1[\s\S]*Не начато: 1 \(A-2\)/);
  });
});

describe("package", () => {
  it("describes the six tools the backend knows, in every provider file", () => {
    const schema = JSON.parse(readFileSync(path.join(dir, "tools/tools.schema.json"), "utf8")) as J[];
    expect(schema.map((t) => t.name)).toEqual(["find_order", "confirm_delivery", "update_address", "check_windows", "change_window", "request_callback"]);
    const vapiTools = JSON.parse(readFileSync(path.join(dir, "providers/vapi-tools.json"), "utf8")) as J[];
    expect(vapiTools.map((t) => t.function)).toEqual(schema);
    const retell = JSON.parse(readFileSync(path.join(dir, "providers/retell-llm.json"), "utf8"));
    expect(retell.general_tools.filter((t: J) => t.type === "custom").map((t: J) => t.name)).toEqual(schema.map((t) => t.name));
    const eleven = readFileSync(path.join(dir, "providers/elevenlabs-tools.md"), "utf8");
    for (const t of schema) expect(eleven).toContain(`?tool=${t.name}`);
  });

  it("protects the webhooks, writes the order sheet in one node and carries no credentials", () => {
    for (const file of ["order-tools", "confirmation-calls", "call-summary", "error-alert"]) {
      const workflow = workflowOf(file);
      for (const node of workflow.nodes as J[]) {
        if (node.type.endsWith(".webhook")) expect(node.parameters.authentication, `${file}: ${node.name}`).toBe("headerAuth");
        for (const credential of Object.values(node.credentials ?? {}) as J[]) expect(credential.id).toBe("REPLACE_ME");
      }
      expect(workflow.pinData).toEqual({});
    }
    // Successful runs hold names, phones and addresses: n8n does not keep them.
    expect(tools.settings.saveDataSuccessExecution).toBe("none");
    expect(calls.settings.saveDataSuccessExecution).toBe("none");
    const writers = (tools.nodes as J[]).filter((node) => node.type.endsWith(".httpRequest") && node.parameters.method !== "GET");
    expect(writers.map((node) => node.name)).toEqual(["Sheet Write"]);
    expect(calls.active).toBe(false);
  });

  it("ships 30 test calls and a sheet template with every column the backend reads", () => {
    const testCalls = readFileSync(path.join(dir, "tests/test-calls.csv"), "utf8").trim().split("\n");
    expect(testCalls.length - 1).toBe(30);
    const template = readFileSync(path.join(dir, "data/orders-template.csv"), "utf8").replace(/^﻿/, "").split("\n")[0].split(",");
    expect(template).toEqual(HEAD);
  });
});
