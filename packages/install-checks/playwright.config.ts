import { defineConfig, devices } from "@playwright/test";

import { freshProjectDir, freshProjects } from "./fresh-projects.ts";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  // These check the packages, and the browser tests of each package cover the
  // other browsers.
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  testDir: "tests",
  // Each runs directly, because Playwright's stop signal doesn't get past `pnpm`.
  webServer: [
    {
      command: `node_modules/.bin/vite preview --port ${freshProjects["plain-js"].port} --strictPort`,
      cwd: freshProjectDir("plain-js"),
      port: freshProjects["plain-js"].port,
    },
    {
      command: `node_modules/.bin/next start --port ${freshProjects.react.port}`,
      cwd: freshProjectDir("react"),
      env: { NEXT_TELEMETRY_DISABLED: "1" },
      port: freshProjects.react.port,
    },
  ],
});
