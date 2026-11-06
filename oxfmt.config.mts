import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    // Installed from elsewhere, not written here.
    ".agents",
    ".claude",
    "skills-lock.json",
    // Prose is wrapped by hand.
    "**/*.md",
    // Must stay byte-for-byte what the renderer produced.
    "packages/renderer/test/expected",
    ".blume",
    "test-results",
    "playwright-report",
  ],
});
