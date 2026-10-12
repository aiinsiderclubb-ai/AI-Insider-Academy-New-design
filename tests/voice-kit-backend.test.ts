import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The voice agent kits sell one promise above all: the agent cannot book a
 * time that is not free, book twice, or change someone else's booking. That
 * promise lives in the Code nodes of the shipped n8n workflow, so these tests
 * run the JavaScript out of the shipped JSON itself — the file a buyer
 * imports — against an in-memory stand-in for the Google Calendar events API.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = Record<string, any>;

const KITS = ["voice-agent-kit-beauty-salon", "voice-agent-kit-clinic-services", "voice-agent-kit-auto-service", "voice-agent-kit-real-estate"];
const workflowOf = (slug: string, file = "booking-tools"): J =>
  JSON.parse(readFileSync(path.join(process.cwd(), "content/products", slug, "workflows", `${file}.n8n.json`), "utf8"));
const codeOf = (workflow: J): Record<string, string> =>
  Object.fromEntries(workflow.nodes.filter((node: J) => node.type === "n8n-nodes-base.code").map((node: J) => [node.name, node.parameters.jsCode]));

const code = codeOf(workflowOf(KITS[0]));

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
      return { ok: true, json: { items: items.sort((a, b) => Date.parse(a.start.dateTime) - Date.parse(b.start.dateTime)) } };
    }
    if (http.method === "POST") {
      if (this.events.some((e) => e.id === http.body.id)) return { ok: false, json: { error: { httpCode: "409", message: "The requested identifier already exists." } } };
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
    const read = opts.failRead ? { ok: false, json: { error: { httpCode: "503", message: "backend down" } } } : calendar.handle(plan.http);
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
  return { response: run("Build Response", nodes, last).response as J, notes, parsed, plan };
}

const day = { open: "09:00", close: "19:00" };
const cfg: J = {
  timezone: "Europe/Kyiv", locale: "ru-RU", now_override: "2026-10-12T07:00:00Z", // Monday, 10:00 local
  calendar_api_base: "https://www.googleapis.com/calendar/v3", calendar_id: "salon@example.com",
  phone: { country_code: "380", national_prefix: "0" },
  hours: { mon: day, tue: day, wed: day, thu: day, fri: day, sat: { open: "10:00", close: "16:00" }, sun: null },
  closed_dates: ["2026-10-14"], slot_step_min: 30, lead_time_min: 120, buffer_min: 0, booking_window_days: 30, offer_slots: 3,
  cancel_min_hours: 24, late_cancel_note: "Отмена позже чем за сутки — без возврата предоплаты.",
  require_caller_match: true, address: "улица Примерная, дом один", detail_fields: ["car"], detail_labels: { car: "Автомобиль" }, required_details: [],
  services: [
    { id: "haircut", name: "Стрижка", duration_min: 60, price: "30 €", staff: ["anna", "olga"] },
    { id: "color", name: "Окрашивание", duration_min: 120, price: "80 €", staff: ["anna"] },
  ],
  staff: [{ id: "anna", name: "Анна" }, { id: "olga", name: "Ольга" }],
};
const CALLER = "+380501112233";
const vapi = (name: string, args: J | string, number = CALLER, callId = "call_1") => ({
  message: { type: "tool-calls", toolCallList: [{ id: "tc_1", type: "function", function: { name, arguments: args } }], call: { id: callId, customer: { number } } },
});
const out = (r: { response: J }): J => JSON.parse(r.response.results[0].result);

