import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import path from "node:path";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";
import landing from "../src/i18n/landing/tr.json";
import { demoData, demoPage } from "../src/features/landing/demo/demo-data";
import { PROJECT_TYPES, type Project, type ProjectType } from "../src/features/projects/types";
import { buildPath } from "../src/i18n/routing";
import type { Locale } from "../src/i18n/config";

test.use({ serviceWorkers: "block" });
const catalogs = { tr, en, de };

// TEST-ONLY real UI presentation. Backend persistence/validation/security uses PostgreSQL integration tests.
async function fixture(page: Page, context: BrowserContext, origin: string, locale: Locale) {
  const seed = demoData(landing);
  let project: Project = { ...seed.project, projectType: "MOBILE", techStack: "Flutter, React", canEdit: true };
  delete project.projectTypes; // A legacy response must still preselect its saved scalar.
  let failSave = false;
  await context.addCookies([{ name: "PDA_SESSION", value: "1", url: origin }, { name: "NEXT_LOCALE", value: locale, url: origin }]);
  await page.routeWebSocket(/\/api\/v1\/ws$/, socket => socket.onMessage(message => {
    if (String(message).startsWith("CONNECT")) socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0");
  }));
  await page.route("**/api/v1/**", async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const headers = { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" };
    if (method === "OPTIONS" || url.pathname.endsWith("/team-deletions/claim")) return route.fulfill({ status: 204, headers });
    let status = 200;
    if ((url.pathname === "/api/v1/projects" && method === "POST") || (url.pathname === `/api/v1/projects/${project.id}` && method === "PUT")) {
      if (failSave) { failSave = false; return route.fulfill({ status: 500, headers, json: {} }); }
      const body = request.postDataJSON();
      project = { ...project, ...body, projectTypes: PROJECT_TYPES.filter(type => body.projectTypes.includes(type)) };
      project.projectType = project.projectTypes![0];
      if (method === "POST") status = 201;
    }
    if (url.pathname.endsWith("/task-management-mode") && method === "PATCH") project = { ...project, taskManagementMode: request.postDataJSON().mode };
    const body = url.pathname.endsWith("/auth/me") ? { id: project.createdBy, nickname: "Types QA", email: "types@example.test", globalRole: "USER", mustChangePassword: false }
      : url.pathname.endsWith("/users/me/preferences") ? { locale, motion: "on", themeTransition: false, navbarMode: "always-visible" }
      : url.pathname.endsWith("/auth/csrf") ? { headerName: "X-XSRF-TOKEN" }
      : url.pathname.endsWith("/chat/conversations") ? { group: null, groups: [], directs: [], totalUnread: 0 }
      : url.pathname.endsWith("/chat/members") ? []
      : url.pathname === "/api/v1/projects" ? method === "POST" ? project : demoPage([project])
      : url.pathname.includes("/projects/by-slug/") || url.pathname === `/api/v1/projects/${project.id}` || url.pathname.endsWith("/task-management-mode") ? project
      : url.pathname.endsWith(`/members/${project.createdBy}`) ? { ...seed.members[0], userId: project.createdBy, roles: ["PROJECT_MANAGER"] }
      : url.pathname.endsWith("/home") ? seed.home
      : url.pathname.endsWith("/repository") ? { connected: false }
      : /count$/.test(url.pathname) ? { count: 0 }
      : { content: [], totalElements: 0, totalPages: 0, counts: {} };
    return route.fulfill({ status, headers, json: body });
  });
  return { project: () => project, failNextSave: () => { failSave = true; } };
}

