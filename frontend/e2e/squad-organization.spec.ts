import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

test.use({ storageState: MANAGER_STORAGE });
type Project = { id: string; slug: string };
type Team = { id: string };
const chart = (page: Page) => page.getByTestId("organization-chart");
const cards = (page: Page) => chart(page).locator("[data-org-person]");
const section = (page: Page, name: string) => chart(page).locator(`[data-org-section="${name}"]`);
const branch = (page: Page, id: string) => chart(page).locator(`[data-org-team="${id}"]`).first();
async function project(page: Page) {
  await page.goto("/projects");
  const response = await api(page, "POST", "/projects", { name: `SSF QA ${Date.now()}` });
  expect(response.status).toBe(201); return response.json as Project;
}
async function team(page: Page, project: Project, name: string, parentTeamId?: string, includeCreator = true) {
  const response = await api(page, "POST", `/projects/${project.id}/teams`, { name, parentTeamId, includeCreator });
  expect(response.status).toBe(201); return response.json as Team;
}
const open = async (page: Page, project: Project, locale = "tr") => {
  await page.goto(`/${locale}/projects/${project.slug}/teams?view=chart`);
  await expect(chart(page).getByTestId("organization-count")).toBeVisible();
};
const remove = async (page: Page, project: Project) => expect((await api(page, "DELETE", `/projects/${project.id}`)).status).toBe(204);

/** TEST-ONLY fixture creation, scoped to this new QA project; assertions read the actual HTTP API. */
function seed(project: Project, actorId: string, root: Team, count: number) {
  const p = uuid(project.id), actor = uuid(actorId), rootId = uuid(root.id);
  if (psql(`SELECT count(*) FROM projects WHERE id='${p}'`) !== "1") throw Error("QA project is not in this database");
  return JSON.parse(psql(`WITH fixture AS (SELECT gen_random_uuid() uid, gen_random_uuid() mid, n FROM generate_series(1,${count}) n),
    new_users AS (INSERT INTO users(id,email,nickname,password_hash,account_status,email_verification_status,global_role,email_verified_at,created_at,updated_at)
      SELECT f.uid,'ssf-'||f.uid||'@example.test','SSF-'||left(f.uid::text,24),u.password_hash,'ACTIVE','VERIFIED','USER',now(),now(),now() FROM fixture f CROSS JOIN users u WHERE u.id='${actor}' RETURNING id,nickname),
    new_members AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at,status)
      SELECT f.mid,'${p}',f.uid,now(),'ACTIVE' FROM fixture f JOIN new_users u ON u.id=f.uid RETURNING id,user_id),
    new_roles AS (INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM new_members),
    new_roster AS (INSERT INTO squad_members(id,squad_id,project_membership_id,added_by,added_at)
      SELECT gen_random_uuid(),'${rootId}',m.id,'${actor}',now() FROM new_members m JOIN fixture f ON f.mid=m.id WHERE f.n<${count})
    SELECT json_agg(json_build_object('id',u.id,'nickname',u.nickname,'membershipId',m.id)) FROM new_users u JOIN new_members m ON m.user_id=u.id`)) as { id: string; nickname: string; membershipId: string }[];
}

test("SSF no-team project shows its only member in manager/unassigned groups and gains a real team without F5", async ({ page }) => {
  test.setTimeout(70_000);
  const p = await project(page);
  try {
    await open(page, p);
    await expect(chart(page).getByTestId("organization-count")).toHaveText(tr.squads.chart.totals.replace("{members}", "1").replace("{teams}", "0"));
    await expect(section(page, "managers").locator("[data-org-person]")).toHaveCount(1);
    await expect(section(page, "unassigned").locator("[data-org-person]")).toHaveCount(1);
    await section(page, "managers").getByRole("button").first().click();
    const root = await team(page, p, "First real team");
    await expect(branch(page, root.id)).toBeVisible({ timeout: 40_000 });
    await expect(section(page, "unassigned").locator("[data-org-person]")).toHaveCount(0);
    await expect(section(page, "managers").getByRole("button").first()).toHaveAttribute("aria-expanded", "false");
  } finally { await remove(page, p); }
});

