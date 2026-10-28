import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { meetingAccount } from "./meeting-fixture";
import { REJECTED_STATE } from "./consent-state";
import { localizeHref } from "../src/i18n/routing";
import type { Project } from "../src/features/projects/types";
import type { Meeting } from "../src/features/meetings/types";
import tr from "../src/i18n/meetings/tr.json";
import en from "../src/i18n/meetings/en.json";
import de from "../src/i18n/meetings/de.json";
import { demoData, demoPage } from "../src/features/landing/demo/demo-data";
import landing from "../src/i18n/landing/tr.json";

// Accessibility of the hybrid meeting screens, against the real stack: the kind chooser, the project picker, both forms with the attendee search,
// Meetings (list, filters, card menu, confirmation dialog) and the sidebar. Automated only (axe WCAG A/AA in both themes, keyboard, focus, names,
// reflow, touch size): a screen reader (NVDA/VoiceOver/TalkBack) was NOT run, so announcements are judged from names, roles and live regions only.
// The accounts are throw-away ones (fresh), removed by the run's global teardown.
test.use({ storageState: REJECTED_STATE, trace: "off", video: "off" });
test.describe.configure({ mode: "serial" });
const base = "http://localhost:8080/api/v1", H = 3600_000;

async function login(context: BrowserContext, file: string) {
  const account = JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string };
  await context.request.get(`${base}/auth/csrf`);
  const csrf = (await context.cookies(base)).find(c => c.name === "XSRF-TOKEN")!;
  const result = await context.request.post(`${base}/auth/login`, { headers: { "X-XSRF-TOKEN": decodeURIComponent(csrf.value), Origin: "http://localhost:3000" }, data: { email: account.email, password: account.password } });
  expect(result.status()).toBe(200);
}
async function open(browser: Browser, role: "manager" | "member", viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ storageState: REJECTED_STATE, viewport });
  await login(context, meetingAccount(role, { fresh: true }));
  const page = await context.newPage(); await page.goto("/dashboard");
  return { context, page, me: (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string } };
}
const axe = async (page: Page, scope?: string) => {
  const builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]); if (scope) builder.include(scope);
  return (await builder.analyze()).violations.map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" | ")}`);
};
/** Axe in the light theme and then in the dark one, after checking that the dark one really is a different look (so the second run is not a repeat). */
async function bothThemes(page: Page, label: string, scope?: string) {
  await page.emulateMedia({ colorScheme: "light" });
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await axe(page, scope), `axe ${label} (light)`).toEqual([]);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor), `${label}: the dark theme is really applied`).not.toBe(light);
  expect(await axe(page, scope), `axe ${label} (dark)`).toEqual([]);
  await page.emulateMedia({ colorScheme: "light" });
}
const focusRing = (page: Page) => page.evaluate(() => { const node = document.activeElement as HTMLElement | null; if (!node || node === document.body) return false; const s = getComputedStyle(node); return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none"; });
const active = (page: Page) => page.evaluate(() => { const node = document.activeElement as HTMLElement | null; return node ? `${node.tagName.toLowerCase()}|${node.getAttribute("aria-label") ?? node.textContent?.trim().slice(0, 60) ?? ""}` : "none"; });
/** Presses Tab until `matches` holds for the focused element (or gives up), so the test follows the real tab order instead of guessing a count. */
async function tabTo(page: Page, matches: (description: string) => boolean, limit = 40) {
  for (let i = 0; i < limit; i++) { await page.keyboard.press("Tab"); if (matches(await active(page))) return; }
  throw new Error(`Tab never reached the element (last: ${await active(page)})`);
}
/** Popups fade and slide in: axe must see the settled state, or it measures the colours of a half-transparent element. */
const settled = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))).then(() => undefined));
const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test("desktop: every screen is accessible in both themes, and the whole create flow works with the keyboard alone", async ({ browser }) => {
  test.setTimeout(240000);
  const manager = await open(browser, "manager"), member = await open(browser, "member");
  let project: Project | undefined;
  try {
    const page = manager.page;
    project = (await api(page, "POST", "/projects", { name: `Hybrid QA ${Date.now()}`, projectTypes: ["WEB"] })).json as Project;
    psql(`WITH membership AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(project.id)}','${uuid(member.me.id)}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM membership`);
    const when = (offset: number) => ({ startsAt: new Date(Date.now() + offset).toISOString(), endsAt: new Date(Date.now() + offset + H).toISOString(), zoneId: "Europe/Istanbul", agenda: ["Review"], attendeeIds: [member.me.id] });
    const independent = (await api(page, "POST", "/meetings", { title: "A11y independent", description: "", ...when(3 * H), meetingType: "INDEPENDENT" })).json as Meeting;
    const projectMeeting = (await api(page, "POST", "/meetings", { title: "A11y project", description: "", ...when(5 * H), meetingType: "PROJECT", projectId: project.id })).json as Meeting;

    // ---- axe, light and dark, on every screen of the flow ----------------------------------------------------------------------
    for (const [label, href, ready] of [
      ["kind chooser", "/meetings/new", "[data-meeting-kind-choice]"],
      ["project picker", "/meetings/new?type=project", "[data-meeting-project-choice]"],
      ["project form", `/meetings/new?type=project&project=${project.id}`, "[data-project-members]"],
      ["independent form", "/meetings/new?type=independent", "#meeting-title"],
      ["my meetings", "/meetings", "[data-meeting-card]"],
      ["my meetings, project filter", "/meetings?type=project", "[data-meeting-card]"],
      ["meeting detail", `/meetings/${projectMeeting.id}`, "[data-meeting-kind-bar]"],
      ["meeting edit", `/meetings/${independent.id}/edit`, "#meeting-title"],
    ] as const) {
      await page.goto(localizeHref(href, "tr")); await expect(page.locator(ready).first()).toBeVisible();
      await bothThemes(page, label);
    }

    // ---- keyboard only: chooser → picker → form → search → add → remove → plan ---------------------------------------------------
    await page.goto(localizeHref("/meetings/new", "tr")); await expect(page.locator("[data-meeting-kind-choice]").first()).toBeVisible();
    await page.keyboard.press("Tab"); await expect.poll(() => active(page)).toContain("İçeriğe geç"); // the skip link is the first stop
    await tabTo(page, d => d.includes(tr.createProjectMeeting));
    expect(await focusRing(page), "the focused kind card shows where the focus is").toBe(true);
    await page.keyboard.press("Tab"); expect(await active(page)).toContain(tr.createIndependentMeeting);
    await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/[?]type=project$/);
    // The picker: each project is one link; Enter opens that project's form.
    // (The sidebar's selected-project card carries the same name, so the stop is recognised by being a picker choice, not by its text.)
    for (let i = 0; i < 40 && !(await page.evaluate(() => !!document.activeElement?.matches("[data-meeting-project-choice]"))); i++) await page.keyboard.press("Tab");
    await expect(page.locator(`[data-meeting-project-choice="${project.id}"]`)).toBeFocused();
    expect(await focusRing(page), "the focused project choice shows the focus").toBe(true); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`project=${project.id}$`));
    await expect(page.locator("#meeting-title")).toBeVisible();
    // The page names what it is: one h1, the kind, the project.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await page.locator("#meeting-title").focus(); await page.keyboard.type("Keyboard only");
    // Project members are offered, not added: the add button has a full name and works with Enter.
    const members = page.locator("[data-project-members]");
    const add = members.getByRole("button", { name: tr.addAttendee.replace("{name}", member.me.nickname), exact: true });
    await expect(add).toBeVisible(); await add.focus(); expect(await focusRing(page), "add button shows the focus").toBe(true);
    await page.keyboard.press("Enter");
    const picked = page.getByRole("list", { name: tr.selectedAttendees });
    await expect(picked.getByText(member.me.nickname)).toHaveCount(1);
    await expect(page.getByLabel(tr.participantCount.replace("{count}", "2"), { exact: true })).toBeVisible();
    // Where does the focus go once the person has left the list of suggestions? Never to nowhere: it must stay inside the page's controls.
    expect(await page.evaluate(() => document.activeElement && document.activeElement !== document.body), "focus is not lost after adding").toBe(true);
    const remove = picked.getByRole("button", { name: tr.removeAttendee.replace("{name}", member.me.nickname), exact: true });
    await remove.focus(); await page.keyboard.press("Space");
    await expect(picked.getByText(member.me.nickname)).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement && document.activeElement !== document.body), "focus is not lost after removing").toBe(true);
    // Re-add the member from the suggestions (Enter), then plan the project meeting with the Plan button, all with the keyboard.
    await expect(add).toBeVisible(); await add.focus(); await page.keyboard.press("Enter"); await expect(picked.getByText(member.me.nickname)).toHaveCount(1);
    await page.getByRole("button", { name: tr.plan, exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/toplantilar\/[0-9a-f-]{36}$/);
    // After submitting, the new page names itself (its heading is the meeting), not a vanished button.
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Keyboard only");

    // ---- the independent form and the global search: results are a labelled list of buttons, usable from the keyboard ----------------
    await page.goto(localizeHref("/meetings/new?type=independent", "tr")); await expect(page.locator("#meeting-title")).toBeVisible();
    await page.locator("#meeting-title").focus(); await page.keyboard.type("Keyboard only independent");
    const box = page.getByRole("searchbox", { name: tr.searchPeople }); await box.focus(); await page.keyboard.type(member.me.nickname);
    const results = page.getByRole("list", { name: tr.searchResults });
    const found = results.getByRole("button", { name: tr.addAttendee.replace("{name}", member.me.nickname), exact: true });
    await expect(found).toBeVisible();
    expect(await axe(page, "[data-meeting-form]"), "axe: the form with search results").toEqual([]);
    await page.keyboard.press("Tab"); await expect.poll(() => active(page)).toContain(tr.addAttendee.replace("{name}", member.me.nickname));
    expect(await focusRing(page), "the result shows the focus").toBe(true);
    await page.keyboard.press("Enter");
    const pickedIndependent = page.getByRole("list", { name: tr.selectedAttendees });
    await expect(pickedIndependent.getByText(member.me.nickname)).toHaveCount(1);
    // The suggestion list has gone with the person; the focus went to the search box, not nowhere.
    await expect(box).toBeFocused();
    await page.getByRole("button", { name: tr.plan, exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/toplantilar\/[0-9a-f-]{36}$/);

    // ---- the list: filters, the card menu and the confirmation dialog ---------------------------------------------------------------
    await page.goto(`${localizeHref("/meetings", "tr")}?q=A11y`);
    await expect(page.locator("[data-meeting-card]")).toHaveCount(2);
    const kind = page.getByRole("combobox", { name: tr.filterKind, exact: true });
    await kind.focus(); expect(await focusRing(page), "filter shows the focus").toBe(true);
    await page.keyboard.press("Enter"); const listbox = page.getByRole("listbox"); await expect(listbox).toBeVisible();
    await settled(page); expect(await axe(page, '[role="listbox"]'), "axe: the open filter").toEqual([]);
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter"); // the open list starts on "all", so one step is "project meetings"
    await expect(listbox).toBeHidden(); await expect(kind).toBeFocused(); // closing returns the focus to the control
    await expect(page).toHaveURL(/type=project/); await expect(page.locator("[data-meeting-card]")).toHaveCount(1);
    await kind.focus(); await page.keyboard.press("Enter"); await expect(listbox).toBeVisible(); await page.keyboard.press("Escape");
    await expect(listbox).toBeHidden(); await expect(kind).toBeFocused();
    await page.goto(`${localizeHref("/meetings", "tr")}?q=A11y`);
    const card = page.locator("[data-meeting-card]").filter({ hasText: "A11y independent" });
    const menu = card.getByRole("button", { name: tr.cardActions.replace("{title}", "A11y independent"), exact: true });
    await menu.focus(); await page.keyboard.press("Enter");
    const items = page.getByRole("menu"); await expect(items).toBeVisible();
    await settled(page); expect(await axe(page, '[role="menu"]'), "axe: the open card menu").toEqual([]);
    await page.keyboard.press("Escape"); await expect(items).toBeHidden(); await expect(menu).toBeFocused();
    await page.keyboard.press("Enter"); await page.getByRole("menuitem", { name: tr.cancelMeeting, exact: true }).click();
    const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog")); await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName(tr.cancelMeeting);
    await settled(page); expect(await axe(page, '[role="alertdialog"], [role="dialog"]'), "axe: the confirmation dialog").toEqual([]);
    // The library parks the focus on an invisible guard for an instant before it hands it to the next control, so the settled place is what counts.
    for (let i = 0; i < 8; i++) { await page.keyboard.press("Tab"); await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="alertdialog"], [role="dialog"]')), `Tab ${i + 1} stays inside the dialog`).toBe(true); }
    await page.keyboard.press("Escape"); await expect(dialog).toBeHidden();
    // Back where the person was working (the card's own menu button), not at the top of the page.
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[data-meeting-card]")), "focus returns to the card").toBe(true);
    expect((await api(page, "GET", `/meetings/${independent.id}`)).json).toMatchObject({ status: "SCHEDULED" }); // Escape did not cancel anything
  } finally {
    if (project) await api(manager.page, "POST", `/projects/${project.id}/archive`).catch(() => {});
    await manager.context.close(); await member.context.close();
  }
});

test("phone and small screens: nothing overflows, touch targets are thumb-sized, the drawer and the forms stay accessible in both themes", async ({ browser }) => {
  test.setTimeout(180000);
  const phone = await open(browser, "manager", { width: 390, height: 844 });
  let project: Project | undefined;
  try {
    const page = phone.page;
    project = (await api(page, "POST", "/projects", { name: `Hybrid phone ${Date.now()}`, projectTypes: ["WEB"] })).json as Project;
    await api(page, "POST", "/meetings", { title: "A11y phone meeting", description: "", startsAt: new Date(Date.now() + 3 * H).toISOString(), endsAt: new Date(Date.now() + 4 * H).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [], meetingType: "PROJECT", projectId: project.id });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      for (const [label, href, ready] of [
        ["chooser", "/meetings/new", "[data-meeting-kind-choice]"],
        ["picker", "/meetings/new?type=project", "[data-meeting-project-choice]"],
        ["project form", `/meetings/new?type=project&project=${project.id}`, "#meeting-title"],
        ["independent form", "/meetings/new?type=independent", "#meeting-title"],
        ["list", "/meetings?q=A11y", "[data-meeting-card]"],
      ] as const) {
        await page.goto(localizeHref(href, "tr")); await expect(page.locator(ready).first()).toBeVisible();
        expect(await noSideways(page), `${label} at ${width}px does not scroll sideways`).toBe(true);
        // Everything meant to be tapped is at least 40 px high (44 on the primary actions): links and buttons of the main content.
        const small = await page.locator("main a:visible, main button:visible").evaluateAll(nodes => nodes
          .filter(node => !node.closest("[data-workspace-scroll] li > div") && !node.closest('nav[aria-label="Sayfalama"]')).map(node => { const r = node.getBoundingClientRect(); return { name: (node.getAttribute("aria-label") ?? node.textContent ?? "").trim().slice(0, 40), h: Math.round(r.height), w: Math.round(r.width) }; })
          .filter(item => item.h < 36 && item.w < 36));
        expect(small, `${label} at ${width}px: controls smaller than 36 px both ways`).toEqual([]);
        // The page buttons belong to the shared pagination bar (used by every list of the app): they are held to the WCAG 2.2 AA minimum of 24 px.
        const tiny = await page.locator('nav[aria-label="Sayfalama"] button:visible').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect()).filter(r => r.width < 24 || r.height < 24).length);
        expect(tiny, `${label} at ${width}px: pagination buttons under 24 px`).toBe(0);
        if (width !== 768) await bothThemes(page, `${label} at ${width}px`);
      }
    }
    // The drawer: opens by button, is a labelled region the focus moves into, its Meetings group is reachable, Escape returns to the button.
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(localizeHref("/meetings", "tr"));
    const hamburger = page.locator('button[aria-controls="workspace-mobile-navigation"]');
    await hamburger.focus(); await page.keyboard.press("Enter"); const drawer = page.locator("#workspace-mobile-navigation"); await expect(drawer).toBeVisible();
    await expect(hamburger).toHaveAttribute("aria-expanded", "true");
    expect(await axe(page, "#workspace-mobile-navigation"), "axe: the open drawer").toEqual([]);
    await page.emulateMedia({ colorScheme: "dark" }); expect(await axe(page, "#workspace-mobile-navigation"), "axe: the open drawer (dark)").toEqual([]); await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("#workspace-mobile-navigation")), "focus moves into the drawer").toBe(true);
    await page.keyboard.press("Escape"); await expect(drawer).toBeHidden(); await expect(hamburger).toBeFocused();
  } finally {
    if (project) await api(phone.page, "POST", `/projects/${project.id}/archive`).catch(() => {});
    await phone.context.close();
  }
});

// What the real NVDA runs (e2e/sr) found, pinned here so it is checked on every run without a screen reader: names that do not run two phrases into one
// word, a spoken confirmation after every change the keyboard makes, focus that stays where it was, and a chat that announces a message once.
test("what a screen reader needs: separated names, spoken confirmations, kept focus, one announcement per chat message", async ({ browser }) => {
  test.setTimeout(240000);
  const owner = await open(browser, "manager"), guest = await open(browser, "member");
  try {
    const page = owner.page, other = guest.page;
    // Names: the title and the sentence of a card are two phrases, not one word.
    await page.goto(localizeHref("/meetings/new", "tr"));
    const card = page.locator('[data-meeting-kind-choice="project"]');
    expect(await card.evaluate(node => node.textContent), "the card's own text separates its title from its sentence").toMatch(/Oluştur\.\s*Projelerinizden/);
    // Attendee search: a spoken confirmation for adding and removing, and the number of results.
    await page.goto(localizeHref("/meetings/new?type=independent", "tr"));
    await page.getByRole("searchbox", { name: tr.searchPeople }).fill(guest.me.nickname);
    await expect(page.getByRole("status").filter({ hasText: tr.peopleFound.replace("{count, plural, one {# kişi bulundu.} other {# kişi bulundu.}}", "1 kişi bulundu.") }).or(page.locator("p.sr-only").filter({ hasText: "1 kişi bulundu." }))).toHaveCount(1);
    await page.getByRole("button", { name: tr.addAttendee.replace("{name}", guest.me.nickname), exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: tr.attendeeAdded.replace("{name}", guest.me.nickname) })).toHaveCount(1);
    await expect(page.getByText(tr.noPeopleFound), "adding the only match is not reported as 'nobody found'").toHaveCount(0);
    await page.getByRole("button", { name: tr.removeAttendee.replace("{name}", guest.me.nickname), exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: tr.attendeeRemoved.replace("{name}", guest.me.nickname) })).toHaveCount(1);
    // The room: switching the microphone keeps the focus on the same button and says what happened; a chat message is announced once.
    const meeting = (await api(page, "POST", "/meetings", { title: "A11y room", description: "", startsAt: new Date(Date.now() + 60_000).toISOString(), endsAt: new Date(Date.now() + H).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [guest.me.id], meetingType: "INDEPENDENT" })).json as Meeting;
    expect((await api(page, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
    const room = localizeHref(`/meetings/${meeting.id}/room`, "tr"), connected = (p: Page) => p.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) });
    for (const person of [other, page]) { await person.goto(room); await person.getByRole("button", { name: tr.join, exact: true }).click(); await expect(connected(person)).toBeVisible({ timeout: 30000 }); }
    const controls = page.locator("[data-room-controls]");
    await controls.getByRole("button", { name: tr.micOn, exact: true }).focus(); await page.keyboard.press("Space");
    await expect(controls.getByRole("status").filter({ hasText: tr.micIsOn })).toHaveCount(1);
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "the focus stays on the pressed button").toBe(tr.micOff);
    await controls.getByRole("button", { name: tr.chat, exact: true }).click();
    const log = page.getByRole("log", { name: tr.chat });
    await expect(log, "the log is not itself live (its buttons would be read out with every message)").toHaveAttribute("aria-live", "off");
    expect((await api(other, "POST", `/meetings/${meeting.id}/chat`, { content: "Hello there", mentionIds: [] })).status).toBe(201);
    await expect(page.getByRole("status").filter({ hasText: `${guest.me.nickname}: Hello there` })).toHaveCount(1, { timeout: 15000 });
  } finally { await owner.context.close(); await guest.context.close(); }
});

// TEST-ONLY browser fixture: every API request and socket is intercepted. No account,
// database preparation/cleanup or real backend request is needed for this regression.
test.describe("isolated attendee search", () => {
  test.use({ serviceWorkers: "block", storageState: REJECTED_STATE });
  for (const locale of ["tr", "en", "de"] as const) {
    for (const kind of ["independent", "project"] as const) {
      test(`${locale}: ${kind} form keeps a distinct name and hint, keyboard selection and announcements`, async ({ page, context, baseURL }) => {
        const t = { tr, en, de }[locale], origin = new URL(baseURL!).origin;
        const seed = demoData(landing);
        const people = [
          { userId: "00000000-0000-0000-0000-000000000002", nickname: "Search Alpha", profilePhotoVersion: null },
          { userId: "00000000-0000-0000-0000-000000000003", nickname: "Search Beta", profilePhotoVersion: null },
        ];
        const unexpected: string[] = [];
        const failures: string[] = [];
        page.on("pageerror", error => failures.push(error.message));
        await context.addCookies([{ name: "PDA_SESSION", value: "1", url: origin }, { name: "NEXT_LOCALE", value: locale, url: origin }]);
        await page.routeWebSocket(/\/api\/v1\/ws$/, socket => socket.onMessage(message => {
          if (String(message).startsWith("CONNECT")) socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0");
        }));
        await page.route("**/api/v1/**", async route => {
          const request = route.request(), url = new URL(request.url());
          const headers = { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" };
          if (request.method() === "OPTIONS" || url.pathname.endsWith("/team-deletions/claim")) return route.fulfill({ status: 204, headers });
          if (request.method() !== "GET") unexpected.push(`${request.method()} ${url.pathname}`);
          const body = url.pathname.endsWith("/auth/me") ? { id: "00000000-0000-0000-0000-000000000001", nickname: "Search organizer", email: "search@example.test", globalRole: "USER", mustChangePassword: false }
            : url.pathname.endsWith("/users/me/preferences") ? { locale, theme: "system", motion: "off", themeTransition: false }
            : url.pathname.endsWith("/attendees/search") ? people.filter(person => person.nickname.toLowerCase().includes((url.searchParams.get("q") ?? "").toLowerCase()))
            : url.pathname.endsWith("/auth/csrf") ? { headerName: "X-XSRF-TOKEN" }
            : url.pathname.endsWith("/chat/conversations") ? { group: null, groups: [], directs: [], totalUnread: 0 }
            : url.pathname.endsWith("/members") ? demoPage([])
            : url.pathname === "/api/v1/projects" ? demoPage([seed.project])
            : /count$/.test(url.pathname) ? { count: 0 }
            : { content: [], totalElements: 0, totalPages: 0, counts: {} };
          await route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(body) });
        });
        const href = `/meetings/new?type=${kind}${kind === "project" ? `&project=${seed.project.id}` : ""}`;
        await page.goto(localizeHref(href, locale));
        const box = page.getByRole("searchbox", { name: t.searchPeople, exact: true });
        await expect(box).toBeVisible();
        const hint = t.searchPeopleHint.replace("{min}", "3");
        await expect(box).toHaveAccessibleName(t.searchPeople);
        await expect(box).toHaveAttribute("placeholder", hint);
        // Exercise client navigation/RSC as well as the direct URL above. The
        // proxy must retain locale, type and project through its internal rewrite.
        await expect(page.getByRole("link", { name: t.changeKind, exact: true })).toHaveCount(0);
        if (kind === "project") {
          await page.getByRole("link", { name: t.changeProject, exact: true }).click();
          await expect(page.getByRole("heading", { name: t.chooseProject, exact: true })).toBeVisible();
          await expect(page.getByRole("link", { name: t.changeKind, exact: true })).toHaveCount(0);
        }
        await page.getByRole("group", { name: t.group, exact: true }).getByRole("link", { name: t.create, exact: true }).click();
        await expect(page.locator(`[data-meeting-kind-choice="${kind}"]`)).toBeVisible();
        await page.locator(`[data-meeting-kind-choice="${kind}"]`).click();
        if (kind === "project") {
          await page.locator(`[data-meeting-project-choice="${seed.project.id}"]`).click();
        }
        await expect(box).toBeVisible();
        await expect(page).toHaveURL(new URL(localizeHref(href, locale), origin).href);
        // The old project URL is a real compatibility page, not an API fixture.
        await page.goto(localizeHref("/projects/old/meetings/new", locale));
        await expect(page).toHaveURL(new URL(localizeHref("/meetings/new", locale), origin).href);
        await page.locator(`[data-meeting-kind-choice="${kind}"]`).click();
        if (kind === "project") await page.locator(`[data-meeting-project-choice="${seed.project.id}"]`).click();
        await expect(box).toBeVisible();
        await expect(page).toHaveURL(new URL(localizeHref(href, locale), origin).href);
        expect(hint).not.toBe(t.searchPeople);
        await expect(box).toHaveAttribute("type", "search");
        await page.locator("#meeting-title").focus();
        for (let i = 0; i < 70 && !(await box.evaluate(node => node === document.activeElement)); i++) await page.keyboard.press("Tab");
        await expect(box).toBeFocused();
        expect(await focusRing(page)).toBe(true);
        await page.keyboard.type("Search");
        const results = page.getByRole("list", { name: t.searchResults });
        const add = (name: string) => results.getByRole("button", { name: t.addAttendee.replace("{name}", name), exact: true });
        await expect(results.getByRole("button")).toHaveCount(2);
        const countText = t.peopleFound.match(/other \{([^}]+)\}/)![1].replace("#", "2");
        await expect(page.locator('[data-meeting-form] [aria-live="polite"]').filter({ hasText: countText })).toHaveCount(1);
        for (const theme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme: theme });
          await expect.poll(() => page.locator("html").evaluate(node => node.classList.contains("dark"))).toBe(theme === "dark");
          expect(await axe(page, "[data-meeting-form]")).toEqual([]);
        }
        await page.emulateMedia({ colorScheme: "light" });
        await page.keyboard.press("Tab"); await expect(add(people[0].nickname)).toBeFocused();
        await page.keyboard.press("Enter");
        const picked = page.getByRole("list", { name: t.selectedAttendees });
        await expect(picked.getByText(people[0].nickname, { exact: true })).toBeVisible();
        await expect(add(people[1].nickname)).toBeFocused();
        await expect(page.getByRole("status").filter({ hasText: t.attendeeAdded.replace("{name}", people[0].nickname) })).toHaveCount(1);
        await page.keyboard.press("Space");
        await expect(box).toBeFocused();
        await expect(page.getByText(t.allMatchesAdded, { exact: true })).toBeVisible();
        await expect(page.getByText(t.noPeopleFound, { exact: true })).toHaveCount(0);
        for (const person of people) {
          const remove = picked.getByRole("button", { name: t.removeAttendee.replace("{name}", person.nickname), exact: true });
          await remove.focus(); await page.keyboard.press("Enter");
          await expect(picked.getByText(person.nickname, { exact: true })).toHaveCount(0);
          await expect(page.getByRole("status").filter({ hasText: t.attendeeRemoved.replace("{name}", person.nickname) })).toHaveCount(1);
          if (person === people[0]) await expect(picked.getByRole("button").first()).toBeFocused();
        }
        await expect(box).toBeFocused();
        await box.fill("NoSuchPerson");
        await expect(page.getByText(t.noPeopleFound, { exact: true })).toBeVisible();
        await expect(results).toHaveCount(0);
        await expect(box).toBeFocused();
        await box.fill("");
        await expect(page.getByText(hint, { exact: true })).toBeVisible();
        await expect(box).toHaveAccessibleName(t.searchPeople);
        await expect(box).toHaveAttribute("placeholder", hint);
        if (locale === "tr" && kind === "independent") {
          await page.screenshot({ path: test.info().outputPath("search-desktop.png"), fullPage: true });
          await page.setViewportSize({ width: 320, height: 844 });
          await expect(box).toBeVisible();
          expect(await noSideways(page)).toBe(true);
          await page.screenshot({ path: test.info().outputPath("search-mobile.png"), fullPage: true });
        }
        expect(unexpected, "selection must not send mutation requests").toEqual([]);
        expect(failures).toEqual([]);
      });
    }
  }
});
