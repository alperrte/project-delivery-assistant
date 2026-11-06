import { defineConfig, devices } from "@playwright/test";
import { REJECTED_STATE } from "./e2e/consent-state";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["theme-colors.spec.ts", "theme-colors-logic.spec.ts", ...(process.env.THEME_REAL_API === "1" ? ["theme-colors-real.spec.ts"] : [])],
  timeout: 60_000, expect: { timeout: 15_000 }, workers: 1, retries: 0, reporter: "list",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", storageState: REJECTED_STATE,
    screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
