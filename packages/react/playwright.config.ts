import { defineConfig, devices } from "@playwright/test";

const port = 4174;

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
