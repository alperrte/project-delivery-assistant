import { defineConfig, devices } from "@playwright/test";
import { REJECTED_STATE } from "./e2e/consent-state";

// Frontend-only regression entry point: deliberately no DB/account setup or teardown.
export default defineConfig({
  testDir: "./e2e", workers: 1, retries: 0, timeout: 60_000,
  outputDir: "./test-results/meeting-search", reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", storageState: REJECTED_STATE, serviceWorkers: "block", trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium-search", testMatch: "meeting-a11y.spec.ts", grep: /isolated attendee search/, use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-routing", testMatch: ["meeting-routing.spec.ts", "localized-routing.spec.ts"], use: { ...devices["Desktop Chrome"] } },
    { name: "meeting-logic", testMatch: ["meeting-global-logic.spec.ts", "meeting-schedule-logic.spec.ts", "meeting-room-logic.spec.ts"] },
  ],
});
