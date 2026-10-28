import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { meetingAccount } from "./meeting-fixture";
import { REJECTED_STATE } from "./consent-state";
import { localizeHref } from "../src/i18n/routing";
import type { Meeting } from "../src/features/meetings/types";
import tr from "../src/i18n/meetings/tr.json";
import en from "../src/i18n/meetings/en.json";
import de from "../src/i18n/meetings/de.json";

// Real UI -> REST -> PostgreSQL and real SDK -> SFU -> backend presence state.
// Only account provisioning uses SQL, with BCrypt and new random IDs. No mocked API response or media server.
const base = "http://localhost:8080/api/v1";
type Account = { id: string; email: string; password: string };
type Actor = { context: BrowserContext; page: Page; account: Account; file: string; nickname: string };
async function actor(browser: Browser, role: "manager" | "member" | "outsider", owned: Actor[]): Promise<Actor> {
  const file = meetingAccount(role, { fresh: true });
  const account = JSON.parse(readFileSync(file, "utf8")) as Account;
  const context = await browser.newContext({ storageState: REJECTED_STATE, permissions: ["camera", "microphone"] });
  const page = await context.newPage();
  const who = { context, page, account, file, nickname: "" }; owned.push(who);
  await context.request.get(`${base}/auth/csrf`);
  const csrf = (await context.cookies(base)).find(cookie => cookie.name === "XSRF-TOKEN")!;
  const response = await context.request.post(`${base}/auth/login`, { headers: { Origin: "http://localhost:3000", "X-XSRF-TOKEN": decodeURIComponent(csrf.value) }, data: { email: account.email, password: account.password } });
  expect(response.status(), "real cookie login").toBe(200);
  await page.goto("/tr/toplantilar");
  const me = (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string };
  expect(me.id).toBe(account.id);
  who.nickname = me.nickname; return who;
}

// Explicit IDs from this test only; no stale-account cleanup and no existing QA account reuse.
function cleanup(actors: Actor[]) {
  if (!actors.length) return;
  const ids = actors.map(who => `'${uuid(who.account.id)}'`).join(",");
  const count = psql(`SELECT count(*) FROM users WHERE id IN (${ids}) AND email ~ '^meeting-[0-9a-f-]{36}@example[.]test$' AND nickname ~ '^meeting-(manager|member|outsider)-[0-9a-f]{8}$'`);
  expect(Number(count), "cleanup guard: all IDs are this test's throw-away accounts").toBe(actors.length);
  const result = psql(`BEGIN;
    CREATE TEMP TABLE own_qa ON COMMIT DROP AS SELECT id FROM users WHERE id IN (${ids});
    DELETE FROM meetings WHERE organizer_id IN (SELECT id FROM own_qa);
    DELETE FROM notifications WHERE recipient_user_id IN (SELECT id FROM own_qa);
    DELETE FROM project_membership_roles WHERE membership_id IN (SELECT id FROM project_memberships WHERE user_id IN (SELECT id FROM own_qa));
    DELETE FROM project_memberships WHERE user_id IN (SELECT id FROM own_qa);
    DELETE FROM projects WHERE created_by IN (SELECT id FROM own_qa);
    DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM own_qa);
    DELETE FROM users WHERE id IN (SELECT id FROM own_qa);
    SELECT count(*) FROM users WHERE id IN (${ids}); COMMIT;`);
  expect(result.split("\n").at(-1), "own QA accounts removed").toBe("0");
  actors.forEach(who => unlinkSync(who.file));
  unlinkSync(path.join(__dirname, ".auth", `qa-run-${process.env.PDA_QA_RUN}.ids`));
}

