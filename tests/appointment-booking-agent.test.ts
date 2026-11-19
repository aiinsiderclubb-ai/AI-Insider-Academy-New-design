import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { codeNodes, credentialsArePlaceholders, runCode, workflow, type J } from "./helpers/n8n-kit";

const SLUG = "appointment-booking-agent";
const flow = workflow(SLUG, SLUG);
const code = codeNodes(flow);
const dir = path.join(process.cwd(), "content/products", SLUG);
const config: J = runCode(code.Config, {}, {})[0].config;
// Monday 2026-11-16 08:00 in Kyiv (UTC+2)
const NOW = "2026-11-16T06:00:00Z";
const cfg: J = { ...config, now_override: NOW };

const plan = (input: J) => runCode(code.Plan, { Config: { config: cfg, input } }, {})[0];
function decide(input: J, items: J[] = []): J {
  const p = plan(input);
  if (!p.needs_calendar) return { ...p, plan: p };
  return { ...runCode(code.Decide, { Config: { config: cfg, input }, Plan: p }, { items })[0], plan: p };
}
const event = (id: string, startIso: string, minutes: number, priv: J = {}) => ({
  id, status: "confirmed", summary: "x",
  start: { dateTime: startIso }, end: { dateTime: new Date(Date.parse(startIso) + minutes * 60000).toISOString() },
  extendedProperties: { private: priv },
});
const book = (extra: J = {}) => ({
  tool: "book_appointment", service_id: "consultation", slot_start: "2026-11-17T10:00", name: "Анна", email: "anna@example.com",
  session_id: "web:s1", channel: "web", last_message: "Да, подтверждаю", ...extra,
});

describe("confirmation", () => {
  it("books only after a plain yes", () => {
    for (const yes of ["Да", "да, подтверждаю", "Ок", "Yes please", "Подходит!"]) expect(plan(book({ last_message: yes })).needs_calendar, yes).toBe(true);
    for (const no of ["Запишите меня на 10", "Да, но лучше в 11", "Нет", "а можно позже?", "Давайте другое время", ""]) {
      expect(plan(book({ last_message: no })).result?.error, no).toBe("not_confirmed");
    }
  });

  it("asks for a contact on the site but not in Telegram", () => {
    expect(plan(book({ email: "", phone: "" })).result.error).toBe("no_contact");
    expect(plan(book({ email: "", phone: "", channel: "telegram" })).needs_calendar).toBe(true);
    expect(plan(book({ email: "not-an-email" })).result.error).toBe("bad_email");
  });

  it("needs a code and a yes to cancel", () => {
    expect(plan({ tool: "cancel_booking", booking_code: "", last_message: "да" }).result.error).toBe("no_code");
    expect(plan({ tool: "cancel_booking", booking_code: "ABC234", last_message: "отмените" }).result.error).toBe("not_confirmed");
    expect(plan({ tool: "find_booking", booking_code: "abc-234", last_message: "" }).http.url).toContain("privateExtendedProperty=code%3DABC234");
  });
});

describe("availability", () => {
  const avail = (extra: J, items: J[] = []) => decide({ tool: "check_availability", service_id: "consultation", date: "2026-11-17", part_of_day: "any", ...extra }, items).result;

  it("offers slots inside working hours on the grid", () => {
    const r = avail({});
    expect(r.available).toBe(true);
    for (const s of r.slots) {
      const [h, m] = s.slot_start.slice(11).split(":").map(Number);
      expect(h * 60 + m).toBeGreaterThanOrEqual(9 * 60);
      expect(h * 60 + m + 60).toBeLessThanOrEqual(18 * 60);
      expect(m % 30).toBe(0);
    }
  });

  it("keeps the buffer around a busy meeting", () => {
    // busy 10:00–11:00 Kyiv; with 15 minutes of buffer a 60-minute meeting cannot start 9:00, 9:30, 10:x or 11:00
    const r = avail({ part_of_day: "morning" }, [event("e1", "2026-11-17T08:00:00Z", 60)]);
    const starts = r.slots.map((s: J) => s.slot_start.slice(11));
    for (const t of ["09:00", "09:30", "10:00", "10:30", "11:00"]) expect(starts).not.toContain(t);
  });

  it("moves to the next open day when the day is closed", () => {
    const r = avail({ date: "2026-11-21" }); // Saturday
    expect(r.available).toBe(false);
    expect(r.slots[0].slot_start.startsWith("2026-11-23")).toBe(true);
  });

  it("shows the client's own time when the time zone differs", () => {
    const r = avail({ client_timezone: "Europe/Warsaw" });
    expect(r.slots[0].client_time).toBeTruthy();
    expect(avail({ client_timezone: "Not/AZone" }).slots[0].client_time).toBeUndefined();
  });

  it("understands relative dates and refuses the past", () => {
    expect(plan({ tool: "check_availability", service_id: "consultation", date: "tomorrow" }).date).toBe("2026-11-17");
    expect(plan({ tool: "check_availability", service_id: "consultation", date: "fri" }).date).toBe("2026-11-20");
    expect(plan({ tool: "check_availability", service_id: "consultation", date: "2026-11-01" }).result.error).toBe("date_in_past");
    expect(plan({ tool: "check_availability", service_id: "nope", date: "tomorrow" }).result.error).toBe("unknown_service");
  });
});

