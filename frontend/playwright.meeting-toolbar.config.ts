import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.meeting-search.config";

// Frontend layout/regression only: existing synthetic REST fixture, no DB setup or media join.
export default defineConfig({
  ...base, outputDir: "./test-results/meeting-toolbar",
  projects: [...base.projects!,
    { name: "chromium-toolbar", testMatch: "meeting-toolbar.spec.ts", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-meeting-list", testMatch: "meeting-final.spec.ts", grep: /pagination targets/, use: { ...devices["Desktop Chrome"] } },
  ],
});
