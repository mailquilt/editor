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
  testDir: "browser-tests",
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    // Built here too, so a run started outside Turborepo can't test an old build.
    command: `blume build && blume preview --port ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
  },
});
