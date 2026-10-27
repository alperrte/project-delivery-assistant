import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readFileSync } from "node:fs";
import { api } from "./helpers";
import { meetingAccount } from "./meeting-fixture";
import { REJECTED_STATE } from "./consent-state";
import { localizeHref } from "../src/i18n/routing";
import type { Meeting, MeetingParticipant } from "../src/features/meetings/types";
import tr from "../src/i18n/meetings/tr.json";

// How soon the chat is usable after joining, measured against the real API, PostgreSQL and LiveKit with real browsers.
// Per join it records: the click, the admission (POST join), the moment the room says "connected", the first chat-history request and its status,
// the first SUCCESSFUL one, and the moment the backend's own participant record says "connected" (what the LiveKit webhook sets).
// CHAT_START_RUNS (default 4) joins are measured; CHAT_START_LABEL names the output file; CHAT_START_ASSERT=0 only reports (used for the "before" numbers).
const FAKE_MEDIA = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];
test.use({ storageState: REJECTED_STATE, trace: "off", video: "off", launchOptions: { args: FAKE_MEDIA } });
test.describe.configure({ mode: "serial" });
const base = "http://localhost:8080/api/v1", H = 3600_000;
const RUNS = Number(process.env.CHAT_START_RUNS ?? 4), LABEL = process.env.CHAT_START_LABEL ?? "run", ASSERT = process.env.CHAT_START_ASSERT !== "0";

async function login(context: BrowserContext, file: string) {
  const account = JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string };
  await context.request.get(`${base}/auth/csrf`);
  const csrf = (await context.cookies(base)).find(c => c.name === "XSRF-TOKEN")!;
  const result = await context.request.post(`${base}/auth/login`, { headers: { "X-XSRF-TOKEN": decodeURIComponent(csrf.value), Origin: "http://localhost:3000" }, data: { email: account.email, password: account.password } });
  expect(result.status()).toBe(200);
}
async function open(browser: Browser, role: "manager" | "member") {
  const context = await browser.newContext({ storageState: REJECTED_STATE, viewport: { width: 1280, height: 800 }, permissions: ["camera", "microphone"] });
  await login(context, meetingAccount(role, { fresh: true }));
  const page = await context.newPage(); await page.goto("/dashboard");
  return { context, page, me: (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string } };
}
const connected = (page: Page) => page.getByRole("status").filter({ hasText: new RegExp(`^${tr.phase.connected}$`) });
const percentile = (values: number[], p: number) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : NaN; };

