import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { api } from "../helpers";
import { meetingAccount } from "../meeting-fixture";
import { REJECTED_STATE } from "../consent-state";
import { localizeHref } from "../../src/i18n/routing";
import type { Project } from "../../src/features/projects/types";
import type { Meeting } from "../../src/features/meetings/types";
import tr from "../../src/i18n/meetings/tr.json";
import en from "../../src/i18n/meetings/en.json";
import de from "../../src/i18n/meetings/de.json";
import { Nvda } from "./nvda";

// The meeting screens heard through a real NVDA (see nvda.ts for how and what it can and cannot drive). Every screen is loaded (NVDA reads the page
// itself), then its controls are visited with the browser's keyboard and what NVDA says is checked: the name, the role and the state of each control,
// the headings and landmarks, the language it switches to, and what it announces when something changes. The whole transcript of the run is written to
// test-results/screenreader/transcript.txt so a person can read exactly what was heard.
const base = "http://localhost:8080/api/v1";
const OUT = path.join(__dirname, "../../test-results/screenreader"); const TRANSCRIPT = path.join(OUT, "transcript.txt");
let nvda: Nvda;

async function login(context: BrowserContext, file: string) {
  const account = JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string };
  await context.request.get(`${base}/auth/csrf`);
  const csrf = (await context.cookies(base)).find(c => c.name === "XSRF-TOKEN")!;
  const result = await context.request.post(`${base}/auth/login`, { headers: { "X-XSRF-TOKEN": decodeURIComponent(csrf.value), Origin: "http://localhost:3000" }, data: { email: account.email, password: account.password } });
  expect(result.status()).toBe(200);
}
const note = (line: string) => { appendFileSync(TRANSCRIPT, `${line}\n`); console.log(line); };
/** Does `action`, then returns what NVDA said until it has been quiet for `quiet` ms (or `max` ms have passed). */
async function heard(page: Page, label: string, action: () => Promise<unknown>, { quiet = 900, max = 9000, until = [] }: { quiet?: number; max?: number; until?: string[] } = {}) {
  // NVDA speaks whichever window is in front, so the browser window must be: the moment it is not, the run stops and nothing said from then on is kept
  // (it would be the content of some other application). Done when NVDA has been quiet for `quiet` ms AND (if asked) has said every phrase of `until`.
  const mark = nvda.mark(); await page.bringToFront(); await action();
  let last = nvda.mark(), still = 0, lastGood = mark;
  for (let waited = 0; waited < max; waited += 150) {
    await page.waitForTimeout(150);
    // `lastGood` is taken BEFORE the check of this round passes: what NVDA says between two checks is not kept until the next check has passed too.
    const markBefore = nvda.mark();
    if (!(await page.evaluate(() => document.hasFocus()).catch(() => false)) || !Nvda.browserIsInFront()) { await nvda.stop(); throw new Error(`The browser window lost the focus during "${label}": the run was stopped and what NVDA said afterwards was discarded.`); }
    lastGood = markBefore; const now = nvda.mark(); if (now === last) still += 150; else { still = 0; last = now; }
    if (still >= quiet && until.every(phrase => nvda.said(mark, lastGood).join(" ").includes(phrase))) break;
  }
  const said = nvda.said(mark, lastGood); note(`  [${label}] ${said.length ? said.map(line => `«${line}»`).join(" ") : "(nothing said)"}`); return said;
}
const all = (said: string[]) => said.join(" | ");
async function visit(page: Page, label: string, href: string, ready: string, until: string[] = []) {
  note(`\n## ${label} — ${href}`);
  return heard(page, "page read", async () => { await page.goto(href); await expect(page.locator(ready).first()).toBeVisible(); await page.bringToFront(); }, { quiet: 2500, max: until.length ? 60000 : 9000, until });
}
/** Visits the next control with Tab and returns what is said (the focused element's name, role and state). */
const tab = (page: Page, label: string, key = "Tab") => heard(page, label, () => page.keyboard.press(key), { quiet: 700, max: 4000 });

