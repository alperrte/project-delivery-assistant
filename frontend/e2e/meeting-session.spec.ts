import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { api, chooseDate, chooseTime } from "./helpers";
import { psql, uuid } from "./db";
import { meetingAccount, openParticipantMenu, projectMateIds, showPanel, hideDevOverlay } from "./meeting-fixture";
import { REJECTED_STATE } from "./consent-state";
import { localizeHref } from "../src/i18n/routing";
import type { Project } from "../src/features/projects/types";
import type { Meeting, MeetingInvite } from "../src/features/meetings/types";
import tr from "../src/i18n/meetings/tr.json";
import en from "../src/i18n/meetings/en.json";
import messages from "../src/i18n/messages/tr.json";

// Real API + self-hosted LiveKit (see playwright.meetings.config.ts): the call surviving in-app navigation, the mini bar,
// emoji in the meeting chat and the shared date/time pickers of the meeting form.
const FAKE_MEDIA = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen", "--enable-usermedia-screen-capturing"];
test.use({ storageState: REJECTED_STATE, trace: "off", video: "off", launchOptions: { args: FAKE_MEDIA } });
test.describe.configure({ mode: "serial" });
const base = "http://localhost:8080/api/v1";
let managerFile: string, memberFile: string;
test.beforeAll(() => { managerFile = meetingAccount("manager"); memberFile = meetingAccount("member"); });

async function login(context: BrowserContext, file: string) {
  const account = JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string };
  await context.request.get(`${base}/auth/csrf`);
  const csrf = (await context.cookies(base)).find(c => c.name === "XSRF-TOKEN")!;
  const result = await context.request.post(`${base}/auth/login`, { headers: { "X-XSRF-TOKEN": decodeURIComponent(csrf.value), Origin: "http://localhost:3000" }, data: { email: account.email, password: account.password } });
  expect(result.status()).toBe(200);
}
async function createProject(page: Page, label = "Session") {
  await page.goto("/projects");
  const result = await api(page, "POST", "/projects", { name: `${label} ${Date.now()}`, projectTypes: ["WEB"] });
  expect(result.status).toBe(201); return result.json as Project;
}
async function createMeeting(page: Page, projectId: string, open = true) {
  const now = Date.now();
  const result = await api(page, "POST", `/meetings`, { title: `Session ${now}`, description: "Call survives navigation", startsAt: new Date(now + (open ? 1000 : 3600_000)).toISOString(), endsAt: new Date(now + 7200_000).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: projectMateIds(projectId) });
  expect(result.status).toBe(201); const meeting = result.json as Meeting;
  if (open) expect((await api(page, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
  return meeting;
}
function addMember(projectId: string, userId: string) {
  // TEST-ONLY fixture membership, restricted to this newly created QA project/account.
  psql(`WITH membership AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(projectId)}','${uuid(userId)}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM membership`);
}
const roomHref = (slug: string, id: string) => localizeHref(`/meetings/${id}/room`, "tr");
const connected = (page: Page) => page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) });
async function join(page: Page) { await page.getByRole("button", { name: tr.join, exact: true }).click(); await expect(connected(page)).toBeVisible({ timeout: 30000 }); }
async function screenshot(page: Page, name: string) { mkdirSync(path.join(__dirname, "../test-results/meetings-visual"), { recursive: true }); await page.screenshot({ path: path.join(__dirname, `../test-results/meetings-visual/${name}.png`) }); }
/** Archives the QA projects through an already signed-in page: a fresh login per test would hit the login rate limit. */
async function archive(page: Page, projects: (Project | undefined)[]) {
  for (const p of projects) if (p) await api(page, "POST", `/projects/${p.id}/archive`).catch(() => {});
}
const room = (page: Page) => page.locator("[data-meeting-room]");
const mini = (page: Page) => page.locator("[data-meeting-mini]");
/** Counts what a second connection would cost: join requests and LiveKit signalling sockets. */
function watchConnections(page: Page, meetingId: string) {
  const counts = { joins: 0, leaves: 0, sockets: 0 };
  page.on("request", request => {
    if (request.method() !== "POST") return;
    if (request.url().endsWith(`/meetings/${meetingId}/join`)) counts.joins++;
    if (request.url().endsWith(`/meetings/${meetingId}/leave`)) counts.leaves++;
  });
  page.on("websocket", socket => { if (socket.url().includes("7880")) counts.sockets++; });
  return counts;
}
const inboundAudioBytes = (page: Page) => page.evaluate(async () => {
  const reports = await Promise.all((window as unknown as { qaPeers: RTCPeerConnection[] }).qaPeers.map(peer => peer.getStats()));
  let bytes = 0; for (const report of reports) report.forEach(stat => { if (stat.type === "inbound-rtp" && stat.kind === "audio") bytes += stat.bytesReceived; });
  return bytes;
});

test("the call keeps running while other workspace pages are open; the mini bar controls it", async ({ browser }) => {
  test.setTimeout(240000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1440, height: 900 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 800 } });
  await managerContext.addInitScript(() => {
    const tracks: MediaStreamTrack[] = []; Object.assign(window, { qaTracks: tracks });
    const peers: RTCPeerConnection[] = []; Object.assign(window, { qaPeers: peers });
    const Original = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Original { constructor(...args: ConstructorParameters<typeof RTCPeerConnection>) { super(...args); peers.push(this); } };
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => { const stream = await original(constraints); tracks.push(...stream.getTracks()); return stream; };
  });
  await memberContext.addInitScript(() => {
    const peers: RTCPeerConnection[] = []; Object.assign(window, { qaPeers: peers });
    const Original = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Original { constructor(...args: ConstructorParameters<typeof RTCPeerConnection>) { super(...args); peers.push(this); } };
  });
  const a = await managerContext.newPage(), b = await memberContext.newPage();
  let project: Project | undefined, second: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(a); second = await createProject(a, "Other"); await b.goto("/dashboard");
    const member = (await api(b, "GET", "/auth/me")).json as { id: string };
    addMember(project.id, member.id);
    const meeting = await createMeeting(a, project.id);
    const counts = watchConnections(a, meeting.id);
    await a.goto(roomHref(project.slug, meeting.id)); await b.goto(roomHref(project.slug, meeting.id));
    await join(a); await join(b);
    await a.getByRole("button", { name: tr.micOn, exact: true }).click(); await a.getByRole("button", { name: tr.cameraOn, exact: true }).click();
    await expect(a.getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    await expect(b.locator("[data-meeting-room] video").first()).toBeVisible({ timeout: 15000 });
    await room(a).getByRole("button", { name: tr.chat, exact: true }).click();
    await a.getByRole("textbox", { name: tr.message, exact: true }).fill("history before leaving the page");
    await a.getByRole("button", { name: tr.send, exact: true }).click();
    await expect(a.getByText("history before leaving the page", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(mini(a)).toHaveCount(0);
    expect(counts.joins).toBe(1); const socketsInRoom = counts.sockets; expect(socketsInRoom).toBeGreaterThan(0);

    // Sidebar navigation: Projects, then Calendar, then another project — all client-side, the call never reconnects.
    await a.getByRole("link", { name: messages.app.nav.projects, exact: true }).first().click();
    await expect(a).toHaveURL(/\/projeler$/);
    await expect(mini(a)).toBeVisible();
    await expect(mini(a).getByRole("status")).toHaveText(tr.miniActive);
    await a.getByRole("link", { name: "Takvim", exact: true }).first().click();
    await expect(a).toHaveURL(/takvim/);
    await expect(mini(a)).toBeVisible();
    await a.getByRole("link", { name: messages.app.nav.projects, exact: true }).first().click();
    await a.getByRole("link", { name: second.name }).first().click();
    await expect(a).toHaveURL(new RegExp(second.slug));
    await expect(mini(a)).toBeVisible();
    await screenshot(a, "mini-bar-desktop");

    // Still one session: no new join, no new signalling socket, the same participant is in the room and audio flows both ways.
    expect(counts.joins).toBe(1); expect(counts.sockets).toBe(socketsInRoom);
    await expect(b.locator("[data-meeting-room] video").first()).toBeVisible();
    await b.getByRole("button", { name: tr.micOn, exact: true }).click();
    await expect.poll(() => a.locator("audio").count(), { message: "remote audio keeps playing on another page" }).toBeGreaterThan(0);
    const before = await inboundAudioBytes(a);
    await expect.poll(async () => (await inboundAudioBytes(a)) - before, { timeout: 15000 }).toBeGreaterThan(500);
    expect(await a.evaluate(() => (window as unknown as { qaTracks: MediaStreamTrack[] }).qaTracks.every(track => track.readyState === "live"))).toBe(true);

    // Mini bar: mic/camera state is shown and toggled without opening the room.
    await expect(mini(a).getByRole("button", { name: tr.micOff, exact: true })).toHaveAttribute("aria-pressed", "true");
    await mini(a).getByRole("button", { name: tr.micOff, exact: true }).click();
    await expect(mini(a).getByRole("button", { name: tr.micOn, exact: true })).toHaveAttribute("aria-pressed", "false");
    await mini(a).getByRole("button", { name: tr.cameraOff, exact: true }).click();
    await expect(mini(a).getByRole("button", { name: tr.cameraOn, exact: true })).toBeVisible();

    // Screen sharing started in the room survives a page change.
    await a.getByRole("link", { name: tr.returnToMeeting }).click();
    await expect(room(a)).toBeVisible(); await expect(connected(a)).toBeVisible();
    await expect(mini(a)).toHaveCount(0);
    await expect(a.getByText("history before leaving the page", { exact: true })).toBeHidden(); // chat panel is closed on return…
    await room(a).getByRole("button", { name: tr.chat, exact: true }).click();
    await expect(a.getByText("history before leaving the page", { exact: true })).toBeVisible(); // …but the history is the live session's
    await expect(room(a).getByRole("button", { name: tr.micOn, exact: true })).toBeVisible();
    await room(a).getByRole("button", { name: tr.screen, exact: true }).click();
    await expect(b.locator("[data-meeting-room] video")).toHaveCount(1, { timeout: 15000 }); // camera is off now, the screen is the only video
    await a.getByRole("link", { name: messages.app.nav.projects, exact: true }).first().click();
    await expect(mini(a).getByText(tr.screenSharing)).toBeVisible();
    await expect(b.locator("[data-meeting-room] video")).toHaveCount(1);
    expect(counts.joins, "returning to the room never re-joins").toBe(1); expect(counts.sockets).toBe(socketsInRoom);

  } finally {
    await archive(a, [project, second]);
    await managerContext.close(); await memberContext.close();
  }
});

