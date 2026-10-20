import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { meetingAccount } from "./meeting-fixture";
import { REJECTED_STATE } from "./consent-state";
import { localizeHref } from "../src/i18n/routing";
import type { Project } from "../src/features/projects/types";
import type { Meeting } from "../src/features/meetings/types";
import tr from "../src/i18n/meetings/tr.json";

// Real API + self-hosted LiveKit, like meetings.spec.ts: the leave confirmation, speaking indicator, profile photos,
// the phone layout and the screen-share messages of the meeting room. Needs the local stack (see playwright.meetings.config.ts).
const FAKE_MEDIA = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen", "--enable-usermedia-screen-capturing"];
test.use({ storageState: REJECTED_STATE, trace: "off", video: "off", launchOptions: { args: FAKE_MEDIA } });
test.describe.configure({ mode: "serial" });
const base = "http://localhost:8080/api/v1";
// A real 1x1 PNG: the server reads type and size from the bytes.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
let managerFile: string, memberFile: string;
test.beforeAll(() => { managerFile = meetingAccount("manager"); memberFile = meetingAccount("member"); });

async function login(context: BrowserContext, file: string) {
  const account = JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string };
  await context.request.get(`${base}/auth/csrf`);
  const csrf = (await context.cookies(base)).find(c => c.name === "XSRF-TOKEN")!;
  const result = await context.request.post(`${base}/auth/login`, { headers: { "X-XSRF-TOKEN": decodeURIComponent(csrf.value), Origin: "http://localhost:3000" }, data: { email: account.email, password: account.password } });
  expect(result.status()).toBe(200);
}
async function createProject(page: Page) {
  await page.goto("/projects");
  const result = await api(page, "POST", "/projects", { name: `Room UX ${Date.now()}`, projectTypes: ["WEB"] });
  expect(result.status).toBe(201); return result.json as Project;
}
async function createMeeting(page: Page, projectId: string) {
  const now = Date.now();
  const result = await api(page, "POST", `/projects/${projectId}/meetings`, { title: `Room UX ${now}`, description: "Room experience", startsAt: new Date(now + 1000).toISOString(), endsAt: new Date(now + 7200_000).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [] });
  expect(result.status).toBe(201); const meeting = result.json as Meeting;
  expect((await api(page, "POST", `/projects/${projectId}/meetings/${meeting.id}/start`)).status).toBe(200);
  return meeting;
}
const roomHref = (slug: string, id: string) => localizeHref(`/projects/${slug}/meetings/${id}/room`, "tr");
const connected = (page: Page) => page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) });
async function join(page: Page) { await page.getByRole("button", { name: tr.join, exact: true }).click(); await expect(connected(page)).toBeVisible({ timeout: 30000 }); }
async function uploadPhoto(page: Page) {
  return page.evaluate(async png => {
    const csrfResponse = await fetch("http://localhost:8080/api/v1/auth/csrf", { credentials: "include" });
    const { headerName } = await csrfResponse.json();
    const cookie = decodeURIComponent(document.cookie.split("; ").find(row => row.startsWith("XSRF-TOKEN="))?.slice("XSRF-TOKEN=".length) ?? "");
    const form = new FormData();
    form.append("file", new Blob([Uint8Array.from(atob(png), c => c.charCodeAt(0))], { type: "image/png" }), "me.png");
    return (await fetch("http://localhost:8080/api/v1/users/me/profile-photo", { method: "PUT", credentials: "include", headers: { [headerName]: cookie }, body: form })).status;
  }, PNG);
}
async function screenshot(page: Page, name: string) { mkdirSync(path.join(__dirname, "../test-results/meetings-visual"), { recursive: true }); await page.screenshot({ path: path.join(__dirname, `../test-results/meetings-visual/${name}.png`) }); }
const room = (page: Page) => page.locator("[data-meeting-room]");