describe("booking backend shipped in the voice agent kits", () => {
  const cal = new Calendar();
  const book = (extra: J = {}, callId = "call_1") =>
    call(cfg, cal, vapi("create_booking", { service_id: "haircut", slot_start: "2026-10-12T12:00", customer_name: "Ира", customer_phone: "050 111 22 33", consent: true, ...extra }, CALLER, callId));
  const mine = () => out(call(cfg, cal, vapi("find_booking", { customer_phone: CALLER }))).bookings[0].booking_id as string;

  it("offers only free time, after the lead time, spoken in the business language", () => {
    const r = call(cfg, cal, vapi("check_availability", { service_id: "haircut", date: "2026-10-12" }));
    const o = out(r);
    expect(r.response.results[0].toolCallId).toBe("tc_1");
    expect(o.slots.map((s: J) => s.slot_start)).toEqual(["2026-10-12T12:00", "2026-10-12T15:00", "2026-10-12T18:00"]);
    expect(o.slots[0].spoken).toMatch(/понедельник.*12:00/);
  });

  it("resolves date words itself, so the model never computes a date", () => {
    const at = (date: string) => out(call(cfg, cal, vapi("check_availability", { service_id: "haircut", date })));
    expect([at("today").date, at("Tomorrow").date, at("fri").date, at("+3").date]).toEqual(["2026-10-12", "2026-10-13", "2026-10-16", "2026-10-15"]);
    expect(at("next week").error).toBe("bad_date");
  });

  it("falls through closed days to the nearest open one", () => {
    for (const [date, next] of [["2026-10-14", "2026-10-15"], ["2026-10-18", "2026-10-19"]]) {
      const o = out(call(cfg, cal, vapi("check_availability", { service_id: "haircut", date })));
      expect(o.available).toBe(false);
      expect(o.slots[0].slot_start.startsWith(next)).toBe(true);
    }
  });

  it("refuses bad input before touching the calendar", () => {
    const cases: [J, string][] = [[{ service_id: "haircut", date: "2026-10-01" }, "date_in_past"], [{ service_id: "haircut", date: "2027-01-10" }, "too_far"],
      [{ service_id: "massage", date: "2026-10-13" }, "unknown_service"], [{ service_id: "haircut" }, "missing_fields"]];
    for (const [args, error] of cases) {
      const r = call(cfg, cal, vapi("check_availability", args));
      expect(out(r).error).toBe(error);
      expect(r.plan.needs_calendar).toBe(false);
    }
    expect(out(call(cfg, cal, vapi("drop_database", {}))).error).toBe("unknown_tool");
  });

  it("does not book without the caller's explicit yes or a readable phone", () => {
    expect(out(book({ consent: undefined })).error).toBe("no_consent");
    expect(out(book({ customer_phone: "12345" })).error).toBe("bad_phone");
    expect(cal.events).toHaveLength(0);
  });

  it("writes a booking once and returns the same booking to a retried request", () => {
    const first = out(book({ car: "Skoda Octavia 2019", notes: "Первый визит" }));
    expect(first).toMatchObject({ ok: true, staff: "Анна" });
    const event = cal.events[0];
    expect(event.extendedProperties.private.phone).toBe(CALLER);
    expect(event.start.dateTime).toBe("2026-10-12T09:00:00.000Z");
    expect(event.description).toMatch(/Автомобиль: Skoda/);
    const again = out(book());
    expect(again).toMatchObject({ ok: true, booking_id: first.booking_id, staff: "Анна" });
    expect(cal.events).toHaveLength(1);
  });

  it("gives the hour to the second specialist and refuses a third booking with alternatives", () => {
    expect(out(book({ customer_name: "Оля", customer_phone: "+380 67 000 00 01" }, "call_2")).staff).toBe("Ольга");
    const third = out(book({ customer_name: "Катя", customer_phone: "+380 67 000 00 02" }, "call_3"));
    expect(third.error).toBe("slot_taken");
    expect(third.slots.length).toBeGreaterThan(0);
    expect(cal.events).toHaveLength(2);
  });

  it("refuses times off the grid, outside hours or too soon", () => {
    const cases: [string, string][] = [["2026-10-13T12:10", "off_grid"], ["2026-10-13T18:30", "outside_hours"], ["2026-10-12T11:00", "too_soon"], ["2026-10-18T12:00", "outside_hours"]];
    for (const [slot, error] of cases) expect(out(book({ slot_start: slot }, `c-${slot}`)).error).toBe(error);
  });

  it("treats a calendar event with no specialist as closing the time for everyone", () => {
    cal.events.push({ id: "manual1", status: "confirmed", summary: "Санитарный день", start: { dateTime: "2026-10-16T06:00:00Z" }, end: { dateTime: "2026-10-16T16:00:00Z" } });
    const o = out(call(cfg, cal, vapi("check_availability", { service_id: "haircut", date: "2026-10-16" })));
    expect(o.available).toBe(false);
  });

  it("shows a caller only their own bookings", () => {
    expect(out(call(cfg, cal, vapi("find_booking", { customer_phone: "0501112233" }))).bookings).toHaveLength(1);
    expect(out(call(cfg, cal, vapi("find_booking", { customer_phone: "+380990000000" }))).bookings).toHaveLength(0);
  });

  it("does not let another number, or another booking id, change a booking", () => {
    const stranger = call(cfg, cal, vapi("cancel_booking", { booking_id: mine(), customer_phone: CALLER }, "+380990000000"));
    expect(out(stranger).error).toBe("caller_mismatch");
    expect(stranger.plan.needs_calendar).toBe(false);
    const other = cal.events.find((e) => e.extendedProperties?.private.phone === "+380670000001")!.id;
    expect(out(call(cfg, cal, vapi("cancel_booking", { booking_id: other, customer_phone: CALLER }))).error).toBe("booking_not_found");
  });

  it("moves a booking, and keeps the old time when the new one is taken", () => {
    const id = mine();
    expect(out(call(cfg, cal, vapi("reschedule_booking", { booking_id: id, customer_phone: CALLER, new_slot_start: "2026-10-16T12:00" }))).ok).toBe(false);
    expect(cal.events.find((e) => e.id === id)!.start.dateTime).toBe("2026-10-12T09:00:00.000Z");
    const moved = out(call(cfg, cal, vapi("reschedule_booking", { booking_id: id, customer_phone: CALLER, new_slot_start: "2026-10-13T15:00" })));
    expect(moved.ok).toBe(true);
    expect(cal.events.find((e) => e.id === id)!.start.dateTime).toBe("2026-10-13T12:00:00.000Z");
  });

  it("cancels, and flags a late cancellation", () => {
    const id = mine();
    const o = out(call({ ...cfg, now_override: "2026-10-13T00:00:00Z" }, cal, vapi("cancel_booking", { booking_id: id, customer_phone: CALLER })));
    expect(o).toMatchObject({ ok: true, late_cancellation: true });
    expect(cal.events.find((e) => e.id === id)!.status).toBe("cancelled");
  });

  it("sends a callback request to staff without touching the calendar", () => {
    const r = call(cfg, cal, vapi("request_callback", { customer_name: "Ира", customer_phone: CALLER, topic: "жалоба", urgency: "сегодня" }));
    expect(out(r).ok).toBe(true);
    expect(r.plan.needs_calendar).toBe(false);
    expect(r.notes[0]).toMatch(/жалоба[\s\S]*Срочность: сегодня/);
  });

  it("never invents a result when the calendar is down", () => {
    const r = call(cfg, cal, vapi("check_availability", { service_id: "haircut", date: "2026-10-13" }), { failRead: true });
    expect(out(r).error).toBe("tool_unavailable");
    expect(out(r).slots).toBeUndefined();
    expect(r.notes[0]).toMatch(/Сбой инструмента/);
  });

  it("understands Retell, ElevenLabs and stringified arguments", () => {
    const retell = call(cfg, cal, { name: "check_availability", args: { service_id: "haircut", date: "2026-10-13" }, call: { call_id: "r1", from_number: CALLER, direction: "inbound" } });
    expect(retell.parsed.provider).toBe("retell");
    expect(retell.response.available).toBe(true);
    const eleven = call(cfg, cal, { service_id: "haircut", date: "2026-10-13", conversation_id: "e1" }, { query: { tool: "check_availability" } });
    expect(eleven.parsed).toMatchObject({ provider: "elevenlabs", call_id: "e1" });
    expect(eleven.response.available).toBe(true);
    expect(out(call(cfg, cal, vapi("check_availability", '{"service_id":"haircut","date":"2026-10-13"}'))).available).toBe(true);
  });

  it("keeps the day and hour across a clock change", () => {
    const autumn = { ...cfg, now_override: "2026-10-23T07:00:00Z", closed_dates: [] };
    const o = out(call(autumn, new Calendar(), vapi("check_availability", { service_id: "haircut", date: "2026-10-26", part_of_day: "morning" })));
    expect(o.slots[0].slot_start).toBe("2026-10-26T09:00");
  });
});