const trackScript = () => {
  const tracks: MediaStreamTrack[] = []; Object.assign(window, { qaTracks: tracks });
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async constraints => { const stream = await original(constraints); tracks.push(...stream.getTracks()); return stream; };
};
const tracksEnded = (page: Page) => page.evaluate(() => { const tracks = (window as unknown as { qaTracks: MediaStreamTrack[] }).qaTracks; return tracks.length > 0 && tracks.every(track => track.readyState === "ended"); });
const goProjects = (page: Page) => page.getByRole("link", { name: messages.app.nav.projects, exact: true }).first().click();
/** In-app navigation (Next's client router): a `page.goto` would be a page load, which really does hang the call up. */
const appPush = (page: Page, href: string) => page.evaluate(url => (window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push(url), href);
const detailHref = (slug: string, id: string, suffix = "") => localizeHref(`/meetings/${id}${suffix}`, "tr");

test("leaving from the mini bar asks first; ending for all and signing out clean the background call up", async ({ browser }) => {
  test.setTimeout(240000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1440, height: 900 } });
  await context.addInitScript(trackScript);
  const page = await context.newPage();
  let project: Project | undefined;
  try {
    await login(context, managerFile);
    project = await createProject(page);
    const first = await createMeeting(page, project.id), second = await createMeeting(page, project.id), third = await createMeeting(page, project.id);

    // Leave: cancel keeps the call, confirm hangs up exactly once and releases every track.
    const counts = watchConnections(page, first.id);
    await page.goto(roomHref(project.slug, first.id)); await join(page);
    await room(page).getByRole("button", { name: tr.micOn, exact: true }).click(); await room(page).getByRole("button", { name: tr.cameraOn, exact: true }).click();
    await expect(room(page).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    await goProjects(page); await expect(mini(page)).toBeVisible();
    await mini(page).getByRole("button", { name: tr.leave, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: tr.leaveTitle });
    await expect(dialog).toBeVisible(); await expect(dialog.getByText(tr.leaveDescription, { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: tr.leaveCancel, exact: true }).click();
    await expect(dialog).toBeHidden(); await expect(mini(page)).toBeVisible();
    expect(counts.leaves).toBe(0); expect(await tracksEnded(page)).toBe(false);
    await mini(page).getByRole("button", { name: tr.leave, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: tr.leaveConfirm, exact: true }).dblclick();
    await expect(mini(page)).toHaveCount(0);
    await expect.poll(() => counts.leaves).toBe(1); await page.waitForTimeout(500); expect(counts.leaves).toBe(1);
    expect(await tracksEnded(page)).toBe(true);
    await expect(page).toHaveURL(/\/projeler$/);

    // Ended for everyone elsewhere (API call of an authorised user): the background call closes and the person is told.
    await page.goto(roomHref(project.slug, second.id)); await join(page);
    await room(page).getByRole("button", { name: tr.micOn, exact: true }).click();
    await expect(room(page).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    await goProjects(page); await expect(mini(page)).toBeVisible();
    expect((await api(page, "POST", `/meetings/${second.id}/end`)).status).toBe(200);
    await expect(mini(page)).toHaveCount(0, { timeout: 20000 });
    await expect(page.getByText(tr.phase.closed, { exact: true })).toBeVisible();
    expect(await tracksEnded(page)).toBe(true);

    // Signing out ends the call and releases the devices.
    await page.goto(roomHref(project.slug, third.id)); await join(page);
    await room(page).getByRole("button", { name: tr.micOn, exact: true }).click();
    await expect(room(page).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    await goProjects(page); await expect(mini(page)).toBeVisible();
    // The navbar auto-hides while idle; a real top-edge pointer move reveals it (joining the call takes longer than its 700 ms window).
    await page.mouse.move(700, 8);
    await page.locator("header").getByRole("button", { name: /Hesap/ }).click();
    await page.getByRole("menuitem", { name: "Çıkış yap" }).click();
    await expect(page).toHaveURL(/\/tr\/giris/);
    await expect(mini(page)).toHaveCount(0);
    expect(await tracksEnded(page)).toBe(true);
  } finally {
    // The session ended with a sign-out, so one fresh sign-in is needed to archive the QA project.
    const again = await browser.newContext({ storageState: REJECTED_STATE }), cleanup = await again.newPage();
    try { await login(again, managerFile); await cleanup.goto("/projects"); await archive(cleanup, [project]); } finally { await again.close(); }
    await context.close();
  }
});

test("only one call at a time: other meetings explain instead of hanging the running call up", async ({ browser }) => {
  test.setTimeout(180000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1440, height: 900 } });
  await context.addInitScript(trackScript);
  const page = await context.newPage();
  let project: Project | undefined;
  try {
    await login(context, managerFile);
    project = await createProject(page);
    const first = await createMeeting(page, project.id), second = await createMeeting(page, project.id);
    const counts = watchConnections(page, first.id), other = watchConnections(page, second.id);
    await page.goto(roomHref(project.slug, first.id)); await join(page);
    await room(page).getByRole("button", { name: tr.micOn, exact: true }).click();
    await expect(room(page).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();

    // The running meeting's detail page: the join link becomes an in-app return (a page load would hang up).
    await appPush(page, detailHref(project.slug, first.id));
    await expect(page.locator("main").getByRole("link", { name: new RegExp(`^${tr.returnToMeeting}`) })).toBeVisible();
    await expect(page.getByRole("link", { name: tr.join, exact: true })).toHaveCount(0);

    // Another meeting's detail page: no join link, a way back to the running call instead.
    await appPush(page, detailHref(project.slug, second.id));
    await expect(page.locator("main").getByText(/hâlâ sürüyor/)).toBeVisible();
    await expect(page.getByRole("link", { name: tr.join, exact: true })).toHaveCount(0);
    await expect(page.locator("main").getByRole("link", { name: tr.returnToActive, exact: true })).toBeVisible();

    // Even reaching the other room inside the app opens no second connection; the page offers the running call.
    await appPush(page, detailHref(project.slug, second.id, "/room"));
    await expect(page.getByRole("heading", { name: tr.otherMeetingTitle, exact: true })).toBeVisible();
    expect(other.joins).toBe(0);
    await screenshot(page, "other-meeting-active");
    await page.getByRole("link", { name: tr.returnToActive, exact: true }).click();
    await expect(room(page)).toBeVisible(); await expect(connected(page)).toBeVisible();
    expect(counts.joins).toBe(1); expect(counts.leaves).toBe(0); expect(await tracksEnded(page)).toBe(false);
  } finally {
    await archive(page, [project]);
    await context.close();
  }
});

test("emoji picker in the meeting chat: caret insertion, emoji-only messages, multi-code-point emoji, phone layout", async ({ browser }) => {
  test.setTimeout(180000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 900 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const a = await managerContext.newPage(), b = await memberContext.newPage();
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(a); await b.goto("/dashboard");
    addMember(project.id, ((await api(b, "GET", "/auth/me")).json as { id: string }).id);
    const meeting = await createMeeting(a, project.id);
    await a.goto(roomHref(project.slug, meeting.id)); await b.goto(roomHref(project.slug, meeting.id));
    await join(a); await join(b);
    await room(a).getByRole("button", { name: tr.chat, exact: true }).click(); await room(b).getByRole("button", { name: tr.chat, exact: true }).click();
    const box = a.getByRole("textbox", { name: tr.message, exact: true });
    const emojiButton = room(a).getByTestId("meeting-chat-emoji");

    // Open/close, then insert into an empty draft.
    await emojiButton.click(); await expect(a.getByTestId("meeting-chat-emoji-popup")).toBeVisible();
    await a.keyboard.press("Escape"); await expect(a.getByTestId("meeting-chat-emoji-popup")).toHaveCount(0);
    await expect(room(a).getByRole("textbox", { name: tr.message, exact: true })).toBeVisible(); // Escape closed only the picker
    await emojiButton.click(); await a.getByTestId("emoji-SMILE").click();
    await expect(box).toHaveValue("😀");
    // In the middle of the text, then several in a row; nothing typed is lost.
    await box.fill("hello world"); await box.evaluate(element => (element as HTMLTextAreaElement).setSelectionRange(5, 5));
    await emojiButton.click(); await a.getByTestId("emoji-ROCKET").click();
    await expect(box).toHaveValue("hello🚀 world");
    await emojiButton.click(); await a.getByTestId("emoji-FIRE").click(); await emojiButton.click(); await a.getByTestId("emoji-HEART").click();
    await expect(box).toHaveValue("hello🚀🔥❤️ world");
    await a.getByRole("button", { name: tr.send, exact: true }).click();
    await expect(b.getByText("hello🚀🔥❤️ world", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(box).toHaveValue("");

    // Emoji only, and a multi-code-point sequence (ZWJ family + flag) must arrive byte for byte.
    await a.waitForTimeout(900); // the server allows one message per 750 ms
    await emojiButton.click(); await a.getByTestId("emoji-PARTY").click(); await a.getByRole("button", { name: tr.send, exact: true }).click();
    await expect(b.getByText("🥳", { exact: true })).toBeVisible({ timeout: 15000 });
    const family = "👨‍👩‍👧‍👦🇹🇷 ok";
    await a.waitForTimeout(900); await box.fill(family); await a.getByRole("button", { name: tr.send, exact: true }).click();
    await expect(b.getByText(family, { exact: true })).toBeVisible({ timeout: 15000 });
    const stored = ((await api(a, "GET", `/meetings/${meeting.id}/chat?page=0&size=50`)).json as { content: { content: string }[] }).content.map(m => m.content);
    expect(stored).toEqual(expect.arrayContaining(["hello🚀🔥❤️ world", "🥳", family]));

    // A draft survives opening and closing the picker, and the picker fits a phone screen.
    const phoneBox = b.getByRole("textbox", { name: tr.message, exact: true });
    await phoneBox.fill("draft on the phone");
    await room(b).getByTestId("meeting-chat-emoji").tap();
    const popup = b.getByTestId("meeting-chat-emoji-popup");
    await expect(popup).toBeVisible();
    const popupBox = (await popup.boundingBox())!;
    expect(popupBox.x).toBeGreaterThanOrEqual(0); expect(popupBox.x + popupBox.width).toBeLessThanOrEqual(390.5);
    expect(popupBox.y).toBeGreaterThanOrEqual(0); expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(844.5);
    await screenshot(b, "emoji-picker-390");
    await b.getByTestId("emoji-THUMBS_UP").tap();
    await expect(phoneBox).toHaveValue("draft on the phone👍");
    await expect(connected(b)).toBeVisible();
    expect(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await archive(a, [project]);
    await managerContext.close(); await memberContext.close();
  }
});

test("meeting form uses the shared date and time pickers and keeps its validation and payload", async ({ page, context }) => {
  test.setTimeout(150000);
  await login(context, managerFile);
  const project = await createProject(page);
  try {
    await page.goto(localizeHref(`/meetings/new?type=independent`, "tr"));
    await expect(page.locator("#meeting-title")).toBeVisible();
    await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
    // Same triggers as the reminder/task forms: an outline button with the calendar/clock icon, h-10, one border radius.
    const startDate = page.locator("#meeting-start-date"), startTime = page.locator("#meeting-start-time");
    for (const trigger of [startDate, startTime, page.locator("#meeting-end-date"), page.locator("#meeting-end-time")]) {
      await expect(trigger).toBeVisible();
      expect(await trigger.evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(40, 0);
    }
    expect(await startDate.evaluate(element => element.tagName)).toBe("BUTTON");
    await screenshot(page, "meeting-form-pickers");

    // Past days are disabled, a day this week can be chosen, hours/minutes come from the shared columns.
    const now = new Date(), key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const target = new Date(now); target.setDate(target.getDate() + 3);
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    await startDate.click();
    await expect(page.locator(`#meeting-start-date-calendar [data-date="${key(yesterday)}"]`)).toBeDisabled();
    await page.keyboard.press("Escape");
    await chooseDate(page, "meeting-start-date", key(target)); await chooseTime(page, "meeting-start-time", "14:30");
    await chooseDate(page, "meeting-end-date", key(target)); await chooseTime(page, "meeting-end-time", "15:45");
    await expect(startDate).toContainText(String(target.getFullYear()));
    await expect(startTime).toContainText("14:30"); await expect(page.locator("#meeting-end-time")).toContainText("15:45");

    // End before start is refused with the form's own message and nothing is sent.
    await page.locator("#meeting-title").fill("Shared pickers meeting");
    await chooseTime(page, "meeting-end-time", "13:00");
    const requests: string[] = []; page.on("request", request => { if (request.method() === "POST" && request.url().endsWith(`/meetings`)) requests.push(request.url()); });
    await page.getByRole("button", { name: tr.plan, exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: tr.formInvalid })).toBeVisible();
    expect(requests).toHaveLength(0);

    // Valid dates are sent as the same ISO instants the native control produced.
    await chooseTime(page, "meeting-end-time", "15:45");
    const created = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/meetings`));
    await page.getByRole("button", { name: tr.plan, exact: true }).click();
    const meeting = (await (await created).json()) as Meeting;
    const expectedStart = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 14, 30).toISOString();
    const expectedEnd = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 15, 45).toISOString();
    expect(new Date(meeting.startsAt).toISOString()).toBe(expectedStart); expect(new Date(meeting.endsAt).toISOString()).toBe(expectedEnd);
    expect(meeting.zoneId).toBe(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone));
    await expect(page).toHaveURL(new RegExp(`${meeting.id}$`));

    // Edit shows the saved values in the same pickers.
    await page.goto(localizeHref(`/meetings/${meeting.id}/edit`, "tr"));
    await expect(page.locator("#meeting-start-time")).toContainText("14:30"); await expect(page.locator("#meeting-end-time")).toContainText("15:45");

    // English labels and the dark theme.
    await page.goto(localizeHref(`/meetings/new?type=independent`, "en"));
    await expect(page.getByText(en.startDate, { exact: true })).toBeVisible(); await expect(page.getByText(en.endTime, { exact: true })).toBeVisible();
    await page.evaluate(() => localStorage.setItem("theme", "dark")); await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.locator("#meeting-start-date").click(); await expect(page.locator("#meeting-start-date-calendar")).toBeVisible();
    await screenshot(page, "meeting-form-date-dark"); await page.keyboard.press("Escape");

    // Phone: the pickers stack, fit the screen and open inside the viewport.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#meeting-start-time").click();
    const panel = page.locator("#meeting-start-time-time"); await expect(panel).toBeVisible();
    const panelBox = (await panel.boundingBox())!;
    expect(panelBox.x).toBeGreaterThanOrEqual(0); expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(390.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(page, "meeting-form-time-390");
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});

test("mini bar on phones and tablets: inside the screen, thumb-sized, never blocks the page", async ({ browser }) => {
  test.setTimeout(150000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await context.addInitScript(trackScript); await hideDevOverlay(context);
  const page = await context.newPage();
  let project: Project | undefined;
  try {
    await login(context, managerFile);
    project = await createProject(page);
    const meeting = await createMeeting(page, project.id);
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    await room(page).getByRole("button", { name: tr.micOn, exact: true }).tap();
    await expect(room(page).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    await appPush(page, localizeHref("/projects", "tr"));
    await expect(mini(page)).toBeVisible();
    for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1024, 768], [844, 390]] as const) {
      await page.setViewportSize({ width, height });
      const bar = (await mini(page).boundingBox())!;
      expect(bar.x, `left edge at ${width}`).toBeGreaterThanOrEqual(0); expect(bar.x + bar.width, `right edge at ${width}`).toBeLessThanOrEqual(width + 0.5);
      expect(bar.y + bar.height, `bottom edge at ${width}`).toBeLessThanOrEqual(height + 0.5);
      for (const button of await mini(page).getByRole("button").all()) { const box = (await button.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(43.5); expect(box.height).toBeGreaterThanOrEqual(43.5); }
      await expect(mini(page).getByRole("link", { name: tr.returnToMeeting, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow at ${width}`).toBe(true);
      await screenshot(page, `mini-bar-${width}x${height}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await mini(page).getByRole("button", { name: tr.micOff, exact: true }).tap();
    await expect(mini(page).getByRole("button", { name: tr.micOn, exact: true })).toBeVisible();
    await mini(page).getByRole("link", { name: tr.returnToMeeting, exact: true }).tap();
    await expect(room(page)).toBeVisible(); await expect(connected(page)).toBeVisible();
    await expect(mini(page)).toHaveCount(0);
    await expect(room(page).getByRole("button", { name: tr.micOn, exact: true })).toBeVisible();
  } finally {
    await archive(page, [project]);
    await context.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Follow-ups: bottom layout with the chat, chat draft kept with the call, invite expiry pickers.
// ---------------------------------------------------------------------------------------------------------------------
type Rect = { x: number; y: number; width: number; height: number };
const intersects = (a: Rect, b: Rect) => a.x < b.x + b.width - 0.5 && a.x + a.width > b.x + 0.5 && a.y < b.y + b.height - 0.5 && a.y + a.height > b.y + 0.5;
/** True when the element at the centre of the control is the control itself: nothing is drawn over it. */
const reachable = (locator: ReturnType<Page["locator"]>) => locator.evaluate(element => {
  const box = element.getBoundingClientRect();
  const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
  return box.width > 0 && !!hit && (hit === element || element.contains(hit));
});
/** The visual viewport of a phone with a controllable on-screen keyboard (the real one cannot be driven in a desktop browser). */
const keyboardScript = () => {
  const target = new EventTarget();
  const viewport = Object.assign(target, { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  Object.assign(window, { setKeyboard: (height: number) => { viewport.height = innerHeight - height; viewport.dispatchEvent(new Event("resize")); } });
};
const setKeyboard = (page: Page, height: number) => page.evaluate(value => (window as unknown as { setKeyboard: (height: number) => void }).setKeyboard(value), height);

async function expectClearOfChat(page: Page, chat: ReturnType<Page["locator"]>, label: string) {
  const viewport = page.viewportSize()!;
  // The bar re-measures in the frame after the chat changes state, so allow that frame.
  await expect.poll(async () => intersects((await mini(page).boundingBox())!, (await chat.boundingBox())!), { message: `mini bar and chat overlap at ${label}`, timeout: 2000 }).toBe(false);
  const bar = (await mini(page).boundingBox())!;
  expect(bar.x, label).toBeGreaterThanOrEqual(0); expect(bar.x + bar.width, label).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(bar.y, `mini bar top inside the screen at ${label}`).toBeGreaterThanOrEqual(0); expect(bar.y + bar.height, label).toBeLessThanOrEqual(viewport.height + 0.5);
  for (const control of await mini(page).locator("button, a").all()) expect(await reachable(control), `mini control reachable at ${label}`).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow at ${label}`).toBe(true);
}

test("mini bar and the chat (bar, compact window, full panel) never cover each other, on every phone size and with the keyboard", async ({ browser }) => {
  test.setTimeout(240000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 900 } });
  await context.addInitScript(keyboardScript);
  const page = await context.newPage();
  let project: Project | undefined;
  try {
    await login(context, managerFile);
    project = await createProject(page);
    const meeting = await createMeeting(page, project.id);
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    await room(page).getByRole("button", { name: tr.micOn, exact: true }).click();
    await expect(room(page).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    await goProjects(page); await expect(mini(page)).toBeVisible();
    await page.getByTestId("chat-nav-item").click();
    await expect(page.getByTestId("chat-panel")).toBeVisible();

    const sizes = [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024], [1024, 768], [844, 390]] as const;
    for (const [width, height] of sizes) {
      const label = `${width}x${height}`;
      await page.setViewportSize({ width, height });
      // Full panel: it leaves the bar its own row at the bottom.
      if (!(await page.getByTestId("chat-panel").isVisible())) await page.getByTestId("chat-fullscreen").click();
      await expect(page.getByTestId("chat-panel")).toBeVisible();
      await expectClearOfChat(page, page.getByTestId("chat-panel"), `${label} full`);
      expect(await reachable(page.getByTestId("chat-minimize")), `chat controls reachable at ${label}`).toBe(true);
      // Title bar, then compact window.
      await page.getByTestId("chat-minimize").click();
      await expect(page.getByTestId("chat-bar")).toBeVisible();
      await expectClearOfChat(page, page.getByTestId("chat-bar"), `${label} bar`);
      expect(await reachable(page.getByTestId("chat-bar-expand")), `chat bar reachable at ${label}`).toBe(true);
      await page.getByTestId("chat-bar-expand").click();
      await expect(page.getByTestId("chat-compact")).toBeVisible();
      await expectClearOfChat(page, page.getByTestId("chat-compact"), `${label} compact`);
      expect(await reachable(page.getByTestId("chat-minimize")), `chat window controls reachable at ${label}`).toBe(true);
      await screenshot(page, `mini-chat-${label}`);
    }

    // Keyboard open (a chat field has focus): the bar shrinks to its controls and rides above the keyboard, clear of the chat.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("chat-composer")).toBeVisible();
    await page.getByTestId("chat-composer").focus();
    await setKeyboard(page, 310);
    await page.waitForTimeout(300);
    const visibleBottom = 844 - 310, bar = (await mini(page).boundingBox())!, chat = (await page.getByTestId("chat-compact").boundingBox())!;
    expect(bar.y + bar.height, "bar stays above the keyboard").toBeLessThanOrEqual(visibleBottom + 0.5);
    expect(intersects(bar, chat), "bar and chat window overlap with the keyboard open").toBe(false);
    for (const control of await mini(page).locator("button, a").all()) expect(await reachable(control)).toBe(true);
    await screenshot(page, "mini-chat-keyboard-390");
    await setKeyboard(page, 0);
    await page.getByTestId("chat-composer").blur();
    await page.waitForTimeout(300);
    await expect(mini(page).getByText(tr.miniActive)).toBeVisible();
  } finally {
    await archive(page, [project]);
    await context.close();
  }
});

test("the unsent chat message belongs to the call: kept across pages and projects, gone after leaving", async ({ browser }) => {
  test.setTimeout(180000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let project: Project | undefined, second: Project | undefined;
  try {
    await login(context, managerFile);
    project = await createProject(page); second = await createProject(page, "Other");
    const meeting = await createMeeting(page, project.id);
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    await room(page).getByRole("button", { name: tr.chat, exact: true }).click();
    const box = page.getByRole("textbox", { name: tr.message, exact: true });
    await box.fill("unsent draft 😀");
    await goProjects(page); await expect(mini(page)).toBeVisible();
    await page.getByRole("link", { name: second.name }).first().click();
    await expect(page).toHaveURL(new RegExp(second.slug));
    await mini(page).getByRole("link", { name: tr.returnToMeeting, exact: true }).click();
    await expect(room(page)).toBeVisible(); await expect(connected(page)).toBeVisible();
    await room(page).getByRole("button", { name: tr.chat, exact: true }).click();
    await expect(page.getByRole("textbox", { name: tr.message, exact: true })).toHaveValue("unsent draft 😀");
    // Typing continues where it stopped, and the draft is still the call's after another round trip.
    await page.getByRole("textbox", { name: tr.message, exact: true }).press("End");
    await page.keyboard.type(" and more");
    await goProjects(page); await mini(page).getByRole("link", { name: tr.returnToMeeting, exact: true }).click();
    await room(page).getByRole("button", { name: tr.chat, exact: true }).click();
    await expect(page.getByRole("textbox", { name: tr.message, exact: true })).toHaveValue("unsent draft 😀 and more");

    // Leaving from the mini bar ends the call and its draft: joining again starts with an empty message box.
    await goProjects(page);
    await mini(page).getByRole("button", { name: tr.leave, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: tr.leaveConfirm, exact: true }).click();
    await expect(mini(page)).toHaveCount(0);
    await appPush(page, detailHref(project.slug, meeting.id, "/room"));
    await expect(page.getByRole("button", { name: tr.join, exact: true })).toBeVisible();
    await join(page);
    await room(page).getByRole("button", { name: tr.chat, exact: true }).click();
    await expect(page.getByRole("textbox", { name: tr.message, exact: true })).toHaveValue("");
  } finally {
    await archive(page, [project, second]);
    await context.close();
  }
});

test("invite expiry uses the shared date and time pickers and keeps its limits and payload", async ({ page, context }) => {
  test.setTimeout(150000);
  await login(context, managerFile);
  const project = await createProject(page);
  try {
    const meeting = await createMeeting(page, project.id);
    await page.goto(detailHref(project.slug, meeting.id));
    await expect(page.getByRole("button", { name: tr.createInvite, exact: true })).toBeVisible();
    await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
    const date = page.locator("#invite-expiry-date"), time = page.locator("#invite-expiry-time");
    for (const trigger of [date, time]) {
      await expect(trigger).toBeVisible();
      expect(await trigger.evaluate(element => element.tagName)).toBe("BUTTON");
      expect(await trigger.evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(40, 0);
    }
    await screenshot(page, "invite-expiry-pickers");

    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const offset = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d; };
    // The backend accepts "now ... 30 days": earlier and later days cannot be picked.
    await date.click();
    await expect(page.locator(`#invite-expiry-date-calendar [data-date="${key(offset(-1))}"]`)).toBeDisabled();
    const far = page.locator(`#invite-expiry-date-calendar [data-date="${key(offset(31))}"]`);
    if (await far.count()) await expect(far).toBeDisabled();
    await page.keyboard.press("Escape");

    // An instant already in the past is refused by the unchanged server rule and nothing is created.
    await chooseDate(page, "invite-expiry-date", key(offset(0))); await chooseTime(page, "invite-expiry-time", "00:00");
    const created: string[] = [];
    page.on("response", response => { if (response.request().method() === "POST" && response.url().endsWith(`/meetings/${meeting.id}/invites`) && response.status() === 201) created.push(response.url()); });
    await page.getByRole("button", { name: tr.createInvite, exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: tr.invalid })).toBeVisible();
    expect(created).toHaveLength(0);

    // A valid day and time arrive as the same local instant, in ISO form.
    const target = offset(2);
    await chooseDate(page, "invite-expiry-date", key(target)); await chooseTime(page, "invite-expiry-time", "18:20");
    const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/meetings/${meeting.id}/invites`));
    await page.getByRole("button", { name: tr.createInvite, exact: true }).click();
    const invite = (await (await response).json()) as { expiresAt: string };
    expect(new Date(invite.expiresAt).toISOString()).toBe(new Date(target.getFullYear(), target.getMonth(), target.getDate(), 18, 20).toISOString());
    await expect(page.getByRole("button", { name: tr.copy, exact: true })).toBeVisible();

    // Phone: the pickers fit the narrow column and open inside the screen.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#invite-expiry-time").click();
    const panel = page.locator("#invite-expiry-time-time"); await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(page, "invite-expiry-time-390");
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});

test("mini bar respects the device safe areas (notch, home indicator) and stays reachable", async ({ browser }) => {
  test.setTimeout(150000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const insets = (top: number, bottom: number, left: number, right: number) => cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: { top, bottom, left, right } } as never);
  let project: Project | undefined;
  try {
    await login(context, managerFile);
    project = await createProject(page);
    const meeting = await createMeeting(page, project.id);
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    await appPush(page, localizeHref("/projects", "tr"));
    await expect(mini(page)).toBeVisible();

    // Portrait with a home indicator: the bar clears it.
    await insets(47, 34, 0, 0);
    await expect.poll(async () => { const box = (await mini(page).boundingBox())!; return box.y + box.height; }).toBeLessThanOrEqual(844 - 34 + 0.5);
    for (const control of await mini(page).locator("button, a").all()) expect(await reachable(control)).toBe(true);
    await screenshot(page, "mini-bar-safe-area-portrait");

    // Landscape with a notch on the left/right and the indicator below: the bar stays inside all three.
    await page.setViewportSize({ width: 844, height: 390 });
    await insets(0, 21, 47, 47);
    await expect.poll(async () => (await mini(page).boundingBox())!.x).toBeGreaterThanOrEqual(47 - 0.5);
    const box = (await mini(page).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(390 - 21 + 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(844 - 47 + 0.5);
    for (const control of await mini(page).locator("button, a").all()) expect(await reachable(control)).toBe(true);
    await screenshot(page, "mini-bar-safe-area-landscape");
  } finally {
    await archive(page, [project]);
    await context.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// "End for everyone" belongs to the meeting's creator only (not to project managers, members or guests).
// ---------------------------------------------------------------------------------------------------------------------
test("ending a meeting for everyone belongs only to its creator: UI, API, leave semantics, mobile, guests", async ({ browser }) => {
  test.setTimeout(300000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1440, height: 900 } });
  const ownerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 800 } });
  const guestContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 800 } });
  const a = await managerContext.newPage(), b = await ownerContext.newPage(), g = await guestContext.newPage();
  const endLabel = { name: tr.endForAll, exact: true } as const;
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(ownerContext, memberFile);
    project = await createProject(a); await b.goto("/dashboard");
    const owner = (await api(b, "GET", "/auth/me")).json as { id: string; nickname: string };
    addMember(project.id, owner.id);
    // `a` is a PROJECT_MANAGER of the project; `b` is an ordinary member who creates the meeting.
    const meeting = await createMeeting(b, project.id);
    expect(meeting.organizerId, "the creator recorded by the server is the organizer").toBe(owner.id);
    const status = async (page: Page) => ((await api(page, "GET", `/meetings/${meeting.id}`)).json as Meeting).status;

    // Detail page: only the creator is offered "end for everyone".
    await a.goto(detailHref(project.slug, meeting.id)); await b.goto(detailHref(project.slug, meeting.id));
    await expect(a.getByRole("link", { name: tr.join, exact: true })).toBeVisible();
    await expect(b.getByRole("button", endLabel)).toBeVisible();
    await expect(a.getByRole("button", endLabel)).toHaveCount(0);

    // Room: same rule. Meetings belong to their organizer: the creator holds every moderation control, a project manager who was only invited holds none.
    await a.goto(roomHref(project.slug, meeting.id)); await b.goto(roomHref(project.slug, meeting.id));
    await join(a); await join(b);
    await expect(room(b).getByRole("button", endLabel)).toBeVisible();
    await expect(room(a).getByRole("button", endLabel)).toHaveCount(0);
    await showPanel(room(a).page(), tr.participants);
    await openParticipantMenu(a, owner.nickname); await expect(a.getByRole("button", { name: tr.muteParticipant, exact: true })).toHaveCount(0); await a.keyboard.press("Escape");
    await showPanel(room(b).page(), tr.participants);
    await expect((await openParticipantMenu(b)).getByRole("button", { name: tr.muteParticipant, exact: true })).toBeVisible(); await b.keyboard.press("Escape");

    // Backend: a project manager who did not create it is refused, directly through the API, and nothing changes.
    const refused = await api(a, "POST", `/meetings/${meeting.id}/end`);
    expect(refused.status).toBe(403);
    expect(await status(a)).toBe("OPEN");

    // Guests never see it and cannot reach the project endpoint.
    const invite = (await api(b, "POST", `/meetings/${meeting.id}/invites`, { expiresAt: new Date(Date.now() + 3600000).toISOString(), maxUses: 1 })).json as MeetingInvite;
    await g.goto(`${localizeHref("/meeting-guest", "tr")}#${invite.token}`);
    await g.getByLabel(tr.displayName, { exact: true }).fill("QA Guest"); await g.getByRole("button", { name: tr.continue, exact: true }).click(); await join(g);
    await expect(g.getByRole("button", endLabel)).toHaveCount(0);
    expect([401, 403]).toContain((await api(g, "POST", `/meetings/${meeting.id}/end`)).status);
    expect(await status(a)).toBe("OPEN");

    // Phone layout: the same rule in the "More" menu.
    await b.setViewportSize({ width: 390, height: 844 }); await a.setViewportSize({ width: 390, height: 844 });
    await room(b).getByRole("button", { name: tr.more, exact: true }).click();
    await expect(b.getByRole("menuitem", endLabel)).toBeVisible(); await b.keyboard.press("Escape");
    await room(a).getByRole("button", { name: tr.more, exact: true }).click();
    await expect(a.getByRole("menuitem", { name: tr.devices, exact: true })).toBeVisible();
    await expect(a.getByRole("menuitem", endLabel)).toHaveCount(0); await a.keyboard.press("Escape");
    await b.setViewportSize({ width: 1280, height: 800 }); await a.setViewportSize({ width: 1440, height: 900 });

    // The creator's confirmation can be declined: the meeting goes on for everyone.
    await room(b).getByRole("button", endLabel).click();
    await expect(b.getByRole("dialog", { name: tr.endTitle })).toBeVisible();
    await b.getByRole("dialog").getByRole("button", { name: tr.endCancel, exact: true }).click();
    await expect(b.getByRole("dialog")).toHaveCount(0);
    expect(await status(a)).toBe("OPEN"); await expect(connected(a)).toBeVisible(); await expect(connected(b)).toBeVisible();

    // Leaving is not ending: the creator leaves, the meeting continues for the others, and on return the option is back.
    await room(b).getByRole("button", { name: tr.leave, exact: true }).click();
    await b.getByRole("dialog").getByRole("button", { name: tr.leaveConfirm, exact: true }).click();
    await expect(b.getByRole("heading", { name: tr.phase.left, exact: true })).toBeVisible();
    await a.waitForTimeout(5000);
    expect(await status(a)).toBe("OPEN"); await expect(connected(a)).toBeVisible();
    await b.goto(roomHref(project.slug, meeting.id)); await join(b);
    await expect(room(b).getByRole("button", endLabel)).toBeVisible();

    // The creator ends it for everyone: all rooms close, the state is ENDED and nobody can join again.
    await room(b).getByRole("button", endLabel).click();
    await b.getByRole("dialog").getByRole("button", { name: tr.endConfirmLabel, exact: true }).click();
    await expect(a.getByRole("heading", { name: tr.phase.closed, exact: true })).toBeVisible({ timeout: 30000 });
    // A guest's access is revoked together with the meeting, so the guest room reports either state.
    await expect(g.getByRole("heading", { name: new RegExp(`^(${tr.phase.closed}|${tr.phase.removed})$`) })).toBeVisible({ timeout: 30000 });
    expect(await status(a)).toBe("ENDED");
    expect((await api(a, "POST", `/meetings/${meeting.id}/join`)).status).toBe(409);
    expect((await api(b, "POST", `/meetings/${meeting.id}/join`)).status).toBe(409);
    // A manager who did not create it is still refused afterwards (no way to probe or repeat the action).
    expect((await api(a, "POST", `/meetings/${meeting.id}/end`)).status).toBe(403);
  } finally {
    await archive(a, [project]);
    await managerContext.close(); await ownerContext.close(); await guestContext.close();
  }
});

test("a meeting created by a project manager is owned by that manager, not by other managers or by whoever joins first", async ({ browser }) => {
  test.setTimeout(180000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1440, height: 900 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 800 } });
  const a = await managerContext.newPage(), b = await memberContext.newPage();
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(a); await b.goto("/dashboard");
    const member = (await api(b, "GET", "/auth/me")).json as { id: string };
    addMember(project.id, member.id);
    // Make the member a second PROJECT_MANAGER (TEST-ONLY fixture row in this QA project).
    psql(`INSERT INTO project_membership_roles(membership_id,role) SELECT id,'PROJECT_MANAGER' FROM project_memberships WHERE project_id='${uuid(project.id)}' AND user_id='${uuid(member.id)}'`);
    const meeting = await createMeeting(a, project.id);
    // The second manager joins first, which changes nothing about who owns the meeting.
    await b.goto(roomHref(project.slug, meeting.id)); await join(b);
    await a.goto(roomHref(project.slug, meeting.id)); await join(a);
    await expect(room(a).getByRole("button", { name: tr.endForAll, exact: true })).toBeVisible();
    await expect(room(b).getByRole("button", { name: tr.endForAll, exact: true })).toHaveCount(0);
    expect((await api(b, "POST", `/meetings/${meeting.id}/end`)).status).toBe(403);
    // Meetings belong to their organizer: the other project manager holds no moderation power either, the organizer holds all of them.
    await showPanel(room(b).page(), tr.participants);
    await openParticipantMenu(b); await expect(b.getByRole("button", { name: tr.muteParticipant, exact: true })).toHaveCount(0); await b.keyboard.press("Escape");
    await showPanel(room(a).page(), tr.participants);
    await expect((await openParticipantMenu(a)).getByRole("button", { name: tr.muteParticipant, exact: true })).toBeVisible(); await a.keyboard.press("Escape");
    // The mini bar offers no end-for-everyone either: only Leave (with its confirmation).
    await b.getByRole("link", { name: messages.app.nav.projects, exact: true }).first().click();
    await expect(mini(b)).toBeVisible();
    await expect(mini(b).getByRole("button", { name: tr.endForAll, exact: true })).toHaveCount(0);
    expect((await api(a, "POST", `/meetings/${meeting.id}/end`)).status).toBe(200);
    await expect(mini(b)).toHaveCount(0, { timeout: 20000 });
  } finally {
    await archive(a, [project]);
    await managerContext.close(); await memberContext.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Chat keyboard (Enter sends), meeting detail page without breadcrumb/back link, confirmation for "end for everyone".
// ---------------------------------------------------------------------------------------------------------------------
/** Counts chat POSTs of one meeting, so "was anything sent" is observed on the wire. */
function watchChatPosts(page: Page, meetingId: string) {
  const posts: string[] = [];
  page.on("request", request => { if (request.method() === "POST" && request.url().endsWith(`/meetings/${meetingId}/chat`)) posts.push(request.postData() ?? ""); });
  return posts;
}
const afterRateLimit = (page: Page) => page.waitForTimeout(900); // the server allows one chat message per 750 ms

test("meeting chat: Enter sends, Shift+Enter breaks the line, and every guard keeps the draft safe", async ({ browser }) => {
  test.setTimeout(240000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 900 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 800 } });
  const a = await managerContext.newPage(), b = await memberContext.newPage();
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(a); await b.goto("/dashboard");
    addMember(project.id, ((await api(b, "GET", "/auth/me")).json as { id: string }).id);
    const meeting = await createMeeting(a, project.id);
    const posts = watchChatPosts(a, meeting.id);
    await a.goto(roomHref(project.slug, meeting.id)); await b.goto(roomHref(project.slug, meeting.id));
    await join(a); await join(b);
    await room(a).getByRole("button", { name: tr.chat, exact: true }).click(); await room(b).getByRole("button", { name: tr.chat, exact: true }).click();
    const box = a.getByRole("textbox", { name: tr.message, exact: true });

    // Enter sends and clears; the box gets no stray new line.
    await box.fill("hello from enter"); await box.press("Enter");
    await expect(b.getByText("hello from enter", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(box).toHaveValue(""); expect(posts).toHaveLength(1);

    // Shift+Enter is a line break, nothing is sent.
    await box.pressSequentially("first line"); await box.press("Shift+Enter"); await box.pressSequentially("second line");
    await expect(box).toHaveValue("first line\nsecond line"); expect(posts).toHaveLength(1);
    await afterRateLimit(a); await box.press("Enter");
    await expect(b.locator("[data-meeting-room] article p", { hasText: "first line" })).toBeVisible({ timeout: 15000 });
    expect(posts).toHaveLength(2); expect(posts[1]).toContain("first line\\nsecond line");

    // Empty and whitespace-only: Enter sends nothing (and leaves the whitespace alone).
    await box.press("Enter"); await box.fill("   "); await box.press("Enter");
    await a.waitForTimeout(500); expect(posts).toHaveLength(2); await expect(box).toHaveValue("   ");
    await box.fill("");

    // IME: Enter that confirms a composition candidate never sends.
    await box.fill("composing"); await box.focus();
    await box.evaluate(element => element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true })));
    await a.waitForTimeout(500); expect(posts).toHaveLength(2); await expect(box).toHaveValue("composing");

    // The emoji picker: choosing and closing never sends; Enter afterwards sends an emoji message intact.
    await box.fill("");
    await room(a).getByTestId("meeting-chat-emoji").click(); await a.getByTestId("emoji-SMILE").press("Enter");
    await expect(box).toHaveValue("😀"); expect(posts).toHaveLength(2);
    await room(a).getByTestId("meeting-chat-emoji").click(); await a.keyboard.press("Escape");
    await expect(a.getByTestId("meeting-chat-emoji-popup")).toHaveCount(0); expect(posts).toHaveLength(2);
    await afterRateLimit(a); await box.focus(); await box.press("Enter");
    await expect(b.getByText("😀", { exact: true })).toBeVisible({ timeout: 15000 }); expect(posts).toHaveLength(3);

    // Pressing Enter twice at once produces one message.
    await afterRateLimit(a); await box.fill("only once");
    await box.press("Enter"); await a.keyboard.press("Enter");
    await expect(b.getByText("only once", { exact: true })).toHaveCount(1, { timeout: 15000 });
    await a.waitForTimeout(500); expect(posts.filter(post => post.includes("only once"))).toHaveLength(1);

    // A failed send keeps the text and shows the error; the next Enter sends it.
    await afterRateLimit(a);
    await a.route("**/meetings/*/chat", route => route.request().method() === "POST" ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" }) : route.continue());
    await box.fill("keep this draft"); await box.press("Enter");
    await expect(a.getByRole("alert").first()).toBeVisible(); await expect(box).toHaveValue("keep this draft");
    await a.unroute("**/meetings/*/chat"); await afterRateLimit(a);
    await box.press("Enter");
    await expect(b.getByText("keep this draft", { exact: true })).toBeVisible({ timeout: 15000 }); await expect(box).toHaveValue("");

    // The session draft (kept while away) still works with Enter: an unsent draft survives a page change.
    await box.fill("draft kept across pages");
    await a.getByRole("link", { name: messages.app.nav.projects, exact: true }).first().click();
    await expect(mini(a)).toBeVisible();
    await mini(a).getByRole("link", { name: tr.returnToMeeting, exact: true }).click();
    await room(a).getByRole("button", { name: tr.chat, exact: true }).click();
    const back = a.getByRole("textbox", { name: tr.message, exact: true });
    await expect(back).toHaveValue("draft kept across pages");
    await afterRateLimit(a); await back.press("Enter");
    await expect(b.getByText("draft kept across pages", { exact: true })).toBeVisible({ timeout: 15000 });
  } finally {
    await archive(a, [project]);
    await managerContext.close(); await memberContext.close();
  }
});

test("on a touch phone Enter stays a new line and the Send button sends", async ({ browser }) => {
  test.setTimeout(150000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  let project: Project | undefined;
  try {
    await login(context, managerFile);
    project = await createProject(page);
    const meeting = await createMeeting(page, project.id);
    const posts = watchChatPosts(page, meeting.id);
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    await room(page).getByRole("button", { name: tr.chat, exact: true }).tap();
    const box = page.getByRole("textbox", { name: tr.message, exact: true });
    await box.fill("one"); await box.press("Enter"); await box.pressSequentially("two");
    await expect(box).toHaveValue("one\ntwo"); expect(posts).toHaveLength(0);
    await page.getByRole("button", { name: tr.send, exact: true }).tap();
    await expect(page.getByText("one", { exact: false }).first()).toBeVisible({ timeout: 15000 });
    expect(posts).toHaveLength(1); await expect(box).toHaveValue("");
  } finally {
    await archive(page, [project]);
    await context.close();
  }
});

test("meeting detail page has no breadcrumb and no back link, and keeps everything else", async ({ page, context }) => {
  test.setTimeout(150000);
  await login(context, managerFile);
  const project = await createProject(page);
  try {
    const scheduled = await createMeeting(page, project.id, false), open = await createMeeting(page, project.id);
    const breadcrumb = page.getByRole("navigation", { name: messages.common.breadcrumb, exact: true });
    // Reach the page the way a person does: through the project's meeting list.
    await page.goto(`${localizeHref("/meetings", "tr")}?q=${encodeURIComponent(scheduled.title)}`); // the list holds everything the user has: narrowed to this meeting
    await page.getByRole("link", { name: new RegExp(scheduled.title) }).first().click();
    if (!page.url().includes(scheduled.id)) await appPush(page, detailHref(project.slug, scheduled.id));
    await expect(page.getByRole("heading", { name: scheduled.title, exact: true })).toBeVisible();
    await expect(breadcrumb).toHaveCount(0);
    await expect(page.getByRole("link", { name: tr.back, exact: true })).toHaveCount(0);
    // Content and actions of a planned meeting are all still there.
    await expect(page.getByText(tr.status.SCHEDULED, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`${tr.createdBy}:`, { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: new RegExp(`^${tr.plannedAttendees}`) })).toBeVisible();
    await expect(page.getByRole("heading", { name: tr.agenda, exact: true })).toBeVisible();
    await expect(page.getByText(tr.timezone.replace("{zone}", ""), { exact: false }).first()).toBeVisible();
    for (const name of [tr.startNow, tr.edit, tr.cancelMeeting]) await expect(page.getByRole("button", { name, exact: true }).or(page.getByRole("link", { name, exact: true })).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: tr.guestInvites, exact: true })).toBeVisible();
    await expect(page.locator("#invite-expiry-date")).toBeVisible();
    // No empty band where the breadcrumb and back link were: the title sits where it does on the (trail-less) create page.
    const detailTop = (await page.getByRole("heading", { name: scheduled.title, exact: true }).boundingBox())!.y;
    await page.goto(localizeHref(`/meetings/new?type=independent`, "tr"));
    const createTop = (await page.getByRole("heading", { name: tr.createIndependentMeeting, exact: true, level: 1 }).boundingBox())!.y;
    await page.goto(detailHref(project.slug, scheduled.id));
    const settled = (await page.getByRole("heading", { name: scheduled.title, exact: true }).boundingBox())!.y;
    expect(Math.abs(settled - createTop), `title offset ${settled} vs ${createTop} (client nav ${detailTop})`).toBeLessThanOrEqual(6);
    await page.goto(detailHref(project.slug, open.id));
    await expect(page.getByRole("link", { name: tr.join, exact: true })).toBeVisible();
    await screenshot(page, "meeting-detail-desktop");

    // Phone and dark theme: same page, same rule, no overflow.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => localStorage.setItem("theme", "dark")); await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(breadcrumb).toHaveCount(0); await expect(page.getByRole("link", { name: tr.back, exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: tr.join, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(page, "meeting-detail-390-dark");
    await page.evaluate(() => localStorage.removeItem("theme"));

    // Other pages keep their trail: a project criterion form and the meeting edit page.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(localizeHref(`/projects/${project.slug}/criteria/new`, "tr"));
    await expect(breadcrumb).toBeVisible();
    await page.goto(localizeHref(`/meetings/${scheduled.id}/edit`, "tr"));
    await expect(page.locator("#meeting-title")).toBeVisible();
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});

test("ending for everyone always asks first: dialog, cancel, Escape, failure, double click, phone menu and detail page", async ({ browser }) => {
  test.setTimeout(300000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1440, height: 900 } });
  const ownerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 800 } });
  await ownerContext.addInitScript(trackScript);
  const a = await managerContext.newPage(), b = await ownerContext.newPage();
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(ownerContext, memberFile);
    project = await createProject(a); await b.goto("/dashboard");
    addMember(project.id, ((await api(b, "GET", "/auth/me")).json as { id: string }).id);
    const meeting = await createMeeting(b, project.id), detailMeeting = await createMeeting(b, project.id);
    const status = async (id: string) => ((await api(b, "GET", `/meetings/${id}`)).json as Meeting).status;
    const endRequests: string[] = [];
    b.on("request", request => { if (request.method() === "POST" && request.url().endsWith("/end")) endRequests.push(request.url()); });
    await a.goto(roomHref(project.slug, meeting.id)); await b.goto(roomHref(project.slug, meeting.id));
    await join(a); await join(b);
    await room(b).getByRole("button", { name: tr.micOn, exact: true }).click();
    await expect(room(b).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    const dialog = b.getByRole("dialog", { name: tr.endTitle });

    // The first click only opens the dialog, with the agreed texts; nothing is sent.
    await room(b).getByRole("button", { name: tr.endForAll, exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(tr.endConfirm, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: tr.endCancel, exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: tr.endConfirmLabel, exact: true })).toBeVisible();
    await screenshot(b, "end-for-all-dialog-desktop");
    expect(endRequests).toHaveLength(0); expect(await status(meeting.id)).toBe("OPEN");

    // Escape and Cancel both keep the call, the microphone and the other participant's room.
    await b.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
    await room(b).getByRole("button", { name: tr.endForAll, exact: true }).click(); await dialog.getByRole("button", { name: tr.endCancel, exact: true }).click(); await expect(dialog).toHaveCount(0);
    expect(endRequests).toHaveLength(0); expect(await status(meeting.id)).toBe("OPEN");
    await expect(connected(a)).toBeVisible(); await expect(connected(b)).toBeVisible();
    await expect(room(b).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    expect(await b.evaluate(() => (window as unknown as { qaTracks: MediaStreamTrack[] }).qaTracks.every(track => track.readyState === "live"))).toBe(true);

    // A failing request is reported inside the dialog; the meeting is not shown (or treated) as ended.
    await b.route("**/meetings/*/end", route => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    await room(b).getByRole("button", { name: tr.endForAll, exact: true }).click();
    await dialog.getByRole("button", { name: tr.endConfirmLabel, exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible(); await expect(dialog).toBeVisible();
    expect(await status(meeting.id)).toBe("OPEN");
    expect(endRequests).toHaveLength(1); endRequests.length = 0; // the one (failed) attempt
    await b.unroute("**/meetings/*/end");
    await dialog.getByRole("button", { name: tr.endCancel, exact: true }).click(); await expect(dialog).toHaveCount(0);
    await expect(connected(b)).toBeVisible(); await expect(connected(a)).toBeVisible();

    // Phone layout: the "More" menu item opens the very same dialog.
    await b.setViewportSize({ width: 390, height: 844 });
    await room(b).getByRole("button", { name: tr.more, exact: true }).click();
    await b.getByRole("menuitem", { name: tr.endForAll, exact: true }).click();
    await expect(dialog).toBeVisible(); await expect(dialog.getByText(tr.endConfirm, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("alert"), "the earlier failure is not shown again").toHaveCount(0);
    await b.waitForTimeout(400);
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390.5); expect(box.y + box.height).toBeLessThanOrEqual(844.5);
    await screenshot(b, "end-for-all-dialog-390");
    await b.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
    expect(endRequests).toHaveLength(0); await b.setViewportSize({ width: 1280, height: 800 });

    // Confirm with a double click: one request, everybody's room closes, nobody can join again.
    await room(b).getByRole("button", { name: tr.endForAll, exact: true }).click();
    await dialog.getByRole("button", { name: tr.endConfirmLabel, exact: true }).dblclick();
    await expect(a.getByRole("heading", { name: tr.phase.closed, exact: true })).toBeVisible({ timeout: 30000 });
    expect(endRequests).toHaveLength(1); expect(await status(meeting.id)).toBe("ENDED");
    expect((await api(a, "POST", `/meetings/${meeting.id}/join`)).status).toBe(409);

    // The detail page's button asks too, with the same texts, and is the same single-request action.
    endRequests.length = 0;
    await b.goto(detailHref(project.slug, detailMeeting.id));
    await b.getByRole("button", { name: tr.endForAll, exact: true }).click();
    await expect(dialog).toBeVisible(); await expect(dialog.getByText(tr.endConfirm, { exact: true })).toBeVisible();
    expect(endRequests).toHaveLength(0); expect(await status(detailMeeting.id)).toBe("OPEN");
    await b.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); expect(await status(detailMeeting.id)).toBe("OPEN");
    await b.getByRole("button", { name: tr.endForAll, exact: true }).click();
    await dialog.getByRole("button", { name: tr.endConfirmLabel, exact: true }).dblclick();
    await expect.poll(() => status(detailMeeting.id), { timeout: 20000 }).toBe("ENDED");
    expect(endRequests).toHaveLength(1);

    // The manager who is not the creator never gets the button on the detail page of an open meeting.
    const another = await createMeeting(b, project.id);
    await a.goto(detailHref(project.slug, another.id));
    await expect(a.getByRole("link", { name: tr.join, exact: true })).toBeVisible();
    await expect(a.getByRole("button", { name: tr.endForAll, exact: true })).toHaveCount(0);
  } finally {
    await archive(a, [project]);
    await managerContext.close(); await ownerContext.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Ready screen: real camera and microphone checks (fake Chromium devices; not a substitute for physical hardware).
// ---------------------------------------------------------------------------------------------------------------------
type GumMode = "real" | "denied" | "missing" | "busy" | "silent";
/** Wraps getUserMedia: records every call and stream, and can fail, delay or silence on demand. */
const mediaProbeScript = () => {
  const streams: MediaStream[] = [], calls: { audio?: unknown; video?: unknown }[] = [];
  Object.assign(window, { qaStreams: streams, qaCalls: calls, qaGum: { mode: "real", delay: 0 } });
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async constraints => {
    calls.push({ audio: constraints?.audio, video: constraints?.video });
    const gum = (window as unknown as { qaGum: { mode: string; delay: number } }).qaGum;
    if (gum.delay) await new Promise(resolve => setTimeout(resolve, gum.delay));
    const fail = (name: string): never => { throw Object.assign(new Error(name), { name }); };
    if (gum.mode === "denied") fail("NotAllowedError");
    if (gum.mode === "missing") fail("NotFoundError");
    if (gum.mode === "busy") fail("NotReadableError");
    const stream = gum.mode === "silent" && constraints?.audio ? new AudioContext().createMediaStreamDestination().stream : await original(constraints);
    streams.push(stream); return stream;
  };
};
const setGum = (page: Page, mode: GumMode, delay = 0) => page.evaluate(([m, d]) => { Object.assign((window as unknown as { qaGum: object }).qaGum, { mode: m, delay: d }); }, [mode, delay] as const);
const liveTracks = (page: Page) => page.evaluate(() => (window as unknown as { qaStreams: MediaStream[] }).qaStreams.flatMap(stream => stream.getTracks()).filter(track => track.readyState === "live").length);
const gumCalls = (page: Page, kind: "audio" | "video") => page.evaluate(k => (window as unknown as { qaCalls: Record<string, unknown>[] }).qaCalls.filter(call => call[k]).length, kind);
const cameraCheck = (page: Page) => page.getByRole("region", { name: tr.cameraCheck });
const micCheck = (page: Page) => page.getByRole("region", { name: tr.micCheck });
/** Opens a device dropdown (the shared Select, not a native menu) and returns the real deviceIds it offers, default excluded. */
async function deviceOptions(page: Page, region: ReturnType<typeof cameraCheck>, name: string) {
  const trigger = region.getByRole("combobox", { name });
  await trigger.click();
  await expect(page.getByRole("listbox", { name })).toBeVisible();
  return trigger.page().locator('[role="option"]').evaluateAll(list => (list as HTMLElement[]).map(option => option.dataset.deviceId ?? "").filter(Boolean));
}
/** Picks the last real device of a dropdown with the mouse and returns its deviceId. */
async function pickDevice(page: Page, region: ReturnType<typeof cameraCheck>, name: string) {
  const ids = await deviceOptions(page, region, name);
  expect(ids.length).toBeGreaterThan(0);
  await page.locator(`[role="option"][data-device-id="${ids.at(-1)}"]`).click();
  await expect(page.getByRole("listbox", { name })).toHaveCount(0);
  return ids.at(-1)!;
}
const level = async (page: Page) => Number(await page.getByTestId("mic-level").getAttribute("data-level"));

async function openReadyScreen(browser: Browser, viewport = { width: 1280, height: 900 }, touch = false) {
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  await context.addInitScript(mediaProbeScript);
  const page = await context.newPage();
  await login(context, managerFile);
  const project = await createProject(page), meeting = await createMeeting(page, project.id);
  const counts = watchConnections(page, meeting.id);
  await page.goto(roomHref(project.slug, meeting.id));
  await expect(page.getByRole("heading", { name: tr.readyTitle, exact: true })).toBeVisible();
  return { context, page, project, meeting, counts };
}

test("camera test: real live preview, device switch, double click, stop; never joins or publishes", async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page, project, counts } = await openReadyScreen(browser);
  try {
    const start = cameraCheck(page).getByRole("button", { name: tr.previewCamera, exact: true });
    // A double click opens the camera once (the button is busy while it starts).
    await start.dblclick();
    await expect(cameraCheck(page).getByText(tr.camActive)).toBeVisible({ timeout: 15000 });
    expect(await gumCalls(page, "video")).toBe(1);
    // The picture is a real, moving camera stream: frames keep arriving.
    const frames = () => page.getByTestId("camera-check-video").evaluate(element => (element as HTMLVideoElement).getVideoPlaybackQuality().totalVideoFrames);
    await expect.poll(() => page.getByTestId("camera-check-video").evaluate(video => (video as HTMLVideoElement).videoWidth)).toBeGreaterThan(0);
    const before = await frames(); await page.waitForTimeout(700); expect(await frames()).toBeGreaterThan(before);
    await screenshot(page, "device-check-camera-desktop");
    // Choosing a device restarts the preview on exactly that device and closes the previous stream.
    const liveBefore = await liveTracks(page);
    const chosenCamera = await pickDevice(page, cameraCheck(page), tr.videoinput);
    const options = [chosenCamera];
    await expect.poll(() => gumCalls(page, "video")).toBe(2);
    await expect(cameraCheck(page).getByText(tr.camActive)).toBeVisible();
    expect(await liveTracks(page), "one camera stream open after the switch").toBe(liveBefore);
    expect(await page.evaluate(() => JSON.stringify((window as unknown as { qaCalls: { video?: unknown }[] }).qaCalls.at(-1)?.video))).toContain(options.at(-1)!);
    // Stop: the stream is closed and the screen is idle again, with a message instead of a black box.
    await cameraCheck(page).getByRole("button", { name: tr.stopTest, exact: true }).click();
    await expect(cameraCheck(page).getByText(tr.camIdleHint)).toBeVisible();
    expect(await liveTracks(page)).toBe(0);
    // The microphone check is independent: it works while the camera is stopped, and stopping it leaves nothing open.
    expect(counts.joins).toBe(0); expect(counts.sockets, "no LiveKit connection for a camera test").toBe(0);
    await expect(page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) })).toHaveCount(0);
  } finally {
    await archive(page, [project]); await context.close();
  }
});

