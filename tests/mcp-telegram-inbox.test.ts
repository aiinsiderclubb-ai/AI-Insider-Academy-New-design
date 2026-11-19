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

const SLUG = "mcp-telegram-inbox";
const SERVER = path.join(ROOT, SLUG, "server/telegram_inbox_mcp.py");

describe("MCP: Telegram Inbox", { timeout: 30000 }, () => {
  it("ships the same server and protocol files the tests ran", () => {
    expect(read(SLUG, "server/telegram_inbox_mcp.py")).toBe(readFileSync(path.join(KIT, "telegram_inbox_mcp.py"), "utf8"));
    expect(read(SLUG, "server/mcp_lite.py")).toBe(readFileSync(path.join(KIT, "mcp_lite.py"), "utf8"));
  });

  it("offers five tools; only reads are marked read-only", () => {
    if (!hasPython()) return;
    const r = mcp(SERVER, json(SLUG, "config/inbox.example.json"), [{ method: "tools/list" }]);
    expect(r[0].result.serverInfo.name).toBe("telegram-inbox");
    const tools = Object.fromEntries(r[1].result.tools.map((t: J) => [t.name, t]));
    expect(Object.keys(tools).sort()).toEqual(["create_lead", "escalate", "fetch_new_messages", "list_messages", "mark_messages"]);
    expect(tools.list_messages.annotations.readOnlyHint).toBe(true);
    expect(tools.create_lead.annotations.readOnlyHint).toBe(false);
    expect(tools.create_lead.inputSchema.required).toEqual(["message_ids", "need"]);
  });

  it("explains a missing bot token instead of crashing", () => {
    if (!hasPython()) return;
    const r = mcp(SERVER, json(SLUG, "config/inbox.example.json"), [{ method: "tools/call", params: { name: "fetch_new_messages", arguments: {} } }]);
    expect(r[1].result.isError).toBe(true);
    expect(r[1].result.content[0].text).toContain("TELEGRAM_BOT_TOKEN");
  });

  it("refuses a lead for a message it never stored", () => {
    if (!hasPython()) return;
    const r = mcp(SERVER, json(SLUG, "config/inbox.example.json"), [
      { method: "tools/call", params: { name: "create_lead", arguments: { message_ids: ["-100:1"], need: "x", phone: "+380671234567" } } },
    ]);
    expect(r[1].result.isError).toBe(true);
  });

  it("escalation rules compile and catch the words they promise", () => {
    const rules = json(SLUG, "config/inbox.example.json").escalation as J[];
    const hit = (text: string) => rules.filter((r) => r.patterns.some((p: string) => new RegExp(p.replace(/\\b/g, "(?<![\\p{L}])"), "iu").test(text))).map((r) => r.name);
    expect(hit("Верните деньги, иначе в суд")).toContain("жалоба или возврат");
    expect(hit("Срочно нужен ответ")).toContain("срочно");
    expect(hit("Купил посуду")).toEqual([]);
  });

  it("client configs point at the shipped server and config", () => {
    for (const f of ["claude-code.mcp.json", "claude-desktop.json", "cursor.mcp.json"]) {
      const s = json(SLUG, "clients", f).mcpServers["telegram-inbox"];
      expect(s.args.join(" "), f).toContain("server/telegram_inbox_mcp.py");
      expect(s.args.join(" "), f).toContain("config/inbox.json");
    }
    const n8n = json(SLUG, "clients/n8n-inbox-triage.n8n.json");
    const mcpNode = n8n.nodes.find((n: J) => n.type === "@n8n/n8n-nodes-langchain.mcpClientTool");
    expect(mcpNode.name).toBe("inbox");
    expect(mcpNode.parameters.serverTransport).toBe("httpStreamable");
    expect(n8n.nodes.every((n: J) => Object.values(n.credentials ?? {}).every((c: any) => c.id === "REPLACE_ME"))).toBe(true);
    const agent = n8n.nodes.find((n: J) => n.name === "AI Agent");
    expect(read(SLUG, "prompts/agent-request.md")).toContain(agent.parameters.text.split("\n")[0]);
  });
});
