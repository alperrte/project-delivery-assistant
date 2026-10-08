import { test, expect } from "@playwright/test";
import { api, declineTeamPrompt, registerAndLogin } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";

test("organization picker includes the 101st owned organization in create and settings", async ({ page }) => {
  await registerAndLogin(page, "orgpicker");
  const ids: string[] = [];
  let projectId: string | undefined;
  const prefix = `E2E picker ${Date.now()}`;
  const lastName = `${prefix} 100`;
  try {
    for (let index = 0; index <= 100; index++) {
      const result = await api(page, "POST", "/organizations", { name: `${prefix} ${String(index).padStart(3, "0")}` });
      expect(result.status).toBe(201);
      ids.push((result.json as { id: string }).id);
    }
    await page.goto("/tr/projeler/yeni");
    await page.locator("#project-name").fill(`${prefix} project`);
    await page.getByRole("radio", { name: /^Web/ }).click();
    await page.locator("#main-content").getByRole("combobox").click();
    await page.getByRole("option", { name: lastName, exact: true }).click();
    await page.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
    await declineTeamPrompt(page);
    await expect(page).toHaveURL(/\/tr\/projeler\/(?!yeni$)[^/]+$/);
    const slug = new URL(page.url()).pathname.split("/").at(-1)!;
    const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string; organizationId: string };
    projectId = project.id;
    expect(project.organizationId).toBe(ids[100]);
    await page.goto(`/tr/projeler/${slug}?section=settings`);
    await expect(page.locator("#settings-organization")).toContainText(lastName);
    await page.locator("#settings-organization").click();
    await expect(page.getByRole("option", { name: lastName, exact: true })).toBeVisible();
  } finally {
    if (projectId) await api(page, "POST", `/projects/${projectId}/archive`);
    for (const id of ids) await api(page, "POST", `/organizations/${id}/archive`);
  }
});

test("organization rename refreshes a previously opened Project Home through client navigation", async ({ browser }) => {
  const context = await browser.newContext({ storageState: MANAGER_STORAGE });
  const page = await context.newPage();
  let organizationId: string | undefined;
  let projectId: string | undefined;
  try {
    await page.goto("/tr/organizasyonlar");
    const name = `E2E org cache ${Date.now()}`;
    const org = (await api(page, "POST", "/organizations", { name })).json as { id: string };
    organizationId = org.id;
    const project = (await api(page, "POST", "/projects", { name: `${name} project`, projectType: "WEB", organizationId: org.id })).json as { id: string; slug: string };
    projectId = project.id;
    await page.goto(`/tr/projeler/${project.slug}`);
    await expect(page.locator("#main-content").getByRole("link", { name, exact: true })).toBeVisible();
    await page.locator("#main-content").getByRole("link", { name, exact: true }).click();
    await page.getByRole("link", { name: "Düzenle", exact: true }).click();
    await page.locator("#org-name").fill(`${name} renamed`);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole("heading", { level: 1, name: `${name} renamed`, exact: true })).toBeVisible();
    const home = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/projects/${project.id}/home` && response.status() === 200);
    await page.locator(`.app-shell a[href="/tr/projeler/${project.slug}"]`).first().click();
    expect((await (await home).json()).organization.name).toBe(`${name} renamed`);
    await expect(page.locator("#main-content").getByRole("link", { name: `${name} renamed`, exact: true })).toBeVisible();
  } finally {
    if (projectId) await api(page, "POST", `/projects/${projectId}/archive`);
    if (organizationId) await api(page, "POST", `/organizations/${organizationId}/archive`);
    await context.close();
  }
});
