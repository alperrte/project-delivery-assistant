import { test, expect } from "@playwright/test";
import { api, registerUser, uniqueUser } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";
import { readFileSync } from "node:fs";
import { MEMBER_USER_FILE } from "./global-setup";
import { login } from "./helpers";
import { notificationFixture, openNotificationCenter } from "./notification-fixture";
import { notificationInDatabase } from "./notification-db";

type Note = { id: string; read: boolean; resourceId: string };
type NotePage = { content: Note[]; totalElements: number; totalPages: number; page: number };

test("real unread and history tabs use independent server pages, lazy queries and recover from a history failure", async ({ browser }) => {
  test.setTimeout(150_000);
  const ac = await browser.newContext({ storageState: MANAGER_STORAGE }), a = await ac.newPage();
  const bc = await browser.newContext(), b = await bc.newPage();
  let projectId: string | undefined;
  try {
    await a.goto("/projects"); await registerUser(b, uniqueUser("history"));
    const recipient = (await api(b, "GET", "/auth/me")).json as { id: string };
    const created = await api(a, "POST", "/projects", { name: `History QA ${Date.now()}`, projectType: "WEB" });
    expect(created.status).toBe(201); const project = created.json as { id: string }; projectId = project.id;
    expect((await api(a, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "BOTH" })).status).toBe(200);
    const team = (await api(a, "POST", `/projects/${project.id}/teams`, { name: "History team", includeCreator: true })).json as { id: string };
    const invite = await api(a, "POST", `/projects/${project.id}/invitations`, { userId: recipient.id, teamId: team.id, roles: ["TESTER"] });
    expect(invite.status).toBe(201);
    expect((await api(b, "POST", `/project-invitations/${(invite.json as { invitationId: string }).invitationId}/accept`)).status).toBe(200);
    await api(b, "PATCH", "/notifications/read-all");
    for (let i = 0; i < 41; i++) expect((await api(a, "POST", `/projects/${project.id}/tasks`, {
      title: `History acceptance ${i}`, creationMode: "SIMPLE", assigneeIds: [recipient.id],
    })).status).toBe(201);
    const assigned = (await api(b, "GET", "/notifications?type=TASK_ASSIGNED&size=100&read=false")).json as NotePage;
    expect(assigned.totalElements).toBe(41);
    for (const n of assigned.content.slice(0, 20)) expect((await api(b, "PATCH", `/notifications/${n.id}/read`)).status).toBe(200);
    const requested: string[] = [];
    b.on("request", request => { const url = new URL(request.url()); if (url.pathname === "/api/v1/notifications") requested.push(url.search); });
    await b.goto("/projects"); await b.mouse.move(20, 2);
    await b.getByRole("button", { name: "Bildirimler", exact: true }).click();
    const panel = b.getByRole("dialog", { name: "Bildirimler", exact: true });
    const active = panel.getByRole("tab", { name: "Yeni", exact: true });
    const history = panel.getByRole("tab", { name: "Geçmiş", exact: true });
    await expect(active).toHaveAttribute("aria-selected", "true");
    await expect(panel.locator("[data-notification-id]")).toHaveCount(20);
    expect(requested.some(q => new URLSearchParams(q).get("read") === "true")).toBe(false);
    const unread = (await api(b, "GET", "/notifications?read=false&page=0&size=20")).json as NotePage;
    expect(unread.totalElements).toBe(21); expect(unread.content.every(n => !n.read)).toBe(true);
    await panel.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
    await expect(panel.locator("[data-notification-id]")).toHaveCount(1);
    await history.click(); await expect(history).toHaveAttribute("aria-selected", "true");
    await expect(panel.locator("[data-notification-id]")).toHaveCount(20);
    const past = (await api(b, "GET", "/notifications?read=true&page=0&size=20")).json as NotePage;
    expect(past.content.every(n => n.read)).toBe(true);
    await expect(panel.getByRole("button", { name: "Okundu olarak işaretle", exact: true })).toHaveCount(0);
    await active.click(); await expect(panel.locator("[data-notification-id]")).toHaveCount(1);
    // TEST-ONLY network fault; recovery still reads actual persisted history.
    await b.route("**/api/v1/notifications?**", route => new URL(route.request().url()).searchParams.get("read") === "true" ? route.abort("failed") : route.continue());
    await history.click(); await expect(panel.getByRole("alert")).toBeVisible();
    await b.unroute("**/api/v1/notifications?**"); await panel.getByRole("button", { name: "Tekrar dene", exact: true }).click();
    await expect(panel.locator("[data-notification-id]")).toHaveCount(20);
    await panel.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
    await expect.poll(() => panel.locator("[data-notification-id]").count()).toBe(past.totalElements - 20);
    const all = panel.getByRole("button", { name: "Tümünü okundu yap", exact: true });
    const bulk = b.waitForResponse(response => response.url().endsWith("/notifications/read-all") && response.request().method() === "PATCH");
    await all.click(); expect((await bulk).status()).toBe(200);
    await expect(all).toBeDisabled();
    await b.keyboard.press("Escape"); await expect(panel).toBeHidden();
    await b.mouse.move(20, 2); await b.getByRole("button", { name: "Bildirimler", exact: true }).click();
    await expect(active).toHaveAttribute("aria-selected", "true"); await expect(panel).toContainText("Yeni bildiriminiz yok.");
    await history.click(); await expect(panel.locator("[data-notification-id]")).toHaveCount(20);
    const allHistory = (await api(b, "GET", "/notifications?read=true&size=20")).json as NotePage;
    expect(allHistory.totalPages).toBe(3);
    expect(requested.every(q => new URLSearchParams(q).get("size") === "20")).toBe(true);
  } finally {
    if (projectId) await api(a, "POST", `/projects/${projectId}/archive`);
    await ac.close(); await bc.close();
  }
});

