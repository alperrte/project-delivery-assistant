import { defineConfig, devices } from "@playwright/test";
import { REJECTED_STATE } from "./e2e/consent-state";

// Real local PDA stack only. No API/socket interception, global seed or stale-account sweep.
export default defineConfig({
  testDir: "./e2e", testMatch: "meeting-real-final.spec.ts", workers: 1, retries: 0, timeout: 240_000,
  outputDir: "./test-results/meeting-real-final", reporter: [["list"]],
  use: { baseURL: "http://localhost:3000", storageState: REJECTED_STATE, trace: "off", video: "off", screenshot: "off", actionTimeout: 15_000, navigationTimeout: 30_000 },
  projects: [{ name: "chromium-real", use: { ...devices["Desktop Chrome"], permissions: ["camera", "microphone"],
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } } }],
});
