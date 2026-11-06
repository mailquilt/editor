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
  testDir: "browser-tests",
  use: { baseURL: `http://localhost:${port}` },
  webServer: {
    command: `vite build browser-tests/host && vite preview browser-tests/host --port ${port} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
  },
});
