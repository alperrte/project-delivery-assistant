import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { api } from "./helpers";
import { notificationFixture, openNotificationCenter } from "./notification-fixture";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

test("empty and single notification need no scrollbar; read, history and focus remain functional", async ({ browser }) => {
  const f = await notificationFixture(browser, 0);
  try {
    await api(f.b, "DELETE", "/notifications?read=true");
    await f.b.goto("/tr/projeler");
    let panel = await openNotificationCenter(f.b);
    await expect(panel).toContainText(tr.notifications.newEmpty);
    expect(await panel.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await f.b.keyboard.press("Escape");
    expect((await api(f.a, "POST", `/projects/${f.projectId}/tasks`, { title: "Single scrollbar QA", creationMode: "SIMPLE", assigneeIds: [f.user.id] })).status).toBe(201);
    await f.b.reload(); panel = await openNotificationCenter(f.b);
    await expect(panel.locator("[data-notification-id]")).toHaveCount(1);
    expect(await panel.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await panel.getByRole("button", { name: tr.notifications.markRead, exact: true }).click();
    await expect(panel).toContainText(tr.notifications.newEmpty);
    await panel.getByRole("tab", { name: tr.notifications.historyLabel, exact: true }).click();
    await expect(panel.locator("[data-notification-id]")).toHaveCount(1);
    await f.b.keyboard.press("Escape");
    await expect(f.b.getByRole("button", { name: tr.workspace.notifications, exact: true })).toBeFocused();
  } finally { await f.cleanup(); }
});

test("shared scrollbar contains wheel and touch across themes, languages, widths and short screens", async ({ browser }) => {
  test.setTimeout(240_000);
  const f = await notificationFixture(browser, 45);
  let touchContext;
  try {
    const longTitle = ("Scroll QA " + "UnbrokenMeetingContent".repeat(10)).slice(0, 160);
    expect((await api(f.a, "PATCH", `/projects/${f.projectId}/tasks/${f.notes[0].resourceId}`, { title: longTitle, priority: "MEDIUM" })).status).toBe(200);
    expect((await api(f.a, "PATCH", `/projects/${f.projectId}/tasks/${f.notes[0].resourceId}/status`, { status: "IN_PROGRESS" })).status).toBe(200);
    for (const note of f.notes.slice(0, 10)) await api(f.b, "PATCH", `/notifications/${note.id}/read`);
    for (const [locale, catalog] of Object.entries({ tr, en, de })) {
      const t = catalog.notifications;
      for (const dark of [false, true]) {
        await f.b.goto(`/${locale}/projects`);
        // TEST-ONLY presentation preference; all notification data/mutations use the real backend.
        await f.b.evaluate(dark => { document.documentElement.classList.toggle("dark", dark); }, dark);
        for (const width of [320, 375, 768, 1024, 1440]) {
          await f.b.setViewportSize({ width, height: width === 375 ? 400 : 900 });
          await f.b.mouse.move(width / 2, 8);
          const bell = f.b.getByRole("button", { name: catalog.workspace.notifications, exact: true });
          await bell.focus(); await bell.press("Enter");
          const panel = f.b.getByRole("dialog", { name: t.title, exact: true });
          await expect(panel.locator("[data-notification-id]")).toHaveCount(20);
          await expect(panel).toContainText(longTitle);
          await expect(panel).toHaveAttribute("data-workspace-scroll", "true");
          await expect.poll(async () => {
            const box = await panel.boundingBox();
            return !!box && box.x >= -1 && box.x + box.width <= width + 1 && box.y >= -1 && box.y + box.height <= (width === 375 ? 400 : 900) + 1;
          }).toBe(true);
          const css = await panel.evaluate(el => ({
            color: getComputedStyle(el).scrollbarColor, rootColor: getComputedStyle(document.documentElement).scrollbarColor,
            width: getComputedStyle(el).scrollbarWidth, overscroll: getComputedStyle(el).overscrollBehaviorY,
            horizontalOverflow: el.scrollWidth > el.clientWidth + 1, verticalOverflow: el.scrollHeight > el.clientHeight,
          }));
          expect(css).toMatchObject({ width: "thin", overscroll: "contain", horizontalOverflow: false, verticalOverflow: true });
          expect(css.color).toBe(css.rootColor);
          const box = (await panel.boundingBox())!;
          await f.b.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await f.b.mouse.wheel(0, 300);
          await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
          await panel.evaluate(el => { el.scrollTop = el.scrollHeight; });
          const before = await f.b.evaluate(() => ({ root: scrollY, main: document.querySelector("main")?.scrollTop }));
          await f.b.mouse.wheel(0, 1000);
          await expect.poll(() => f.b.evaluate(() => ({ root: scrollY, main: document.querySelector("main")?.scrollTop }))).toEqual(before);
          if (width === 320 || width === 1440) {
            await panel.evaluate(el => { el.scrollTop = 0; });
            await panel.screenshot({ path: path.resolve(__dirname, `../../.local/ns-scrollbar/${locale}-${width}-${dark ? "dark" : "light"}.png`) });
            expect((await new AxeBuilder({ page: f.b }).include('[role="dialog"][data-workspace-scroll]').analyze()).violations).toEqual([]);
          }
          await panel.getByRole("tab", { name: t.historyLabel, exact: true }).click();
          await expect(panel.locator("[data-notification-id]").first()).toBeVisible();
          expect(await panel.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
          await f.b.keyboard.press("Escape"); await expect(panel).toBeHidden(); await expect(bell).toBeFocused();
        }
      }
    }
    await f.b.goto("/tr/projeler"); await f.b.setViewportSize({ width: 1440, height: 900 });
    const panel = await openNotificationCenter(f.b);
    await panel.getByRole("button", { name: tr.notifications.next, exact: true }).click();
    await expect(panel.locator("[data-notification-id]")).toHaveCount(16);
    await panel.getByRole("button", { name: tr.notifications.previous, exact: true }).click();
    await expect(panel.locator("[data-notification-id]")).toHaveCount(20);
    await f.b.keyboard.press("Escape");
    touchContext = await browser.newContext({ storageState: await f.bc.storageState(), hasTouch: true, isMobile: true, viewport: { width: 375, height: 667 } });
    const mobile = await touchContext.newPage(); await mobile.goto("/tr/projeler");
    await mobile.getByRole("button", { name: tr.workspace.notifications, exact: true }).tap();
    const touchPanel = mobile.getByRole("dialog", { name: tr.notifications.title, exact: true });
    await expect(touchPanel.locator("[data-notification-id]")).toHaveCount(20);
    const box = (await touchPanel.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height - 45;
    const cdp = await touchContext.newCDPSession(mobile);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 6; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - step * 30 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => touchPanel.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  } finally { await touchContext?.close(); await f.cleanup(); }
});
