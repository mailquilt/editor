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
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            message:
              "Use styleProperties: styleMap writes a style attribute, which a strict Content Security Policy blocks. (ADR 0006)",
            name: "lit/directives/style-map.js",
          },
        ],
      },
    ],
  },
});
