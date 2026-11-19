import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { codeNodes, credentialsArePlaceholders, workflow, type J } from "./helpers/n8n-kit";

const SLUG = "ecommerce-support-retention-engine";
const flow = workflow(SLUG, "store-engine");
const code = codeNodes(flow);
const dir = path.join(process.cwd(), "content/products", SLUG);

const items = (v: J | J[]) => (Array.isArray(v) ? v : [v]).map((json) => ({ json }));

/** Like helpers/runCode, plus `.all()` and several input items — the jobs here work on lists. */
function run(name: string, nodes: J, input: J | J[]): J[] {
  const $ = (n: string) => ({
    isExecuted: n in nodes,
    first: () => {
      if (!(n in nodes)) throw new Error(`node ${n} has not run`);
      return { json: Array.isArray(nodes[n]) ? nodes[n][0] : nodes[n] };
    },
    all: () => items(nodes[n]),
  });
  const $input = { first: () => items(input)[0], all: () => items(input) };
  const staticData = () => (nodes.$static ??= {});
  return (new Function("$", "$input", "$getWorkflowStaticData", code[name])($, $input, staticData) as { json: J }[]).map((i) => i.json);
}

const config: J = run("Config", {}, {})[0].config;
const cfg: J = {
  ...config,
  agent_token: "tok-1234567",
  unsubscribe_secret: "secret-1",
  public_n8n_url: "https://n8n.example",
  quiet_hours: [0, 0],
  carts: { ...config.carts, discount_code: "BACK10" },
};
const DAY = 86400000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const sheet = (rows: string[][]) => ({ values: rows });
const ORDERS_HEAD = ["order_id", "email", "phone", "status", "items", "total", "currency", "delivered_at", "tracking", "tags", "consent"];

function shopOrder(o: J = {}): J {
  return {
    name: "#1001", email: "anna@example.com", phone: "+380501112233", createdAt: ago(20 * DAY), cancelledAt: null,
    displayFinancialStatus: "PAID", displayFulfillmentStatus: "FULFILLED", tags: [],
    totalPriceSet: { shopMoney: { amount: "2400.00", currencyCode: "UAH" } },
    customer: { firstName: "Анна", defaultEmailAddress: { emailAddress: "anna@example.com", marketingState: "SUBSCRIBED" } },
    lineItems: { nodes: [{ title: "Плед шерстяной", quantity: 1, product: { productType: "Текстиль", tags: [], handle: "pled" } }] },
    fulfillments: [{ displayStatus: "DELIVERED", deliveredAt: ago(3 * DAY), trackingInfo: [{ number: "204", url: "", company: "NP" }] }],
    ...o,
  };
}

function order(platform: string, res: J, input: J) {
  const c = { ...cfg, platform };
  const n = run("Normalize Order", { Config: { config: c, input } }, res)[0];
  return { n, c };
}

function policy(o: J, input: J) {
  const { n, c } = order("shopify", { data: { orders: { nodes: [shopOrder(o)] } } }, { order_id: "1001", email: "anna@example.com", ...input });
  return run("Return Policy", { Config: { config: c, input: { order_id: "1001", email: "anna@example.com", ...input } } }, n)[0];
}

