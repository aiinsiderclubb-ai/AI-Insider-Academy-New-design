import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bundledFor } from "@/content/downloadables";
import { codeNodes, credentialsArePlaceholders, runCode, Sheets, workflow, type J } from "./helpers/n8n-kit";

/**
 * The migration system promises an audit tool that reads real exports and an
 * honest estimate, a parallel-run check that tells matching results from real
 * differences, and a monitor that reports each failure once. The tool runs on
 * the shipped examples; the Code nodes run against an in-memory Google Sheets.
 */
const SLUG = "zapier-to-n8n-migration-system";
const code: Record<string, string> = {
  ...codeNodes(workflow(SLUG, "n8n-monitor")),
  ...codeNodes(workflow(SLUG, "parallel-run-log")),
  ...codeNodes(workflow(SLUG, "parallel-run-check")),
};
const cfg: J = {
  timezone: "Europe/Kyiv", locale: "ru-RU", now_override: "2026-10-26T08:30:00Z", client_name: "Студия", n8n_url: "https://n8n.example.com",
  alert_chat_id: "-900", check_every_minutes: 60, digest_hour: 18, watch_workflow_ids: [], ignore_workflow_ids: [], must_be_active: ["w2"],
  sheets_api_base: "https://sheets.googleapis.com/v4", spreadsheet_id: "pr1", runs_sheet: "ParallelRun", token: "tok", wait_minutes: 30, report_hour: 10,
  ready_days: 3, ready_min_events: 1, ignore_fields: ["id"], compare: {},
};

describe("Zapier → n8n Migration System", () => {
  it("audits the shipped Make, Zapier and CSV examples into an inventory, a map and an estimate", () => {
    try {
      execFileSync("python3", ["--version"]);
    } catch {
      return;
    }
    const dir = mkdtempSync(path.join(tmpdir(), "migration-"));
    for (const file of bundledFor(SLUG).filter((f) => f.path.startsWith("tools/"))) {
      mkdirSync(path.dirname(path.join(dir, file.path)), { recursive: true });
      writeFileSync(path.join(dir, file.path), file.body);
    }
    const out = path.join(dir, "out");
    const said = execFileSync("python3", ["-I", path.join(dir, "tools/migration_audit.py"), path.join(dir, "tools/examples"), "--out", out, "--rate", "50", "--client", "Тест"], { encoding: "utf8" });
    expect(said).toContain("8 автоматизаций, 57.5 ч");
    const audit = readFileSync(path.join(out, "audit.md"), "utf8");
    expect(audit).toContain("Zapier: 5, Make: 3");
    expect(audit).toContain("**Email by Zapier** (partial)");
    expect(audit).not.toMatch(/- \[ \] (Digest|Storage|Make Data store|Webhooks)/);
    const inventory = readFileSync(path.join(out, "inventory.csv"), "utf8");
    expect(inventory).toMatch(/Заказы Shopify[^\n]*,7,1,2,0,,сложная,10\.5,Make Data store/);
    expect(readFileSync(path.join(dir, "tools/example-output/audit.md"), "utf8")).toBe(audit.replace("Тест", "Пример: студия"));
  });

  it("monitors: failures once per workflow with a link, a switched-off workflow once", () => {
    const nodes: J = { Config: cfg, "Read Workflows": { data: [{ id: "w1", name: "Заявки", active: true }, { id: "w2", name: "Счета", active: false }] } };
    const failed = { data: [{ id: "e1", workflowId: "w1", startedAt: "2026-10-26T08:10:00Z", stoppedAt: "2026-10-26T08:10:00Z" }] };
    const first = runCode(code["Check Health"], nodes, failed);
    expect(first.map((m) => m.kind)).toEqual(["errors", "inactive"]);
    expect(first[0].text).toContain("https://n8n.example.com/workflow/w1/executions/e1");
    expect(runCode(code["Check Health"], { ...nodes, Config: { ...cfg, now_override: "2026-10-26T09:30:00Z" }, $static: nodes.$static }, failed)).toEqual([{ send: false }]);
  });

  it("compares both sides after normalisation and flags one-sided events", () => {
    const sheets = new Sheets();
    const read = () => sheets.handle({ method: "GET", url: `https://x/v4/spreadsheets/pr1/values/${encodeURIComponent("'ParallelRun'!A1:I")}` });
    const log = (body: J, now = cfg.now_override) => {
      const out = runCode(code["Record Run"], { Config: { ...cfg, now_override: now }, "Shadow Log": { body: { token: "tok", ...body }, headers: {}, query: {} } }, read())[0];
      if (out.http) sheets.handle(out.http);
      return out;
    };
    log({ flow: "Заявки", key: "1", system: "old", result: { email: "A@B.co", sum: "10.0", id: "z" } });
    expect(log({ flow: "Заявки", key: "1", system: "new", result: { email: "a@b.co", sum: 10, id: "n" } }).response.status).toBe("match");
    log({ flow: "Заявки", key: "2", system: "old", result: { owner: "Аня" } });
    const diff = log({ flow: "Заявки", key: "2", system: "new", result: { owner: "Олег" } });
    expect(diff).toMatchObject({ alert: true, response: { status: "mismatch" } });
    expect(diff.text).toContain("owner: Аня → Олег");
    log({ flow: "Счета", key: "s", system: "old", result: {} }, "2026-10-26T07:00:00Z");
    const check = runCode(code["Check Runs"], { Config: cfg }, read());
    expect(check[0].text).toContain("Счета · s — нет данных от n8n");
    expect(check[1].text).toMatch(/• Заявки: 2 события, совпало 50%, расхождений 1 — рано/);
  });

  it("ships placeholder credentials and nothing pinned", () => {
    for (const name of ["n8n-monitor", "parallel-run-log", "parallel-run-check", "error-alert"]) {
      const flow = workflow(SLUG, name);
      expect(credentialsArePlaceholders(flow), name).toBe(true);
      expect(flow.pinData, name).toEqual({});
    }
  });
});