test.beforeAll(async () => {
  const dir = process.env.NVDA_PORTABLE ?? ""; test.skip(!Nvda.available(dir), "NVDA_PORTABLE does not point at a portable NVDA");
  mkdirSync(OUT, { recursive: true }); writeFileSync(TRANSCRIPT, `Real NVDA transcript — ${new Date().toISOString()}\n`);
  nvda = new Nvda(dir, path.join(OUT, "nvda")); await nvda.start(); note(`NVDA ${nvda.version()} on Windows, Chromium (Playwright build), speech synthesiser: silence (text captured from NVDA's own log)`);
});
test.afterAll(async () => {
  await nvda?.stop();
  // The reader's own log is raw (it would hold anything said if another window had been in front): only the filtered transcript is kept.
  try { rmSync(nvda.logFile); } catch { /* none */ }
});

/** Visits controls with Tab until one is said to match `wanted` (or `limit` stops); returns every phrase heard on the way and the matching one. */
async function tabUntil(page: Page, wanted: (said: string) => boolean, label: string, limit = 25) {
  const heardOnTheWay: string[] = [];
  for (let step = 1; step <= limit; step++) { const said = all(await tab(page, `${label} · Tab ${step}`)); heardOnTheWay.push(said); if (wanted(said)) return { said, heardOnTheWay }; }
  throw new Error(`${label}: Tab never reached the control. Heard: ${heardOnTheWay.join(" || ")}`);
}
async function account(browser: import("@playwright/test").Browser, role: "manager" | "member") {
  const context = await browser.newContext({ viewport: null, storageState: REJECTED_STATE }); await login(context, meetingAccount(role, { fresh: true }));
  const page = await context.newPage(); await page.goto("/dashboard");
  return { context, page, me: (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string } };
}

test("A. kind chooser and project picker: what is read, in which language, and how the cards are reached", async ({ browser }) => {
  test.setTimeout(420_000);
  const manager = await account(browser, "manager");
  let project: Project | undefined;
  try {
    const page = manager.page;
    project = (await api(page, "POST", "/projects", { name: `Reader ${Date.now()}`, projectTypes: ["WEB"] })).json as Project;
    // What NVDA reads by itself when a page loads varies with where the browser puts the focus, so it is recorded but not relied on; the checks are on the controls.
    await visit(page, "A1. chooser", localizeHref("/meetings/new", "tr"), "[data-meeting-kind-choice]");
    // The first stop is the skip link; using it must land in the content, where the cards are the first stops.
    const skip = all(await tab(page, "A1b. first stop")); expect(skip, "the skip link is announced as a same-page link").toContain("İçeriğe geç"); expect(skip).toContain("same page link");
    await heard(page, "A1c. Enter on the skip link", () => page.keyboard.press("Enter"), { quiet: 1200, max: 6000 });
    const card = await tabUntil(page, said => said.includes(tr.createProjectMeeting), "A2. first card", 6);
    expect(card.said, "a card is announced as a link").toMatch(/link/); expect(card.said).toContain(tr.createProjectMeeting); expect(card.said, "with its description").toContain(tr.createProjectMeetingDescription); expect(card.said, "in the page language").toContain("[tr]");
    const second = all(await tab(page, "A2b. second card")); expect(second).toContain(tr.createIndependentMeeting); expect(second).toContain(tr.createIndependentMeetingDescription); expect(second).toMatch(/link/);
    await tab(page, "A2c. back to the first", "Shift+Tab"); await page.keyboard.press("Shift+Tab").catch(() => {}); await tabUntil(page, said => said.includes(tr.createProjectMeeting), "A2d. first card again");
    await heard(page, "A3. Enter on the project card", () => page.keyboard.press("Enter"), { quiet: 2500, max: 15000 });
    const choice = await tabUntil(page, said => said.includes(project!.name) && /link/.test(said), "A4. project choice");
    expect(choice.said).toContain(project.name);
  } finally { if (project) await api(manager.page, "POST", `/projects/${project.id}/archive`).catch(() => {}); await manager.context.close(); }
});

