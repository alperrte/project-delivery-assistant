import { test, expect, type Page } from "@playwright/test";
import { createProject, createTeam } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";

/** The trail under the header: every page below a section names its path; top-level pages show none. */
test.describe.serial("Breadcrumb (signed in)", () => {
  let page: Page;
  let slug: string;
  const projectName = `E2E Konum ${Date.now()}`;

  const trail = (target: Page) => target.getByRole("navigation", { name: "Konum", exact: true });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STORAGE });
    page = await context.newPage();
    slug = await createProject(page, projectName);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("top-level pages have no trail", async () => {
    for (const path of ["/dashboard", "/projects", "/organizations", "/calendar", "/tasks", "/settings"]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expect(trail(page), path).toHaveCount(0);
    }
  });

  test("a project, its section and its create pages name the path", async () => {
    await page.goto(`/projects/${slug}`);
    await expect(trail(page).getByRole("listitem")).toHaveText(["Projeler", projectName]);
    await expect(trail(page).locator("[aria-current=page]")).toHaveText(projectName);
    await expect(trail(page).getByRole("link", { name: "Projeler" })).toHaveAttribute("href", "/tr/projeler");

    await page.goto(`/projects/${slug}?section=teams`);
    await expect(trail(page).locator("[aria-current=page]")).toHaveText("Ekipler");
    await expect(trail(page).getByRole("listitem")).toHaveText(["Projeler", projectName, "Ekipler"]);

    await page.goto(`/projects/${slug}/teams/new`);
    await expect(trail(page).getByRole("listitem")).toHaveText(["Projeler", projectName, "Ekipler", "Yeni ekip"]);

    await page.goto(`/projects/${slug}/tasks/new`);
    await expect(trail(page).locator("[aria-current=page]")).toHaveText("Yeni görev");
    await expect(trail(page).getByRole("listitem")).toHaveText(["Projeler", projectName, "Görevler", "Yeni görev"]);

    await page.goto(`/projects/${slug}/tasks/board`);
    await expect(trail(page).locator("[aria-current=page]")).toHaveText("Pano");
    await expect(trail(page).getByRole("listitem")).toHaveText(["Projeler", projectName, "Görevler", "Pano"]);

    await page.goto(`/projects/${slug}/labels`);
    await expect(trail(page).locator("[aria-current=page]")).toHaveText("Etiketler");
  });

  test("a team page names the team and the edit page keeps it", async () => {
    const teamId = await createTeam(page, slug, "Arka Uç");
    await expect(trail(page).locator("[aria-current=page]")).toHaveText("Arka Uç");
    await expect(trail(page).getByRole("listitem")).toHaveText(["Projeler", projectName, "Ekipler", "Arka Uç"]);
    await trail(page).getByRole("link", { name: "Ekipler" }).click();
    await expect(page).toHaveURL(`/tr/projeler/${slug}/ekipler`);

    await page.goto(`/projects/${slug}/teams/${teamId}/edit`);
    await expect(trail(page).locator("[aria-current=page]")).toHaveText("Ekibi düzenle");
    await expect(trail(page).getByRole("link", { name: "Arka Uç" })).toHaveAttribute("href", `/tr/projeler/${slug}/ekipler/${teamId}`);
  });

  test("organization and calendar create pages name the path", async () => {
    await page.goto("/organizations/new");
    await expect(trail(page).getByRole("listitem")).toHaveText(["Organizasyonlar", "Yeni organizasyon"]);
    await page.goto("/calendar/new");
    await expect(trail(page).getByRole("listitem")).toHaveText(["Takvim", "Yeni anımsatıcı"]);
  });

  test("the trail wraps on a phone without scrolling the page sideways", async () => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`/projects/${slug}/teams/new`);
    await expect(trail(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
