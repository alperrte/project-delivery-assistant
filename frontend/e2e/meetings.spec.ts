import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { meetingAccount, openParticipantMenu, readGains, recordGains, showPanel } from "./meeting-fixture";
import { REJECTED_STATE } from "./consent-state";
import { localizeHref, matchPath } from "../src/i18n/routing";
import type { Project } from "../src/features/projects/types";
import type { Meeting, MeetingInvite } from "../src/features/meetings/types";
import tr from "../src/i18n/meetings/tr.json";
import messages from "../src/i18n/messages/tr.json";
import AxeBuilder from "@axe-core/playwright";

// The suite-wide config has no media flags: without a fake camera/microphone/screen the room cannot publish anything on a
// machine with no (or a busy) device. Same flags as playwright.meetings.config.ts, so both entry points behave alike.
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
  expect(result.status(), "Existing QA account login; no registration mail is sent").toBe(200);
}
async function createProject(page: Page) {
  await page.goto("/projects");
  const result = await api(page, "POST", "/projects", { name: `Meeting QA ${Date.now()}`, projectTypes: ["WEB"] });
  expect(result.status).toBe(201); return result.json as Project;
}
async function createMeeting(page: Page, projectId: string, open = true, attendeeIds: string[] = []) {
  const now = Date.now();
  const result = await api(page, "POST", `/meetings`, { title: `Meeting QA ${now}`, description: "Real API and LiveKit acceptance", startsAt: new Date(now + (open ? 1000 : 3600_000)).toISOString(), endsAt: new Date(now + 7200_000).toISOString(), zoneId: "Europe/Istanbul", agenda: ["Review", "Decisions"], attendeeIds });
  expect(result.status).toBe(201); const meeting = result.json as Meeting;
  if (open) expect((await api(page, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
  return meeting;
}
const href = (slug: string, suffix = "") => localizeHref(`/meetings${suffix}`, "tr");
async function join(page: Page) { await page.getByRole("button", { name: tr.join, exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) })).toBeVisible({ timeout: 30000 }); }
async function screenshot(page: Page, name: string) { mkdirSync(path.join(__dirname, "../test-results/meetings-visual"), { recursive: true }); await page.screenshot({ path: path.join(__dirname, `../test-results/meetings-visual/${name}.png`), fullPage: true }); }

test("room entry reloads the document to apply route-scoped media permissions", async ({ page, context }) => {
  test.setTimeout(60000);
  await login(context, managerFile);
  const project = await createProject(page);
  try {
    const meeting = await createMeeting(page, project.id);
    await page.goto(href(project.slug, `/${meeting.id}`));
    await expect(page.getByRole("link", { name: tr.join, exact: true })).toBeVisible();
    expect(await page.evaluate(() => (document as unknown as { featurePolicy: { allowsFeature: (name: string) => boolean } }).featurePolicy.allowsFeature("camera"))).toBe(false);
    await page.evaluate(() => { Object.assign(window, { meetingEntryOldDocument: true }); });
    const roomPath = href(project.slug, `/${meeting.id}/room`);
    const documentResponse = page.waitForResponse(response => response.request().resourceType() === "document" && new URL(response.url()).pathname === roomPath, { timeout: 10000 });
    await page.getByRole("link", { name: tr.join, exact: true }).click();
    expect((await documentResponse).status()).toBe(200);
    await expect(page.locator("[data-meeting-room]")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { meetingEntryOldDocument?: boolean }).meetingEntryOldDocument)).toBeUndefined();
    expect(await page.evaluate(() => {
      const policy = (document as unknown as { featurePolicy: { allowsFeature: (name: string) => boolean } }).featurePolicy;
      return policy.allowsFeature("camera") && policy.allowsFeature("microphone");
    })).toBe(true);
    await join(page);
  } finally { await api(page, "POST", `/projects/${project.id}/archive`); }
});

