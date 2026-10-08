import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createOrganization, createProject, createTeam } from "./helpers";
import { MANAGER_STORAGE, MANAGER_USER_FILE } from "./global-setup";

/**
 * HMZ-PROJ-52 flows covered here (single PROJECT_MANAGER, one project, run in order):
 *   1. Login -> Create Organization -> Create Project -> creator becomes PROJECT_MANAGER
 *   2. Edit Settings -> Add Criteria -> Complete Criterion
 *   8. Connect Public GitHub Repo (project settings) -> Latest Commits visible
 *   9. Delete Project (type its name to confirm)
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

    // A new project has no teams; the first one is created through the full-page form and lists its founder.
    await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Ekipler" }).click();
    await expect(page.getByText("Henüz ekip yok")).toBeVisible();
    await createTeam(page, slug, "Backend");
    const row = page.getByRole("row", { name: new RegExp(manager.nickname) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Proje Yöneticisi")).toBeVisible();
  });

  test("edit settings, add criterion, complete it", async () => {
    // The sidebar has no settings item; the pencil on the project's card opens them (covered in 11-project-banner).
    await page.goto(`/projects/${slug}?section=settings`);

    await page.getByRole("combobox", { name: "Durum" }).click();
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

  test("connect a public GitHub repository from the project settings and see latest commits", async () => {
    test.setTimeout(90_000);
    const nav = page.getByRole("navigation", { name: "Gezinme menüsü" });
    // Without a connected repository the sidebar has no "Depo" item; the connection is made in the settings.
    await page.goto(`/projects/${slug}?section=settings`);
    await expect(nav.getByRole("link", { name: "Depo" })).toHaveCount(0);
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "GitHub deposu", exact: true }) });
    await section.locator("#settings-repository-url").fill("https://github.com/octocat/Hello-World");
    await section.getByRole("radio", { name: /Gelişmiş/ }).check();
    // This fixture calls the real external GitHub service. Retry only its explicit temporary-unavailable response;
    // permission, validation, rate-limit and application errors must still fail, and no response is mocked.
    const submit = section.getByRole("button", { name: /^Depo bağla$/ });
    let status = 0;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const answered = page.waitForResponse((response) => response.request().method() === "POST" &&
        /\/projects\/[^/]+\/repository$/.test(new URL(response.url()).pathname), { timeout: 20_000 });
      await submit.click();
      status = (await answered).status();
      if (status !== 503) break;
      await expect(submit).toBeEnabled();
    }
    expect(status).toBe(201);
    await expect(page.getByText("Depo bağlandı.")).toBeVisible();

    // The sidebar item appears right away and the repository page opens on the overview with the branch view.
    await nav.getByRole("link", { name: "Depo" }).click();
    await expect(page.getByText("octocat/Hello-World").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /dalındaki son commit'ler/ })).toBeVisible();
    await expect(page.getByRole("listitem").first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("tab", { name: "Dallar" }).click();
    await expect(page).toHaveURL(/view=branches/);
    await expect(page.getByRole("list", { name: "Dallar" }).getByRole("button").first()).toBeVisible({ timeout: 15_000 });

    // The project overview shows the one-line repository strip.
    await nav.getByRole("link", { name: "Genel bakış" }).click();
    await expect(page.getByRole("region", { name: "Depo takibi" })).toBeVisible();
  });

  test("delete the project by typing its name", async () => {
    await page.goto(`/projects/${slug}?section=settings`);
    await page.getByRole("button", { name: /^Projeyi sil$/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Onaylamak için proje adını yazın/).fill(projectName);
    await dialog.getByRole("button", { name: /^Bu projeyi sil$/ }).click();
    await expect(page).toHaveURL(/\/tr\/projeler$/, { timeout: 15_000 });
    await expect(page.getByText("Proje silindi.")).toBeVisible();
  });
});
