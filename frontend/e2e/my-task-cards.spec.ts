import { test, expect, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE });
type Task = { id: string; taskKey: string; title: string; status: string };
async function fixture(page: Page, mode = "SIMPLE", suffix = "") {
  const slug = await createProject(page, `Personal cards ${Date.now()} ${suffix}`);
  const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string };
  const me = (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string };
  const result = await api(page, "POST", `/projects/${project.id}/tasks`, { title: `Card task ${suffix}`, description: "A task to check directly from my personal workspace.", creationMode: mode, priority: "CRITICAL", assigneeIds: [me.id] });
  expect(result.status).toBe(201);
  return { slug, projectId: project.id, me, task: result.json as Task };
}
async function openList(page: Page, projectId: string) { await page.goto(`/tasks?project=${projectId}`); await expect(page.locator("[data-task-card]").first()).toBeVisible(); }
const taskDialog = (page: Page) => page.getByRole("dialog", { name: "Görev detayı", exact: true });
const confirmDialog = (page: Page) => page.getByRole("dialog", { name: /görevinin durumu değiştirilsin mi/ });

test("square personal cards open on the same page with keyboard, comments and refresh", async ({ page }) => {
  const f = await fixture(page);
  await openList(page, f.projectId);
  await expect(page.getByRole("heading", { name: "Görevlerim", exact: true })).toBeVisible();
  const card = page.locator(`[data-task-card="${f.task.id}"]`);
  const box = await card.boundingBox();
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(2);
  await expect(card.locator('[data-priority-alert]')).toBeVisible();
  const open = card.getByRole("button", { name: `${f.task.title}, ${f.task.taskKey} görevini aç`, exact: true });
  await open.focus(); await page.keyboard.press("Enter");
  await expect(taskDialog(page)).toBeVisible();
  await expect(page).toHaveURL(/\/tr\/gorevlerim\?/);
  await expect(taskDialog(page).getByRole("heading", { name: f.task.title })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(taskDialog(page)).toHaveCount(0);
  await expect(open).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(taskDialog(page)).toBeVisible();
  await taskDialog(page).getByRole("combobox", { name: "Yorum", exact: true }).fill("Comment from the personal task card");
  await taskDialog(page).getByRole("button", { name: "Yorum yap", exact: true }).click();
  await expect(taskDialog(page).getByRole("combobox", { name: "Yorum", exact: true })).toHaveValue("");
  await expect(taskDialog(page).getByText("Comment from the personal task card", { exact: true })).toBeVisible();
  expect((await api(page, "GET", `/projects/${f.projectId}/tasks/${f.task.id}/comments`)).json).toMatchObject({ content: [{ body: "Comment from the personal task card" }] });
  await page.reload(); await expect(taskDialog(page).getByRole("heading", { name: f.task.title })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(taskDialog(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/tr\/gorevlerim\?project=/);
  await card.getByRole("button", { name: `${f.task.taskKey} görevine yorum yap`, exact: true }).click();
  await expect(taskDialog(page).getByRole("combobox", { name: "Yorum", exact: true })).toBeFocused();
});

test("start and complete need confirmation, refresh counts and keep an open detail", async ({ page }) => {
  const f = await fixture(page);
  await openList(page, f.projectId);
  const card = page.locator(`[data-task-card="${f.task.id}"]`);
  await card.getByRole("button", { name: "Başla", exact: true }).click();
  await expect(confirmDialog(page)).toBeVisible();
  expect((await api(page, "GET", `/projects/${f.projectId}/tasks/${f.task.id}`)).json).toMatchObject({ status: "BACKLOG" });
  await confirmDialog(page).getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect((await api(page, "GET", `/projects/${f.projectId}/tasks/${f.task.id}/history`)).json).toEqual([]);
  await card.getByRole("button", { name: "Başla", exact: true }).click();
  await confirmDialog(page).getByRole("button", { name: "Durumu güncelle", exact: true }).click();
  await expect(confirmDialog(page)).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Tamamla", exact: true })).toBeVisible();
  await card.getByRole("button", { name: `${f.task.title}, ${f.task.taskKey} görevini aç`, exact: true }).click();
  await taskDialog(page).getByRole("button", { name: "Tamamla", exact: true }).click();
  await confirmDialog(page).getByRole("button", { name: "Durumu güncelle", exact: true }).click();
  await expect(confirmDialog(page)).toHaveCount(0);
  await expect(taskDialog(page)).toBeVisible();
  await expect(taskDialog(page).getByText("Tamamlandı", { exact: true }).first()).toBeVisible();
  expect((await api(page, "GET", `/projects/${f.projectId}/tasks/${f.task.id}`)).json).toMatchObject({ status: "DONE" });
  await taskDialog(page).getByRole("button", { name: "Görev detayını kapat", exact: true }).click();
  await page.getByRole("tab", { name: "Tamamlanan", exact: true }).click();
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Tamamla", exact: true })).toHaveCount(0);
});

test("a non-following co-manager receives localized work notifications and opens the task in My tasks", async ({ page, browser }) => {
  const f = await fixture(page);
  const context = await browser.newContext({ storageState: MEMBER_STORAGE });
  const manager = await context.newPage();
  try {
    await manager.goto("/projects");
    const me = (await api(manager, "GET", "/auth/me")).json as { id: string };
    const team = (await api(page, "POST", `/projects/${f.projectId}/teams`, { name: "Manager notification team" })).json as { id: string };
    const invite = (await api(page, "POST", `/projects/${f.projectId}/invitations`, { userId: me.id, roles: ["PROJECT_MANAGER"], teamId: team.id })).json as { invitationId: string; token: string };
    expect((await api(manager, "POST", `/projects/${f.projectId}/invitations/${invite.invitationId}/accept`, { token: invite.token })).status).toBe(200);
    await openList(page, f.projectId);
    await page.locator(`[data-task-card="${f.task.id}"]`).getByRole("button", { name: "Başla", exact: true }).click();
    await confirmDialog(page).getByRole("button", { name: "Durumu güncelle", exact: true }).click();
    await expect(confirmDialog(page)).toHaveCount(0);
    await manager.goto("/tasks");
    await manager.getByRole("button", { name: /^Bildirimler/ }).click();
    const started = manager.locator("[data-notification-id]").filter({ hasText: `${f.task.taskKey}: ${f.task.title} görevine başladı.` });
    await expect(started).toBeVisible();
    await started.getByRole("link", { name: "Görevi aç", exact: true }).click();
    await expect(taskDialog(manager).getByRole("heading", { name: f.task.title })).toBeVisible();
    await expect.poll(() => taskDialog(manager).evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
    await expect(manager).toHaveURL(/\/tr\/gorevlerim\?/);
    const records = (await api(manager, "GET", "/notifications?type=TASK_STATUS_CHANGED&size=100")).json as { content: { resourceId: string; read: boolean }[] };
    expect(records.content.filter(n => n.resourceId === f.task.id)).toEqual([expect.objectContaining({ read: true })]);
    await page.locator(`[data-task-card="${f.task.id}"]`).getByRole("button", { name: "Tamamla", exact: true }).click();
    await confirmDialog(page).getByRole("button", { name: "Durumu güncelle", exact: true }).click();
    await expect(confirmDialog(page)).toHaveCount(0);
    await taskDialog(manager).getByRole("button", { name: "Görev detayını kapat", exact: true }).click();
    await manager.getByRole("button", { name: /^Bildirimler/ }).click();
    await expect(manager.locator("[data-notification-id]").filter({ hasText: `${f.task.taskKey}: ${f.task.title} görevini tamamladı.` })).toBeVisible();
  } finally { await context.close(); }
});

test("advanced personal task status menu keeps review steps and asks before changing", async ({ page }) => {
  const f = await fixture(page, "ADVANCED");
  await api(page, "PATCH", `/projects/${f.projectId}/tasks/${f.task.id}/status`, { status: "TODO" });
  await api(page, "PATCH", `/projects/${f.projectId}/tasks/${f.task.id}/status`, { status: "IN_PROGRESS" });
  await openList(page, f.projectId);
  const card = page.locator(`[data-task-card="${f.task.id}"]`);
  await expect(card.getByRole("button", { name: "Tamamla", exact: true })).toHaveCount(0);
  await card.getByRole("button", { name: /Durumu değiştir/ }).click();
  await expect(page.getByRole("menuitem", { name: "Tamamlandı", exact: true })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "İncelemede", exact: true }).click();
  await expect(confirmDialog(page)).toBeVisible();
  await confirmDialog(page).getByRole("button", { name: "Durumu güncelle", exact: true }).click();
  await expect(confirmDialog(page)).toHaveCount(0);
  expect((await api(page, "GET", `/projects/${f.projectId}/tasks/${f.task.id}`)).json).toMatchObject({ status: "IN_REVIEW" });
});

test("a failed confirmed update stays retryable without losing the task", async ({ page }) => {
  const f = await fixture(page);
  await openList(page, f.projectId);
  await page.locator(`[data-task-card="${f.task.id}"]`).getByRole("button", { name: "Başla", exact: true }).click();
  await page.route(`**/api/v1/projects/${f.projectId}/tasks/${f.task.id}/status`, async route => {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR" }) });
  }, { times: 1 });
  await confirmDialog(page).getByRole("button", { name: "Durumu güncelle", exact: true }).click();
  await expect(confirmDialog(page)).toBeVisible();
  await expect(confirmDialog(page).getByRole("button", { name: "Durumu güncelle", exact: true })).toBeEnabled();
  expect((await api(page, "GET", `/projects/${f.projectId}/tasks/${f.task.id}`)).json).toMatchObject({ status: "BACKLOG" });
  await confirmDialog(page).getByRole("button", { name: "Durumu güncelle", exact: true }).click();
  await expect(confirmDialog(page)).toHaveCount(0);
  expect((await api(page, "GET", `/projects/${f.projectId}/tasks/${f.task.id}`)).json).toMatchObject({ status: "IN_PROGRESS" });
});

test("board menu and drag moves require confirmation and cancellation preserves the column", async ({ page }) => {
  const f = await fixture(page);
  await page.goto(`/projects/${f.slug}/tasks/board?sprint=all`);
  await page.getByRole("button", { name: `${f.task.taskKey} görevini taşı`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Yapılıyor", exact: true }).click();
  await confirmDialog(page).getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect((await api(page, "GET", `/projects/${f.projectId}/tasks/${f.task.id}`)).json).toMatchObject({ status: "BACKLOG" });
  const card = page.getByRole("link", { name: f.task.title }).locator("..");
  await card.dragTo(page.getByRole("region", { name: /^Yapılıyor/ }));
  await expect(confirmDialog(page)).toBeVisible();
  expect((await api(page, "GET", `/projects/${f.projectId}/tasks/${f.task.id}`)).json).toMatchObject({ status: "BACKLOG" });
  await confirmDialog(page).getByRole("button", { name: "Durumu güncelle", exact: true }).click();
  await expect(confirmDialog(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: /^Yapılıyor/ }).getByRole("link", { name: f.task.title })).toBeVisible();
});

test("completing the final row of page two returns to page one and keeps its detail open", async ({ page }) => {
  const f = await fixture(page);
  for (let i = 0; i < 25; i++) {
    expect((await api(page, "POST", `/projects/${f.projectId}/tasks`, { title: `Pagination task ${i}`, creationMode: "SIMPLE", assigneeIds: [f.me.id] })).status).toBe(201);
  }
  await page.goto(`/tasks?project=${f.projectId}&page=2`);
  await expect(page.locator("[data-task-card]")).toHaveCount(1);
  await page.locator("[data-task-card]").getByRole("button", { name: /görevini aç/ }).click();
  await taskDialog(page).getByRole("button", { name: "Başla", exact: true }).click();
  await confirmDialog(page).getByRole("button", { name: "Durumu güncelle", exact: true }).click();
  await expect(confirmDialog(page)).toHaveCount(0);
  await taskDialog(page).getByRole("button", { name: "Tamamla", exact: true }).click();
  await confirmDialog(page).getByRole("button", { name: "Durumu güncelle", exact: true }).click();
  await expect(confirmDialog(page)).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBeNull();
  await expect(taskDialog(page)).toBeVisible();
  await expect(taskDialog(page).getByText("Tamamlandı", { exact: true }).first()).toBeVisible();
  await taskDialog(page).getByRole("button", { name: "Görev detayını kapat", exact: true }).click();
  await expect(page.locator("[data-task-card]")).toHaveCount(25);
});

test("cards and dialog fit small screens in TR/EN/DE and both themes without runtime errors", async ({ page }) => {
  const f = await fixture(page, "SIMPLE", "Responsive with a deliberately long task title to check the square card and readable dialog layout on a narrow mobile screen");
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  for (const [locale, route, heading, open, close] of [
    ["tr", "/tr/gorevler", "Görevlerim", `${f.task.title}, ${f.task.taskKey} görevini aç`, "Görev detayını kapat"],
    ["en", "/en/tasks", "My tasks", `${f.task.title}, Open task ${f.task.taskKey}`, "Close task details"],
    ["de", "/de/aufgaben", "Meine Aufgaben", `${f.task.title}, Aufgabe ${f.task.taskKey} öffnen`, "Aufgabendetails schließen"],
  ]) {
    for (const dark of [false, true]) {
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(value => localStorage.setItem("theme", value), dark ? "dark" : "light");
        await page.goto(`${route}?project=${f.projectId}`);
        await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
        const themeButton = locale === "tr" ? dark ? "Koyu" : "Açık" : locale === "en" ? dark ? "Dark" : "Light" : dark ? "Dunkel" : "Hell";
        await page.mouse.move(width / 2, 8);
        await page.getByRole("button", { name: themeButton, exact: true }).click();
        await expect.poll(() => page.locator("html").evaluate(el => el.classList.contains("dark"))).toBe(dark);
        await expect(page.locator("html")).not.toHaveClass(/theme-close-in|theme-reveal/);
        const card = page.locator(`[data-task-card="${f.task.id}"]`);
        await expect(card).toBeVisible();
        const box = await card.boundingBox(); expect(Math.abs(box!.width - box!.height)).toBeLessThan(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if ((width === 390 || width === 1440) && locale === "tr") await page.screenshot({ path: `../.local/my-task-cards-${dark ? "dark" : "light"}-${width}.png`, fullPage: true });
        await card.getByRole("button", { name: open, exact: true }).click();
        const dialog = page.locator('[data-slot="dialog-content"]').first();
        await expect(dialog.getByRole("heading", { name: f.task.title })).toBeVisible();
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        if ((width === 390 || width === 1440) && locale === "tr") await page.screenshot({ path: `../.local/my-task-${locale}-${dark ? "dark" : "light"}-${width}.png` });
        await dialog.getByRole("button", { name: close, exact: true }).click();
      }
    }
  }
  expect(errors).toEqual([]);
});
