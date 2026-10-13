import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { MANAGER_STORAGE, MANAGER_USER_FILE, MEMBER_STORAGE, MEMBER_USER_FILE } from "./global-setup";
import { localizeHref } from "../src/i18n/routing";
import { switchProjectHref } from "../src/features/projects/switch-project-href";
import type { Project } from "../src/features/projects/types";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

test.use({ storageState: MANAGER_STORAGE, trace: "off", actionTimeout: 15_000 });
const target = { slug: "next", taskManagementMode: "SIMPLE" } as Project;
test("switch destinations retain only valid shared pages and drop all old resource IDs", () => {
  const basic = { manager: false, repository: false };
  expect(switchProjectHref("/dashboard", null, target, basic)).toBeNull();
  expect(switchProjectHref("/calendar", null, target, basic)).toBeNull();
  expect(switchProjectHref("/projects/new", null, target, basic)).toBeNull();
  expect(switchProjectHref("/projects/old", "criteria", target, basic)).toBe("/projects/next?section=criteria");
  expect(switchProjectHref("/projects/old/tasks/board", null, target, basic)).toBe("/projects/next/tasks/board");
  expect(switchProjectHref("/projects/old/tasks/old-id/edit", null, target, basic)).toBe("/projects/next");
  expect(switchProjectHref("/projects/old/teams/old-id/members", null, target, basic)).toBe("/projects/next");
  expect(switchProjectHref("/projects/old", "invitations", target, basic)).toBe("/projects/next");
  expect(switchProjectHref("/projects/old", "repository", target, basic)).toBe("/projects/next");
  expect(switchProjectHref("/projects/old/sprints", null, target, basic)).toBe("/projects/next");
  expect(switchProjectHref("/projects/old/tasks/pool", null, { ...target, taskManagementMode: null }, basic)).toBe("/projects/next");
  expect(switchProjectHref("/projects/old/labels", null, { ...target, taskManagementMode: "ADVANCED" }, { ...basic, manager: true })).toBe("/projects/next/labels");
});

async function signIn(page: Page, file = MANAGER_USER_FILE) {
  const account = JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string };
  await page.context().request.get("http://localhost:8080/api/v1/auth/csrf");
  const csrf = (await page.context().cookies()).find(cookie => cookie.name === "XSRF-TOKEN")!;
  const result = await page.context().request.post("http://localhost:8080/api/v1/auth/login", {
    headers: { "X-XSRF-TOKEN": decodeURIComponent(csrf.value), Origin: "http://localhost:3000" }, data: account,
  });
  expect(result.status()).toBe(200); await page.goto("/dashboard");
}
async function project(page: Page, name: string) {
  const result = await api(page, "POST", "/projects", { name }); expect(result.status).toBe(201);
  return result.json as Project;
}
async function open(page: Page) {
  await expect(page.locator(".app-shell")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) < 1024 && !await page.locator('[data-testid="project-switcher-trigger"]:visible').count()) {
    const reveal = page.getByRole("button", { name: /Gezinme çubuğunu göster|Show navigation bar|Navigationsleiste anzeigen/ });
    if (await reveal.isVisible()) await reveal.click();
    await page.locator('header button[aria-controls="workspace-mobile-navigation"]').click();
  }
  await expect(page.locator('[data-testid="project-switcher-trigger"]:visible')).toBeVisible();
  await page.locator('[data-testid="project-switcher-trigger"]:visible').click();
  await expect(page.getByTestId("project-switcher-popup")).toBeVisible();
  await expect(page.getByTestId("project-switcher-search")).toBeFocused();
}
async function choose(page: Page, next: Project) {
  await open(page); await page.getByTestId("project-switcher-search").fill(next.name);
  await page.locator(`[data-project-choice="${next.id}"]`).click();
  await expect(page.getByTestId("project-switcher-popup")).toBeHidden();
}
async function remembered(page: Page, actor: string) {
  return page.evaluate(id => sessionStorage.getItem(`pda:last-project:${id}`), actor);
}

