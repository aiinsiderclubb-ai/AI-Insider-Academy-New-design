import { describe, expect, it } from "vitest";
import { toModules } from "@/content/catalog";

/**
 * The module split is invented — the catalogue only knows lessons — so the
 * one thing it must not do is contradict the course it is describing.
 */
const sizes = (count: number) => toModules(Array.from({ length: count }, (_, index) => index)).map((m) => m.length);

describe("toModules", () => {
  it("keeps a short course in one module", () => {
    expect(sizes(3)).toEqual([3]);
    expect(sizes(5)).toEqual([5]);
  });

  it("does not leave one or two lessons standing as a module of their own", () => {
    expect(sizes(6)).toEqual([6]);
    expect(sizes(7)).toEqual([7]);
    expect(sizes(12)).toEqual([5, 7]);
    expect(sizes(22)).toEqual([5, 5, 5, 7]);
  });

  it("still cuts in fives when the remainder is a real module", () => {
    expect(sizes(8)).toEqual([5, 3]);
    expect(sizes(15)).toEqual([5, 5, 5]);
    expect(sizes(20)).toEqual([5, 5, 5, 5]);
  });

  it("keeps every lesson, in order", () => {
    expect(toModules([1, 2, 3, 4, 5, 6, 7]).flat()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(toModules([])).toEqual([]);
  });
});
