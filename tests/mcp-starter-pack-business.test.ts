import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = Record<string, any>;
const ROOT = path.join(process.cwd(), "content/products");
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), "utf8");
const json = (...p: string[]): J => JSON.parse(read(...p));

const SLUG = "mcp-starter-pack-business";
const CHECK = path.join(ROOT, SLUG, "scripts/check_mcp_config.py");
const ARCHIVED = /@modelcontextprotocol\/server-(postgres|github|slack|gitlab|puppeteer|redis|sentry|sqlite)/;

describe("MCP Starter Pack for Business", { timeout: 30000 }, () => {
  it("no shipped client config runs an archived server", () => {
    for (const f of ["claude-code.mcp.json", "claude-desktop.json", "cursor.mcp.json", "n8n-agent-mcp.n8n.json"]) {
      expect(read(SLUG, "clients", f), f).not.toMatch(ARCHIVED);
    }
    expect(read(SLUG, "clients/claude-code-add.sh")).not.toMatch(ARCHIVED);
  });

  it("uses the vendors' own servers and read-only where it can", () => {
    const cc = json(SLUG, "clients/claude-code.mcp.json").mcpServers;
    expect(cc.github.url).toBe("https://api.githubcopilot.com/mcp/readonly");
    expect(cc.hubspot.url).toBe("https://mcp.hubspot.com");
    expect(cc.slack.url).toBe("https://mcp.slack.com/mcp");
    expect(cc.postgres.args).toContain("@bytebase/dbhub@2");
    const desktop = json(SLUG, "clients/claude-desktop.json").mcpServers;
    expect(desktop.github.env.GITHUB_READ_ONLY).toBe("1");
    const toml = read(SLUG, "configs/dbhub.toml");
    expect(toml).toMatch(/name = "execute_sql"[\s\S]*readonly = true/);
    expect(toml).toContain("${AGENT_DB_PASSWORD}");
    const role = read(SLUG, "configs/postgres-readonly-role.sql.txt");
    expect(role).toContain("default_transaction_read_only = on");
    expect(role).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)/);
  });

  it("keeps secrets out of the files", () => {
    for (const f of ["claude-code.mcp.json", "cursor.mcp.json"]) {
      expect(read(SLUG, "clients", f), f).not.toMatch(/ghp_|github_pat_|xox[bp]-|sk-[A-Za-z0-9]{20}/);
    }
  });

  it("the config check passes the shipped configs and fails an archived one", () => {
    try {
      execFileSync("python3", ["--version"]);
    } catch {
      return;
    }
    const clients = ["claude-code.mcp.json", "cursor.mcp.json", "claude-desktop.json"].map((f) => path.join(ROOT, SLUG, "clients", f));
    expect(spawnSync("python3", [CHECK, ...clients], { encoding: "utf8" }).status).toBe(0);
    const dir = mkdtempSync(path.join(tmpdir(), "mcp-check-"));
    const bad = path.join(dir, "bad.json");
    writeFileSync(bad, JSON.stringify({ mcpServers: { pg: { command: "npx", args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://a:b@h/db"] } } }));
    const run = spawnSync("python3", [CHECK, bad], { encoding: "utf8" });
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("архивный сервер");
    expect(run.stdout).toContain("пароль базы");
  });

  it("the n8n example wires three MCP clients with short names and placeholder credentials", () => {
    const wf = json(SLUG, "clients/n8n-agent-mcp.n8n.json");
    const nodes = wf.nodes.filter((n: J) => n.type === "@n8n/n8n-nodes-langchain.mcpClientTool");
    expect(nodes.map((n: J) => n.name).sort()).toEqual(["db", "github", "hubspot"]);
    for (const n of nodes) expect(wf.connections[n.name].ai_tool[0][0].node).toBe("AI Agent");
    expect(nodes.find((n: J) => n.name === "hubspot").parameters.authentication).toBe("mcpOAuth2Api");
    expect(wf.nodes.every((n: J) => Object.values(n.credentials ?? {}).every((c: any) => c.id === "REPLACE_ME"))).toBe(true);
  });
});
