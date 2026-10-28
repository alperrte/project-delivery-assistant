import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { meetingAccount, openParticipantMenu, showPanel } from "./meeting-fixture";
import { REJECTED_STATE } from "./consent-state";
import { localizeHref } from "../src/i18n/routing";
import type { Project } from "../src/features/projects/types";
import type { Meeting } from "../src/features/meetings/types";
import tr from "../src/i18n/meetings/tr.json";
import en from "../src/i18n/meetings/en.json";
import de from "../src/i18n/meetings/de.json";
import messages from "../src/i18n/messages/tr.json";

// Global meetings against the real local stack (backend, PostgreSQL, LiveKit): the sidebar group, the global pages and routes, the attendee
// search and invitation, access for people who were not invited, and a room shared by people from different projects (or from none).
// QA accounts (TEST-ONLY, see meeting-fixture.ts): manager (owns the projects), member (own project only), solo (never in any project),
// outsider (shares the manager's project but is never invited).
const FAKE_MEDIA = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen", "--enable-usermedia-screen-capturing"];
test.use({ storageState: REJECTED_STATE, trace: "off", video: "off", launchOptions: { args: FAKE_MEDIA } });
test.describe.configure({ mode: "serial" });
const base = "http://localhost:8080/api/v1", H = 3600_000;
const files = {} as Record<"manager" | "member" | "solo" | "outsider", string>;
test.beforeAll(() => { for (const role of ["manager", "member", "solo", "outsider"] as const) files[role] = meetingAccount(role); });

type Me = { id: string; nickname: string };
async function login(context: BrowserContext, file: string) {
  const account = JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string };
  await context.request.get(`${base}/auth/csrf`);
  const csrf = (await context.cookies(base)).find(c => c.name === "XSRF-TOKEN")!;
  const result = await context.request.post(`${base}/auth/login`, { headers: { "X-XSRF-TOKEN": decodeURIComponent(csrf.value), Origin: "http://localhost:3000" }, data: { email: account.email, password: account.password } });
  expect(result.status()).toBe(200);
}
/** A signed-in browser context + page for one QA account. */
async function open(browser: Browser, role: keyof typeof files, viewport = { width: 1440, height: 900 }, permissions: string[] = []) {
  const context = await browser.newContext({ storageState: REJECTED_STATE, viewport, permissions });
  await login(context, files[role]);
  const page = await context.newPage();
  await page.goto("/dashboard");
  const me = (await api(page, "GET", "/auth/me")).json as Me;
  return { context, page, me };
}
async function createProject(page: Page, label: string) {
  await page.goto("/projects");
  const result = await api(page, "POST", "/projects", { name: `Global ${label} ${Date.now()}`, projectTypes: ["WEB"] });
  expect(result.status).toBe(201); return result.json as Project;
}
/** TEST-ONLY fixture membership, restricted to a QA project created for this run. */
function addToProject(projectId: string, userId: string) {
  psql(`WITH membership AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(projectId)}','${uuid(userId)}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM membership`);
}
async function planMeeting(page: Page, title: string, attendeeIds: string[], startsIn = 3 * H) {
  const result = await api(page, "POST", "/meetings", { title, description: "Global meeting QA", startsAt: new Date(Date.now() + startsIn).toISOString(), endsAt: new Date(Date.now() + startsIn + H).toISOString(), zoneId: "Europe/Istanbul", agenda: ["Review"], attendeeIds });
  expect(result.status, JSON.stringify(result.json)).toBe(201); return result.json as Meeting;
}
const archive = async (page: Page, ...projects: (Project | undefined)[]) => { for (const project of projects) if (project) await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); };
const sidebar = (page: Page) => page.locator("aside nav");
const headings = (page: Page) => sidebar(page).locator("p").allTextContents();
/** The sidebar's "selected project" card (it carries the project name as its title). */
const selected = (page: Page, project: Project) => page.locator(`aside nav a[title="${project.name}"]`);
const group = (page: Page, scope = "aside") => page.locator(`${scope} [role="group"][aria-label="${tr.group}"]`);
async function join(page: Page) {
  await page.getByRole("button", { name: tr.join, exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) })).toBeVisible({ timeout: 30000 });
}
const connected = (page: Page) => page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) });

test("sidebar: a Meetings group exists without any project, between the project groups and Personal", async ({ browser }) => {
  const { context, page } = await open(browser, "solo");
  try {
    await page.goto(localizeHref("/meetings", "tr"));
    // A user who belongs to no project at all still has both menu entries, with their real addresses.
    await expect(group(page)).toBeVisible();
    const links = group(page).getByRole("link");
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute("href", localizeHref("/meetings/new", "tr"));
    await expect(links.nth(1)).toHaveAttribute("href", localizeHref("/meetings", "tr"));
    await expect(links.nth(1)).toHaveAttribute("aria-current", "page"); await expect(links.nth(0)).not.toHaveAttribute("aria-current", "page");
    const order = await headings(page);
    const at = (text: string) => order.findIndex(value => value.trim() === text);
    expect(at(messages.projects.detail.selectedProject), JSON.stringify(order)).toBeGreaterThanOrEqual(0);
    expect(at(tr.group)).toBeGreaterThan(at(messages.projects.detail.selectedProject));
    expect(at(messages.workspace.personal)).toBeGreaterThan(at(tr.group));
    // The group is not part of the project block.
    expect(await group(page).evaluate(node => !!node.closest('[aria-label="Seçili proje"]'))).toBe(false);
    // Create → its own entry is the active one.
    await links.nth(0).click(); await expect(page).toHaveURL(new RegExp(`${localizeHref("/meetings/new", "tr")}$`));
    await expect(links.nth(0)).toHaveAttribute("aria-current", "page"); await expect(links.nth(1)).not.toHaveAttribute("aria-current", "page");
    // The create page first asks which kind of meeting to plan.
    await expect(page.locator("[data-meeting-kind-choice]")).toHaveCount(2);
  } finally { await context.close(); }
});

