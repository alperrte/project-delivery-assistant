import { test, expect, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

/** A signed-in person who is not in a project gets the 403 screen for every page of it, and learns nothing about it. */
test.describe.serial("Route access for a signed-in non-member", () => {
  let manager: Page;
  let outsider: Page;
  let slug: string;
  let projectId: string;
  const projectName = `E2E Erisim ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    manager = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    outsider = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
    slug = await createProject(manager, projectName);
    projectId = ((await api(manager, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    await outsider.goto("/dashboard");
  });

  test.afterAll(async () => {
    await manager.close();
    await outsider.close();
  });

  test("the project and its inner pages show the 403 screen", async () => {
    for (const path of [`/tr/projeler/${slug}`, `/tr/projeler/${slug}/ekipler`, `/tr/projeler/${slug}/duzenle`, `/tr/projeler/${slug}/gorevler/pano`, `/tr/projeler/${slug}/ekipler/yeni-ekip`]) {
      await outsider.goto(path);
      await expect(outsider.locator('[data-error-code="403"]'), path).toBeVisible();
      await expect(outsider.getByText(projectName), path).toHaveCount(0);
    }
  });

  test("the server refuses the same project to the outsider", async () => {
    expect((await api(outsider, "GET", `/projects/${projectId}`)).status).toBe(403);
    expect((await api(outsider, "GET", `/projects/by-slug/${slug}`)).status).toBe(403);
    expect((await api(outsider, "GET", `/projects/${projectId}/tasks`)).status).toBe(403);
    expect((await api(outsider, "PATCH", `/projects/${projectId}/task-management-mode`, { mode: "BOTH" })).status).toBe(403);
    expect((await api(outsider, "DELETE", `/projects/${projectId}`)).status).toBe(403);
  });

  test("the outsider's own project list does not offer the project", async () => {
    await outsider.goto("/tr/projeler");
    await expect(outsider.locator("main")).toBeVisible();
    await expect(outsider.getByText(projectName)).toHaveCount(0);
  });

  test("the manager still opens it", async () => {
    await manager.goto(`/tr/projeler/${slug}`);
    await expect(manager.getByRole("navigation", { name: "Konum", exact: true }).getByText(projectName)).toBeVisible();
  });
});
