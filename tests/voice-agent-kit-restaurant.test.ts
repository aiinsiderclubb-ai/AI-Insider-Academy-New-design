import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The restaurant kit books tables with the booking backend the other voice
 * kits share, patched so that the party size picks the tables and how long a
 * table is held (scripts/agent-kits/voice/build_restaurant.py). These tests
 * run the Code nodes of the shipped workflow against an in-memory Google
 * Calendar, the same way tests/voice-kit-backend.test.ts does.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = Record<string, any>;

const SLUG = "voice-agent-kit-restaurant";
const dir = path.join(process.cwd(), "content/products", SLUG);
const workflowOf = (slug: string, file = "booking-tools"): J =>
  JSON.parse(readFileSync(path.join(process.cwd(), "content/products", slug, "workflows", `${file}.n8n.json`), "utf8"));
const codeOf = (workflow: J): Record<string, string> =>
  Object.fromEntries(workflow.nodes.filter((node: J) => node.type === "n8n-nodes-base.code").map((node: J) => [node.name, node.parameters.jsCode]));

const tools = workflowOf(SLUG);
const code = codeOf(tools);
const shipped: J = new Function(code.Config)()[0].json;

function run(node: string, nodes: J, input: J): J {
  const $ = (name: string) => ({
    first: () => {
      if (!(name in nodes)) throw new Error(`node ${name} has not run`);
      return { json: nodes[name] };
    },
  });
  const $input = { first: () => ({ json: input }) };
  return new Function("$", "$input", code[node])($, $input)[0].json;
}

class Calendar {
  events: J[] = [];

  handle(http: J): { ok: boolean; json: J } {
    const url = new URL(http.url);
    const tail = url.pathname.split("/events")[1] ?? "";
    if (http.method === "GET") {
      const min = Date.parse(url.searchParams.get("timeMin")!);
      const max = Date.parse(url.searchParams.get("timeMax")!);
      const prop = url.searchParams.get("privateExtendedProperty");
      let items = this.events.filter((e) => e.status !== "cancelled" && Date.parse(e.end.dateTime) > min && Date.parse(e.start.dateTime) < max);
      if (prop) {
        const [key, value] = prop.split("=");
        items = items.filter((e) => e.extendedProperties?.private?.[key] === value);
      }
      return { ok: true, json: { items } };
    }
    if (http.method === "POST") {
      if (this.events.some((e) => e.id === http.body.id)) return { ok: false, json: { error: { httpCode: "409" } } };
      this.events.push({ status: "confirmed", ...http.body });
      return { ok: true, json: http.body };
    }
    const event = this.events.find((e) => e.id === decodeURIComponent(tail.slice(1)));
    if (!event) return { ok: false, json: { error: { httpCode: "404" } } };
    const { extendedProperties, ...rest } = http.body;
    if (extendedProperties) event.extendedProperties.private = { ...event.extendedProperties.private, ...extendedProperties.private };
    Object.assign(event, rest);
    return { ok: true, json: event };
  }
}

function call(cfg: J, calendar: Calendar, body: J, opts: { failRead?: boolean; query?: J } = {}) {
  const nodes: J = { Config: cfg, "Voice Tool Webhook": { body, query: opts.query ?? {} } };
  const parsed = run("Parse Request", nodes, {});
  const plan = run("Plan", nodes, parsed);
  nodes.Plan = plan;
  let last = plan;
  if (plan.needs_calendar) {
    const read = opts.failRead ? { ok: false, json: { error: { httpCode: "503" } } } : calendar.handle(plan.http);
    if (!read.ok) last = run("Tool Failed", nodes, read.json);
    else {
      const decided = run("Decide", nodes, read.json);
      nodes.Decide = decided;
      last = decided;
      if (decided.needs_write) {
        const wrote = calendar.handle(decided.http);
        last = wrote.ok ? run("Finish", nodes, wrote.json) : run("Tool Failed", nodes, wrote.json);
      }
    }
  }
  const notes: string[] = last.needs_notify ? [last.staff_message] : [];
  return { response: run("Build Response", nodes, last).response as J, notes, plan };
}