test("real create/edit/cancel, sidebar, calendars, localized responsive form and security headers", async ({ page, context }) => {
  test.setTimeout(180000); await login(context, managerFile); const project = await createProject(page);
  try {
    await page.goto(href(project.slug, "/new?type=independent"));
    await expect(page.locator("#meeting-title")).toBeVisible();
    await expect(page.getByRole("link", { name: tr.back, exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: messages.common.breadcrumb, exact: true })).toHaveCount(0);
    await page.getByLabel(tr.title, { exact: true }).fill("Frontend scheduled meeting");
    await page.getByLabel(tr.description, { exact: true }).fill("Agenda created through the real form");
    await page.getByLabel(tr.agendaItem.replace("{number}", "1"), { exact: true }).fill("Delivery review");
    await page.getByRole("button", { name: tr.plan, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Frontend scheduled meeting", exact: true })).toBeVisible();
    const id = matchPath(new URL(page.url()).pathname)!.params.meetingId;
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    const persisted = await api(page, "GET", `/meetings/${id}`);
    expect(persisted.status).toBe(200); expect((persisted.json as Meeting).agenda).toEqual(["Delivery review"]);
    await page.goto(localizeHref(`/projects/${project.slug}/meetings/calendar`, "tr")); await expect(page.locator("[data-calendar-meetings]").first()).toBeVisible();
    await page.goto("/calendar"); await expect(page.locator("[data-calendar-meetings]").first()).toBeVisible();
    await page.goto(href(project.slug, `/${id}/edit`)); await page.getByLabel(tr.title, { exact: true }).fill("Updated meeting"); await page.getByRole("button", { name: tr.save, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Updated meeting", exact: true })).toBeVisible();
    await page.getByRole("button", { name: tr.cancelMeeting, exact: true }).click(); await page.getByRole("button", { name: tr.confirm, exact: true }).click();
    await expect(page.getByText(tr.status.CANCELLED, { exact: true }).first()).toBeVisible();
    const notes = (await api(page, "GET", "/notifications?read=false&size=100")).json as { content: { id: string; resourceId: string }[] };
    const note = notes.content.find(item => item.resourceId === id)!; expect(note).toBeTruthy();
    await page.mouse.move(700, 20); await page.getByRole("button", { name: "Bildirimler", exact: true }).click();
    await page.locator(`[data-notification-id="${note.id}"]`).getByRole("link", { name: tr.openMeeting, exact: true }).click();
    await expect.poll(() => matchPath(new URL(page.url()).pathname)?.params.meetingId).toBe(id);
    for (const locale of ["tr", "en", "de"] as const) {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto(localizeHref(`/meetings/new?type=independent`, locale));
      await expect(page.locator("#meeting-title")).toBeVisible();
      await expect(page.locator('button[type="submit"][value="plan"]')).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await screenshot(page, `form-${locale}-320`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(href(project.slug, "/new?type=independent")); await expect(page.getByRole("button", { name: tr.plan, exact: true })).toBeEnabled(); await screenshot(page, "form-tr-1440");
    expect((await new AxeBuilder({ page }).include("[data-meeting-form]").analyze()).violations).toEqual([]);
    await page.emulateMedia({ reducedMotion: "reduce" }); await page.mouse.move(700, 20);
    await page.locator(".theme-toggle").getByRole("button", { name: "Koyu", exact: true }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect((await new AxeBuilder({ page }).include("[data-meeting-form]").analyze()).violations).toEqual([]);
    await screenshot(page, "form-tr-1440-dark");
    await page.setViewportSize({ width: 768, height: 1000 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await screenshot(page, "form-tr-768-dark");
    const regular = await context.request.get("http://localhost:3000/tr/ana-sayfa"); expect(regular.headers()["permissions-policy"]).toContain("camera=()");
    const guest = await context.request.get("http://localhost:3000/tr/toplanti-misafir"); expect(guest.headers()["permissions-policy"]).toContain("camera=(self)"); expect(guest.headers()["referrer-policy"]).toBe("no-referrer");
  } finally { await api(page, "POST", `/projects/${project.id}/archive`); }
});

test("two real participants: media, mention/chat, guest revoke semantics, moderation denial and secure epoch reconnect", async ({ browser }) => {
  test.setTimeout(240000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1440, height: 1000 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"] });
  const guestContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"] });
  await memberContext.addInitScript(() => {
    const peers: RTCPeerConnection[] = [];
    Object.assign(window, { meetingQaPeers: peers });
    const Original = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends Original {
      constructor(...args: ConstructorParameters<typeof RTCPeerConnection>) { super(...args); peers.push(this); }
    };
  });
  await memberContext.addInitScript(recordGains);
  await managerContext.addInitScript(() => {
    const tracks: MediaStreamTrack[] = [];
    Object.assign(window, { meetingQaTracks: tracks });
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => { const stream = await original(constraints); tracks.push(...stream.getTracks()); return stream; };
  });
  const a = await managerContext.newPage(), b = await memberContext.newPage(), g = await guestContext.newPage();
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(a); await b.goto("/dashboard");
    const member = (await api(b, "GET", "/auth/me")).json as { id: string; nickname: string };
    // TEST-ONLY fixture membership, restricted to this newly created QA project/account.
    psql(`WITH membership AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(project.id)}','${uuid(member.id)}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM membership`);
    const meeting = await createMeeting(a, project.id, true, [member.id]);
    await a.goto(href(project.slug, `/${meeting.id}/room`));
    await b.goto(href(project.slug, `/${meeting.id}`));
    await b.getByRole("link", { name: tr.join, exact: true }).click();
    await expect(b.locator("[data-meeting-room]")).toBeVisible();
    await join(a); await join(b);
    await a.getByRole("button", { name: tr.micOn, exact: true }).click(); await a.getByRole("button", { name: tr.cameraOn, exact: true }).click();
    await expect(a.getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    await expect(b.locator("video").first()).toBeVisible({ timeout: 15000 });
    await expect.poll(() => b.locator("audio").count()).toBeGreaterThan(0);
    await expect.poll(() => b.evaluate(async () => {
      const reports = await Promise.all((window as unknown as { meetingQaPeers: RTCPeerConnection[] }).meetingQaPeers.map(peer => peer.getStats()));
      let audio = false, video = false;
      for (const report of reports) report.forEach(stat => {
        if (stat.type === "inbound-rtp" && stat.kind === "audio" && stat.bytesReceived > 0 && stat.totalSamplesReceived > 0) audio = true;
        if (stat.type === "inbound-rtp" && stat.kind === "video" && stat.framesDecoded > 0) video = true;
      });
      return audio && video;
    }), { timeout: 15000 }).toBe(true);
    await b.getByRole("button", { name: tr.micOn, exact: true }).click();
    await showPanel(a, tr.participants);
    await (await openParticipantMenu(a, member.nickname)).getByRole("button", { name: tr.muteParticipant, exact: true }).click();
    await expect(b.getByRole("button", { name: tr.micOn, exact: true })).toBeVisible();
    await a.getByRole("button", { name: tr.screen, exact: true }).click(); await expect(b.locator("video")).toHaveCount(2, { timeout: 15000 });
    await a.getByRole("button", { name: tr.screenShareStop, exact: true }).click(); await expect(b.locator("video")).toHaveCount(1, { timeout: 15000 });
    await showPanel(a, tr.chat); await showPanel(b, tr.chat);
    await a.getByRole("textbox", { name: tr.message, exact: true }).fill("@");
    await a.getByRole("listbox", { name: tr.mentions, exact: true }).getByRole("option", { name: member.nickname, exact: true }).click();
    const mentionText = await a.getByRole("textbox", { name: tr.message, exact: true }).inputValue();
    const messageText = `${mentionText}Real SFU chat`;
    await a.getByRole("textbox", { name: tr.message, exact: true }).fill(messageText); await a.getByRole("button", { name: tr.send, exact: true }).click(); await expect(b.getByText(messageText, { exact: true })).toBeVisible({ timeout: 15000 });
    await showPanel(b, tr.participants);
    // Per-person volume is local and goes 0-200 %: the remote audio runs through a real Web Audio gain, read back from the page itself.
    const volumeMenu = await openParticipantMenu(b), slider = volumeMenu.locator("[data-volume-slider]");
    await expect.poll(() => readGains(b)).toContain(1);
    await slider.press("Home"); await expect.poll(() => readGains(b)).toContain(0);
    await slider.press("End"); await expect.poll(() => readGains(b)).toContain(2); // a real boost: twice the received level
    await volumeMenu.getByRole("button", { name: tr.volumeReset, exact: true }).click(); await expect.poll(async () => (await readGains(b)).filter(value => value === 0 || value === 2)).toEqual([]);
    await b.keyboard.press("Escape");
    await showPanel(b, tr.chat);
    const inviteResponse = await api(a, "POST", `/meetings/${meeting.id}/invites`, { expiresAt: new Date(Date.now() + 3600000).toISOString(), maxUses: 2 }); expect(inviteResponse.status).toBe(201); const invite = inviteResponse.json as MeetingInvite;
    const guestStatuses: string[] = [];
    g.on("response", response => { const url = new URL(response.url()); if (url.origin === "http://localhost:8080") guestStatuses.push(`${response.request().method()} ${url.pathname} ${response.status()}`); });
    g.on("requestfailed", request => { const url = new URL(request.url()); if (url.origin === "http://localhost:8080") guestStatuses.push(`${request.method()} ${url.pathname} ${request.failure()?.errorText}`); });
    const previewResponse = g.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/meetings/guest/preview" && response.request().method() === "POST", { timeout: 15000 });
    await g.goto(`${localizeHref("/meeting-guest", "tr")}#${invite.token}`);
    const response = await previewResponse.catch(() => { throw new Error(`Guest preview transport: ${guestStatuses.join(", ")}`); });
    expect(response.status(), "Real guest preview response").toBe(200);
    await expect(g.getByRole("heading", { name: meeting.title, exact: true })).toBeVisible(); expect(new URL(g.url()).hash).toBe("");
    await g.getByLabel(tr.displayName, { exact: true }).fill("QA Guest"); await g.getByRole("button", { name: tr.continue, exact: true }).click(); await join(g);
    await g.reload(); await join(g);
    expect((await api(a, "DELETE", `/meetings/${meeting.id}/invites/${invite.id}`)).status).toBe(204);
    await expect(g.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) })).toBeVisible();
    expect((await api(b, "POST", `/meetings/${meeting.id}/end`)).status).toBe(403);
    expect((await api(b, "GET", `/meetings/${meeting.id}/invites`)).status).toBe(403);
    await expect(b.getByRole("button", { name: tr.endForAll, exact: true })).toHaveCount(0);
    const participantResponse = await api(a, "GET", `/meetings/${meeting.id}/participants`);
    const guest = (participantResponse.json as { id: string; guest: boolean }[]).find(p => p.guest)!;
    const oldEpoch = ((await api(a, "GET", `/meetings/${meeting.id}`)).json as Meeting).roomEpoch;
    expect((await api(b, "POST", `/meetings/${meeting.id}/participants/${guest.id}/mute`)).status).toBe(403);
    await showPanel(a, tr.participants);
    await (await openParticipantMenu(a, "QA Guest")).getByRole("button", { name: tr.kick, exact: true }).click();
    await a.getByRole("dialog").getByRole("button", { name: tr.confirm, exact: true }).click();
    await expect(g.getByRole("heading", { name: tr.phase.removed, exact: true })).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => ((await api(a, "GET", `/meetings/${meeting.id}`)).json as Meeting).roomEpoch).toBeGreaterThan(oldEpoch);
    await expect(a.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) })).toBeVisible({ timeout: 45000 });
    await expect(b.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) })).toBeVisible({ timeout: 45000 });
    await expect(b.getByText(messageText, { exact: true })).toBeVisible();
    psql(`UPDATE meetings SET starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' WHERE id='${uuid(meeting.id)}'`);
    await expect(b.getByText(tr.overtime, { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(b.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) })).toBeVisible();
    await a.setViewportSize({ width: 390, height: 844 }); expect(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await screenshot(a, "room-390"); await a.setViewportSize({ width: 1440, height: 1000 });
    await screenshot(a, "room-1440");
    expect((await api(a, "POST", `/meetings/${meeting.id}/end`)).status).toBe(200);
    await expect(b.getByRole("heading", { name: tr.phase.closed, exact: true })).toBeVisible({ timeout: 15000 });
    await expect(a.getByRole("heading", { name: tr.phase.closed, exact: true })).toBeVisible({ timeout: 15000 });
    expect(await a.evaluate(() => (window as unknown as { meetingQaTracks: MediaStreamTrack[] }).meetingQaTracks.every(track => track.readyState === "ended"))).toBe(true);
  } finally { if (project) await api(a, "POST", `/projects/${project.id}/archive`).catch(() => {}); await managerContext.close(); await memberContext.close(); await guestContext.close(); }
});

test("saved invite metadata survives reload without secrets; invalid guest link remains public", async ({ page, context }) => {
  await login(context, managerFile); const project = await createProject(page);
  try {
    const meeting = await createMeeting(page, project.id);
    await page.goto(href(project.slug, `/${meeting.id}`));
    await page.getByRole("button", { name: tr.createInvite, exact: true }).click();
    await expect(page.getByRole("button", { name: tr.copy, exact: true })).toBeVisible();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: tr.copy, exact: true }).click(); await expect(page.getByRole("button", { name: tr.copied, exact: true })).toBeVisible();
    const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()));
    expect(copied.pathname).toBe(localizeHref("/meeting-guest", "tr")); expect(copied.hash.length > 30).toBe(true);
    await page.reload();
    await expect(page.getByRole("button", { name: tr.revokeInvite, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: tr.copy, exact: true })).toHaveCount(0);
    const revoke = page.getByRole("button", { name: tr.revokeInvite, exact: true });
    await revoke.click(); await page.getByRole("dialog").press("Escape"); await expect(revoke).toBeFocused();
    await revoke.press("Enter"); await page.getByRole("dialog").getByRole("button", { name: tr.confirm, exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByText(tr.inviteRevoked, { exact: true })).toBeVisible();
    const metadata = (await api(page, "GET", `/meetings/${meeting.id}/invites`)).json as { content: Record<string, unknown>[] };
    expect(metadata.content[0].revoked).toBe(true); expect(metadata.content[0]).not.toHaveProperty("token"); expect(metadata.content[0]).not.toHaveProperty("tokenHash");
    expect((await api(page, "POST", `/meetings/${meeting.id}/end`)).status).toBe(200);
  } finally { await api(page, "POST", `/projects/${project.id}/archive`); }
  await context.clearCookies(); await page.goto(localizeHref("/meeting-guest", "tr")); await expect(page.getByText(tr.invalidInvite, { exact: true })).toBeVisible(); expect(matchPath(new URL(page.url()).pathname)?.route).toBe("/meeting-guest");
  const response = page.waitForResponse(result => result.url().endsWith("/meetings/guest/preview") && result.request().method() === "POST");
  await page.evaluate(() => { window.location.hash = "test-only-invalid-invitation"; });
  expect((await response).status()).toBe(403); await expect(page.getByText(tr.invalidInvite, { exact: true })).toBeVisible(); expect(new URL(page.url()).hash).toBe("");
  let refreshCalls = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/v1/auth/refresh") refreshCalls++; });
  await page.goto(localizeHref("/meeting-guest/00000000-0000-0000-0000-000000000001", "tr"));
  await expect(page.getByText(tr.sessionExpired, { exact: true })).toBeVisible(); expect(refreshCalls).toBe(0);
});


