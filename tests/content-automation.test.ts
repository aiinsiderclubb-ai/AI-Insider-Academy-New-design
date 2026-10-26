import { describe, expect, it } from "vitest";
import { codeNodes, configOf, credentialsArePlaceholders, runCode, Sheets, workflow, type J } from "./helpers/n8n-kit";

/**
 * The content kit promises a weekly plan without duplicates, drafts that wait
 * for a person, publishing on time and never twice, and no late posts after
 * downtime. These tests run the shipped Code nodes against an in-memory
 * Google Sheets.
 */
const SLUG = "content-automation-workflow";
const code: Record<string, string> = {
  ...codeNodes(workflow(SLUG, "content-weekly-plan")),
  ...codeNodes(workflow(SLUG, "content-drafts")),
  ...codeNodes(workflow(SLUG, "content-approvals")),
  ...codeNodes(workflow(SLUG, "content-publisher")),
};
const NOW = "2026-10-26T08:00:00Z"; // Monday 10:00 in Kyiv
const cfg: J = {
  ...configOf(workflow(SLUG, "content-drafts")),
  ...configOf(workflow(SLUG, "content-publisher")),
  slots: configOf(workflow(SLUG, "content-weekly-plan")).slots,
  now_override: NOW,
  spreadsheet_id: "c1",
  approval_chat_id: "-700",
};
cfg.channels = {
  telegram: { ...cfg.channels.telegram, chat_id: "@remontpro", link_base: "https://t.me/remontpro" },
  blog: { ...cfg.channels.blog, url: "https://remont.example" },
  linkedin: { ...cfg.channels.linkedin, url: "https://hook.example/abc" },
};
const llm = (o: J) => ({ choices: [{ message: { content: JSON.stringify(o) } }] });

