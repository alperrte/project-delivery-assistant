import { expect, test, type Locator, type Page } from "@playwright/test";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import { api } from "./helpers";
import type { Criterion } from "../src/features/criteria/types";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

test.use({ storageState: MANAGER_STORAGE, actionTimeout: 15_000 });
type Project = { id: string; slug: string };
type Fixture = { project: Project; criteria: Criterion[] };
const rows = (page: Page) => page.getByTestId("criterion-row");
const row = (page: Page, id: string) => page.locator(`[data-testid="criterion-row"][data-criterion-id="${id}"]`);
const rowIds = (page: Page) => rows(page).evaluateAll(items => items.map(item => item.getAttribute("data-criterion-id")));
const snapshot = (page: Page) => page.locator('section[aria-labelledby="criteria-snapshot-heading"]');
const trend = (page: Page) => page.getByTestId("criteria-trend");
const point = (page: Page) => page.getByTestId("criteria-trend-point");
const details = (page: Page) => page.getByTestId("criteria-trend-details");

async function createFixture(page: Page, count = 4): Promise<Fixture> {
  await page.goto("/projects");
  const created = await api(page, "POST", "/projects", { name: `PSF QA ${Date.now()}` });
  expect(created.status).toBe(201);
  const project = created.json as Project;
  expect((await api(page, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "BOTH" })).status).toBe(200);
  const criteria: Criterion[] = [];
  for (let i = 0; i < count; i++) {
    const added = await api(page, "POST", `/projects/${project.id}/criteria`, { title: `PSF criterion ${i + 1}`, description: "QA criterion" });
    expect(added.status).toBe(201);
    criteria.push(added.json as Criterion);
  }
  return { project, criteria };
}
const removeProject = async (page: Page, project: Project) => { expect((await api(page, "DELETE", `/projects/${project.id}`)).status).toBe(204); };
async function complete(page: Page, project: Project, criterion: Criterion, done = true) {
  expect((await api(page, "POST", `/projects/${project.id}/criteria/${criterion.id}/${done ? "complete" : "uncomplete"}`)).status).toBe(200);
}
async function changeStatus(page: Page, item: Criterion, done: boolean) {
  await row(page, item.id).getByRole("button", { name: /Değiştirmek için aç/ }).click();
  await page.getByRole("menuitemradio", { name: done ? tr.criteria.status.completed : tr.criteria.status.pending, exact: true }).click();
}
const move = (item: Locator, direction: "up" | "down") => item.getByRole("button", { name: direction === "up" ? tr.criteria.moveUp : tr.criteria.moveDown, exact: true });

test("PSF-02 real API grouping, complete/undo, group boundaries, full reorder payload and persistence agree with overview", async ({ page }) => {
  const { project, criteria: c } = await createFixture(page);
  const reorders: string[][] = [];
  page.on("request", request => { if (request.url().endsWith("/criteria/reorder") && request.method() === "POST") reorders.push(request.postDataJSON().orderedCriterionIds); });
  try {
    await complete(page, project, c[1]); await complete(page, project, c[3]);
    await page.goto(`/projects/${project.slug}/criteria`);
    await expect.poll(() => rowIds(page)).toEqual([c[1].id, c[3].id, c[0].id, c[2].id]);
    await expect(move(row(page, c[1].id), "up")).toBeDisabled();
    await expect(move(row(page, c[3].id), "down")).toBeDisabled();
    await expect(move(row(page, c[0].id), "up")).toBeDisabled();
    await expect(move(row(page, c[2].id), "down")).toBeDisabled();

    const saved = page.waitForResponse(response => response.url().endsWith("/criteria/reorder") && response.request().method() === "POST");
    await move(row(page, c[3].id), "up").click();
    expect((await saved).status()).toBe(200);
    await expect.poll(() => rowIds(page)).toEqual([c[3].id, c[1].id, c[0].id, c[2].id]);
    expect(reorders).toEqual([[c[0].id, c[3].id, c[2].id, c[1].id]]);
    expect(new Set(reorders[0]).size).toBe(c.length);
    const persisted = (await api(page, "GET", `/projects/${project.id}/criteria`)).json as Criterion[];
    expect([...persisted].sort((a, b) => a.sortOrder - b.sortOrder).map(item => item.id)).toEqual(reorders[0]);

    await changeStatus(page, c[0], true);
    await expect.poll(() => rowIds(page)).toEqual([c[0].id, c[3].id, c[1].id, c[2].id]);
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
    await changeStatus(page, c[0], false);
    await expect.poll(() => rowIds(page)).toEqual([c[3].id, c[1].id, c[0].id, c[2].id]);
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    expect(reorders).toHaveLength(1); // Status changes are display regrouping, not persisted reorders.

    await page.reload();
    await expect.poll(() => rowIds(page)).toEqual([c[3].id, c[1].id, c[0].id, c[2].id]);
    await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Genel Bakış", exact: true }).click();
    await expect(snapshot(page).locator("li > span:first-of-type")).toHaveText([c[3].title, c[1].title, c[0].title, c[2].title]);
    await expect(snapshot(page)).toContainText("50%");
    await point(page).last().click();
    await expect(details(page)).toContainText("50%");
  } finally { await removeProject(page, project); }
});

