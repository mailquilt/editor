import { defineConfig, devices } from "@playwright/test";

import { cdnPort, freshProjectDir, freshProjects } from "./fresh-projects.ts";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  // These check the packages, and the browser tests of each package cover the
  // other browsers.
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  // CI's runners are slow enough that a key can land before the page has
  // caught up. A test that passes on a retry is still reported as flaky.
  retries: process.env.CI ? 2 : 0,
  testDir: "tests",
  // The fresh projects are the quick-start code the docs show, which marks its
  // outputs with ids rather than test-only attributes.
  use: { testIdAttribute: "id" },
  // Each runs directly, because Playwright's stop signal doesn't get past `pnpm`.
  webServer: [
    {
      command: `node serve.js . ${freshProjects.cdn.port}`,
      cwd: freshProjectDir("cdn"),
      port: freshProjects.cdn.port,
    },
    {
      // Only the installed package, so the build can't reach its dependencies.
      command: `node serve.js node_modules/@mailquilt/editor ${cdnPort}`,
      cwd: freshProjectDir("cdn"),
      port: cdnPort,
    },
    {
      command: `node_modules/.bin/vite preview --port ${freshProjects["plain-js"].port} --strictPort`,
      cwd: freshProjectDir("plain-js"),
      port: freshProjects["plain-js"].port,
    },
    {
      command: `node_modules/.bin/vite preview --port ${freshProjects["react-vite"].port} --strictPort`,
      cwd: freshProjectDir("react-vite"),
      port: freshProjects["react-vite"].port,
    },
    {
      command: `node_modules/.bin/next start --port ${freshProjects.react.port}`,
      cwd: freshProjectDir("react"),
      env: { NEXT_TELEMETRY_DISABLED: "1" },
      port: freshProjects.react.port,
    },
  ],
});