describe("Content Automation kit", () => {
  const sheets = new Sheets();
  const read = () => sheets.handle({ method: "GET", url: `https://x/v4/spreadsheets/c1/values/${encodeURIComponent("'Plan'!A1:Q")}` });
  const post = (id: string): J => {
    const t = sheets.tab("Plan");
    const r = t.find((x) => x[0] === id) ?? [];
    return Object.fromEntries(t[0].map((h, i) => [h, r[i] ?? ""]));
  };
  const at = (now: string) => ({ ...cfg, now_override: now });

  it("plans next week's free slots once, in Kyiv time, and defuses formulas", () => {
    const week = runCode(code["Plan Week"], { Config: cfg }, read())[0];
    expect(week.slots.map((s: J) => `${s.publish_at} ${s.channel}`)).toEqual([
      "2026-10-28 10:00 telegram",
      "2026-10-29 09:00 linkedin",
      "2026-10-30 18:00 telegram",
      "2026-10-31 11:00 blog",
      "2026-11-02 10:00 telegram",
    ]);
    const ideas = week.slots.map((_: J, i: number) => ({ topic: i === 1 ? "=SUM(1)" : `Тема ${i}`, brief: "бриф" }));
    const add = runCode(code["Add Ideas"], { Config: cfg, "Plan Week": week }, llm({ ideas }))[0];
    sheets.handle(add.http);
    expect(sheets.tab("Plan")[0][0]).toBe("id");
    expect(sheets.tab("Plan")[2][3]).toBe("'=SUM(1)");
    expect(runCode(code["Plan Week"], { Config: cfg }, read())[0].plan).toBe(false);
  });

  it("drafts only what is due within two days and sends it for approval with an id", () => {
    sheets.tabs.Plan.push(["", "2026-10-26 15:00", "telegram", "Ошибки при приёмке", "пять пунктов", "", "", "idea"]);
    sheets.tabs.Plan.push(["", "2026-10-27 12:00", "tiktok", "Тренд", "", "", "", "idea"]);
    const pick = runCode(code["Pick Idea"], { Config: cfg }, read())[0];
    expect(pick.post.topic).toBe("Ошибки при приёмке");
    expect(pick.fix_text).toContain("tiktok");
    sheets.handle(pick.fix_http);
    expect(pick.llm_request.messages[0].content).toContain("Не выдумывай факты");
    const saved = runCode(code["Save Draft"], { Config: cfg, "Pick Idea": pick }, llm({ title: "Приёмка", text: "Пять ошибок…" }))[0];
    sheets.handle(saved.http);
    expect(saved.send_for_approval).toBe(true);
    expect(saved.text).toMatch(new RegExp(`ID: ${pick.id}$`));
    expect(post(pick.id)).toMatchObject({ status: "draft_ready", draft: "Пять ошибок…" });
  });

  it("approves by button, rewrites with the editor's note, and ignores other chats", () => {
    const id = sheets.tab("Plan").find((r) => r[3] === "Ошибки при приёмке")![0];
    const act = (update: J) => {
      const out = runCode(code["Act on Draft"], { Config: cfg, "Telegram Trigger": update }, read())[0];
      if (out.write) sheets.handle(out.http);
      return out;
    };
    act({ message: { chat: { id: -700 }, from: { first_name: "Олег" }, text: "Переписать: короче", reply_to_message: { text: `…\nID: ${id}` } } });
    expect(post(id)).toMatchObject({ status: "idea", notes: "короче" });
    const again = runCode(code["Pick Idea"], { Config: cfg }, read())[0];
    expect(JSON.parse(again.llm_request.messages[1].content)).toMatchObject({ rejected_draft: "Пять ошибок…", editor_notes: "короче" });
    sheets.handle(runCode(code["Save Draft"], { Config: cfg, "Pick Idea": again }, llm({ title: "t", text: "Коротко." }))[0].http);
    expect(act({ callback_query: { id: "c", data: `ok:${id}`, from: { first_name: "Аня" }, message: { chat: { id: 1 } } } }).act).toBe(false);
    act({ callback_query: { id: "c", data: `ok:${id}`, from: { first_name: "Аня" }, message: { chat: { id: -700 } } } });
    expect(post(id)).toMatchObject({ status: "approved", final: "Коротко.", approved_by: "Аня" });
  });

  it("publishes on time, marks the post before sending, and never publishes late", () => {
    const id = sheets.tab("Plan").find((r) => r[3] === "Ошибки при приёмке")![0];
    expect(runCode(code["Pick Due"], { Config: cfg }, read())[0].kind).toBe("none");
    const due = runCode(code["Pick Due"], { Config: at("2026-10-26T13:01:00Z") }, read())[0];
    expect(due).toMatchObject({ kind: "telegram", id, telegram: { chat: "@remontpro", text: "Коротко." } });
    sheets.handle(due.lock_http);
    expect(post(id).status).toBe("publishing");
    expect(runCode(code["Pick Due"], { Config: at("2026-10-26T13:02:00Z") }, read())[0].kind).toBe("none");
    sheets.handle(runCode(code["Record Result"], { Config: cfg, "Pick Due": due }, { ok: true, result: { message_id: 12 } })[0].http);
    expect(post(id)).toMatchObject({ status: "published", link: "https://t.me/remontpro/12" });
    sheets.tabs.Plan.push(["old", "2026-10-25 09:00", "telegram", "Старое", "", "", "", "approved", "", "", "текст"]);
    const late = runCode(code["Pick Due"], { Config: at("2026-10-26T13:05:00Z") }, read())[0];
    expect(late.kind).toBe("none");
    expect(late.fix_text).toMatch(/прошло больше 12 ч/);
  });

  it("turns blog Markdown into HTML and records a refused publish with its reason", () => {
    sheets.tabs.Plan.push(["b1", "2026-10-26 15:10", "blog", "Плитка", "", "", "", "approved", "Как выбрать плитку", "", "## Размер\n\n- **класс**\n- цвет"]);
    const due = runCode(code["Pick Due"], { Config: at("2026-10-26T13:20:00Z") }, read())[0];
    expect(due.request).toMatchObject({ url: "https://remont.example/wp-json/wp/v2/posts", body: { title: "Как выбрать плитку", content: "<h2>Размер</h2>\n<ul><li><strong>класс</strong></li><li>цвет</li></ul>", status: "draft" } });
    const out = runCode(code["Record Result"], { Config: cfg, "Pick Due": due }, { error: { message: "401 - Sorry, you are not allowed to create posts" } })[0];
    sheets.handle(out.http);
    expect(post("b1")).toMatchObject({ status: "failed", error: "401 - Sorry, you are not allowed to create posts" });
    expect(out.notify).toBe(true);
  });

  it("ships placeholder credentials and nothing pinned", () => {
    for (const name of ["content-weekly-plan", "content-drafts", "content-approvals", "content-publisher", "error-alert"]) {
      const flow = workflow(SLUG, name);
      expect(credentialsArePlaceholders(flow), name).toBe(true);
      expect(flow.pinData, name).toEqual({});
    }
  });
});