test("real switching preserves global URL, persists selection, redirects project pages and leaves no old filters", async ({ page }) => {
  test.setTimeout(150_000); await signIn(page);
  const a = await project(page, `Switch A ${Date.now()}`), b = await project(page, `Switch B ${Date.now()}`);
  const actor = ((await api(page, "GET", "/auth/me")).json as { id: string }).id;
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(`/projects/${a.slug}`); await expect(page.getByRole("heading", { name: a.name, exact: true })).toBeVisible();
    await expect.poll(() => remembered(page, actor)).toBe(a.slug);
    await page.goto("/dashboard"); const before = page.url(); await choose(page, b); expect(page.url()).toBe(before);
    await expect.poll(() => remembered(page, actor)).toBe(b.slug);
    await page.reload(); await open(page); await page.getByTestId("project-switcher-search").fill(b.name);
    await expect(page.locator(`[data-project-choice="${b.id}"]`)).toHaveAttribute("aria-current", "true");
    let reads = 0; const onRequest = (request: import("@playwright/test").Request) => { if (request.url().includes(`/projects/by-slug/${b.slug}`)) reads++; };
    page.on("request", onRequest); await page.locator(`[data-project-choice="${b.id}"]`).click(); await expect(page.getByTestId("project-switcher-popup")).toBeHidden();
    expect(page.url()).toBe(before); expect(reads).toBe(0); page.off("request", onRequest);
    expect((await api(page, "PATCH", `/projects/${a.id}/task-management-mode`, { mode: "BOTH" })).status).toBe(200);
    expect((await api(page, "PATCH", `/projects/${b.id}/task-management-mode`, { mode: "BOTH" })).status).toBe(200);
    await page.goto(`/projects/${b.slug}/tasks/board?assigneeId=old-project-person`); await choose(page, a);
    await expect(page).toHaveURL(new RegExp(`${a.slug}/gorevler/pano$`));
    const team = (await api(page, "POST", `/projects/${a.id}/teams`, { name: "Switch old team" })).json as { id: string };
    await page.goto(`/projects/${a.slug}/teams/${team.id}`); await choose(page, b);
    await expect(page).toHaveURL(new RegExp(`${b.slug}/genel-bakis$`));
    await open(page); await page.getByTestId("project-switcher-search").press("Escape");
    await expect(page.getByTestId("project-switcher-popup")).toBeHidden(); await expect(page.locator('[data-testid="project-switcher-trigger"]:visible')).toBeFocused();
    await open(page); await page.getByRole("heading", { name: b.name, exact: true }).click(); await expect(page.getByTestId("project-switcher-popup")).toBeHidden();
    expect(errors).toEqual([]);
  } finally { for (const item of [a, b]) await api(page, "POST", `/projects/${item.id}/archive`).catch(() => undefined); }
});

