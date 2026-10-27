import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { BrowserContext, Page } from "@playwright/test";
import { demoData, demoPage } from "../src/features/landing/demo/demo-data";
import landing from "../src/i18n/landing/tr.json";
import type { Meeting, MeetingInput, MeetingMessage } from "../src/features/meetings/types";
import type { Locale } from "../src/i18n/config";

export const FINAL_OWNER = "00000000-0000-0000-0000-000000000001";
export const FINAL_PERSON = { userId: "00000000-0000-0000-0000-000000000002", nickname: "Final Guest", profilePhotoVersion: null };
const SELF = "00000000-0000-0000-0000-000000000011";

// TEST ONLY. Existing local SFU, synthetic identities and short-lived credentials.
// Credentials are read into memory, never returned, logged, written or traced.
// Room creation/deletion is normal isolated media use; no DB/backend API is used.
function localMedia() {
  let entries: string[];
  try {
    const context = execFileSync("docker", ["context", "show"], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (context !== "desktop-linux") throw new Error();
    entries = JSON.parse(execFileSync("docker", ["inspect", "--format", "{{json .Config.Env}}", "project-delivery-assistant-livekit-1"], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }));
  } catch { throw new Error("Frontend media fixture requires the existing local Docker Desktop LiveKit service"); }
  const pair = entries.find(entry => entry.startsWith("LIVEKIT_KEYS="))?.slice("LIVEKIT_KEYS=".length).trim().split(/:\s*/);
  if (!pair || pair.length !== 2 || !pair[0] || !pair[1]) throw new Error("Local SFU fixture credentials are unavailable");
  const jwt = (video: Record<string, unknown>, subject?: string) => {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: pair[0], sub: subject, name: "Final Organizer", nbf: now - 10, exp: now + 1800, video })).toString("base64url");
    const input = `${header}.${payload}`;
    return `${input}.${createHmac("sha256", pair[1]).update(input).digest("base64url")}`;
  };
  const call = async (method: "CreateRoom" | "DeleteRoom", room: string) => {
    const response = await fetch(`http://127.0.0.1:7880/twirp/livekit.RoomService/${method}`, {
      method: "POST", signal: AbortSignal.timeout(5000), headers: { Authorization: `Bearer ${jwt({ roomCreate: true })}`, "Content-Type": "application/json" },
      body: JSON.stringify(method === "CreateRoom" ? { name: room, empty_timeout: 120, max_participants: 4 } : { room }),
    });
    if (!response.ok && !(method === "DeleteRoom" && response.status === 404)) throw new Error(`Local media fixture ${method} failed (${response.status})`);
  };
  return { call, token: (room: string) => jwt({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true }, "final-organizer") };
}

/** The real application pages, with every PDA REST/socket request intercepted.
 * LiveKit alone is real when a room is joined; no existing user/meeting is used. */