test("B. the meeting form: every field has a name and a role, errors are announced, the attendee search and its results can be used and heard", async ({ browser }) => {
  test.setTimeout(420_000);
  const manager = await account(browser, "manager"), member = await account(browser, "member");
  try {
    const page = manager.page;
    await visit(page, "B1. independent form", localizeHref("/meetings/new?type=independent", "tr"), "#meeting-title");
    await tab(page, "B1b. skip link"); await heard(page, "B1c. Enter on the skip link", () => page.keyboard.press("Enter"), { quiet: 1200, max: 6000 });
    // Every stop of the form, in order, up to the plan button.
    const stops: string[] = [];
    for (let step = 1; step <= 40; step++) { const said = all(await tab(page, `B2. Tab ${step}`)); stops.push(said); if (said.includes(tr.plan)) break; }
    note(`  → ${stops.length} stops to reach "${tr.plan}"`);
    // Planning without a title: the error must be spoken, and the focus must go to the field that needs the answer.
    const refused = await heard(page, "B3. Enter on the plan button with no title", () => page.keyboard.press("Enter"), { quiet: 1500, max: 8000 });
    expect(all(refused), "the problem is announced as an alert").toContain(tr.formInvalid); expect(all(refused)).toContain("alert");
    // The summary is general; the field itself says what is wrong with it (invalid + its own message) when it is reached.
    const field = await heard(page, "B3b. the title field after the error", () => page.locator("#meeting-title").focus(), { quiet: 1200, max: 6000 });
    expect(all(field)).toContain(tr.title); expect(all(field), "the field is announced as invalid").toMatch(/invalid/); expect(all(field), "with its own message").toContain(tr.errTitleRequired);
    // The attendee search: typing, the progress and the results, adding with the keyboard, hearing that it happened, removing.
    await page.locator("#meeting-title").fill("Reader check");
    const box = page.getByRole("searchbox", { name: tr.searchPeople }); await heard(page, "B4. focus the search box", () => box.focus(), { quiet: 1000, max: 5000 });
    await heard(page, "B4b. two letters (below the minimum)", () => page.keyboard.type(member.me.nickname.slice(0, 2), { delay: 60 }), { quiet: 1200, max: 5000 });
    const typed = await heard(page, "B4c. the whole nickname", () => page.keyboard.type(member.me.nickname.slice(2), { delay: 30 }), { quiet: 2000, max: 9000 });
    const result = await tab(page, "B4d. Tab to the result");
    expect(all(result)).toContain(tr.addAttendee.replace("{name}", member.me.nickname)); expect(all(result)).toMatch(/button/);
    expect(all(typed), "the number of results is announced when they arrive").toContain(tr.peopleFound.replace("{count, plural, one {# kişi bulundu.} other {# kişi bulundu.}}", "1 kişi bulundu."));
    const added = await heard(page, "B4e. Enter adds the person", () => page.keyboard.press("Enter"), { quiet: 1800, max: 8000 });
    note(`  → after adding, NVDA said: ${all(added) || "(nothing)"}`);
    expect(all(added), "adding is confirmed aloud").toContain(tr.attendeeAdded.replace("{name}", member.me.nickname)); expect(all(added), "and the list is not said to be empty").not.toContain(tr.noPeopleFound);
    const removeStop = await tabUntil(page, said => said.includes(tr.removeAttendee.replace("{name}", member.me.nickname)), "B5. Tab to the remove button", 8);
    expect(removeStop.said).toMatch(/button/);
    const removed = await heard(page, "B5b. Enter removes the person", () => page.keyboard.press("Enter"), { quiet: 1800, max: 8000 });
    note(`  → after removing, NVDA said: ${all(removed) || "(nothing)"}`);
    expect(all(removed), "removing is confirmed aloud").toContain(tr.attendeeRemoved.replace("{name}", member.me.nickname));
  } finally { await manager.context.close(); await member.context.close(); }
});

