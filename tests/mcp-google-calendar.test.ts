import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = Record<string, any>;
const ROOT = path.join(process.cwd(), "content/products");
const KIT = path.join(process.cwd(), "scripts/agent-kits/mcp");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const json = (...p: string[]): J => JSON.parse(read(...p));

function hasPython(): boolean {
  try {
    execFileSync("python3", ["-c", "import zoneinfo"]);
    return true;
  } catch {
    return false;
  }
}

/** Starts the server over stdio, sends JSON-RPC lines, returns the replies by id. */
function mcp(server: string, config: J, calls: J[], env: J = {}): Record<number, J> {
  const dir = mkdtempSync(path.join(tmpdir(), "mcp-test-"));
  const cfg = path.join(dir, "config.json");
  writeFileSync(cfg, JSON.stringify(config));
  const lines = [
    { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "vitest", version: "1" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    ...calls.map((c, i) => ({ jsonrpc: "2.0", id: i + 1, ...c })),
  ];
  const out = spawnSync("python3", [server, "--config", cfg], {
    input: lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
    env: { ...process.env, TELEGRAM_BOT_TOKEN: "", NOTION_TOKEN: "", GOOGLE_REFRESH_TOKEN: "", ...env },
    encoding: "utf8",
    timeout: 20000,
  });
  const replies: Record<number, J> = {};
  for (const line of out.stdout.split("\n").filter(Boolean)) {
    const msg = JSON.parse(line);
    replies[msg.id] = msg;
  }
  return replies;
}

const SLUG = "mcp-google-calendar";
const SERVER = path.join(ROOT, SLUG, "server/calendar_mcp.py");

describe("MCP: Google Calendar", { timeout: 30000 }, () => {
  it("ships the same server files the tests ran", () => {
    for (const f of ["calendar_mcp.py", "get_refresh_token.py", "mcp_lite.py"]) {
      expect(read(SLUG, "server", f), f).toBe(readFileSync(path.join(KIT, f), "utf8"));
    }
  });

  it("only confirm_event writes; there is no delete or move", () => {
    if (!hasPython()) return;
    const r = mcp(SERVER, json(SLUG, "config/calendar.example.json"), [{ method: "tools/list" }]);
    const tools = Object.fromEntries(r[1].result.tools.map((t: J) => [t.name, t]));
    expect(Object.keys(tools).sort()).toEqual(["cancel_proposal", "confirm_event", "find_free_slots", "list_events", "propose_event"]);
    const writers = Object.values(tools).filter((t: any) => !t.annotations.readOnlyHint).map((t: any) => t.name).sort();
    expect(writers).toEqual(["cancel_proposal", "confirm_event"]);
    expect(tools.confirm_event.inputSchema.required).toEqual(["proposal_id", "user_reply"]);
    expect(r[0].result.instructions).toContain("Никогда не вызывай confirm_event");
  });

  it("refuses to confirm what was never proposed", () => {
    if (!hasPython()) return;
    const r = mcp(SERVER, json(SLUG, "config/calendar.example.json"), [
      { method: "tools/call", params: { name: "confirm_event", arguments: { proposal_id: "ABC123", user_reply: "да" } } },
    ]);
    expect(r[1].result.isError).toBe(true);
    expect(r[1].result.content[0].text).toContain("propose_event");
  });

  it("asks only for the two calendar scopes it needs", () => {
    const script = read(SLUG, "server/get_refresh_token.py");
    const scopes = /SCOPES = "([^"]+)"/.exec(script)![1].split(" ");
    expect(scopes.sort()).toEqual(["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"]);
    expect(script).toContain('"code_challenge_method": "S256"');
  });

  it("the example config has a workweek and a buffer", () => {
    const c = json(SLUG, "config/calendar.example.json");
    expect(c.working_hours.sat).toBeNull();
    expect(c.working_hours.mon).toEqual(["09:00", "18:00"]);
    expect(c.buffer_minutes).toBeGreaterThan(0);
  });
});
