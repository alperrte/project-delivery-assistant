import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import type { ChatOverview } from "../src/features/chat/types";

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
    expect(new URL(canonical!).pathname).toBe(`/${locale}/${{ tr: "ana-sayfa", en: "home", de: "startseite" }[locale]}`);
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
    for (const [progress, name, chapter] of [[0.04, "project-typing", "project"], [0.12, "project-form", "project"], [0.21, "project-created", "project"], [0.37, "team", "team"], [0.51, "task-typing", "task"], [0.65, "task-assigned", "task"]] as const) {
      await scrollScene(page, "#product", progress);
      await expect(page.locator("#product")).toHaveAttribute("data-chapter", chapter);
      await expect(page.locator("article[data-chapter]:visible")).toHaveCount(1);
      await page.screenshot({ path: path.join(captures, theme + "-" + name + ".png") });
    }
    for (const [progress, status] of [[0.705, "TODO"], [0.76, "IN_PROGRESS"], [0.815, "IN_REVIEW"], [0.875, "TESTING"], [0.95, "DONE"]] as const) {
      await scrollScene(page, "#product", progress);
      await expect(page.locator("#product")).toHaveAttribute("data-task-status", status);
    }
    await scrollScene(page, "#product", 0.965);
    await expect(page.locator("#product")).toHaveAttribute("data-chapter", "delivery");
    await expect(page.locator('[data-pda-demo-stage="delivery"]')).toHaveAttribute("data-demo-status", "DONE");
    await page.screenshot({ path: path.join(captures, theme + "-done.png") });
    await scrollScene(page, "#product", 0.1);
    // Scrolling still selects chapters; the demo's completed progress does not rewind.
    await expect(page.locator("#product")).toHaveAttribute("data-chapter", "project");
    await expect(page.locator("#product")).toHaveAttribute("data-task-status", "DONE");
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
    // Theme-hidden/lazy demo images need not load. Rendered images must finish
    // loading and decode successfully; poll rather than sampling the network once.
    await expect.poll(() => page.locator("img:visible").evaluateAll((images: HTMLImageElement[]) => images.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src))).toEqual([]);
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
      await expect(page.locator("#product")).toHaveAttribute("data-choreographed", "true");
      for (const selector of ["#product", "#open-source", "#join", "footer"]) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        if (selector === "#open-source") await scrollScene(page, selector, 1);
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
  await expect(page.locator("#product")).toHaveAttribute("data-choreographed", "true");
  await expect(page.locator("article[data-chapter]:visible")).toHaveCount(1);
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
  // TEST-ONLY: a chat overview is not a generic paged response. Returning one
  // used to crash ChatProvider after the shell had briefly appeared.
  const overview: ChatOverview = { group: null, groups: [], directs: [], totalUnread: 0 };
  await page.route("**/api/v1/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname.endsWith("/auth/me")
      ? { id: "landing-test", nickname: "LandingTest", email: "landing@example.com", globalRole: "USER", mustChangePassword: false }
      : pathname.endsWith("/chat/conversations") ? overview : { content: [], totalElements: 0, totalPages: 0, counts: {} };
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
  });
  const chatLoaded = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/chat/conversations") && response.status() === 200);
  await page.goto("/");
  await chatLoaded;
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

test("short landscape viewport keeps the complete story in normal flow", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await expect(page.locator("#product")).not.toHaveAttribute("data-choreographed", "true");
  await expect(page.locator("article[data-chapter]:visible")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(844);
});

test("mobile hamburger supports keyboard, nested controls, outside dismissal and desktop resizing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.locator('header button[aria-controls="landing-navigation"]');
  const navigation = page.locator("#landing-navigation");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).not.toBeVisible();
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(navigation).toBeVisible();
  await page.screenshot({ path: path.join(captures, "mobile-hamburger.png") });
  await page.keyboard.press("Tab");
  await expect(navigation.getByRole("button", { name: "Dil", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).not.toBeVisible();
  await expect(navigation).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(navigation).not.toBeVisible();
  await toggle.click();
  // Use the actual outside gutter: the expanded panel may cover the hero heading.
  const panel = await navigation.boundingBox();
  await page.mouse.click(panel!.x / 2, panel!.y + panel!.height / 2);
  await expect(navigation).not.toBeVisible();
  await toggle.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toggle).not.toBeVisible();
  await expect(navigation).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(navigation).not.toBeVisible();
  await toggle.click();
  await navigation.getByRole("link", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(/\/tr\/giris$/);
});