test("sidebar with a project: order, collapse tooltips, keyboard, project change and accessibility", async ({ browser }) => {
  test.setTimeout(180000);
  const { context, page, me } = await open(browser, "manager");
  let one: Project | undefined, two: Project | undefined;
  try {
    one = await createProject(page, "Alpha"); two = await createProject(page, "Beta");
    const meeting = await planMeeting(page, `Sidebar QA ${Date.now()}`, []);
    // Visiting a project selects it (the app remembers the choice); the meetings page is then opened with that project selected.
    await page.goto(localizeHref(`/projects/${two.slug}`, "tr")); await expect(selected(page, two)).toBeVisible({ timeout: 15000 });
    // The QA account has many meetings from earlier runs; the search narrows the list to this run's meeting (the filter lives in the URL).
    const listUrl = `${localizeHref("/meetings", "tr")}?q=${encodeURIComponent(meeting.title)}`;
    await page.goto(listUrl); await expect(group(page)).toBeVisible();
    const order = await headings(page); const at = (text: string) => order.findIndex(value => value.trim() === text);
    const sequence = [messages.projects.detail.selectedProject, messages.tasks.nav.group, tr.group, messages.workspace.personal].map(at);
    expect(sequence.every(index => index >= 0), JSON.stringify(order)).toBe(true);
    expect([...sequence].sort((a, b) => a - b), "GENEL → SEÇİLİ PROJE → GÖREV YÖNETİMİ → TOPLANTILAR → KİŞİSEL").toEqual(sequence);
    // The same menu and the same meeting with the first, then the second project selected: the project changes nothing here.
    const card = page.locator("[data-meeting-card]").filter({ hasText: meeting.title });
    for (const project of [one, two]) {
      await page.locator('[data-testid="project-switcher-trigger"]:visible').click();
      await page.locator(`[data-project-choice="${project.id}"]`).click();
      await expect(selected(page, project)).toBeVisible({ timeout: 15000 });
      await expect(page).toHaveURL(new RegExp(`${localizeHref("/meetings", "tr")}\[?]q=`));
      await expect(group(page)).toBeVisible(); await expect(group(page).getByRole("link").nth(1)).toHaveAttribute("aria-current", "page");
      await expect(card).toHaveCount(1);
    }
    await page.reload(); await expect(card).toHaveCount(1);
    // Collapsed rail: icon-only links keep their names (title + accessible name) and the group stays.
    await page.getByRole("button", { name: messages.workspace.collapseSidebar }).click();
    const rail = group(page).getByRole("link");
    await expect(rail).toHaveCount(2);
    await expect(rail.nth(0)).toHaveAttribute("title", tr.create); await expect(rail.nth(1)).toHaveAttribute("title", tr.myMeetings);
    await expect(rail.nth(0)).toHaveAccessibleName(tr.create); await expect(rail.nth(1)).toHaveAccessibleName(tr.myMeetings);
    expect((await rail.nth(1).innerText()).trim(), "the rail shows icons only").toBe("");
    await expect(rail.nth(1)).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: messages.workspace.expandSidebar }).click();
    // Keyboard: Tab moves create → my meetings, a visible focus indicator, Enter follows the link.
    const create = group(page).getByRole("link", { name: tr.create }), mine = group(page).getByRole("link", { name: tr.myMeetings });
    await create.focus(); await expect(create).toBeFocused();
    await page.keyboard.press("Tab"); await expect(mine).toBeFocused();
    const indicator = await mine.evaluate(node => { const s = getComputedStyle(node); return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none"; });
    expect(indicator, "a visible focus indicator on the focused menu link").toBe(true);
    await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${localizeHref("/meetings/new", "tr")}$`));
    // Accessibility of the two global pages (the sidebar is part of both).
    for (const route of ["/meetings", "/meetings/new"]) {
      await page.goto(localizeHref(route, "tr")); await expect(sidebar(page)).toBeVisible();
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(" ")).slice(0, 3).join(" | ")}`), `axe ${route}`).toEqual([]);
    }
    expect(me.id).toBeTruthy();
  } finally { await archive(page, one, two); await context.close(); }
});

test("mobile drawer: the Meetings group is in place, readable, keyboard and tap friendly", async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page } = await open(browser, "solo", { width: 390, height: 844 });
  try {
    await page.goto(localizeHref("/meetings", "tr"));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scrolling on the list").toBe(true);
    await expect(page.locator("aside nav")).toBeHidden();
    // Located by its controls attribute: while the drawer is open the rest of the page is hidden from the accessibility tree.
    const hamburger = page.locator('button[aria-controls="workspace-mobile-navigation"]');
    await expect(hamburger).toHaveAccessibleName(messages.workspace.navigation);
    await hamburger.click(); await expect(hamburger).toHaveAttribute("aria-expanded", "true");
    const drawer = page.locator("#workspace-mobile-navigation"); await expect(drawer).toBeVisible();
    const order = await drawer.locator("p").allTextContents(); const at = (text: string) => order.findIndex(value => value.trim() === text);
    expect(at(tr.group), JSON.stringify(order)).toBeGreaterThan(at(messages.projects.detail.selectedProject));
    expect(at(messages.workspace.personal)).toBeGreaterThan(at(tr.group));
    const links = group(page, "#workspace-mobile-navigation").getByRole("link"); await expect(links).toHaveCount(2);
    for (const index of [0, 1]) {
      const box = await links.nth(index).boundingBox(); expect(box!.height, "tap target").toBeGreaterThanOrEqual(40);
      expect(await links.nth(index).evaluate(node => node.scrollWidth <= node.clientWidth + 1), "label not clipped").toBe(true);
    }
    await expect(links.nth(1)).toHaveAttribute("aria-current", "page");
    // Escape closes the drawer and returns the focus to the button that opened it.
    await page.keyboard.press("Escape"); await expect(drawer).toBeHidden(); await expect(hamburger).toBeFocused();
    // Tapping Create closes the drawer and opens the form, which is usable at this width.
    await hamburger.click(); await group(page, "#workspace-mobile-navigation").getByRole("link", { name: tr.create }).click();
    await expect(drawer).toBeHidden(); await expect(page).toHaveURL(new RegExp(`${localizeHref("/meetings/new", "tr")}$`));
    // The two kind cards stack on a phone; the independent one leads to the form.
    const first = await page.locator('[data-meeting-kind-choice="project"]').boundingBox(), second = await page.locator('[data-meeting-kind-choice="independent"]').boundingBox();
    expect(second!.y, "cards stack on a phone").toBeGreaterThan(first!.y + first!.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scrolling on the chooser").toBe(true);
    await page.locator('[data-meeting-kind-choice="independent"]').click();
    await expect(page.locator("#meeting-title")).toBeVisible(); await expect(page.getByRole("searchbox", { name: tr.searchPeople })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scrolling on the form").toBe(true);
  } finally { await context.close(); }
});