for (const locale of ["tr", "en", "de"] as const) {
  const t = { tr, en, de }[locale];
  test(`${locale}: real hybrid planning, Start now, authorization, two-person media/chat and persistence`, async ({ browser }) => {
    process.env.PDA_QA_RUN = `real-final-${randomUUID()}`;
    expect(Number(psql("SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1"))).toBeGreaterThanOrEqual(58);
    const actors: Actor[] = [], meetingIds: string[] = [];
    let owner: Actor | undefined;
    try {
      owner = await actor(browser, "manager", actors);
      const guest = await actor(browser, "member", actors);
      const outsider = await actor(browser, "outsider", actors);
      const a = owner.page, b = guest.page;
      const createdProject = await api(a, "POST", "/projects", { name: `Real Meeting QA ${randomUUID().slice(0, 8)}`, projectTypes: ["WEB"] });
      expect(createdProject.status).toBe(201);
      const project = createdProject.json as { id: string; name: string };
      // Project membership alone must not grant meeting access.
      psql(`WITH m AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(project.id)}','${uuid(outsider.account.id)}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM m`);
      for (const kind of ["project", "independent"] as const) {
        for (const immediate of [false, true]) {
          const title = `Real ${locale} ${kind} ${immediate ? "now" : "planned"} ${randomUUID().slice(0, 8)}`;
          const query = `?type=${kind}${kind === "project" ? `&project=${project.id}` : ""}`;
          await a.goto(localizeHref(`/meetings/new${query}`, locale));
          console.log(`${locale}: ${kind} ${immediate ? "now" : "planned"} form opened`);
          await a.locator("#meeting-title").fill(title);
          await a.getByRole("searchbox", { name: t.searchPeople, exact: true }).fill(guest.nickname);
          await a.getByRole("list", { name: t.searchResults }).getByRole("button", { name: new RegExp(guest.nickname) }).click();
          await expect(a.getByRole("list", { name: t.selectedAttendees })).toContainText(guest.nickname);
          const saved = a.waitForResponse(response => response.url().endsWith("/api/v1/meetings") && response.request().method() === "POST");
          await a.getByRole("button", { name: immediate ? t.startNow : t.plan, exact: true }).click();
          const response = await saved; expect(response.status()).toBe(201);
          const meeting = await response.json() as Meeting; meetingIds.push(meeting.id);
          console.log(`${locale}: ${kind} ${immediate ? "now" : "planned"} real create returned 201`);
          expect(meeting.meetingType).toBe(kind === "project" ? "PROJECT" : "INDEPENDENT");
          expect(meeting.attendeeIds).toEqual([guest.account.id]);
          const stored = JSON.parse(psql(`SELECT row_to_json(s) FROM (SELECT organizer_id,project_id,title,status,starts_at < ends_at AS ordered,(SELECT count(*) FROM meeting_attendees WHERE meeting_id=m.id AND user_id='${uuid(guest.account.id)}') AS invited FROM meetings m WHERE id='${uuid(meeting.id)}') s`));
          expect(stored).toMatchObject({ organizer_id: owner.account.id, project_id: kind === "project" ? project.id : null, title, status: immediate ? "OPEN" : "SCHEDULED", ordered: true, invited: 1 });
          // Outsider is a project member but not invited; read, chat, join and management remain private.
          for (const [method, suffix] of [["GET", ""], ["GET", "/chat"], ["GET", "/participants"], ["POST", "/join"], ["POST", "/end"]]) {
            expect((await api(outsider.page, method, `/meetings/${meeting.id}${suffix}`)).status, `${kind}: outsider ${method} ${suffix}`).toBe(404);
          }
          expect((await api(guest.page, "GET", `/meetings/${meeting.id}`)).status).toBe(200);
          for (const suffix of ["start", "cancel", "end"]) expect((await api(guest.page, "POST", `/meetings/${meeting.id}/${suffix}`)).status).toBe(403);
          if (!immediate) {
            await expect(a.getByRole("heading", { name: title, exact: true })).toBeVisible();
            await a.reload(); await expect(a.getByRole("heading", { name: title, exact: true })).toBeVisible();
            for (const who of [owner, guest, outsider]) {
              await who.page.goto(`${localizeHref("/meetings", locale)}?q=${encodeURIComponent(title)}`);
              await expect(who.page.locator("[data-meeting-card]")).toHaveCount(who === outsider ? 0 : 1);
            }
            await a.goto(localizeHref(`/meetings/${meeting.id}`, locale));
            await a.getByRole("button", { name: t.cancelMeeting, exact: true }).click();
            await a.getByRole("alertdialog").or(a.getByRole("dialog")).getByRole("button", { name: t.confirm, exact: true }).click();
            await expect.poll(() => psql(`SELECT status FROM meetings WHERE id='${uuid(meeting.id)}'`)).toBe("CANCELLED");
            continue;
          }
          const connected = (page: Page) => page.getByRole("status").filter({ hasText: new RegExp(`^${t.phase.connected}$`) });
          await expect(a).toHaveURL(/\/(?:oda|room|raum)$/);
          await expect(connected(a)).toBeVisible({ timeout: 30_000 });
          await expect(a.getByRole("button", { name: t.join, exact: true })).toHaveCount(0);
          await b.goto(localizeHref(`/meetings/${meeting.id}/room`, locale));
          await b.getByRole("button", { name: t.join, exact: true }).click();
          await expect(connected(b)).toBeVisible({ timeout: 30_000 });
          await expect.poll(() => psql(`SELECT count(*) FROM meeting_participants WHERE meeting_id='${uuid(meeting.id)}' AND connected`), { timeout: 30_000 }).toBe("2");
          await a.getByRole("button", { name: t.micOn, exact: true }).click();
          await a.getByRole("button", { name: t.cameraOn, exact: true }).click();
          await expect(a.getByRole("button", { name: t.micOff, exact: true })).toBeVisible();
          await expect(a.getByRole("button", { name: t.cameraOff, exact: true })).toBeVisible();
          // Require decoded remote video and a live subscribed audio track, beyond enabled UI icons.
          await expect.poll(() => b.locator("video").evaluateAll(videos => videos.some(video => video instanceof HTMLVideoElement && video.videoWidth > 0 && video.readyState >= 2)), { timeout: 30_000 }).toBe(true);
          await expect.poll(() => b.locator("audio").evaluateAll(nodes => nodes.some(node => {
            const stream = node instanceof HTMLAudioElement ? node.srcObject as MediaStream | null : null;
            return stream?.getAudioTracks().some(track => track.readyState === "live" && track.enabled);
          })), { timeout: 30_000 }).toBe(true);
          await a.getByRole("button", { name: t.cameraOff, exact: true }).click();
          await expect(a.getByRole("button", { name: t.cameraOn, exact: true })).toBeVisible();
          await expect.poll(() => b.locator("video").count()).toBe(0);
          await a.getByRole("button", { name: t.micOff, exact: true }).click();
          await expect(a.getByRole("button", { name: t.micOn, exact: true })).toBeVisible();
          for (const page of [a, b]) {
            const box = page.locator("#meeting-message");
            if (!(await box.isVisible())) await page.locator("[data-room-controls]").getByRole("button", { name: t.chat, exact: true }).click();
            await expect(box).toBeEditable();
          }
          const message = `Real chat ${randomUUID()}`;
          await a.locator("#meeting-message").fill(message); await a.locator("#meeting-message").press("Enter");
          await expect(a.locator("#meeting-message")).toHaveValue("");
          await expect(b.locator("[data-meeting-room] aside").getByText(message, { exact: true })).toBeVisible({ timeout: 20_000 });
          expect(psql(`SELECT count(*) FROM meeting_chat_messages WHERE meeting_id='${uuid(meeting.id)}' AND content='${message}'`)).toBe("1");
          const reply = `Real reply ${randomUUID()}`;
          await b.locator("#meeting-message").fill(reply); await b.locator("#meeting-message").press("Enter");
          await expect(a.locator("[data-meeting-room] aside").getByText(reply, { exact: true })).toBeVisible({ timeout: 20_000 });
          expect(psql(`SELECT count(*) FROM meeting_chat_messages WHERE meeting_id='${uuid(meeting.id)}'`)).toBe("2");
          // Persisted history comes back through the real REST API after a full document reload.
          await b.reload(); await b.getByRole("button", { name: t.join, exact: true }).click();
          await expect(connected(b)).toBeVisible({ timeout: 30_000 });
          if (!(await b.locator("#meeting-message").isVisible())) await b.locator("[data-room-controls]").getByRole("button", { name: t.chat, exact: true }).click();
          await expect(b.locator("[data-meeting-room] aside").getByText(message, { exact: true })).toBeVisible();
          await expect(b.getByRole("button", { name: t.endForAll, exact: true })).toHaveCount(0);
          if (kind === "project") {
            await b.getByRole("button", { name: t.leave, exact: true }).click();
            await b.getByRole("button", { name: t.leaveConfirm, exact: true }).click();
            await expect(b.getByRole("status").filter({ hasText: new RegExp(`^${t.phase.left}$`) })).toBeVisible();
            await expect.poll(() => psql(`SELECT count(*) FROM meeting_participants WHERE meeting_id='${uuid(meeting.id)}' AND user_id='${uuid(guest.account.id)}' AND NOT connected AND left_at IS NOT NULL`)).toBe("1");
          }
          await a.getByRole("button", { name: t.endForAll, exact: true }).click();
          await a.getByRole("button", { name: t.endConfirmLabel, exact: true }).click();
          await expect.poll(() => psql(`SELECT count(*) FROM meetings WHERE id='${uuid(meeting.id)}' AND status='ENDED' AND ended_at IS NOT NULL AND NOT cleanup_pending`), { timeout: 30_000 }).toBe("1");
          if (kind === "independent") await expect(b.getByRole("status").filter({ hasText: new RegExp(`^${t.phase.closed}$`) })).toBeVisible({ timeout: 30_000 });
          expect((await api(guest.page, "GET", `/meetings/${meeting.id}`)).status).toBe(200);
        }
      }
      console.log(`${locale}: real API/DB/SFU acceptance passed (4 meetings; 2 two-person calls)`);
    } catch (error) {
      if (owner && !owner.page.isClosed()) await owner.page.screenshot({ path: test.info().outputPath("own-qa-failure.png") }).catch(() => {});
      throw error;
    } finally {
      // End only this test's still-open rooms before removing its own DB fixtures.
      if (owner) for (const id of meetingIds) {
        if (psql(`SELECT status FROM meetings WHERE id='${uuid(id)}'`) === "OPEN") {
          expect((await api(owner.page, "POST", `/meetings/${id}/end`)).status, "own room cleanup").toBe(200);
          await expect.poll(() => psql(`SELECT cleanup_pending FROM meetings WHERE id='${uuid(id)}'`), { timeout: 30_000 }).toBe("f");
        }
      }
      try { await Promise.all(actors.map(who => who.context.close())); }
      finally { cleanup(actors); }
    }
  });
}
