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

const SLUG = "mcp-notion-workspace";
const SERVER = path.join(ROOT, SLUG, "server/notion_workspace_mcp.py");

describe("MCP: Notion Workspace", { timeout: 30000 }, () => {
  it("ships the same server and protocol files the tests ran", () => {
    expect(read(SLUG, "server/notion_workspace_mcp.py")).toBe(readFileSync(path.join(KIT, "notion_workspace_mcp.py"), "utf8"));
    expect(read(SLUG, "server/mcp_lite.py")).toBe(readFileSync(path.join(KIT, "mcp_lite.py"), "utf8"));
  });

  it("offers search, read, describe and one write — nothing that edits or deletes", () => {
    if (!hasPython()) return;
    const r = mcp(SERVER, json(SLUG, "config/notion.example.json"), [{ method: "tools/list" }]);
    const tools = Object.fromEntries(r[1].result.tools.map((t: J) => [t.name, t]));
    expect(Object.keys(tools).sort()).toEqual(["append_row", "describe_target", "read_page", "search_knowledge"]);
    for (const name of ["search_knowledge", "read_page", "describe_target"]) expect(tools[name].annotations.readOnlyHint).toBe(true);
    expect(tools.append_row.annotations.destructiveHint).toBe(false);
  });

  it("rejects unknown arguments before calling Notion", () => {
    if (!hasPython()) return;
    const r = mcp(SERVER, json(SLUG, "config/notion.example.json"), [
      { method: "tools/call", params: { name: "search_knowledge", arguments: { query: "x", workspace: "all" } } },
      { method: "tools/call", params: { name: "search_knowledge", arguments: { query: "доставка" } } },
    ]);
    expect(r[1].result.content[0].text).toContain("Неизвестный аргумент");
    expect(r[2].result.content[0].text).toContain("NOTION_TOKEN");
  });

  it("the example config keeps the status for the server and guards against duplicates", () => {
    const t = json(SLUG, "config/notion.example.json").target;
    expect(t.columns["Статус"].fixed).toBe("Новая");
    expect(t.dedupe_column).toBe("Название");
    expect(Object.values(t.columns).some((c: any) => c.required)).toBe(true);
  });

  it("client configs point at the shipped server", () => {
    for (const f of ["claude-code.mcp.json", "claude-desktop.json", "cursor.mcp.json"]) {
      expect(json(SLUG, "clients", f).mcpServers["notion-workspace"].args.join(" "), f).toContain("server/notion_workspace_mcp.py");
    }
  });
});