// Monday 2026-10-12, 10:00 in Kyiv; the restaurant opens at 12:00.
const cfg: J = { ...shipped, now_override: "2026-10-12T07:00:00Z", calendar_id: "rest@example.com" };
const CALLER = "+380501112233";
const vapi = (name: string, args: J | string, number = CALLER, callId = "call_1") => ({
  message: { type: "tool-calls", toolCallList: [{ id: "tc_1", type: "function", function: { name, arguments: args } }], call: { id: callId, customer: { number } } },
});
const out = (r: { response: J }): J => JSON.parse(r.response.results[0].result);
const check = (cal: Calendar, args: J, c: J = cfg) => out(call(c, cal, vapi("check_availability", args)));
const book = (cal: Calendar, args: J, callId = "call_1", number = CALLER) =>
  out(call(cfg, cal, vapi("create_booking", { customer_name: "Ира", customer_phone: number, consent: true, ...args }, number, callId)));

describe("table booking", () => {
  it("offers a couple the smallest table, from opening time, held for 90 minutes", () => {
    const o = check(new Calendar(), { guests: 2, date: "today" });
    expect(o.available).toBe(true);
    expect(o.table_minutes).toBe(90);
    expect(o.slots[0]).toMatchObject({ slot_start: "2026-10-12T12:00", table_id: "t1" });
    expect(o.slots.at(-1).slot_start).toBe("2026-10-12T21:30"); // 21:30 + 90 min = closing time
  });

  it("matches the table to the party", () => {
    expect(check(new Calendar(), { guests: 3, date: "tomorrow" }).slots[0].table_id).toBe("t3");
    expect(check(new Calendar(), { guests: 6, date: "tomorrow" }).slots[0].table_id).toBe("t5");
    expect(check(new Calendar(), { guests: 2, date: "tomorrow", zone: "terrace" }).slots[0].table_id).toBe("t6");
  });

  it("refuses parties it cannot seat before touching the calendar", () => {
    const cases: [J, string][] = [
      [{ guests: 9, date: "tomorrow" }, "party_too_large"],
      [{ guests: 0, date: "tomorrow" }, "bad_guests"],
      [{ guests: "двое", date: "tomorrow" }, "bad_guests"],
      [{ guests: 6, date: "tomorrow", zone: "terrace" }, "no_table"],
      [{ guests: 2, date: "tomorrow", zone: "roof" }, "unknown_zone"],
      [{ date: "tomorrow" }, "missing_fields"],
    ];
    for (const [args, error] of cases) {
      const r = call(cfg, new Calendar(), vapi("check_availability", args));
      expect(out(r).error, JSON.stringify(args)).toBe(error);
      expect(r.plan.needs_calendar).toBe(false);
    }
  });

  it("fills the tables one by one and then offers other times", () => {
    const cal = new Calendar();
    const seated = [1, 2, 3, 4, 5, 6].map((i) => book(cal, { guests: 2, slot_start: "2026-10-13T19:00" }, `c${i}`, `+38050000000${i}`).table);
    expect(seated).toEqual(["стол у окна, на двоих", "стол на двоих", "стол на террасе, на двоих", "стол на четверых", "стол на четверых у камина", "стол на террасе, на четверых"]);
    const full = book(cal, { guests: 2, slot_start: "2026-10-13T19:00" }, "c7", "+380500000007");
    expect(full.error).toBe("slot_taken");
    expect(full.slots.length).toBeGreaterThan(0);
    expect(cal.events).toHaveLength(6);
  });

  it("keeps a table free for the buffer after a party leaves", () => {
    const cal = new Calendar();
    expect(book(cal, { guests: 6, slot_start: "2026-10-13T12:00" }).ok).toBe(true); // until 14:30
    expect(book(cal, { guests: 6, slot_start: "2026-10-13T14:30" }, "c2", "+380500000002").error).toBe("slot_taken");
    expect(book(cal, { guests: 6, slot_start: "2026-10-13T15:00" }, "c3", "+380500000003").ok).toBe(true);
  });

  it("writes the party into the event and returns the same booking to a retry", () => {
    const cal = new Calendar();
    const first = book(cal, { guests: 4, slot_start: "2026-10-13T19:00", occasion: "день рождения", wishes: "детский стул" });
    expect(first).toMatchObject({ ok: true, table: "стол на четверых" });
    const event = cal.events[0];
    expect(event.summary).toBe("Бронь: 4 гост. — Ира");
    expect(event.description).toMatch(/Гостей: 4[\s\S]*Повод: день рождения[\s\S]*Пожелания: детский стул/);
    expect(Date.parse(event.end.dateTime) - Date.parse(event.start.dateTime)).toBe(120 * 60000);
    expect(event.extendedProperties.private).toMatchObject({ phone: CALLER, guests: "4", staff_id: "t3" });
    expect(book(cal, { guests: 4, slot_start: "2026-10-13T19:00" }).booking_id).toBe(first.booking_id);
    expect(cal.events).toHaveLength(1);
  });

  it("does not book without a yes, or a table the party does not fit", () => {
    const cal = new Calendar();
    expect(book(cal, { guests: 2, slot_start: "2026-10-13T19:00", consent: false }).error).toBe("no_consent");
    expect(book(cal, { guests: 6, slot_start: "2026-10-13T19:00", table_id: "t1" }).error).toBe("table_unfit");
    expect(book(cal, { guests: 2, slot_start: "2026-10-13T22:00" }).error).toBe("outside_hours");
    expect(cal.events).toHaveLength(0);
  });

  it("moves a booking to a bigger table when the party grows", () => {
    const cal = new Calendar();
    const id = book(cal, { guests: 2, slot_start: "2026-10-13T19:00" }).booking_id;
    const moved = out(call(cfg, cal, vapi("reschedule_booking", { booking_id: id, customer_phone: CALLER, new_slot_start: "2026-10-13T19:00", guests: 6 })));
    expect(moved).toMatchObject({ ok: true, table: "большой стол", guests: 6 });
    const event = cal.events[0];
    expect(event.extendedProperties.private).toMatchObject({ staff_id: "t5", guests: "6" });
    expect(Date.parse(event.end.dateTime) - Date.parse(event.start.dateTime)).toBe(150 * 60000);
    expect(event.summary).toBe("Бронь: 6 гост. — Ира");
    expect(out(call(cfg, cal, vapi("reschedule_booking", { booking_id: id, customer_phone: CALLER, new_slot_start: "2026-10-13T19:00", guests: 12 }))).error).toBe("party_too_large");
  });

  it("lets only the booking's own number change it, and flags a late cancellation", () => {
    const cal = new Calendar();
    const id = book(cal, { guests: 2, slot_start: "2026-10-12T12:30" }).booking_id; // 2.5 hours away, cancel_min_hours is 3
    expect(out(call(cfg, cal, vapi("cancel_booking", { booking_id: id, customer_phone: CALLER }, "+380990000000"))).error).toBe("caller_mismatch");
    const found = out(call(cfg, cal, vapi("find_booking", { customer_phone: "0501112233" })));
    expect(found.bookings[0]).toMatchObject({ booking_id: id, guests: "2" });
    const cancelled = out(call(cfg, cal, vapi("cancel_booking", { booking_id: id, customer_phone: CALLER })));
    expect(cancelled).toMatchObject({ ok: true, late_cancellation: true });
    expect(cal.events[0].status).toBe("cancelled");
  });

  it("treats an event with no table — a private party — as closing the restaurant", () => {
    const cal = new Calendar();
    cal.events.push({ id: "manual1", status: "confirmed", summary: "Банкет, закрыто", start: { dateTime: "2026-10-14T09:00:00Z" }, end: { dateTime: "2026-10-14T21:00:00Z" } });
    const o = check(cal, { guests: 2, date: "2026-10-14" });
    expect(o.available).toBe(false);
    expect(o.slots[0].slot_start.startsWith("2026-10-15")).toBe(true);
  });

  it("sends banquets and complaints to staff, and never invents a result when the calendar is down", () => {
    const cb = call(cfg, new Calendar(), vapi("request_callback", { customer_name: "Олег", customer_phone: CALLER, topic: "банкет на 20 человек", details: "суббота" }));
    expect(out(cb).ok).toBe(true);
    expect(cb.notes[0]).toMatch(/банкет на 20 человек/);
    const down = call(cfg, new Calendar(), vapi("check_availability", { guests: 2, date: "tomorrow" }), { failRead: true });
    expect(out(down).error).toBe("tool_unavailable");
    expect(out(down).slots).toBeUndefined();
  });

  it("understands Retell and ElevenLabs, with the party size as text", () => {
    const retell = call(cfg, new Calendar(), { name: "check_availability", args: { guests: "4", date: "tomorrow" }, call: { call_id: "r1", from_number: CALLER, direction: "inbound" } });
    expect(retell.response.slots[0].table_id).toBe("t3");
    const eleven = call(cfg, new Calendar(), { guests: 2, date: "tomorrow", conversation_id: "e1" }, { query: { tool: "check_availability" } });
    expect(eleven.response.available).toBe(true);
  });
});

