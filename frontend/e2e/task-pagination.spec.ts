import { test, expect } from "@playwright/test";
import { api } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";
import tr from "../src/i18n/messages/tr.json";

test.use({ storageState: MANAGER_STORAGE });

test("Tasks and My tasks paginate cards and tables by nine, including grouped pages and shrinking results", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/dashboard");
  const created = await api(page, "POST", "/projects", { name: `Nine task pages ${Date.now()}`, projectTypes: ["WEB"] });
  expect(created.status).toBe(201);
  const project = created.json as { id: string; slug: string };
  const me = (await api(page, "GET", "/auth/me")).json as { id: string };
  expect((await api(page, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "BOTH" })).status).toBe(200);
  try {
    for (let i = 0; i < 19; i++) {
      const task = await api(page, "POST", `/projects/${project.id}/tasks`, { title: `Nine task ${String(i).padStart(2, "0")}`, creationMode: "SIMPLE", assigneeIds: [me.id] });
      expect(task.status).toBe(201);
    }
    for (const route of [`/projects/${project.slug}/tasks`, `/tasks?project=${project.id}&tab=all`]) {
      await page.goto(route);
      for (const view of ["Tablo", "Kart"]) {
        await page.getByRole("tab", { name: view, exact: true }).click();
        const rows = view === "Kart" ? page.locator("[data-task-card]") : page.locator("table tbody tr");
        const nav = page.getByRole("navigation", { name: tr.common.pagination.navLabel, exact: true });
        await expect(rows).toHaveCount(9);
        await expect(nav.getByRole("button", { name: tr.common.pagination.previous, exact: true })).toBeDisabled();
        await expect(rows.first()).toContainText("Nine task 18");
        const firstPage = await rows.allTextContents();
        await nav.getByRole("button", { name: tr.common.pagination.next, exact: true }).click();
        await expect(page).toHaveURL(/page=2/);
        await expect.poll(() => rows.allTextContents()).not.toEqual(firstPage);
        await expect(rows).toHaveCount(9);
        await page.reload();
        await expect(rows).toHaveCount(9);
        await expect(nav.getByRole("button", { name: "Sayfa 2", exact: true })).toHaveAttribute("aria-current", "page");
        const secondPage = await rows.allTextContents();
        expect(secondPage.every(text => !firstPage.includes(text))).toBe(true);
        await nav.getByRole("button", { name: "Sayfa 3", exact: true }).click();
        await expect(rows).toHaveCount(1);
        expect((await rows.allTextContents()).every(text => !firstPage.includes(text) && !secondPage.includes(text))).toBe(true);
        await expect(nav.getByRole("button", { name: tr.common.pagination.next, exact: true })).toBeDisabled();
        await nav.getByRole("button", { name: tr.common.pagination.previous, exact: true }).click();
        await expect(rows).toHaveCount(9);
        await nav.getByRole("button", { name: "Sayfa 1", exact: true }).click();
        await expect(rows).toHaveCount(9);
        await expect(rows.first()).toContainText("Nine task 18");
      }
      const nav = page.getByRole("navigation", { name: tr.common.pagination.navLabel, exact: true });
      await nav.getByRole("button", { name: "Sayfa 3", exact: true }).click();
      await expect(page.locator("[data-task-card]")).toHaveCount(1);
      const status = route.startsWith("/projects") ? tr.tasks.filters.status : tr.tasks.my.filters.status;
      await page.getByRole("button", { name: status, exact: true }).click();
      await page.getByRole("menuitemcheckbox", { name: tr.tasks.common.status.BACKLOG, exact: true }).click();
      await page.keyboard.press("Escape");
      await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBeNull();
      await expect(page.locator("[data-task-card]")).toHaveCount(9);
    }
    await page.goto(`/projects/${project.slug}/tasks?group=status`);
    await expect(page.locator("[data-task-card]")).toHaveCount(9);
    await page.getByRole("button", { name: "Sayfa 2", exact: true }).click();
    await expect(page.locator("[data-task-card]")).toHaveCount(9);
    await page.getByRole("button", { name: "Sayfa 3", exact: true }).click();
    await expect(page.locator("[data-task-card]")).toHaveCount(1);
    const last = (await api(page, "GET", `/projects/${project.id}/tasks?page=2&size=9&sort=updatedAt,desc`)).json as { content: { id: string }[] };
    expect((await api(page, "DELETE", `/projects/${project.id}/tasks/${last.content[0].id}`)).status).toBe(204);
    await page.reload();
    await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("2");
    await expect(page.locator("[data-task-card]")).toHaveCount(9);
    await expect(page.getByRole("navigation", { name: tr.common.pagination.navLabel, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sayfa 2", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("tab", { name: "Tablo", exact: true }).click();
    await expect(page.locator("table tbody tr")).toHaveCount(9);
    await page.screenshot({ path: test.info().outputPath("grouped-nine-task-pagination.png"), fullPage: true });
    await page.goto(`/tasks?project=${project.id}&tab=all&page=3`);
    await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("2");
    await expect(page.locator("[data-task-card]")).toHaveCount(9);
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileNav = page.getByRole("navigation", { name: tr.common.pagination.navLabel, exact: true });
    await mobileNav.getByRole("button", { name: tr.common.pagination.previous, exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBeNull();
    await expect(page.locator("[data-task-card]")).toHaveCount(9);
    await mobileNav.getByRole("button", { name: tr.common.pagination.next, exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("[data-task-card]")).toHaveCount(9);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath("my-nine-task-mobile-pagination.png"), fullPage: true });
  } finally {
    await api(page, "DELETE", `/projects/${project.id}`);
  }
});
