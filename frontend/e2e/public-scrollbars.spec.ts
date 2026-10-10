import { test, expect } from "@playwright/test";

// Real scrollbar paint must be visible in this visual acceptance case.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

// The signed-in workspace scrollbar (see workspace-scrollbars.spec.ts) is the reference: the same label-blue thumb on a
// transparent track, thin. Unauthenticated pages must use that very rule on their document, nothing new.
const PAGES = ["/", "/login", "/register", "/forgot-password", "/cookies"];

for (const locale of ["tr", "en", "de"] as const) {
  test(`unauthenticated pages use the workspace scrollbar on the document and keep inner scrollers native: ${locale}`, async ({ page, context }) => {
    test.setTimeout(120_000);
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    const seen: Record<string, string> = {};
    for (const route of PAGES) {
      await page.goto(route);
      await expect(page.locator("footer")).toBeAttached();
      for (const dark of [false, true]) {
        await page.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
        for (const width of [320, 1440]) {
          await page.setViewportSize({ width, height: 600 });
          const style = await page.evaluate(() => {
            const root = getComputedStyle(document.documentElement);
            const probe = document.createElement("span");
            probe.style.color = "var(--label-blue)";
            document.body.append(probe);
            const thumb = getComputedStyle(probe).color;
            probe.remove();
            // TEST-ONLY exclusion probe: the actual CSS cascade for scrollers nested in the page.
            const inner = ["textarea", "pre", "div"].map((tag) => {
              const el = document.createElement(tag);
              el.style.cssText = "overflow:auto;max-height:20px";
              document.body.append(el);
              return el;
            });
            const innerColors = inner.map((el) => getComputedStyle(el).scrollbarColor);
            const innerWidths = inner.map((el) => getComputedStyle(el).scrollbarWidth);
            inner.forEach((el) => el.remove());
            return { root: root.scrollbarColor, width: root.scrollbarWidth, body: getComputedStyle(document.body).scrollbarColor, thumb, innerColors, innerWidths };
          });
          const message = `${locale} ${route} ${dark ? "dark" : "light"} ${width}`;
          expect(style.root, message).toBe(`${style.thumb} rgba(0, 0, 0, 0)`);
          expect(style.width, message).toBe("thin");
          expect(style.body, message).toBe("auto");
          expect(style.innerColors, message).toEqual(["auto", "auto", "auto"]);
          expect(style.innerWidths, message).toEqual(["auto", "auto", "auto"]);
          // One palette per theme across every page.
          const key = `${dark}`;
          seen[key] ??= style.thumb;
          expect(style.thumb, message).toBe(seen[key]);
        }
      }
    }
    expect(seen.false).not.toBe(seen.true);
    await page.emulateMedia({ forcedColors: "active" });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarColor)).toBe("auto");
  });
}

test("the landing demo workspace keeps its own native scrollers", async ({ page }) => {
  await page.goto("/");
  const colors = await page.evaluate(() => [...document.querySelectorAll(".workspace-preview, .workspace-preview *")].filter((el) => {
    const style = getComputedStyle(el);
    return /(auto|scroll)/.test(style.overflowY);
  }).map((el) => getComputedStyle(el).scrollbarColor));
  expect(colors.every((color) => color === "auto")).toBe(true);
});