type Sample = { admitMs: number; connectedMs: number; firstChatStatus: number; firstChatMs: number; firstOkMs: number; webhookMs: number; chatRequests: number[] };
/** One join of `page` into `meeting`, with the timings of everything that matters for the chat. */
async function measureJoin(page: Page, me: { id: string }, meeting: Meeting): Promise<Sample> {
  const chats: { status: number; at: number }[] = []; let admitAt = NaN;
  const onResponse = (response: import("@playwright/test").Response) => {
    const url = new URL(response.url());
    if (url.pathname.endsWith(`/meetings/${meeting.id}/chat`) && url.searchParams.get("page") === "0") chats.push({ status: response.status(), at: Date.now() });
    if (url.pathname.endsWith(`/meetings/${meeting.id}/join`) && response.request().method() === "POST") admitAt = Date.now();
  };
  page.on("response", onResponse);
  try {
    await page.goto(localizeHref(`/meetings/${meeting.id}/room`, "tr"));
    const join = page.getByRole("button", { name: tr.join, exact: true }); await expect(join).toBeVisible();
    // The backend's own record is watched from the click on (what the LiveKit webhook or the reconciliation sets as `connected`), so it is timed
    // against the room and the chat requests instead of from the moment the room says "connected".
    let webhookAt = NaN, watching = true;
    const watcher = (async () => {
      while (watching && Number.isNaN(webhookAt)) {
        const people = (await api(page, "GET", `/meetings/${meeting.id}/participants`).catch(() => undefined))?.json as MeetingParticipant[] | undefined;
        if (Array.isArray(people) && people.some(p => p.identity === `user-${me.id}` && p.connected)) webhookAt = Date.now(); else await new Promise(resolve => setTimeout(resolve, 15));
      }
    })();
    const clickAt = Date.now(); await join.click();
    await expect(connected(page)).toBeVisible({ timeout: 30000 }); const connectedAt = Date.now();
    for (let waited = 0; waited < 15000 && Number.isNaN(webhookAt); waited += 25) await page.waitForTimeout(25);
    watching = false; await watcher;
    // The first chat page the app gets with a 200.
    for (let waited = 0; waited < 15000 && !chats.some(c => c.status === 200); waited += 25) await page.waitForTimeout(25);
    const first = chats[0], ok = chats.find(c => c.status === 200);
    return { admitMs: admitAt - clickAt, connectedMs: connectedAt - clickAt, firstChatStatus: first?.status ?? 0, firstChatMs: first ? first.at - clickAt : NaN, firstOkMs: ok ? ok.at - clickAt : NaN, webhookMs: webhookAt - clickAt, chatRequests: chats.map(c => c.status) };
  } finally { page.off("response", onResponse); }
}
function report(label: string, samples: Sample[]) {
  const column = (pick: (s: Sample) => number) => samples.map(pick).filter(Number.isFinite);
  const summary = {
    label, runs: samples.length,
    firstChatNot200: samples.filter(s => s.firstChatStatus !== 200).length, chat403: samples.filter(s => s.chatRequests.includes(403)).length, neverOk: samples.filter(s => !Number.isFinite(s.firstOkMs)).length,
    chatRequestsPerJoin: { min: Math.min(...samples.map(s => s.chatRequests.length)), max: Math.max(...samples.map(s => s.chatRequests.length)) },
    connectedMs: { p50: percentile(column(s => s.connectedMs), 0.5), p95: percentile(column(s => s.connectedMs), 0.95) },
    firstOkAfterConnectedMs: { p50: percentile(column(s => s.firstOkMs - s.connectedMs), 0.5), p95: percentile(column(s => s.firstOkMs - s.connectedMs), 0.95), max: Math.max(...column(s => s.firstOkMs - s.connectedMs)) },
    firstChatMinusWebhookMs: { min: Math.min(...column(s => s.firstChatMs - s.webhookMs)), p50: percentile(column(s => s.firstChatMs - s.webhookMs), 0.5), max: Math.max(...column(s => s.firstChatMs - s.webhookMs)) }, // negative: the app asked before the backend knew the person was connected
    webhookAfterAdmitMs: { p50: percentile(column(s => s.webhookMs - s.admitMs), 0.5), p95: percentile(column(s => s.webhookMs - s.admitMs), 0.95), max: Math.max(...column(s => s.webhookMs - s.admitMs)) },
    webhookAfterConnectedMs: { p50: percentile(column(s => s.webhookMs - s.connectedMs), 0.5), p95: percentile(column(s => s.webhookMs - s.connectedMs), 0.95), max: Math.max(...column(s => s.webhookMs - s.connectedMs)) },
  };
  mkdirSync(path.join(__dirname, "../test-results/chat-start"), { recursive: true });
  writeFileSync(path.join(__dirname, `../test-results/chat-start/${label}.json`), JSON.stringify({ summary, samples }, null, 1));
  console.log(`CHAT_START ${JSON.stringify(summary)}`);
  return summary;
}