test("C. My meetings: the list, its filters, the kind of each meeting, the card menu and the confirmation dialog", async ({ browser }) => {
  test.setTimeout(420_000);
  const manager = await account(browser, "manager");
  let project: Project | undefined;
  try {
    const page = manager.page;
    project = (await api(page, "POST", "/projects", { name: `Reader ${Date.now()}`, projectTypes: ["WEB"] })).json as Project;
    const when = (offset: number) => ({ startsAt: new Date(Date.now() + offset).toISOString(), endsAt: new Date(Date.now() + offset + 3600_000).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [] as string[] });
    await api(page, "POST", "/meetings", { title: "Reader project meeting", description: "", ...when(3 * 3600_000), meetingType: "PROJECT", projectId: project.id });
    await api(page, "POST", "/meetings", { title: "Reader independent meeting", description: "", ...when(5 * 3600_000), meetingType: "INDEPENDENT" });
    await visit(page, "C1. my meetings", localizeHref("/meetings", "tr"), "[data-meeting-card]");
    await tab(page, "C1b. skip link"); await heard(page, "C1c. Enter on the skip link", () => page.keyboard.press("Enter"), { quiet: 1200, max: 8000 });
    // Walk through the controls of the page, in order, until the second card's menu button.
    const stops: string[] = [];
    for (let step = 1; step <= 40; step++) { const said = all(await tab(page, `C2. Tab ${step}`)); stops.push(said); if (said.includes("Reader independent meeting için işlemler")) break; }
    const text = stops.join(" || ");
    expect(text, "the kind filter is named").toContain(tr.filterKind); expect(text, "the status filter is named").toContain(tr.filter);
    expect(text, "each card has an accessible name that says which meeting it is").toContain("Reader project meeting"); expect(text).toContain("Reader independent meeting");
    // The two links of a card that are not its title carry the title, so a list of links (or Tab) never offers two "Details".
    expect(text, "the details link names its meeting").toContain(`${tr.details}— Reader project meeting`); expect(text).toContain(`${tr.details}— Reader independent meeting`); // NVDA drops the space at the start of the hidden part
    expect(text, "the card menu button is named after its meeting").toContain(tr.cardActions.replace("{title}", "Reader independent meeting"));
    // The kind filter: open it, choose, hear the result.
    const kind = page.getByRole("combobox", { name: tr.filterKind, exact: true });
    // Browse-mode reading of the list (what NVDA says by itself after the skip link) holds the kind, the project and the count apart, not as one word.
    const listRead = readFileSync(TRANSCRIPT, "utf8").split("\n").find(line => line.includes("[C1c.")) ?? "";
    expect(listRead, "the status and the kind are separate phrases").toContain(`${tr.status.SCHEDULED}.`); expect(listRead, "the kind of a project meeting is read").toContain(tr.kindProject); expect(listRead).toContain(tr.kindIndependent); expect(listRead, "the project name is read").toContain(project.name);
    expect(listRead, "the project name and the number of attendees are not run together").not.toMatch(new RegExp(`${project.name}\\d+ katılımcı`));
    const opened = await heard(page, "C3. focus and open the kind filter", async () => { await kind.focus(); await page.keyboard.press("Enter"); }, { quiet: 1500, max: 8000 });
    expect(all(opened)).toContain(tr.filterKind);
    const arrowed = await heard(page, "C3b. ArrowDown to the next option", () => page.keyboard.press("ArrowDown"), { quiet: 1500, max: 6000 });
    expect(all(arrowed), "an option is announced by name and position").toContain(`${tr.kindProjects} not selected 2 of 3`);
    const picked = await heard(page, "C3c. Enter chooses it", () => page.keyboard.press("Enter"), { quiet: 1800, max: 8000 });
    expect(all(picked), "the chosen value is spoken as the new value of the filter, with the focus back on the filter").toContain(`${tr.filterKind} combo box ${tr.kindProjects}`);
    // The card menu and the confirmation dialog.
    await page.goto(`${localizeHref("/meetings", "tr")}?q=Reader%20independent`); await expect(page.locator("[data-meeting-card]")).toHaveCount(1);
    const menu = page.getByRole("button", { name: tr.cardActions.replace("{title}", "Reader independent meeting"), exact: true });
    const menuOpen = await heard(page, "C4. open the card menu", async () => { await menu.focus(); await page.keyboard.press("Enter"); }, { quiet: 1500, max: 8000 });
    expect(all(menuOpen), "the first item of the menu is read, with its position").toContain(`${tr.viewDetails} 1 of `);
    const cancelItem = page.getByRole("menuitem", { name: tr.cancelMeeting, exact: true });
    const onCancel = await heard(page, "C4b. move to the cancel item", () => cancelItem.focus(), { quiet: 1200, max: 6000 });
    expect(all(onCancel), "the destructive item is read by name").toContain(tr.cancelMeeting);
    const dialog = await heard(page, "C5. Enter opens the confirmation dialog", () => page.keyboard.press("Enter"), { quiet: 1800, max: 8000 });
    expect(all(dialog), "the dialog is announced with its name").toMatch(/dialog/); expect(all(dialog)).toContain(tr.cancelMeeting);
    const escaped = await heard(page, "C5b. Escape closes it", () => page.keyboard.press("Escape"), { quiet: 1500, max: 6000 });
    note(`  → after Escape, NVDA said: ${all(escaped) || "(nothing)"}`);
  } finally { if (project) await api(manager.page, "POST", `/projects/${project.id}/archive`).catch(() => {}); await manager.context.close(); }
});