test("individual and all reads update warm tabs/count, preserve DB rows and move focus without reloading", async ({ browser }) => {
  const f = await notificationFixture(browser); const n1 = f.notes[0], n2 = f.notes[1];
  let loginContext;
  try {
    await f.b.goto("/projects"); const panel = await openNotificationCenter(f.b);
    await f.b.evaluate(() => { (window as unknown as { readDocument: number }).readDocument = 77; });
    await expect(panel.locator("[data-notification-id]")).toHaveCount(2);
    const first = panel.locator(`[data-notification-id="${n1.id}"]`), second = panel.locator(`[data-notification-id="${n2.id}"]`);
    const button = first.getByRole("button", { name: "Okundu olarak işaretle", exact: true });
    await button.focus(); await button.press("Enter");
    await expect(first).toHaveCount(0); await expect(second.getByRole("button", { name: "Okundu olarak işaretle", exact: true })).toBeFocused();
    expect(notificationInDatabase(f.user.id, n1.id)).toMatchObject({ rowCount: 1, read: true, unreadCount: 1 });
    const firstReadAt = notificationInDatabase(f.user.id, n1.id).readAt; expect(firstReadAt).toBeTruthy();
    expect(notificationInDatabase(f.user.id, n2.id)).toMatchObject({ read: false, readAt: null });
    await expect(f.b.getByLabel("1 okunmamış bildirim", { exact: true })).toBeVisible();
    await panel.getByRole("tab", { name: "Geçmiş", exact: true }).click();
    await expect(panel.locator(`[data-notification-id="${n1.id}"]`)).toContainText("Okundu");
    await panel.getByRole("tab", { name: "Yeni", exact: true }).click();
    const all = panel.getByRole("button", { name: "Tümünü okundu yap", exact: true });
    await all.focus(); await all.press("Space"); await expect(panel).toContainText("Yeni bildiriminiz yok.");
    await expect(panel.locator("[data-notification-empty]")).toBeFocused(); await expect(all).toBeDisabled();
    expect(notificationInDatabase(f.user.id, n2.id)).toMatchObject({ rowCount: 1, read: true, unreadCount: 0 });
    expect(notificationInDatabase(f.user.id, n1.id).readAt).toBe(firstReadAt);
    expect(await f.b.evaluate(() => (window as unknown as { readDocument: number }).readDocument)).toBe(77);
    await panel.getByRole("tab", { name: "Geçmiş", exact: true }).click();
    for (const n of f.notes) await expect(panel.locator(`[data-notification-id="${n.id}"]`)).toBeVisible();
    await f.b.reload(); const again = await openNotificationCenter(f.b); await expect(again).toContainText("Yeni bildiriminiz yok.");
    loginContext = await browser.newContext(); const logged = await loginContext.newPage();
    const credentials = JSON.parse(readFileSync(MEMBER_USER_FILE, "utf8")); await login(logged, credentials.email, credentials.password);
    const afterLogin = await openNotificationCenter(logged); await expect(afterLogin).toContainText("Yeni bildiriminiz yok.");
    await afterLogin.getByRole("tab", { name: "Geçmiş", exact: true }).click();
    for (const n of f.notes) await expect(afterLogin.locator(`[data-notification-id="${n.id}"]`)).toBeVisible();
  } finally { await loginContext?.close(); await f.cleanup(); }
});

