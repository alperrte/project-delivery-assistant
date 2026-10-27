import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { meetingAccount, showPanel } from "./meeting-fixture";
import { REJECTED_STATE } from "./consent-state";
import { localizeHref } from "../src/i18n/routing";
import type { Project } from "../src/features/projects/types";
import type { Meeting, MeetingInvite, MeetingMessage, MeetingParticipant } from "../src/features/meetings/types";
import tr from "../src/i18n/meetings/tr.json";

// V2.9.2: replies, emoji reactions and keyboard mention choice in the meeting chat, with three real browsers (manager, member, guest) on the real
// API, PostgreSQL and the self-hosted LiveKit. Same media flags as the other meeting suites.
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
function addMember(projectId: string, userId: string) {
  // TEST-ONLY fixture membership, restricted to this newly created QA project/account.
  psql(`WITH membership AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(projectId)}','${uuid(userId)}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM membership`);
}
const connected = (page: Page) => page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) });
async function join(page: Page) { await page.getByRole("button", { name: tr.join, exact: true }).click(); await expect(connected(page)).toBeVisible({ timeout: 30000 }); }
async function screenshot(page: Page, name: string) { mkdirSync(path.join(__dirname, "../test-results/meetings-visual"), { recursive: true }); await page.screenshot({ path: path.join(__dirname, `../test-results/meetings-visual/${name}.png`) }); }