test("PSF-02 search/status filters disable movement; failed reorder preserves confirmed order and shows an error", async ({ page }) => {
  const { project, criteria: c } = await createFixture(page);
  try {
    await complete(page, project, c[1]); await complete(page, project, c[3]);
    await page.goto(`/projects/${project.slug}/criteria`);
    await expect(rows(page)).toHaveCount(4);
    const search = page.getByRole("textbox", { name: tr.criteria.search });
    await search.fill("criterion 2");
    await expect(rows(page)).toHaveCount(1);
    await expect(move(rows(page).first(), "up")).toBeDisabled();
    await expect(move(rows(page).first(), "down")).toBeDisabled();
    await search.fill("");
    const filters = page.getByRole("group", { name: tr.criteria.filters.label });
    await filters.getByRole("button", { name: new RegExp(`^${tr.criteria.filters.completed}`) }).click();
    await expect(rows(page)).toHaveCount(2);
    for (const item of await rows(page).all()) { await expect(move(item, "up")).toBeDisabled(); await expect(move(item, "down")).toBeDisabled(); }
    await filters.getByRole("button", { name: new RegExp(`^${tr.criteria.filters.all}`) }).click();
    const order = [c[1].id, c[3].id, c[0].id, c[2].id];
    await expect.poll(() => rowIds(page)).toEqual(order);
    // TEST-ONLY failure injection; successful reorders use the actual API in the preceding test.
    await page.route(`**/projects/${project.id}/criteria/reorder`, route => route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ status: 503, title: "QA unavailable" }) }));
    await move(row(page, c[3].id), "up").click();
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible();
    expect(await rowIds(page)).toEqual(order);
    expect(((await api(page, "GET", `/projects/${project.id}/criteria`)).json as Criterion[]).map(item => item.id)).toEqual(c.map(item => item.id));
  } finally { await page.unrouteAll({ behavior: "wait" }); await removeProject(page, project); }
});

test("PSF-01 empty, zero-complete and all-complete real API states are distinct", async ({ page }) => {
  test.setTimeout(120_000);
  const { project } = await createFixture(page, 0);
  try {
    await page.goto(`/projects/${project.slug}`);
    await expect(trend(page)).toBeVisible();
    await expect(point(page)).toHaveCount(0);
    await expect(trend(page)).toContainText(tr.projects.overview.noTrend);
    const added = await api(page, "POST", `/projects/${project.id}/criteria`, { title: "Zero to complete", description: "QA" });
    expect(added.status).toBe(201);
    const item = added.json as Criterion;
    await expect(point(page)).toHaveCount(7, { timeout: 40_000 });
    await point(page).last().click();
    await expect(details(page).getByText("0%", { exact: true })).toBeVisible();
    await expect(snapshot(page).getByText("0%", { exact: true })).toBeVisible();
    await complete(page, project, item);
    await expect(details(page)).toContainText("100%", { timeout: 40_000 });
    await expect(snapshot(page)).toContainText("100%", { timeout: 40_000 });
    await expect(details(page)).toContainText(item.title);
    await complete(page, project, item, false);
    await expect(details(page).getByText("0%", { exact: true })).toBeVisible({ timeout: 40_000 });
    await expect(details(page)).not.toContainText(item.title);
  } finally { await removeProject(page, project); }
});

