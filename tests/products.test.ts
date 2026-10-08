import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import catalog from "@/content/data/marketplace__products.json";
import { archiveName, downloadablesFor, fileBytes } from "@/content/downloadables";
import { packProducts, serialise } from "../scripts/pack-products.mjs";

/**
 * The store's products are prose in folders, packed into one JSON module by a
 * script someone has to remember to run. Nothing else notices when the packed
 * copy goes stale or a listing promises more than the files hold — a buyer
 * would. These tests are the notice.
 */
const packs = packProducts();
const slugs = Object.keys(packs);
const listings = new Map(catalog.MARKETPLACE_PRODUCTS.map((product) => [product.slug, product]));

describe("packed product files", () => {
  it("match the source folders — run `npm run pack:products` after editing a product", () => {
    const packed = readFileSync(path.join(process.cwd(), "content/data/productFiles.json"), "utf8");
    expect(packed).toBe(serialise(packs));
  });

  it("belong to a product the store lists", () => {
    for (const slug of slugs) expect(listings.has(slug), slug).toBe(true);
  });
});

describe.each(slugs)("product · %s", (slug) => {
  const files = downloadablesFor(slug);

  it("opens with a README and has something besides it", () => {
    expect(files[0].filename).toBe("README.md");
    expect(files.length).toBeGreaterThan(2);
  });

  it("uses unique, download-safe file names", () => {
    const names = files.map((file) => file.filename);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[A-Za-z0-9][A-Za-z0-9.-]*\.(md|csv|json|svg)$/);
    expect(names).not.toContain(archiveName(slug));
  });

  it("labels every file in both languages and leaves none empty", () => {
    for (const file of files) {
      expect(file.labelRu.trim().length, file.filename).toBeGreaterThan(0);
      expect(file.labelEn.trim().length, file.filename).toBeGreaterThan(0);
      expect(file.body.trim().length, file.filename).toBeGreaterThan(200);
    }
  });

  it("lists every file it ships in the README", () => {
    const readme = files[0].body;
    for (const file of files.slice(1)) {
      const prefix = file.filename.replace(/-\d+-.*$/, "-");
      expect(readme.includes(file.filename) || readme.includes(`${prefix}*`), file.filename).toBe(true);
    }
  });

  it("ships valid JSON and spreadsheets Excel can read", () => {
    for (const file of files) {
      if (file.mime === "application/json") expect(() => JSON.parse(file.body), file.filename).not.toThrow();
      if (file.mime === "text/csv") {
        const bytes = fileBytes(file);
        expect([bytes[0], bytes[1], bytes[2]], file.filename).toEqual([0xef, 0xbb, 0xbf]);
        // A decimal point or a function separator would break in a comma-decimal locale.
        for (const formula of file.body.match(/(?<=^|,)"?=[^,\n]*/gm) ?? []) {
          expect(formula, file.filename).not.toMatch(/\d\.\d|;/);
        }
      }
    }
  });

  it("does not promise a count its files do not hold", () => {
    const listing = listings.get(slug);
    const prompts = files.find((file) => file.filename === "prompts.json");
    if (!listing || !prompts) return;
    const promised = Number(/^(\d+)/.exec(listing.shortRu)?.[1]);
    expect(JSON.parse(prompts.body)).toHaveLength(promised);
  });
});
