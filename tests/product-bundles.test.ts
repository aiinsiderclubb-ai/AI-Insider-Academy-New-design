import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import catalog from "@/content/data/marketplace__products.json";
import { archiveEntries, bundledFor, downloadablesFor } from "@/content/downloadables";
import { packBundles, serialise } from "../scripts/pack-products.mjs";

/**
 * A bundle is a folder tree that ships only inside a product's archive — a
 * plugin with its skills, an agent kit with its configs. It is code and
 * instructions someone will install and run, so the checks here are the ones a
 * buyer would otherwise make for us: the packed copy is current, every path is
 * safe to unpack, and each skill is one an agent can actually load.
 */
const bundles = packBundles();

describe("packed bundles", () => {
  it("match the source folders — run `npm run pack:products` after editing a product", () => {
    const packed = readFileSync(path.join(process.cwd(), "content/data/productBundles.json"), "utf8");
    expect(packed).toBe(serialise(bundles));
  });

  it("unpack inside the product folder and nowhere else", () => {
    for (const [slug, files] of Object.entries(bundles)) {
      const names = archiveEntries(slug).map((entry) => entry.name);
      expect(new Set(names).size, slug).toBe(names.length);
      for (const file of files) {
        expect(file.path, slug).toMatch(/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/);
        expect(file.path.split("/"), slug).not.toContain("..");
      }
    }
  });

  it("carry no secrets", () => {
    const secret = /\bsk-[A-Za-z0-9_-]{20,}|\bAIza[0-9A-Za-z_-]{35}|\bgh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/;
    for (const [slug, files] of Object.entries(bundles)) {
      for (const file of files) expect(secret.test(file.body), `${slug}/${file.path}`).toBe(false);
    }
  });
});

describe("skills in claude-skills-library", () => {
  const slug = "claude-skills-library";
  const files = bundledFor(slug);
  const byPath = new Map(files.map((file) => [file.path, file.body]));
  const skills = files.filter((file) => /^skills\/[^/]+\/SKILL\.md$/.test(file.path));

  it("are as many as the listing and the README say", () => {
    const listing = catalog.MARKETPLACE_PRODUCTS.find((product) => product.slug === slug);
    expect(Number(/^(\d+)/.exec(listing?.shortRu ?? "")?.[1])).toBe(skills.length);
    const readme = downloadablesFor(slug)[0].body;
    for (const skill of skills) expect(readme, skill.path).toContain(`\`${skill.path.split("/")[1]}\``);
  });

  it.each(skills.map((skill) => [skill.path.split("/")[1], skill] as const))("%s follows the Agent Skills format", (folder, skill) => {
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(skill.body);
    expect(frontmatter, "frontmatter must open the file").not.toBeNull();
    const field = (name: string) => new RegExp(`^${name}: (.+)$`, "m").exec(frontmatter![1])?.[1] ?? "";

    expect(field("name")).toBe(folder);
    expect(folder).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(field("description").length).toBeGreaterThan(80);
    expect(field("description").length).toBeLessThanOrEqual(1024);
    // Keys outside the portable set are a hard error when a skill is uploaded to claude.ai.
    const keys = [...frontmatter![1].matchAll(/^([a-z-]+):/gm)].map((match) => match[1]);
    for (const key of keys) expect(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]).toContain(key);
    expect(skill.body.split("\n").length).toBeLessThan(500);

    const body = skill.body.slice(frontmatter![0].length);
    const linked = [...body.matchAll(/\]\(((?:references|assets|scripts)\/[^)]+)\)/g), ...body.matchAll(/python3 (scripts\/\S+)/g)];
    for (const [, target] of linked) expect(byPath.has(`skills/${folder}/${target}`), target).toBe(true);
  });

  it("ships Python that compiles", () => {
    const scripts = files.filter((file) => file.path.endsWith(".py"));
    expect(scripts.length).toBe(9);
    let python: string;
    try {
      python = execFileSync("python3", ["--version"], { encoding: "utf8" });
    } catch {
      return;
    }
    expect(python).toMatch(/Python 3/);
    const dir = mkdtempSync(path.join(tmpdir(), "skills-"));
    for (const [index, script] of scripts.entries()) {
      const target = path.join(dir, `script${index}.py`);
      writeFileSync(target, script.body);
      expect(() => execFileSync("python3", ["-m", "py_compile", target], { stdio: "pipe" }), script.path).not.toThrow();
    }
  });
});