test("microphone test: live level from real samples, heard state, silence is not a success, independent of the camera, no join", async ({ browser }) => {
  test.setTimeout(120000);
  const { context, page, project, counts } = await openReadyScreen(browser);
  try {
    const start = micCheck(page).getByRole("button", { name: tr.testMicrophone, exact: true });
    await start.dblclick();
    await expect(micCheck(page).getByText(tr.micActive)).toBeVisible({ timeout: 15000 });
    expect(await gumCalls(page, "audio")).toBe(1);
    // The Chromium fake microphone beeps periodically: the meter follows it and the check reports that sound arrived.
    const seen = new Set<number>();
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && !(await micCheck(page).getByText(tr.micHeard).isVisible())) { seen.add(await level(page)); await page.waitForTimeout(40); }
    await expect(micCheck(page).getByText(tr.micHeard)).toBeVisible();
    for (let i = 0; i < 40; i++) { seen.add(await level(page)); await page.waitForTimeout(40); }
    expect(seen.size, `meter levels seen: ${[...seen].join(",")}`).toBeGreaterThan(2);
    expect(Math.max(...seen)).toBeGreaterThan(3);
    await screenshot(page, "device-check-mic-desktop");
    // The camera is untouched by the microphone check, and the other way around.
    expect(await gumCalls(page, "video")).toBe(0);
    await cameraCheck(page).getByRole("button", { name: tr.previewCamera, exact: true }).click();
    await expect(cameraCheck(page).getByText(tr.camActive)).toBeVisible({ timeout: 15000 });
    await expect(micCheck(page).getByText(tr.micActive)).toBeVisible();
    await cameraCheck(page).getByRole("button", { name: tr.stopTest, exact: true }).click();
    await expect(micCheck(page).getByText(tr.micActive)).toBeVisible();
    // Stop: the stream is closed, the meter falls to zero and the check is idle.
    await micCheck(page).getByRole("button", { name: tr.stopTest, exact: true }).click();
    await expect(micCheck(page).getByText(tr.micActive)).toHaveCount(0);
    expect(await liveTracks(page)).toBe(0); expect(await level(page)).toBe(0);
    expect(counts.joins).toBe(0); expect(counts.sockets, "no LiveKit connection for a microphone test").toBe(0);

    // Silence never counts as success: a live but silent input shows a flat meter and, after a while, a hint (not "broken").
    await setGum(page, "silent");
    await micCheck(page).getByRole("button", { name: tr.testMicrophone, exact: true }).click();
    await expect(micCheck(page).getByText(tr.micActive)).toBeVisible();
    await expect(micCheck(page).getByText(tr.micSilent, { exact: false })).toBeVisible({ timeout: 8000 });
    expect(await level(page)).toBe(0); await expect(micCheck(page).getByText(tr.micHeard)).toHaveCount(0);
    await micCheck(page).getByRole("button", { name: tr.stopTest, exact: true }).click();
    expect(await liveTracks(page)).toBe(0);
  } finally {
    await archive(page, [project]); await context.close();
  }
});

