import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "meetings.spec.ts", workers: 1, retries: 0,
  outputDir: "./test-results/meeting-system",
  reporter: [["list"]], use: { baseURL: "http://localhost:3000", trace: "off", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen", "--enable-usermedia-screen-capturing"] } } }],
});