test("unified calendar keeps legacy project links working and shows the same meetings whichever project is selected", async ({ page, context }) => {
  test.setTimeout(120000);
  await login(context, meetingAccount("manager", { fresh: true })); // the calendar lists everything the user has: an account of its own holds only this meeting
  const first = await createProject(page);
  const second = await createProject(page);
  try {
    const meeting = await createMeeting(page, first.id, false);
    for (const locale of ["tr", "en", "de"] as const) {
      await page.goto(localizeHref(`/projects/${first.slug}/meetings/calendar`, locale));
      await expect.poll(() => matchPath(new URL(page.url()).pathname)?.route).toBe("/calendar");
      expect(new URL(page.url()).searchParams.get("project")).toBe(first.slug);
      await expect(page.locator("#calendar-project")).toContainText(first.name);
      await page.locator('button:has([data-calendar-meetings])').first().click();
      const detail = page.locator(`a[href="${localizeHref(`/meetings/${meeting.id}`, locale)}"]`);
      await expect(detail).toBeVisible();
      await expect(page.locator(`a[href="${localizeHref(`/projects/${first.slug}/meetings/calendar`, locale)}"]`)).toHaveCount(0);
      await page.setViewportSize({ width: locale === "tr" ? 1440 : locale === "en" ? 320 : 390, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await screenshot(page, `unified-calendar-${locale}`);
      await page.reload();
      await expect(page.locator("#calendar-project")).toContainText(first.name);
    }
    await page.locator("#calendar-project").click();
    await page.getByRole("option", { name: second.name, exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("project")).toBe(second.slug);
    await expect(page.locator("#calendar-project")).toContainText(second.name);
    // Meetings belong to the user: switching the project changes nothing about them.
    await expect(page.locator("[data-calendar-meetings]").first()).toBeVisible();
    await page.reload();
    await expect(page.locator("#calendar-project")).toContainText(second.name);
    await page.goto(href(first.slug));
    // Two links lead to the calendar (the menu and the list's own button); at the phone width left by the loop above only the button is shown.
    await page.locator(`a[href="${localizeHref("/calendar", "tr")}"]:visible`).first().click();
    await expect.poll(() => matchPath(new URL(page.url()).pathname)?.route).toBe("/calendar");
    // The project the user chose last is remembered; the meetings list never carried it.
    await expect(page.locator("#calendar-project")).toContainText(second.name);
  } finally {
    await api(page, "POST", `/projects/${first.id}/archive`);
    await api(page, "POST", `/projects/${second.id}/archive`);
  }
});