test("device checks report every failure in place and never leave a device open", async ({ browser }) => {
  test.setTimeout(150000);
  const { context, page, project } = await openReadyScreen(browser);
  try {
    const failures: [GumMode, string][] = [["denied", tr.testDenied], ["missing", tr.testMissing], ["busy", tr.testBusy]];
    for (const [mode, template] of failures) {
      await setGum(page, mode);
      await cameraCheck(page).getByRole("button", { name: tr.previewCamera, exact: true }).click();
      await expect(cameraCheck(page).getByRole("alert")).toHaveText(template.replace("{device}", tr.videoinput));
      await micCheck(page).getByRole("button", { name: tr.testMicrophone, exact: true }).click();
      await expect(micCheck(page).getByRole("alert")).toHaveText(template.replace("{device}", tr.audioinput));
      expect(await liveTracks(page)).toBe(0);
    }
    // After a refusal the very same buttons work again once access is possible.
    await setGum(page, "real");
    await cameraCheck(page).getByRole("button", { name: tr.previewCamera, exact: true }).click();
    await expect(cameraCheck(page).getByText(tr.camActive)).toBeVisible({ timeout: 15000 });
    await expect(cameraCheck(page).getByRole("alert")).toHaveCount(0);

    // A device that disappears mid-test (unplugged) ends the check with an explanation and closes the stream.
    await micCheck(page).getByRole("button", { name: tr.testMicrophone, exact: true }).click();
    await expect(micCheck(page).getByText(tr.micActive)).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => {
      const streams = (window as unknown as { qaStreams: MediaStream[] }).qaStreams;
      for (const stream of streams.slice(-2)) for (const track of stream.getTracks()) track.dispatchEvent(new Event("ended"));
    });
    await expect(cameraCheck(page).getByRole("alert")).toHaveText(tr.testLost.replace("{device}", tr.videoinput));
    await expect(micCheck(page).getByRole("alert")).toHaveText(tr.testLost.replace("{device}", tr.audioinput));
    expect(await liveTracks(page)).toBe(0);

    // No media API at all (old browser / insecure page): an explanation, not a silent button.
    await page.evaluate(() => { Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: undefined, configurable: true }); });
    await micCheck(page).getByRole("button", { name: tr.testMicrophone, exact: true }).click();
    await expect(micCheck(page).getByRole("alert")).toHaveText(/./);
    const text = await micCheck(page).getByRole("alert").innerText();
    expect([tr.testUnsupported, tr.testInsecure]).toContain(text);
  } finally {
    await archive(page, [project]); await context.close();
  }
});