type Setup = { project: Project; meeting: Meeting; a: Page; b: Page; g: Page; guests: Page[]; manager: BrowserContext; member: BrowserContext; guestContexts: BrowserContext[]; memberNick: string; managerNick: string; close: () => Promise<void> };
/** A started meeting with the manager (a), a member (b) and one or two guests (g) in the room, each in their own browser, chat panel open. */
async function room(browser: import("@playwright/test").Browser, { guestNames = ["QA Guest"] }: { guestNames?: string[] } = {}): Promise<Setup> {
  const options = { storageState: REJECTED_STATE, permissions: ["camera", "microphone"] as string[], viewport: { width: 1280, height: 900 } };
  const manager = await browser.newContext(options), member = await browser.newContext(options);
  const guestContexts = await Promise.all(guestNames.map(() => browser.newContext(options)));
  const a = await manager.newPage(), b = await member.newPage(), guests = await Promise.all(guestContexts.map(context => context.newPage()));
  for (const page of [a, b, ...guests]) page.setDefaultTimeout(20000);
  await login(manager, managerFile); await login(member, memberFile);
  await a.goto("/projects");
  const project = (await api(a, "POST", "/projects", { name: `V292 Chat ${Date.now()}`, projectTypes: ["WEB"] })).json as Project;
  await b.goto("/dashboard");
  const me = (await api(b, "GET", "/auth/me")).json as { id: string; nickname: string }; addMember(project.id, me.id);
  const own = (await api(a, "GET", "/auth/me")).json as { nickname: string };
  const now = Date.now();
  const created = await api(a, "POST", `/meetings`, { title: `V292 chat ${now}`, description: "Chat QA", startsAt: new Date(now + 1000).toISOString(), endsAt: new Date(now + 7200_000).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [me.id] });
  expect(created.status).toBe(201); const meeting = created.json as Meeting;
  expect((await api(a, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
  const href = localizeHref(`/meetings/${meeting.id}/room`, "tr");
  await a.goto(href); await b.goto(href); await join(a); await join(b);
  for (const [index, page] of guests.entries()) {
    const invite = (await api(a, "POST", `/meetings/${meeting.id}/invites`, { expiresAt: new Date(Date.now() + 3600000).toISOString(), maxUses: 5 })).json as MeetingInvite;
    // The server lets one address start at most 10 guest admissions a minute (preview + session), and the three tests here run close together:
    // when the preview is refused, wait out the window and ask again.
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.goto(`${localizeHref("/meeting-guest", "tr")}#${invite.token}`);
      if (await page.getByRole("heading", { name: meeting.title, exact: true }).isVisible({ timeout: 8000 }).catch(() => false)) break;
      await page.waitForTimeout(30000);
    }
    await expect(page.getByRole("heading", { name: meeting.title, exact: true })).toBeVisible();
    await page.getByLabel(tr.displayName, { exact: true }).fill(guestNames[index]); await page.getByRole("button", { name: tr.continue, exact: true }).click(); await join(page);
  }
  for (const page of [a, b, ...guests]) await showPanel(page, tr.chat);
  return { project, meeting, a, b, g: guests[0], guests, manager, member, guestContexts, memberNick: me.nickname, managerNick: own.nickname,
    close: async () => { await api(a, "POST", `/projects/${project.id}/archive`).catch(() => {}); for (const context of [manager, member, ...guestContexts]) await context.close(); } };
}
const box = (page: Page) => page.getByRole("textbox", { name: tr.message, exact: true });
const messageRow = (page: Page, text: string) => page.locator("[data-message-id]").filter({ has: page.getByText(text, { exact: true }) });
async function say(page: Page, text: string) {
  await box(page).fill(text); await page.getByRole("button", { name: tr.send, exact: true }).click();
  await expect(messageRow(page, text).first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(900); // the server allows one chat message per 750 ms and person
}
const history = async (page: Page, setup: Setup) => ((await api(page, "GET", `/meetings/${setup.meeting.id}/chat?page=0&size=100`)).json as { content: MeetingMessage[] }).content;

test("replies: a real stored relation, quote in every view, cancel, reload, guest reply, reaching an old message and the unavailable fallback", async ({ browser }) => {
  test.setTimeout(300000);
  const s = await room(browser); const { a, b, g } = s;
  try {
    await say(a, "Backend tarafı tamamlandı mı?");
    // 1. Reply from the member: the action shows on hover, the draft shows who and what, and Escape / the cross drop it.
    const original = messageRow(b, "Backend tarafı tamamlandı mı?").first();
    await original.hover(); await original.locator('[data-message-action="reply"]').click();
    const draft = b.locator("[data-reply-draft]"); await expect(draft).toBeVisible(); await expect(draft).toContainText("Backend tarafı tamamlandı mı?"); await expect(draft).toContainText(s.managerNick);
    await expect(box(b)).toBeFocused();
    await b.keyboard.press("Escape"); await expect(draft).toHaveCount(0);
    await original.hover(); await original.locator('[data-message-action="reply"]').click(); await draft.getByRole("button", { name: tr.replyCancel }).click(); await expect(draft).toHaveCount(0);
    // Long original: the draft never grows past two lines.
    // 2. Send a reply: it is a real message related to the original, in every view, without a reload.
    await original.hover(); await original.locator('[data-message-action="reply"]').click();
    const scrollBefore = await b.evaluate(() => window.scrollY);
    await box(b).fill("Evet, testler de başarılı"); await box(b).press("Enter");
    await expect(draft).toHaveCount(0); expect(await b.evaluate(() => window.scrollY), "the page does not move").toBe(scrollBefore);
    for (const page of [a, b, g]) await expect(page.locator("[data-reply-quote]")).toContainText("Backend tarafı tamamlandı mı?", { timeout: 15000 });
    const stored = (await history(a, s)).find(m => m.content === "Evet, testler de başarılı")!;
    const originalId = (await history(a, s)).find(m => m.content === "Backend tarafı tamamlandı mı?")!.id;
    expect(stored.replyToMessageId).toBe(originalId); expect(stored.replyTo?.preview).toBe("Backend tarafı tamamlandı mı?");
    await screenshot(a, "v292-reply");
    // 3. A reload (and joining again) keeps the relation: it comes from the stored data.
    await b.reload(); await join(b); await showPanel(b, tr.chat);
    await expect(b.locator("[data-reply-quote]")).toContainText("Backend tarafı tamamlandı mı?", { timeout: 15000 });
    // 4. A guest answers too, with the guest's own session.
    const fromManager = messageRow(g, "Evet, testler de başarılı").first();
    await g.waitForTimeout(900); await fromManager.hover(); await fromManager.locator('[data-message-action="reply"]').click();
    await box(g).fill("Teşekkürler"); await box(g).press("Enter");
    await expect(a.locator(`[data-reply-quote="${stored.id}"]`)).toContainText("Evet, testler de başarılı", { timeout: 15000 });
    // 5. An answer to a message that is far back: the quote goes to it, loading older pages, and only the chat scrolls.
    const participants = (await api(a, "GET", `/meetings/${s.meeting.id}/participants`)).json as MeetingParticipant[];
    const author = participants.find(p => !p.guest)!;
    psql(`INSERT INTO meeting_chat_messages(id,meeting_id,participant_id,display_name,content,sent_at) SELECT gen_random_uuid(),'${uuid(s.meeting.id)}','${uuid(author.id)}','Seed','seed message '||g, now() - interval '3 days' + g * interval '1 minute' FROM generate_series(1,70) g`);
    const oldest = psql(`SELECT id FROM meeting_chat_messages WHERE meeting_id='${uuid(s.meeting.id)}' ORDER BY sent_at ASC, id ASC LIMIT 1`);
    const reply = await api(b, "POST", `/meetings/${s.meeting.id}/chat`, { content: "Answering a very old message", mentionIds: [], replyToMessageId: oldest });
    expect(reply.status).toBe(201);
    await expect(a.locator(`[data-reply-quote="${oldest}"]`)).toBeVisible({ timeout: 15000 });
    await expect(a.locator(`[data-message-id="${oldest}"]`)).toHaveCount(0); // not loaded yet: it is on an older page
    const pageScroll = await a.evaluate(() => window.scrollY);
    await a.locator(`[data-reply-quote="${oldest}"]`).click();
    await expect(a.locator(`[data-message-id="${oldest}"]`)).toBeVisible({ timeout: 15000 });
    await expect(a.locator(`[data-message-id="${oldest}"]`)).toHaveAttribute("data-highlighted", "", { timeout: 5000 });
    expect(await a.evaluate(() => window.scrollY), "the chat scrolled, the page did not").toBe(pageScroll);
    await expect(a.locator(`[data-message-id="${oldest}"]`)).toBeFocused();
    await expect(a.locator(`[data-message-id="${oldest}"]`)).not.toHaveAttribute("data-highlighted", "", { timeout: 6000 }); // a short highlight only
    // 6. An answer to a message that cannot be quoted any more says so instead of failing.
    // Only this meeting's own first chat page is rewritten: the pattern used to be any URL ending in /chat?page=0, which other requests can match too.
    // What the app asks for around the reload is recorded, so a refused page (the server answers 403 until the person has joined) is explained by its timeline.
    const trail: string[] = [];
    b.on("response", response => { const at = response.url().split("/meetings/")[1]; if (at && /(join|leave|chat|participants)/.test(at)) trail.push(`${Date.now() % 100000} ${response.request().method()} ${at.replace(s.meeting.id, "<id>")} ${response.status()}`); });
    await b.route(url => url.pathname.endsWith(`/meetings/${s.meeting.id}/chat`) && url.searchParams.get("page") === "0", async route => {
      const response = await route.fetch();
      // Only a real page is rewritten; any other answer (the app's own handling of it is not what this test is about) goes through untouched.
      if (!response.ok()) { trail.push(`stub: passed a ${response.status()} through`); await route.fulfill({ response }); return; }
      const json = await response.json() as { content: MeetingMessage[] };
      for (const message of json.content) if (message.replyToMessageId) message.replyTo = null;
      await route.fulfill({ response, json });
    });
    await b.reload(); await join(b); await showPanel(b, tr.chat);
    await expect(b.locator("[data-reply-missing]").first(), trail.join(" | ")).toContainText(tr.replyUnavailable, { timeout: 15000 });
    expect((await new AxeBuilder({ page: b }).include("[data-meeting-room] aside").analyze()).violations, "chat with replies has no accessibility violations").toEqual([]);
  } finally { await s.close(); }
});

test("reactions: add, count once per person, take back, different emoji, live for everyone, stored, failure rolls back, keyboard", async ({ browser }) => {
  test.setTimeout(300000);
  const s = await room(browser); const { a, b, g } = s;
  try {
    await say(a, "Toplantıya başlıyoruz.");
    const chip = (page: Page, emoji = "👍") => messageRow(page, "Toplantıya başlıyoruz.").first().locator(`[data-reaction="${emoji}"]`);
    // 1. The member opens the picker of the message and chooses 👍: their chip appears at once, the manager's view follows without a reload.
    const onB = messageRow(b, "Toplantıya başlıyoruz.").first();
    await onB.hover(); await onB.locator('[data-message-action="react"]').click();
    await expect(b.getByTestId("meeting-reaction-picker-popup")).toBeVisible();
    await b.getByTestId("emoji-THUMBS_UP").click();
    await expect(chip(b)).toContainText("1"); await expect(chip(b)).toHaveAttribute("data-own", "true");
    await expect(chip(a)).toContainText("1", { timeout: 15000 }); await expect(chip(a)).toHaveAttribute("data-own", "false");
    // 2. The guest taps the same chip: two people, and it is theirs now; everybody sees 2.
    await expect(chip(g)).toContainText("1", { timeout: 15000 });
    await chip(g).click();
    for (const page of [a, b, g]) await expect(chip(page)).toContainText("2", { timeout: 15000 });
    await expect(chip(g)).toHaveAttribute("data-own", "true"); await expect(chip(b)).toHaveAttribute("data-own", "true"); await expect(chip(a)).toHaveAttribute("data-own", "false");
    // 3. Who reacted: hovering or focusing the chip names them (and a screen reader gets it in the label).
    await chip(a).hover(); await expect(messageRow(a, "Toplantıya başlıyoruz.").first().locator("[data-reaction-people]")).toBeVisible();
    await expect(messageRow(a, "Toplantıya başlıyoruz.").first().locator("[data-reaction-people]")).toContainText(s.memberNick); await expect(messageRow(a, "Toplantıya başlıyoruz.").first().locator("[data-reaction-people]")).toContainText("QA Guest");
    await expect(chip(a)).toHaveAttribute("aria-label", new RegExp(`${s.memberNick}.*QA Guest|QA Guest.*${s.memberNick}`));
    // 4. The manager taps it with the keyboard (3), and again to take it back (2); the same person never counts twice.
    await chip(a).focus(); await a.keyboard.press("Enter"); for (const page of [a, b, g]) await expect(chip(page)).toContainText("3", { timeout: 15000 });
    await expect(chip(a)).toHaveAttribute("aria-pressed", "true");
    await chip(a).focus(); await a.keyboard.press("Enter"); for (const page of [a, b, g]) await expect(chip(page)).toContainText("2", { timeout: 15000 });
    await expect(chip(a)).toHaveAttribute("aria-pressed", "false");
    // 5. Another emoji is its own chip; taking back one's own leaves the others'.
    const onA = messageRow(a, "Toplantıya başlıyoruz.").first();
    await onA.hover(); await onA.locator('[data-message-action="react"]').click(); await a.getByTestId("emoji-HEART").click();
    await expect(chip(b, "❤️")).toContainText("1", { timeout: 15000 });
    await chip(b).click();                      // the member takes their 👍 back
    for (const page of [a, b, g]) await expect(chip(page)).toContainText("1", { timeout: 15000 });
    await expect(chip(b)).toHaveAttribute("data-own", "false");
    // 6. Stored: after a reload (and joining again) the chips are the server's.
    const stored = (await history(a, s)).find(m => m.content === "Toplantıya başlıyoruz.")!;
    expect(stored.reactions!.map(r => [r.emoji, r.count])).toEqual([["👍", 1], ["❤️", 1]]);
    expect(stored.reactions!.find(r => r.emoji === "👍")!.reactors.map(r => r.displayName)).toEqual(["QA Guest"]);
    await a.reload(); await join(a); await showPanel(a, tr.chat);
    await expect(chip(a)).toContainText("1", { timeout: 15000 }); await expect(chip(a, "❤️")).toHaveAttribute("data-own", "true");
    await screenshot(a, "v292-reactions");
    // 7. When the server refuses, the chip goes back to what is really stored and the person is told.
    await b.route(/\/chat\/[^/]+\/reactions/, route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "TEST_ONLY" }) }));
    const again = messageRow(b, "Toplantıya başlıyoruz.").first();
    await again.hover(); await again.locator('[data-message-action="react"]').click(); await b.getByTestId("emoji-LAUGH").click();
    await expect(b.getByText(tr.reactionFailed)).toBeVisible({ timeout: 10000 });
    await expect(chip(b, "😂")).toHaveCount(0, { timeout: 10000 });
    await b.unroute(/\/chat\/[^/]+\/reactions/);
    // 8. Accessibility with reactions and a reply on screen, in both themes.
    for (const dark of [false, true]) {
      await a.evaluate(value => document.documentElement.classList.toggle("dark", value), dark);
      expect((await new AxeBuilder({ page: a }).include("[data-meeting-room] aside").analyze()).violations, `${dark ? "dark" : "light"} chat panel`).toEqual([]);
    }
    await a.evaluate(() => document.documentElement.classList.remove("dark"));
  } finally { await s.close(); }
});

