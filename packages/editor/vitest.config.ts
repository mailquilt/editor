import { defineConfig } from "vitest/config";

// Unit tests of the code that needs no page. Everything else is tested in the
// browser, by Playwright, whose files are in browser-tests.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