describe("package", () => {
  it("keeps the shared backend's other nodes unchanged", () => {
    const salon = codeOf(workflowOf("voice-agent-kit-beauty-salon"));
    for (const name of ["Plan", "Finish", "Tool Failed", "Build Response"]) expect(code[name], name).toBe(salon[name]);
  });

  it("describes every zone and asks for the party size in the tools", () => {
    const schema = JSON.parse(readFileSync(path.join(dir, "tools/tools.schema.json"), "utf8")) as J[];
    expect(schema.map((t) => t.name)).toEqual(["check_availability", "create_booking", "find_booking", "reschedule_booking", "cancel_booking", "request_callback"]);
    for (const zone of shipped.zones) expect(schema[0].parameters.properties.zone.description).toContain(zone.id);
    expect(schema[0].parameters.required).toContain("guests");
    expect(schema[1].parameters.required).toContain("guests");
    for (const t of shipped.tables) expect(shipped.zones.map((z: J) => z.id)).toContain(t.zone);
    const vapiTools = JSON.parse(readFileSync(path.join(dir, "providers/vapi-tools.json"), "utf8")) as J[];
    expect(vapiTools.map((t) => t.function)).toEqual(schema);
  });

  it("protects the webhook, writes in one node only and carries no credentials", () => {
    for (const file of ["booking-tools", "call-summary", "error-alert"]) {
      const workflow = workflowOf(SLUG, file);
      for (const node of workflow.nodes as J[]) {
        if (node.type.endsWith(".webhook")) expect(node.parameters.authentication, `${file}: ${node.name}`).toBe("headerAuth");
        for (const credential of Object.values(node.credentials ?? {}) as J[]) expect(credential.id).toBe("REPLACE_ME");
      }
    }
    const writers = (tools.nodes as J[]).filter((node) => node.type.endsWith(".httpRequest") && node.parameters.method !== "GET");
    expect(writers.map((node) => node.name)).toEqual(["Calendar Write"]);
    expect(tools.settings.saveDataSuccessExecution).toBe("none");
  });

  it("ships 30 test calls", () => {
    const calls = readFileSync(path.join(dir, "tests/test-calls.csv"), "utf8").trim().split("\n");
    expect(calls.length - 1).toBe(30);
  });
});
