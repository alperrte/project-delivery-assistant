import { test, expect, type Page } from "@playwright/test";
import { createProject, createTeam, openProjectTeamsPage } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";

/** The trail under the header: forms and records below a section name their path; top-level pages and the project sidebar pages show none. */
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

  test("the project sidebar pages have no trail", async () => {
    for (const path of [
      `/projects/${slug}`, `/projects/${slug}?section=criteria`, `/projects/${slug}?section=teams`, `/projects/${slug}?section=repository`,
      `/projects/${slug}/tasks`, `/projects/${slug}/tasks/board`, `/projects/${slug}/tasks/pool`, `/projects/${slug}/sprints`, `/projects/${slug}/labels`, `/projects/${slug}/edit`,
    ]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await expect(trail(page), path).toHaveCount(0);
    }
  });

  test("the create pages below a project name the path", async () => {
    await page.goto(`/projects/${slug}/teams/new`);
    await expect(trail(page).getByRole("link", { name: "Projeler" })).toHaveAttribute("href", "/tr/projeler");

    await page.goto(`/projects/${slug}/teams/new`);
    await expect(trail(page).getByRole("listitem")).toHaveText(["Projeler", projectName, "Ekipler", "Yeni ekip"]);

    await page.goto(`/projects/${slug}/criteria/new`);
    await expect(trail(page).getByRole("listitem")).toHaveText(["Projeler", projectName, "Kriterler", "Yeni kriter"]);
    await expect(trail(page).getByRole("link", { name: "Kriterler" })).toHaveAttribute("href", `/tr/projeler/${slug}/kriterler`);

    await page.goto(`/projects/${slug}/sprints/new`);
    await expect(trail(page).getByRole("listitem")).toHaveText(["Projeler", projectName, "Sprintler", "Yeni sprint"]);

    await page.goto(`/projects/${slug}/tasks/new`);
    await expect(trail(page).locator("[aria-current=page]")).toHaveText("Yeni görev");
    await expect(trail(page).getByRole("listitem")).toHaveText(["Projeler", projectName, "Görevler", "Yeni görev"]);
  });

  test("team detail, edit and member invite pages intentionally have no trail", async () => {
    const teamId = await createTeam(page, slug, "Arka Uç");
    await expect(trail(page)).toHaveCount(0);
    await openProjectTeamsPage(page);
    await expect(page).toHaveURL(`/tr/projeler/${slug}/ekipler`);
    for (const path of [`/teams/${teamId}/edit`, `/team-invitations/new?team=${teamId}`]) {
      await page.goto(`/projects/${slug}${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(trail(page)).toHaveCount(0);
    }
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