test("PSF-02 two users receive GF-02 regrouping while filter/search/scroll survive; overview chart and project isolation stay correct", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const { project, criteria: c } = await createFixture(page, 12);
  const other = await createFixture(page, 1);
  const memberContext = await browser.newContext({ storageState: MEMBER_STORAGE });
  const member = await memberContext.newPage();
  try {
    await member.goto("/projects");
    const me = (await api(member, "GET", "/auth/me")).json as { id: string };
    const team = await api(page, "POST", `/projects/${project.id}/teams`, { name: "PSF QA members", includeCreator: true });
    expect(team.status).toBe(201);
    const invitation = await api(page, "POST", `/projects/${project.id}/invitations`, { userId: me.id, roles: ["TESTER"], teamId: (team.json as { id: string }).id });
    expect(invitation.status).toBe(201);
    const { invitationId, token } = invitation.json as { invitationId: string; token: string };
    expect((await api(member, "POST", `/projects/${project.id}/invitations/${invitationId}/accept`, { token })).status).toBe(200);
    await member.goto(`/projects/${project.slug}/criteria`);
    await expect(rows(member)).toHaveCount(c.length);
    await member.getByRole("textbox", { name: tr.criteria.search }).fill("PSF criterion");
    await member.getByRole("group", { name: tr.criteria.filters.label }).getByRole("button", { name: new RegExp(`^${tr.criteria.filters.remaining}`) }).click();
    await member.evaluate(() => { document.body.dataset.psfMarker = "same-document"; window.scrollTo(0, 250); });
    const before = await member.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);
    await complete(page, project, c[0]);
    await expect(row(member, c[0].id)).toHaveCount(0, { timeout: 40_000 });
    await expect(member.getByRole("textbox", { name: tr.criteria.search })).toHaveValue("PSF criterion");
    await expect(member.getByRole("group", { name: tr.criteria.filters.label }).getByRole("button", { name: new RegExp(`^${tr.criteria.filters.remaining}`) })).toHaveAttribute("aria-pressed", "true");
    expect(await member.evaluate(() => document.body.dataset.psfMarker)).toBe("same-document");
    expect(Math.abs((await member.evaluate(() => window.scrollY)) - before)).toBeLessThanOrEqual(2);
    await member.getByRole("group", { name: tr.criteria.filters.label }).getByRole("button", { name: new RegExp(`^${tr.criteria.filters.all}`) }).click();
    await expect.poll(() => rowIds(member)).toEqual(c.map(item => item.id));
    await complete(page, project, c[4]);
    await expect.poll(() => rowIds(member), { timeout: 40_000 }).toEqual([c[0].id, c[4].id, ...c.filter((_, i) => i !== 0 && i !== 4).map(item => item.id)]);

    await member.goto(`/projects/${project.slug}`);
    await point(member).last().click();
    await expect(details(member)).toContainText("17%");
    await complete(page, project, c[4], false);
    await expect(details(member)).toContainText("8%", { timeout: 40_000 });
    await expect(snapshot(member)).toContainText("8%", { timeout: 40_000 });
    // The manager switches to another project: current API/cache rows belong only to that URL's project.
    await page.goto(`/projects/${other.project.slug}/criteria`);
    await expect.poll(() => rowIds(page)).toEqual([other.criteria[0].id]);
    expect((await api(member, "GET", `/projects/${other.project.id}/criteria`)).status).toBe(403);
    await page.goto(`/projects/${project.slug}/criteria`);
    await expect(rows(page)).toHaveCount(c.length);
    await expect(row(page, other.criteria[0].id)).toHaveCount(0);
  } finally { await memberContext.close(); await removeProject(page, other.project); await removeProject(page, project); }
});

