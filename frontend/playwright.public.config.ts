import { defineConfig, devices } from "@playwright/test";
import { REJECTED_STATE } from "./e2e/consent-state";

// Public pages and isolated workspace presentation checks do not need backend accounts.
export default defineConfig({
  testDir: "./e2e",
  // Project platform presentation uses isolated API fixtures; persistence is tested against PostgreSQL.
  testMatch: ["meeting-global-logic.spec.ts", "cookie-consent.spec.ts", "contact-form.spec.ts", "legal-pages.spec.ts", "form-first-error-focus-public.spec.ts", "form-loading-state-public.spec.ts", "form-submit-results-public.spec.ts", "ui-ux-public.spec.ts", "footer-public-pages.spec.ts", "license-page.spec.ts", "about-page.spec.ts", "error-pages.spec.ts", "landing-page.spec.ts", "landing-real-ui.spec.ts", "workspace-mobile-header.spec.ts", "project-multiple-types.spec.ts", "localized-routing.spec.ts", "a11y-public.spec.ts", "public-scrollbars.spec.ts"],
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "tr-TR",
    // Not about the banner: start as a visitor who already decided (analytics off).
    storageState: REJECTED_STATE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Cross-browser run of the same public checks: `E2E_CROSS_BROWSER=1 npx playwright test -c playwright.public.config.ts`
    // (needs `npx playwright install firefox webkit` once). Off by default so the normal gate stays Chromium-only.
    ...(process.env.E2E_CROSS_BROWSER === "1"
      ? [
          { name: "firefox", use: { ...devices["Desktop Firefox"] } },
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
          // The installed, branded Chromium browsers (Blink): Chrome and Edge by channel, Opera (or any other Blink browser) by
          // `E2E_OPERA_PATH=<path to opera.exe>`.
          { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
          { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
          // Phones and a tablet (touch, small viewports, mobile user agents). Emulation: it complements, not replaces, a real device.
          { name: "mobile-safari", use: { ...devices["iPhone 15"] } },
          { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
          { name: "tablet-safari", use: { ...devices["iPad (gen 7)"] } },
          ...(process.env.E2E_OPERA_PATH
            ? [{ name: "opera", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.E2E_OPERA_PATH } } }]
            : []),
        ]
      : []),
  ],
});