test("leaving asks for confirmation; cancelling keeps the call, confirming leaves exactly once", async ({ page, context }) => {
  test.setTimeout(120000);
  await context.addInitScript(() => {
    const tracks: MediaStreamTrack[] = []; Object.assign(window, { roomQaTracks: tracks });
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => { const stream = await original(constraints); tracks.push(...stream.getTracks()); return stream; };
  });
  await login(context, managerFile);
  const project = await createProject(page);
  try {
    const meeting = await createMeeting(page, project.id);
    const leaves: string[] = [];
    page.on("request", request => { if (request.method() === "POST" && request.url().endsWith(`/meetings/${meeting.id}/leave`)) leaves.push(request.url()); });
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    await room(page).getByRole("button", { name: tr.micOn, exact: true }).click();
    await expect(room(page).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();

    const leave = room(page).getByRole("button", { name: tr.leave, exact: true });
    await leave.click();
    const dialog = page.getByRole("dialog", { name: tr.leaveTitle });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(tr.leaveDescription, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: tr.leaveCancel, exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: tr.leaveConfirm, exact: true })).toBeVisible();
    expect(leaves).toHaveLength(0);

    // Escape and the Cancel button both keep the call, the microphone and focus on the Leave button.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden(); await expect(leave).toBeFocused();
    await leave.click(); await page.getByRole("dialog").getByRole("button", { name: tr.leaveCancel, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(connected(page)).toBeVisible();
    await expect(room(page).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { roomQaTracks: MediaStreamTrack[] }).roomQaTracks.every(track => track.readyState === "live"))).toBe(true);
    expect(leaves).toHaveLength(0);

    // A double click on the confirm button sends one leave request and releases every local track.
    await leave.click();
    await page.getByRole("dialog").getByRole("button", { name: tr.leaveConfirm, exact: true }).dblclick();
    await expect(page.getByRole("heading", { name: tr.phase.left, exact: true })).toBeVisible();
    await expect.poll(() => leaves.length).toBe(1);
    await page.waitForTimeout(500);
    expect(leaves).toHaveLength(1);
    expect(await page.evaluate(() => (window as unknown as { roomQaTracks: MediaStreamTrack[] }).roomQaTracks.every(track => track.readyState === "ended"))).toBe(true);
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});

test("profile photos and the speaking indicator for local and remote participants", async ({ browser }) => {
  test.setTimeout(180000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 900 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 900 } });
  const a = await managerContext.newPage(), b = await memberContext.newPage();
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(a); await b.goto("/dashboard");
    const manager = (await api(a, "GET", "/auth/me")).json as { id: string };
    const member = (await api(b, "GET", "/auth/me")).json as { id: string };
    psql(`WITH membership AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(project.id)}','${uuid(member.id)}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM membership`);
    expect(await uploadPhoto(a)).toBe(200);
    const meeting = await createMeeting(a, project.id);
    await a.goto(roomHref(project.slug, meeting.id)); await b.goto(roomHref(project.slug, meeting.id));
    await join(a); await join(b);

    // Camera off: the member sees the manager's PDA photo, the manager sees their own; the member has none and keeps initials.
    const photoOf = (page: Page, id: string) => page.locator(`[data-meeting-room] img[src*="/users/${id}/profile-photo?v="]`);
    await expect(photoOf(a, manager.id)).toBeVisible({ timeout: 15000 });
    await expect(photoOf(b, manager.id)).toBeVisible({ timeout: 15000 });
    await expect(photoOf(a, member.id)).toHaveCount(0); await expect(photoOf(b, member.id)).toHaveCount(0);
    await expect(a.locator("[data-meeting-room] [data-slot=avatar]").filter({ hasNot: a.locator("img") })).toHaveCount(1);

    // Live video wins over the photo; closing the camera brings the photo back.
    await a.getByRole("button", { name: tr.cameraOn, exact: true }).click();
    await expect(a.getByRole("button", { name: tr.cameraOff, exact: true })).toBeVisible();
    await expect(photoOf(a, manager.id)).toHaveCount(0); await expect(photoOf(b, manager.id)).toHaveCount(0);
    await expect(b.locator("[data-meeting-room] video").first()).toBeVisible({ timeout: 15000 });
    await a.getByRole("button", { name: tr.cameraOff, exact: true }).click();
    await expect(photoOf(a, manager.id)).toBeVisible(); await expect(photoOf(b, manager.id)).toBeVisible({ timeout: 15000 });

    // Speaking: muted participants never light up; the fake microphone beeps and both sides must show it.
    const speaking = (page: Page) => page.locator("[data-meeting-room] [data-speaking]");
    await a.waitForTimeout(1500);
    await expect(speaking(a)).toHaveCount(0); await expect(speaking(b)).toHaveCount(0);
    await a.getByRole("button", { name: tr.micOn, exact: true }).click();
    await expect(speaking(a)).toHaveCount(1, { timeout: 5000 });
    await expect(speaking(b)).toHaveCount(1, { timeout: 5000 });
    await screenshot(b, "room-speaking-remote");
    // Muting switches the ring off immediately on the local side and soon after on the remote side.
    await a.getByRole("button", { name: tr.micOff, exact: true }).click();
    await expect(speaking(a)).toHaveCount(0, { timeout: 1000 });
    await expect(speaking(b)).toHaveCount(0, { timeout: 2000 });
  } finally {
    if (project) { await api(a, "DELETE", "/users/me/profile-photo").catch(() => {}); await api(a, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
    await managerContext.close(); await memberContext.close();
  }
});

