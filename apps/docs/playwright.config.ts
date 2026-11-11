import { defineConfig, devices } from "@playwright/test";

const port = 4179;

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    { name: "chromium", use: devices["Desktop Chrome"] },
    { name: "firefox", use: devices["Desktop Firefox"] },
    { name: "webkit", use: devices["Desktop Safari"] },
  ],
  // CI's runners are slow enough that a key can land before the page has
  // caught up. A test that passes on a retry is still reported as flaky.
  retries: process.env.CI ? 2 : 0,
  testDir: "browser-tests",
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    // Built here too, so a run started outside Turborepo can't test an old build.
    command: `blume build && blume preview --port ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
    // The site builds first, which takes longer than the default minute on CI.
    timeout: 120_000,
  },
});
