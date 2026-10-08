import { test, expect } from "@playwright/test";
import path from "node:path";
import { api } from "./helpers";
import { notificationFixture } from "./notification-fixture";
import { notificationInDatabase } from "./notification-db";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

test("real snapshot history preserves long content across locales/themes/viewports, keyboard and actual touch", async ({ browser }) => {
  test.setTimeout(150_000); const f = await notificationFixture(browser, 1); let touchContext;
  try {
    const manager = (await api(f.a, "GET", "/auth/me")).json as { id: string };
    const title = ("Notification history " + "UnbrokenTaskContent".repeat(10)).slice(0, 160);
    expect((await api(f.a, "PATCH", `/projects/${f.projectId}/tasks/${f.notes[0].resourceId}`, { title, priority: "MEDIUM" })).status).toBe(200);
    await api(f.a, "PATCH", "/notifications/read-all");
    for (const status of ["IN_PROGRESS", "DONE"]) expect((await api(f.b, "PATCH", `/projects/${f.projectId}/tasks/${f.notes[0].resourceId}/status`, { status })).status).toBe(200);
    const events = ((await api(f.a, "GET", "/notifications?read=false&type=TASK_STATUS_CHANGED")).json as {
      content: { id: string; statusChange: { newStatus: string; taskTitle: string } }[];
    }).content;
    expect(events).toHaveLength(2); expect(events.every(n => n.statusChange.taskTitle === title)).toBe(true);
    const started = events.find(n => n.statusChange.newStatus === "IN_PROGRESS")!, done = events.find(n => n.statusChange.newStatus === "DONE")!;
    await api(f.a, "PATCH", `/notifications/${started.id}/read`);
    for (const [locale, catalog] of Object.entries({ tr, en, de })) {
      const t = catalog.notifications;
      for (const dark of [false, true]) {
        await f.a.goto(`/${locale}/projects`);
        // TEST-ONLY theme/motion presentation state, not a fake API or persistence result.
        await f.a.evaluate(dark => { document.documentElement.classList.toggle("dark", dark); document.documentElement.dataset.motion = "off"; }, dark);
        await f.a.emulateMedia({ reducedMotion: "reduce" });
        for (const width of [320, 390, 768, 1024, 1440]) {
          await f.a.setViewportSize({ width, height: 900 }); await f.a.mouse.move(20, 2);
          const bell = f.a.getByRole("button", { name: catalog.workspace.notifications, exact: true }); await bell.focus(); await bell.press("Enter");
          const panel = f.a.getByRole("dialog", { name: t.title, exact: true });
          await expect(panel.locator(`[data-notification-id="${done.id}"]`)).toContainText(title);
          const read = panel.getByRole("button", { name: t.markRead, exact: true });
          const hit = (await read.boundingBox())!; expect(hit.width).toBeGreaterThanOrEqual(44); expect(hit.height).toBeGreaterThanOrEqual(44);
          await expect.poll(async () => { const box = await panel.boundingBox(); return !!box && box.x >= -1 && box.x + box.width <= width + 1; }).toBe(true);
          expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
          if (width === 320 || width === 1440) await panel.screenshot({ path: path.resolve(__dirname, `../../.local/notification-history/visual-${locale}-${width}-${dark ? "dark" : "light"}-new.png`), animations: "disabled" });
          const next = panel.getByRole("tab", { name: t.newLabel, exact: true }); await next.focus(); await next.press("ArrowRight");
          const history = panel.getByRole("tab", { name: t.historyLabel, exact: true });
          await expect(history).toBeFocused(); await history.press("Enter");
          await expect(panel.getByRole("tab", { name: t.historyLabel, exact: true })).toHaveAttribute("aria-selected", "true");
          await expect(panel.locator(`[data-notification-id="${started.id}"]`)).toContainText(title);
          await expect(panel.getByRole("button", { name: t.markRead, exact: true })).toHaveCount(0);
          if (width === 320 || width === 1440) await panel.screenshot({ path: path.resolve(__dirname, `../../.local/notification-history/visual-${locale}-${width}-${dark ? "dark" : "light"}-history.png`), animations: "disabled" });
          await f.a.keyboard.press("Escape"); await expect(panel).toBeHidden(); await expect(bell).toBeFocused();
        }
      }
    }
    touchContext = await browser.newContext({ storageState: await f.ac.storageState(), hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    const mobile = await touchContext.newPage(); await mobile.goto("/tr/projeler");
    await mobile.getByRole("button", { name: "Bildirimler", exact: true }).tap();
    const panel = mobile.getByRole("dialog", { name: "Bildirimler", exact: true });
    await panel.getByRole("button", { name: "Okundu olarak işaretle", exact: true }).tap();
    await expect(panel).toContainText("Yeni bildiriminiz yok.");
    await panel.getByRole("tab", { name: "Geçmiş", exact: true }).tap();
    await expect(panel.locator(`[data-notification-id="${done.id}"]`)).toContainText(title);
    expect(notificationInDatabase(manager.id, done.id)).toMatchObject({ rowCount: 1, read: true });
    expect(notificationInDatabase(manager.id, started.id)).toMatchObject({ rowCount: 1, read: true });
  } finally { await touchContext?.close(); await f.cleanup(); }
});