test("chat start: joining is followed by a usable chat at once, with no refused first request", async ({ browser }) => {
  test.setTimeout(60_000 + RUNS * 25_000);
  const owner = await open(browser, "manager");
  try {
    const page = owner.page;
    const meeting = (await api(page, "POST", "/meetings", { title: "Chat start", description: "", startsAt: new Date(Date.now() + 60_000).toISOString(), endsAt: new Date(Date.now() + H).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [], meetingType: "INDEPENDENT" })).json as Meeting;
    expect((await api(page, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
    const samples: Sample[] = [];
    for (let run = 0; run < RUNS; run++) {
      samples.push(await measureJoin(page, owner.me, meeting));
      // Leave for real, then wait out the one-token-per-two-seconds rule before the next admission.
      await api(page, "POST", `/meetings/${meeting.id}/leave`); await page.goto("about:blank"); await new Promise(resolve => setTimeout(resolve, 2300));
    }
    const summary = report(LABEL, samples);
    if (ASSERT) {
      expect(summary.chat403, "no chat-history request is refused while joining").toBe(0);
      expect(summary.neverOk, "the chat history always arrives").toBe(0);
      expect(summary.chatRequestsPerJoin.max, "no polling loop: a join asks for the first chat page only a few times").toBeLessThanOrEqual(3);
    }
  } finally { await owner.context.close(); }
});

test("chat start after a reload while joined: where a refused chat request comes from, and that the new session is never refused", async ({ browser }) => {
  test.setTimeout(60_000 + RUNS * 20_000);
  const owner = await open(browser, "manager");
  try {
    const page = owner.page;
    const meeting = (await api(page, "POST", "/meetings", { title: "Chat reload", description: "", startsAt: new Date(Date.now() + 60_000).toISOString(), endsAt: new Date(Date.now() + H).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [], meetingType: "INDEPENDENT" })).json as Meeting;
    expect((await api(page, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
    const seen: { status: number; at: number }[] = [];
    page.on("response", response => { const url = new URL(response.url()); if (url.pathname.endsWith(`/meetings/${meeting.id}/chat`) && url.searchParams.get("page") === "0") seen.push({ status: response.status(), at: Date.now() }); });
    const room = localizeHref(`/meetings/${meeting.id}/room`, "tr"), join = page.getByRole("button", { name: tr.join, exact: true });
    await page.goto(room); await join.click(); await expect(connected(page)).toBeVisible({ timeout: 30000 });
    let oldPage = 0, oldPage403 = 0, newSession = 0, newSession403 = 0; const firstOkAfterJoin: number[] = [];
    for (let run = 0; run < RUNS; run++) {
      // Reload at a different moment of the 4 s refresh cycle each time (and at least 2.3 s after the last admission: one token per two seconds).
      await page.waitForTimeout(2300 + Math.round((run * 4000) / Math.max(RUNS, 1)));
      seen.length = 0; await page.reload(); await expect(join).toBeVisible();
      const clickAt = Date.now(); await join.click(); await expect(connected(page)).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(1200);
      const before = seen.filter(request => request.at < clickAt), after = seen.filter(request => request.at >= clickAt);
      oldPage += before.length; oldPage403 += before.filter(request => request.status === 403).length;
      newSession += after.length; newSession403 += after.filter(request => request.status === 403).length;
      const ok = after.find(request => request.status === 200); if (ok) firstOkAfterJoin.push(ok.at - clickAt);
    }
    const summary = { label: `${LABEL}-reload`, runs: RUNS, requestsBeforeTheNewJoinClick: oldPage, refusedBeforeTheNewJoinClick: oldPage403, requestsOfTheNewSession: newSession, refusedInTheNewSession: newSession403, newSessionWithoutAnOk: RUNS - firstOkAfterJoin.length, firstOkAfterJoinMs: { p50: percentile(firstOkAfterJoin, 0.5), p95: percentile(firstOkAfterJoin, 0.95), max: Math.max(...firstOkAfterJoin) } };
    mkdirSync(path.join(__dirname, "../test-results/chat-start"), { recursive: true }); writeFileSync(path.join(__dirname, `../test-results/chat-start/${LABEL}-reload.json`), JSON.stringify(summary, null, 1));
    console.log(`CHAT_START ${JSON.stringify(summary)}`);
    if (ASSERT) { expect(summary.refusedInTheNewSession, "the new session is never refused").toBe(0); expect(summary.newSessionWithoutAnOk, "the chat history always arrives after a reload").toBe(0); }
    // A request the page that is going away had already sent is answered 403 once its connection is gone (about 1 reload in 30, before and after the fix):
    // the person has left, so refusing is right, and nobody is left to read the answer. It is reported (refusedBeforeTheNewJoinClick), not asserted.
  } finally { await owner.context.close(); }
});

test("chat start when several people connect at the same moment: nobody is refused, nobody waits for the next poll", async ({ browser }) => {
  const PEOPLE = 4; test.setTimeout(90_000 + RUNS * PEOPLE * 8_000);
  const owner = await open(browser, "manager"), others = await Promise.all(Array.from({ length: PEOPLE - 1 }, () => open(browser, "member")));
  try {
    const page = owner.page;
    const meeting = (await api(page, "POST", "/meetings", { title: "Chat together", description: "", startsAt: new Date(Date.now() + 60_000).toISOString(), endsAt: new Date(Date.now() + H).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: others.map(other => other.me.id), meetingType: "INDEPENDENT" })).json as Meeting;
    expect((await api(page, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
    const everyone = [owner, ...others], samples: Sample[] = [];
    for (let round = 0; round < RUNS; round++) {
      // All of them press "join" together: their admissions and LiveKit webhooks overlap, which is when the backend\x27s copy of the presence lags most.
      samples.push(...await Promise.all(everyone.map(person => measureJoin(person.page, person.me, meeting))));
      await Promise.all(everyone.map(async person => { await api(person.page, "POST", `/meetings/${meeting.id}/leave`); await person.page.goto("about:blank"); }));
      await new Promise(resolve => setTimeout(resolve, 2300));
    }
    const summary = report(`${LABEL}-together`, samples);
    if (ASSERT) {
      expect(summary.chat403, "nobody is refused while joining together").toBe(0); expect(summary.neverOk, "the chat history always arrives").toBe(0);
      expect(summary.chatRequestsPerJoin.max, "no polling loop").toBeLessThanOrEqual(3);
    }
  } finally { await Promise.all([owner, ...others].map(person => person.context.close())); }
});

test("a stub that replays the chat request from the test process (as the reply-fallback test does) around a reload: which page does a refused answer belong to", async ({ browser }) => {
  test.setTimeout(60_000 + RUNS * 20_000);
  const owner = await open(browser, "manager");
  try {
    const page = owner.page;
    const meeting = (await api(page, "POST", "/meetings", { title: "Chat replay", description: "", startsAt: new Date(Date.now() + 60_000).toISOString(), endsAt: new Date(Date.now() + H).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [], meetingType: "INDEPENDENT" })).json as Meeting;
    expect((await api(page, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
    // `route.fetch()` repeats the browser's request from this Node process, so it can be sent after the page that asked has already gone away.
    const replays: { status: number; requestedAt: number; answeredAt: number }[] = [];
    await page.route(url => url.pathname.endsWith(`/meetings/${meeting.id}/chat`) && url.searchParams.get("page") === "0", async route => {
      const requestedAt = Date.now(); const response = await route.fetch(); replays.push({ status: response.status(), requestedAt, answeredAt: Date.now() }); await route.fulfill({ response }).catch(() => {});
    });
    const room = localizeHref(`/meetings/${meeting.id}/room`, "tr"), join = page.getByRole("button", { name: tr.join, exact: true });
    await page.goto(room); await join.click(); await expect(connected(page)).toBeVisible({ timeout: 30000 });
    let fromGoingPage = 0, fromGoingPage403 = 0, fromNewSession = 0, fromNewSession403 = 0;
    for (let run = 0; run < RUNS; run++) {
      await page.waitForTimeout(2300 + Math.round((run * 4000) / Math.max(RUNS, 1)));
      replays.length = 0; await page.reload(); await expect(join).toBeVisible();
      const clickAt = Date.now(); await join.click(); await expect(connected(page)).toBeVisible({ timeout: 30000 }); await page.waitForTimeout(1200);
      const going = replays.filter(replay => replay.requestedAt < clickAt), fresh = replays.filter(replay => replay.requestedAt >= clickAt);
      fromGoingPage += going.length; fromGoingPage403 += going.filter(replay => replay.status === 403).length;
      fromNewSession += fresh.length; fromNewSession403 += fresh.filter(replay => replay.status === 403).length;
    }
    const summary = { label: `${LABEL}-replay`, runs: RUNS, replayedForThePageThatWasGoingAway: fromGoingPage, ofThemRefused: fromGoingPage403, replayedForTheNewSession: fromNewSession, ofThemRefusedInTheNewSession: fromNewSession403 };
    mkdirSync(path.join(__dirname, "../test-results/chat-start"), { recursive: true }); writeFileSync(path.join(__dirname, `../test-results/chat-start/${LABEL}-replay.json`), JSON.stringify(summary, null, 1));
    console.log(`CHAT_START ${JSON.stringify(summary)}`);
    if (ASSERT) expect(summary.ofThemRefusedInTheNewSession, "the new session is never refused").toBe(0);
  } finally { await owner.context.close(); }
});

test("chat start on a slow connection: latency makes it later, never refused, and the app does not loop on retries", async ({ browser }) => {
  test.setTimeout(60_000 + RUNS * 30_000);
  const owner = await open(browser, "manager");
  try {
    const page = owner.page;
    const meeting = (await api(page, "POST", "/meetings", { title: "Chat slow", description: "", startsAt: new Date(Date.now() + 60_000).toISOString(), endsAt: new Date(Date.now() + H).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [], meetingType: "INDEPENDENT" })).json as Meeting;
    expect((await api(page, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
    // 3G-like: 400 ms of latency each way and about 1.5 Mbit/s, for every request of the page (the signalling websocket is not a request and is untouched).
    const cdp = await owner.context.newCDPSession(page); await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 190_000, uploadThroughput: 190_000 });
    const samples: Sample[] = [], runs = Math.min(RUNS, 10);
    for (let run = 0; run < runs; run++) {
      samples.push(await measureJoin(page, owner.me, meeting));
      await api(page, "POST", `/meetings/${meeting.id}/leave`); await page.goto("about:blank"); await new Promise(resolve => setTimeout(resolve, 2300));
    }
    const summary = report(`${LABEL}-slow`, samples);
    if (ASSERT) { expect(summary.chat403, "latency alone never gets a join refused").toBe(0); expect(summary.neverOk).toBe(0); expect(summary.chatRequestsPerJoin.max, "no retry loop on a slow line").toBeLessThanOrEqual(3); }
  } finally { await owner.context.close(); }
});

test("a message can be sent the moment the room is connected, and chat stops for someone who was removed", async ({ browser }) => {
  test.setTimeout(120_000);
  const owner = await open(browser, "manager"), guest = await open(browser, "member");
  try {
    const page = owner.page, other = guest.page;
    const meeting = (await api(page, "POST", "/meetings", { title: "Chat now", description: "", startsAt: new Date(Date.now() + 60_000).toISOString(), endsAt: new Date(Date.now() + H).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [guest.me.id], meetingType: "INDEPENDENT" })).json as Meeting;
    expect((await api(page, "POST", `/meetings/${meeting.id}/start`)).status).toBe(200);
    const room = localizeHref(`/meetings/${meeting.id}/room`, "tr");
    for (const person of [{ page, who: "owner" }, { page: other, who: "member" }]) {
      await person.page.goto(room); await person.page.getByRole("button", { name: tr.join, exact: true }).click(); await expect(connected(person.page)).toBeVisible({ timeout: 30000 });
      // Straight away: no waiting for the webhook copy of the presence, no 403.
      const sent = await api(person.page, "POST", `/meetings/${meeting.id}/chat`, { content: `hello from the ${person.who}`, mentionIds: [] });
      expect(sent.status, `${person.who}: the first message is accepted at once`).toBe(201);
      expect((await api(person.page, "GET", `/meetings/${meeting.id}/chat?page=0&size=50`)).status, `${person.who}: the history is readable at once`).toBe(200);
      await person.page.waitForTimeout(800);
    }
    // The organizer removes the member: the room and the chat are closed to them, the organizer keeps both.
    const people = (await api(page, "GET", `/meetings/${meeting.id}/participants`)).json as MeetingParticipant[];
    const target = people.find(p => p.identity === `user-${guest.me.id}`)!;
    expect((await api(page, "POST", `/meetings/${meeting.id}/participants/${target.id}/kick`)).status).toBe(204);
    await expect.poll(async () => (await api(other, "GET", `/meetings/${meeting.id}/chat?page=0&size=50`)).status, { message: "a removed person cannot read the chat", timeout: 20000 }).toBe(403);
    expect((await api(other, "POST", `/meetings/${meeting.id}/chat`, { content: "still here?", mentionIds: [] })).status, "nor write to it").toBe(403);
    expect((await api(other, "POST", `/meetings/${meeting.id}/join`)).status, "and cannot come back in").toBe(403);
    // Removing someone rotates the room, so everybody else is reconnected by the app; once that is done the organizer's chat works again (it is only refused while they are between rooms).
    await expect.poll(async () => (await api(page, "GET", `/meetings/${meeting.id}/chat?page=0&size=50`)).status, { message: "the organizer is back in the new room and the chat works", timeout: 40000 }).toBe(200);
  } finally { await owner.context.close(); await guest.context.close(); }
});