describe("orders from three platforms", () => {
  it("reads a Shopify order and checks the owner", () => {
    const { n } = order("shopify", { data: { orders: { nodes: [shopOrder()] } } }, { order_id: "#1001", email: "ANNA@example.com" });
    expect(n.verified).toBe(true);
    expect(n.order.status).toBe("Доставлен");
    expect(n.order.items[0].type).toBe("Текстиль");
    const stranger = order("shopify", { data: { orders: { nodes: [shopOrder()] } } }, { order_id: "1001", email: "bob@example.com" }).n;
    expect(stranger.verified).toBe(false);
    const ans = run("Order Answer", { Config: { config: cfg, input: { order_id: "1001" } } }, stranger)[0];
    expect(ans.order).toBeUndefined();
  });

  it("treats a WooCommerce 404 as 'not found' and other failures as service errors", () => {
    expect(order("woocommerce", { error: { message: "404 - Invalid ID." } }, { order_id: "5" }).n).toMatchObject({ found: false });
    expect(order("woocommerce", { error: { message: "401 - cannot view" } }, { order_id: "5" }).n.service_error).toContain("401");
    const woo = { id: 2001, number: "2001", status: "completed", total: "1980.00", currency: "UAH", date_completed_gmt: "2026-11-10T10:00:00",
      billing: { email: "o@example.com", phone: "", first_name: "Олег" }, line_items: [{ name: "Кофе", quantity: 2 }], meta_data: [] };
    const n = order("woocommerce", woo, { order_id: "2001", email: "o@example.com" }).n;
    expect(n.order).toMatchObject({ status: "Выполнен", delivered_at: "2026-11-10T10:00:00Z", total: 1980 });
  });

  it("reads the Orders sheet, items with types and local dates", () => {
    const rows = [ORDERS_HEAD, ["5001", "a@example.com", "", "Доставлен", "Плед ×1 [Текстиль]; Сертификат ×2 [Подарочный сертификат]", "2 400,50", "UAH", "16.11.2026", "204", "final-sale", "yes"]];
    const n = order("sheets", sheet(rows), { order_id: "5001", email: "a@example.com" }).n;
    expect(n.order.items).toEqual([
      { title: "Плед", qty: 1, type: "Текстиль", tags: [], handle: "" },
      { title: "Сертификат", qty: 2, type: "Подарочный сертификат", tags: [], handle: "" },
    ]);
    expect(n.order.delivered_at).toBe("2026-11-16T12:00:00Z");
    expect(n.order.total).toBe(2400.5);
    expect(n.order.tags).toEqual(["final-sale"]);
    expect(n.order.consent).toBe(true);
  });
});

describe("return policy", () => {
  it("allows a fresh unused return but never refunds", () => {
    const p = policy({}, { tool: "check_return", condition: "unused", reason: "не подошёл цвет" });
    expect(p.decision).toBe("eligible");
    expect(p.note).toContain("не обещай");
    expect(p.create).toBe(false);
  });

  it("refuses late, final-sale, non-returnable and used items", () => {
    const late = { fulfillments: [{ deliveredAt: ago(30 * DAY), trackingInfo: [] }] };
    expect(policy(late, { tool: "check_return", condition: "unused" }).decision).toBe("ineligible");
    expect(policy({ tags: ["final-sale"] }, { tool: "check_return", condition: "unused" }).decision).toBe("ineligible");
    const cert = { lineItems: { nodes: [{ title: "Сертификат", quantity: 1, product: { productType: "Подарочный сертификат", tags: [], handle: "" } }] } };
    expect(policy(cert, { tool: "check_return", condition: "unused" }).decision).toBe("ineligible");
    expect(policy({}, { tool: "check_return", condition: "used", reason: "передумал" }).decision).toBe("ineligible");
  });

  it("sends defects, expensive orders and undelivered orders to a person", () => {
    const late = { fulfillments: [{ deliveredAt: ago(60 * DAY), trackingInfo: [] }] };
    expect(policy(late, { tool: "check_return", reason: "пришла сломанная", condition: "unused" }).decision).toBe("needs_human");
    expect(policy({ totalPriceSet: { shopMoney: { amount: "25000", currencyCode: "UAH" } } }, { tool: "check_return", condition: "unused" }).decision).toBe("needs_human");
    expect(policy({ fulfillments: [] }, { tool: "check_return", condition: "unused" }).decision).toBe("needs_human");
    expect(policy({ cancelledAt: ago(DAY) }, { tool: "check_return", condition: "unused" }).decision).toBe("ineligible");
  });

  it("creates a request only when the rules allow it", () => {
    expect(policy({}, { tool: "create_return_request", condition: "unused" }).create).toBe(true);
    const no = policy({ tags: ["final-sale"] }, { tool: "create_return_request", condition: "unused" });
    expect(no.create).toBe(false);
    expect(no.note).toMatch(/^Заявка НЕ создана/);
    expect(policy({}, { tool: "create_return_request", condition: "unknown" }).create).toBe(false);
  });

  it("does not leak the order to a stranger through the return check", () => {
    const { n, c } = order("shopify", { data: { orders: { nodes: [shopOrder()] } } }, { order_id: "1001", email: "x@example.com" });
    const p = run("Return Policy", { Config: { config: c, input: { tool: "check_return", order_id: "1001", email: "x@example.com" } } }, n)[0];
    expect(p.decision).toBe("unknown");
    expect(p.items).toBeUndefined();
  });
});

