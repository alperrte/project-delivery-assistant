import { defineConfig, devices } from "@playwright/test";

// Public information and footer checks do not need backend accounts.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "footer-public-pages.spec.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    locale: "tr-TR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
