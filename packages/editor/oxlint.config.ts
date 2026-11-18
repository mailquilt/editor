import { defineConfig } from "oxlint";
import vitest from "ultracite/oxlint/vitest";

import { playwrightPackage } from "../../oxlint.config.mts";

// Its browser tests are Playwright tests. Only the key map's, in test, are
// Vitest ones.
export default defineConfig({
  ...playwrightPackage,
  overrides: [
    ...(playwrightPackage.overrides ?? []),
    ...(vitest.overrides ?? []).map((override) => ({
      ...override,
      files: ["test/**/*.test.ts"],
    })),
  ],
});
