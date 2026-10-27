import { defineConfig } from "@playwright/test";

// A real screen reader (NVDA) against the real stack. Not part of any CI suite: it needs an unlocked Windows desktop, takes the keyboard focus for the
// length of the run (real key presses go to the Playwright Chromium window), and starts a portable NVDA that is pointed to by NVDA_PORTABLE.
export default defineConfig({
  testDir: "./e2e/sr", testMatch: ["screenreader*.spec.ts", "smoke.spec.ts"], workers: 1, retries: 0, timeout: 600_000,
  globalSetup: "./e2e/qa-global-setup.ts", globalTeardown: "./e2e/qa-global-teardown.ts",
  outputDir: "./test-results/screenreader", reporter: [["list"]],
  use: { baseURL: "http://localhost:3000", headless: false, trace: "off", video: "off", screenshot: "off", viewport: null,
    launchOptions: { args: ["--force-renderer-accessibility", "--window-position=0,0", "--window-size=1280,860", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } },
});
