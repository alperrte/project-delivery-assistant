import { test, expect, type Page } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";
import { NAVBAR_IDLE_MS } from "../src/components/layout/use-auto-hide";

const header = (page: Page) => page.locator(".app-shell header").first();

test("desktop upward scroll outside the navbar does not reveal it", async ({ browser }) => {
  const context = await browser.newContext({ storageState: MANAGER_STORAGE, viewport: { width: 1280, height: 400 } });
  const page = await context.newPage();
  try {
    await page.goto("/account"); await expect(page.locator("#main-content")).toBeVisible();
    await page.mouse.move(5, 350); await page.mouse.wheel(0, 5000);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(80);
    await expect(header(page)).toHaveClass(/opacity-0/);
    // Watch every class change to catch brief reveal/hide flicker between assertions.
    await header(page).evaluate(node => {
      node.dataset.unexpectedReveals = "0";
      const observer = new MutationObserver(() => {
        if (!node.classList.contains("opacity-0")) {
          node.dataset.unexpectedReveals = String(Number(node.dataset.unexpectedReveals) + 1);
        }
      });
      observer.observe(node, { attributes: true, attributeFilter: ["class"] });
    });
    for (let step = 0; step < 3; step++) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(NAVBAR_IDLE_MS + 100);
      await expect(header(page)).toHaveClass(/opacity-0/);
    }
    // Moving up along the scrollbar edge must not hit the navbar reveal strip.
    await page.mouse.move(1279, 2);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(NAVBAR_IDLE_MS + 100);
    await expect(header(page)).toHaveClass(/opacity-0/);
    await expect(header(page)).toHaveAttribute("data-unexpected-reveals", "0");
    await page.mouse.move(640, 2);
    await expect(header(page)).not.toHaveClass(/opacity-0/);
  } finally { await context.close(); }
});

test("hover, focus and an owned popup hold the header; leaving the interaction resumes idle", async ({ browser }) => {
  const context = await browser.newContext({ storageState: MANAGER_STORAGE, viewport: { width: 1280, height: 400 } });
  const page = await context.newPage();
  try {
    await page.goto("/account"); await expect(page.locator("#main-content")).toBeVisible();
    await page.mouse.move(640, 2); await page.mouse.move(640, 30);
    await page.waitForTimeout(NAVBAR_IDLE_MS + 250); await expect(header(page)).not.toHaveClass(/opacity-0/);
    const bell = page.getByRole("button", { name: "Bildirimler", exact: true });
    await bell.focus(); await page.mouse.move(5, 300);
    await page.waitForTimeout(NAVBAR_IDLE_MS + 250); await expect(header(page)).not.toHaveClass(/opacity-0/);
    await bell.press("Enter"); await expect(page.getByRole("dialog", { name: "Bildirimler", exact: true })).toBeVisible();
    await page.waitForTimeout(NAVBAR_IDLE_MS + 250); await expect(header(page)).not.toHaveClass(/opacity-0/);
    await page.keyboard.press("Escape"); await expect(bell).toBeFocused();
    await page.locator("#main-content").focus(); await expect(header(page)).toHaveClass(/opacity-0/);
    await page.mouse.move(640, 2); await page.keyboard.press("Control+k");
    await page.waitForTimeout(NAVBAR_IDLE_MS + 250); await expect(header(page)).not.toHaveClass(/opacity-0/);
    await page.keyboard.press("Escape"); await page.mouse.move(5, 300); await page.locator("#main-content").focus();
    await expect(header(page)).toHaveClass(/opacity-0/);
  } finally { await context.close(); }
});

test("actual touch drawer interaction holds navbar and resumes idle after focus leaves", async ({ browser }) => {
  const context = await browser.newContext({ storageState: MANAGER_STORAGE, viewport: { width: 390, height: 500 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto("/account"); await expect(page.locator("#main-content")).toBeVisible();
    const menu = header(page).getByRole("button", { name: "Gezinme menüsü", exact: true });
    await menu.click(); const drawer = page.getByRole("dialog", { name: "Gezinme menüsü", exact: true }); await expect(drawer).toBeVisible();
    await page.waitForTimeout(NAVBAR_IDLE_MS + 250); await expect(header(page)).not.toHaveClass(/opacity-0/);
    await page.keyboard.press("Escape"); await expect(drawer).toBeHidden(); await page.locator("#main-content").focus();
    await expect(header(page)).toHaveClass(/opacity-0/);
  } finally { await context.close(); }
});

test("touch upward scroll reopens the navbar and uses the same idle hide", async ({ browser }) => {
  const context = await browser.newContext({ storageState: MANAGER_STORAGE, viewport: { width: 390, height: 500 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto("/account"); await expect(page.locator("#main-content")).toBeVisible();
    expect(await page.evaluate(() => matchMedia("(hover: none)").matches)).toBe(true);
    const session = await context.newCDPSession(page);
    const pan = async (from: number, to: number) => {
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 180, y: from }] });
      for (let i = 1; i <= 10; i++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 180, y: from + (to - from) * i / 10 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await pan(420, 180); await pan(420, 180);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(80);
    await expect(header(page)).toHaveClass(/opacity-0/);
    await pan(180, 320);
    await expect(header(page)).not.toHaveClass(/opacity-0/);
    await expect(header(page)).toHaveClass(/opacity-0/, { timeout: 2500 });
  } finally { await context.close(); }
});