describe.each(KITS)("workflows of %s", (slug) => {
  const tools = workflowOf(slug);

  it("run the same logic as the tested kit, differing only in Config", () => {
    const own = codeOf(tools);
    for (const name of Object.keys(code)) if (name !== "Config") expect(own[name], name).toBe(code[name]);
  });

  it("have a Config that parses and names every service and specialist the tools describe", () => {
    const config = new Function(codeOf(tools).Config)()[0].json as J;
    const schema = JSON.parse(readFileSync(path.join(process.cwd(), "content/products", slug, "tools/tools.schema.json"), "utf8")) as J[];
    expect(schema.map((tool) => tool.name)).toEqual(["check_availability", "create_booking", "find_booking", "reschedule_booking", "cancel_booking", "request_callback"]);
    const described = schema[0].parameters.properties.service_id.description as string;
    for (const service of config.services) expect(described, service.id).toContain(service.id);
    for (const service of config.services) for (const id of service.staff ?? []) expect(config.staff.map((p: J) => p.id), `${service.id}: ${id}`).toContain(id);
    for (const key of config.required_details) expect(schema[1].parameters.required, key).toContain(key);
  });

  it("protect the webhook, change the calendar in one place only, and carry no credentials", () => {
    for (const file of ["booking-tools", "call-summary", "error-alert"]) {
      const workflow = workflowOf(slug, file);
      for (const node of workflow.nodes as J[]) {
        if (node.type.endsWith(".webhook")) expect(node.parameters.authentication, `${file}: ${node.name}`).toBe("headerAuth");
        for (const credential of Object.values(node.credentials ?? {}) as J[]) expect(credential.id).toBe("REPLACE_ME");
      }
      expect(workflow.pinData).toEqual({});
    }
    const writers = (tools.nodes as J[]).filter((node) => node.type.endsWith(".httpRequest") && node.parameters.method !== "GET");
    expect(writers.map((node) => node.name)).toEqual(["Calendar Write"]);
    expect(tools.settings.saveDataSuccessExecution).toBe("none");
  });

  it("ships 30 test calls and says so", () => {
    const calls = readFileSync(path.join(process.cwd(), "content/products", slug, "tests/test-calls.csv"), "utf8").trim().split("\n");
    expect(calls.length - 1).toBe(30);
  });
});
