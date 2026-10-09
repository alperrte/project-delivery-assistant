import { expect, test, type Locator, type Page } from "@playwright/test";
import { api, createOrganization, createProject, openProjectListPage } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";
import { matchPath } from "../src/i18n/routing";

test.use({ storageState: MANAGER_STORAGE });

const stamp = Date.now();
// One unbroken 120-character word: the worst case for a card that must neither grow nor push the grid wider.
const ORG_NAME = `OrgLong${stamp}`.padEnd(120, "O");
const PROJECT_NAME = `ProjLong${stamp}`.padEnd(120, "P");

const VIEWPORTS = [320, 390, 768, 1024, 1440] as const;
const THEMED = new Set<number>([390, 1440]);

type Metrics = { width: number; height: number; headerHeight: number; padding: string; radius: string; titleTruncated: boolean };

async function card(page: Page, name: string): Promise<Locator> {
  const article = page.locator("#main-content article").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(article).toBeVisible();
  return article;
}

/** The organizations list keeps its page in component state, so step through it until the card is on screen. */
async function openOrganizationListPage(page: Page, organizationId: string) {
  let pageIndex = 0;
  for (;;) {
    const result = await api(page, "GET", `/organizations?page=${pageIndex}&size=20`);
    expect(result.status).toBe(200);
    const data = result.json as { content: { id: string }[]; totalPages: number };
    if (data.content.some((item) => item.id === organizationId)) break;
    pageIndex += 1;
    expect(pageIndex, "organization not found in the caller's list").toBeLessThan(Math.max(data.totalPages, 1));
  }
  await page.goto("/tr/organizasyonlar");
  for (let step = 0; step < pageIndex; step++) {
    await page.locator("#main-content").getByRole("button", { name: "Sonraki", exact: true }).click();
  }
}

async function measure(article: Locator): Promise<Metrics> {
  const box = (await article.boundingBox())!;
  const extra = await article.evaluate((el) => {
    const style = getComputedStyle(el);
    const title = el.querySelector("h2")!;
    const titleStyle = getComputedStyle(title);
    const header = title.parentElement!;
    return {
      padding: style.padding,
      radius: style.borderRadius,
      headerHeight: header.getBoundingClientRect().height,
      titleTruncated: title.scrollWidth > title.clientWidth && titleStyle.textOverflow === "ellipsis",
    };
  });
  return { width: box.width, height: box.height, ...extra };
}

test("organization card has the project card's dimensions at every width, in light and dark", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/tr/organizasyonlar");
  let orgId: string | undefined;
  let projectId: string | undefined;
  try {
    await createOrganization(page, ORG_NAME);
    orgId = matchPath(new URL(page.url()).pathname)!.params.organizationId;
    const slug = await createProject(page, PROJECT_NAME);
    projectId = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;

    const report: string[] = [];
    for (const width of VIEWPORTS) {
      for (const dark of THEMED.has(width) ? [false, true] : [false]) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: dark ? "dark" : "light" });

        // A long suite leaves the shared manager with many projects/organizations, so open the list page holding each card.
        await openProjectListPage(page, slug);
        const project = await measure(await card(page, PROJECT_NAME));
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `projects page overflows at ${width}`).toBeLessThanOrEqual(width);

        await openOrganizationListPage(page, orgId!);
        const org = await measure(await card(page, ORG_NAME));
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `organizations page overflows at ${width}`).toBeLessThanOrEqual(width);

        report.push(`${width}${dark ? " dark" : ""}: project ${project.width.toFixed(1)}x${project.height.toFixed(1)} | org ${org.width.toFixed(1)}x${org.height.toFixed(1)}`);
        expect(Math.abs(org.width - project.width), `card width at ${width}`).toBeLessThanOrEqual(1);
        expect(Math.abs(org.height - project.height), `card height at ${width}`).toBeLessThanOrEqual(1);
        expect(Math.abs(org.headerHeight - project.headerHeight), `header height at ${width}`).toBeLessThanOrEqual(1);
        expect(org.padding).toBe(project.padding);
        expect(org.radius).toBe(project.radius);
        expect(org.titleTruncated, `org title truncates at ${width}`).toBe(true);
        expect(project.titleTruncated, `project title truncates at ${width}`).toBe(true);
      }
    }
    console.log(report.join("\n"));
  } finally {
    if (projectId) await api(page, "POST", `/projects/${projectId}/archive`);
    if (orgId) await api(page, "POST", `/organizations/${orgId}/archive`);
  }
});