test("real project search spans later API pages and failed/cancelled switches retain the active project", async ({ page }) => {
  test.setTimeout(150_000); await signIn(page);
  const a = await project(page, `İSTANBUL API ${Date.now()}`), b = await project(page, `Switch Fault ${Date.now()}`);
  const actor = ((await api(page, "GET", "/auth/me")).json as { id: string }).id;
  const prefix = `switch-page-${Date.now()}`;
  try {
    // TEST-ONLY 102 old projects for this QA actor; all list/search/selection reads use the actual API/PostgreSQL.
    psql(`WITH inserted AS (INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at,project_types)
      SELECT gen_random_uuid(),'${prefix}-' || i,'${prefix}-' || i,'PLANNING','MEDIUM','PRIVATE','${uuid(actor)}',timestamptz '2000-01-01',timestamptz '2000-01-01',ARRAY['OTHER'] FROM generate_series(1,102) i RETURNING id),
      members AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) SELECT gen_random_uuid(),id,'${uuid(actor)}',now() FROM inserted RETURNING id)
      INSERT INTO project_membership_roles(membership_id,role) SELECT id,'PROJECT_MANAGER' FROM members`);
    await page.goto(`/projects/${a.slug}`); await expect.poll(() => remembered(page, actor)).toBe(a.slug); await page.goto("/dashboard");
    const pages = new Set<string>(); page.on("request", request => { const url = new URL(request.url()); if (url.pathname === "/api/v1/projects" && url.searchParams.get("size") === "100") pages.add(url.searchParams.get("page")!); });
    await open(page); await page.getByTestId("project-switcher-search").fill(`${prefix}-102`);
    await expect(page.getByTestId("project-switcher-option")).toHaveCount(1); expect(pages.has("1")).toBe(true);
    await page.getByTestId("project-switcher-search").fill("ıstanbul api"); await expect(page.getByTestId("project-switcher-option")).toHaveCount(1);
    await page.getByTestId("project-switcher-search").fill("not-a-project-here"); await expect(page.getByText(tr.projects.switcher.noResults, { exact: true })).toBeVisible();
    await page.getByTestId("project-switcher-search").press("Escape"); await open(page); await expect(page.getByTestId("project-switcher-search")).toHaveValue("");
    // TEST-ONLY faults/delays on actual scoped detail reads.
    await page.route(`**/projects/by-slug/${b.slug}`, route => route.fulfill({ status: 403, contentType: "application/problem+json", body: JSON.stringify({ status: 403, code: "PROJECT_FORBIDDEN" }) }));
    await page.getByTestId("project-switcher-search").fill(b.name); await page.locator(`[data-project-choice="${b.id}"]`).click();
    await expect(page.getByRole("alert").filter({ hasText: tr.projects.switcher.switchFailed })).toBeVisible();
    expect(await remembered(page, actor)).toBe(a.slug); await page.unroute(`**/projects/by-slug/${b.slug}`);
    await page.getByTestId("project-switcher-search").press("Escape");
    await page.route("**/api/v1/projects?*size=100", route => route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ status: 503 }) }));
    await open(page); await expect(page.getByText(tr.projects.switcher.loadFailed, { exact: true })).toBeVisible();
    await page.unroute("**/api/v1/projects?*size=100"); await page.getByRole("button", { name: tr.projects.switcher.retry }).click();
    await page.getByTestId("project-switcher-search").fill(b.name); await expect(page.locator(`[data-project-choice="${b.id}"]`)).toBeVisible();
    await page.route(`**/projects/by-slug/${b.slug}`, async route => { const response = await route.fetch(); await new Promise(resolve => setTimeout(resolve, 700)); await route.fulfill({ response }).catch(error => { if (!/already handled|closed/i.test(String(error))) throw error; }); });
    const request = page.waitForRequest(request => request.url().includes(`/projects/by-slug/${b.slug}`));
    await page.locator(`[data-project-choice="${b.id}"]`).click(); await request;
    await expect(page.getByTestId("project-switcher-option").first()).toBeDisabled();
    await page.getByTestId("project-switcher-search").press("Escape"); await page.unrouteAll({ behavior: "wait" });
    expect(await remembered(page, actor)).toBe(a.slug);
  } finally {
    psql(`UPDATE projects SET archived_at=now(),status='ARCHIVED' WHERE created_by='${uuid(actor)}' AND slug LIKE '${prefix}-%'`);
    for (const item of [a, b]) await api(page, "POST", `/projects/${item.id}/archive`).catch(() => undefined);
  }
});

