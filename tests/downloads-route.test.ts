import { beforeEach, describe, expect, it, vi } from "vitest";

const owned = new Set<string>();

vi.mock("@/lib/api/session", () => ({
  getAccess: async () => ({ productIds: owned }),
}));
vi.mock("@/lib/api/store", () => ({
  getProduct: async (slug: string) =>
    slug === "discovery-call-framework" ? { product: { id: "mp-biz-discovery", slug } } : null,
}));

const { GET } = await import("@/app/downloads/[slug]/[file]/route");

const SLUG = "discovery-call-framework";
const get = (file: string, slug: string = SLUG) =>
  GET(new Request(`http://localhost/downloads/${slug}/${file}`), { params: Promise.resolve({ slug, file }) });

/**
 * The route is the only thing between a paid product and anyone with its URL,
 * and the product page links to file names that are public. So: nothing leaves
 * without ownership, and what an owner gets opens.
 */
describe("product downloads", () => {
  beforeEach(() => owned.clear());

  it("refuses a file and the archive to someone who has not bought the product", async () => {
    const responses = await Promise.all(["README.md", "call-notes.csv", `${SLUG}.zip`].map((file) => get(file)));
    for (const response of responses) expect(response.status, response.url).toBe(403);
    const bodies = await Promise.all(responses.map((response) => response.text()));
    for (const body of bodies) expect(body).not.toContain("Discovery");
  });

  it("does not reveal whether a product exists beyond its listed files", async () => {
    expect((await get("secret.md")).status).toBe(404);
    expect((await get("README.md", "no-such-product")).status).toBe(404);
  });

  it("gives an owner the file as an attachment", async () => {
    owned.add("mp-biz-discovery");
    const response = await get("call-script.md");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="call-script.md"');
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).toContain("Сценарий discovery-звонка");
  });

  it("gives an owner spreadsheets Excel reads as UTF-8", async () => {
    owned.add("mp-biz-discovery");
    const bytes = new Uint8Array(await (await get("call-notes.csv")).arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("gives an owner every file in one archive", async () => {
    owned.add("mp-biz-discovery");
    const response = await get(`${SLUG}.zip`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
    expect(bytes.readUInt16LE(bytes.length - 12)).toBe(7);
  });
});
