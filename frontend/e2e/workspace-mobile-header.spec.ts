import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import path from "node:path";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";
import { buildPath } from "../src/i18n/routing";
import type { Locale } from "../src/i18n/config";
import { demoData, demoPage } from "../src/features/landing/demo/demo-data";
import landing from "../src/i18n/landing/tr.json";
import { NAVBAR_IDLE_MS } from "../src/components/layout/use-auto-hide";

const catalogs = { tr, en, de };
const captures = path.resolve("../tmp/workspace-mobile-header");
// The presentation fixture must own requests; a production service worker can bypass page.route in WebKit.
test.use({ serviceWorkers: "block" });
// TEST-ONLY shell presentation fixture. No request reaches a backend, and no production auth policy is changed.
async function fixture(page: Page, context: BrowserContext, origin: string, locale: Locale = "tr", withProject = false) {
  const seed = withProject ? demoData(landing) : null;
  if (seed) await page.routeWebSocket(/\/api\/v1\/ws$/, socket => socket.onMessage(message => {
    if (String(message).startsWith("CONNECT")) socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0");
  }));
  await context.addCookies([
    { name: "PDA_SESSION", value: "1", url: origin },
    { name: "NEXT_LOCALE", value: locale, url: origin },
  ]);
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" };
    if (request.method() === "OPTIONS" || url.pathname.endsWith("/team-deletions/claim")) return route.fulfill({ status: 204, headers });
    const body = seed && url.pathname === "/api/v1/projects" ? demoPage([seed.project])
      : seed && url.pathname.includes("/projects/by-slug/") ? seed.project
      : seed && url.pathname.endsWith("/members/header-ui-fixture") ? { ...seed.members[0], userId: "header-ui-fixture" }
      : seed && url.pathname.endsWith("/home") ? seed.home
      : seed && url.pathname.endsWith("/teams") ? demoPage([seed.team])
      : seed && url.pathname.endsWith("/chat/conversations") ? { group: { id: "header-qa-group", type: "PROJECT", peer: null, lastMessage: null, unread: 0 }, directs: [], totalUnread: 0 }
      : seed && url.pathname.endsWith("/chat/members") ? []
      : seed && url.pathname.endsWith("/messages") ? { messages: [], hasMore: false }
      : url.pathname.endsWith("/auth/me")
      ? { id: "header-ui-fixture", nickname: "Mobile QA", email: "header@example.test", globalRole: "USER", mustChangePassword: false }
      : url.pathname.endsWith("/users/me/preferences") ? { motion: "on", themeTransition: false }
      : url.pathname.endsWith("/auth/csrf") ? { headerName: "X-XSRF-TOKEN" }
      : /count$/.test(url.pathname) ? { count: 0 }
      : { content: [], totalElements: 0, totalPages: 0, counts: {} };
    return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(body) });
  });
}
async function reveal(page: Page) {
  const header = page.locator(".app-shell header");
  await expect(header).toBeAttached();
  await header.locator("..").locator(":scope > button").focus();
  await expect(header).not.toHaveClass(/opacity-0/);
  return header;
}
async function drawer(page: Page, locale: Locale = "tr") {
  const header = await reveal(page);
  await header.getByRole("button", { name: catalogs[locale].workspace.navigation, exact: true }).click();
  const panel = page.locator("#workspace-mobile-navigation");
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate(element => element.getAnimations().every(animation => animation.playState !== "running"))).toBe(true);
  return panel;
}

for (const locale of ["tr", "en", "de"] as const) {
  test(`workspace header/drawer fit screens and themes: ${locale}`, async ({ page, context, baseURL }) => {
    await fixture(page, context, new URL(baseURL!).origin, locale);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const width of [320, 390, 640, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ["light", "dark"]) {
        await page.addInitScript(value => localStorage.setItem("theme", value), theme);
        await page.goto(buildPath("/settings", {}, locale));
        const header = await reveal(page);
        await expect(header).toHaveCSS("height", width < 640 ? "56px" : "48px");
        await expect.poll(() => header.evaluate(element => getComputedStyle(element).scale)).toMatch(/^(none|1)$/);
        const geometry = await header.evaluate(element => {
          const header = element.getBoundingClientRect();
          const controls = [...element.querySelectorAll("button, a, input")].map(node => {
            const box = node.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
          }).filter(box => box.width > 0 && box.height > 0);
          return { x: header.x, width: header.width, bottom: header.bottom, controls };
        });
        expect(geometry.x + geometry.width / 2).toBeCloseTo(width / 2, 1);
        for (const box of geometry.controls) {
          expect(box.x).toBeGreaterThanOrEqual(geometry.x);
          expect(box.x + box.width).toBeLessThanOrEqual(geometry.x + geometry.width + 1);
          if (width < 640) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); }
        }
        for (let i = 0; i < geometry.controls.length; i++) for (let j = i + 1; j < geometry.controls.length; j++) {
          const a = geometry.controls[i], b = geometry.controls[j];
          expect(Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))).toBeLessThanOrEqual(0.5);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        const inset = await page.locator("#main-content").evaluate(element => Number.parseFloat(getComputedStyle(element).paddingTop));
        expect(inset).toBe(width < 640 ? 80 : 72);
        expect(inset).toBeGreaterThan(geometry.bottom);
        if (width < 640) {
          await expect(header.getByRole("button", { name: catalogs[locale].common.language.label, exact: true })).toHaveCount(0);
          await expect(header.getByRole("group", { name: catalogs[locale].common.theme.label, exact: true })).toHaveCount(0);
          await page.screenshot({ path: path.join(captures, `${locale}-${theme}-${width}-header.png`) });
          const panel = await drawer(page, locale);
          await expect(panel.getByRole("button", { name: catalogs[locale].common.language.label, exact: true })).toBeVisible();
          await expect(panel.getByRole("group", { name: catalogs[locale].common.theme.label, exact: true })).toBeVisible();
          await expect(panel.getByTestId("workspace-back")).toBeVisible();
          await page.screenshot({ path: path.join(captures, `${locale}-${theme}-${width}-drawer.png`) });
          await page.keyboard.press("Escape");
          await expect(panel).not.toBeVisible();
        }
      }
    }
    expect(errors).toEqual([]);
  });
}

