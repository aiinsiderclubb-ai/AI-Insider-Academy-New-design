import { describe, expect, it } from "vitest";
import { codeNodes, configOf, credentialsArePlaceholders, runCode, Sheets, workflow, type J } from "./helpers/n8n-kit";

/**
 * The CRM kit promises one deal per client, a fair owner, a next step that
 * lands in working hours, stage changes from Telegram, reminders that fire
 * once, and a weekly report that adds up. These tests run the shipped Code
 * nodes against an in-memory Google Sheets.
 */
const SLUG = "crm-automation-kit";
const code: Record<string, string> = {
  ...codeNodes(workflow(SLUG, "crm-intake")),
  ...codeNodes(workflow(SLUG, "crm-telegram")),
  ...codeNodes(workflow(SLUG, "crm-reminders")),
  ...codeNodes(workflow(SLUG, "crm-weekly-report")),
};
const NOW = "2026-10-26T08:00:00Z"; // Monday 10:00 in Kyiv
const cfg: J = {
  ...configOf(workflow(SLUG, "crm-intake")),
  ...configOf(workflow(SLUG, "crm-telegram")),
  ...configOf(workflow(SLUG, "crm-reminders")),
  now_override: NOW,
  spreadsheet_id: "crm1",
  team_chat_id: "-800",
  intake_token: "tok_1",
  owners: [{ name: "Олег", chat_id: "101", active: true }, { name: "Аня", chat_id: "102", active: true }, { name: "Ира", chat_id: "103", active: false }],
};
const at = (now: string) => ({ ...cfg, now_override: now });

const press = (data: string, chat = 101) => ({ callback_query: { id: "c", data, from: { first_name: "Олег" }, message: { chat: { id: chat } } } });
const reply = (text: string, id: string, chat = 101) => ({ message: { chat: { id: chat }, from: { first_name: "Олег" }, text, reply_to_message: { text: `…\nID: ${id}` } } });

describe("CRM Automation kit", () => {
  const sheets = new Sheets();
  const read = () => sheets.handle({ method: "GET", url: `https://x/v4/spreadsheets/crm1/values/${encodeURIComponent("'Deals'!A1:V")}` });
  const deal = (id: string): J => {
    const t = sheets.tab("Deals");
    const r = t.find((x) => x[0] === id) ?? [];
    return Object.fromEntries(t[0].map((h, i) => [h, r[i] ?? ""]));
  };
  const lead = (body: J, config: J = cfg) => {
    const out = runCode(code.Intake, { Config: config, "CRM Webhook": { body: { token: "tok_1", ...body }, headers: {}, query: {} } }, read())[0];
    if (out.http) sheets.handle(out.http);
    return out;
  };
  const tg = (update: J, config: J = cfg) => {
    const out = runCode(code["Deal Actions"], { Config: config, "Telegram Trigger": update }, read())[0];
    if (out.write) sheets.handle(out.http);
    return out;
  };

  it("refuses a wrong token and a lead without contacts, and answers Tilda's test without writing", () => {
    expect(lead({ phone: "0671234567", token: "x" }).status).toBe(403);
    expect(lead({ name: "Без связи" }).status).toBe(422);
    expect(lead({ test: "test" }).response).toEqual({ ok: true, test: true });
    expect(sheets.tab("Deals")).toHaveLength(0);
  });

  it("turns a form into a deal with a clean phone, an owner and a first step", () => {
    const r = lead({ Name: "Ирина", Phone: "067 123 45 67", Comments: "Нужен сайт", budget: "3000", source: "tilda" });
    expect(r.response).toEqual({ ok: true, id: "D261026-1", duplicate: false });
    expect(deal("D261026-1")).toMatchObject({ phone: "+380671234567", owner: "Олег", stage: "new", next_action_at: "2026-10-26 10:30", amount: "3000" });
    expect(r.owner_text).toMatch(/ID: D261026-1$/);
    expect(lead({ name: "Пётр", email: "petr@x.io" }).deal.owner).toBe("Аня");
    expect(lead({ name: "Вечер", email: "late@x.io" }, at("2026-10-30T17:50:00Z")).deal.next_action_at).toBe("2026-11-02 09:00");
  });

  it("keeps one open deal per client and gives a returning client to the same owner", () => {
    const again = lead({ phone: "+380671234567", message: "Ещё вопрос" });
    expect(again).toMatchObject({ kind: "repeat_open", id: "D261026-1" });
    tg(press("st:won:D261026-1"));
    const back = lead({ phone: "0671234567", message: "Ещё один сайт" });
    expect(back.deal).toMatchObject({ owner: "Олег", repeat: "yes", name: "Ирина" });
  });

  it("moves stages by button and understands replies", () => {
    const r = tg(press("st:contacted:D261026-2", 102));
    expect(r.reply_text).toContain("2026-10-28 10:00");
    tg(reply("напомнить: завтра 15:00 перезвонить", "D261026-2", 102));
    expect(deal("D261026-2")).toMatchObject({ next_action: "перезвонить", next_action_at: "2026-10-27 15:00" });
    tg(reply("сумма: 4 000", "D261026-2", 102));
    tg(reply("причина: дорого", "D261026-2", 102));
    expect(deal("D261026-2")).toMatchObject({ amount: "4 000", stage: "lost", lost_reason: "дорого" });
    expect(tg(reply("hi", "D261026-2", 999)).act).toBe(false);
    expect(tg({ message: { chat: { id: 999 }, from: {}, text: "/start" } }).reply_text).toContain("Ваш chat id: 999");
  });

  it("reminds once in working hours and escalates a deal nobody took", () => {
    expect(runCode(code["Find Due"], { Config: at("2026-10-26T19:00:00Z") }, read())[0].reason).toBe("outside_hours");
    const out = runCode(code["Find Due"], { Config: at("2026-10-27T08:05:00Z") }, read());
    expect(out.map((o) => o.chat)).toEqual(["-800", "101"]);
    expect(out[1].text).toMatch(/^Напоминание: Позвонить клиенту · D261026-3/);
    sheets.handle(out[0].http);
    expect(runCode(code["Find Due"], { Config: at("2026-10-27T08:20:00Z") }, read())[0].reason).toBe("nothing");
  });

  it("reports the week: won with sums, conversion, reasons, owners", () => {
    const r = runCode(code["Build Report"], { Config: at("2026-10-30T07:00:00Z") }, read())[0];
    expect(r.text).toContain("Выиграно: 1 на 3 000 €");
    expect(r.text).toContain("конверсия закрытых: 50%");
    expect(r.text).toContain("• дорого: 1");
    expect(r.text).not.toContain("Ира");
  });

  it("ships placeholder credentials and nothing pinned", () => {
    for (const name of ["crm-intake", "crm-telegram", "crm-reminders", "crm-weekly-report", "error-alert"]) {
      const flow = workflow(SLUG, name);
      expect(credentialsArePlaceholders(flow), name).toBe(true);
      expect(flow.pinData, name).toEqual({});
    }
  });
});