test("a permission answer that arrives after joining is discarded and its devices closed; joining after tests is clean and keeps the chosen devices", async ({ browser }) => {
  test.setTimeout(180000);
  const { context, page, project, meeting } = await openReadyScreen(browser);
  try {
    // 1. A slow permission prompt is still pending when the person joins: the late stream must be stopped on arrival.
    await setGum(page, "real", 1500);
    await micCheck(page).getByRole("button", { name: tr.testMicrophone, exact: true }).click();
    await cameraCheck(page).getByRole("button", { name: tr.previewCamera, exact: true }).click();
    await page.getByRole("button", { name: tr.join, exact: true }).click();
    await expect(connected(page)).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2500);
    expect(await liveTracks(page), "late test streams are closed, nothing else is open").toBe(0);
    await expect(room(page).getByRole("button", { name: tr.micOn, exact: true })).toBeVisible();
    await expect(room(page).getByRole("button", { name: tr.cameraOn, exact: true })).toBeVisible();
    // Leaving returns to a clean slate; start again with real tests on chosen devices.
    await room(page).getByRole("button", { name: tr.leave, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: tr.leaveConfirm, exact: true }).click();
    await expect(page.getByRole("heading", { name: tr.phase.left, exact: true })).toBeVisible();
    await setGum(page, "real", 0);
    await page.goto(roomHref(project.slug, meeting.id));
    await expect(page.getByRole("heading", { name: tr.readyTitle, exact: true })).toBeVisible();

    // 2. Both tests, then join: test devices are closed at once, the person joins with microphone and camera off and
    //    the devices they picked are the ones the room opens when they turn them on.
    await micCheck(page).getByRole("button", { name: tr.testMicrophone, exact: true }).click();
    await cameraCheck(page).getByRole("button", { name: tr.previewCamera, exact: true }).click();
    await expect(micCheck(page).getByText(tr.micActive)).toBeVisible({ timeout: 15000 }); await expect(cameraCheck(page).getByText(tr.camActive)).toBeVisible({ timeout: 15000 });
    const micDevice = await pickDevice(page, micCheck(page), tr.audioinput), cameraDevice = await pickDevice(page, cameraCheck(page), tr.videoinput);
    await expect(micCheck(page).getByText(tr.micActive)).toBeVisible(); await expect(cameraCheck(page).getByText(tr.camActive)).toBeVisible();
    await page.getByRole("button", { name: tr.join, exact: true }).click();
    await expect(connected(page)).toBeVisible({ timeout: 30000 });
    expect(await liveTracks(page), "joining closes every test stream, and opens nothing").toBe(0);
    await expect(room(page).getByRole("button", { name: tr.micOn, exact: true })).toBeVisible();
    await expect(room(page).getByRole("button", { name: tr.cameraOn, exact: true })).toBeVisible();
    await room(page).getByRole("button", { name: tr.micOn, exact: true }).click(); await room(page).getByRole("button", { name: tr.cameraOn, exact: true }).click();
    await expect(room(page).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    await expect(room(page).getByRole("button", { name: tr.cameraOff, exact: true })).toBeVisible();
    const opened = await page.evaluate(() => (window as unknown as { qaStreams: MediaStream[] }).qaStreams.flatMap(stream => stream.getTracks()).filter(track => track.readyState === "live").map(track => `${track.kind}:${track.getSettings().deviceId}`));
    expect(opened).toEqual(expect.arrayContaining([`audio:${micDevice}`, `video:${cameraDevice}`]));
    expect(opened.filter(entry => entry.startsWith("audio:"))).toHaveLength(1); expect(opened.filter(entry => entry.startsWith("video:"))).toHaveLength(1);
    // Leaving releases them.
    await room(page).getByRole("button", { name: tr.leave, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: tr.leaveConfirm, exact: true }).click();
    await expect(page.getByRole("heading", { name: tr.phase.left, exact: true })).toBeVisible();
    expect(await liveTracks(page)).toBe(0);

    // 3. Straight to the meeting without any test: joins with both off and opens nothing.
    await page.goto(roomHref(project.slug, meeting.id));
    await page.getByRole("button", { name: tr.join, exact: true }).click();
    await expect(connected(page)).toBeVisible({ timeout: 30000 });
    expect(await liveTracks(page)).toBe(0);
    await expect(room(page).getByRole("button", { name: tr.micOn, exact: true })).toBeVisible();
  } finally {
    await archive(page, [project]); await context.close();
  }
});