describe("abandoned carts", () => {
  const log = (rows: string[][] = []) => ({ valueRanges: [sheet([["time", "kind", "ref", "email", "step", "status", "subject", "detail"], ...rows]), sheet([["time", "email", "source"], ["", "gone@example.com", ""]])] });
  const checkout = (id: string, email: string, ageMs: number, o: J = {}) => ({
    id: `gid://shopify/AbandonedCheckout/${id}`, abandonedCheckoutUrl: `https://s/r/${id}`, createdAt: ago(ageMs + 1000), updatedAt: ago(ageMs), completedAt: null,
    customer: { firstName: "Олег", defaultEmailAddress: { emailAddress: email, marketingState: "SUBSCRIBED" } },
    totalPriceSet: { shopMoney: { amount: "900", currencyCode: "UAH" } }, lineItems: { nodes: [{ title: "Плед", quantity: 1 }] }, ...o,
  });
  const plan = (checkouts: J[], logRows: string[][] = [], c: J = cfg) =>
    run("Plan Carts", { Config: { config: c }, "Fetch Checkouts": { data: { abandonedCheckouts: { nodes: checkouts } } } }, log(logRows));

  it("writes only with consent, before purchase, after an hour, and not to unsubscribed people", () => {
    const out = plan([
      checkout("1", "ok@example.com", 2 * 3600e3),
      checkout("2", "early@example.com", 10 * 60e3),
      checkout("3", "nocons@example.com", 2 * 3600e3, { customer: { defaultEmailAddress: { emailAddress: "nocons@example.com", marketingState: "NOT_SUBSCRIBED" } } }),
      checkout("4", "bought@example.com", 2 * 3600e3, { completedAt: ago(60e3) }),
      checkout("5", "gone@example.com", 2 * 3600e3),
      checkout("6", "old@example.com", 100 * 3600e3),
    ]);
    expect(out.map((p) => p.ref)).toEqual(["1"]);
    expect(out[0].step).toBe(1);
    expect(out[0].discount_code).toBe("");
  });

  it("sends the second email a day later with the promo code, and never a third", () => {
    const second = plan([checkout("7", "s@example.com", 30 * 3600e3)], [[ago(29 * 3600e3), "cart", "7", "s@example.com", "1", "sent", "", ""]]);
    expect(second).toMatchObject([{ step: 2, discount_code: "BACK10" }]);
    const third = plan([checkout("7", "s@example.com", 50 * 3600e3)], [
      [ago(49 * 3600e3), "cart", "7", "s@example.com", "1", "sent", "", ""], [ago(20 * 3600e3), "cart", "7", "s@example.com", "2", "sent", "", ""]]);
    expect(third).toEqual([]);
  });

  it("keeps one cart per address and respects quiet hours", () => {
    expect(plan([checkout("8", "two@example.com", 2 * 3600e3), checkout("9", "two@example.com", 3 * 3600e3)]).map((p) => p.ref)).toEqual(["8"]);
    expect(plan([checkout("1", "ok@example.com", 2 * 3600e3)], [], { ...cfg, quiet_hours: [0, 24] })).toEqual([]);
  });

  it("reads carts sent by the store's own events", () => {
    const rows = [["time", "event", "cart_id", "email", "name", "consent", "items", "total", "currency", "checkout_url"],
      [ago(2 * 3600e3), "cart", "w1", "a@example.com", "Ира", "yes", "Плед ×1", "900", "UAH", "https://s/w1"],
      [ago(2 * 3600e3), "cart", "w2", "b@example.com", "", "yes", "Плед ×1", "900", "UAH", "https://s/w2"],
      [ago(3600e3), "order", "w2", "b@example.com", "", "", "", "", "", ""]];
    const out = run("Plan Carts", { Config: { config: { ...cfg, platform: "sheets" } }, "Read Carts": sheet(rows) }, log());
    expect(out.map((p) => p.ref)).toEqual(["w1"]);
  });

  it("uses the model's opening only when it has no numbers, discounts or links", () => {
    const plans = [
      { kind: "cart", ref: "1", email: "a@example.com", name: "Олег", step: 1, items: ["Плед ×1"], total: 900, currency: "UAH", url: "https://s/1", discount_code: "" },
      { kind: "cart", ref: "2", email: "b@example.com", name: "", step: 2, items: ["Плед ×1"], total: 900, currency: "UAH", url: "https://s/2", discount_code: "BACK10" },
    ];
    const out = run("Compose Cart Email", { Config: { config: cfg }, "Plan Carts": plans, "Cart Copy": [] }, [
      { text: "Плед всё ещё ждёт вас в корзине." }, { text: "Скидка 15% только сегодня!" }]);
    expect(out[0].text).toContain("Плед всё ещё ждёт вас в корзине.");
    expect(out[0].ai_used).toBe(true);
    expect(out[1].text).not.toContain("15%");
    expect(out[1].ai_rejected).toBe("numbers");
    expect(out[1].text).toContain("BACK10");
    const link = /store-unsubscribe\?e=([^&]+)&s=(\w+)/.exec(out[0].text)!;
    expect(link[2]).toBe(createHmac("sha256", "secret-1").update("a@example.com").digest("hex").slice(0, 32));
  });
});

