import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { api, login } from "./helpers";
import { MANAGER_USER_FILE, MEMBER_USER_FILE, MEMBER_STORAGE } from "./global-setup";
import { notificationFixture, openNotificationCenter, type HistoryNote } from "./notification-fixture";
import { notificationInDatabase } from "./notification-db";

async function logout(page: Page) {
  await page.mouse.move(20, 2);
  const center = page.getByRole("dialog", { name: "Bildirimler", exact: true });
  if (await center.isVisible()) {
    await page.getByRole("button", { name: "Bildirimler", exact: true }).click();
    await expect(center).toBeHidden();
  }
  await page.getByRole("button", { name: /Hesap menüsü/ }).click();
  await page.getByRole("menuitem", { name: "Çıkış yap", exact: true }).click();
  await expect(page.locator('input[name="email"]')).toBeVisible();
}
async function signInPlace(page: Page, credentials: { email: string; password: string }) {
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.getByRole("button", { name: /^Giriş yap$/ }).click();
  await expect(page.locator("#main-content")).toBeVisible();
}

test("late real read, read-all and refreshed private list/count responses stay with the original account", async ({ browser }) => {
  test.setTimeout(150_000);
  const f = await notificationFixture(browser);
  const member = JSON.parse(readFileSync(MEMBER_USER_FILE, "utf8")), manager = JSON.parse(readFileSync(MANAGER_USER_FILE, "utf8"));
  const producerContext = await browser.newContext({ storageState: MEMBER_STORAGE }), producer = await producerContext.newPage();
  let release = () => {};
  try {
    // A private login lets this test logout without revoking the suite's shared fixture session.
    await login(f.b, member.email, member.password); await producer.goto("/projects");
    await f.b.evaluate(() => { (window as unknown as { notificationOwnerDocument: number }).notificationOwnerDocument = 42; });
    let sourceId = f.user.id;
    const managerId = ((await api(f.a, "GET", "/auth/me")).json as { id: string }).id;
    for (const kind of ["read", "all", "refresh"] as const) {
      if (kind === "all") {
        await api(f.b, "PATCH", "/notifications/read-all");
        for (const status of ["IN_PROGRESS", "DONE"]) expect((await api(producer, "PATCH",
          `/projects/${f.projectId}/tasks/${f.notes[0].resourceId}/status`, { status })).status).toBe(200);
      } else if (kind === "refresh") {
        await api(f.b, "PATCH", "/notifications/read-all");
        for (let i = 0; i < 2; i++) await api(f.a, "POST", `/projects/${f.projectId}/tasks`, {
          title: `Late refresh notification ${i}`, creationMode: "SIMPLE", assigneeIds: [f.user.id],
        });
      }
      const oldNotes = ((await api(f.b, "GET", "/notifications?read=false&size=20")).json as { content: HistoryNote[] }).content;
      expect(oldNotes).toHaveLength(2);
      const panel = await openNotificationCenter(f.b);
      await panel.getByRole("tab", { name: "Geçmiş", exact: true }).click();
      await expect(panel.getByRole("list", { name: "Geçmiş bildirimler", exact: true })).toBeVisible();
      await panel.getByRole("tab", { name: "Yeni", exact: true }).click();
      await expect(panel.locator(`[data-notification-id="${oldNotes[0].id}"]`)).toBeVisible();
      let arrived!: () => void; const ready = new Promise<void>(resolve => { arrived = resolve; });
      const held = new Promise<void>(resolve => { release = resolve; }); let holdingOld = true;
      const seen = new Set<string>();
      // TEST-ONLY delayed delivery of actual server responses after real commit; bodies are never fabricated.
      if (kind === "refresh") {
        await f.b.route("**/api/v1/notifications**", async route => {
          const url = new URL(route.request().url());
          if (!holdingOld || route.request().method() !== "GET" || !["/api/v1/notifications", "/api/v1/notifications/unread-count"].includes(url.pathname)) { await route.continue(); return; }
          const response = await route.fetch(); seen.add(url.pathname); if (seen.size === 2) arrived();
          await held; await route.fulfill({ response }).catch(() => undefined);
        });
      } else {
        const endpoint = kind === "all" ? "read-all" : `${oldNotes[0].id}/read`;
        await f.b.route(`**/api/v1/notifications/${endpoint}`, async route => {
          const response = await route.fetch(); expect(response.status()).toBe(200); arrived();
          await held; await route.fulfill({ response }).catch(() => undefined);
        });
      }
      if (kind === "all") await panel.getByRole("button", { name: "Tümünü okundu yap", exact: true }).click();
      else await panel.locator(`[data-notification-id="${oldNotes[0].id}"]`).getByRole("button", { name: "Okundu olarak işaretle", exact: true }).click();
      await ready;
      expect(notificationInDatabase(sourceId, oldNotes[0].id)).toMatchObject({ rowCount: 1, read: true });
      if (kind === "all") expect(notificationInDatabase(sourceId, oldNotes[1].id)).toMatchObject({ read: true });
      holdingOld = false; await logout(f.b);
      const next = sourceId === f.user.id ? manager : member;
      await signInPlace(f.b, next); sourceId = sourceId === f.user.id ? managerId : f.user.id;
      expect(await f.b.evaluate(() => (window as unknown as { notificationOwnerDocument: number }).notificationOwnerDocument)).toBe(42);
      const newPanel = await openNotificationCenter(f.b);
      const expectedCount = ((await api(f.b, "GET", "/notifications/unread-count")).json as { count: number }).count;
      if (expectedCount) await expect(f.b.getByLabel(`${expectedCount} okunmamış bildirim`, { exact: true })).toBeVisible();
      else await expect(f.b.getByLabel(/^\d+ okunmamış bildirim$/)).toHaveCount(0);
      for (const n of oldNotes) await expect(newPanel.locator(`[data-notification-id="${n.id}"]`)).toHaveCount(0);
      release(); await f.b.unrouteAll({ behavior: "ignoreErrors" });
      await newPanel.getByRole("tab", { name: "Geçmiş", exact: true }).click();
      for (const n of oldNotes) await expect(newPanel.locator(`[data-notification-id="${n.id}"]`)).toHaveCount(0);
      await expect(newPanel.getByRole("alert")).toHaveCount(0);
      if (expectedCount) await expect(f.b.getByLabel(`${expectedCount} okunmamış bildirim`, { exact: true })).toBeVisible();
      else await expect(f.b.getByLabel(/^\d+ okunmamış bildirim$/)).toHaveCount(0);
      expect((await api(f.b, "PATCH", `/notifications/${oldNotes[0].id}/read`)).status).toBe(404);
      await f.b.keyboard.press("Escape");
    }
  } finally { release(); await f.b.unrouteAll({ behavior: "ignoreErrors" }); await producerContext.close(); await f.cleanup(); }
});

