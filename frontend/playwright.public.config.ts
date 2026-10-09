import { defineConfig, devices } from "@playwright/test";

// Public information and footer checks do not need backend accounts.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["footer-public-pages.spec.ts", "license-page.spec.ts", "about-page.spec.ts", "error-pages.spec.ts", "landing-page.spec.ts", "landing-real-ui.spec.ts", "localized-routing.spec.ts", "a11y-public.spec.ts"],
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "tr-TR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
