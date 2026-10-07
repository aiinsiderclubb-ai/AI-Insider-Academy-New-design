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
    alias: {
      "@": path.dirname(new URL(import.meta.url).pathname),
      /*
       * `server-only` throws the moment it is imported outside a React Server
       * Component, which would put every module carrying that guard out of
       * reach of a test. The stub disarms it here only — the real package is
       * what `next build` resolves, so the guard still holds where it matters.
       */
      "server-only": path.join(path.dirname(new URL(import.meta.url).pathname), "tests/stubs/server-only.ts"),
    },
  },
});