test("another tab reconciles explicit read and bulk read through existing foreground polling", async ({ browser }) => {
  test.setTimeout(100_000); const f = await notificationFixture(browser);
  const cc = await browser.newContext({ storageState: await f.bc.storageState() }), c = await cc.newPage();
  try {
    await f.b.goto("/projects"); const bp = await openNotificationCenter(f.b);
    await c.goto("/projects"); const cp = await openNotificationCenter(c);
    await expect(cp.locator("[data-notification-id]")).toHaveCount(2);
    await f.b.bringToFront();
    await bp.locator(`[data-notification-id="${f.notes[0].id}"]`).getByRole("button", { name: "Okundu olarak işaretle", exact: true }).click();
    await expect(bp.locator("[data-notification-id]")).toHaveCount(1);
    await c.bringToFront(); await expect(cp.locator("[data-notification-id]")).toHaveCount(1, { timeout: 35_000 });
    await expect(c.getByLabel("1 okunmamış bildirim", { exact: true })).toBeVisible({ timeout: 35_000 });
    await cp.getByRole("button", { name: "Tümünü okundu yap", exact: true }).click(); await expect(cp).toContainText("Yeni bildiriminiz yok.");
    await f.b.bringToFront(); await expect(bp).toContainText("Yeni bildiriminiz yok.", { timeout: 35_000 });
    await bp.getByRole("tab", { name: "Geçmiş", exact: true }).click();
    for (const n of f.notes) await expect(bp.locator(`[data-notification-id="${n.id}"]`)).toBeVisible();
  } finally { await cc.close(); await f.cleanup(); }
});