test("SSF all project/roster pages, unique counts, multiple teams/roles and real outsider denial", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const p = await project(page);
  const context = await browser.newContext({ storageState: MEMBER_STORAGE });
  const outsider = await context.newPage();
  try {
    const actor = (await api(page, "GET", "/auth/me")).json as { id: string };
    const root = await team(page, p, "Large roster");
    const child = await team(page, p, "Child roster", root.id);
    await team(page, p, "Third level", child.id, false);
    const seeded = seed(p, actor.id, root, 205);
    expect((await api(page, "POST", `/projects/${p.id}/members/${actor.id}/roles`, { role: "BACKEND_DEVELOPER" })).status).toBe(200);
    const page0 = (await api(page, "GET", `/projects/${p.id}/members?page=0&size=100`)).json as { content: { userId: string }[]; totalPages: number };
    const all = [...page0.content];
    for (let i = 1; i < page0.totalPages; i++) all.push(...((await api(page, "GET", `/projects/${p.id}/members?page=${i}&size=100`)).json as typeof page0).content);
    expect(new Set(all.map(item => item.userId)).size).toBe(206);
    await open(page, p);
    await expect(chart(page).getByTestId("organization-count")).toContainText("206");
    expect(await cards(page).evaluateAll(nodes => new Set(nodes.map(node => node.getAttribute("data-org-person"))).size)).toBe(206);
    // The late pages are actual members, not the five-person team card preview.
    for (const person of seeded) expect(await cards(page).filter({ hasText: person.nickname }).count()).toBeGreaterThan(0);
    await expect(section(page, "unassigned").locator("[data-org-person]")).toHaveCount(1);
    await expect(section(page, "managers")).toContainText(tr.roles.BACKEND_DEVELOPER);
    await expect(chart(page).locator(`[data-org-person="${actor.id}"]`)).toHaveCount(3);
    await expect(branch(page, root.id).locator(`[data-org-team="${child.id}"]`)).toHaveCount(1);
    await outsider.goto("/projects");
    for (const suffix of ["members", "teams", `teams/${root.id}/members`]) expect((await api(outsider, "GET", `/projects/${p.id}/${suffix}`)).status).toBe(403);
    expect(await chart(page).locator("a[href^='mailto:']").count()).toBe(0);
  } finally { await context.close(); await remove(page, p); }
});