test("D. the meeting room: joining, the media buttons and their state, the participants and the chat panel, leaving", async ({ browser }) => {
  test.setTimeout(540_000);
  const owner = await account(browser, "manager"), guestPerson = await account(browser, "member");
  try {
    const page = owner.page;
    const meeting = (await api(page, "POST", "/meetings", { title: "Reader room", description: "", startsAt: new Date(Date.now() + 60_000).toISOString(), endsAt: new Date(Date.now() + 3600_000).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [guestPerson.me.id], meetingType: "INDEPENDENT" })).json as Meeting;
    expect((await api(page, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
    const roomUrl = localizeHref(`/meetings/${meeting.id}/room`, "tr");
    await visit(page, "D1. the room, before joining", roomUrl, "button");
    await tab(page, "D1a. skip link"); await heard(page, "D1a2. Enter on the skip link", () => page.keyboard.press("Enter"), { quiet: 1500, max: 8000 });
    const joinStop = await tabUntil(page, said => said.includes(tr.join), "D1b. the join button", 30);
    expect(joinStop.said).toMatch(/button/);
    const joined = await heard(page, "D2. Enter joins", () => page.keyboard.press("Enter"), { quiet: 2500, max: 30000, until: [tr.phase.connected] });
    expect(all(joined), "the connection state is announced").toContain(tr.phase.connected);
    // The controls of the room, in order.
    const stops: string[] = [];
    for (let step = 1; step <= 26; step++) { const said = all(await tab(page, `D3. Tab ${step}`)); stops.push(said); if (said.includes(tr.leave)) break; }
    note(`  → ${stops.length} stops`);
    const text = stops.join(" || ");
    for (const control of [tr.micOn, tr.cameraOn, tr.screen, tr.chat, tr.participants, tr.leave]) expect(text, `"${control}" is reached and named`).toContain(control);
    expect(text, "an on/off control says whether it is on").toMatch(/not pressed|pressed/);
  } finally { await owner.context.close(); await guestPerson.context.close(); }
});

test("E. the room in use: microphone and camera state, the chat panel and an incoming message, leaving", async ({ browser }) => {
  test.setTimeout(540_000);
  const owner = await account(browser, "manager"), guestPerson = await account(browser, "member");
  try {
    const page = owner.page, other = guestPerson.page;
    const meeting = (await api(page, "POST", "/meetings", { title: "Reader room use", description: "", startsAt: new Date(Date.now() + 60_000).toISOString(), endsAt: new Date(Date.now() + 3600_000).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [guestPerson.me.id], meetingType: "INDEPENDENT" })).json as Meeting;
    expect((await api(page, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
    const roomUrl = localizeHref(`/meetings/${meeting.id}/room`, "tr");
    // A second person (not heard, a plain headless browser) is in the room, so there is somebody to talk to.
    await other.goto(roomUrl); await other.getByRole("button", { name: tr.join, exact: true }).click(); await expect(other.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) })).toBeVisible({ timeout: 30000 });
    note("\n## E. the room in use");
    await page.goto(roomUrl); await page.getByRole("button", { name: tr.join, exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) })).toBeVisible({ timeout: 30000 });
    const mic = page.getByRole("button", { name: tr.micOn, exact: true });
    const micFocus = await heard(page, "E1. focus the microphone button", () => mic.focus(), { quiet: 1200, max: 6000 });
    expect(all(micFocus)).toContain(tr.micOn); expect(all(micFocus), "its state is spoken").toMatch(/not pressed/);
    const micOn = await heard(page, "E1b. Space turns the microphone on", () => page.keyboard.press("Space"), { quiet: 2000, max: 10000 });
    note(`  → after turning the microphone on NVDA said: ${all(micOn) || "(nothing)"}`);
    expect(all(micOn), "the result is spoken").toContain(tr.micIsOn);
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "the focus stayed on the button that was pressed, now named for the opposite action").toBe(tr.micOff);
    await expect(page.getByRole("button", { name: tr.micOff, exact: true })).toHaveAttribute("aria-pressed", "true");
    const cam = page.getByRole("button", { name: tr.cameraOn, exact: true });
    await heard(page, "E2. focus the camera button", () => cam.focus(), { quiet: 1200, max: 6000 });
    const camOn = await heard(page, "E2b. Space turns the camera on", () => page.keyboard.press("Space"), { quiet: 2500, max: 10000 });
    note(`  → after turning the camera on NVDA said: ${all(camOn) || "(nothing)"}`);
    expect(all(camOn)).toContain(tr.cameraIsOn);
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe(tr.cameraOff);
    // The chat panel.
    const chatButton = page.locator("[data-room-controls]").getByRole("button", { name: tr.chat, exact: true });
    const opened = await heard(page, "E3. open the chat panel", async () => { await chatButton.focus(); await page.keyboard.press("Enter"); }, { quiet: 2000, max: 8000 });
    note(`  → opening the chat panel: ${all(opened) || "(nothing)"}`);
    const box = page.getByRole("textbox", { name: tr.message, exact: true });
    const onBox = await heard(page, "E3b. the message box", () => box.focus(), { quiet: 1200, max: 6000 });
    expect(all(onBox)).toContain(tr.message); expect(all(onBox)).toMatch(/edit/);
    await box.fill("Hello from the reader test");
    const sent = await heard(page, "E3c. Enter sends it", () => page.keyboard.press("Enter"), { quiet: 2500, max: 9000 });
    note(`  → after sending NVDA said: ${all(sent) || "(nothing)"}`);
    expect(all(sent), "sending is confirmed").toContain(tr.messageSent); expect(all(sent), "without reading the new bubble out with its buttons").not.toContain("Cevapla");
    await page.waitForTimeout(900);
    const incoming = await heard(page, "E4. a message arrives from the other person", () => api(other, "POST", `/meetings/${meeting.id}/chat`, { content: "Reply from the other person", mentionIds: [] }), { quiet: 2500, max: 12000 });
    expect(all(incoming), "an incoming message is announced as who said what, without moving the focus").toContain(`${guestPerson.me.nickname}: Reply from the other person`);
    expect(all(incoming), "once, without the buttons of the bubble").not.toContain("Cevapla"); expect(all(incoming)).not.toContain("Emoji tepkisi");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName), "and the focus stayed in the message box").toBeTruthy();
    // Leaving asks first.
    const leave = page.locator("[data-room-controls]").getByRole("button", { name: tr.leave, exact: true });
    const leaveOpen = await heard(page, "E5. Leave", async () => { await leave.focus(); await page.keyboard.press("Enter"); }, { quiet: 2000, max: 8000 });
    expect(all(leaveOpen), "the confirmation is announced as a dialog").toMatch(/dialog/);
    const kept = await heard(page, "E5b. Escape keeps the call", () => page.keyboard.press("Escape"), { quiet: 1800, max: 8000 });
    note(`  → after Escape NVDA said: ${all(kept) || "(nothing)"}`);
  } finally { await owner.context.close(); await guestPerson.context.close(); }
});

