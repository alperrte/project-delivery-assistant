import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { api, chooseDate, chooseTime } from "./helpers";
import { psql, uuid } from "./db";
import { meetingAccount } from "./meeting-fixture";
import { REJECTED_STATE } from "./consent-state";
import { localizeHref } from "../src/i18n/routing";
import type { Project } from "../src/features/projects/types";
import type { Meeting } from "../src/features/meetings/types";
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
  const result = await api(page, "POST", `/projects/${projectId}/meetings`, { title: `Session ${now}`, description: "Call survives navigation", startsAt: new Date(now + (open ? 1000 : 3600_000)).toISOString(), endsAt: new Date(now + 7200_000).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [] });
  expect(result.status).toBe(201); const meeting = result.json as Meeting;
  if (open) expect((await api(page, "POST", `/projects/${projectId}/meetings/${meeting.id}/start`)).status).toBe(200);
  return meeting;
}
function addMember(projectId: string, userId: string) {
  // TEST-ONLY fixture membership, restricted to this newly created QA project/account.
  psql(`WITH membership AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(projectId)}','${uuid(userId)}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM membership`);
}
const roomHref = (slug: string, id: string) => localizeHref(`/projects/${slug}/meetings/${id}/room`, "tr");
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
const detailHref = (slug: string, id: string, suffix = "") => localizeHref(`/projects/${slug}/meetings/${id}${suffix}`, "tr");

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
    expect((await api(page, "POST", `/projects/${project.id}/meetings/${second.id}/end`)).status).toBe(200);
    await expect(mini(page)).toHaveCount(0, { timeout: 20000 });
    await expect(page.getByText(tr.phase.closed, { exact: true })).toBeVisible();
    expect(await tracksEnded(page)).toBe(true);

    // Signing out ends the call and releases the devices.
    await page.goto(roomHref(project.slug, third.id)); await join(page);
    await room(page).getByRole("button", { name: tr.micOn, exact: true }).click();
    await expect(room(page).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    await goProjects(page); await expect(mini(page)).toBeVisible();
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
    await expect(page.locator("main").getByRole("link", { name: tr.returnToMeeting, exact: true })).toBeVisible();
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
    const stored = ((await api(a, "GET", `/projects/${project.id}/meetings/${meeting.id}/chat?page=0&size=50`)).json as { content: { content: string }[] }).content.map(m => m.content);
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
    await page.goto(localizeHref(`/projects/${project.slug}/meetings/new`, "tr"));
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
    const requests: string[] = []; page.on("request", request => { if (request.method() === "POST" && request.url().endsWith(`/projects/${project.id}/meetings`)) requests.push(request.url()); });
    await page.getByRole("button", { name: tr.plan, exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: tr.formInvalid })).toBeVisible();
    expect(requests).toHaveLength(0);

    // Valid dates are sent as the same ISO instants the native control produced.
    await chooseTime(page, "meeting-end-time", "15:45");
    const created = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/projects/${project.id}/meetings`));
    await page.getByRole("button", { name: tr.plan, exact: true }).click();
    const meeting = (await (await created).json()) as Meeting;
    const expectedStart = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 14, 30).toISOString();
    const expectedEnd = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 15, 45).toISOString();
    expect(new Date(meeting.startsAt).toISOString()).toBe(expectedStart); expect(new Date(meeting.endsAt).toISOString()).toBe(expectedEnd);
    expect(meeting.zoneId).toBe(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone));
    await expect(page).toHaveURL(new RegExp(`${meeting.id}$`));

    // Edit shows the saved values in the same pickers.
    await page.goto(localizeHref(`/projects/${project.slug}/meetings/${meeting.id}/edit`, "tr"));
    await expect(page.locator("#meeting-start-time")).toContainText("14:30"); await expect(page.locator("#meeting-end-time")).toContainText("15:45");

    // English labels and the dark theme.
    await page.goto(localizeHref(`/projects/${project.slug}/meetings/new`, "en"));
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
  await context.addInitScript(trackScript);
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
