import { test, expect, type Page } from "@playwright/test";
import type { ChatOverview } from "../src/features/chat/types";
import tr from "../src/i18n/landing/tr.json";
import en from "../src/i18n/landing/en.json";
import de from "../src/i18n/landing/de.json";

const SECTIONS = ["#stack-heading", "#meetings", "#chat", "#tasks", "#repository", "#organizations", "#open-source", "#join"];
const DEMOS = 6;

/** Walks the whole page so lazy demos mount and scroll scenes run; returns to the top. */
async function tour(page: Page) {
  const step = Math.round((page.viewportSize()?.height ?? 800) * .7);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += step) {
    await page.evaluate(top => window.scrollTo(0, top), y);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
}
const mountedDemos = (page: Page) => page.locator("[data-demo] > .workspace-preview > *");
const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const offscreenControls = (page: Page) => page.locator("header a:visible, header button:visible, main a:visible, main button:visible, footer a:visible").evaluateAll(elements => elements.filter(el => {
  if (el.closest("[inert]")) return false;
  const rect = el.getBoundingClientRect();
  return rect.left < -1 || rect.right > innerWidth + 1;
}).map(el => el.textContent));

for (const [locale, copy] of [["tr", tr], ["en", en], ["de", de]] as const) {
  test("localized sections, metadata and no backend requests: " + locale, async ({ page, context, baseURL }) => {
    const errors: string[] = [], requests: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.url().includes("/api/v1/")) requests.push(request.url()); });
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL! }]);
    expect((await page.goto("/"))?.status()).toBe(200);
    const heading = page.locator("#landing-heading");
    await expect(heading).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(heading).toContainText(copy.heroLine1);
    await expect(heading).toContainText(copy.heroLine2);
    for (const id of ["meetings", "chat", "tasks", "repository", "organizations"]) await expect(page.locator("#" + id + "-title")).toHaveText(copy[(id === "meetings" ? "meetingTitle" : id === "chat" ? "chatTitle" : id === "tasks" ? "taskTitle" : id === "repository" ? "repoTitle" : "orgTitle")]);
    await expect(page.locator("#stack-heading")).toHaveText(copy.stackTitle);
    await expect(page.locator("#final-heading")).toHaveText(copy.finalTitle);
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.locator("main video, main canvas, main iframe")).toHaveCount(0);
    await expect(page).toHaveTitle(/PDA/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical!).pathname).toBe(`/${locale}/${{ tr: "ana-sayfa", en: "home", de: "startseite" }[locale]}`);
    expect(new URL(canonical!).search).toBe("");
    await expect(page.locator("#open-source")).toContainText("docker compose up --build -d");
    await expect(page.locator("#open-source")).toContainText("npm run dev");
    await tour(page);
    await expect.poll(() => mountedDemos(page).count()).toBeGreaterThanOrEqual(DEMOS);
    // Demos run on fixtures: scrolling past every one of them never reaches the API.
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("every section exists in order and the sticky header marks the current one", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const tops = await page.evaluate(ids => ids.map(id => document.querySelector(id)!.getBoundingClientRect().top + scrollY), SECTIONS);
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  const features = page.locator('header a[href="#features"]');
  const source = page.locator('header a[href="#open-source"]');
  await features.click();
  await expect(features).toHaveAttribute("aria-current", "location");
  await source.click();
  await expect(source).toHaveAttribute("aria-current", "location");
  await expect(features).not.toHaveAttribute("aria-current", "location");
  await expect(page.locator("header").first()).toHaveAttribute("data-scrolled", "true");
});

test("demos are inert fixtures with a text alternative", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/v1/")) requests.push(request.url()); });
  await page.goto("/");
  await tour(page);
  await expect(page.locator("[data-demo]")).toHaveCount(DEMOS);
  await expect.poll(() => mountedDemos(page).count()).toBeGreaterThanOrEqual(DEMOS);
  for (const demo of await page.locator("[data-demo]").all()) {
    const surface = demo.locator("> .workspace-preview");
    await expect(surface).toHaveAttribute("inert", "");
    await expect(surface).toHaveAttribute("aria-hidden", "true");
    await expect(demo.locator("figcaption.sr-only")).not.toBeEmpty();
  }
  // The preview is a real app shell only inside a demo; the landing page itself is never an app shell.
  expect(await page.locator(".app-shell").evaluateAll(shells => shells.filter(shell => !shell.closest("[data-demo]")).length)).toBe(0);
  await expect(page.locator("main").first()).not.toHaveClass(/app-shell/);
  expect(requests).toEqual([]);
});

