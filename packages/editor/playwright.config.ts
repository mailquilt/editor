import { defineConfig, devices } from "@playwright/test";

const port = 4173;

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
    command: `vite build browser-tests/host && vite preview browser-tests/host --port ${port} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
  },
});
