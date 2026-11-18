import { defineConfig } from "vitest/config";

// The key map's unit tests. Everything else is tested in the browser, by
// Playwright, whose files are in browser-tests.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
