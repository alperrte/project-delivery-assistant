import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.meeting-search.config";

export default defineConfig({
  ...base, outputDir: "./test-results/meeting-final",
  projects: [...base.projects!, {
    name: "chromium-final", testMatch: "meeting-final.spec.ts", use: {
      ...devices["Desktop Chrome"], permissions: ["microphone", "camera"],
      launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
    },
  }],
});
