import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createOrganization, createProject } from "./helpers";
import { MANAGER_STORAGE, MANAGER_USER_FILE } from "./global-setup";

/**
 * HMZ-PROJ-52 flows covered here (single PROJECT_MANAGER, one project, run in order):
 *   1. Login -> Create Organization -> Create Project -> creator becomes PROJECT_MANAGER
 *   2. Edit Settings -> Add Criteria -> Complete Criterion
 *   8. Connect Public GitHub Repo -> Latest Commits visible
 *   9. Archive Project
 *
 * Uses the shared manager session from global-setup (no fresh registration here)
 * to keep total /auth/register calls per suite run low.
 */
test.describe.serial("Project lifecycle (manager)", () => {
  let page: Page;
  let slug: string;
  const orgName = `E2E Org ${Date.now()}`;
  const projectName = `E2E Project ${Date.now()}`;
  const manager: { nickname: string } = JSON.parse(readFileSync(MANAGER_USER_FILE, "utf-8"));

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STORAGE });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("create organization and project as the already-authenticated manager; creator becomes PROJECT_MANAGER", async () => {
    await createOrganization(page, orgName);
    slug = await createProject(page, projectName, { organizationName: orgName });
    expect(page.url()).toContain(slug);

    await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Ekipler" }).click();
    await page.getByRole("link", { name: /General Team üyeleri/ }).click();
    const row = page.getByRole("row", { name: new RegExp(manager.nickname) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Proje Yöneticisi")).toBeVisible();
  });

  test("edit settings, add criterion, complete it", async () => {
    await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Ayarlar" }).click();

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Aktif" }).click();
    await page.getByRole("button", { name: /^Değişiklikleri kaydet$/ }).click();
    await expect(page.getByText("Ayarlar kaydedildi.")).toBeVisible();

    await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Kriterler" }).click();
    await page.getByRole("button", { name: /^Yeni kriter$/ }).click();
    await page.locator("#criterion-title").fill("E2E kriteri");
    await page.getByRole("dialog").getByRole("button", { name: /^Oluştur$/ }).click();
    await expect(page.getByText("Kriter oluşturuldu.")).toBeVisible();

    await page.getByRole("checkbox", { name: /E2E kriteri/ }).click();
    await expect(page.getByText("1/1 tamamlandı")).toBeVisible();
  });

  test("connect a public GitHub repository and see latest commits", async () => {
    await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Depo" }).click();
    await page.getByRole("button", { name: /^Depo bağla$/ }).click();
    await page.locator("#repository-url").fill("https://github.com/octocat/Hello-World");
    await page.getByRole("button", { name: /^Depo bağla$/ }).click();
    await expect(page.getByText("Depo bağlandı.")).toBeVisible();

    await expect(page.getByText("octocat/Hello-World")).toBeVisible();
    await expect(page.getByText("Son commit'ler")).toBeVisible();
    await expect(page.getByRole("listitem").first()).toBeVisible({ timeout: 15_000 });
  });

  test("archive the project", async () => {
    await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Ayarlar" }).click();
    await page.getByRole("button", { name: /^Arşivle$/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Arşivle$/ }).click();
    await expect(page).toHaveURL(/\/projects$/, { timeout: 15_000 });
    await expect(page.getByText("Proje arşivlendi.")).toBeVisible();
  });
});
