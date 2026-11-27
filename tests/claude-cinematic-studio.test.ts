import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import catalog from "@/content/data/marketplace__products.json";
import { bundledFor, downloadablesFor } from "@/content/downloadables";

/**
 * Claude Cinematic Studio ships nine skills, their Python tools and a Remotion
 * + three.js project. These are the checks a buyer would hit first: every
 * skill loads and links only to files that ship, every script answers --help,
 * the stdlib tools run on what they ship with, and the template is pinned,
 * deterministic and registers every composition.
 *
 * Rendering needs Node packages, Chrome and WebGL and is not run here; every
 * composition was rendered when the product was built (see the store page).
 * Scripts that need OpenCV, MediaPipe or Blender are only checked for --help.
 */
const slug = "claude-cinematic-studio";
const files = bundledFor(slug);
const byPath = new Map(files.map((file) => [file.path, file.body]));
const skills = files.filter((file) => /^skills\/[^/]+\/SKILL\.md$/.test(file.path));
const listing = catalog.MARKETPLACE_PRODUCTS.find((product) => product.slug === slug);
const template = (name: string) => byPath.get(`skills/cinematic-director/template/${name}`) ?? "";

let python: string | null = null;
try {
  execFileSync("python3", ["--version"], { stdio: "pipe" });
  python = "python3";
} catch {
  python = null;
}

let root = "";
beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "cinematic-studio-"));
  for (const file of files) {
    const target = path.join(root, file.path);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, file.body);
  }
});

const run = (script: string, args: string[], allowFail = false) => {
  try {
    return execFileSync(python!, [path.join(root, script), ...args], { encoding: "utf8", stdio: "pipe", cwd: root });
  } catch (error) {
    if (allowFail) return String((error as { stdout?: string }).stdout ?? "");
    throw error;
  }
};

/** Scripts that import packages outside the standard library (or run inside Blender). */
const needsExtras = (file: string) => {
  const body = byPath.get(file) ?? "";
  return /^\s*import (cv2|numpy|mediapipe|bpy)|^\s*from (cv2|numpy|mediapipe|bpy)/m.test(body);
};