test("routes in all three languages, old project links and the language of the menu", async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page } = await open(browser, "manager");
  let project: Project | undefined;
  try {
    project = await createProject(page, "Links"); const meeting = await planMeeting(page, `Links QA ${Date.now()}`, []);
    for (const [locale, dict] of [["tr", tr], ["en", en], ["de", de]] as const) {
      await page.goto(localizeHref("/meetings", locale));
      await expect(page).toHaveURL(new RegExp(`${localizeHref("/meetings", locale)}$`));
      await expect(page.locator(`aside [role="group"][aria-label="${dict.group}"]`)).toBeVisible();
      await expect(page.getByRole("heading", { name: dict.myMeetings, level: 1 })).toBeVisible();
      await page.goto(localizeHref(`/meetings/${meeting.id}`, locale));
      await expect(page.getByRole("heading", { name: meeting.title, exact: true })).toBeVisible();
    }
    // Links written before meetings left the projects go to the same meeting at its global address (query and locale kept).
    for (const [old, expected] of [
      [`/tr/projeler/${project.slug}/toplantilar/${meeting.id}`, `/tr/toplantilar/${meeting.id}`],
      [`/en/projects/${project.slug}/meetings/${meeting.id}/room`, `/en/meetings/${meeting.id}/room`],
      [`/de/projekte/${project.slug}/besprechungen/neu`, `/de/besprechungen/neu`],
      [`/tr/projeler/${project.slug}/toplantilar`, `/tr/toplantilar`],
    ]) {
      await page.goto(old);
      await expect.poll(() => new URL(page.url()).pathname, old).toBe(expected);
    }
    // The front end never asks the removed project-scoped API for meetings.
    const requests: string[] = []; page.on("request", request => { if (/\/api\/v1\/projects\/[^/]+\/meetings/.test(request.url())) requests.push(request.url()); });
    await page.goto(localizeHref("/meetings", "tr")); await page.goto(localizeHref("/meetings/new", "tr")); await page.goto(localizeHref(`/meetings/${meeting.id}`, "tr")); await page.goto(localizeHref("/calendar", "tr"));
    expect(requests).toEqual([]);
    // The removed API answers a signed-in caller with an error, never with meetings.
    expect((await api(page, "GET", `/projects/${project.id}/meetings`)).status).toBeGreaterThanOrEqual(400);
  } finally { await archive(page, project); await context.close(); }
});

