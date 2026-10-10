import { expect, test, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";
import tr from "../src/i18n/messages/tr.json";

test.use({ storageState: MANAGER_STORAGE });

// The project priority is shown on the project card, the settings preview, and the project header. A saved change reaches
// every one of them without a reload (the settings save invalidates the shared ["projects"] cache), while another
// project's card keeps its own priority.

const stamp = Date.now();
const NAME_A = `Oncelik A ${stamp}`;
const NAME_B = `Oncelik B ${stamp}`;
const P = tr.projects.overview.priorityValues;

type Project = { id: string; name: string; status: string; projectType: string };

async function setPriority(page: Page, slug: string, priority: keyof typeof P) {
  const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as Project;
  const result = await api(page, "PUT", `/projects/${project.id}`, {
    name: project.name,
    priority,
    status: project.status,
    projectType: project.projectType,
  });
  expect(result.status).toBe(200);
  return project.id;
}

const cardOf = (page: Page, name: string) =>
  page.locator("#main-content article").filter({ has: page.getByRole("heading", { name, exact: true }) });

/**
 * A long suite leaves the shared manager with many projects, so the card may not be on the first list page. Finds the
 * page through the API and moves there with the list's own pagination buttons, which stays a client-side navigation.
 */
async function showListPageOf(page: Page, projectId: string) {
  let index = 0;
  for (;;) {
    const result = await api(page, "GET", `/projects?page=${index}&size=12`);
    expect(result.status).toBe(200);
    const data = result.json as { content: { id: string }[]; totalPages: number };
    if (data.content.some((item) => item.id === projectId)) break;
    index += 1;
    expect(index, "project not found in the caller's list").toBeLessThan(Math.max(data.totalPages, 1));
  }
  // The bar elides distant page numbers, so step with "Sonraki" from wherever the list currently is.
  const current = Number(new URL(page.url()).searchParams.get("page") ?? "1") - 1;
  const step = index > current ? tr.common.pagination.next : tr.common.pagination.previous;
  for (let at = current; at !== index; at += index > current ? 1 : -1) {
    await page.locator("#main-content").getByRole("button", { name: step, exact: true }).click();
    const expected = (index > current ? at + 1 : at - 1) + 1;
    // Page 1 may be written without a ?page= parameter.
    await expect.poll(() => Number(new URL(page.url()).searchParams.get("page") ?? "1")).toBe(expected);
  }
}

test("a project's priority shows on its card and header, and a saved change reaches them without a reload", async ({ page }) => {
  test.setTimeout(120_000);
  const ids: string[] = [];
  try {
    const slugA = await createProject(page, NAME_A);
    const slugB = await createProject(page, NAME_B);
    ids.push(await setPriority(page, slugA, "LOW"), await setPriority(page, slugB, "CRITICAL"));

    await page.goto(`/projects/${slugA}?section=settings`);
    // Not a reload: this marker survives only while the document stays the same.
    await page.evaluate(() => { (window as unknown as { __spa: number }).__spa = 1; });

    // Settings preview: the real card, live with the form.
    const preview = page.locator("#project-preview").getByTestId("project-card-priority");
    await expect(preview).toHaveAttribute("data-priority", "LOW");
    await expect(preview).toContainText(`${tr.projects.columns.priority}: ${P.LOW}`);

    await page.locator("#settings-priority").click();
    await page.getByRole("option", { name: P.HIGH, exact: true }).click();
    await expect(preview).toHaveAttribute("data-priority", "HIGH");
    await expect(preview).toContainText(P.HIGH);

    await page.getByRole("button", { name: tr.projects.settings.save, exact: true }).click();
    await expect(page.getByText(tr.projects.settings.saved, { exact: true }).first()).toBeVisible();

    // Project header badge follows the saved value.
    const header = page.locator("#main-content h1").locator("xpath=..");
    await expect(header.getByText(P.HIGH, { exact: true })).toBeVisible();
    await expect(header.getByText(P.LOW, { exact: true })).toHaveCount(0);

    // Client-side navigation to the Projeler list: A shows the new priority, B keeps its own.
    await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Projeler", exact: true }).click();
    await expect(page).toHaveURL(/\/projeler(\?.*)?$/);
    await showListPageOf(page, ids[0]);
    const cardA = cardOf(page, NAME_A);
    await expect(cardA).toBeVisible();
    const chipA = cardA.getByTestId("project-card-priority");
    await expect(chipA).toHaveAttribute("data-priority", "HIGH");
    await expect(chipA).toContainText(`${tr.projects.columns.priority}: ${P.HIGH}`);
    // Screen readers get the label and the value as text, not only the colour/shape marker.
    await expect(cardA.getByText(`${tr.projects.columns.priority}:`, { exact: false })).toHaveCount(1);
    await expect(cardA.getByRole("link", { name: tr.projects.card.editNamed.replace("{name}", NAME_A) })).toBeVisible();
    // B may sit on a neighbouring list page; reaching it is still client-side pagination.
    await showListPageOf(page, ids[1]);
    const cardB = cardOf(page, NAME_B);
    await expect(cardB.getByTestId("project-card-priority")).toHaveAttribute("data-priority", "CRITICAL");
    await expect(cardB.getByTestId("project-card-priority")).toContainText(P.CRITICAL);
    expect(await page.evaluate(() => (window as unknown as { __spa?: number }).__spa)).toBe(1);
  } finally {
    for (const id of ids) await api(page, "POST", `/projects/${id}/archive`);
  }
});