test("read failures keep unread state; same-frame submit is single and committed read refresh failures retry GET only", async ({ browser }) => {
  const f = await notificationFixture(browser); const n = f.notes[0]; let release!: () => void;
  try {
    await f.b.goto("/projects"); const panel = await openNotificationCenter(f.b);
    const button = panel.locator(`[data-notification-id="${n.id}"]`).getByRole("button", { name: "Okundu olarak işaretle", exact: true });
    // TEST-ONLY mark-all failure before dispatch: no unread row or count may change.
    await f.b.route("**/api/v1/notifications/read-all", route => route.abort("failed"));
    await panel.getByRole("button", { name: "Tümünü okundu yap", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("Okuma durumu güncellenemedi.");
    for (const note of f.notes) expect(notificationInDatabase(f.user.id, note.id)).toMatchObject({ read: false, unreadCount: 2 });
    await f.b.unroute("**/api/v1/notifications/read-all");
    // TEST-ONLY pre-dispatch network failure; real DB must stay unread.
    await f.b.route(`**/api/v1/notifications/${n.id}/read`, route => route.abort("failed"));
    await button.click(); await expect(panel.getByRole("alert")).toContainText("Okuma durumu güncellenemedi.");
    expect(notificationInDatabase(f.user.id, n.id)).toMatchObject({ read: false, unreadCount: 2 });
    await f.b.unroute(`**/api/v1/notifications/${n.id}/read`);
    const gate = new Promise<void>(resolve => { release = resolve; }); let submits = 0;
    await f.b.route(`**/api/v1/notifications/${n.id}/read`, async route => { submits++; await gate; await route.continue(); });
    await button.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
    await expect(button).toBeDisabled(); await expect.poll(() => submits).toBe(1);
    // TEST-ONLY GET failure after the real successful mutation; no fabricated success response.
    await f.b.route("**/api/v1/notifications?**", route => route.abort("failed"));
    release(); await expect(panel.getByRole("alert")).toContainText("Okuma durumu kaydedildi");
    expect(notificationInDatabase(f.user.id, n.id)).toMatchObject({ read: true, unreadCount: 1 });
    const saved = notificationInDatabase(f.user.id, n.id).readAt;
    await f.b.unroute("**/api/v1/notifications?**");
    await panel.getByRole("button", { name: "Tekrar dene", exact: true }).click();
    await expect(panel.locator(`[data-notification-id="${n.id}"]`)).toHaveCount(0); expect(submits).toBe(1);
    await panel.getByRole("tab", { name: "Geçmiş", exact: true }).click(); await expect(panel.locator(`[data-notification-id="${n.id}"]`)).toBeVisible();
    expect(notificationInDatabase(f.user.id, n.id).readAt).toBe(saved);
  } finally { release?.(); await f.b.unrouteAll({ behavior: "ignoreErrors" }); await f.cleanup(); }
});

test("reading the sole last-page item clamps the server page; mark-all covers more than the visible page", async ({ browser }) => {
  const f = await notificationFixture(browser, 21);
  try {
    await f.b.goto("/projects"); const panel = await openNotificationCenter(f.b);
    await expect(panel.locator("[data-notification-id]")).toHaveCount(20);
    await panel.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
    await expect(panel.locator("[data-notification-id]")).toHaveCount(1);
    const last = panel.locator("[data-notification-id]"); const id = (await last.getAttribute("data-notification-id"))!;
    await last.getByRole("button", { name: "Okundu olarak işaretle", exact: true }).click();
    await expect(panel.locator("[data-notification-id]")).toHaveCount(20);
    await expect(panel.getByRole("button", { name: "Sonraki sayfa", exact: true })).toHaveCount(0);
    expect(notificationInDatabase(f.user.id, id)).toMatchObject({ read: true, unreadCount: 20 });
    for (let i = 0; i < 2; i++) expect((await api(f.a, "POST", `/projects/${f.projectId}/tasks`, {
      title: `Unread outside current page ${i}`, creationMode: "SIMPLE", assigneeIds: [f.user.id],
    })).status).toBe(201);
    expect((await api(f.b, "GET", "/notifications/unread-count")).json).toMatchObject({ count: 22 });
    const response = f.b.waitForResponse(r => r.url().endsWith("/notifications/read-all") && r.request().method() === "PATCH");
    await panel.getByRole("button", { name: "Tümünü okundu yap", exact: true }).click();
    expect(await (await response).json()).toMatchObject({ count: 22 });
    await expect(panel).toContainText("Yeni bildiriminiz yok.");
    for (const n of f.notes) expect(notificationInDatabase(f.user.id, n.id)).toMatchObject({ rowCount: 1, read: true, unreadCount: 0 });
  } finally { await f.cleanup(); }
});
