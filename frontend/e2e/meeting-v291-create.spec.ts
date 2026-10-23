import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { meetingAccount } from "./meeting-fixture";
import { REJECTED_STATE } from "./consent-state";
import { localizeHref } from "../src/i18n/routing";
import type { Project } from "../src/features/projects/types";
import type { Meeting } from "../src/features/meetings/types";
import tr from "../src/i18n/meetings/tr.json";
import AxeBuilder from "@axe-core/playwright";

// V2.9.1 creation, list and mail flows against the real API, PostgreSQL and the Mailpit SMTP sink: start now (device clock skew, retry
// without a second meeting, both account kinds), the meeting icon, the per-member history (clear/restore, 100+ meetings) and the
// reminder mails for the organizer and every invited member.
test.use({ storageState: REJECTED_STATE, trace: "off", video: "off", launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });
test.describe.configure({ mode: "serial" });
const base = "http://localhost:8080/api/v1", MAILPIT = "http://localhost:8025/api/v1", H = 3600_000, D = 24 * H;
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
  const result = await api(page, "POST", "/projects", { name: `V291 QA ${Date.now()}`, projectTypes: ["WEB"] });
  expect(result.status).toBe(201); return result.json as Project;
}
async function addMember(page: Page, project: Project) {
  await page.goto("/dashboard");
  const me = (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string };
  psql(`WITH membership AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(project.id)}','${uuid(me.id)}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM membership`);
  return me;
}
/** A real, active, verified project member without a browser session (a stand-in for a colleague who only receives mail). */
function colleague(project: Project, label: string) {
  const id = randomUUID(), nick = `${label}-${id.slice(0, 6)}`, email = `${nick}-${id}@example.test`;
  psql(`INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,email_verified_at,created_at,updated_at) VALUES('${id}','${email}','${nick}','ACTIVE','VERIFIED','USER',now(),now(),now())`);
  psql(`WITH m AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(project.id)}','${id}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM m`);
  return { id, email, nick };
}
async function make(page: Page, project: Project, title: string, startsIn: number, lengthMs = H, attendeeIds: string[] = [], extra: Record<string, unknown> = {}) {
  const result = await api(page, "POST", `/projects/${project.id}/meetings`, { title, description: "V2.9.1 QA", startsAt: new Date(Date.now() + startsIn).toISOString(), endsAt: new Date(Date.now() + startsIn + lengthMs).toISOString(), zoneId: "Europe/Istanbul", agenda: ["Review"], attendeeIds, ...extra });
  expect(result.status, JSON.stringify(result.json)).toBe(201); return result.json as Meeting;
}
/** Opens the ready screen of a meeting after leaving an optional note, and reports whether the page joined by itself. */
async function joinsByItself(page: Page, project: Project, meeting: Meeting, note: unknown, query = "") {
  await page.goto(localizeHref(`/projects/${project.slug}/meetings`, "tr"));
  await page.evaluate(value => { if (value) sessionStorage.setItem("pda:meeting-autojoin:v1", JSON.stringify(value)); else sessionStorage.removeItem("pda:meeting-autojoin:v1"); }, note);
  await page.goto(`${localizeHref(`/projects/${project.slug}/meetings/${meeting.id}/room`, "tr")}${query}`);
  const joined = await page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) }).waitFor({ timeout: 8000 }).then(() => true, () => false);
  if (!joined) await expect(page.getByRole("heading", { name: tr.readyTitle, exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("pda:meeting-autojoin:v1")), "the note is always used up").toBeNull();
  return joined;
}
test("a link can never join a call by itself: only the one-time note of the meeting just started does", async ({ page, context }) => {
  test.setTimeout(150000); await login(context, managerFile); const project = await createProject(page);
  try {
    const meeting = await make(page, project, "Auto-join guard", 1000);
    expect((await api(page, "POST", `/projects/${project.id}/meetings/${meeting.id}/start`)).status).toBe(200);
    expect(await joinsByItself(page, project, meeting, null, "?autojoin=1"), "the old link parameter does nothing").toBe(false);
    expect(await joinsByItself(page, project, meeting, { meetingId: "someone-else", at: Date.now() }), "a note for another meeting does nothing").toBe(false);
    expect(await joinsByItself(page, project, meeting, { meetingId: meeting.id, at: Date.now() - 120_000 }), "an old note does nothing").toBe(false);
    expect(await joinsByItself(page, project, meeting, { meetingId: meeting.id, at: Date.now() }), "the fresh note of this meeting joins").toBe(true);
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});
test("icon picker layout: one row or two even rows of six, never a lone icon, at every width and in both themes", async ({ page, context }) => {
  test.setTimeout(150000); await login(context, managerFile); const project = await createProject(page);
  try {
    for (const dark of [false, true]) for (const width of [320, 375, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(newHref(project.slug)); await page.evaluate(value => localStorage.setItem("theme", value), dark ? "dark" : "light"); await page.reload();
      const options = page.locator("[data-icon-option]"); await expect(options).toHaveCount(12);
      const boxes = await options.evaluateAll(items => items.map(item => { const r = item.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }));
      const rows = [...new Set(boxes.map(box => box.y))];
      const perRow = rows.map(y => boxes.filter(box => box.y === y).length);
      expect(perRow, `${width}px ${dark ? "dark" : "light"}: rows of icons`).toEqual(rows.length === 1 ? [12] : [6, 6]);
      for (const box of boxes) { expect(box.w, "touch-sized").toBeGreaterThanOrEqual(34); expect(box.w).toBeLessThanOrEqual(44); expect(box.h).toBe(box.w); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no sideways scroll at ${width}px`).toBe(true);
      if (width === 1440 || width === 375) { mkdirSync(path.join(__dirname, "../test-results/meetings-visual"), { recursive: true }); await page.locator("[data-icon-option]").first().locator("xpath=ancestor::fieldset").screenshot({ path: path.join(__dirname, `../test-results/meetings-visual/v291-icon-picker-${width}-${dark ? "dark" : "light"}.png`) }); }
    }
    // Choosing still works the same way, by pointer and keyboard.
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(newHref(project.slug));
    await page.locator("[data-icon-option=target]").click(); await expect(page.locator("[data-icon-option=target] input")).toBeChecked();
    await page.locator("[data-icon-option=target] input").press("ArrowRight"); await expect(page.locator("[data-icon-option=briefcase] input")).toBeChecked();
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});
const newHref = (slug: string) => localizeHref(`/projects/${slug}/meetings/new`, "tr");
const listHref = (slug: string, query = "") => localizeHref(`/projects/${slug}/meetings`, "tr") + query;
const cards = (page: Page) => page.locator("[data-meeting-card]");

test("start now is accepted whatever the device clock says, for a manager and for a plain member, and starts a real call", async ({ browser }) => {
  test.setTimeout(240000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"] });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"] });
  const a = await managerContext.newPage(), b = await memberContext.newPage();
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(a); await addMember(b, project);
    // The slow device clock used to make the server refuse the start as "in the past" (HTTP 400 MEETING_INVALID_SCHEDULE).
    for (const [who, context] of [["manager", managerContext], ["member", memberContext]] as const) {
      for (const skew of [0, -8_000, -45_000, 45_000]) {
        const page = await context.newPage();
        await page.clock.install({ time: Date.now() + skew }); await page.clock.resume();
        await page.goto(newHref(project.slug));
        await page.locator("#meeting-title").fill(`${who} start now ${skew}`);
        const created = page.waitForResponse(response => response.url().endsWith(`/projects/${project!.id}/meetings`) && response.request().method() === "POST");
        await page.getByRole("button", { name: tr.startNow, exact: true }).click();
        const response = await created; expect(response.status(), `${who} with a device clock ${skew} ms off`).toBe(201);
        // Straight into the call, joined with the microphone and camera still off.
        await expect(page.locator("[data-meeting-room]")).toBeVisible({ timeout: 20000 });
        if (skew === 0) {
          await expect(page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) })).toBeVisible({ timeout: 30000 });
          await expect(page.getByRole("button", { name: tr.micOn, exact: true })).toBeVisible();
        }
        await page.close();
      }
    }
    const list = (await api(a, "GET", `/projects/${project.id}/meetings?size=100&sort=startsAt,asc`)).json as { content: Meeting[] };
    expect(list.content).toHaveLength(8); expect(list.content.every(meeting => meeting.status === "OPEN")).toBe(true);
    for (const meeting of list.content) expect(new Date(meeting.startsAt).getTime()).toBeLessThanOrEqual(Date.now()); // the start is the server's "now"
  } finally { if (project) await api(a, "POST", `/projects/${project.id}/archive`).catch(() => {}); await managerContext.close(); await memberContext.close(); }
});

test("a failed start after the meeting was created is retried on the same meeting; double clicks create it once", async ({ page, context }) => {
  test.setTimeout(120000);
  await login(context, managerFile); const project = await createProject(page);
  try {
    let creates = 0, starts = 0;
    await page.route(`**/projects/${project.id}/meetings`, route => { if (route.request().method() === "POST") creates++; return route.continue(); });
    await page.route("**/meetings/*/start", route => { starts++; return starts === 1 ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "MEETING_RECONNECT_PENDING", status: 503 }) }) : route.continue(); });
    await page.goto(newHref(project.slug)); await page.locator("#meeting-title").fill("Retry without duplicates");
    await page.getByRole("button", { name: tr.startNow, exact: true }).dblclick();
    await expect(page.getByRole("alert").filter({ hasText: tr.rotationPending })).toBeVisible();
    await expect(page.getByText(tr.createdRecovery.split(".")[0])).toBeVisible();
    expect(creates).toBe(1);
    await page.getByRole("button", { name: tr.startNow, exact: true }).click();
    await expect(page.locator("[data-meeting-room]")).toBeVisible({ timeout: 20000 });
    expect(creates, "the retry must reuse the saved meeting").toBe(1); expect(starts).toBe(2);
    const list = (await api(page, "GET", `/projects/${project.id}/meetings?size=100`)).json as { content: Meeting[] };
    expect(list.content.filter(meeting => meeting.title === "Retry without duplicates")).toHaveLength(1);
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});

test("meeting icon: chosen in the form with the keyboard, stored by the API, shown on the card and the detail, kept on edit, allowlist enforced", async ({ page, context }) => {
  test.setTimeout(120000);
  await login(context, managerFile); const project = await createProject(page);
  try {
    const legacy = await make(page, project, "Created without an icon", 2 * H);
    expect(legacy.icon).toBe("video");
    await page.goto(newHref(project.slug)); await page.locator("#meeting-title").fill("Icon meeting");
    const picker = page.getByRole("radiogroup", { name: tr.iconLabel, exact: true });
    await expect(picker.getByRole("radio", { name: tr.icon.video, exact: true })).toBeChecked();
    await picker.getByRole("radio", { name: tr.icon.video, exact: true }).focus();
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); // video -> users -> calendar -> presentation
    await expect(picker.getByRole("radio", { name: tr.icon.presentation, exact: true })).toBeChecked();
    expect((await new AxeBuilder({ page }).include("[data-meeting-form]").analyze()).violations).toEqual([]);
    await page.locator('button[type="submit"][value="plan"]').click();
    await expect(page.locator('[data-meeting-icon="presentation"]')).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1)!;
    expect(((await api(page, "GET", `/projects/${project.id}/meetings/${id}`)).json as Meeting).icon).toBe("presentation");
    // Edit keeps the stored choice and can change it.
    await page.goto(localizeHref(`/projects/${project.slug}/meetings/${id}/edit`, "tr"));
    await expect(page.getByRole("radiogroup", { name: tr.iconLabel, exact: true }).getByRole("radio", { name: tr.icon.presentation, exact: true })).toBeChecked();
    await page.getByRole("radiogroup", { name: tr.iconLabel, exact: true }).locator('[data-icon-option="code"]').click();
    await page.locator('button[type="submit"][value="plan"]').click();
    await expect(page.locator('[data-meeting-icon="code"]')).toBeVisible();
    // The list shows each meeting with its own icon; the older meeting keeps the video icon.
    await page.goto(listHref(project.slug));
    await expect(cards(page).filter({ hasText: "Icon meeting" }).locator('[data-meeting-icon="code"]')).toBeVisible();
    await expect(cards(page).filter({ hasText: "Created without an icon" }).locator('[data-meeting-icon="video"]')).toBeVisible();
    // Only allowlisted names are accepted by the API, and an update without an icon keeps it.
    const start = new Date(Date.now() + 5 * H).toISOString(), end = new Date(Date.now() + 6 * H).toISOString();
    const body = { title: "Bad icon", description: "", startsAt: start, endsAt: end, zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [] };
    for (const icon of ["rocket", "<script>", "Video", ""]) { const refused = await api(page, "POST", `/projects/${project.id}/meetings`, { ...body, icon }); expect(refused.status, icon).toBe(400); expect((refused.json as { code: string }).code).toBe("MEETING_INVALID_ICON"); }
    const kept = await api(page, "PUT", `/projects/${project.id}/meetings/${id}`, { ...body, title: "Icon kept" }); expect(kept.status).toBe(200); expect((kept.json as Meeting).icon).toBe("code");
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});

test("history: shown on request, cleared for one member only, restored, persisted, with 100+ meetings and honest pagination", async ({ browser }) => {
  test.setTimeout(240000);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE, viewport: { width: 1440, height: 1000 } });
  const memberContext = await browser.newContext({ storageState: REJECTED_STATE, viewport: { width: 1440, height: 1000 } });
  const a = await managerContext.newPage(), b = await memberContext.newPage();
  let project: Project | undefined;
  try {
    await login(managerContext, managerFile); await login(memberContext, memberFile);
    project = await createProject(a); await addMember(b, project);
    // 105 planned meetings (more than one API page of 100) plus finished, cancelled and a live one.
    for (let batch = 0; batch < 7; batch++) await Promise.all(Array.from({ length: 15 }, (_, index) => make(a, project!, `Planned ${String(batch * 15 + index).padStart(3, "0")}`, (batch * 15 + index + 2) * 60_000 + D)));
    const finished = [await make(a, project, "Finished one", 3000), await make(a, project, "Finished two", 3000)];
    const cancelled = await make(a, project, "Cancelled one", 2 * H); const live = await make(a, project, "Live one", 3000);
    for (const meeting of [...finished, live]) expect((await api(a, "POST", `/projects/${project.id}/meetings/${meeting.id}/start`)).status).toBe(200);
    for (const meeting of finished) expect((await api(a, "POST", `/projects/${project.id}/meetings/${meeting.id}/end`)).status).toBe(200);
    expect((await api(a, "POST", `/projects/${project.id}/meetings/${cancelled.id}/cancel`)).status).toBe(200);

    await a.goto(listHref(project.slug));
    // 105 planned + 1 live in the main view; pagination covers all of them (11 pages of 10), not just the first API page.
    await expect(statusSelect(a)).toContainText("(106)"); await expect(cards(a)).toHaveCount(10);
    await expect(a.getByText(/106 kayıt/)).toBeVisible();
    await a.goto(listHref(project.slug, "?page=11")); await expect(cards(a)).toHaveCount(6);
    await a.goto(listHref(project.slug, "?history=1")); await expect(statusSelect(a)).toContainText("(109)");
    // Clear: asks first, then only the three finished/cancelled meetings leave THIS member's list.
    await a.getByRole("button", { name: tr.clearHistory, exact: true }).click();
    const dialog = a.getByRole("dialog"); await expect(dialog).toContainText("3"); await dialog.getByRole("button", { name: tr.cancel, exact: true }).click();
    await expect(statusSelect(a)).toContainText("(109)");
    await a.getByRole("button", { name: tr.clearHistory, exact: true }).click(); await a.getByRole("dialog").getByRole("button", { name: tr.clearHistoryConfirm, exact: true }).click();
    await expect(statusSelect(a)).toContainText("(106)", { timeout: 15000 });
    await expect(a.getByRole("button", { name: new RegExp(`^${tr.restoreHistory.split(" (")[0]}`) })).toBeVisible(); await expect(a.getByRole("button", { name: tr.clearHistory, exact: true })).toHaveCount(0);
    // Survives a reload, the API agrees, planned and live meetings stayed, and nobody else's list changed.
    await a.reload(); await expect(statusSelect(a)).toContainText("(106)");
    const mine = (await api(a, "GET", `/projects/${project.id}/meetings?size=100&hidden=ONLY`)).json as { content: Meeting[]; totalElements: number };
    expect(mine.totalElements).toBe(3); expect(mine.content.every(meeting => meeting.hidden && (meeting.status === "ENDED" || meeting.status === "CANCELLED"))).toBe(true);
    await b.goto(listHref(project.slug, "?history=1")); await expect(statusSelect(b)).toContainText("(109)"); await expect(b.getByRole("button", { name: tr.clearHistory, exact: true })).toBeVisible();
    expect(((await api(b, "GET", `/projects/${project.id}/meetings/history`)).json as { count: number }).count).toBe(0);
    // Meeting data is untouched (still finished/cancelled for everybody, chat/audit rows intact).
    expect(psql(`SELECT count(*) FROM meetings WHERE project_id='${uuid(project.id)}' AND status IN ('ENDED','CANCELLED')`)).toBe("3");
    // Restore brings them back for this member only.
    await a.getByRole("button", { name: new RegExp(`^${tr.restoreHistory.split(" (")[0]}`) }).click(); await expect(statusSelect(a)).toContainText("(109)", { timeout: 15000 });
    await expect(a.getByRole("button", { name: new RegExp(`^${tr.restoreHistory.split(" (")[0]}`) })).toHaveCount(0);
    // The member clearing their own history never touches the manager: the manager's hidden count stays at zero.
    expect((await api(b, "POST", `/projects/${project.id}/meetings/history/clear`)).status).toBe(200);
    expect(((await api(a, "GET", `/projects/${project.id}/meetings/history`)).json as { count: number }).count).toBe(0);
  } finally { if (project) await api(a, "POST", `/projects/${project.id}/archive`).catch(() => {}); await managerContext.close(); await memberContext.close(); }
});
const statusSelect = (page: Page) => page.getByRole("combobox", { name: tr.filter, exact: true });

type Mail = { ID: string; To: { Address: string }[]; Subject: string };
const messages = async () => ((await (await fetch(`${MAILPIT}/messages?limit=200`)).json()) as { messages: Mail[] }).messages;
const message = async (id: string) => (await (await fetch(`${MAILPIT}/message/${id}`)).json()) as { HTML: string; Text: string; Inline: { FileName: string; ContentID: string; ContentType: string }[]; From: { Address: string } };

test("reminder mails: the organizer and every invited member each get one branded mail; a changed time sends a fresh round", async ({ page, context }) => {
  test.setTimeout(240000);
  await login(context, managerFile); await page.goto("/projects");
  const organizer = (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string };
  const project = (await api(page, "POST", "/projects", { name: `Mail QA ${Date.now()}`, projectTypes: ["WEB"] })).json as Project;
  const first = colleague(project, "mailA"), second = colleague(project, "mailB");
  await fetch(`${MAILPIT}/messages`, { method: "DELETE" });
  try {
    // The organizer is also in the attendee list on purpose: still one mail.
    const meeting = await make(page, project, "Mail round", 30 * 60_000, H, [first.id, second.id, organizer.id]);
    await expect.poll(async () => (await messages()).length, { timeout: 90000, intervals: [2000] }).toBe(3);
    const sent = await messages(); const addresses = sent.map(item => item.To[0].Address);
    expect(new Set(addresses).size).toBe(3); expect(addresses).toContain(first.email); expect(addresses).toContain(second.email);
    expect(addresses.some(address => address.includes("meeting-"))).toBe(true); // the organizer account
    const mail = await message(sent.find(item => item.To[0].Address === first.email)!.ID);
    expect(mail.HTML).toContain("cid:pda-logo"); expect(mail.Inline.some(part => part.ContentID.includes("pda-logo") && part.ContentType === "image/png")).toBe(true);
    expect(mail.HTML).toContain("Toplantınız 1 saat sonra başlıyor"); expect(mail.HTML).toContain("Mail round"); expect(mail.HTML).toContain("prefers-color-scheme: dark");
    expect(mail.Text).toContain("Mail round"); expect(mail.Text).toContain(`/tr/projeler/${project.slug}/toplantilar/${meeting.id}`); expect(mail.Text).not.toMatch(/token|secret/i);
    expect(mail.HTML).toContain(`/tr/projeler/${project.slug}/toplantilar/${meeting.id}`);
    expect(psql(`SELECT count(*) FROM meeting_reminder_deliveries WHERE meeting_id='${uuid(meeting.id)}' AND status='SENT'`)).toBe("3");
    // No duplicates on later passes.
    await page.waitForTimeout(35000); expect((await messages()).length).toBe(3);
    // A changed start time is a new reminder round: the old round is cancelled, the new one goes out (all three again).
    const moved = await api(page, "PUT", `/projects/${project.id}/meetings/${meeting.id}`, { title: "Mail round", description: "", startsAt: new Date(Date.now() + 40 * 60_000).toISOString(), endsAt: new Date(Date.now() + 100 * 60_000).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [first.id, second.id] });
    expect(moved.status).toBe(200);
    await expect.poll(async () => (await messages()).length, { timeout: 90000, intervals: [2000] }).toBe(6); // organizer + two members again, on top of the first three
    expect(psql(`SELECT count(DISTINCT reminder_revision) FROM meeting_reminder_deliveries WHERE meeting_id='${uuid(meeting.id)}'`)).toBe("2");
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});

test("a skipped reminder recipient is recorded with its reason (no verified address, not a member)", async ({ page, context }) => {
  test.setTimeout(150000);
  await login(context, managerFile); await page.goto("/projects");
  const project = (await api(page, "POST", "/projects", { name: `Skip QA ${Date.now()}`, projectTypes: ["WEB"] })).json as Project;
  const ok = colleague(project, "okMember"), unverified = colleague(project, "pendingMember");
  psql(`UPDATE users SET email_verification_status='PENDING' WHERE id='${unverified.id}'`);
  try {
    const meeting = await make(page, project, "Skip reasons", 25 * 60_000, H, [ok.id, unverified.id]);
    await expect.poll(() => psql(`SELECT count(*) FROM meeting_reminder_deliveries WHERE meeting_id='${uuid(meeting.id)}' AND status IN ('SENT','CANCELLED')`), { timeout: 90000, intervals: [2000] }).toBe("3");
    expect(psql(`SELECT error_code FROM meeting_reminder_deliveries WHERE meeting_id='${uuid(meeting.id)}' AND recipient_user_id='${unverified.id}'`)).toBe("RECIPIENT_UNAVAILABLE");
    expect(psql(`SELECT status FROM meeting_reminder_deliveries WHERE meeting_id='${uuid(meeting.id)}' AND recipient_user_id='${ok.id}'`)).toBe("SENT");
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});
