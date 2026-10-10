import { test, expect, type Browser, type Page, type Locator } from "@playwright/test";
import { api, registerUser, uniqueUser } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";
import { REJECTED_STATE } from "./consent-state";
import { openNotificationCenter } from "./notification-fixture";
import { notificationInDatabase } from "./notification-db";
import { psql, uuid } from "./db";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

type Note = { id: string };
type NotePage = { content: Note[]; totalElements: number; totalPages: number; page: number };

/** Isolated recipient (fresh account) with exactly `read` READ and `unread` UNREAD task-assignment notifications. */
async function seed(browser: Browser, counts: { read: number; unread: number }) {
  const ac = await browser.newContext({ storageState: MANAGER_STORAGE }), a = await ac.newPage();
  const bc = await browser.newContext({ storageState: REJECTED_STATE }), b = await bc.newPage();
  let projectId: string | undefined;
  try {
    await a.goto("/projects"); await registerUser(b, uniqueUser("histdel"));
    const user = (await api(b, "GET", "/auth/me")).json as { id: string };
    const created = await api(a, "POST", "/projects", { name: `History delete QA ${Date.now()}`, projectType: "WEB" });
    expect(created.status).toBe(201); projectId = (created.json as { id: string }).id;
    expect((await api(a, "PATCH", `/projects/${projectId}/task-management-mode`, { mode: "BOTH" })).status).toBe(200);
    const team = (await api(a, "POST", `/projects/${projectId}/teams`, { name: "History delete team", includeCreator: true })).json as { id: string };
    const invite = await api(a, "POST", `/projects/${projectId}/invitations`, { userId: user.id, teamId: team.id, roles: ["TESTER"] });
    expect(invite.status).toBe(201);
    expect((await api(b, "POST", `/project-invitations/${(invite.json as { invitationId: string }).invitationId}/accept`)).status).toBe(200);
    // Setup noise (invitation notices) is cleared through the real endpoints so the history holds exactly the seeded rows.
    await api(b, "PATCH", "/notifications/read-all");
    expect((await api(b, "DELETE", "/notifications?read=true")).status).toBe(200);
    const total = counts.read + counts.unread;
    for (let i = 0; i < total; i++) expect((await api(a, "POST", `/projects/${projectId}/tasks`, {
      title: `History delete task ${i}`, creationMode: "SIMPLE", assigneeIds: [user.id],
    })).status).toBe(201);
    const all = ((await api(b, "GET", "/notifications?read=false&size=100")).json as NotePage).content.map(n => n.id);
    expect(all).toHaveLength(total);
    const readIds = all.slice(0, counts.read), unreadIds = all.slice(counts.read);
    for (const id of readIds) expect((await api(b, "PATCH", `/notifications/${id}/read`)).status).toBe(200);
    const cleanup = async () => { await api(a, "POST", `/projects/${projectId}/archive`); await ac.close(); await bc.close(); };
    return { a, b, bc, user, readIds, unreadIds, projectId, cleanup };
  } catch (error) { if (projectId) await api(a, "POST", `/projects/${projectId}/archive`); await ac.close(); await bc.close(); throw error; }
}

const readRowsInDatabase = (userId: string) => Number(psql(`SELECT count(*) FROM notifications WHERE recipient_user_id='${uuid(userId)}' AND is_read=true`));
const unreadRowsInDatabase = (userId: string) => Number(psql(`SELECT count(*) FROM notifications WHERE recipient_user_id='${uuid(userId)}' AND is_read=false`));
const rows = (panel: Locator) => panel.locator("[data-notification-id]");
const trash = (row: Locator) => row.getByRole("button", { name: /bildirimini sil$/ });
async function openHistory(page: Page) {
  const panel = await openNotificationCenter(page);
  await panel.getByRole("tab", { name: "Geçmiş", exact: true }).click();
  return panel;
}

