import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createProject, createTeam } from "./helpers";
import { MANAGER_STORAGE, MANAGER_USER_FILE } from "./global-setup";

/**
 * Teams page: a project starts without teams, the first team keeps its creator, cards open the detail page, the list
 * has a chart view, and the founder can never be taken out of the project.
 */
test.describe.serial("Teams page (manager)", () => {
  let page: Page;
  let slug: string;
  const manager: { nickname: string } = JSON.parse(readFileSync(MANAGER_USER_FILE, "utf-8"));

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STORAGE });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("a new project has no teams and the first team form keeps its creator", async () => {
    slug = await createProject(page, `E2E Teams ${Date.now()}`);
    await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Ekipler" }).click();
    await expect(page.getByText("Henüz ekip yok")).toBeVisible();

    await page.getByRole("link", { name: /^Yeni ekip$/ }).first().click();
    await expect(page).toHaveURL(`/projects/${slug}/teams/new`);

    const includeCreator = page.getByRole("checkbox", { name: /Beni de bu ekibe ekle/ });
    await expect(includeCreator).toBeChecked();
    await expect(includeCreator).toBeDisabled();

    await page.locator("#team-name").fill("Backend");
    await expect(page.locator("#team-preview").getByText("Backend")).toBeVisible();
    await page.getByRole("button", { name: /^Ekibi oluştur$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${slug}/teams/(?!new$)[^/]+$`), { timeout: 15_000 });
    await expect(page.getByRole("row", { name: new RegExp(manager.nickname) })).toBeVisible();
  });

  test("a whole team card opens the detail page and the list switches to the chart", async () => {
    await createTeam(page, slug, "Frontend");
    await page.getByRole("navigation", { name: "Konum" }).getByRole("link", { name: "Ekipler" }).click();
    await expect(page).toHaveURL(`/projects/${slug}?section=teams`);

    await page.getByRole("tab", { name: "Şema" }).click();
    await expect(page).toHaveURL(/view=chart/);
    await expect(page.getByRole("link", { name: /Backend ekibini aç/ })).toBeVisible();
    await page.getByRole("tab", { name: "Liste" }).click();

    await page.getByRole("link", { name: /Backend ekibini aç/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/projects/${slug}/teams/(?!new$)[^/]+$`));
    await expect(page.getByRole("heading", { name: "Backend" })).toBeVisible();
  });

  test("member filters narrow the table and can be cleared", async () => {
    await page.getByRole("searchbox", { name: "Üyelerde ara" }).fill("zzzz-no-such-member");
    await expect(page.getByText("Eşleşen üye yok")).toBeVisible();
    await page.getByRole("button", { name: "Filtreleri temizle" }).first().click();
    await expect(page.getByRole("row", { name: new RegExp(manager.nickname) })).toBeVisible();
  });

  test("edit mode lets the founder leave a team but never the project", async () => {
    await page.getByRole("button", { name: /^Ekibi düzenle$/ }).click();
    const row = page.getByRole("row", { name: new RegExp(manager.nickname) });
    await expect(row.getByRole("button", { name: /kişisinin rollerini düzenle/ })).toBeVisible();
    // The founder is also in Frontend, so leaving Backend is fine; leaving the project is locked.
    await expect(row.getByRole("button", { name: /kişisini ekipten çıkar/ })).toBeVisible();
    await expect(row.getByRole("button", { name: /kişisini projeden çıkar/ })).toHaveCount(0);
    await page.getByRole("button", { name: /^Bitti$/ }).first().click();
    await expect(page.getByRole("button", { name: /^Ekibi düzenle$/ })).toBeVisible();
  });
});