test("SSF two-user GF-02 changes roles, team relations and removals while disclosures/scroll survive", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const p = await project(page);
  const context = await browser.newContext({ storageState: MEMBER_STORAGE });
  const viewer = await context.newPage();
  try {
    const root = await team(page, p, "Live root"), child = await team(page, p, "Live child", root.id);
    await open(page, p);
    await viewer.goto("/projects");
    const actor = (await api(page, "GET", "/auth/me")).json as { id: string };
    const member = (await api(viewer, "GET", "/auth/me")).json as { id: string };
    const invite = await api(page, "POST", `/projects/${p.id}/invitations`, { userId: member.id, teamId: root.id, roles: ["TESTER"] });
    expect(invite.status).toBe(201);
    expect((await api(viewer, "POST", `/project-invitations/${(invite.json as { invitationId: string }).invitationId}/accept`)).status).toBe(200);
    await expect(chart(page).getByTestId("organization-count")).toContainText("2 benzersiz", { timeout: 40_000 });
    await viewer.setViewportSize({ width: 1280, height: 640 });
    await open(viewer, p);
    await section(viewer, "managers").getByRole("button").first().click();
    await viewer.evaluate(() => { document.body.dataset.ssfDocument = "original"; window.scrollTo(0, 100); });
    const before = await viewer.evaluate(() => scrollY);
    expect(before).toBeGreaterThan(0);
    expect((await api(page, "POST", `/projects/${p.id}/members/${member.id}/roles`, { role: "BACKEND_DEVELOPER" })).status).toBe(200);
    expect((await api(page, "POST", `/projects/${p.id}/teams/${child.id}/members`, { userId: member.id })).status).toBe(201);
    expect((await api(page, "PUT", `/projects/${p.id}/teams/${child.id}`, { name: "Renamed child", description: null })).status).toBe(200);
    await expect(branch(viewer, child.id).locator(`[data-org-person="${member.id}"]`)).toBeVisible({ timeout: 40_000 });
    await expect(branch(viewer, child.id)).toContainText(tr.roles.BACKEND_DEVELOPER);
    await expect(branch(viewer, child.id).getByRole("button").first()).toContainText("Renamed child");
    await expect(section(viewer, "managers").getByRole("button").first()).toHaveAttribute("aria-expanded", "false");
    expect(await viewer.evaluate(() => document.body.dataset.ssfDocument)).toBe("original");
    expect(Math.abs((await viewer.evaluate(() => scrollY)) - before)).toBeLessThanOrEqual(2);
    expect((await api(page, "PUT", `/projects/${p.id}/teams/${child.id}/parent`, { parentTeamId: null })).status).toBe(200);
    expect((await api(page, "DELETE", `/projects/${p.id}/teams/${root.id}/members/${member.id}`)).status).toBe(204);
    await expect(branch(viewer, root.id).locator(`[data-org-person="${member.id}"]`)).toHaveCount(0, { timeout: 40_000 });
    await expect(branch(viewer, root.id).locator(`[data-org-team="${child.id}"]`)).toHaveCount(0);
    expect((await api(page, "DELETE", `/projects/${p.id}/members/${member.id}`)).status).toBe(204);
    await expect(chart(page).locator(`[data-org-person="${member.id}"]`)).toHaveCount(0, { timeout: 40_000 });
    expect((await api(page, "DELETE", `/projects/${p.id}/teams/${child.id}`)).status).toBe(204);
    await expect(branch(page, child.id)).toHaveCount(0, { timeout: 40_000 });
    await expect(chart(page).locator(`[data-org-person="${actor.id}"]`)).toHaveCount(2);
    // The removed viewer loses access; no former roster remains readable.
    await expect(viewer.getByTestId("organization-chart")).toHaveCount(0, { timeout: 40_000 });
  } finally { await context.close(); await remove(page, p); }
});

for (const [locale, messages] of [["tr", tr], ["en", en], ["de", de]] as const) {
  test(`SSF ${locale} three-level chart: five widths, light/dark, keyboard, labels, console and overflow`, async ({ page }, info) => {
    test.setTimeout(150_000);
    const p = await project(page);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    try {
      const root = await team(page, p, "Platform engineering with a deliberately long team name");
      const child = await team(page, p, "Quality and infrastructure", root.id);
      await team(page, p, "Third level", child.id);
      for (const theme of ["light", "dark"]) for (const width of [320, 375, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await open(page, p, locale);
        await page.evaluate(dark => { document.documentElement.classList.toggle("dark", dark); document.documentElement.classList.toggle("light", !dark); }, theme === "dark");
        const button = section(page, "managers").getByRole("button").first();
        await expect(button).toContainText(messages.squads.chart.managers);
        await button.focus(); await page.keyboard.press("Space");
        await expect(button).toHaveAttribute("aria-expanded", "false");
        await page.keyboard.press("Enter"); await expect(button).toHaveAttribute("aria-expanded", "true");
        expect(await button.evaluate(node => node.matches(":focus-visible") && getComputedStyle(node).outlineStyle !== "none")).toBe(true);
        const geometry = await button.boundingBox(); expect(geometry!.height).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await chart(page).evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
        if (locale === "tr" && width === 320) {
          const audit = await new AxeBuilder({ page }).include('[data-testid="organization-chart"]').withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
          expect(audit.violations).toEqual([]);
        }
        await chart(page).screenshot({ path: info.outputPath(`ssf-${locale}-${theme}-${width}.png`) });
      }
      expect(errors).toEqual([]);
    } finally { await remove(page, p); }
  });
}