test("a user without any project creates, invites, starts and lists a meeting; the attendee search is global and private", async ({ browser }) => {
  test.setTimeout(240000);
  const manager = await open(browser, "manager"), solo = await open(browser, "solo"), member = await open(browser, "member");
  let managerProject: Project | undefined, memberProject: Project | undefined;
  try {
    managerProject = await createProject(manager.page, "Search A"); memberProject = await createProject(member.page, "Search B");
    // --- the user with no project at all: no project selected, still full access -------------------------------------------
    const search = solo.page, title = `Projectless ${Date.now()}`, listQuery = `${localizeHref("/meetings", "tr")}?q=${encodeURIComponent(title)}`;
    await search.goto(localizeHref("/meetings/new?type=independent", "tr"));
    await search.locator("#meeting-title").fill(title);
    const requests: string[] = []; search.on("request", request => { if (request.url().includes("/meetings/attendees/search")) requests.push(request.url()); });
    const box = search.getByRole("searchbox", { name: tr.searchPeople });
    // Too short: a hint, and no request is sent at all.
    await box.fill(member.me.nickname.slice(0, 2)); await expect(search.getByText(/en az 3 harf/)).toBeVisible(); await search.waitForTimeout(600); expect(requests).toEqual([]);
    // A person of another project is found by name although the searcher shares no project with them.
    await box.fill(member.me.nickname);
    const result = search.getByRole("list", { name: tr.searchResults });
    await expect(result.getByRole("button", { name: new RegExp(member.me.nickname) })).toBeVisible();
    expect(await search.locator("body").innerText(), "no e-mail address on screen").not.toContain("@example.test");
    // The searcher never finds themselves.
    await box.fill(solo.me.nickname); await expect(search.getByText(tr.noPeopleFound)).toBeVisible();
    // Add by clicking; the person leaves the result list, appears once among the attendees and can be removed again.
    await box.fill(member.me.nickname);
    await result.getByRole("button", { name: new RegExp(member.me.nickname) }).click();
    await expect(search.getByRole("list", { name: tr.selectedAttendees }).getByText(member.me.nickname)).toHaveCount(1);
    await expect(result.getByRole("button", { name: new RegExp(member.me.nickname) })).toHaveCount(0);
    await search.getByRole("button", { name: `${member.me.nickname} kişisini katılımcılardan çıkar` }).click();
    await expect(search.getByRole("list", { name: tr.selectedAttendees }).getByText(member.me.nickname)).toHaveCount(0);
    await box.fill(member.me.nickname); await result.getByRole("button", { name: new RegExp(member.me.nickname) }).click();
    await search.getByRole("button", { name: tr.plan, exact: true }).click();
    await expect(search).toHaveURL(/\/toplantilar\/[0-9a-f-]{36}$/);
    const id = new URL(search.url()).pathname.split("/").at(-1)!;
    await expect(search.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(search.getByText(member.me.nickname).first()).toBeVisible();
    // It is listed for the creator (no project) and for the invited person of another project, and for nobody else.
    await search.goto(listQuery); await expect(search.locator("[data-meeting-card]").filter({ hasText: title })).toHaveCount(1);
    await member.page.goto(listQuery); await expect(member.page.locator("[data-meeting-card]").filter({ hasText: title })).toHaveCount(1);
    await manager.page.goto(listQuery); await expect(manager.page.locator("[data-meeting-card]").filter({ hasText: title })).toHaveCount(0);
    // Removing the attendee takes the access away at once (server side).
    expect((await api(member.page, "GET", `/meetings/${id}`)).status).toBe(200);
    await search.goto(localizeHref(`/meetings/${id}/edit`, "tr"));
    await search.getByRole("button", { name: `${member.me.nickname} kişisini katılımcılardan çıkar` }).click();
    await search.getByRole("button", { name: tr.save, exact: true }).click(); await expect(search).toHaveURL(new RegExp(`/toplantilar/${id}$`));
    expect((await api(member.page, "GET", `/meetings/${id}`)).status).toBe(404);
    expect((await api(search, "GET", `/meetings/${id}`)).status).toBe(200);
    // Search rules at the API: nickname only (an address is never looked up), 3 characters, at most 10 results, private.
    const probe = async (query: string) => api(manager.page, "GET", `/meetings/attendees/search?q=${encodeURIComponent(query)}`);
    expect((await probe("ab")).status).toBe(400);
    expect((await probe(`${member.me.nickname}@example.test`)).json).toEqual([]);
    const found = (await probe("meeting")).json as { userId: string; nickname: string }[];
    expect(found.length).toBeGreaterThan(0); expect(found.length).toBeLessThanOrEqual(10);
    expect(Object.keys(found[0]).sort()).toEqual(["nickname", "profilePhotoVersion", "userId"]);
    expect(found.some(person => person.userId === manager.me.id)).toBe(false);
    // The same person cannot be invited twice: a duplicate id collapses to one attendee.
    const twice = await api(manager.page, "POST", "/meetings", { title: "Twice", description: "", startsAt: new Date(Date.now() + 3 * H).toISOString(), endsAt: new Date(Date.now() + 4 * H).toISOString(), zoneId: "UTC", agenda: [], attendeeIds: [member.me.id, member.me.id] });
    expect(twice.status).toBe(201); expect((twice.json as Meeting).attendeeIds).toEqual([member.me.id]);
    // Unknown people cannot be invited.
    expect((await api(manager.page, "POST", "/meetings", { title: "Ghost", description: "", startsAt: new Date(Date.now() + 3 * H).toISOString(), endsAt: new Date(Date.now() + 4 * H).toISOString(), zoneId: "UTC", agenda: [], attendeeIds: ["00000000-0000-4000-8000-000000000999"] })).status).toBe(400);
  } finally { await archive(manager.page, managerProject); await archive(member.page, memberProject); await manager.context.close(); await solo.context.close(); await member.context.close(); }
});

test("someone who was not invited learns nothing; an attendee cannot use the organizer's powers; no project role changes that", async ({ browser }) => {
  test.setTimeout(180000);
  const manager = await open(browser, "manager"), outsider = await open(browser, "outsider"), member = await open(browser, "member");
  let project: Project | undefined;
  try {
    project = await createProject(manager.page, "Access"); addToProject(project.id, outsider.me.id); addToProject(project.id, member.me.id);
    const meeting = await planMeeting(manager.page, `Private ${Date.now()}`, [member.me.id]);
    const calls: [string, string, unknown?][] = [["GET", `/meetings/${meeting.id}`], ["GET", `/meetings/${meeting.id}/participants`], ["GET", `/meetings/${meeting.id}/chat`], ["POST", `/meetings/${meeting.id}/join`],
      ["POST", `/meetings/${meeting.id}/start`], ["POST", `/meetings/${meeting.id}/cancel`], ["POST", `/meetings/${meeting.id}/end`], ["GET", `/meetings/${meeting.id}/invites`],
      ["POST", `/meetings/${meeting.id}/invites`, { expiresAt: new Date(Date.now() + H).toISOString(), maxUses: 1 }],
      ["PUT", `/meetings/${meeting.id}`, { title: "Hijack", description: "", startsAt: meeting.startsAt, endsAt: meeting.endsAt, zoneId: "UTC", agenda: [], attendeeIds: [outsider.me.id] }]];
    // A project mate who knows the id (even a project manager of that same project would be no different) gets 404 for everything.
    for (const [method, path, body] of calls) expect((await api(outsider.page, method, path, body)).status, `outsider ${method} ${path}`).toBe(404);
    expect(((await api(outsider.page, "GET", "/meetings?size=100")).json as { content: Meeting[] }).content.some(item => item.id === meeting.id)).toBe(false);
    await outsider.page.goto(localizeHref(`/meetings/${meeting.id}`, "tr"));
    await expect(outsider.page.getByText(tr.notFound)).toBeVisible(); await expect(outsider.page.getByText(meeting.title)).toHaveCount(0);
    await outsider.page.goto(localizeHref(`/meetings/${meeting.id}/room`, "tr"));
    await expect(outsider.page.getByRole("button", { name: tr.join, exact: true })).toHaveCount(0);
    // The attendee reads, but every organizer-only action is refused (403) and the buttons are not offered.
    expect((await api(member.page, "GET", `/meetings/${meeting.id}`)).status).toBe(200);
    for (const [method, path, body] of calls.slice(4)) expect((await api(member.page, method, path, body)).status, `attendee ${method} ${path}`).toBe(403);
    await member.page.goto(localizeHref(`/meetings/${meeting.id}`, "tr"));
    await expect(member.page.getByRole("heading", { name: meeting.title, exact: true })).toBeVisible();
    for (const label of [tr.startNow, tr.edit, tr.cancelMeeting]) await expect(member.page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    await expect(member.page.getByRole("link", { name: tr.edit, exact: true })).toHaveCount(0);
    await member.page.goto(localizeHref(`/meetings/${meeting.id}/edit`, "tr")); await expect(member.page.getByRole("alert")).toBeVisible();
  } finally { await archive(manager.page, project); await manager.context.close(); await outsider.context.close(); await member.context.close(); }
});

test("people from different projects and from none share one room; the organizer alone moderates; a project change does not touch the call", async ({ browser }) => {
  test.setTimeout(300000);
  const permissions = ["camera", "microphone"];
  const a = await open(browser, "manager", { width: 1280, height: 900 }, permissions), b = await open(browser, "member", { width: 1280, height: 900 }, permissions), c = await open(browser, "solo", { width: 1280, height: 900 }, permissions);
  let managerProject: Project | undefined, memberProject: Project | undefined, memberSecond: Project | undefined;
  try {
    managerProject = await createProject(a.page, "Room A"); memberProject = await createProject(b.page, "Room B"); memberSecond = await createProject(b.page, "Room B2");
    const meeting = await planMeeting(a.page, `Cross room ${Date.now()}`, [b.me.id, c.me.id], 1000);
    expect((await api(a.page, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
    // Everyone enters through the global room address (a fresh document load applies the media policy of the room route).
    for (const who of [a, b, c]) await who.page.goto(localizeHref(`/meetings/${meeting.id}/room`, "tr"));
    await join(a.page); await join(b.page); await join(c.page);
    await showPanel(a.page, tr.participants);
    await expect(a.page.locator("[data-meeting-room] [data-participant]")).toHaveCount(3, { timeout: 30000 });
    // Media: the organizer publishes microphone and camera; both others receive real tracks.
    await a.page.getByRole("button", { name: tr.micOn, exact: true }).click(); await a.page.getByRole("button", { name: tr.cameraOn, exact: true }).click();
    await expect(a.page.getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    await expect(b.page.locator("video").first()).toBeVisible({ timeout: 20000 }); await expect(c.page.locator("video").first()).toBeVisible({ timeout: 20000 });
    // Organizer-only controls: the others get neither "end for everyone" nor moderation, and the server refuses them.
    await expect(a.page.getByRole("button", { name: tr.endForAll, exact: true })).toBeVisible();
    await expect(b.page.getByRole("button", { name: tr.endForAll, exact: true })).toHaveCount(0);
    await showPanel(b.page, tr.participants);
    await openParticipantMenu(b.page); await expect(b.page.getByRole("button", { name: tr.muteParticipant, exact: true })).toHaveCount(0); await b.page.keyboard.press("Escape");
    const participants = (await api(a.page, "GET", `/meetings/${meeting.id}/participants`)).json as { id: string; userId: string }[];
    const target = participants.find(p => p.userId === c.me.id)!;
    for (const [role, who] of [["member", b], ["solo", c]] as const) {
      expect((await api(who.page, "POST", `/meetings/${meeting.id}/participants/${target.id}/mute`)).status, `${role} mute`).toBe(403);
      expect((await api(who.page, "POST", `/meetings/${meeting.id}/participants/${target.id}/kick`)).status, `${role} kick`).toBe(403);
      expect((await api(who.page, "POST", `/meetings/${meeting.id}/end`)).status, `${role} end`).toBe(403);
    }
    // A project change in the middle of the call: the member switches the selected project in the sidebar; the call stays connected.
    await expect(connected(b.page)).toBeVisible();
    await b.page.locator('[data-testid="project-switcher-trigger"]:visible').click();
    await b.page.locator(`[data-project-choice="${memberSecond.id}"]`).click();
    await expect(selected(b.page, memberSecond)).toBeVisible({ timeout: 15000 });
    await expect(connected(b.page)).toBeVisible(); await expect(b.page.locator("[data-meeting-room]")).toBeVisible();
    expect(new URL(b.page.url()).pathname).toBe(localizeHref(`/meetings/${meeting.id}/room`, "tr"));
    await expect(b.page.locator("video").first()).toBeVisible();
    // Ending for everyone: the organizer's action closes the room for the others.
    await a.page.getByRole("button", { name: tr.endForAll, exact: true }).click();
    await a.page.getByRole("dialog").getByRole("button", { name: tr.endConfirmLabel, exact: true }).click();
    await expect(b.page.getByRole("heading", { name: tr.phase.closed, exact: true })).toBeVisible({ timeout: 20000 });
    await expect(c.page.getByRole("heading", { name: tr.phase.closed, exact: true })).toBeVisible({ timeout: 20000 });
    await expect.poll(async () => ((await api(a.page, "GET", `/meetings/${meeting.id}`)).json as Meeting).status).toBe("ENDED");
    // The finished meeting stays in everybody's list (history), whatever their projects.
    for (const who of [a, b, c]) expect(((await api(who.page, "GET", "/meetings?size=100&sort=startsAt,desc&hidden=INCLUDE")).json as { content: Meeting[] }).content.some(item => item.id === meeting.id), who.me.nickname).toBe(true);
  } finally {
    await archive(a.page, managerProject); await archive(b.page, memberProject, memberSecond);
    await a.context.close(); await b.context.close(); await c.context.close();
  }
});

const CHOOSER_TR = { project: ["Proje Toplantısı Oluştur", "Projelerinizden birini seçerek o projeye bağlı bir toplantı planlayın ve proje ekibinizle bir araya gelin."],
  independent: ["Bağımsız Toplantı Oluştur", "Herhangi bir projeye bağlı olmadan toplantı oluşturun ve istediğiniz kullanıcıları davet edin."] } as const;
const choice = (page: Page, kind: "project" | "independent") => page.locator(`[data-meeting-kind-choice="${kind}"]`);
const axeViolations = async (page: Page) => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(" ")).slice(0, 3).join(" | ")}`);
const UNKNOWN_PROJECT = "00000000-0000-4000-8000-000000000999";

test("create meeting: kind chooser, project picker and both forms; back navigation, three languages, phone and desktop", async ({ browser }) => {
  test.setTimeout(240000);
  const manager = await open(browser, "manager"), member = await open(browser, "member");
  let a: Project | undefined, b: Project | undefined, other: Project | undefined;
  try {
    a = await createProject(manager.page, "Flow A"); b = await createProject(manager.page, "Flow B"); other = await createProject(member.page, "Flow Other");
    addToProject(a.id, member.me.id);
    const page = manager.page;
    // ---- step 1: the chooser ----------------------------------------------------------------------------------------------------
    await page.goto(localizeHref("/meetings/new", "tr"));
    await expect(page.locator("[data-meeting-kind-choice]")).toHaveCount(2);
    for (const kind of ["project", "independent"] as const) { await expect(choice(page, kind)).toContainText(CHOOSER_TR[kind][0]); await expect(choice(page, kind)).toContainText(CHOOSER_TR[kind][1]); }
    expect(tr.createProjectMeeting).toBe(CHOOSER_TR.project[0]); expect(tr.createIndependentMeetingDescription).toBe(CHOOSER_TR.independent[1]);
    const left = await choice(page, "project").boundingBox(), right = await choice(page, "independent").boundingBox();
    expect(Math.abs(left!.y - right!.y), "side by side on a desktop").toBeLessThan(2); expect(right!.x).toBeGreaterThan(left!.x);
    expect(await axeViolations(page), "axe: chooser (light)").toEqual([]);
    await page.emulateMedia({ colorScheme: "dark" }); expect(await axeViolations(page), "axe: chooser (dark)").toEqual([]); await page.emulateMedia({ colorScheme: "light" });
    // Keyboard: a visible focus ring on a card; Enter opens the project picker.
    await choice(page, "project").focus(); await expect(choice(page, "project")).toBeFocused();
    expect(await choice(page, "project").evaluate(node => { const s = getComputedStyle(node); return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none"; }), "visible focus").toBe(true);
    await page.keyboard.press("Enter"); await expect(page).toHaveURL(/[?]type=project$/);
    // ---- step 2: the picker lists the projects of this user only -----------------------------------------------------------------
    await expect(page.locator(`[data-meeting-project-choice="${a.id}"]`)).toBeVisible(); await expect(page.locator(`[data-meeting-project-choice="${b.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-meeting-project-choice="${other.id}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-meeting-project-choice="${a.id}"]`)).toContainText(a.name);
    expect(await axeViolations(page), "axe: picker").toEqual([]);
    await expect(page.getByRole("link", { name: tr.changeKind })).toHaveCount(0);
    await page.goBack(); await expect(page).toHaveURL(new RegExp(`${localizeHref("/meetings/new", "tr")}$`));
    await page.goForward(); await expect(page).toHaveURL(/[?]type=project$/);
    // A project of someone else (typed into the address) or one that does not exist is refused, not opened.
    for (const foreign of [other.id, UNKNOWN_PROJECT]) {
      await page.goto(localizeHref(`/meetings/new?type=project&project=${foreign}`, "tr"));
      await expect(page.getByRole("alert").filter({ hasText: tr.projectUnavailable })).toBeVisible(); await expect(page.locator("#meeting-title")).toHaveCount(0);
    }
    // ---- step 3: the project form: the project is shown, its members are offered first and nobody is added on their own -----------
    await page.goto(localizeHref(`/meetings/new?type=project&project=${a.id}`, "tr"));
    await expect(page.locator("#meeting-title")).toBeVisible();
    await expect(page.getByRole("heading", { name: tr.createProjectMeeting, level: 1 })).toBeVisible();
    const bar = page.locator("[data-meeting-kind-bar]"); await expect(bar).toContainText(tr.kindProject); await expect(bar).toContainText(a.name);
    await expect(page.locator("[data-project-members]")).toContainText(member.me.nickname);
    await expect(page.getByRole("list", { name: tr.selectedAttendees }).getByText(member.me.nickname)).toHaveCount(0);
    expect(await axeViolations(page), "axe: project form").toEqual([]);
    await page.getByRole("link", { name: tr.changeProject }).click(); await expect(page).toHaveURL(/[?]type=project$/);
    // ---- the independent form: no project, no member list, the global search ----------------------------------------------------------
    await page.goto(localizeHref("/meetings/new", "tr")); await choice(page, "independent").click();
    await expect(page).toHaveURL(/[?]type=independent$/); await expect(page.locator("#meeting-title")).toBeVisible();
    await expect(page.locator("[data-meeting-kind-bar]")).toContainText(tr.kindIndependent); await expect(page.locator("[data-project-members]")).toHaveCount(0);
    await expect(page.getByRole("searchbox", { name: tr.searchPeople })).toBeVisible();
    expect(await axeViolations(page), "axe: independent form").toEqual([]);
    await expect(page.getByRole("link", { name: tr.changeKind })).toHaveCount(0);
    await page.goBack(); await expect(page.locator("[data-meeting-kind-choice]")).toHaveCount(2);
    // ---- the chooser in the other two languages ---------------------------------------------------------------------------------------
    for (const [locale, dict] of [["en", en], ["de", de]] as const) {
      await page.goto(localizeHref("/meetings/new", locale));
      await expect(choice(page, "project")).toContainText(dict.createProjectMeeting); await expect(choice(page, "project")).toContainText(dict.createProjectMeetingDescription);
      await expect(choice(page, "independent")).toContainText(dict.createIndependentMeeting); await expect(choice(page, "independent")).toContainText(dict.createIndependentMeetingDescription);
    }
    // ---- phone: the cards stack and nothing overflows ----------------------------------------------------------------------------------
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(localizeHref("/meetings/new", "tr"));
    const top = await choice(page, "project").boundingBox(), bottom = await choice(page, "independent").boundingBox();
    expect(bottom!.y).toBeGreaterThan(top!.y + top!.height - 1); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(localizeHref(`/meetings/new?type=project&project=${a.id}`, "tr")); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "project form on a phone").toBe(true);
  } finally { await archive(manager.page, a, b); await archive(member.page, other); await manager.context.close(); await member.context.close(); }
});

test("project and independent meetings: saved as chosen, shown and filtered together, never widening access, kept when the project goes, both start into the room", async ({ browser }) => {
  test.setTimeout(420000);
  const permissions = ["camera", "microphone"];
  const manager = await open(browser, "manager", { width: 1280, height: 900 }, permissions), member = await open(browser, "member", { width: 1280, height: 900 }, permissions);
  const solo = await open(browser, "solo", { width: 1280, height: 900 }, permissions), outsider = await open(browser, "outsider");
  let a: Project | undefined, b: Project | undefined;
  const tag = `Hybrid ${Date.now()}`;
  try {
    a = await createProject(manager.page, "Hybrid A"); b = await createProject(manager.page, "Hybrid B");
    addToProject(a.id, member.me.id); addToProject(a.id, outsider.me.id);
    const page = manager.page;
    // ---- create a PROJECT meeting through the real form: the project's members are offered, only the picked people attend --------------
    await page.goto(localizeHref(`/meetings/new?type=project&project=${a.id}`, "tr"));
    await page.locator("#meeting-title").fill(`${tag} project`);
    await page.locator("[data-project-members]").getByRole("button", { name: new RegExp(member.me.nickname) }).click();
    await expect(page.getByRole("list", { name: tr.selectedAttendees }).getByText(member.me.nickname)).toHaveCount(1);
    // someone outside the project is invited through the global search
    await page.getByRole("searchbox", { name: tr.searchPeople }).fill(solo.me.nickname);
    await page.getByRole("list", { name: tr.searchResults }).getByRole("button", { name: new RegExp(solo.me.nickname) }).click();
    await page.getByRole("button", { name: tr.plan, exact: true }).click(); await expect(page).toHaveURL(/\/toplantilar\/[0-9a-f-]{36}$/);
    const projectMeetingId = new URL(page.url()).pathname.split("/").at(-1)!;
    await expect(page.locator("[data-meeting-kind-bar]")).toContainText(tr.kindProject); await expect(page.locator("[data-meeting-kind-bar]")).toContainText(a.name);
    const stored = (await api(page, "GET", `/meetings/${projectMeetingId}`)).json as Meeting;
    expect(stored.meetingType).toBe("PROJECT"); expect(stored.project?.id).toBe(a.id);
    expect([...stored.attendeeIds].sort()).toEqual([member.me.id, solo.me.id].sort()); // not the whole project: not the outsider, not any other member
    expect(psql(`SELECT project_id FROM meetings WHERE id='${uuid(projectMeetingId)}'`)).toBe(a.id);
    // ---- an INDEPENDENT meeting: no project anywhere -------------------------------------------------------------------------------------
    await page.goto(localizeHref("/meetings/new?type=independent", "tr")); await page.locator("#meeting-title").fill(`${tag} independent`);
    await page.getByRole("button", { name: tr.plan, exact: true }).click(); await expect(page).toHaveURL(/\/toplantilar\/[0-9a-f-]{36}$/);
    const independentId = new URL(page.url()).pathname.split("/").at(-1)!;
    await expect(page.locator("[data-meeting-kind-bar]")).toContainText(tr.kindIndependent); await expect(page.locator("[data-meeting-project-name]")).toHaveCount(0);
    expect(psql(`SELECT coalesce(project_id::text,'-') FROM meetings WHERE id='${uuid(independentId)}'`)).toBe("-");
    // ---- the list shows both, one card each, with their kind and project; the filters narrow, they never widen ----------------------------
    const list = `${localizeHref("/meetings", "tr")}?q=${encodeURIComponent(tag)}`;
    const cardOf = (title: string) => page.locator("[data-meeting-card]").filter({ hasText: title });
    await page.goto(list);
    await expect(page.locator("[data-meeting-card]")).toHaveCount(2);
    await expect(cardOf(`${tag} project`).locator('[data-meeting-kind="PROJECT"]')).toContainText(tr.kindProject); await expect(cardOf(`${tag} project`)).toContainText(a.name);
    await expect(cardOf(`${tag} independent`).locator('[data-meeting-kind="INDEPENDENT"]')).toContainText(tr.kindIndependent);
    await expect(cardOf(`${tag} independent`).locator("[data-meeting-project-name]")).toHaveCount(0);
    const kindSelect = page.getByRole("combobox", { name: tr.filterKind, exact: true });
    await kindSelect.click(); await page.getByRole("option", { name: tr.kindProjects, exact: true }).click();
    await expect(page).toHaveURL(/type=project/); await expect(page.locator("[data-meeting-card]")).toHaveCount(1); await expect(cardOf(`${tag} project`)).toHaveCount(1);
    const projectSelect = page.getByRole("combobox", { name: tr.filterProject, exact: true }); await expect(projectSelect).toBeVisible();
    await projectSelect.click();
    await expect(page.getByRole("option", { name: a.name, exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: b.name, exact: true })).toHaveCount(0); // only projects that have meetings the viewer can see
    await page.getByRole("option", { name: a.name, exact: true }).click(); await expect(page).toHaveURL(/project=/); await expect(page.locator("[data-meeting-card]")).toHaveCount(1);
    await kindSelect.click(); await page.getByRole("option", { name: tr.kindIndependents, exact: true }).click();
    await expect(page.locator("[data-meeting-card]")).toHaveCount(1); await expect(cardOf(`${tag} independent`)).toHaveCount(1); await expect(page).not.toHaveURL(/project=/);
    await kindSelect.click(); await page.getByRole("option", { name: tr.kindAll, exact: true }).click(); await expect(page.locator("[data-meeting-card]")).toHaveCount(2);
    // a project the viewer cannot see in a typed address matches nothing
    await page.goto(`${list}&type=project&project=${UNKNOWN_PROJECT}`); await expect(page.locator("[data-meeting-card]")).toHaveCount(0);
    // ---- visibility: being a member of the project is not being an attendee; the project is named to its members only -----------------------
    expect((await api(outsider.page, "GET", `/meetings/${projectMeetingId}`)).status).toBe(404); // a member of project A who was never invited
    expect(((await api(outsider.page, "GET", "/meetings?size=100&sort=startsAt,desc")).json as { content: Meeting[] }).content.some(item => item.id === projectMeetingId)).toBe(false);
    const asMember = (await api(member.page, "GET", `/meetings/${projectMeetingId}`)).json as Meeting; expect(asMember.project?.name).toBe(a.name); // an attendee inside the project
    const asSolo = (await api(solo.page, "GET", `/meetings/${projectMeetingId}`)).json as Meeting; expect(asSolo.meetingType).toBe("PROJECT"); expect(asSolo.project).toBeNull(); // outside it
    await solo.page.goto(localizeHref(`/meetings/${projectMeetingId}`, "tr")); await expect(solo.page.locator("[data-meeting-kind-bar]")).toContainText(tr.kindProject);
    await expect(solo.page.locator("[data-meeting-project-name]")).toHaveCount(0); expect(await solo.page.locator("body").innerText()).not.toContain(a.name);
    // the kind and the project are fixed once created, and the server (not the form) decides which project may be used
    const edit = { title: "x", description: "", startsAt: stored.startsAt, endsAt: stored.endsAt, zoneId: "UTC", agenda: [], attendeeIds: [] as string[] };
    expect((await api(page, "PUT", `/meetings/${projectMeetingId}`, { ...edit, meetingType: "PROJECT", projectId: b.id })).status).toBe(400);
    expect((await api(page, "PUT", `/meetings/${projectMeetingId}`, { ...edit, meetingType: "INDEPENDENT" })).status).toBe(400);
    expect((await api(member.page, "POST", "/meetings", { ...edit, title: "Not mine", meetingType: "PROJECT", projectId: b.id })).status).toBe(403); // member is not in project B
    expect((await api(manager.page, "POST", "/meetings", { ...edit, title: "No project", meetingType: "PROJECT" })).status).toBe(400);
    expect((await api(manager.page, "POST", "/meetings", { ...edit, title: "Both", meetingType: "INDEPENDENT", projectId: a.id })).status).toBe(400);
    // ---- "Start now" goes straight into the room for BOTH kinds, with no second "join" click -----------------------------------------------
    for (const [type, query] of [["project", `?type=project&project=${a.id}`], ["independent", "?type=independent"]] as const) {
      await page.goto(localizeHref(`/meetings/new${query}`, "tr")); await page.locator("#meeting-title").fill(`${tag} now ${type}`);
      await page.getByRole("button", { name: tr.startNow, exact: true }).click();
      await expect(page).toHaveURL(/\/toplantilar\/[0-9a-f-]{36}\/oda$/, { timeout: 30000 });
      await expect(connected(page)).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole("button", { name: tr.join, exact: true })).toHaveCount(0);
    }
    // ---- attendees of a PROJECT meeting join its real room by the same global address (media tokens follow the meeting, not the project) ----
    expect((await api(page, "POST", `/meetings/${projectMeetingId}/start`)).status).toBe(200);
    await member.page.goto(localizeHref(`/meetings/${projectMeetingId}/room`, "tr")); await join(member.page);
    await solo.page.goto(localizeHref(`/meetings/${projectMeetingId}/room`, "tr")); await join(solo.page);
    await outsider.page.goto(localizeHref(`/meetings/${projectMeetingId}/room`, "tr")); await expect(outsider.page.getByRole("button", { name: tr.join, exact: true })).toHaveCount(0);
    expect((await api(outsider.page, "POST", `/meetings/${projectMeetingId}/join`)).status).toBe(404);
    expect((await api(member.page, "POST", `/meetings/${projectMeetingId}/end`)).status).toBe(403);
    // ---- the project goes away: the meeting stays, now independent, for everyone who had it ----------------------------------------------------
    const deleted = await api(page, "DELETE", `/projects/${a.id}`); expect([200, 204], JSON.stringify(deleted.json)).toContain(deleted.status);
    for (const who of [manager, member, solo]) {
      const view = await api(who.page, "GET", `/meetings/${projectMeetingId}`); expect(view.status, who.me.nickname).toBe(200);
      expect((view.json as Meeting).meetingType).toBe("INDEPENDENT"); expect((view.json as Meeting).project).toBeNull();
    }
    a = undefined;
    await page.goto(`${localizeHref("/meetings", "tr")}?q=${encodeURIComponent(`${tag} project`)}`); await expect(page.locator("[data-meeting-card]")).toHaveCount(1);
    await expect(page.locator('[data-meeting-card] [data-meeting-kind="INDEPENDENT"]')).toHaveCount(1);
  } finally { await archive(manager.page, a, b); await manager.context.close(); await member.context.close(); await solo.context.close(); await outsider.context.close(); }
});