for (const [width, height] of [[320, 568], [390, 844], [768, 900], [1280, 720]]) {
  test(`compact story types and completes without overflow: ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [], requests: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.url().includes("/api/v1/")) requests.push(request.url()); });
    await page.goto("/");
    await expect(page.locator("#product")).toHaveAttribute("data-choreographed", "true");
    await scrollScene(page, "#product", 0.025);
    const name = page.locator('[data-pda-demo-stage="project"] #project-name');
    await expect(name).toBeVisible();
    const first = await name.inputValue();
    await scrollScene(page, "#product", 0.07);
    await expect.poll(() => name.inputValue()).not.toBe(first);
    if (width < 1024) {
      await expect.poll(async () => {
        const input = await name.boundingBox();
        const viewport = await page.locator('[data-pda-viewport="project"]').boundingBox();
        return input!.y >= viewport!.y && input!.y + input!.height <= viewport!.y + viewport!.height;
      }).toBe(true);
    }
    await page.screenshot({ path: path.join(captures, `${width}-${height}-project-typing.png`) });
    for (const [fraction, chapter] of [[0.4, "team"], [0.51, "task"], [0.95, "delivery"]] as const) {
      await scrollScene(page, "#product", fraction);
      await expect(page.locator("#product")).toHaveAttribute("data-chapter", chapter);
      const bounds = await page.locator("article[data-chapter]:visible").boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
      if (width < 768 && (chapter === "team" || chapter === "delivery")) {
        const target = chapter === "team" ? page.locator('[data-pda-demo-stage="team"] main ul[aria-label] > li').last()
          : page.locator('[data-pda-demo-stage="delivery"] [data-task-row]:visible').first();
        await expect.poll(async () => {
          const row = await target.boundingBox();
          const viewport = await page.locator(`[data-pda-viewport="${chapter}"]`).boundingBox();
          return !!row && row.y >= viewport!.y && row.y < viewport!.y + viewport!.height - 44;
        }).toBe(true);
      }
      await page.screenshot({ path: path.join(captures, `${width}-${height}-${chapter}.png`) });
    }
    await scrollScene(page, "#open-source", 0.015);
    await expect(page.locator("#open-source")).toHaveAttribute("data-choreographed", "true");
    const command = page.locator("[data-command]").first();
    const firstCommand = await command.textContent();
    await scrollScene(page, "#open-source", 0.045);
    await expect.poll(() => command.textContent()).not.toBe(firstCommand);
    await page.screenshot({ path: path.join(captures, `${width}-${height}-cmd-typing.png`) });
    await scrollScene(page, "#open-source", 0.7);
    const activeCommand = page.locator("[data-command-group]:visible").last();
    const terminal = await page.locator("[data-cmd-window]").boundingBox();
    const activeBounds = await activeCommand.boundingBox();
    expect(activeBounds!.y + activeBounds!.height).toBeLessThanOrEqual(terminal!.y + terminal!.height + 1);
    await scrollScene(page, "#open-source", 1);
    await expect(page.locator("#open-source a")).toBeVisible();
    const bounds = await page.locator("#open-source a").boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
    await page.screenshot({ path: path.join(captures, `${width}-${height}-tech.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.locator("#join").scrollIntoViewIfNeeded();
    await scrollScene(page, "#open-source", 0.9);
    await expect(page.locator("#open-source")).toHaveAttribute("data-completed", "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("#product")).not.toHaveAttribute("data-choreographed", "true");
    await expect(page.locator("[data-command-group]:visible")).toHaveCount(8);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("landing follows live changes to the global semantic palette", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("pda:motion", "off"));
  await page.goto("/");
  // The stored motion preference is applied after hydration; until then the CTA's colour transition (0.15s) still runs.
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--background", "#f5ebdb");
    document.documentElement.style.setProperty("--foreground", "#302718");
    document.documentElement.style.setProperty("--primary", "#34613d");
  });
  // Auto-waiting: a one-shot read right after setProperty can still see the first frame of the (0.01ms) transition.
  await expect(page.locator("#landing-main").locator("xpath=..")).toHaveCSS("background-color", "rgb(245, 235, 219)");
  await expect(page.locator('main a[href="/tr/kayit"]')).toHaveCSS("background-color", "rgb(52, 97, 61)");
});
