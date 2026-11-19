import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** n8n's Code node sandbox (2.48) has no URL or URLSearchParams globals; code that uses them fails there and passes here. */
function workflows(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return workflows(full);
    return name.endsWith(".n8n.json") ? [full] : [];
  });
}

describe("shipped Code nodes", () => {
  it("do not rely on globals the n8n sandbox lacks", () => {
    for (const file of workflows(path.join(process.cwd(), "content/products"))) {
      const flow = JSON.parse(readFileSync(file, "utf8"));
      for (const node of flow.nodes ?? []) {
        const code: string = node.parameters?.jsCode ?? "";
        expect(code, `${path.relative(process.cwd(), file)} · ${node.name}`).not.toMatch(/new URL\(|new URLSearchParams\(/);
      }
    }
  });
});