test("T11a: a single history notification is deleted after an inline confirmation; New stays untouched", async ({ browser }) => {
  test.setTimeout(120_000);
  const f = await seed(browser, { read: 3, unread: 1 });
  try {
    await f.b.goto("/projects"); const panel = await openNotificationCenter(f.b);
    await f.b.evaluate(() => { (window as unknown as { deleteDocument: number }).deleteDocument = 11; });
    await expect(rows(panel)).toHaveCount(1);
    // The New tab offers no delete action at all.
    await expect(panel.locator("[data-notification-delete-id]")).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Tümünü sil", exact: true })).toHaveCount(0);
    await panel.getByRole("tab", { name: "Geçmiş", exact: true }).click();
    await expect(rows(panel)).toHaveCount(3);
    const [first, second, third] = f.readIds;
    const row = panel.locator(`[data-notification-id="${first}"]`);
    // Cancel keeps the row and returns focus to the trash button.
    await trash(row).click();
    await expect(row.getByRole("group", { name: "Silinsin mi?" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
    await row.getByRole("button", { name: "Vazgeç", exact: true }).click();
    await expect(row.getByRole("group")).toHaveCount(0); await expect(trash(row)).toBeFocused();
    expect(notificationInDatabase(f.user.id, first)).toMatchObject({ rowCount: 1, read: true });
    // Confirmed delete: DELETE 204, row gone without reload, DB row gone, focus on the next row's delete action.
    await trash(row).click();
    const deleted = f.b.waitForResponse(r => r.url().endsWith(`/notifications/${first}`) && r.request().method() === "DELETE");
    await row.getByRole("button", { name: "Evet, sil", exact: true }).click();
    expect((await deleted).status()).toBe(204);
    await expect(row).toHaveCount(0); await expect(rows(panel)).toHaveCount(2);
    await expect(trash(panel.locator(`[data-notification-id="${second}"]`))).toBeFocused();
    expect(notificationInDatabase(f.user.id, first)).toMatchObject({ rowCount: 0 });
    for (const id of [second, third]) expect(notificationInDatabase(f.user.id, id)).toMatchObject({ rowCount: 1, read: true });
    expect(readRowsInDatabase(f.user.id)).toBe(2);
    expect(((await api(f.b, "GET", "/notifications?read=true&size=20")).json as NotePage).totalElements).toBe(2);
    expect(await f.b.evaluate(() => (window as unknown as { deleteDocument: number }).deleteDocument)).toBe(11);
    // New tab and unread badge unchanged.
    await expect(f.b.getByLabel("1 okunmamış bildirim", { exact: true })).toBeVisible();
    await panel.getByRole("tab", { name: "Yeni", exact: true }).click();
    await expect(rows(panel)).toHaveCount(1); expect(unreadRowsInDatabase(f.user.id)).toBe(1);
    // A deleted id is gone for good, an unread one is never deletable.
    expect((await api(f.b, "DELETE", `/notifications/${first}`)).status).toBe(404);
    expect((await api(f.b, "DELETE", `/notifications/${f.unreadIds[0]}`)).status).toBe(404);
    expect(notificationInDatabase(f.user.id, f.unreadIds[0])).toMatchObject({ rowCount: 1, read: false });
  } finally { await f.cleanup(); }
});

test("T11b: Delete all needs a confirmation, removes only the read history and keeps New and the badge", async ({ browser }) => {
  test.setTimeout(120_000);
  const f = await seed(browser, { read: 2, unread: 4 });
  try {
    await f.b.goto("/projects"); const panel = await openNotificationCenter(f.b);
    await expect(rows(panel)).toHaveCount(4); await expect(f.b.getByLabel("4 okunmamış bildirim", { exact: true })).toBeVisible();
    await panel.getByRole("tab", { name: "Geçmiş", exact: true }).click(); await expect(rows(panel)).toHaveCount(2);
    const all = panel.getByRole("button", { name: "Tümünü sil", exact: true });
    // Cancel first: nothing is deleted and the popover stays open.
    await all.click();
    const dialog = f.b.getByRole("dialog", { name: "Geçmiş bildirimleri sil", exact: true });
    await expect(dialog).toContainText("Geçmiş bildirimlerin tamamı silinecek. Bu işlem geri alınamaz.");
    await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
    await expect(dialog).toBeHidden(); await expect(panel).toBeVisible(); await expect(rows(panel)).toHaveCount(2);
    expect(readRowsInDatabase(f.user.id)).toBe(2);
    // Escape closes only the confirmation, not the popover.
    await all.click(); await expect(dialog).toBeVisible(); await f.b.keyboard.press("Escape");
    await expect(dialog).toBeHidden(); await expect(panel).toBeVisible(); await expect(rows(panel)).toHaveCount(2);
    // Confirm.
    await all.click();
    const bulk = f.b.waitForResponse(r => r.request().method() === "DELETE" && new URL(r.url()).pathname === "/api/v1/notifications" && new URL(r.url()).searchParams.get("read") === "true");
    await dialog.getByRole("button", { name: "Tümünü sil", exact: true }).click();
    const response = await bulk; expect(response.status()).toBe(200); expect(await response.json()).toMatchObject({ count: 2 });
    await expect(dialog).toBeHidden();
    await expect(f.b.getByText("2 bildirim silindi", { exact: true })).toBeVisible();
    await expect(panel).toContainText("Henüz geçmiş bildiriminiz yok."); await expect(rows(panel)).toHaveCount(0);
    await expect(panel.locator("[data-notification-empty]")).toBeFocused();
    await expect(all).toBeDisabled();
    expect(readRowsInDatabase(f.user.id)).toBe(0); expect(unreadRowsInDatabase(f.user.id)).toBe(4);
    await expect(f.b.getByLabel("4 okunmamış bildirim", { exact: true })).toBeVisible();
    await panel.getByRole("tab", { name: "Yeni", exact: true }).click(); await expect(rows(panel)).toHaveCount(4);
    for (const id of f.unreadIds) expect(notificationInDatabase(f.user.id, id)).toMatchObject({ rowCount: 1, read: false });
    await f.b.reload(); const again = await openHistory(f.b);
    await expect(again).toContainText("Henüz geçmiş bildiriminiz yok.");
  } finally { await f.cleanup(); }
});

test("deleting the sole row of the last history page returns to the previous page without an empty page", async ({ browser }) => {
  test.setTimeout(150_000);
  const f = await seed(browser, { read: 21, unread: 0 });
  try {
    await f.b.goto("/projects"); const panel = await openHistory(f.b);
    await expect(rows(panel)).toHaveCount(20);
    await panel.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
    await expect(rows(panel)).toHaveCount(1); await expect(panel).toContainText("Sayfa 2 / 2");
    const last = rows(panel); const id = (await last.getAttribute("data-notification-id"))!;
    // Record whether the empty state ever flashes while the page is reconciled.
    await f.b.evaluate(() => {
      const w = window as unknown as { emptyShown: boolean };
      w.emptyShown = false;
      new MutationObserver(() => { if (document.querySelector("[data-notification-empty]")) w.emptyShown = true; }).observe(document.body, { childList: true, subtree: true });
    });
    await trash(last).click(); await last.getByRole("button", { name: "Evet, sil", exact: true }).click();
    await expect(rows(panel)).toHaveCount(20); await expect(panel.getByRole("button", { name: "Sonraki sayfa", exact: true })).toHaveCount(0);
    expect(await f.b.evaluate(() => (window as unknown as { emptyShown: boolean }).emptyShown)).toBe(false);
    expect(notificationInDatabase(f.user.id, id)).toMatchObject({ rowCount: 0 });
    expect(readRowsInDatabase(f.user.id)).toBe(20);
    await expect(panel.locator("[data-notification-delete-id]").first()).toBeFocused();
  } finally { await f.cleanup(); }
});

test("a failed delete keeps the row and the data; delete-all failure keeps the dialog open; retry works", async ({ browser }) => {
  test.setTimeout(120_000);
  const f = await seed(browser, { read: 2, unread: 0 });
  try {
    await f.b.goto("/projects"); const panel = await openHistory(f.b);
    await expect(rows(panel)).toHaveCount(2);
    const fail = (url: URL) => url.pathname.startsWith("/api/v1/notifications");
    // TEST-ONLY: the server rejects the DELETE; nothing may change client- or server-side.
    await f.b.route(fail, route => route.request().method() === "DELETE"
      ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ status: 500 }) }) : route.fallback());
    const row = panel.locator(`[data-notification-id="${f.readIds[0]}"]`);
    await trash(row).click(); await row.getByRole("button", { name: "Evet, sil", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("Silme işlemi tamamlanamadı. Tekrar deneyin.");
    await expect(rows(panel)).toHaveCount(2); await expect(row.getByRole("group")).toHaveCount(0);
    await expect(trash(row)).toBeFocused(); await expect(trash(row)).toBeEnabled();
    expect(readRowsInDatabase(f.user.id)).toBe(2);
    // Delete all: the dialog stays open with its own error.
    await panel.getByRole("button", { name: "Tümünü sil", exact: true }).click();
    const dialog = f.b.getByRole("dialog", { name: "Geçmiş bildirimleri sil", exact: true });
    await dialog.getByRole("button", { name: "Tümünü sil", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Silme işlemi tamamlanamadı. Tekrar deneyin.");
    expect(readRowsInDatabase(f.user.id)).toBe(2);
    await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click(); await expect(dialog).toBeHidden();
    await expect(rows(panel)).toHaveCount(2);
    await f.b.unroute(fail);
    // Retry succeeds against the real server.
    await trash(row).click(); await row.getByRole("button", { name: "Evet, sil", exact: true }).click();
    await expect(row).toHaveCount(0); await expect(rows(panel)).toHaveCount(1);
    expect(readRowsInDatabase(f.user.id)).toBe(1);
  } finally { await f.b.unrouteAll({ behavior: "ignoreErrors" }); await f.cleanup(); }
});

test("keyboard: trash is reachable by Tab, Enter confirms, Escape and leaving the row cancel, focus follows the row", async ({ browser }) => {
  test.setTimeout(120_000);
  const f = await seed(browser, { read: 3, unread: 0 });
  try {
    await f.b.goto("/projects"); const panel = await openHistory(f.b);
    await expect(rows(panel)).toHaveCount(3);
    const [first, second, third] = f.readIds.map(id => panel.locator(`[data-notification-id="${id}"]`));
    const historyTab = panel.getByRole("tab", { name: "Geçmiş", exact: true });
    await historyTab.focus();
    for (let i = 0; i < 8 && !(await trash(first).evaluate(el => el === document.activeElement)); i++) await f.b.keyboard.press("Tab");
    await expect(trash(first)).toBeFocused();
    // Enter opens the confirmation with focus on the safe action; Escape cancels it and keeps the popover open.
    await f.b.keyboard.press("Enter"); await expect(first.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
    await f.b.keyboard.press("Escape");
    await expect(first.getByRole("group")).toHaveCount(0); await expect(panel).toBeVisible(); await expect(trash(first)).toBeFocused();
    expect(readRowsInDatabase(f.user.id)).toBe(3);
    // Leaving the row auto-cancels the confirmation.
    await f.b.keyboard.press("Enter"); await expect(first.getByRole("group")).toBeVisible();
    await f.b.keyboard.press("Tab"); await expect(first.getByRole("button", { name: "Evet, sil", exact: true })).toBeFocused();
    await f.b.keyboard.press("Tab"); await expect(first.getByRole("group")).toHaveCount(0);
    // Confirm with the keyboard; focus moves to the next row's delete action.
    await trash(first).focus(); await f.b.keyboard.press("Enter");
    await f.b.keyboard.press("Tab"); await expect(first.getByRole("button", { name: "Evet, sil", exact: true })).toBeFocused();
    await f.b.keyboard.press("Enter");
    await expect(first).toHaveCount(0); await expect(trash(second)).toBeFocused();
    expect(notificationInDatabase(f.user.id, f.readIds[0])).toMatchObject({ rowCount: 0 });
    // Deleting the last row falls back to the previous one.
    await trash(third).focus(); await f.b.keyboard.press("Enter");
    await f.b.keyboard.press("Tab"); await f.b.keyboard.press("Enter");
    await expect(third).toHaveCount(0); await expect(trash(second)).toBeFocused();
    // Deleting the only remaining row lands on the named empty section.
    await f.b.keyboard.press("Enter"); await f.b.keyboard.press("Tab"); await f.b.keyboard.press("Enter");
    await expect(panel.locator("[data-notification-empty]")).toBeFocused();
    expect(readRowsInDatabase(f.user.id)).toBe(0);
  } finally { await f.cleanup(); }
});

for (const [locale, catalog] of Object.entries({ tr, en, de })) {
  test(`${locale}: delete controls fit the popover at 320 and 390 px in light and dark with 44px targets`, async ({ browser }) => {
    test.setTimeout(150_000);
    const f = await seed(browser, { read: 2, unread: 0 });
    const t = catalog.notifications;
    try {
      for (const dark of [false, true]) for (const width of [320, 390]) {
        await f.b.setViewportSize({ width, height: 900 });
        await f.b.goto(`/${locale}/projects`);
        // TEST-ONLY presentation state.
        await f.b.evaluate(dark => { document.documentElement.classList.toggle("dark", dark); document.documentElement.dataset.motion = "off"; }, dark);
        await f.b.mouse.move(20, 2);
        await f.b.getByRole("button", { name: catalog.workspace.notifications, exact: true }).click();
        const panel = f.b.getByRole("dialog", { name: t.title, exact: true }); await expect(panel).toBeVisible();
        await panel.getByRole("tab", { name: t.historyLabel, exact: true }).click();
        await expect(rows(panel)).toHaveCount(2);
        const name = t.deleteNamed.replace("{title}", t.types.TASK_ASSIGNED);
        const del = panel.getByRole("button", { name, exact: true }).first();
        const all = panel.getByRole("button", { name: t.deleteAll, exact: true });
        for (const target of [del, all]) { const box = (await target.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(43.5); expect(box.width).toBeGreaterThanOrEqual(43.5); }
        await del.click();
        const group = panel.getByRole("group", { name: t.confirmQuestion, exact: true });
        await expect(group).toBeVisible();
        for (const label of [t.cancel, t.confirmYes]) {
          const box = (await group.getByRole("button", { name: label, exact: true }).boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(43.5);
        }
        expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        const popup = (await panel.boundingBox())!; expect(popup.x).toBeGreaterThanOrEqual(-1); expect(popup.x + popup.width).toBeLessThanOrEqual(width + 1);
        const g = (await group.boundingBox())!; expect(g.x + g.width).toBeLessThanOrEqual(popup.x + popup.width + 1);
        expect(await f.b.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        await group.getByRole("button", { name: t.cancel, exact: true }).click();
        await all.click();
        const dialog = f.b.getByRole("dialog", { name: t.deleteAllTitle, exact: true });
        await expect(dialog).toContainText(t.deleteAllDescription);
        const box = (await dialog.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(-1); expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        for (const label of [t.cancel, t.deleteAll]) expect((await dialog.getByRole("button", { name: label, exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(35);
        await dialog.getByRole("button", { name: t.cancel, exact: true }).click(); await expect(dialog).toBeHidden();
        await f.b.keyboard.press("Escape"); await expect(panel).toBeHidden();
      }
      expect(readRowsInDatabase(f.user.id)).toBe(2);
    } finally { await f.cleanup(); }
  });
}

test("another account never sees or deletes these rows; delete-all only touches the caller's history", async ({ browser }) => {
  test.setTimeout(180_000);
  const one = await seed(browser, { read: 2, unread: 1 });
  let two: Awaited<ReturnType<typeof seed>> | undefined;
  try {
    two = await seed(browser, { read: 2, unread: 1 });
    // Server contract seen from the other account: foreign, unread and unknown ids are all 404.
    for (const id of [...one.readIds, ...one.unreadIds, "00000000-0000-0000-0000-000000000000"]) expect((await api(two.b, "DELETE", `/notifications/${id}`)).status).toBe(404);
    expect(readRowsInDatabase(one.user.id)).toBe(2); expect(unreadRowsInDatabase(one.user.id)).toBe(1);
    // Account one wipes its history through the UI.
    await one.b.goto("/projects"); const panelOne = await openHistory(one.b);
    await expect(rows(panelOne)).toHaveCount(2);
    await panelOne.getByRole("button", { name: "Tümünü sil", exact: true }).click();
    await one.b.getByRole("dialog", { name: "Geçmiş bildirimleri sil", exact: true }).getByRole("button", { name: "Tümünü sil", exact: true }).click();
    await expect(panelOne).toContainText("Henüz geçmiş bildiriminiz yok.");
    expect(readRowsInDatabase(one.user.id)).toBe(0); expect(unreadRowsInDatabase(one.user.id)).toBe(1);
    // Account two is unaffected in the database and in its own UI.
    expect(readRowsInDatabase(two.user.id)).toBe(2); expect(unreadRowsInDatabase(two.user.id)).toBe(1);
    await two.b.goto("/projects"); const panelTwo = await openHistory(two.b);
    await expect(rows(panelTwo)).toHaveCount(2);
    for (const id of two.readIds) await expect(panelTwo.locator(`[data-notification-id="${id}"]`)).toBeVisible();
    for (const id of one.readIds) await expect(panelTwo.locator(`[data-notification-id="${id}"]`)).toHaveCount(0);
    expect(((await api(two.b, "GET", "/notifications?read=true&size=20")).json as NotePage).totalElements).toBe(2);
    // Account two's own delete-all returns its own count only.
    expect((await api(two.b, "DELETE", "/notifications")).status).toBe(400);
    expect((await api(two.b, "DELETE", "/notifications?read=false")).status).toBe(400);
  } finally { await two?.cleanup(); await one.cleanup(); }
});