describe("claude-cinematic-studio · skills", () => {
  it("are nine, as the listing and the README say", () => {
    expect(skills.length).toBe(9);
    expect(listing, "listing in the catalogue").toBeDefined();
    expect(Number(/^(\d+)/.exec(listing?.shortRu ?? "")?.[1])).toBe(skills.length);
    const readme = downloadablesFor(slug)[0].body;
    for (const skill of skills) expect(readme, skill.path).toContain(`\`${skill.path.split("/")[1]}\``);
  });

  it.each(skills.map((skill) => [skill.path.split("/")[1], skill] as const))("%s follows the Agent Skills format", (folder, skill) => {
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(skill.body);
    expect(frontmatter).not.toBeNull();
    const field = (name: string) => new RegExp(`^${name}: (.+)$`, "m").exec(frontmatter![1])?.[1] ?? "";
    expect(field("name")).toBe(folder);
    expect(field("description").length).toBeGreaterThan(80);
    expect(field("description").length).toBeLessThanOrEqual(1024);
    const keys = [...frontmatter![1].matchAll(/^([a-z-]+):/gm)].map((match) => match[1]);
    for (const key of keys) expect(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]).toContain(key);
    expect(skill.body.split("\n").length).toBeLessThan(500);
    const body = skill.body.slice(frontmatter![0].length);
    const linked = [...body.matchAll(/\]\(((?:references|assets|scripts)\/[^)#]+)\)/g), ...body.matchAll(/python3 (scripts\/[\w.]+\.py)/g)];
    for (const [, target] of linked) expect(byPath.has(`skills/${folder}/${target}`), target).toBe(true);
    for (const [, sibling, target] of body.matchAll(/\.\.\/([a-z0-9-]+)\/(scripts\/[\w.]+\.py)/g)) {
      expect(byPath.has(`skills/${sibling}/${target}`), `${sibling}/${target}`).toBe(true);
    }
  });

  it("name only sibling skills that exist", () => {
    const names = new Set(skills.map((skill) => skill.path.split("/")[1]));
    for (const file of files.filter((f) => f.path.endsWith(".md"))) {
      for (const [, sibling] of file.body.matchAll(/`([a-z0-9]+-[a-z0-9-]+)`/g)) {
        if (/^(cinematic|space|camera|vfx|footage|blender|cut|grade|cinema)-/.test(sibling) && !sibling.includes(".")) {
          const known = names.has(sibling) || /^(cinematic-studio|cinema-review\.)/.test(sibling);
          expect(known, `${file.path} → ${sibling}`).toBe(true);
        }
      }
    }
  });
});

describe("claude-cinematic-studio · template", () => {
  it("pins every package version and ships no installed packages or binaries", () => {
    const pkg = JSON.parse(template("package.json"));
    for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(String(version), name).toMatch(/^\d+\.\d+\.\d+$/);
    }
    const remotion = Object.entries(pkg.dependencies).filter(([name]) => name === "remotion" || name.startsWith("@remotion/"));
    expect(new Set(remotion.map(([, version]) => version)).size, "all Remotion packages on one version").toBe(1);
    expect(files.some((file) => file.path.includes("node_modules"))).toBe(false);
  });

  it("registers every composition in Root.tsx and times it in seconds", () => {
    const rootFile = template("src/Root.tsx");
    const compositions = files.filter((file) => /template\/src\/compositions\/\w+\.tsx$/.test(file.path));
    expect(compositions.length).toBe(5);
    for (const file of compositions) {
      const name = path.basename(file.path, ".tsx");
      expect(rootFile, name).toContain(`component={${name}}`);
    }
    expect(rootFile.match(/calculateMetadata=\{seconds\(/g)?.length).toBe(compositions.length);
  });

  it("offers the five looks the director describes", () => {
    const looks = template("src/lib/looks.ts");
    const doc = byPath.get("skills/cinematic-director/references/looks.md") ?? "";
    for (const id of ["keynote", "chrome", "kinetic", "neon", "editorial"]) {
      expect(looks, id).toMatch(new RegExp(`\\b${id}: \\{`));
      expect(doc, id).toContain(`## ${id}`);
    }
  });

  it("bundles fonts with Cyrillic from npm, not as binaries", () => {
    const fonts = template("src/lib/fonts.ts");
    const pkg = JSON.parse(template("package.json"));
    for (const [, pkgName] of fonts.matchAll(/from "(@expo-google-fonts\/[a-z-]+)\//g)) {
      expect(pkg.dependencies[pkgName], pkgName).toBeDefined();
    }
  });

  it("uses no randomness or wall-clock time in what it renders", () => {
    for (const file of files.filter((f) => /template\/src\/.*\.tsx?$/.test(f.path))) {
      const code = file.body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code, file.path).not.toMatch(/Math\.random\(|Date\.now\(|setTimeout\(|transition:/);
    }
  });
});

describe.runIf(python)("claude-cinematic-studio · scripts", () => {
  it("answer --help", () => {
    for (const script of files.filter((file) => file.path.endsWith(".py") && !needsExtras(file.path) && !file.path.includes("blender-3d"))) {
      expect(run(script.path, ["--help"]), script.path).toMatch(/usage:/);
    }
  });

  it("storyboard passes the example and catches a broken one", () => {
    const example = "skills/cinematic-director/references/example-storyboard.json";
    run("skills/cinematic-director/scripts/storyboard.py", [example]);
    const broken = JSON.parse(byPath.get(example)!);
    broken.shots[1].start = broken.shots[0].end + 1;
    const file = path.join(root, "broken.json");
    writeFileSync(file, JSON.stringify(broken));
    expect(() => run("skills/cinematic-director/scripts/storyboard.py", [file])).toThrow();
  });

  it("beats finds the tempo of a click track", () => {
    const click = path.join(root, "click.wav");
    run("skills/cut-rhythm/scripts/beats.py", ["--make-click", "128", "8", click]);
    const out = JSON.parse(run("skills/cut-rhythm/scripts/beats.py", [click]));
    expect(Math.abs(out.tempo - 128)).toBeLessThan(2);
  }, 60_000);

  it("new_project copies the template and switches the look", () => {
    const target = path.join(root, "film");
    run("skills/cinematic-director/scripts/new_project.py", [target, "--look", "chrome"]);
    const rootFile = readFileSync(path.join(target, "src/Root.tsx"), "utf8");
    expect(rootFile).toContain("HeroTitle");
    expect(rootFile).not.toMatch(/look: "(keynote|kinetic|neon|editorial)" as const/);
    expect(JSON.parse(readFileSync(path.join(target, "package.json"), "utf8")).name).toBe("film");
  });
});