for (const [section, toggle, label] of [
  ["#tasks", "taskModeAdvanced", "taskModeLabel"],
  ["#repository", "repoModeAdvanced", "repoModeLabel"],
] as const) {
  test("keyboard toggles the " + section.slice(1) + " demo between its two modes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const group = page.locator(section).getByRole("group", { name: tr[label] });
    const [first, second] = [group.getByRole("button").first(), group.getByRole("button", { name: tr[toggle], exact: true })];
    await page.locator(section).scrollIntoViewIfNeeded();
    const demo = page.locator(section + " [data-demo] > .workspace-preview");
    await expect.poll(() => demo.evaluate(el => el.childElementCount)).toBeGreaterThan(0);
    await expect(first).toHaveAttribute("aria-pressed", "true");
    const before = await demo.innerText();
    await second.focus();
    await expect(second).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await expect(first).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => demo.innerText()).not.toBe(before);
    await first.focus();
    await page.keyboard.press("Space");
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => demo.innerText()).toBe(before);
  });
}

test("the tool stack pins on large screens and flows normally on phones", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#stack-heading")).toBeVisible();
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator("#stack-heading")).toBeVisible();
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  await expect(page.locator("#stack-heading")).toBeVisible();
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

for (const width of [320, 390, 768, 1024, 1440]) {
  for (const theme of ["light", "dark"]) {
    test(`no horizontal overflow, every control on screen: ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 700 ? 800 : 900 });
      await page.addInitScript(value => localStorage.setItem("theme", value), theme);
      await page.goto("/");
      await expect(page.locator("#landing-heading")).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      expect(await offscreenControls(page)).toEqual([]);
      for (const selector of SECTIONS) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        await page.waitForTimeout(120);
        expect(await horizontalOverflow(page), selector).toBeLessThanOrEqual(0);
      }
      await tour(page);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      expect(await offscreenControls(page)).toEqual([]);
      // Touch targets: the primary actions stay comfortably large.
      for (const link of await page.locator("main a[href='/tr/kayit']").all()) {
        if (await link.isVisible()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    });
  }
}

test("German copy fits a 320px screen", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "NEXT_LOCALE", value: "de", url: baseURL! }]);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await tour(page);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  expect(await offscreenControls(page)).toEqual([]);
});

test("the moving extras line can be paused and resumed with the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const line = page.getByRole("region", { name: tr.marqueeLabel });
  const track = line.locator("ul");
  const playState = () => track.evaluate(el => getComputedStyle(el).animationPlayState);
  await line.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect.poll(playState).toBe("running");
  await line.getByRole("button", { name: tr.marqueePause }).focus();
  await page.keyboard.press("Enter");
  const play = line.getByRole("button", { name: tr.marqueePlay });
  await expect(play).toHaveAttribute("aria-pressed", "true");
  await play.blur();
  await expect.poll(playState).toBe("paused");
  await play.focus();
  await page.keyboard.press("Space");
  await expect(line.getByRole("button", { name: tr.marqueePause })).toHaveAttribute("aria-pressed", "false");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect.poll(playState).toBe("running");
});

test("reduced motion shows the finished page without moving parts", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("pda:motion", "off"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await expect(page.locator("#open-source")).not.toHaveAttribute("data-choreographed", "true");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  const state = await page.evaluate(() => {
    const running = (selector: string) => [...document.querySelectorAll(selector)].filter(el => getComputedStyle(el).animationName !== "none").length;
    return {
      reveals: [...document.querySelectorAll("[data-reveal]")].filter(el => getComputedStyle(el).opacity !== "1" || getComputedStyle(el).transform !== "none").length,
      marquee: running("section[aria-label] ul[class] li, section[aria-label] ul[class]"),
      words: running("#landing-heading span"),
      commands: [...document.querySelectorAll("[data-command-group]")].filter(el => (el as HTMLElement).hidden).length,
      tools: [...document.querySelectorAll("li[data-tool]")].filter(el => getComputedStyle(el).opacity !== "1").length,
    };
  });
  expect(state).toEqual({ reveals: 0, marquee: 0, words: 0, commands: 0, tools: 0 });
  await expect(page.locator("[data-command-group]").last()).toContainText("npm run dev");
});

test("live motion preference changes switch the scenes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#open-source")).toHaveAttribute("data-choreographed", "true");
  await expect(page.locator(".pin-spacer")).toHaveCount(1);
  await page.evaluate(() => { localStorage.setItem("pda:motion", "off"); window.dispatchEvent(new Event("pda:preferences-changed")); });
  await expect(page.locator("#open-source")).not.toHaveAttribute("data-choreographed", "true");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await page.evaluate(() => { localStorage.setItem("pda:motion", "on"); window.dispatchEvent(new Event("pda:preferences-changed")); });
  await expect(page.locator("#open-source")).toHaveAttribute("data-choreographed", "true");
});

test("keyboard: skip link, focus rings and the footer reach every action", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: tr.skip, exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#landing-main")).toBeFocused();
  const rings: string[] = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    rings.push(await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const css = getComputedStyle(el);
      return el.closest("[inert]") ? "inert" : css.outlineStyle !== "none" || css.boxShadow !== "none" ? "" : (el.textContent ?? el.tagName).trim();
    }));
  }
  expect(rings.filter(Boolean)).toEqual([]);
});

test("CTA and information links reach existing routes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("pda:motion", "off"));
  await page.goto("/");
  await page.locator('main a[href="/tr/kayit"]').first().click();
  await expect(page).toHaveURL(/\/tr\/kayit$/);
  await page.goto("/");
  await page.locator('header a[href="/tr/giris"]').click();
  await expect(page).toHaveURL(/\/tr\/giris$/);
  for (const target of ["/tr/sss", "/tr/kvkk", "/tr/gizlilik", "/tr/erisilebilirlik"]) {
    await page.goto("/");
    await page.locator('footer a[href="' + target + '"]').click();
    await expect(page).toHaveURL(new RegExp(target + "$"));
  }
  await page.goto("/");
  // Hero, open-source and final CTA all point at the repository; none of them is styled as the primary action.
  const repository = page.locator('main a[href="https://github.com/alperrte/project-delivery-assistant"]');
  expect(await repository.count()).toBeGreaterThanOrEqual(3);
  for (const target of ["https://github.com/alperrte", "https://github.com/HmzT270", "https://github.com/alperrte/project-delivery-assistant"]) {
    await expect(page.locator('footer a[href="' + target + '"]')).toHaveCount(1);
  }
});

test("session hint continues to the verified app shell", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "PDA_SESSION", value: "1", url: baseURL! }]);
  const origin = new URL(baseURL!).origin;
  // TEST-ONLY: a chat overview is not a generic paged response. Returning one
  // used to crash ChatProvider after the shell had briefly appeared.
  const overview: ChatOverview = { group: null, groups: [], directs: [], totalUnread: 0 };
  await page.route("**/api/v1/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname.endsWith("/auth/me")
      ? { id: "landing-test", nickname: "LandingTest", email: "landing@example.com", globalRole: "USER", mustChangePassword: false }
      : pathname.endsWith("/chat/conversations") ? overview : { content: [], totalElements: 0, totalPages: 0, counts: {} };
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
  });
  const chatLoaded = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/chat/conversations") && response.status() === 200);
  await page.goto("/");
  await chatLoaded;
  await expect(page).toHaveURL(/\/tr\/genel-bakis$/);
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator("footer")).toHaveCount(0);
});

test("the page is complete and readable without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, locale: "tr-TR", baseURL });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("#landing-heading")).toContainText(tr.heroLine1);
  await expect(page.locator('main a[href="/tr/kayit"]').first()).toBeVisible();
  for (const [id, key] of [["meetings", "meetingTitle"], ["chat", "chatTitle"], ["tasks", "taskTitle"], ["repository", "repoTitle"], ["organizations", "orgTitle"]] as const) await expect(page.locator("#" + id + "-title")).toHaveText(tr[key]);
  await expect(page.locator("#stack-heading")).toBeVisible();
  await expect(page.locator("li[data-tool]")).toHaveCount(4);
  for (const tool of await page.locator("li[data-tool]").all()) await expect(tool).toBeVisible();
  const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-reveal], [data-stack-resolve], [data-stack-core]")].filter(el => getComputedStyle(el).opacity === "0" || getComputedStyle(el).visibility === "hidden").length);
  expect(hidden).toBe(0);
  await expect(page.locator("[data-command-group]").last()).toContainText("npm run dev");
  expect(await page.locator("[data-command-group]").evaluateAll(groups => groups.every(group => !(group as HTMLElement).hidden))).toBe(true);
  for (const caption of await page.locator("[data-demo] figcaption").all()) await expect(caption).not.toBeEmpty();
  await context.close();
});

test("homepage remains in sitemap and robots", async ({ request }) => {
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Allow: /");
  expect(await robots.text()).toContain("Disallow: /tr/genel-bakis");
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
  await navigation.getByRole("link", { name: tr.login, exact: true }).click();
  await expect(page).toHaveURL(/\/tr\/giris$/);
});

test("mobile menu anchors close the menu and land on their section", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.locator('header button[aria-controls="landing-navigation"]');
  await toggle.click();
  await page.locator('#landing-navigation a[href="#open-source"]').click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#open-source")).toBeInViewport();
});

test("landing follows live changes to the global semantic palette", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("pda:motion", "off"));
  await page.goto("/");
  // The stored motion preference is applied after hydration; until then colour transitions still run.
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--background", "#f5ebdb");
    document.documentElement.style.setProperty("--foreground", "#302718");
  });
  // Auto-waiting: a one-shot read right after setProperty can still see the first frame of the (0.01ms) transition.
  await expect(page.locator("#landing-main").locator("xpath=..")).toHaveCSS("background-color", "rgb(245, 235, 219)");
  await expect(page.locator("#landing-heading")).toHaveCSS("color", "rgb(48, 39, 24)");
});
