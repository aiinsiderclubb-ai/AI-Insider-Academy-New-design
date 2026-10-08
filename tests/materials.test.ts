import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import courses from "@/content/data/courses.json";
import { lessonMaterials } from "@/content/catalog";

/**
 * Materials are prose and links in a data file, so nothing fails loudly when
 * one is wrong: a file that was never committed downloads a 404, an item
 * missing its text renders an empty box. These are the checks a build cannot
 * make for us.
 */
describe("lessonMaterials", () => {
  const course = courses.courses.find((entry) => entry.id === "first-automation-n8n");
  const all = (course?.lessons ?? []).flatMap((lesson) =>
    lessonMaterials("first-automation-n8n", lesson.id).map((item) => ({ lesson: lesson.id, item })),
  );

  it("gives every lesson of the free n8n course something to take away", () => {
    for (const lesson of course?.lessons ?? []) {
      expect(lessonMaterials("first-automation-n8n", lesson.id).length, lesson.id).toBeGreaterThan(0);
    }
  });

  it("names and describes every item in both languages", () => {
    for (const { lesson, item } of all) {
      for (const value of [item.title, item.titleEn, item.note, item.noteEn]) {
        expect(value?.trim().length, `${lesson}: ${item.title}`).toBeGreaterThan(0);
      }
    }
  });

  it("has something to copy in every copy block", () => {
    for (const { item } of all.filter((entry) => entry.item.kind === "copy")) {
      expect(item.text?.trim().length, item.title).toBeGreaterThan(0);
      expect(item.textEn?.trim().length, item.title).toBeGreaterThan(0);
    }
  });

  it("only offers files that are actually in /public", () => {
    const files = all.filter((entry) => entry.item.kind === "file");
    expect(files.length).toBeGreaterThan(0);
    for (const { item } of files) {
      expect(item.href?.startsWith("/"), item.title).toBe(true);
      expect(existsSync(path.join(process.cwd(), "public", item.href ?? "")), item.href).toBe(true);
    }
  });

  it("links out over https only", () => {
    for (const { item } of all.filter((entry) => entry.item.kind === "link")) {
      expect(item.url, item.title).toMatch(/^https:\/\//);
    }
  });

  it("never ships a credential inside a snippet", () => {
    // The lesson's own rule: tokens and keys do not go into published material.
    for (const { item } of all.filter((entry) => entry.item.kind === "copy")) {
      expect(`${item.text}${item.textEn}`, item.title).not.toMatch(/sk-[A-Za-z0-9]{16,}|\d{8,10}:[A-Za-z0-9_-]{30,}/);
    }
  });

  it("is empty for a lesson that has none, so the tab stays hidden", () => {
    expect(lessonMaterials("ai-start", "as1")).toEqual([]);
    expect(lessonMaterials("first-automation-n8n", "fn9")).toEqual([]);
  });
});