test("mobile drawer retains nested language/theme, focus, history and route behavior", async ({ page, context, baseURL, browserName }) => {
  await fixture(page, context, new URL(baseURL!).origin);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  const panel = await drawer(page);
  await panel.getByRole("button", { name: "Dil", exact: true }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).not.toBeVisible();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Koyu", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(page.locator("header").getByRole("button", { name: "Gezinme menüsü", exact: true })).toBeFocused();
  await drawer(page);
  await panel.getByRole("link", { name: "Projeler", exact: true }).click();
  await expect(page).toHaveURL(/\/tr\/projeler$/);
  await expect(panel).not.toBeVisible();
  await drawer(page);
  if (browserName === "chromium") {
    await expect(panel.getByTestId("workspace-back")).toBeEnabled();
    await panel.getByTestId("workspace-back").click();
    await expect(page).toHaveURL(/\/tr\/ayarlar$/);
    await expect(panel).not.toBeVisible();
  } else {
    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
  }
  await drawer(page);
  await page.setViewportSize({ width: 768, height: 844 });
  await expect(panel).not.toBeVisible();
});

test("mobile search, notification and account popups stay usable within the viewport", async ({ page, context, baseURL }) => {
  await fixture(page, context, new URL(baseURL!).origin);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/settings");
  const header = await reveal(page);
  await header.getByRole("button", { name: "Ara", exact: true }).click();
  const search = header.getByRole("combobox");
  await expect(search).toBeFocused();
  const results = page.getByRole("listbox", { name: "Ara", exact: true });
  await expect(results).toBeVisible();
  const bounds = await results.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
  await header.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(header.getByRole("button", { name: "Ara", exact: true })).toBeFocused();
  await expect(search).not.toBeVisible();
  await header.getByRole("button", { name: "Ara", exact: true }).click();
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/tr\/genel-bakis$/);
  await reveal(page);
  await header.getByRole("button", { name: "Bildirimler", exact: true }).click();
  await expect(page.locator("[data-slot=popover-content], [data-notification-empty]").last()).toBeVisible();
  await page.keyboard.press("Escape");
  await reveal(page);
  await header.getByRole("button", { name: "Hesap menüsü" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "Hesap ayarları" }).click();
  await expect(page).toHaveURL(/\/tr\/hesap$/);
});

test("mobile drawer explains unsupported history and keeps navigation available", async ({ page, context, baseURL }) => {
  await fixture(page, context, new URL(baseURL!).origin);
  await page.addInitScript(() => Object.defineProperty(window, "navigation", { configurable: true, value: undefined }));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/settings");
  const panel = await drawer(page);
  await expect(panel.getByTestId("workspace-history")).toHaveAttribute("data-history-status", "unavailable");
  await expect(panel.getByTestId("workspace-back")).toBeDisabled();
  await expect(panel.getByTestId("workspace-forward")).toBeDisabled();
  await panel.getByRole("link", { name: "Projeler", exact: true }).click();
  await expect(page).toHaveURL(/\/tr\/projeler$/);
});

test("fullscreen chat uses the compact reserve and keeps hamburger controls outside inert content", async ({ page, context, baseURL }) => {
  await fixture(page, context, new URL(baseURL!).origin, "tr", true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  const panel = await drawer(page);
  await panel.getByTestId("chat-nav-item").click();
  const chat = page.getByTestId("chat-panel");
  await expect(chat).toBeVisible();
  await expect(panel).not.toBeVisible();
  await expect(page.locator("#main-content")).toHaveAttribute("inert", "");
  const header = await reveal(page);
  const bounds = await header.first().boundingBox();
  const chatBounds = await chat.boundingBox();
  expect(chatBounds!.y).toBe(80);
  expect(chatBounds!.y).toBeGreaterThan(bounds!.y + bounds!.height);
  await drawer(page);
  await expect(panel.getByTestId("workspace-back")).toBeVisible();
  expect(await panel.evaluate(element => !!element.closest("[inert]"))).toBe(false);
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(chat).toBeVisible();
});

test("compact header keeps idle hiding and stays visible while its drawer is open", async ({ page, context, baseURL }) => {
  await fixture(page, context, new URL(baseURL!).origin);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  const header = await reveal(page);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.mouse.move(1, 500);
  await expect(header).toHaveClass(/opacity-0/);
  const panel = await drawer(page);
  await page.waitForTimeout(NAVBAR_IDLE_MS + 100);
  await expect(header).not.toHaveClass(/opacity-0/);
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(header.getByRole("button", { name: "Gezinme menüsü", exact: true })).toBeFocused();
});
