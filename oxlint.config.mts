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
    // Mockups, drawn by hand to design the editor; not shipped.
    "docs/design",
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
  overrides: [
    {
      // A browser test's steps act on one page, each from where the last left
      // it, so they wait in turn.
      files: ["browser-tests/**"],
      rules: { "no-await-in-loop": "off" },
    },
  ],
});
