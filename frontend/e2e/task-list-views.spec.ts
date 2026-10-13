import { test, expect, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";
import tr from "../src/i18n/messages/tr.json";

test.use({ storageState: MANAGER_STORAGE });

type Task = { id: string; taskKey: string; title: string };

async function fixture(page: Page, title: string) {
  const slug = await createProject(page, `List views ${Date.now()}`);
  const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string };
  const me = (await api(page, "GET", "/auth/me")).json as { id: string };
  const created = await api(page, "POST", `/projects/${project.id}/tasks`, { title, creationMode: "SIMPLE", priority: "HIGH", assigneeIds: [me.id] });
  expect(created.status).toBe(201);
  return { slug, projectId: project.id, task: created.json as Task };
}

test("a task cannot start or end in the past: those days are not selectable", async ({ page }) => {
  const slug = await createProject(page, `Past dates ${Date.now()}`);
  await page.goto(`/projects/${slug}/tasks/new`);
  for (const id of ["task-start", "task-deadline-date"]) {
    await page.locator(`#${id}`).click();
    // The calendar greys out every day before today; the days from today on stay selectable.
    await expect(page.getByRole("button", { name: /Seçilemez tarih/ }).first()).toBeVisible();
    const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
    await expect(page.getByRole("button", { name: today, exact: true })).toBeEnabled();
    await page.keyboard.press("Escape");
  }
});

test("a started task moves freely between review, testing and done", async ({ page }) => {
  const f = await fixture(page, "Simple review path");
  expect((await api(page, "PATCH", `/projects/${f.projectId}/tasks/${f.task.id}/status`, { status: "IN_PROGRESS" })).status).toBe(200);
  await page.goto(`/projects/${f.slug}/tasks`);
  const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: f.task.title, exact: true }) });
  await row.getByRole("button", { name: /Durumu değiştir/ }).click();
  await expect(page.getByRole("menuitem", { name: "İncelemede", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Testte", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Tamamlandı", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "İncelemede", exact: true }).click();
  await page.getByRole("dialog", { name: /görevinin durumu değiştirilsin mi/ }).getByRole("button", { name: "Durumu güncelle", exact: true }).click();
  await expect.poll(async () => ((await api(page, "GET", `/projects/${f.projectId}/tasks/${f.task.id}`)).json as { status: string }).status).toBe("IN_REVIEW");
  await row.getByRole("button", { name: /Durumu değiştir/ }).click();
  for (const name of ["Yapılıyor", "Testte", "Tamamlandı"]) await expect(page.getByRole("menuitem", { name, exact: true })).toBeVisible();
});

test("Görevler: table or cards, the choice is remembered, and overdue lives in the status filter", async ({ page }) => {
  const f = await fixture(page, "View toggle task");
  await page.goto(`/projects/${f.slug}/tasks`);
  await expect(page.getByRole("tab", { name: "Tablo", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Engelli/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Atanan/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Gecikmiş", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: tr.tasks.filters.status, exact: true }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: "Gecikmiş", exact: true })).toBeVisible();
  await page.getByRole("menuitemcheckbox", { name: "Gecikmiş", exact: true }).click();
  await expect(page).toHaveURL(/overdue=1/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Temizle", exact: true }).click();
  await expect(page).not.toHaveURL(/overdue=1/);

  await page.getByRole("tab", { name: "Kart", exact: true }).click();
  await expect(page.locator(`[data-task-card="${f.task.id}"]`)).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Kart", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(`[data-task-card="${f.task.id}"]`)).toBeVisible();
});

test("Görevlerim: Tümü / Açık / Tamamlanan, no pool or blocked, overdue inside the status filter, cards or table", async ({ page }) => {
  const f = await fixture(page, "My list task");
  await page.goto(`/tasks?project=${f.projectId}`);
  await expect(page.getByRole("heading", { name: "Görevlerim", exact: true })).toBeVisible();
  await expect(page.getByRole("tab").filter({ hasText: /^(Tümü|Açık|Tamamlanan)$/ })).toHaveText(["Tümü", "Açık", "Tamamlanan"]);
  await expect(page.getByRole("tab", { name: "Havuz", exact: true })).toHaveCount(0);
  await expect(page.getByText("Engelli", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Havuzda", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Gecikmiş", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: tr.tasks.my.filters.status, exact: true }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: "Gecikmiş", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  const card = page.locator(`[data-task-card="${f.task.id}"]`);
  await expect(card).toBeVisible();
  expect((await card.boundingBox())!.height).toBeLessThan(300);

  await page.getByRole("tab", { name: "Tablo", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: f.task.title });
  await expect(row).toBeVisible();
  await expect(card).toHaveCount(0);
  await row.getByRole("button", { name: f.task.title, exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Görev detayı", exact: true })).toBeVisible();
});
