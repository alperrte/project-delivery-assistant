import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const captures = path.resolve("../tmp/landing-qa");
async function scrollScene(page: Page, id: string, progress: number) {
  await page.locator(id).evaluate((element, fraction) => {
    const start = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, start + (element.getBoundingClientRect().height - innerHeight) * fraction);
  }, progress);
  await page.waitForTimeout(100);
}

for (const [locale, heading] of [["tr", "Fikrinle başla."], ["en", "Start with your idea."], ["de", "Starte mit deiner Idee."]] as const) {
  test("localized story, metadata and no backend requests: " + locale, async ({ page, context }) => {
    const errors: string[] = [];
    const requests: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.url().includes("/api/v1/")) requests.push(request.url()); });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("pda:motion", "off"));
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    expect((await page.goto("/"))?.status()).toBe(200);
    await expect(page.locator("#landing-heading")).toContainText(heading);
    await expect(page.locator("#landing-heading")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.locator("article[data-chapter]:visible")).toHaveCount(4);
    await expect(page.locator(".workspace-preview")).toHaveCount(4);
    await expect(page.locator('[data-pda-demo-stage="delivery"]')).toHaveAttribute("data-demo-status", "DONE");
    await expect(page.locator("#product video, #product canvas, #product iframe")).toHaveCount(0);
    await expect(page).toHaveTitle(/PDA/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical!).pathname).toBe(`/${locale}`);
    expect(new URL(canonical!).search).toBe("");
    await expect(page.locator("#open-source")).toContainText("docker compose up --build -d");
    await expect(page.locator("#open-source")).toContainText("npm ci");
    await expect(page.locator("#open-source")).toContainText("npm run dev");
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const theme of ["light", "dark"]) {
  test("desktop scroll choreography and CMD typing: " + theme, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", msg => { if (msg.type() === "error" || /hydration/i.test(msg.text())) errors.push(msg.text()); });
    await page.addInitScript(value => localStorage.setItem("theme", value), theme);
    await page.goto("/");
    await expect(page.locator("#product")).toHaveAttribute("data-choreographed", "true");
    await expect(page.locator("#open-source")).toHaveAttribute("data-choreographed", "true");
    await page.screenshot({ path: path.join(captures, theme + "-welcome.png") });
    for (const [progress, name, chapter] of [[0.04, "project-typing", "project"], [0.12, "project-form", "project"], [0.21, "project-created", "project"], [0.37, "team", "team"], [0.51, "task-typing", "task"], [0.65, "task-assigned", "task"], [0.965, "done", "delivery"]] as const) {
      await scrollScene(page, "#product", progress);
      await expect(page.locator("#product")).toHaveAttribute("data-chapter", chapter);
      await expect(page.locator("article[data-chapter]:visible")).toHaveCount(1);
      await page.screenshot({ path: path.join(captures, theme + "-" + name + ".png") });
    }
    await expect(page.locator("#product")).toHaveAttribute("data-task-status", "DONE");
    await expect(page.locator('[data-pda-demo-stage="delivery"]')).toHaveAttribute("data-demo-status", "DONE");
    for (const [progress, status] of [[0.705, "TODO"], [0.76, "IN_PROGRESS"], [0.815, "IN_REVIEW"], [0.875, "TESTING"], [0.95, "DONE"]] as const) {
      await scrollScene(page, "#product", progress);
      await expect(page.locator("#product")).toHaveAttribute("data-task-status", status);
    }
    await scrollScene(page, "#product", 0.1);
    await expect(page.locator("#product")).toHaveAttribute("data-chapter", "project");
    for (const [progress, name] of [[0.005, "cmd-start"], [0.04, "cmd-typing"], [0.55, "cmd-docker"], [0.735, "cmd-ready"], [1, "tech-reveal"]] as const) {
      await scrollScene(page, "#open-source", progress);
      if (progress < 0.74) expect(await page.locator("[data-fact]").evaluateAll(elements => elements.every(el => getComputedStyle(el).visibility === "hidden"))).toBe(true);
      await page.screenshot({ path: path.join(captures, theme + "-" + name + ".png") });
    }
    await expect(page.locator("#open-source")).toHaveAttribute("data-ready", "true");
    await expect(page.locator("[data-command-group]:visible").last()).toContainText("npm run dev");
    expect(await page.locator("[data-cmd-window]").evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)).toBeCloseTo(0.74, 2);
    await expect(page.locator("#open-source a")).toBeVisible();
    await page.locator("#join").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(captures, theme + "-final.png") });
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(captures, theme + "-footer.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
    expect(await page.locator("img").evaluateAll((images: HTMLImageElement[]) => images.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src))).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const width of [320, 390, 768, 1280, 1440, 1920]) {
  test("responsive layout and themes: " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page.addInitScript(value => localStorage.setItem("theme", value), theme);
      await page.goto("/");
      await expect(page.locator("#landing-heading")).toBeVisible();
      if (width < 1024) await expect(page.locator("#product")).not.toHaveAttribute("data-choreographed", "true");
      for (const selector of ["#product", "#open-source", "#join", "footer"]) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        if (width >= 1024 && selector === "#open-source") await scrollScene(page, selector, 1);
        const escaped = await page.locator('header a:visible, header button:visible, main a:visible, footer a:visible').evaluateAll(elements => elements.filter(el => {
          if (el.closest("[inert]")) return false;
          const rect = el.getBoundingClientRect();
          return rect.left < -1 || rect.right > innerWidth + 1;
        }).map(el => el.textContent));
        expect(escaped).toEqual([]);
      }
      if (width === 390 || width === 768 || width === 1920) await page.screenshot({ path: path.join(captures, width + "-" + theme + ".png"), fullPage: width < 1024 });
    }
  });
}

