import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import catalog from "@/content/data/marketplace__products.json";
import { bundledFor, downloadablesFor } from "@/content/downloadables";

/**
 * Claude Motion Studio ships eight skills, nine Python scripts and a Remotion
 * project. The checks here are the ones a buyer would hit first: every skill
 * loads, every script runs on the samples it ships with, and the data files
 * inside the template are exactly what those scripts produce — so the
 * template and the skills cannot drift apart.
 *
 * Rendering itself needs Node packages and Chrome and is not run here; it was
 * verified by rendering every composition when the product was built.
 */
const slug = "claude-motion-studio";
const files = bundledFor(slug);
const byPath = new Map(files.map((file) => [file.path, file.body]));
const skills = files.filter((file) => /^skills\/[^/]+\/SKILL\.md$/.test(file.path));
const listing = catalog.MARKETPLACE_PRODUCTS.find((product) => product.slug === slug);
const template = (name: string) => byPath.get(`skills/motion-director/template/${name}`) ?? "";

let python: string | null = null;
try {
  execFileSync("python3", ["--version"], { stdio: "pipe" });
  python = "python3";
} catch {
  python = null;
}

let root = "";
beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "motion-studio-"));
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

describe("claude-motion-studio · skills", () => {
  it("are as many as the listing and the README say", () => {
    expect(skills.length).toBe(8);
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
    const linked = [...body.matchAll(/\]\(((?:references|assets|scripts)\/[^)]+)\)/g), ...body.matchAll(/python3 (scripts\/\S+)/g)];
    for (const [, target] of linked) expect(byPath.has(`skills/${folder}/${target}`), target).toBe(true);
    // Scripts of a sibling skill are referenced as ../<skill>/scripts/<file>.
    for (const [, sibling, target] of body.matchAll(/\.\.\/([a-z-]+)\/(scripts\/[\w.]+)/g)) {
      expect(byPath.has(`skills/${sibling}/${target}`), `${sibling}/${target}`).toBe(true);
    }
  });

  it("ship nine Python scripts", () => {
    expect(files.filter((file) => file.path.endsWith(".py"))).toHaveLength(9);
  });
});

