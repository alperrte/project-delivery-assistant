import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { meetingAccount, showPanel } from "./meeting-fixture";
import { REJECTED_STATE } from "./consent-state";
import { localizeHref } from "../src/i18n/routing";
import type { Project } from "../src/features/projects/types";
import type { Meeting } from "../src/features/meetings/types";
import tr from "../src/i18n/meetings/tr.json";
import AxeBuilder from "@axe-core/playwright";

// The redesigned meeting surfaces against the real API (and, for the room, the real LiveKit SFU): list filters/search/sort/groups/URL
// state/permissions, the create form (agenda, participants, inline time errors, start now) and the stage/strip/panel of the room.
const FAKE_MEDIA = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen", "--enable-usermedia-screen-capturing"];
test.use({ storageState: REJECTED_STATE, trace: "off", video: "off", launchOptions: { args: FAKE_MEDIA } });
test.describe.configure({ mode: "serial" });
const base = "http://localhost:8080/api/v1", H = 3600_000, D = 24 * H;
let managerFile: string, memberFile: string;
test.beforeAll(() => { managerFile = meetingAccount("manager"); memberFile = meetingAccount("member"); });
async function login(context: BrowserContext, file: string) {
  const account = JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string };
  await context.request.get(`${base}/auth/csrf`);
  const csrf = (await context.cookies(base)).find(c => c.name === "XSRF-TOKEN")!;
  const result = await context.request.post(`${base}/auth/login`, { headers: { "X-XSRF-TOKEN": decodeURIComponent(csrf.value), Origin: "http://localhost:3000" }, data: { email: account.email, password: account.password } });
  expect(result.status()).toBe(200);
}
const listHref = (slug: string, query = "") => localizeHref(`/projects/${slug}/meetings`, "tr") + query;
async function createProject(page: Page) {
  await page.goto("/projects");
  const result = await api(page, "POST", "/projects", { name: `Redesign QA ${Date.now()}`, projectTypes: ["WEB"] });
  expect(result.status).toBe(201); return result.json as Project;
}
async function addMember(page: Page, project: Project) {
  await page.goto("/dashboard");
  const me = (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string };
  psql(`WITH membership AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(project.id)}','${uuid(me.id)}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM membership`);
  return me;
}
async function make(page: Page, project: Project, title: string, startsIn: number, lengthMs = H, attendeeIds: string[] = [], description = "Real API data") {
  const result = await api(page, "POST", `/projects/${project.id}/meetings`, { title, description, startsAt: new Date(Date.now() + startsIn).toISOString(), endsAt: new Date(Date.now() + startsIn + lengthMs).toISOString(), zoneId: "Europe/Istanbul", agenda: ["Review"], attendeeIds });
  expect(result.status).toBe(201); return result.json as Meeting;
}
const cards = (page: Page) => page.locator("[data-meeting-card]");
const tab = (page: Page, name: string) => page.getByRole("navigation", { name: tr.filter, exact: true }).getByRole("button", { name: new RegExp(`^${name}`) });