for (const [locale, messages] of [["tr", tr], ["en", en], ["de", de]] as const) {
  test(`PSF-01 ${locale} chart proportional geometry, labels, pointer/keyboard/focus at 320/375/768/1024/1440 light and dark`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const { project, criteria: c } = await createFixture(page);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    try {
      await complete(page, project, c[1]); await complete(page, project, c[3]);
      for (const theme of ["light", "dark"] as const) {
        for (const width of [320, 375, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.goto(`/${locale}/projects/${project.slug}`);
          await expect(trend(page).getByRole("heading", { name: messages.projects.overview.completionTrend })).toBeVisible();
          await page.evaluate(value => { document.documentElement.classList.toggle("dark", value === "dark"); document.documentElement.classList.toggle("light", value === "light"); }, theme);
          await expect(point(page)).toHaveCount(7);
          await trend(page).scrollIntoViewIfNeeded();
          const geometry = await trend(page).evaluate(section => {
            const svg = section.querySelector('[data-testid="criteria-trend-chart"] > svg')!;
            const circles = [...section.querySelectorAll('[data-testid="criteria-trend-point"] > span')].map(node => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height }; });
            const labels = [...svg.querySelectorAll("text")].map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height, fontSize: parseFloat(getComputedStyle(node).fontSize), text: node.textContent }; });
            const buttons = [...section.querySelectorAll<HTMLButtonElement>('[data-testid="criteria-trend-point"]')].map(node => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height, label: node.getAttribute("aria-label") }; });
            return { circles, labels, buttons, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
          });
          expect(geometry.overflow, `${locale} ${theme} ${width}`).toBe(false);
          expect(geometry.circles).toHaveLength(7);
          for (const circle of geometry.circles) { expect(circle.width).toBeGreaterThan(0); expect(Math.abs(circle.width - circle.height)).toBeLessThan(0.5); }
          for (const button of geometry.buttons) { expect(button.width).toBeGreaterThanOrEqual(24); expect(button.height).toBeGreaterThanOrEqual(24); expect(button.label).toMatch(/\d{4}/); }
          expect(geometry.labels.some(label => label.text === "100%")).toBe(true);
          for (const label of geometry.labels) { expect(label.fontSize).toBeGreaterThanOrEqual(10); expect(label.width).toBeGreaterThan(0); }
          // SVG text labels must not overlap each other in screen coordinates.
          for (let i = 0; i < geometry.labels.length; i++) for (let j = i + 1; j < geometry.labels.length; j++) {
            const a = geometry.labels[i], b = geometry.labels[j];
            expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, `${a.text} / ${b.text} at ${width}`).toBe(true);
          }
          await point(page).last().click();
          const current = await point(page).last().getAttribute("data-month");
          await expect(details(page)).toHaveAttribute("data-month", current!);
          await expect(details(page)).toContainText("50%");
          await expect(details(page)).toContainText(c[1].title);
          await point(page).first().focus();
          await page.keyboard.press("Enter");
          await expect(details(page)).toHaveAttribute("data-month", (await point(page).first().getAttribute("data-month"))!);
          await expect(point(page).first()).toBeFocused();
          const focused = await point(page).first().evaluate(node => ({ visible: node.matches(":focus-visible"), shadow: getComputedStyle(node).boxShadow, outline: getComputedStyle(node).outlineStyle }));
          expect(focused.visible).toBe(true);
          expect(focused.shadow !== "none" || focused.outline !== "none").toBe(true);
          await page.keyboard.press("Tab");
          await expect(point(page).nth(1)).toBeFocused();
          await page.keyboard.press("Space");
          await expect(details(page)).toHaveAttribute("data-month", (await point(page).nth(1).getAttribute("data-month"))!);
          await point(page).last().click();
          await trend(page).screenshot({ path: testInfo.outputPath(`psf-chart-${locale}-${theme}-${width}.png`) });
        }
      }
      await details(page).getByRole("button").click();
      await expect(rows(page)).toHaveCount(4);
      expect(errors).toEqual([]);
    } finally { await removeProject(page, project); }
  });
}

test("PSF-01 TEST-ONLY malformed API timestamps preserve the current total and do not crash activity/trend", async ({ page }) => {
  const { project, criteria: c } = await createFixture(page);
  try {
    for (const item of c) await complete(page, project, item);
    const actual = (await api(page, "GET", `/projects/${project.id}/criteria`)).json as Criterion[];
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    // Only impossible backend timestamp states are mocked; project/session/authorization/home remain real API.
    await page.route(`**/projects/${project.id}/criteria`, route => route.fulfill({ json: actual.map((item, index) => ({ ...item,
      createdAt: index === 3 ? "invalid" : item.createdAt,
      completedAt: [null, "2026-02-30T00:00:00Z", "2099-01-01T00:00:00Z", "invalid"][index],
    })) }));
    await page.goto(`/projects/${project.slug}`);
    await expect(point(page)).toHaveCount(7);
    await point(page).last().click();
    await expect(details(page)).toContainText("100%");
    await expect(snapshot(page)).toContainText("100%");
    for (const item of c) await expect(details(page)).not.toContainText(item.title);
    expect(errors).toEqual([]);
  } finally { await page.unrouteAll({ behavior: "wait" }); await removeProject(page, project); }
});

test("PSF-01 background access loss hides cached criterion insights and snapshot", async ({ page }) => {
  const { project, criteria: c } = await createFixture(page, 1);
  try {
    await complete(page, project, c[0]);
    await page.goto(`/projects/${project.slug}`);
    await expect(details(page)).toContainText(c[0].title);
    // TEST-ONLY resource denial after a successful authorized load.
    await page.route(`**/projects/${project.id}/criteria`, route => route.fulfill({
      status: 403, contentType: "application/json", body: JSON.stringify({ code: "FORBIDDEN" }),
      headers: { "Access-Control-Allow-Origin": new URL(page.url()).origin, "Access-Control-Allow-Credentials": "true" },
    }));
    await expect(point(page)).toHaveCount(0, { timeout: 40_000 });
    await expect(details(page)).toHaveCount(0);
    await expect(snapshot(page).getByRole("alert")).toBeVisible();
    await expect(snapshot(page)).not.toContainText(c[0].title);
    await expect(page.locator('section[aria-labelledby="overview-activity-heading"]').getByRole("alert")).toBeVisible();
  } finally { await page.unrouteAll({ behavior: "wait" }); await removeProject(page, project); }
});