const VIEWPORTS = [[320, 640], [375, 667], [390, 844], [430, 932], [768, 1024], [1024, 768], [844, 390]] as const;
test("room layout, call bar, chat and participant panels at phone and tablet sizes", async ({ page, context }) => {
  test.setTimeout(180000);
  await login(context, managerFile);
  const project = await createProject(page);
  try {
    const meeting = await createMeeting(page, project.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    await room(page).getByRole("button", { name: tr.cameraOn, exact: true }).click();
    await expect(room(page).getByRole("button", { name: tr.cameraOff, exact: true })).toBeVisible();
    for (const [width, height] of VIEWPORTS) {
      await page.setViewportSize({ width, height });
      const compact = width < 768 || (width > height && height <= 500);
      const label = `${width}x${height}`;
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow at ${label}`).toBe(true);
      const footer = room(page).getByRole("contentinfo").or(room(page).locator("footer")).first();
      await expect(footer, label).toBeInViewport();
      const leave = room(page).getByRole("button", { name: tr.leave, exact: true });
      await expect(leave).toBeInViewport();
      for (const button of await footer.getByRole("button").all()) {
        if (!(await button.isVisible())) continue;
        const box = (await button.boundingBox())!;
        expect(box.height, `touch target height at ${label}`).toBeGreaterThanOrEqual(43.5);
        expect(box.width, `touch target width at ${label}`).toBeGreaterThanOrEqual(compact ? 40 : 43.5);
        expect(box.x + box.width, `button inside the viewport at ${label}`).toBeLessThanOrEqual(width + 0.5);
      }
      const tile = room(page).locator("[data-speaking], video").first();
      await expect(room(page).locator("section[aria-label]").first(), label).toBeVisible();
      if (compact) {
        const bar = (await footer.boundingBox())!, grid = (await room(page).locator("section[aria-label]").first().boundingBox())!;
        expect(grid.y + grid.height, `video area ends above the call bar at ${label}`).toBeLessThanOrEqual(bar.y + 1);
        expect(bar.y + bar.height, `bar reaches the bottom edge at ${label}`).toBeLessThanOrEqual(height + 0.5);
        await expect(room(page).getByRole("button", { name: tr.participants, exact: true }), "participants live in the top bar").toBeVisible();
        await expect(room(page).getByRole("button", { name: tr.more, exact: true })).toBeVisible();
      } else {
        await expect(room(page).getByRole("button", { name: tr.devices, exact: true })).toBeVisible();
      }
      void tile;
      await screenshot(page, `room-ux-${label}`);
    }

    // Phone: chat opens as a full-height panel above the bar, the bar stays reachable, the panel closes again.
    await page.setViewportSize({ width: 390, height: 844 });
    await room(page).getByRole("button", { name: tr.chat, exact: true }).click();
    const input = room(page).getByRole("textbox", { name: tr.message, exact: true });
    await expect(input).toBeInViewport();
    const panelBox = (await room(page).locator("aside").boundingBox())!, barBox = (await room(page).locator("footer").boundingBox())!;
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(barBox.y + 1);
    expect(parseFloat(await input.evaluate(element => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    await screenshot(page, "room-ux-chat-390");
    await room(page).getByRole("button", { name: tr.participants, exact: true }).click();
    await expect(room(page).locator("aside").getByRole("heading", { name: tr.participants, exact: true })).toBeVisible();
    await screenshot(page, "room-ux-participants-390");
    await room(page).getByRole("button", { name: tr.closePanel, exact: true }).click();
    await expect(room(page).locator("aside")).toHaveCount(0);
    await expect(connected(page)).toBeVisible();

    // The "More" menu holds the devices and (for the manager) the end-for-everyone action, separate from Leave.
    await room(page).getByRole("button", { name: tr.more, exact: true }).click();
    await expect(page.getByRole("menuitem", { name: tr.devices, exact: true })).toBeVisible();
    await page.getByRole("menuitem", { name: tr.endForAll, exact: true }).click();
    await expect(page.getByRole("dialog", { name: tr.endTitle })).toBeVisible();
    await page.keyboard.press("Escape");
    await room(page).getByRole("button", { name: tr.leave, exact: true }).click();
    await expect(page.getByRole("dialog", { name: tr.leaveTitle })).toBeVisible();
    await page.waitForTimeout(400); await screenshot(page, "room-ux-leave-dialog-390");
    await page.keyboard.press("Escape");
    await expect(connected(page)).toBeVisible();
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});

test("screen sharing never fails silently: unsupported browsers, cancel, refusal and errors are explained", async ({ browser }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  // Phone browsers have no getDisplayMedia; the stub below also lets the same page replay the other failures on demand.
  await context.addInitScript(() => {
    const state = { mode: "missing" as "missing" | "cancel" | "denied" | "other" };
    Object.assign(window, { screenQa: state });
    const devices = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: unknown };
    Object.defineProperty(devices, "getDisplayMedia", { configurable: true, get: () => state.mode === "missing" ? undefined : () => Promise.reject(Object.assign(new Error(state.mode === "denied" ? "Permission denied by system" : state.mode === "cancel" ? "Permission denied" : "boom"), { name: state.mode === "other" ? "NotReadableError" : "NotAllowedError" })) });
  });
  const page = await context.newPage();
  let project: Project | undefined;
  try {
    await login(context, managerFile);
    project = await createProject(page);
    const meeting = await createMeeting(page, project.id);
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    const share = room(page).getByRole("button", { name: tr.screenShareUnavailable, exact: true });
    await expect(share).toBeVisible(); await expect(share).toBeEnabled();
    await share.tap();
    await expect(page.getByText(tr.screenShareUnsupported, { exact: true })).toBeVisible();
    await screenshot(page, "room-ux-screenshare-unsupported");
    expect(await room(page).locator("video").count()).toBe(0);

    for (const [mode, message] of [["cancel", tr.screenShareCancelled], ["denied", tr.screenShareDenied], ["other", tr.screenShareFailed]] as const) {
      await page.evaluate(value => { (window as unknown as { screenQa: { mode: string } }).screenQa.mode = value; }, mode);
      const button = room(page).getByRole("button", { name: tr.screen, exact: true });
      await expect(button).toBeVisible();
      await button.tap();
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      await expect(button).toBeEnabled();
    }
  } finally { if (project) await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); await context.close(); }
});

test("a shared screen takes priority on a phone and returns to the normal grid afterwards", async ({ browser }) => {
  test.setTimeout(150000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 900 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const a = await managerContext.newPage(), b = await memberContext.newPage();
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(a); await b.goto("/dashboard");
    const member = (await api(b, "GET", "/auth/me")).json as { id: string };
    psql(`WITH membership AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(project.id)}','${uuid(member.id)}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM membership`);
    const meeting = await createMeeting(a, project.id);
    await a.goto(roomHref(project.slug, meeting.id)); await b.goto(roomHref(project.slug, meeting.id));
    await join(a); await join(b);
    await a.getByRole("button", { name: tr.screen, exact: true }).click();
    // The phone watches the desktop's screen: a screen-share video appears, large, above the strip of participants.
    const shared = b.locator("[data-meeting-room] video");
    await expect(shared).toHaveCount(1, { timeout: 20000 });
    const screenBox = (await shared.first().boundingBox())!;
    expect(screenBox.width).toBeGreaterThan(300);
    expect(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(b, "room-ux-watching-share-portrait");
    await b.setViewportSize({ width: 844, height: 390 });
    const landscapeBox = (await shared.first().boundingBox())!;
    expect(landscapeBox.width).toBeGreaterThan(landscapeBox.height);
    expect(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(b, "room-ux-watching-share-landscape");
    await a.getByRole("button", { name: tr.screenShareStop, exact: true }).click();
    await expect(shared).toHaveCount(0, { timeout: 15000 });
    await expect(b.locator("[data-meeting-room] [data-slot=avatar]")).toHaveCount(2);
  } finally {
    if (project) await api(a, "POST", `/projects/${project.id}/archive`).catch(() => {});
    await managerContext.close(); await memberContext.close();
  }
});