test("ready screen on a phone: both checks usable, nothing overflows", async ({ browser }) => {
  test.setTimeout(120000);
  for (const [width, height] of [[320, 640], [390, 844], [768, 1024]] as const) {
    const { context, page, project } = await openReadyScreen(browser, { width, height }, width < 768);
    try {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow at ${width}`).toBe(true);
      for (const button of await page.locator("[data-meeting-room] button").all()) { const box = (await button.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(43.5); }
      await cameraCheck(page).getByRole("button", { name: tr.previewCamera, exact: true }).click();
      await expect(cameraCheck(page).getByText(tr.camActive)).toBeVisible({ timeout: 15000 });
      await micCheck(page).getByRole("button", { name: tr.testMicrophone, exact: true }).click();
      await expect(micCheck(page).getByText(tr.micActive)).toBeVisible({ timeout: 15000 });
      const video = (await page.getByTestId("camera-check-video").boundingBox())!;
      expect(video.width / video.height, "16:9 preview box").toBeCloseTo(16 / 9, 1);
      expect(video.x + video.width).toBeLessThanOrEqual(width + 0.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await screenshot(page, `device-check-${width}`);
      await page.getByRole("button", { name: tr.join, exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("button", { name: tr.join, exact: true })).toBeVisible();
    } finally {
      await archive(page, [project]); await context.close();
    }
  }
});

test("device dropdowns use the shared Select: custom panel, keyboard, long names, themes, phone, real deviceIds", async ({ browser }) => {
  test.setTimeout(150000);
  const longMic = "Microphone Array (Realtek High Definition Audio(SST)) with a very long vendor-supplied device name that keeps going";
  const { context, page, project } = await openReadyScreen(browser);
  try {
    // A device with a very long name is added to the lists (it is never opened here, only listed).
    await page.evaluate(label => {
      const original = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
      navigator.mediaDevices.enumerateDevices = async () => [...await original(), { deviceId: "long-fake-id", groupId: "g", kind: "audioinput", label, toJSON: () => ({}) } as MediaDeviceInfo];
    }, longMic);
    await micCheck(page).getByRole("button", { name: tr.testMicrophone, exact: true }).click();
    await expect(micCheck(page).getByText(tr.micActive)).toBeVisible({ timeout: 15000 });
    await cameraCheck(page).getByRole("button", { name: tr.previewCamera, exact: true }).click();
    await expect(cameraCheck(page).getByText(tr.camActive)).toBeVisible({ timeout: 15000 });

    // No native <select>: the trigger is the app's own, with the default choice first and the real ids untouched.
    await expect(page.locator("[data-meeting-room] select")).toHaveCount(0);
    const trigger = micCheck(page).getByRole("combobox", { name: tr.audioinput });
    await expect(trigger).toContainText(tr.defaultDevice);
    expect(await trigger.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(43.5);
    const ids = await deviceOptions(page, micCheck(page), tr.audioinput);
    const labels = await page.locator('[role="option"]').allInnerTexts();
    expect(labels[0]).toBe(tr.defaultDevice);
    expect(ids).toContain("long-fake-id"); expect(ids, "the browser's own default entry is not listed twice").not.toContain("default");
    expect(new Set(ids).size).toBe(ids.length);
    // The panel is inside the screen, scrolls if needed, and the long name wraps instead of widening it.
    const panel = page.getByRole("listbox", { name: tr.audioinput });
    const box = (await panel.boundingBox())!, viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
    const longOption = page.locator('[role="option"][data-device-id="long-fake-id"]');
    expect(await longOption.evaluate(element => element.scrollWidth <= element.clientWidth + 1), "long device name does not overflow its row").toBe(true);
    expect((await longOption.boundingBox())!.height, "the long name wraps onto several lines").toBeGreaterThan(44);
    const current = page.locator('[role="option"][aria-selected="true"]');
    await expect(current).toHaveCount(1); await expect(current).toContainText(tr.defaultDevice);
    await page.waitForTimeout(400); await screenshot(page, "device-dropdown-open-light");
    await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0);

    // Keyboard only: open, move, choose the first real device; the test restarts on exactly that device.
    const first = ids.find(id => id !== "long-fake-id")!;
    const callsBefore = await gumCalls(page, "audio");
    await trigger.focus(); await page.keyboard.press("Enter");
    await expect(panel).toBeVisible();
    for (let i = 0; i < 40 && !(await page.locator(`[role="option"][data-device-id="${first}"][data-highlighted]`).count()); i++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(panel).toHaveCount(0);
    await expect.poll(() => gumCalls(page, "audio")).toBe(callsBefore + 1);
    expect(await page.evaluate(() => JSON.stringify((window as unknown as { qaCalls: { audio?: unknown }[] }).qaCalls.at(-1)?.audio))).toContain(first);
    await expect(trigger).not.toContainText(tr.defaultDevice);
    await expect(micCheck(page).getByText(tr.micActive)).toBeVisible();
    expect(await liveTracks(page), "one microphone stream and one camera stream").toBe(2);
    await trigger.press("Tab");

    // Back to the default choice through the menu.
    await trigger.click(); await page.locator('[role="option"][data-device-id=""]').click();
    await expect(trigger).toContainText(tr.defaultDevice);
    await expect.poll(() => gumCalls(page, "audio")).toBe(callsBefore + 2);

    // Dark theme and the phone: same component, still inside the screen.
    await page.evaluate(() => localStorage.setItem("theme", "dark")); await page.setViewportSize({ width: 320, height: 640 });
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await micCheck(page).getByRole("button", { name: tr.testMicrophone, exact: true }).click();
    await expect(micCheck(page).getByText(tr.micActive)).toBeVisible({ timeout: 15000 });
    const phoneIds = await deviceOptions(page, micCheck(page), tr.audioinput);
    expect(phoneIds.length).toBeGreaterThan(0);
    const phoneBox = (await page.getByRole("listbox", { name: tr.audioinput }).boundingBox())!;
    expect(phoneBox.x).toBeGreaterThanOrEqual(0); expect(phoneBox.x + phoneBox.width).toBeLessThanOrEqual(320.5); expect(phoneBox.y + phoneBox.height).toBeLessThanOrEqual(640.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.waitForTimeout(400); await screenshot(page, "device-dropdown-open-dark-320");
    await page.keyboard.press("Escape");
    await page.evaluate(() => localStorage.removeItem("theme"));
  } finally {
    await archive(page, [project]); await context.close();
  }
});
