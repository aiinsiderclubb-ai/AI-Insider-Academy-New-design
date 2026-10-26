import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Runs the Code nodes of a shipped n8n workflow outside n8n. `$('Node')` reads
 * the output of an earlier node from `nodes`, `$input` is what the node
 * receives — the two things the store's workflows use.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type J = Record<string, any>;

export function workflow(slug: string, name: string): J {
  return JSON.parse(readFileSync(path.join(process.cwd(), "content/products", slug, "workflows", `${name}.n8n.json`), "utf8"));
}

export function codeNodes(flow: J): Record<string, string> {
  return Object.fromEntries(flow.nodes.filter((node: J) => node.type === "n8n-nodes-base.code").map((node: J) => [node.name, node.parameters.jsCode]));
}

export function configOf(flow: J): J {
  return new Function(codeNodes(flow).Config)()[0].json;
}

export function runCode(code: string, nodes: J, input: J): J[] {
  const $ = (name: string) => ({
    first: () => {
      if (!(name in nodes)) throw new Error(`node ${name} has not run`);
      return { json: nodes[name] };
    },
  });
  const $input = { first: () => ({ json: input }), all: () => [{ json: input }] };
  // Workflow static data lives in nodes.$static, so a test can carry it from one run to the next.
  const staticData = () => (nodes.$static ??= {});
  return (new Function("$", "$input", "$getWorkflowStaticData", code)($, $input, staticData) as { json: J }[]).map((item) => item.json);
}

/** The Google Sheets values API, in memory: get, batchGet, append, update, batchUpdate. */
export class Sheets {
  tabs: Record<string, string[][]> = {};

  tab(name: string): string[][] {
    return (this.tabs[name] ??= []);
  }

  private static range(text: string): { tab: string; row: number; col: number } {
    const decoded = decodeURIComponent(text).replace(/''/g, "'");
    const m = /^'?(.*?)'?!([A-Z]+)(\d+)/.exec(decoded);
    if (!m) throw new Error(`bad range ${decoded}`);
    return { tab: m[1], row: Number(m[3]), col: m[2].charCodeAt(0) - 65 };
  }

  handle(http: J): J {
    const url = new URL(http.url);
    const tail = url.pathname.split("/values")[1] ?? "";
    if (tail === ":batchUpdate") {
      for (const item of http.body.data) {
        const r = Sheets.range(item.range);
        const row = (this.tab(r.tab)[r.row - 1] ??= []);
        item.values[0].forEach((value: string, i: number) => (row[r.col + i] = value));
      }
      return {};
    }
    if (tail === ":batchGet") {
      return {
        valueRanges: url.searchParams.getAll("ranges").map((range) => {
          const rows = this.tab(Sheets.range(range).tab);
          return rows.length ? { range, values: rows.map((row) => [...row]) } : { range };
        }),
      };
    }
    const target = tail.slice(1).replace(/:append$/, "");
    const r = Sheets.range(target);
    const rows = this.tab(r.tab);
    if (http.method === "GET") return rows.length ? { values: rows.map((row) => [...row]) } : {};
    if (http.method === "POST") for (const row of http.body.values) rows.push([...row]);
    if (http.method === "PUT") rows[r.row - 1] = [...http.body.values[0]];
    return {};
  }
}

/** Every webhook asks for authentication or says in a note why it cannot; no credential carries a real id. */
export function credentialsArePlaceholders(flow: J): boolean {
  return flow.nodes.every((node: J) => Object.values(node.credentials ?? {}).every((c) => (c as J).id === "REPLACE_ME"));
}
