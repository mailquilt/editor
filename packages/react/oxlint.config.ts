import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import playwright from "ultracite/oxlint/playwright";
import react from "ultracite/oxlint/react";

import root from "../../oxlint.config.mts";

// Oxlint lints each file with its nearest config alone. This package's tests
// are Playwright tests, so it uses that preset instead of the root's Vitest one.
export default defineConfig({
  env: root.env,
  extends: [core, playwright, react],
  ignorePatterns: root.ignorePatterns,
  settings: root.settings,
});