test("list: counts, filters, URL state, Back/Forward, search, sort, groups, one card per meeting, actions per status and role", async ({ browser }) => {
  test.setTimeout(180000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, viewport: { width: 1440, height: 1000 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, viewport: { width: 1440, height: 1000 } });
  const page = await managerContext.newPage(), memberPage = await memberContext.newPage();
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(page);
    const member = await addMember(memberPage, project);
    const scheduledLater = await make(page, project, "Alpha roadmap", 5 * D, H, [member.id]);
    const tomorrow = await make(page, project, "Beta retrospective", D + 2 * H);
    const soon = await make(page, project, "Gamma planning", 2 * H, H, [member.id], "Quarterly budget");
    const cancelled = await make(page, project, "Delta vendor call", 2 * D);
    const ended = await make(page, project, "Epsilon kickoff", 3 * D);
    const live = await make(page, project, "Zeta live review", 1500);
    expect((await api(page, "POST", `/projects/${project.id}/meetings/${cancelled.id}/cancel`)).status).toBe(200);
    expect((await api(page, "POST", `/projects/${project.id}/meetings/${live.id}/start`)).status).toBe(200);
    expect((await api(page, "POST", `/projects/${project.id}/meetings/${ended.id}/start`)).status).toBe(200);
    expect((await api(page, "POST", `/projects/${project.id}/meetings/${ended.id}/end`)).status).toBe(200);

    await page.goto(listHref(project.slug));
    await expect(cards(page)).toHaveCount(6);
    // Real totals on the tabs; the same meeting never appears twice.
    for (const [name, count] of [[tr.all, 6], [tr.status.SCHEDULED, 3], [tr.status.OPEN, 1], [tr.status.ENDED, 1], [tr.status.CANCELLED, 1]] as const) await expect(tab(page, name)).toContainText(String(count));
    const titles = await cards(page).locator("h3").allTextContents(); expect(new Set(titles).size).toBe(titles.length);
    // Groups follow the viewer's calendar: live and today first, then tomorrow, later days; every card sits under one heading.
    await expect(page.getByRole("heading", { name: tr.group_today, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: tr.group_tomorrow, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: tr.group_later, exact: true })).toBeVisible();
    expect(await cards(page).first().locator("h3").innerText()).toContain("Zeta live review");

    // Per-status actions: live → Join (a document link to the room), everything else → Details.
    const card = (title: string) => cards(page).filter({ hasText: title });
    await expect(card("Zeta live review").getByRole("link", { name: tr.joinShort, exact: true })).toHaveAttribute("href", localizeHref(`/projects/${project.slug}/meetings/${live.id}/room`, "tr"));
    await expect(card("Zeta live review")).toHaveAttribute("data-status", "OPEN");
    for (const title of ["Alpha roadmap", "Delta vendor call", "Epsilon kickoff"]) {
      await expect(card(title).getByRole("link", { name: tr.details, exact: true })).toBeVisible();
      await expect(card(title).getByRole("link", { name: tr.joinShort, exact: true })).toHaveCount(0);
    }

    // Filter → URL; Back restores; reload keeps; an invalid value falls back to "all".
    await tab(page, tr.status.SCHEDULED).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("SCHEDULED");
    await expect(cards(page)).toHaveCount(3);
    await page.goBack(); await expect(cards(page)).toHaveCount(6); expect(new URL(page.url()).searchParams.get("status")).toBeNull();
    await page.goForward(); await expect(cards(page)).toHaveCount(3);
    await page.reload(); await expect(cards(page)).toHaveCount(3); await expect(tab(page, tr.status.SCHEDULED)).toHaveAttribute("aria-pressed", "true");
    await page.goto(listHref(project.slug, "?status=BOGUS&page=99&sort=nope")); await expect(cards(page)).toHaveCount(6);
    for (const status of ["OPEN", "ENDED", "CANCELLED"] as const) { await page.goto(listHref(project.slug, `?status=${status}`)); await expect(cards(page)).toHaveCount(1); await expect(cards(page).first()).toHaveAttribute("data-status", status); }

    // Search covers title, description and agenda items of every meeting, ignoring case; counts follow.
    await page.goto(listHref(project.slug));
    const search = page.getByRole("searchbox", { name: tr.searchMeetings, exact: true });
    await search.fill("RETRO"); await expect(cards(page)).toHaveCount(1); await expect(cards(page).first()).toContainText("Beta retrospective");
    await expect(tab(page, tr.all)).toContainText("1"); await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("RETRO");
    await search.fill("budget"); await expect(cards(page)).toHaveCount(1); await expect(cards(page).first()).toContainText("Gamma planning");
    await search.fill("zzz-no-match"); await expect(page.getByText(tr.noResults, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: tr.clearFilters, exact: true }).click(); await expect(cards(page)).toHaveCount(6); await expect(search).toHaveValue("");

    // Sort: newest puts the furthest start first, oldest the earliest.
    await page.getByRole("combobox", { name: tr.sortBy, exact: true }).click(); await page.getByRole("option", { name: tr.sort.newest, exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("sort")).toBe("newest");
    await expect(cards(page).first().locator("h3")).toHaveText("Alpha roadmap");
    await page.getByRole("combobox", { name: tr.sortBy, exact: true }).click(); await page.getByRole("option", { name: tr.sort.oldest, exact: true }).click();
    await expect(cards(page).first().locator("h3")).toHaveText("Zeta live review"); // oldest first: the group of today (with the live meeting) comes before the later days

    // Menu: managers see edit/cancel only where the status allows; cancelling asks first and updates the card in place.
    await page.goto(listHref(project.slug));
    await card("Alpha roadmap").getByRole("button", { name: tr.cardActions.replace("{title}", "Alpha roadmap") }).click();
    await expect(page.getByRole("menuitem", { name: tr.edit, exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: tr.copyMeetingLink, exact: true })).toBeVisible();
    await page.getByRole("menuitem", { name: tr.cancelMeeting, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: tr.confirm, exact: true }).click();
    await expect(card("Alpha roadmap")).toHaveAttribute("data-status", "CANCELLED");
    await card("Epsilon kickoff").getByRole("button", { name: tr.cardActions.replace("{title}", "Epsilon kickoff") }).click();
    await expect(page.getByRole("menuitem", { name: tr.viewDetails, exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: tr.cancelMeeting, exact: true })).toHaveCount(0); await expect(page.getByRole("menuitem", { name: tr.edit, exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // A plain member sees the same meetings but no edit/cancel/end actions (the backend stays the authority).
    await memberPage.goto(listHref(project.slug)); await expect(cards(memberPage)).toHaveCount(6);
    await cards(memberPage).filter({ hasText: "Gamma planning" }).getByRole("button", { name: tr.cardActions.replace("{title}", "Gamma planning") }).click();
    await expect(memberPage.getByRole("menuitem", { name: tr.viewDetails, exact: true })).toBeVisible();
    for (const name of [tr.edit, tr.cancelMeeting, tr.endForAll]) await expect(memberPage.getByRole("menuitem", { name, exact: true })).toHaveCount(0);
    await memberPage.keyboard.press("Escape");
    void soon; void tomorrow; void scheduledLater;

    // Phone: the tabs become the shared Select with the same filter state.
    await page.setViewportSize({ width: 375, height: 800 }); await page.goto(listHref(project.slug));
    await expect(page.getByRole("navigation", { name: tr.filter, exact: true })).toBeHidden();
    await page.getByRole("combobox", { name: tr.filter, exact: true }).click(); await page.getByRole("option", { name: new RegExp(`^${tr.status.OPEN}`) }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("OPEN"); await expect(cards(page)).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Accessibility of the list in both themes.
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(listHref(project.slug));
    await expect(cards(page)).toHaveCount(6);
    expect((await new AxeBuilder({ page }).include("#main-content").analyze()).violations).toEqual([]);
    await page.emulateMedia({ colorScheme: "dark" }); await page.evaluate(() => localStorage.setItem("theme", "dark")); await page.reload(); await expect(cards(page)).toHaveCount(6);
    expect((await new AxeBuilder({ page }).include("#main-content").analyze()).violations).toEqual([]);
  } finally { if (project) await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); await managerContext.close(); await memberContext.close(); }
});

test("list: pagination keeps groups honest and the page in the URL", async ({ page, context }) => {
  test.setTimeout(120000);
  await login(context, managerFile); const project = await createProject(page);
  try {
    for (let index = 0; index < 12; index++) await make(page, project, `Bulk ${String(index).padStart(2, "0")}`, (index + 1) * 3 * H);
    await page.goto(listHref(project.slug)); await expect(cards(page)).toHaveCount(10);
    await page.getByRole("button", { name: "Sonraki", exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("2"); await expect(cards(page)).toHaveCount(2);
    await page.goBack(); await expect(cards(page)).toHaveCount(10);
    await page.goto(listHref(project.slug, "?page=2")); await expect(cards(page)).toHaveCount(2);
    // A filter resets to the first page.
    await tab(page, tr.status.SCHEDULED).click(); await expect(cards(page)).toHaveCount(10); expect(new URL(page.url()).searchParams.get("page")).toBeNull();
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});

test("create form: agenda with Enter, participants search/count/organizer, inline time errors, real payload, start now", async ({ browser }) => {
  test.setTimeout(150000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, viewport: { width: 1440, height: 1000 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE });
  const page = await managerContext.newPage(), memberPage = await memberContext.newPage();
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(page); const member = await addMember(memberPage, project);
    await page.goto(localizeHref(`/projects/${project.slug}/meetings/new`, "tr"));
    await expect(page.locator("#meeting-title")).toBeVisible();
    // Required title: an inline message, no request.
    await page.locator('button[type="submit"][value="plan"]').click();
    await expect(page.getByText(tr.errTitleRequired, { exact: true })).toBeVisible();
    await page.locator("#meeting-title").fill("Form redesign check");
    // Agenda: Enter adds a focused next item, empty items are dropped, removal works.
    await page.getByLabel("Gündem maddesi 1", { exact: true }).fill("First point"); await page.keyboard.press("Enter");
    await expect(page.locator("#meeting-agenda-1")).toBeFocused(); await page.keyboard.type("Second point"); await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Gündem maddesi 3 kaldır", exact: true }).click();
    await expect(page.locator("#meeting-agenda-2")).toHaveCount(0);
    // Participants: organizer fixed and counted, case-insensitive search, selection count follows.
    const panel = page.locator("[data-meeting-form] aside").first();
    await expect(panel.getByText(tr.organizer, { exact: true })).toBeVisible();
    await expect(panel).toContainText("1 / 2");
    await panel.getByRole("searchbox", { name: tr.searchMembers, exact: true }).fill(member.nickname.toUpperCase());
    await expect(panel.getByRole("checkbox", { name: member.nickname, exact: true })).toBeVisible();
    await panel.getByRole("checkbox", { name: member.nickname, exact: true }).click(); await expect(panel).toContainText("2 / 2");
    // Real payload: what is stored is exactly what was chosen.
    await page.locator('button[type="submit"][value="plan"]').click();
    await expect(page.getByRole("heading", { name: "Form redesign check", exact: true })).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1)!;
    const stored = (await api(page, "GET", `/projects/${project.id}/meetings/${id}`)).json as Meeting;
    expect(stored.agenda).toEqual(["First point", "Second point"]); expect(stored.attendeeIds).toEqual([member.id]); expect(stored.status).toBe("SCHEDULED");
    // Start now: a real meeting that is really open (one create, then the start action).
    await page.goto(localizeHref(`/projects/${project.slug}/meetings/new`, "tr"));
    await page.locator("#meeting-title").fill("Started from the form");
    await page.getByRole("button", { name: tr.startNow, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Started from the form", exact: true })).toBeVisible();
    const list = (await api(page, "GET", `/projects/${project.id}/meetings?size=20&sort=startsAt,asc`)).json as { content: Meeting[] };
    const started = list.content.filter(m => m.title === "Started from the form"); expect(started).toHaveLength(1); expect(started[0].status).toBe("OPEN");
    // Responsive + accessibility (both themes).
    await page.goto(localizeHref(`/projects/${project.slug}/meetings/new`, "tr"));
    await expect(page.locator('button[type="submit"][value="plan"]')).toBeEnabled();
    expect((await new AxeBuilder({ page }).include("[data-meeting-form]").analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 320, height: 800 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('button[type="submit"][value="plan"]')).toBeVisible();
  } finally { if (project) await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); await managerContext.close(); await memberContext.close(); }
});

test("room: stage, strip, focus, grid, tabs, invite, copy link with two real participants", async ({ browser }) => {
  test.setTimeout(240000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone", "clipboard-read", "clipboard-write"], viewport: { width: 1440, height: 900 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1440, height: 900 } });
  const a = await managerContext.newPage(), b = await memberContext.newPage();
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(a); const member = await addMember(b, project);
    const meeting = await make(a, project, "Room redesign", 1000, 2 * H);
    expect((await api(a, "POST", `/projects/${project.id}/meetings/${meeting.id}/start`)).status).toBe(200);
    const roomUrl = localizeHref(`/projects/${project.slug}/meetings/${meeting.id}/room`, "tr");
    await a.goto(roomUrl); await b.goto(roomUrl);
    for (const page of [a, b]) { await page.getByRole("button", { name: tr.join, exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) })).toBeVisible({ timeout: 30000 }); }
    // The side panel is open on wide screens with the participants tab, count and both people.
    const aside = a.locator("[data-meeting-room] aside");
    await expect(aside.getByRole("tab", { name: /^Katılımcılar/, selected: true })).toBeVisible();
    await expect(aside.getByRole("tab", { name: /Katılımcılar \(2\)/ })).toBeVisible();
    await expect(aside.getByRole("listitem")).toHaveCount(2);
    await aside.getByRole("searchbox", { name: tr.searchParticipants, exact: true }).fill(member.nickname.toUpperCase());
    await expect(aside.getByRole("listitem")).toHaveCount(1);
    await aside.getByRole("searchbox", { name: tr.searchParticipants, exact: true }).fill("");
    await expect(aside.getByText(tr.organizer, { exact: true })).toBeVisible();
    // Stage + strip: the other person is on the stage, yourself in the strip; picking a strip card swaps them; auto-focus returns.
    const stage = a.locator("[data-room-stage]"), strip = a.locator("[data-room-strip]");
    await expect(stage).toBeVisible(); await expect(strip.getByRole("listitem")).toHaveCount(1);
    await expect(stage).toContainText(member.nickname);
    await strip.getByRole("button").first().click(); await expect(stage).toContainText("(Sen)");
    await a.getByRole("button", { name: tr.autoFocus, exact: true }).click(); await expect(stage).toContainText(member.nickname);
    // A shared screen takes the stage with its own aspect ratio; the sharer's name is under it.
    await b.getByRole("button", { name: tr.screen, exact: true }).click();
    await expect(stage).toHaveAttribute("data-stage-kind", "screen", { timeout: 15000 });
    await expect(stage).toContainText(tr.sharedScreenOf.replace("{name}", member.nickname));
    expect(await stage.locator("video").evaluate(element => getComputedStyle(element).objectFit)).toBe("contain");
    await b.getByRole("button", { name: tr.screenShareStop, exact: true }).click(); await expect(stage).toHaveAttribute("data-stage-kind", "camera", { timeout: 15000 });
    // Grid view and back; leaving the grid by picking a card returns to the stage on that card.
    await a.getByRole("button", { name: tr.gridView, exact: true }).first().click(); await expect(a.locator("[data-room-grid]")).toBeVisible();
    await a.locator("[data-room-grid]").getByRole("button").first().click(); await expect(stage).toBeVisible();
    // Tabs: chat is a tab of the same panel; the participants control closes/opens it.
    await aside.getByRole("tab", { name: /^Sohbet/ }).click(); await expect(a.getByRole("textbox", { name: tr.message, exact: true })).toBeVisible();
    await a.locator("[data-meeting-room]").getByRole("button", { name: tr.participants, exact: true }).click();
    await expect(aside.getByRole("tab", { name: /^Katılımcılar/, selected: true })).toBeVisible();
    await a.locator("[data-meeting-room]").getByRole("button", { name: tr.participants, exact: true }).click(); await expect(aside).toHaveCount(0);
    await showPanel(a, tr.participants);
    // Copy link: the meeting page of the project, from the header and from the panel.
    await a.getByRole("button", { name: tr.copyMeetingLink, exact: true }).first().click();
    expect(new URL(await a.evaluate(() => navigator.clipboard.readText())).pathname).toBe(localizeHref(`/projects/${project.slug}/meetings/${meeting.id}`, "tr"));
    // Invite: a real guest invite, the link is on the clipboard, only metadata is listed afterwards.
    await a.locator("[data-meeting-room] aside").getByRole("button", { name: tr.invitePeople, exact: true }).click();
    await a.getByRole("dialog").getByRole("button", { name: tr.createInvite, exact: true }).click();
    await expect(a.getByRole("dialog").getByRole("status")).toContainText(tr.inviteCopied);
    expect(new URL(await a.evaluate(() => navigator.clipboard.readText())).pathname).toBe(localizeHref("/meeting-guest", "tr"));
    const invites = (await api(a, "GET", `/projects/${project.id}/meetings/${meeting.id}/invites`)).json as { content: Record<string, unknown>[] };
    expect(invites.content).toHaveLength(1); expect(invites.content[0]).not.toHaveProperty("token");
    await a.getByRole("dialog").getByRole("button", { name: tr.done, exact: true }).click();
    // A plain member neither gets the invite button nor the end button, but keeps copy link and leave.
    await expect(b.locator("[data-meeting-room] aside").getByRole("button", { name: tr.invitePeople, exact: true })).toHaveCount(0);
    await expect(b.getByRole("button", { name: tr.endForAll, exact: true })).toHaveCount(0);
    await expect(b.getByRole("button", { name: tr.leave, exact: true })).toBeVisible();
    // Minimise: back to the detail page, the call keeps running (the mini bar shows).
    await b.getByRole("link", { name: tr.minimize, exact: true }).click(); await expect(b.locator("[data-meeting-mini]")).toBeVisible();
    // Accessibility of the call screen.
    expect((await new AxeBuilder({ page: a }).include("[data-meeting-room]").analyze()).violations).toEqual([]);
    expect((await api(a, "POST", `/projects/${project.id}/meetings/${meeting.id}/end`)).status).toBe(200);
  } finally { if (project) await api(a, "POST", `/projects/${project.id}/archive`).catch(() => {}); await managerContext.close(); await memberContext.close(); }
});

test("microphone capture: echo cancellation, noise suppression and gain are requested, and the noise setting really switches the open track", async ({ browser }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    const tracks: MediaStreamTrack[] = []; Object.assign(window, { qaTracks: tracks });
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => { const stream = await original(constraints); tracks.push(...stream.getAudioTracks()); return stream; };
  });
  const page = await context.newPage(); let project: Project | undefined;
  try {
    await login(context, managerFile); project = await createProject(page);
    const meeting = await make(page, project, "Noise check", 1000, 2 * H);
    expect((await api(page, "POST", `/projects/${project.id}/meetings/${meeting.id}/start`)).status).toBe(200);
    await page.goto(localizeHref(`/projects/${project.slug}/meetings/${meeting.id}/room`, "tr"));
    await page.getByRole("button", { name: tr.join, exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) })).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: tr.micOn, exact: true }).click();
    const settings = () => page.evaluate(() => (window as unknown as { qaTracks: MediaStreamTrack[] }).qaTracks.filter(track => track.readyState === "live").map(track => { const s = track.getSettings(); return [s.noiseSuppression, s.echoCancellation, s.autoGainControl]; }));
    await expect.poll(settings).toEqual([[true, true, true]]);
    await page.getByRole("button", { name: tr.devices, exact: true }).click();
    const box = page.getByRole("checkbox", { name: new RegExp(tr.noiseSuppression) }); await expect(box).toBeChecked();
    await box.click(); await expect.poll(settings).toEqual([[false, true, true]]);
    await box.click(); await expect.poll(settings).toEqual([[true, true, true]]);
    expect((await api(page, "POST", `/projects/${project.id}/meetings/${meeting.id}/end`)).status).toBe(200);
  } finally { if (project) await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); await context.close(); }
});