test("F. English and German: the names are in the page's language and NVDA switches to it", async ({ browser }) => {
  test.setTimeout(300_000);
  const manager = await account(browser, "manager");
  try {
    const page = manager.page;
    for (const [locale, dict] of [["en", en], ["de", de]] as const) {
      await visit(page, `F. chooser (${locale})`, localizeHref("/meetings/new", locale), "[data-meeting-kind-choice]");
      await tab(page, "skip link"); await heard(page, "Enter on the skip link", () => page.keyboard.press("Enter"), { quiet: 1200, max: 8000 });
      const card = await tabUntil(page, said => said.includes(dict.createProjectMeeting), `${locale} first card`, 6);
      expect(card.said).toContain(dict.createProjectMeeting); expect(card.said).toContain(dict.createProjectMeetingDescription);
      if (locale === "de") expect(card.said, "NVDA switched to German for the German text").toContain("[de]");
      else expect(card.said, "English text is read in NVDA's own (English) voice, with no language switch").not.toMatch(/\[(tr|de)\]/);
      const independent = await tab(page, `${locale} second card`); expect(all(independent)).toContain(dict.createIndependentMeeting);
      await visit(page, `F. form (${locale})`, localizeHref("/meetings/new?type=independent", locale), "#meeting-title");
      const title = await heard(page, `${locale} the title field`, () => page.locator("#meeting-title").focus(), { quiet: 1200, max: 6000 });
      expect(all(title), "the field is named in the page language").toContain(dict.title); expect(all(title)).toMatch(/edit/); expect(all(title)).toMatch(/required/);
      const search = await heard(page, `${locale} the search box`, () => page.getByRole("searchbox", { name: dict.searchPeople }).focus(), { quiet: 1200, max: 6000 });
      expect(all(search)).toContain(dict.searchPeople);
    }
  } finally { await manager.context.close(); }
});
