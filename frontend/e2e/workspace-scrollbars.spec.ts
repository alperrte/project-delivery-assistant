import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFileSync } from "node:fs";
import { MANAGER_USER_FILE } from "./global-setup";
import { login } from "./helpers";

// Real scrollbar paint must be visible in this visual acceptance case.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test("workspace document/sidebar blue scrollbars exclude nested form/chat/modal surfaces across themes and locales", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext(), page = await context.newPage();
  try {
    const manager = JSON.parse(readFileSync(MANAGER_USER_FILE, "utf8")); await login(page, manager.email, manager.password);
    for (const locale of ["tr", "en", "de"]) {
      for (const dark of [false, true]) {
        await page.goto(`/${locale}/account`); await expect(page.locator("#main-content")).toBeVisible();
        await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), dark);
        for (const width of [320, 390, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 500 });
          const style = await page.evaluate(() => {
            const root = getComputedStyle(document.documentElement), body = getComputedStyle(document.body), nav = getComputedStyle(document.querySelector('[data-workspace-scroll="sidebar"]')!);
            // TEST-ONLY exclusion probe: actual CSS cascade, no API/mock response and no application state mutation.
            const elements = ["textarea", "pre", "div"].map(tag => { const el = document.createElement(tag); el.style.cssText = "overflow:auto;max-height:20px"; document.getElementById("main-content")!.append(el); return el; });
            const excluded = elements.map(el => getComputedStyle(el).scrollbarColor); elements.forEach(el => el.remove());
            return { root: root.scrollbarColor, width: root.scrollbarWidth, body: body.scrollbarColor, nav: nav.scrollbarColor, token: root.getPropertyValue("--label-blue").trim(), excluded };
          });
          expect(style.root).not.toBe("auto"); expect(style.width).toBe("thin"); expect(style.body).toBe("auto"); expect(style.nav).toBe(style.root); expect(style.excluded).toEqual(["auto", "auto", "auto"]);
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          if (width === 320 || width === 1440) await page.screenshot({ path: path.resolve(__dirname, `../../.local/frontend-foundation/scrollbar-${locale}-${width}-${dark ? "dark" : "light"}.png`) });
        }
      }
    }
    await page.emulateMedia({ forcedColors: "active" }); expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarColor)).toBe("auto");
  } finally { await context.close(); }
});