test("mentions: ArrowUp/Down/Enter/Escape choose a person without sending, caret token, same names by id, IME and mouse", async ({ browser }) => {
  test.setTimeout(300000);
  const s = await room(browser, { guestNames: ["QA Guest", "QA Guest"] }); const { a } = s;
  try {
    const posts: { content: string; mentionIds: string[] }[] = [];
    a.on("request", request => { if (request.method() === "POST" && request.url().endsWith(`/meetings/${s.meeting.id}/chat`)) posts.push(request.postDataJSON()); });
    const field = box(a), options = a.locator("[data-mention-option]");
    const participants = (await api(a, "GET", `/meetings/${s.meeting.id}/participants`)).json as MeetingParticipant[];
    // 1. "@" opens the list: three people (the member and two guests who share a name); the first is active.
    await field.click(); await field.pressSequentially("Hello @");
    await expect(options).toHaveCount(3); await expect(a.getByRole("listbox", { name: tr.mentions })).toBeVisible();
    const ids = await options.evaluateAll(items => items.map(item => item.getAttribute("data-mention-option")!));
    const names = await options.evaluateAll(items => items.map(item => item.querySelector("span")!.textContent!));
    await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(field).toHaveAttribute("aria-activedescendant", `meeting-mention-${ids[0]}`);
    // Same-named people are told apart (guest tag and number); the list is announced.
    const guestsInList = options.filter({ hasText: "QA Guest" }); await expect(guestsInList).toHaveCount(2);
    await expect(guestsInList.nth(0)).toContainText("#"); await expect(guestsInList.nth(0)).toContainText(tr.guestTag);
    await expect(a.getByRole("status").filter({ hasText: /3/ })).toHaveCount(1);
    // 2. The arrows move, wrap around, and the focus stays in the text box.
    await field.press("ArrowDown"); await expect(options.nth(1)).toHaveAttribute("aria-selected", "true"); await expect(field).toHaveAttribute("aria-activedescendant", `meeting-mention-${ids[1]}`);
    await field.press("ArrowDown"); await field.press("ArrowDown"); await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
    await field.press("ArrowUp"); await expect(options.nth(2)).toHaveAttribute("aria-selected", "true"); await expect(field).toBeFocused();
    // 3. Enter chooses the active person and does NOT send; the person is the one with that id (the second guest of the same name).
    await field.press("Enter");
    await expect(options).toHaveCount(0); await expect(field).toHaveValue(`Hello @${names[2]} `);
    expect(posts, "choosing a person never sends the message").toHaveLength(0);
    await expect(a.locator("[data-meeting-room] [data-message-id]").filter({ hasText: "Hello @QA Guest" })).toHaveCount(0);
    // 4. With the list closed, Enter sends; the mention carries the chosen person's id.
    await field.press("Enter");
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0].mentionIds).toEqual([ids[2]]); expect(participants.map(p => p.id)).toContain(ids[2]);
    await a.waitForTimeout(900);
    // 5. Escape closes the list and keeps the text; typing on opens it again; Shift+Enter is a new line, never a choice.
    await field.fill(""); await field.pressSequentially("@QA"); await expect(options).toHaveCount(2);
    await field.press("Escape"); await expect(options).toHaveCount(0); await expect(field).toHaveValue("@QA");
    await field.pressSequentially(" G"); await expect(options).toHaveCount(2);
    await field.press("Shift+Enter"); await expect(field).toHaveValue("@QA G\n"); expect(posts).toHaveLength(1);
    // 6. The token at the caret is the one replaced, not the end of the text.
    await field.fill("Hi @QA and more"); await field.press("Home"); for (let i = 0; i < 6; i++) await field.press("ArrowRight");
    await expect(options).toHaveCount(2);
    await field.press("ArrowDown"); await field.press("Enter");
    await expect(field).toHaveValue("Hi @QA Guest  and more");
    // 7. A confirmation of an input method (composition) never chooses or sends.
    await field.fill(""); await field.pressSequentially("@"); await expect(options).toHaveCount(3);
    await field.evaluate(element => element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, keyCode: 229, bubbles: true, cancelable: true })));
    await expect(options).toHaveCount(3); await expect(field).toHaveValue("@"); expect(posts).toHaveLength(1);
    // 8. A mouse click chooses too; the person is added once and can be taken off the message again.
    await options.nth(0).click(); await expect(field).toHaveValue(`@${names[0]} `);
    await expect(a.getByRole("button", { name: `${names[0]} ×` }).first()).toBeVisible(); // (earlier choices of the same text box stay listed until sent or taken off)
    await screenshot(a, "v292-mention-list");
    expect((await new AxeBuilder({ page: a }).include("[data-meeting-room] aside").analyze()).violations).toEqual([]);
  } finally { await s.close(); }
});
