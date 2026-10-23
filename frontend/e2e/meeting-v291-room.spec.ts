import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { meetingAccount, openParticipantMenu, readGains, recordGains } from "./meeting-fixture";
import { REJECTED_STATE } from "./consent-state";
import { localizeHref } from "../src/i18n/routing";
import type { Project } from "../src/features/projects/types";
import type { Meeting } from "../src/features/meetings/types";
import tr from "../src/i18n/meetings/tr.json";

// V2.9.1 room acceptance on the real API and the self-hosted LiveKit: the attendee list without a sideways scrollbar, the
// "hear myself" microphone check, the participant menu with its local volume, the chat, ending a screen share and the movable mini window.
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
async function createProject(page: Page) {
  await page.goto("/projects");
  const result = await api(page, "POST", "/projects", { name: `V291 Room ${Date.now()}`, projectTypes: ["WEB"] });
  expect(result.status).toBe(201); return result.json as Project;
}
async function createMeeting(page: Page, projectId: string) {
  const now = Date.now();
  const result = await api(page, "POST", `/projects/${projectId}/meetings`, { title: `V291 room ${now}`, description: "Room acceptance", startsAt: new Date(now + 1000).toISOString(), endsAt: new Date(now + 7200_000).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [] });
  expect(result.status).toBe(201); const meeting = result.json as Meeting;
  expect((await api(page, "POST", `/projects/${projectId}/meetings/${meeting.id}/start`)).status).toBe(200);
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
const room = (page: Page) => page.locator("[data-meeting-room]");
const mini = (page: Page) => page.locator("[data-meeting-mini]");
const appPush = (page: Page, href: string) => page.evaluate(url => (window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push(url), href);
async function archive(page: Page, project?: Project) { if (project) await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }

test("attendee list of the form has no sideways scrollbar at any width and its info text is one line", async ({ page, context }) => {
  test.setTimeout(120000);
  await login(context, managerFile);
  const project = await createProject(page);
  try {
    const memberContext = await page.context().browser()!.newContext({ storageState: REJECTED_STATE }); const other = await memberContext.newPage();
    await login(memberContext, memberFile); await other.goto("/dashboard");
    addMember(project.id, ((await api(other, "GET", "/auth/me")).json as { id: string }).id); await memberContext.close();
    for (const [width, height] of [[320, 700], [375, 800], [768, 1000], [1024, 800], [1440, 900]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto(localizeHref(`/projects/${project.slug}/meetings/new`, "tr"));
      const list = page.getByRole("list", { name: tr.attendees, exact: true });
      await expect(list).toBeVisible();
      const sizes = await list.evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
      expect(sizes.scroll, `no sideways scrollbar at ${width}px`).toBeLessThanOrEqual(sizes.client);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `page does not scroll sideways at ${width}px`).toBe(true);
      if (width >= 1024) {
        const info = page.getByText(tr.memberAccess, { exact: true });
        const lines = await info.evaluate(element => Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)));
        expect(lines, `info text is one line at ${width}px`).toBe(1);
      }
    }
    await screenshot(page, "v291-form-attendees-desktop");
  } finally { await archive(page, project); }
});

