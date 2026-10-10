import { expect, test, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";
import tr from "../src/i18n/messages/tr.json";

test.use({ storageState: MANAGER_STORAGE });

// A deleted project must leave no trace in the workspace: the sidebar stops selecting and linking it, its routes show
// the 404 screen, and Back from the redirect does not land on its settings.

const stamp = Date.now();
const SIDEBAR = "Gezinme menüsü";

const sidebar = (page: Page) => page.getByRole("navigation", { name: SIDEBAR });
const linksTo = (page: Page, slug: string) => page.locator(`a[href*="${slug}"]`);
const notFound = (page: Page) => page.locator('[data-error-code="404"]');

/** The remembered-selection keys hold the project slug; none may keep naming a deleted project. */
async function rememberedSlugs(page: Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(sessionStorage)
    .filter((key) => key.startsWith("pda:last-project:"))
    .map((key) => sessionStorage.getItem(key) ?? ""));
}

async function projectId(page: Page, slug: string) {
  return ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
}

test("deleting the selected project clears the sidebar, history and routes of it", async ({ page }) => {
  test.setTimeout(120_000);
  const nameA = `Silme A ${stamp}`;
  const nameB = `Silme B ${stamp}`;
  const slugA = await createProject(page, nameA);
  const slugB = await createProject(page, nameB);
  const idA = await projectId(page, slugA);
  const idB = await projectId(page, slugB);
  try {
    // A becomes the remembered selection by being opened.
    await page.goto(`/projects/${slugA}/tasks`);
    await expect(sidebar(page).getByRole("link", { name: nameA })).toBeVisible();
    expect(await rememberedSlugs(page)).toContain(slugA);

    await page.goto(`/projects/${slugA}?section=settings`);
    await page.getByRole("button", { name: tr.projects.settings.delete, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill(nameA);
    await dialog.getByRole("button", { name: tr.projects.settings.deleteConfirm, exact: true }).click();

    await expect(page).toHaveURL(/\/projeler(\?.*)?$/, { timeout: 15_000 });
    expect(await rememberedSlugs(page)).not.toContain(slugA);
    // Nothing on the page, sidebar included, links the deleted project any more.
    await expect(sidebar(page).getByRole("link", { name: nameA })).toHaveCount(0);
    await expect(linksTo(page, slugA)).toHaveCount(0);
    // Back does not return to A's settings: that history entry was replaced, so the previous one (A's tasks) is
    // reached, and a deleted project there is the 404 screen, not cached content.
    await page.goBack();
    await expect(notFound(page)).toBeVisible();
    await expect(page.locator("#settings-name")).toHaveCount(0);
    await expect(linksTo(page, slugA).filter({ visible: true })).toHaveCount(0);
    await expect(sidebar(page).getByRole("link", { name: nameA })).toHaveCount(0);

    // A direct visit of any of its routes is the 404 screen too.
    for (const path of [`/projects/${slugA}/tasks`, `/projects/${slugA}`, `/projects/${slugA}?section=settings`]) {
      await page.goto(path);
      await expect(notFound(page)).toBeVisible();
      await expect(page.locator("#settings-name")).toHaveCount(0);
    }

    // A reload on the list keeps the sidebar off A.
    await page.goto("/projects");
    await page.reload();
    await expect(sidebar(page)).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: nameA })).toHaveCount(0);
    await expect(linksTo(page, slugA)).toHaveCount(0);
    expect(await rememberedSlugs(page)).not.toContain(slugA);
  } finally {
    await api(page, "DELETE", `/projects/${idA}`);
    await api(page, "POST", `/projects/${idB}/archive`);
  }
});

test("a remembered project deleted elsewhere is dropped on the next load", async ({ page }) => {
  test.setTimeout(120_000);
  const nameA = `Silme C ${stamp}`;
  const nameB = `Silme D ${stamp}`;
  const slugA = await createProject(page, nameA);
  const slugB = await createProject(page, nameB);
  const idA = await projectId(page, slugA);
  const idB = await projectId(page, slugB);
  try {
    await page.goto(`/projects/${slugA}/tasks`);
    await expect(sidebar(page).getByRole("link", { name: nameA })).toBeVisible();
    expect(await rememberedSlugs(page)).toContain(slugA);

    // Deleted from another place (the API stands in for another browser): this tab still remembers A.
    expect((await api(page, "DELETE", `/projects/${idA}`)).status).toBe(204);
    expect(await rememberedSlugs(page)).toContain(slugA);

    await page.goto("/projects");
    await expect(sidebar(page)).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: nameA })).toHaveCount(0);
    await expect(linksTo(page, slugA)).toHaveCount(0);
    await expect.poll(() => rememberedSlugs(page)).not.toContain(slugA);

    // Another remembered project keeps working as before.
    await page.goto(`/projects/${slugB}/tasks`);
    await expect(sidebar(page).getByRole("link", { name: nameB })).toBeVisible();
    await page.goto("/projects");
    await expect(sidebar(page).getByRole("link", { name: nameB })).toBeVisible();
  } finally {
    await api(page, "DELETE", `/projects/${idA}`);
    await api(page, "POST", `/projects/${idB}/archive`);
  }
});
