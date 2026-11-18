import { defineConfig, devices } from "@playwright/test";

const port = 4173;

export default defineConfig({
  // A test that passes only on a retry fails the run, so a flake is seen and
  // fixed. The retries are kept to tell a flake from a test that always fails,
  // and to record a trace of the retry.
  failOnFlakyTests: Boolean(process.env.CI),
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    { name: "chromium", use: devices["Desktop Chrome"] },
    { name: "firefox", use: devices["Desktop Firefox"] },
    { name: "webkit", use: devices["Desktop Safari"] },
  ],
  retries: process.env.CI ? 2 : 0,
  testDir: "browser-tests",
  use: {
    baseURL: `http://localhost:${port}`,
    // Kept for a test that fails, even when a retry then passes, as CI keeps them.
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: `vite build browser-tests/host && vite preview browser-tests/host --port ${port} --strictPort`,
    port,
    // Never another run's server, which could be serving older code.
    reuseExistingServer: false,
  },
});
