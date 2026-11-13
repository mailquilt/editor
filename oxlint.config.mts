import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import playwright from "ultracite/oxlint/playwright";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

const root = defineConfig({
  env: core.env,
  extends: [core, vitest],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    ".agents",
    ".claude",
    ".blume",
    "test-results",
    "playwright-report",
  ],
});

export default root;

/**
 * For a package whose tests are Playwright tests. Oxlint lints each file with
 * its nearest config alone, so such a package's config is this one.
 */
export const playwrightPackage = defineConfig({
  env: root.env,
  extends: [core, playwright, react],
  ignorePatterns: root.ignorePatterns,
});
