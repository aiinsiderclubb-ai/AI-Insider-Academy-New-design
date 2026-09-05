import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Node environment only. Everything under test here is logic that runs on the
 * server or is pure — locale matching, redirect safety, proxy scoping,
 * dictionary completeness. Component rendering would need jsdom and a much
 * larger surface; that is a separate decision, not a default.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.dirname(new URL(import.meta.url).pathname) },
  },
});