test("microphone check: hearing yourself is off by default, local only, and everything is disconnected again", async ({ browser }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 900 } });
  // Records which nodes feed the loudspeakers and which AudioContexts are still open.
  await context.addInitScript(() => {
    const feeding = new Set<AudioNode>(), contexts: AudioContext[] = []; Object.assign(window, { qaFeeding: feeding, qaContexts: contexts });
    const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown, disconnect = AudioNode.prototype.disconnect as (this: AudioNode, ...args: unknown[]) => void;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) { if (args[0] instanceof AudioDestinationNode) feeding.add(this); return connect.apply(this, args); } as typeof AudioNode.prototype.connect;
    AudioNode.prototype.disconnect = function (this: AudioNode, ...args: unknown[]) { if (args.length === 0 || args[0] instanceof AudioDestinationNode) feeding.delete(this); return disconnect.apply(this, args); } as typeof AudioNode.prototype.disconnect;
    const Original = window.AudioContext; window.AudioContext = class extends Original { constructor(...args: ConstructorParameters<typeof AudioContext>) { super(...args); contexts.push(this); } };
  });
  const page = await context.newPage(); let project: Project | undefined;
  try {
    await login(context, managerFile); project = await createProject(page);
    const meeting = await createMeeting(page, project.id);
    await page.goto(roomHref(project.slug, meeting.id));
    const check = page.getByRole("region", { name: tr.micCheck });
    const feeding = () => page.evaluate(() => (window as unknown as { qaFeeding: Set<AudioNode> }).qaFeeding.size);
    const openContexts = () => page.evaluate(() => (window as unknown as { qaContexts: AudioContext[] }).qaContexts.filter(context => context.state !== "closed").length);
    const hear = check.getByTestId("hear-self");
    await expect(hear).toBeDisabled(); // nothing to hear before the test runs
    await check.getByRole("button", { name: tr.testMicrophone, exact: true }).click();
    await expect(check.getByText(tr.micActive)).toBeVisible({ timeout: 15000 });
    await expect(hear).toBeEnabled(); await expect(hear).not.toBeChecked(); expect(await feeding(), "off by default: nothing reaches the loudspeakers").toBe(0);
    await hear.click(); await expect(hear).toBeChecked(); expect(await feeding()).toBe(1);
    expect((await new AxeBuilder({ page }).include("[data-testid=hear-self]").include("[role=region]").analyze()).violations, "the microphone check has no accessibility violations").toEqual([]);
    await screenshot(page, "v291-mic-hear-self");
    await hear.click(); await expect(hear).not.toBeChecked(); expect(await feeding()).toBe(0);
    await hear.click(); expect(await feeding()).toBe(1);
    // Stopping the test closes everything; starting it again begins with the loudspeakers off.
    await check.getByRole("button", { name: tr.stopTest, exact: true }).click();
    await expect.poll(feeding).toBe(0); await expect.poll(openContexts).toBe(0);
    await check.getByRole("button", { name: tr.testMicrophone, exact: true }).click(); await expect(check.getByText(tr.micActive)).toBeVisible({ timeout: 15000 });
    await expect.poll(feeding).toBe(0);
    // Joining ends the test and its playback; nothing of it keeps running in the call.
    await hear.click(); expect(await feeding()).toBe(1);
    await join(page);
    await expect.poll(feeding).toBe(0);
  } finally { await archive(page, project); await context.close(); }
});