describe("booking", () => {
  it("writes an event with a code and the customer as a guest", () => {
    const d = decide(book());
    expect(d.needs_write).toBe(true);
    expect(d.http.url).toContain("sendUpdates=all");
    const priv = d.http.body.extendedProperties.private;
    expect(priv.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(d.on_success.expose.booking_code).toBe(priv.code);
    expect(d.http.body.attendees[0].email).toBe("anna@example.com");
  });

  it("gives the same id for a retried call and does not book twice", () => {
    const first = decide(book());
    const again = decide(book(), [{ ...first.http.body, status: "confirmed" }]);
    expect(again.needs_write).toBe(false);
    expect(again.result.booking_code).toBe(first.http.body.extendedProperties.private.code);
  });

  it("re-checks the calendar before writing", () => {
    const r = decide(book(), [event("other", "2026-11-17T08:30:00Z", 30)]).result;
    expect(r.error).toBe("slot_taken");
    expect(r.slots.length).toBeGreaterThan(0);
  });

  it("refuses times off the grid and outside hours", () => {
    expect(decide(book({ slot_start: "2026-11-17T10:10" })).result.error).toBe("off_grid");
    expect(decide(book({ slot_start: "2026-11-17T17:30" })).result.error).toBe("outside_hours");
    expect(decide(book({ slot_start: "2026-11-16T09:00" })).result.error).toBe("too_soon");
  });

  it("moves a booking without colliding with itself", () => {
    const own = event("mine", "2026-11-17T08:00:00Z", 60, { code: "ABC234", service_id: "consultation" });
    const d = decide({ tool: "reschedule_booking", booking_code: "abc234", new_slot_start: "2026-11-17T10:30", last_message: "да" }, [own]);
    expect(d.needs_write).toBe(true);
    expect(d.http.method).toBe("PATCH");
    expect(d.http.body.extendedProperties.private.reminded).toBe("");
  });

  it("reports a calendar outage instead of guessing", () => {
    const p = plan(book());
    const r = runCode(code.Decide, { Config: { config: cfg, input: book() }, Plan: p }, { error: { message: "401 invalid_grant" } })[0].result;
    expect(r.service_error).toContain("401");
  });
});

describe("reminders", () => {
  const tick = (items: J[]) => runCode(code["Pick Due"], { Config: { config: cfg } }, { items });
  const ours = (start: string, priv: J = {}) => event("r1", start, 30, { source: "chat-agent", code: "ABC234", channel: "telegram", chat_id: "42", ...priv });

  it("sends one reminder and marks every interval already due", () => {
    const due = tick([ours("2026-11-16T07:00:00Z")]); // in one hour
    expect(due).toHaveLength(1);
    expect(due[0].via).toBe("telegram");
    expect(due[0].patch.body.extendedProperties.private.reminded).toBe("h24,h2");
    expect(due[0].text).toContain("ABC234");
  });

  it("skips what was sent, the past and other events", () => {
    expect(tick([ours("2026-11-16T07:00:00Z", { reminded: "h24,h2" })])).toHaveLength(0);
    expect(tick([ours("2026-11-16T05:00:00Z")])).toHaveLength(0);
    expect(tick([ours("2026-11-16T07:00:00Z", { source: "manual" })])).toHaveLength(0);
  });

  it("uses email only when it is switched on", () => {
    const web = ours("2026-11-16T20:00:00Z", { channel: "web", chat_id: "", email: "a@b.co" });
    expect(tick([web])[0].via).toBe("none");
    const on = runCode(code["Pick Due"], { Config: { config: { ...cfg, email_reminders: true } } }, { items: [web] });
    expect(on[0].via).toBe("email");
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