test("real membership removal excludes projects and clears the remembered active project", async ({ page, browser }) => {
  test.setTimeout(150_000); await signIn(page);
  const shared = await project(page, `Switch Access ${Date.now()}`), privateProject = await project(page, `Switch Private ${Date.now()}`);
  const context = await browser.newContext({ storageState: MEMBER_STORAGE }), member = await context.newPage();
  try {
    await signIn(member, MEMBER_USER_FILE); const actor = ((await api(member, "GET", "/auth/me")).json as { id: string }).id;
    const team = (await api(page, "POST", `/projects/${shared.id}/teams`, { name: "Switch member team" })).json as { id: string };
    const invite = (await api(page, "POST", `/projects/${shared.id}/invitations`, { userId: actor, roles: ["TESTER"], teamId: team.id })).json as { invitationId: string; token: string };
    expect((await api(member, "POST", `/projects/${shared.id}/invitations/${invite.invitationId}/accept`, { token: invite.token })).status).toBe(200);
    await choose(member, shared); expect(await remembered(member, actor)).toBe(shared.slug);
    await open(member); await member.getByTestId("project-switcher-search").fill(privateProject.name); await expect(member.getByTestId("project-switcher-option")).toHaveCount(0);
    expect((await api(member, "GET", `/projects/by-slug/${privateProject.slug}`)).status).toBe(403);
    await member.getByTestId("project-switcher-search").press("Escape");
    expect((await api(page, "DELETE", `/projects/${shared.id}/members/${actor}`)).status).toBe(204);
    await member.reload(); await expect.poll(() => remembered(member, actor)).not.toBe(shared.slug);
    await open(member); await member.getByTestId("project-switcher-search").fill(shared.name); await expect(member.getByText(tr.projects.switcher.noResults, { exact: true })).toBeVisible();
  } finally { await context.close(); for (const item of [shared, privateProject]) await api(page, "POST", `/projects/${item.id}/archive`).catch(() => undefined); }
});

test("keyboard, collapsed rail and mobile drawer fit TR/EN/DE and both themes", async ({ page }) => {
  test.setTimeout(180_000); await signIn(page);
  const a = await project(page, `Switch Responsive A ${Date.now()}`), b = await project(page, `Switch Responsive B ${Date.now()}`);
  try {
    await page.goto(`/projects/${a.slug}`); await expect(page.locator(".app-shell nav").getByRole("link", { name: a.name, exact: true })).toBeVisible(); await page.goto("/dashboard");
    for (const [locale, catalog] of [["tr", tr], ["en", en], ["de", de]] as const) {
      await page.goto(localizeHref("/dashboard", locale));
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 }); await open(page);
        await expect(page.getByRole("heading", { name: catalog.projects.switcher.title })).toBeVisible();
        await page.getByTestId("project-switcher-search").fill(b.name); await expect(page.getByTestId("project-switcher-option")).toHaveCount(1);
        for (const theme of ["light", "dark"]) {
          // TEST-ONLY theme style probe against existing application tokens.
          await page.evaluate(value => document.documentElement.classList.toggle("dark", value === "dark"), theme);
          await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined))); });
          const box = (await page.getByTestId("project-switcher-popup").boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width); expect(box.y + box.height).toBeLessThanOrEqual(901);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          if ((locale === "tr" && width === 390) || (locale === "de" && width === 1440)) { mkdirSync("../.local/project-switcher/screens", { recursive: true }); await page.screenshot({ path: `../.local/project-switcher/screens/${locale}-${width}-${theme}.png` }); }
        }
        await page.getByTestId("project-switcher-search").press("ArrowDown"); await expect(page.getByTestId("project-switcher-option")).toBeFocused();
        await page.getByTestId("project-switcher-option").press("Enter"); await expect(page.getByTestId("project-switcher-popup")).toBeHidden();
        await expect(page.locator("#workspace-mobile-navigation")).toBeHidden();
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { localStorage.setItem("pda:sidebar-collapsed", "1"); window.dispatchEvent(new Event("pda:sidebar-collapsed-changed")); });
    await expect(page.locator('[data-testid="project-switcher-trigger"]:visible [data-logo-frame]')).toBeVisible();
    await open(page); await page.getByTestId("project-switcher-search").press("Escape");
    await expect(page.locator('[data-testid="project-switcher-trigger"]:visible')).toBeFocused();
  } finally {
    await page.evaluate(() => { localStorage.removeItem("pda:sidebar-collapsed"); window.dispatchEvent(new Event("pda:sidebar-collapsed-changed")); });
    for (const item of [a, b]) await api(page, "POST", `/projects/${item.id}/archive`).catch(() => undefined);
  }
});