describe("reviews and unsubscribing", () => {
  it("asks once, after delivery, never when a return is open", () => {
    const orders = { data: { orders: { nodes: [
      shopOrder({ name: "#1", fulfillments: [{ deliveredAt: ago(8 * DAY), trackingInfo: [] }] }),
      shopOrder({ name: "#2", fulfillments: [{ deliveredAt: ago(3 * DAY), trackingInfo: [] }] }),
      shopOrder({ name: "#3", fulfillments: [{ deliveredAt: ago(8 * DAY), trackingInfo: [] }] }),
      shopOrder({ name: "#4", fulfillments: [{ deliveredAt: ago(8 * DAY), trackingInfo: [] }] }),
      shopOrder({ name: "#5", fulfillments: [{ deliveredAt: ago(40 * DAY), trackingInfo: [] }] }),
    ] } } };
    const sheets = { valueRanges: [
      sheet([["time", "kind", "ref", "email", "step", "status", "subject", "detail"], [ago(DAY), "review", "4", "a", "1", "sent", "", ""]]),
      sheet([["time", "email", "source"]]),
      sheet([["created", "rma", "status", "decision", "order_id"], ["", "R-1", "", "", "3"]]),
    ] };
    const out = run("Plan Reviews", { Config: { config: cfg }, "Fetch Delivered": orders }, sheets);
    expect(out.map((p) => p.ref)).toEqual(["1"]);
    expect(out[0].url).toBe("https://example.com/products/pled#reviews");
  });

  it("unsubscribes only through a signed link", () => {
    const sig = createHmac("sha256", "secret-1").update("a@example.com").digest("hex").slice(0, 32);
    const ok = run("Unsubscribe Check", { Config: { config: cfg, input: { query: { e: "A@example.com", s: sig } } } }, {})[0];
    expect(ok.ok).toBe(true);
    expect(ok.row[1]).toBe("a@example.com");
    expect(run("Unsubscribe Check", { Config: { config: cfg, input: { query: { e: "a@example.com", s: "0".repeat(32) } } } }, {})[0].ok).toBe(false);
    const placeholder = { ...cfg, unsubscribe_secret: config.unsubscribe_secret };
    expect(run("Unsubscribe Check", { Config: { config: placeholder, input: { query: { e: "a@example.com", s: sig } } } }, {})[0].ok).toBe(false);
  });

  it("validates cart events", () => {
    const ev = (body: J, headers: J = { "x-agent-token": "tok-1234567" }) => run("Cart Event", {}, { config: cfg, input: { body, headers } })[0];
    expect(ev({ event: "cart", cart_id: "c1", email: "a@example.com", checkout_url: "https://s/c1" }).route).toBe("ok");
    expect(ev({ event: "cart", cart_id: "c1", email: "a@example.com" }, {}).route).toBe("deny");
    expect(ev({ event: "cart", cart_id: "c1" }).route).toBe("bad");
    expect(ev({ event: "cart", cart_id: "c1", email: "a@example.com", checkout_url: "javascript:alert(1)" }).route).toBe("bad");
    expect(ev({ event: "order", cart_id: "c1" }).route).toBe("ok");
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
        .map((v) => /\$fromAI\('(\w+)'/.exec(String(v))?.[1]).filter(Boolean).sort();
      expect(fromAi, t.function.name).toEqual(Object.keys(t.function.parameters.properties).sort());
    }
  });

  it("fills every prompt placeholder from Config", () => {
    for (const file of ["system-prompt.md", "cart-copy-prompt.md"]) {
      const prompt = readFileSync(path.join(dir, "agent", file), "utf8");
      for (const [, key] of prompt.matchAll(/\{\{(\w+)\}\}/g)) expect(config, key).toHaveProperty(key);
    }
  });
});
