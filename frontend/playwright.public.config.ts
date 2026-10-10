import { defineConfig, devices } from "@playwright/test";
import { REJECTED_STATE } from "./e2e/consent-state";

// Public information and footer checks do not need backend accounts.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["cookie-consent.spec.ts", "contact-form.spec.ts", "legal-pages.spec.ts", "form-first-error-focus-public.spec.ts", "form-loading-state-public.spec.ts", "form-submit-results-public.spec.ts", "ui-ux-public.spec.ts", "footer-public-pages.spec.ts", "license-page.spec.ts", "about-page.spec.ts", "error-pages.spec.ts", "landing-page.spec.ts", "landing-real-ui.spec.ts", "localized-routing.spec.ts", "a11y-public.spec.ts", "public-scrollbars.spec.ts"],
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