export async function meetingFinalFixture(page: Page, context: BrowserContext, baseURL: string, locale: Locale = "tr", count = 26) {
  const origin = new URL(baseURL).origin, seed = demoData(landing);
  const project = { ...seed.project, id: "00000000-0000-0000-0000-000000000099", name: "Final Project", slug: "final-project", logoVersion: 1 };
  const otherProject = { ...project, id: "00000000-0000-0000-0000-000000000098", name: "Other Project", slug: "other-project", logoVersion: null };
  const projects = [project, otherProject];
  const now = Date.now(), meetings: Meeting[] = [];
  const makeMeeting = (input: Partial<MeetingInput>, index = meetings.length): Meeting => {
    const selected = projects.find(p => p.id === input.projectId) ?? project;
    return {
      id: randomUUID(), title: `Final Meeting ${String(index + 1).padStart(3, "0")}`, description: "Synthetic frontend acceptance data", startsAt: new Date(now + (index + 3) * 3600_000).toISOString(),
      endsAt: new Date(now + (index + 4) * 3600_000).toISOString(), zoneId: "Europe/Istanbul", agenda: [], attendeeIds: [FINAL_PERSON.userId], icon: "video",
      meetingType: "INDEPENDENT", ...input, project: input.meetingType === "PROJECT" ? selected : null, organizerId: FINAL_OWNER,
      organizer: { userId: FINAL_OWNER, nickname: "Final Organizer", profilePhotoVersion: null }, attendees: [FINAL_PERSON], status: "SCHEDULED",
      openedAt: null, endedAt: null, overtime: false, chatRetained: true, version: 0, roomEpoch: 0, reconnectRequired: false, cleanupPending: false, hidden: false,
    };
  };
  for (let index = 0; index < count; index++) meetings.push(makeMeeting({ meetingType: index % 2 ? "PROJECT" : "INDEPENDENT", projectId: index % 4 === 1 ? project.id : otherProject.id }, index));
  const created: MeetingInput[] = [], chat: MeetingMessage[] = [], unexpected: string[] = [];
  let sendCalls = 0, joinCalls = 0, sendGate: Promise<boolean> | undefined, release: ((success: boolean) => void) | undefined;
  let media: ReturnType<typeof localMedia> | undefined, roomCreated = false;
  const roomName = `pda-frontend-final-${randomUUID()}`;
  const participants = [{ id: SELF, identity: "final-organizer", displayName: "Final Organizer", guest: false, connected: true, revoked: false, joinedAt: new Date(now).toISOString(), leftAt: null, userId: FINAL_OWNER, profilePhotoVersion: null },
    { id: "00000000-0000-0000-0000-000000000012", identity: "final-guest", displayName: FINAL_PERSON.nickname, guest: false, connected: true, revoked: false, joinedAt: new Date(now).toISOString(), leftAt: null, ...FINAL_PERSON }];
  await context.addCookies([{ name: "PDA_SESSION", value: "1", url: origin }, { name: "NEXT_LOCALE", value: locale, url: origin }, { name: "XSRF-TOKEN", value: "synthetic-frontend-csrf", url: origin }]);
  await page.routeWebSocket(/\/api\/v1\/ws$/, socket => socket.onMessage(message => { if (String(message).startsWith("CONNECT")) socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0"); }));
  await page.route("**/api/v1/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace("/api/v1", ""), method = request.method();
    const headers = { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-xsrf-token", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" };
    const reply = (body: unknown, status = 200) => route.fulfill({ status, headers, contentType: "application/json", body: status === 204 ? undefined : JSON.stringify(body) });
    if (method === "OPTIONS" || path.endsWith("/team-deletions/claim")) return reply(null, 204);
    if (path === `/projects/${project.id}/logo`) return route.fulfill({ status: 200, headers, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jY/sAAAAASUVORK5CYII=", "base64") });
    if (path === "/auth/me") return reply({ id: FINAL_OWNER, nickname: "Final Organizer", email: "final@example.test", globalRole: "USER", mustChangePassword: false });
    if (path === "/auth/csrf") return reply({ headerName: "X-XSRF-TOKEN" });
    if (path === "/users/me/preferences") return reply({ locale, theme: "system", motion: "off", themeTransition: false });
    if (path.endsWith("/chat/conversations")) return reply({ group: null, groups: [], directs: [], totalUnread: 0 });
    if (path === "/projects") return reply(demoPage(projects));
    if (path.includes("/projects/by-slug/")) return reply(projects.find(p => path.endsWith(`/${p.slug}`)) ?? project);
    if (path.endsWith("/home")) return reply({ ...seed.home, project });
    if (path.endsWith(`/members/${FINAL_OWNER}`)) return reply({ userId: FINAL_OWNER, nickname: "Final Organizer", roles: ["PROJECT_MANAGER"], status: "ACTIVE", profilePhotoVersion: null });
    if (path.endsWith("/members")) return reply(demoPage([{ ...FINAL_PERSON, roles: ["TESTER"], status: "ACTIVE" }]));
    if (path === "/meetings/attendees/search") return reply(FINAL_PERSON.nickname.toLowerCase().includes((url.searchParams.get("q") ?? "").toLowerCase()) ? [FINAL_PERSON] : []);
    if (path === "/meetings/history") return reply({ count: 0 });
    if (path === "/meetings" && method === "GET") {
      const pageIndex = Number(url.searchParams.get("page") ?? 0), size = Number(url.searchParams.get("size") ?? 100);
      return reply({ content: meetings.slice(pageIndex * size, (pageIndex + 1) * size), totalElements: meetings.length, totalPages: Math.ceil(meetings.length / size), page: pageIndex, size });
    }
    if (path === "/meetings" && method === "POST") {
      const input = request.postDataJSON() as MeetingInput; created.push(input);
      const meeting = makeMeeting(input); meetings.unshift(meeting); return reply(meeting, 201);
    }
    const match = /^\/meetings\/([^/]+)(?:\/(.*))?$/.exec(path), meeting = match && meetings.find(m => m.id === match[1]), action = match?.[2];
    if (meeting) {
      if (!action && method === "GET") return reply(meeting);
      if (!action && method === "PUT") { Object.assign(meeting, request.postDataJSON()); return reply(meeting); }
      if (action === "start") { meeting.status = "OPEN"; meeting.openedAt = new Date().toISOString(); return reply(meeting); }
      if (action === "cancel" || action === "end") { meeting.status = action === "end" ? "ENDED" : "CANCELLED"; meeting.endedAt = new Date().toISOString(); return reply(meeting); }
      if (action === "participants") return reply(participants);
      if (action === "invites") return reply(demoPage([]));
      if (action === "join") {
        joinCalls++; media ??= localMedia();
        if (!roomCreated) { await media.call("CreateRoom", roomName); roomCreated = true; }
        return reply({ participantId: SELF, identity: "final-organizer", roomEpoch: 0, status: "OPEN", chatRetained: true, media: { url: "ws://localhost:7880", token: media.token(roomName), expiresAt: new Date(Date.now() + 1800_000).toISOString() } });
      }
      if (action === "leave") return reply(null, 204);
      if (action === "chat" && method === "GET") return reply(demoPage([...chat].reverse()));
      if (action === "chat" && method === "POST") {
        sendCalls++; const input = request.postDataJSON();
        if (sendGate && !(await sendGate)) return reply({ code: "MEETING_UNAVAILABLE" }, 503);
        const message: MeetingMessage = { id: randomUUID(), participantId: SELF, displayName: "Final Organizer", content: input.content, mentionIds: input.mentionIds ?? [], sentAt: new Date().toISOString(), reactions: [] };
        chat.push(message); return reply(message, 201);
      }
    }
    if (method !== "GET") unexpected.push(`${method} ${path}`);
    return reply(/count$/.test(path) ? { count: 0 } : { content: [], totalElements: 0, totalPages: 0, counts: {} });
  });
  return {
    project, otherProject, meetings, created, chat, unexpected,
    get sendCalls() { return sendCalls; }, get joinCalls() { return joinCalls; },
    holdSend() { sendGate = new Promise<boolean>(resolve => { release = resolve; }); },
    releaseSend(success = true) { release?.(success); release = undefined; sendGate = undefined; },
    openMeeting() { const meeting = meetings[0]; meeting.status = "OPEN"; meeting.openedAt = new Date().toISOString(); return meeting; },
    async dispose() { release?.(false); if (roomCreated && media) { await media.call("DeleteRoom", roomName); roomCreated = false; } },
  };
}
