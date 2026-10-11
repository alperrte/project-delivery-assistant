import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Every case uses its own browser context and only reads public content.
test.describe.configure({ mode: "parallel" });

const paths = ["/", "/login", "/register", "/forgot-password", "/verify-email", "/delete-account", "/about", "/faq", "/kvkk", "/privacy", "/terms", "/cookies", "/contact", "/accessibility", "/license"] as const;
const locales = ["tr", "en", "de"] as const;
const themes = ["light", "dark"] as const;
const viewports = [{ name: "mobile", width: 320, height: 844 }, { name: "desktop", width: 1440, height: 900 }] as const;

/** WCAG 2.0, 2.1 and 2.2 at levels A and AA: the target stated in the accessibility checklist. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const locale of locales) {
  for (const theme of themes) {
    for (const viewport of viewports) {
      test.describe(`axe ${locale} ${theme} ${viewport.name}`, () => {
        test.use({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce" });

        for (const path of paths) {
          test(path, async ({ page, context }) => {
            await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
            await page.addInitScript(value => localStorage.setItem("theme", value), theme);
            await page.goto(path);
            await expect(page.locator("h1").first()).toBeVisible();
            await page.evaluate(() => document.fonts.ready);
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
            const { violations, incomplete } = await new AxeBuilder({ page })
              // The Next.js dev indicator is not part of the product.
              .exclude("nextjs-portal")
              .withTags(WCAG_TAGS)
              .analyze();
            // "Incomplete" means axe could not decide. Contrast over photos and translucent layers is the known case
            // and is measured separately; anything else needing review must fail instead of passing silently.
            const contrastUndecided = incomplete.find(item => item.id === "color-contrast");
            if (contrastUndecided) {
              test.info().annotations.push({ type: "contrast-not-verified", description: String(contrastUndecided.nodes.length) + " element(s)" });
            }
            expect(incomplete.filter(item => item.id !== "color-contrast").map(item => ({ rule: item.id, targets: item.nodes.map(node => node.target.join(" ")) }))).toEqual([]);
            expect(
              violations.map(violation => ({
                rule: violation.id,
                impact: violation.impact,
                help: violation.help,
                targets: violation.nodes.map(node => node.target.join(" ")),
              })),
            ).toEqual([]);
          });
        }
      });
    }
  }
}
