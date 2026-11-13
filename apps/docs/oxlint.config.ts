import { defineConfig } from "oxlint";

import { playwrightPackage } from "../../oxlint.config.mts";

// Its tests are Playwright tests, not Vitest ones.
export default defineConfig({
  ...playwrightPackage,
  overrides: [
    {
      // Blume names an island's MDX tag after its file, which must be PascalCase.
      files: ["islands/**"],
      rules: { "unicorn/filename-case": "off" },
    },
  ],
});
