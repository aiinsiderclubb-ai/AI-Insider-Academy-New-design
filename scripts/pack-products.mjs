/**
 * Packs the store's product files into one JSON module.
 *
 * A product is a folder under `content/products/<slug>/` with a `manifest.json`
 * naming its files and their labels. Those are the editable source. The site
 * does not read them at runtime: a route that opens files from disk works on a
 * laptop and then 404s on a host that only ships what the bundler traced. So
 * the folders are packed here into `content/data/productFiles.json`, which is
 * imported like any other content — and a test fails if the two drift apart.
 *
 *   node scripts/pack-products.mjs
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "content", "products");
const target = path.join(root, "content", "data", "productFiles.json");

const MIME = {
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".txt": "text/plain",
  ".js": "text/javascript",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".svg": "image/svg+xml",
};

export function packProducts() {
  const packs = {};
  for (const slug of readdirSync(sourceDir).sort()) {
    const manifestPath = path.join(sourceDir, slug, "manifest.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    packs[slug] = manifest.files.map((entry) => {
      const mime = MIME[path.extname(entry.file)];
      if (!mime) throw new Error(`${slug}/${entry.file}: unsupported file type`);
      return {
        filename: entry.file,
        labelRu: entry.labelRu,
        labelEn: entry.labelEn,
        mime,
        body: readFileSync(path.join(sourceDir, slug, entry.file), "utf8"),
      };
    });
  }
  return packs;
}

export function serialise(packs) {
  return JSON.stringify(packs, null, 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const packs = packProducts();
  writeFileSync(target, serialise(packs));
  const files = Object.values(packs).reduce((sum, list) => sum + list.length, 0);
  const bytes = Object.values(packs).flat().reduce((sum, file) => sum + Buffer.byteLength(file.body), 0);
  console.log(`${Object.keys(packs).length} products, ${files} files, ${(bytes / 1024).toFixed(0)} KB → content/data/productFiles.json`);
}