test("participant menu, local volume and mute for me; chat grouping and focus; screen share stops without a false error", async ({ browser }) => {
  test.setTimeout(240000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 900 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 800 } });
  await memberContext.addInitScript(recordGains);
  // The screen share can be answered with a refusal on demand; otherwise the browser's own (fake) capture is used.
  await managerContext.addInitScript(() => {
    const state = { mode: "real" as "real" | "cancel" | "denied", tracks: [] as MediaStreamTrack[] }; Object.assign(window, { qaScreen: state });
    const original = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getDisplayMedia = async constraints => {
      if (state.mode === "cancel") throw new DOMException("Permission denied by user", "NotAllowedError");
      if (state.mode === "denied") throw new DOMException("Not allowed by the system", "NotAllowedError");
      const stream = await original(constraints); state.tracks.push(...stream.getTracks()); return stream;
    };
  });
  const a = await managerContext.newPage(), b = await memberContext.newPage(); let project: Project | undefined;
  a.setDefaultTimeout(15000); b.setDefaultTimeout(15000);
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(a); await b.goto("/dashboard");
    const member = (await api(b, "GET", "/auth/me")).json as { id: string; nickname: string }; addMember(project.id, member.id);
    const meeting = await createMeeting(a, project.id);
    await a.goto(roomHref(project.slug, meeting.id)); await b.goto(roomHref(project.slug, meeting.id));
    await join(a); await join(b);
    // Something has to be heard before it can be turned up or down: the manager opens the microphone.
    await room(a).getByRole("button", { name: tr.micOn, exact: true }).click(); await expect(room(a).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();

    // Right click on a tile or row opens the menu; Escape and an outside click close it.
    await expect.poll(() => readGains(b).then(values => values.length), { timeout: 20000 }).toBeGreaterThan(0);
    const menu = await openParticipantMenu(b);
    await b.keyboard.press("Escape"); await expect(menu).toBeHidden();
    const row = b.locator("[data-meeting-room] [data-participant]").filter({ hasNotText: `(${tr.you})` }).first();
    await row.click({ button: "right" }); await expect(b.locator("[data-participant-menu]")).toBeVisible();
    await room(b).getByRole("heading", { name: meeting.title, exact: true }).click(); await expect(b.locator("[data-participant-menu]")).toBeHidden();

    // Volume goes up to 200 % as a real gain; "mute for me" silences it and brings the earlier level back.
    const strongest = () => readGains(b).then(values => Math.max(...values, 0));
    const menuB = await openParticipantMenu(b), slider = menuB.locator("[data-volume-slider]");
    await slider.focus(); await slider.press("Home"); await expect.poll(strongest).toBe(0);
    await slider.press("End"); await expect.poll(strongest).toBe(2);
    for (let i = 0; i < 25; i++) await slider.press("ArrowLeft");
    expect((await new AxeBuilder({ page: b }).include("[data-participant-menu]").analyze()).violations, "the participant menu has no accessibility violations").toEqual([]);
    const level = Number(await slider.inputValue()); expect(level).toBeGreaterThan(100); expect(level).toBeLessThan(200);
    await expect.poll(strongest).toBe(Math.round(level) / 100);
    await menuB.getByRole("button", { name: tr.muteForMe, exact: true }).click(); await expect.poll(strongest).toBe(0);
    await openParticipantMenu(b).then(opened => opened.getByRole("button", { name: tr.unmuteForMe, exact: true }).click());
    await expect.poll(strongest).toBe(Math.round(level) / 100);
    // The volume is mine alone: the speaker's own side and the third party are not touched, and the person is still connected.
    await expect(a.locator("[data-meeting-room] [data-participant]").filter({ hasText: member.nickname })).toBeVisible();
    await b.keyboard.press("Escape");

    // Chat: the box keeps focus after sending, the page does not jump, one author's consecutive messages share one header.
    await room(a).getByRole("button", { name: tr.chat, exact: true }).click(); await room(b).getByRole("button", { name: tr.chat, exact: true }).click();
    const box = a.getByRole("textbox", { name: tr.message, exact: true }), boxB = b.getByRole("textbox", { name: tr.message, exact: true });
    const gap = () => a.waitForTimeout(900); // the server allows one chat message per 750 ms
    const scrollBefore = await a.evaluate(() => window.scrollY);
    for (const text of ["first from a", "second from a", "third from a"]) {
      await box.fill(text); await a.getByRole("button", { name: tr.send, exact: true }).click();
      await expect(a.getByText(text, { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(box).toBeFocused(); expect(await a.evaluate(() => window.scrollY), "the page does not jump").toBe(scrollBefore); await gap();
    }
    await boxB.fill("reply from b"); await b.getByRole("button", { name: tr.send, exact: true }).click();
    await expect(a.getByText("reply from b", { exact: true })).toBeVisible({ timeout: 15000 }); await gap();
    await box.fill("fourth from a"); await box.press("Enter"); await expect(a.getByText("fourth from a", { exact: true })).toBeVisible({ timeout: 15000 });
    const groups = a.locator("[data-meeting-room] [data-message-group]");
    await expect(groups).toHaveCount(3);
    await expect(groups.nth(0).locator("[data-message-id]")).toHaveCount(3);
    await expect(groups.nth(1).locator("[data-message-id]")).toHaveCount(1);
    await expect(groups.nth(2).locator("[data-message-id]")).toHaveCount(1);
    await expect(groups.nth(0).locator("[data-message-author]")).toHaveCount(1);
    await expect(groups.nth(0).getByText(tr.today)).toHaveCount(0); // the day label is a separator between groups, not part of one
    await screenshot(a, "v291-chat-grouping");

    // Screen share: a refused or cancelled request, the product's own stop and the browser's own "stop sharing" never show the false error.
    const failed = a.getByText(tr.error, { exact: true });
    const screenButton = (name: string) => room(a).getByRole("button", { name, exact: true });
    await a.evaluate(() => { (window as unknown as { qaScreen: { mode: string } }).qaScreen.mode = "cancel"; });
    await screenButton(tr.screen).click(); await expect(a.getByText(tr.screenShareCancelled)).toBeVisible({ timeout: 10000 }); await expect(failed).toHaveCount(0);
    await a.evaluate(() => { (window as unknown as { qaScreen: { mode: string } }).qaScreen.mode = "real"; });
    await screenButton(tr.screen).click(); await expect(screenButton(tr.screenShareStop)).toBeVisible({ timeout: 20000 });
    await expect(b.locator("[data-meeting-room] video").first()).toBeVisible({ timeout: 20000 });
    await screenButton(tr.screenShareStop).click(); await expect(screenButton(tr.screen)).toBeVisible({ timeout: 10000 }); await expect(failed).toHaveCount(0);
    await screenButton(tr.screen).click(); await expect(screenButton(tr.screenShareStop)).toBeVisible({ timeout: 20000 });
    await a.evaluate(() => { for (const track of (window as unknown as { qaScreen: { tracks: MediaStreamTrack[] } }).qaScreen.tracks) { track.stop(); track.dispatchEvent(new Event("ended")); } });
    await expect(screenButton(tr.screen)).toBeVisible({ timeout: 15000 }); await expect(failed).toHaveCount(0);
    // A second click on "stop" while it is ending, or stopping something that already ended, is no failure either.
    await screenButton(tr.screen).click(); await expect(screenButton(tr.screenShareStop)).toBeVisible({ timeout: 20000 });
    await screenButton(tr.screenShareStop).dblclick(); await expect(screenButton(tr.screen)).toBeVisible({ timeout: 10000 }); await expect(failed).toHaveCount(0);
  } finally { await archive(a, project); await managerContext.close(); await memberContext.close(); }
});

test("mini window: movable by mouse and keyboard, stays inside the screen, remembers its place, call keeps its single session", async ({ browser }) => {
  test.setTimeout(180000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(); let project: Project | undefined;
  try {
    await login(context, managerFile); project = await createProject(page);
    const meeting = await createMeeting(page, project.id);
    let joins = 0, sockets = 0;
    page.on("request", request => { if (request.method() === "POST" && request.url().endsWith(`/meetings/${meeting.id}/join`)) joins++; });
    page.on("websocket", socket => { if (socket.url().includes("7880")) sockets++; });
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    await room(page).getByRole("button", { name: tr.micOn, exact: true }).click(); await expect(room(page).getByRole("button", { name: tr.micOff, exact: true })).toBeVisible();
    await appPush(page, localizeHref("/projects", "tr")); await expect(mini(page)).toBeVisible();
    const handle = mini(page).locator("[data-mini-handle]");
    const box = async () => (await mini(page).boundingBox())!;
    const start = await box(); const grip = (await handle.boundingBox())!;
    const from = { x: grip.x + 12, y: grip.y + grip.height / 2 };
    // Dragging by mouse moves the window with the pointer.
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x - 150, from.y - 100, { steps: 8 }); await page.mouse.up();
    const moved = await box(); expect(Math.abs(moved.x - (start.x - 150))).toBeLessThan(3); expect(Math.abs(moved.y - (start.y - 100))).toBeLessThan(3);
    await expect(mini(page)).toHaveAttribute("data-dragged", "");
    expect((await new AxeBuilder({ page }).include("[data-meeting-mini]").analyze()).violations, "the mini window has no accessibility violations").toEqual([]);
    await screenshot(page, "v291-mini-window-dragged");
    // It cannot be dragged out of the screen.
    await page.mouse.move(moved.x + 12, moved.y + 20); await page.mouse.down(); await page.mouse.move(-500, -500, { steps: 6 }); await page.mouse.up();
    const corner = await box(); expect(corner.x).toBeGreaterThanOrEqual(0); expect(corner.y).toBeGreaterThanOrEqual(0);
    await page.mouse.move(corner.x + 12, corner.y + 20); await page.mouse.down(); await page.mouse.move(5000, 5000, { steps: 6 }); await page.mouse.up();
    const far = await box(); expect(far.x + far.width).toBeLessThanOrEqual(1280 + 0.5); expect(far.y + far.height).toBeLessThanOrEqual(800 + 0.5);
    // Keyboard: arrows move by 16 px, Shift by 64 px, Home returns it to its place.
    await handle.focus(); const before = await box(); await handle.press("ArrowLeft"); expect(Math.round(before.x - (await box()).x)).toBe(16);
    await handle.press("Shift+ArrowUp"); expect(Math.round(before.y - (await box()).y)).toBe(64);
    // The place is remembered across pages and reloads, while it is the same single call.
    const placed = await box();
    await appPush(page, localizeHref("/dashboard", "tr")); await expect(mini(page)).toBeVisible(); expect(Math.abs((await box()).x - placed.x)).toBeLessThan(2);
    // Controls of the window work without leaving the page: microphone toggles the real call.
    await mini(page).getByRole("button", { name: tr.micOff, exact: true }).click(); await expect(mini(page).getByRole("button", { name: tr.micOn, exact: true })).toBeVisible();
    await handle.focus(); await handle.press("Home");
    await expect(mini(page)).not.toHaveAttribute("data-dragged", "");
    expect(joins, "moving the window never joins again").toBe(1); expect(sockets).toBeGreaterThan(0);
    // Back into the room.
    await mini(page).getByRole("link", { name: tr.returnToMeeting, exact: true }).click(); await expect(room(page)).toBeVisible(); await expect(mini(page)).toHaveCount(0);
    expect(joins).toBe(1);
  } finally { await archive(page, project); await context.close(); }
});

test("mini window on a touch phone: dragged with a finger, kept inside the screen", async ({ browser }) => {
  test.setTimeout(150000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage(); let project: Project | undefined;
  try {
    await login(context, managerFile); project = await createProject(page);
    const meeting = await createMeeting(page, project.id);
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    await appPush(page, localizeHref("/projects", "tr")); await expect(mini(page)).toBeVisible();
    const box = async () => (await mini(page).boundingBox())!;
    const start = await box(), grip = (await mini(page).locator("[data-mini-handle]").boundingBox())!;
    const client = await context.newCDPSession(page);
    const point = { x: grip.x + 14, y: grip.y + grip.height / 2 };
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    for (let step = 1; step <= 8; step++) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point.x, y: point.y - step * 40 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const moved = await box();
    expect(start.y - moved.y, "the window followed the finger upwards").toBeGreaterThan(200);
    expect(moved.y).toBeGreaterThanOrEqual(0); expect(moved.x).toBeGreaterThanOrEqual(0); expect(moved.x + moved.width).toBeLessThanOrEqual(390 + 0.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await screenshot(page, "v291-mini-window-touch");
  } finally { await archive(page, project); await context.close(); }
});

test("mini window: the dragged place survives a reload (after joining again) and is pulled back inside a smaller screen", async ({ browser }) => {
  test.setTimeout(180000);
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); let project: Project | undefined;
  try {
    await login(context, managerFile); project = await createProject(page);
    const meeting = await createMeeting(page, project.id);
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    await appPush(page, localizeHref("/projects", "tr")); await expect(mini(page)).toBeVisible();
    const box = async () => (await mini(page).boundingBox())!;
    const grip = (await mini(page).locator("[data-mini-handle]").boundingBox())!;
    const from = { x: grip.x + 12, y: grip.y + grip.height / 2 };
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(700, 300, { steps: 8 }); await page.mouse.up();
    const placed = await box(); await expect(mini(page)).toHaveAttribute("data-dragged", "");
    const stored = JSON.parse((await page.evaluate(() => localStorage.getItem("pda:meeting-mini-window:v1")))!) as { x: number; y: number };
    expect(Math.abs(stored.x - placed.x)).toBeLessThan(2); expect(Math.abs(stored.y - placed.y)).toBeLessThan(2);

    // A reload ends the call (as it always did): nothing is shown until the person joins again; then the place is the same.
    await page.reload(); await expect(mini(page)).toHaveCount(0);
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    await appPush(page, localizeHref("/projects", "tr")); await expect(mini(page)).toBeVisible();
    await expect(mini(page)).toHaveAttribute("data-dragged", "");
    const again = await box(); expect(Math.abs(again.x - placed.x)).toBeLessThan(2); expect(Math.abs(again.y - placed.y)).toBeLessThan(2);

    // A smaller screen (a phone in landscape) pulls a place that no longer fits back inside the screen, and the stored place follows.
    await page.setViewportSize({ width: 600, height: 420 });
    await expect.poll(async () => { const b = await box(); return b.x >= 0 && b.y >= 0 && b.x + b.width <= 600.5 && b.y + b.height <= 420.5; }).toBe(true);
    // And a corrupt remembered value never breaks the window: it simply opens in its default place.
    await page.evaluate(() => localStorage.setItem("pda:meeting-mini-window:v1", "{not json"));
    await page.goto(roomHref(project.slug, meeting.id)); await join(page);
    await appPush(page, localizeHref("/projects", "tr")); await expect(mini(page)).toBeVisible();
    await expect(mini(page)).not.toHaveAttribute("data-dragged", "");
  } finally { await archive(page, project); await context.close(); }
});

test("mini window: shows the other person's real moving camera picture, and an avatar when nobody has a camera on", async ({ browser }) => {
  test.setTimeout(240000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 800 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"], viewport: { width: 1280, height: 800 } });
  const a = await managerContext.newPage(), b = await memberContext.newPage(); let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(a); await b.goto("/dashboard");
    addMember(project.id, ((await api(b, "GET", "/auth/me")).json as { id: string }).id);
    const meeting = await createMeeting(a, project.id);
    await a.goto(roomHref(project.slug, meeting.id)); await b.goto(roomHref(project.slug, meeting.id));
    await join(a); await join(b);
    await appPush(a, localizeHref("/projects", "tr")); await expect(mini(a)).toBeVisible();
    // Nobody has a camera on: the window shows the avatar, no video element.
    await expect(mini(a).locator("video")).toHaveCount(0);
    await expect(mini(a).locator("[data-mini-feed]")).toBeVisible();
    // The member turns the camera on: the window of the manager (who is on another page) now carries that real picture.
    await b.getByRole("button", { name: tr.cameraOn, exact: true }).click(); await expect(b.getByRole("button", { name: tr.cameraOff, exact: true })).toBeVisible();
    const video = mini(a).locator("video"); await expect(video).toHaveCount(1, { timeout: 20000 });
    // Real frames: the picture has a size, is playing, is not one flat colour, and keeps changing (the fake camera moves).
    const sample = () => video.evaluate(element => {
      const v = element as HTMLVideoElement, canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 32;
      const ctx = canvas.getContext("2d")!; ctx.drawImage(v, 0, 0, 32, 32); const data = ctx.getImageData(0, 0, 32, 32).data;
      let sum = 0, sumSquares = 0; const n = data.length / 4; for (let i = 0; i < data.length; i += 4) { const g = (data[i] + data[i + 1] + data[i + 2]) / 3; sum += g; sumSquares += g * g; }
      const mean = sum / n; return { width: v.videoWidth, height: v.videoHeight, playing: !v.paused && v.readyState >= 2, spread: Math.sqrt(Math.max(0, sumSquares / n - mean * mean)), signature: Array.from(data.slice(0, 256)).join(",") };
    });
    await expect.poll(async () => (await sample()).width, { timeout: 20000 }).toBeGreaterThan(0);
    const first = await sample(); expect(first.playing).toBe(true); expect(first.height).toBeGreaterThan(0); expect(first.spread, "not a flat colour").toBeGreaterThan(3);
    await expect.poll(async () => (await sample()).signature !== first.signature, { timeout: 15000 }).toBe(true);
    await screenshot(a, "v291-mini-window-live-picture");
    // The camera goes off again: back to the avatar, and the picture element is gone.
    await b.getByRole("button", { name: tr.cameraOff, exact: true }).click();
    await expect(mini(a).locator("video")).toHaveCount(0, { timeout: 20000 });
  } finally { await archive(a, project); await managerContext.close(); await memberContext.close(); }
});