test("keyboard, chapter shortcuts and live animation preference changes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#product")).toHaveAttribute("data-choreographed", "true");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "İçeriğe geç", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#landing-main")).toBeFocused();
  await page.locator('[data-chapter-link][href="#story-team"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#product")).toHaveAttribute("data-chapter", "team");
  await page.evaluate(() => {
    localStorage.setItem("pda:motion", "off");
    window.dispatchEvent(new Event("pda:preferences-changed"));
  });
  await expect(page.locator("#product")).not.toHaveAttribute("data-choreographed", "true");
  await expect(page.locator("#open-source")).not.toHaveAttribute("data-choreographed", "true");
  await expect(page.locator("article[data-chapter]:visible")).toHaveCount(4);
  await expect(page.locator("[data-command-group]:visible")).toHaveCount(8);
  expect(await page.locator("[data-cmd-window]").evaluate(el => getComputedStyle(el).transform)).toBe("none");
  await page.screenshot({ path: path.join(captures, "reduced-motion.png"), fullPage: true });
  await page.evaluate(() => {
    localStorage.setItem("pda:motion", "on");
    window.dispatchEvent(new Event("pda:preferences-changed"));
  });
  await expect(page.locator("#product")).toHaveAttribute("data-choreographed", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#product")).not.toHaveAttribute("data-choreographed", "true");
  await expect(page.locator("article[data-chapter]:visible")).toHaveCount(4);
});

test("CTA and information links reach existing routes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("pda:motion", "off"));
  await page.goto("/");
  await page.locator('main a[href="/tr/kayit"]').click();
  await expect(page).toHaveURL(/\/tr\/kayit$/);
  await page.goto("/");
  await page.locator('header a[href="/tr/giris"]').click();
  await expect(page).toHaveURL(/\/tr\/giris$/);
  for (const target of ["/tr/sss", "/tr/kvkk", "/tr/gizlilik", "/tr/erisilebilirlik"]) {
    await page.goto("/");
    await page.locator('footer a[href="' + target + '"]').click();
    await expect(page).toHaveURL(new RegExp(target + "$"));
  }
  for (const target of ["https://github.com/alperrte", "https://github.com/HmzT270", "https://github.com/alperrte/project-delivery-assistant"]) {
    await page.goto("/");
    await expect(page.locator('footer a[href="' + target + '"]')).toHaveCount(1);
  }
});

test("session hint continues to the verified app shell", async ({ page, context }) => {
  await context.addCookies([{ name: "PDA_SESSION", value: "1", url: "http://localhost:3000" }]);
  await page.route("**/api/v1/**", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" }, body: JSON.stringify(new URL(route.request().url()).pathname.endsWith("/auth/me") ? { id: "landing-test", nickname: "LandingTest", email: "landing@example.com", globalRole: "USER", mustChangePassword: false } : { content: [], totalElements: 0, totalPages: 0, counts: {} }) }));
  await page.goto("/");
  await expect(page).toHaveURL(/\/tr\/genel-bakis$/);
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator("footer")).toHaveCount(0);
});

test("complete story and CTA render without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, locale: "tr-TR" });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/");
  await expect(page.locator("#landing-heading")).toContainText("Fikrinle başla.");
  await expect(page.locator("article[data-chapter]:visible")).toHaveCount(4);
  await expect(page.locator('main a[href="/tr/kayit"]')).toBeVisible();
  await expect(page.locator("[data-command-group]:visible")).toHaveCount(8);
  await context.close();
});

test("homepage remains in sitemap and robots", async ({ request }) => {
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Allow: /");
  expect(await robots.text()).toContain("Disallow: /tr/genel-bakis");
});

test("short laptop viewport keeps the complete story in normal flow", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.locator("#product")).not.toHaveAttribute("data-choreographed", "true");
  await expect(page.locator("article[data-chapter]:visible")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
});

test("landing follows live changes to the global semantic palette", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("pda:motion", "off"));
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--background", "#f5ebdb");
    document.documentElement.style.setProperty("--foreground", "#302718");
    document.documentElement.style.setProperty("--primary", "#34613d");
  });
  expect(await page.locator("#landing-main").evaluate(el => getComputedStyle(el.parentElement!).backgroundColor)).toBe("rgb(245, 235, 219)");
  expect(await page.locator('main a[href="/tr/kayit"]').evaluate(el => getComputedStyle(el).backgroundColor)).toBe("rgb(52, 97, 61)");
});