for (const locale of ["tr", "en", "de"] as const) {
  test(`multiple project types create, edit, preview and reload: ${locale}`, async ({ page, context, baseURL }) => {
    const state = await fixture(page, context, new URL(baseURL!).origin, locale);
    const words = catalogs[locale].projects;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(buildPath("/projects/new", {}, locale));
    await page.locator("#project-name").fill("Web and mobile product");
    const group = page.getByRole("group", { name: words.newPage.sections.type.title, exact: true });
    const checkbox = (type: ProjectType) => group.getByRole("checkbox", { name: new RegExp(`^${words.newPage.types[type].name}`) });
    await page.getByRole("button", { name: words.newPage.actions.submit, exact: true }).click();
    await expect(checkbox("WEB")).toBeFocused();
    const errorId = await checkbox("WEB").getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    await expect(page.locator(`[id="${errorId}"]`)).toBeVisible();
    await checkbox("WEB").focus();
    await page.keyboard.press("Space");
    await checkbox("MOBILE").check();
    await expect(checkbox("WEB")).toBeChecked();
    await expect(checkbox("MOBILE")).toBeChecked();
    await expect(page.getByRole("button", { name: "Flutter", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next.js", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "PostgreSQL", exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Flutter", exact: true }).click();
    await checkbox("MOBILE").uncheck();
    await expect(page.getByRole("button", { name: "Flutter", exact: true })).toHaveAttribute("aria-pressed", "true");
    await checkbox("MOBILE").check();
    await checkbox("OTHER").check();
    for (const type of ["WEB", "MOBILE", "OTHER"] as const) await expect(page.locator("#project-preview").getByText(words.card.types[type], { exact: true })).toBeVisible();
    await page.getByRole("button", { name: words.newPage.actions.submit, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: words.newPage.teamPrompt.no, exact: true }).click();
    expect(state.project().projectTypes).toEqual(["WEB", "MOBILE", "OTHER"]);
    await page.goto(buildPath("/projects/[slug]", { slug: state.project().slug }, locale) + "?section=settings");
    const edit = page.locator("#settings-types");
    const editCheck = (type: ProjectType) => edit.getByRole("checkbox", { name: new RegExp(`^${words.newPage.types[type].name}`) });
    await expect(editCheck("WEB")).toBeChecked();
    await expect(editCheck("MOBILE")).toBeChecked();
    await editCheck("AI").check();
    await page.getByRole("button", { name: words.settings.discard, exact: true }).click();
    await expect(editCheck("AI")).not.toBeChecked();
    await editCheck("MOBILE").uncheck();
    await editCheck("AI").check();
    await page.getByRole("button", { name: words.settings.save, exact: true }).click();
    await expect(page.getByRole("button", { name: words.settings.save, exact: true })).toHaveCount(0);
    expect(state.project().projectTypes).toEqual(["WEB", "AI", "OTHER"]);
    await page.reload();
    await expect(editCheck("AI")).toBeChecked();
    await expect(editCheck("MOBILE")).not.toBeChecked();
    for (const width of [320, 390, 768, 1440]) for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(value => {
        document.documentElement.classList.toggle("dark", value === "dark");
        document.documentElement.style.colorScheme = value;
      }, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      for (const type of PROJECT_TYPES) {
        const box = await editCheck(type).locator("..").boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      if (width === 390) {
        await edit.evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 100));
        await edit.screenshot({ path: path.resolve(`../tmp/project-types/${locale}-${theme}.png`) });
      }
    }
    await page.goto(buildPath("/projects", {}, locale));
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: state.project().name, exact: true }) });
    for (const type of ["WEB", "AI", "OTHER"] as const) await expect(card.getByText(words.card.types[type], { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("legacy projects preselect the old type; empty selection and failed saves preserve stored types", async ({ page, context, baseURL }) => {
  const state = await fixture(page, context, new URL(baseURL!).origin, "tr");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(buildPath("/projects/[slug]", { slug: state.project().slug }, "tr") + "?section=settings");
  const group = page.locator("#settings-types");
  const mobile = group.getByRole("checkbox", { name: /^Mobil/ });
  await expect(mobile).toBeChecked();
  await mobile.uncheck();
  const save = page.getByRole("button", { name: tr.projects.settings.save, exact: true });
  await save.click();
  await expect(page.locator("#settings-types-error")).toBeVisible();
  expect(state.project().projectTypes).toBeUndefined();
  await mobile.check();
  await group.getByRole("checkbox", { name: /^Web/ }).check();
  state.failNextSave();
  await save.click();
  await expect(save).toBeEnabled();
  expect(state.project().projectTypes).toBeUndefined();
  await save.click();
  await expect(save).toHaveCount(0);
  expect(state.project().projectTypes).toEqual(["WEB", "MOBILE"]);
});
