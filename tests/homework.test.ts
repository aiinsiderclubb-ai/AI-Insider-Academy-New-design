import { describe, expect, it } from "vitest";
import courses from "@/content/data/courses.json";
import { lessonHomework } from "@/content/catalog";

/**
 * A lesson's own assignment is looked up by course and lesson id. If either
 * drifts from the catalogue the tab simply disappears from the lesson — no
 * error anywhere — so the pairing is pinned against the course data itself.
 */
const RECORDED = ["first-automation-n8n", "ai-for-productivity"];

describe.each(RECORDED)("lessonHomework · %s", (courseId) => {
  const course = courses.courses.find((entry) => entry.id === courseId);

  it("has an assignment for every lesson", () => {
    expect(course?.lessons.length).toBe(3);
    for (const lesson of course?.lessons ?? []) {
      expect(lessonHomework(courseId, lesson.id), lesson.id).not.toBeNull();
    }
  });

  it("carries each part in both languages, point for point", () => {
    for (const lesson of course?.lessons ?? []) {
      const spec = lessonHomework(courseId, lesson.id);
      if (!spec) continue;
      for (const [ru, en] of [
        [spec.tasks, spec.tasksEn],
        [spec.deliverables, spec.deliverablesEn],
        [spec.criteria, spec.criteriaEn],
      ]) {
        expect(ru.length).toBeGreaterThan(0);
        expect(en.length).toBe(ru.length);
        expect([...ru, ...en].every((point) => point.trim().length > 0)).toBe(true);
      }
    }
  });

});

describe("lessonHomework", () => {
  it("is absent where nothing was written, so the lesson shows no assignment tab", () => {
    expect(lessonHomework("first-automation-n8n", "fn9")).toBeNull();
    expect(lessonHomework("ai-start", "as1")).toBeNull();
    expect(lessonHomework("no-such-course", "fn1")).toBeNull();
  });
});