describe("claude-motion-studio · template", () => {
  it("pins every package version and ships no installed packages", () => {
    const pkg = JSON.parse(template("package.json"));
    for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(String(version), name).toMatch(/^\d+\.\d+\.\d+$/);
    }
    const remotion = Object.entries(pkg.dependencies).filter(([name]) => name === "remotion" || name.startsWith("@remotion/"));
    expect(new Set(remotion.map(([, version]) => version)).size, "all Remotion packages on one version").toBe(1);
    expect(files.some((file) => file.path.includes("node_modules"))).toBe(false);
  });

  it("registers every composition in Root.tsx", () => {
    const rootFile = template("src/Root.tsx");
    const compositions = files.filter((file) => /template\/src\/compositions\/\w+\.tsx$/.test(file.path));
    expect(compositions.length).toBe(6);
    for (const file of compositions) {
      const name = path.basename(file.path, ".tsx");
      expect(rootFile, name).toContain(`component={${name}}`);
    }
  });

  it("offers the eight styles the skills describe", () => {
    const styles = template("src/styles/styles.ts");
    const styleDoc = byPath.get("skills/motion-director/references/styles.md") ?? "";
    for (const id of ["signal", "swiss-grid", "editorial", "terminal", "bold-kinetic", "data-noir", "print-riso", "quiet-line"]) {
      expect(styles, id).toContain(`"${id}"`);
      expect(styleDoc, id).toContain(`## ${id}`);
    }
  });

  it("uses no randomness or wall-clock time in compositions", () => {
    for (const file of files.filter((f) => /template\/src\/.*\.tsx?$/.test(f.path))) {
      const code = file.body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code, file.path).not.toMatch(/Math\.random\(|Date\.now\(|setTimeout\(|transition:/);
    }
  });
});

describe.runIf(python)("claude-motion-studio · scripts", () => {
  it("answer --help", () => {
    for (const script of files.filter((file) => file.path.endsWith(".py"))) {
      expect(run(script.path, ["--help"]), script.path).toMatch(/usage:/);
    }
  });

  it("srt_to_timeline reproduces the template's caption sample", () => {
    const out = JSON.parse(run("skills/captions-explainer/scripts/srt_to_timeline.py", ["skills/captions-explainer/assets/sample.srt", "--max-words", "3", "--max-chars", "20"]));
    expect(out).toEqual(JSON.parse(template("public/data/captions-sample.json")));
    const words = out.pages.flatMap((page: { words: { start: number; end: number }[] }) => page.words);
    for (let i = 1; i < words.length; i++) expect(words[i].start).toBeGreaterThanOrEqual(words[i - 1].end - 1e-9);
  });

  it("srt_to_timeline reads word-level JSON and warns about fast pages", () => {
    const source = path.join(root, "fast.json");
    writeFileSync(source, JSON.stringify({ segments: [{ words: [{ word: "Очень", start: 0, end: 0.1 }, { word: "быстрая", start: 0.1, end: 0.2 }, { word: "речь", start: 0.2, end: 0.3 }] }] }));
    const report = JSON.parse(run("skills/captions-explainer/scripts/srt_to_timeline.py", [source, "--report"]));
    expect(report.word_times).toBe("from source");
    expect(report.warnings.join(" ")).toMatch(/characters per second/);
  });

  it("csv_to_chart computes the numbers the sample video shows", () => {
    const out = JSON.parse(run("skills/data-story/scripts/csv_to_chart.py", ["skills/data-story/assets/hours-sample.csv", "--highlight", "last", "--delta", "first:last", "--unit", " ч"]));
    expect(out.chart.kind).toBe("bar");
    expect(out.chart.scale).toEqual({ min: 0, max: 40, ticks: [0, 10, 20, 30, 40] });
    expect(out.facts.change).toBe(-29);
    expect(out.delta.label).toBe("−76%");
    expect(out.chart.highlight).toEqual({ series: 0, index: 5 });
  });

  it("csv_to_chart reads comma decimals and reports cells that are not numbers", () => {
    const source = path.join(root, "mixed.csv");
    writeFileSync(source, "Неделя;Выручка\nНед 1;12\nНед 2;\"12,6\"\nНед 3;1 300,5\nНед 4;n/a\n");
    const out = JSON.parse(run("skills/data-story/scripts/csv_to_chart.py", [source, "--kind", "line"]));
    expect(out.chart.series[0].values).toEqual([12, 12.6, 1300.5]);
    expect(out.warnings.join(" ")).toMatch(/row 5/);
  });

  it("svg_prepare reproduces the template's logo and resolves transforms", () => {
    const logo = JSON.parse(run("skills/logo-sting/scripts/svg_prepare.py", ["skills/motion-director/template/public/logo.svg"]));
    expect(logo).toEqual(JSON.parse(template("public/data/logo-sample.json")));
    expect(logo.paths[1].fill).toBeNull(); // fill="none" on <svg> is inherited
    const source = path.join(root, "t.svg");
    writeFileSync(source, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="translate(10 10) scale(2)"><rect width="10" height="10" fill="red"/><text>x</text></g></svg>');
    const out = JSON.parse(run("skills/logo-sting/scripts/svg_prepare.py", [source]));
    expect(out.paths[0].d).toBe("M 10 10 L 30 10 L 30 30 L 10 30 Z");
    const report = JSON.parse(run("skills/logo-sting/scripts/svg_prepare.py", [source, "--report"]));
    expect(report.warnings.join(" ")).toMatch(/outlines/);
  });

  it("beats finds the tempo of a click track", () => {
    const click = path.join(root, "click.wav");
    run("skills/beat-sync/scripts/beats.py", ["--make-click", "128", "8", click]);
    const out = JSON.parse(run("skills/beat-sync/scripts/beats.py", [click]));
    expect(Math.abs(out.tempo - 128)).toBeLessThan(2);
    expect(Math.abs(out.beats[1] - out.beats[0] - 60 / 128)).toBeLessThan(0.03);
    expect(out.downbeats[0]).toBeCloseTo(out.beats[0], 2);
  }, 60_000);

  it("timing flags a beat too short to read and snaps cuts to beats", () => {
    const board = path.join(root, "board.json");
    writeFileSync(board, JSON.stringify({ cards: [{ at: 0, text: "Раз два три четыре пять шесть" }, { at: 1.0, text: "Да" }, { at: 2.53, text: "Финал" }] }));
    const beats = path.join(root, "beats.json");
    writeFileSync(beats, JSON.stringify({ beats: [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0] }));
    const out = JSON.parse(run("skills/motion-director/scripts/timing.py", [board, "--duration", "4", "--beats", beats], true));
    expect(out.ok).toBe(false);
    expect(out.problems.join(" ")).toMatch(/beat 1/);
    expect(out.beats[2].at).toBe(2.5);
    expect(out.beats[2].frame).toBe(75);
  });

  it("new_project copies the template and restyles it", () => {
    const target = path.join(root, "project");
    run("skills/motion-director/scripts/new_project.py", [target, "--style", "editorial"]);
    expect(readFileSync(path.join(target, "src/Root.tsx"), "utf8")).toContain("KineticType");
    expect(readFileSync(path.join(target, "src/compositions/KineticType.tsx"), "utf8")).toContain('style: "editorial"');
    expect(JSON.parse(readFileSync(path.join(target, "package.json"), "utf8")).name).toBe("project");
  });
});
