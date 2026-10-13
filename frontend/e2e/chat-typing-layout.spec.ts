import { expect, test, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Two real users in the project group: typing indicator (real STOMP/REST, nothing mocked) and the message layout
 * (balanced bubble padding, avatar pinned to the top of the row while reactions come and go).
 */
test.describe.serial("Chat typing indicator and message layout", () => {
  let a: Page, b: Page, slug: string, project: string, conversation: string, nicknameA: string;
  let deletedProbeId: string | undefined;
  type SocketDiagnostic = { at: number; socket: number; type: string; conversationId?: string; messageId?: string; messageIds?: string[]; ownQueue?: boolean };
  const socketDiagnostics: SocketDiagnostic[] = [];
  const recordSocket = (event: Omit<SocketDiagnostic, "at">) => {
    socketDiagnostics.push({ at: Date.now(), ...event });
    if (socketDiagnostics.length > 1000) socketDiagnostics.shift();
  };
  const safeId = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : undefined;
  const label = (page: Page) => page.getByTestId("chat-typing-label");
  const row = (page: Page, text: string) =>
    page.getByTestId("chat-message").filter({ has: page.getByTestId("chat-message-text").filter({ hasText: text }) });
  async function open(page: Page) {
    await page.getByTestId("chat-nav-item").click();
    if(conversation)await page.locator(`[data-conversation-id="${conversation}"]`).click();
    await expect(page.getByTestId("chat-composer")).toBeEnabled();
  }
  async function send(page: Page, text: string) {
    await page.getByTestId("chat-composer").fill(text);
    await page.getByTestId("chat-composer").press("Enter");
  }

  test.beforeAll(async ({ browser }) => {
    a = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    b = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
    let socketNumber = 0;
    // TEST-ONLY diagnostics: persist only event codes/UUIDs, never raw frames, content or authentication headers.
    b.on("websocket", socket => {
      if (new URL(socket.url()).pathname !== "/api/v1/ws") return;
      const socketId = ++socketNumber;
      recordSocket({ socket: socketId, type: "OPEN" });
      socket.on("close", () => recordSocket({ socket: socketId, type: "CLOSE" }));
      socket.on("socketerror", () => recordSocket({ socket: socketId, type: "SOCKET_ERROR" }));
      socket.on("framesent", ({ payload }) => {
        const frame = payload.toString();
        if (frame.startsWith("SUBSCRIBE\n")) recordSocket({ socket: socketId, type: "SUBSCRIBE", ownQueue: frame.includes("\ndestination:/user/queue/chat\n") });
        if (frame.startsWith("DISCONNECT\n")) recordSocket({ socket: socketId, type: "DISCONNECT" });
      });
      socket.on("framereceived", ({ payload }) => {
        const frame = payload.toString();
        if (frame.startsWith("CONNECTED\n")) recordSocket({ socket: socketId, type: "CONNECTED" });
        const start = frame.indexOf("\n\n");
        if (start < 0) return;
        try {
          const event = JSON.parse(frame.slice(start + 2).replace(/\0+$/, "")) as Record<string, unknown>;
          if (!["MESSAGE", "READ", "REACTIONS", "TYPING", "DELETED", "SEEN", "DELIVERED"].includes(String(event.type))) return;
          const message = event.message && typeof event.message === "object" ? event.message as Record<string, unknown> : undefined;
          recordSocket({ socket: socketId, type: String(event.type), conversationId: safeId(event.conversationId),
            messageId: safeId(event.messageId ?? message?.id),
            messageIds: Array.isArray(event.messageIds) ? event.messageIds.map(safeId).filter((id): id is string => !!id).slice(0, 100) : undefined });
        } catch { /* Ignore heartbeat/protocol frames; never retain their raw payload. */ }
      });
    });
    slug = await createProject(a, `Typing Layout ${Date.now()}`);
    project = ((await api(a, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    await b.goto("/projects");
    const person = (await api(b, "GET", "/auth/me")).json as { id: string };
    nicknameA = ((await api(a, "GET", "/auth/me")).json as { nickname: string }).nickname;
    const team = (await api(a, "POST", `/projects/${project}/teams`, { name: "Typing team" })).json as { id: string };
    const invitation = (await api(a, "POST", `/projects/${project}/invitations`, { userId: person.id, teamId: team.id, roles: ["TESTER"] })).json as { invitationId: string; token: string };
    expect((await api(b, "POST", `/projects/${project}/invitations/${invitation.invitationId}/accept`, { token: invitation.token })).status).toBe(200);
    await a.goto(`/projects/${slug}`);
    await b.goto(`/projects/${slug}`);
    conversation = ((await api(a, "GET", `/chat/conversations`)).json as { groups: { id: string; projectId: string }[] }).groups.find(group => group.projectId === project)!.id;
    await open(a);
    await open(b);
  });
  test.afterEach(async ({}, testInfo) => {
    const cacheProbe = await b?.evaluate(() => {
      const shell = document.querySelector(".app-shell") as (HTMLElement & { __qaChatDeletionProbe?: { read: () => unknown; unsubscribe: () => void } }) | null;
      const probe = shell?.__qaChatDeletionProbe;
      if (!probe) return { available: false, reason: "query-client-probe-unavailable" };
      try { return probe.read(); } finally { probe.unsubscribe(); delete shell!.__qaChatDeletionProbe; }
    }).catch(() => ({ available: false, reason: "peer-page-unavailable" }));
    if (testInfo.status === testInfo.expectedStatus) return;
    const probes: { actor: "sender" | "peer"; status?: number; deleted?: boolean | null; unavailable?: boolean }[] = [];
    if (deletedProbeId && conversation) {
      for (const [actor, page] of [["sender", a], ["peer", b]] as const) {
        try {
          const response = await api(page, "GET", `/chat/conversations/${conversation}/messages`);
          const history = response.json as { messages?: { id: string; deleted: boolean }[] };
          probes.push({ actor, status: response.status, deleted: history.messages?.find(message => message.id === deletedProbeId)?.deleted ?? null });
        } catch { probes.push({ actor, unavailable: true }); }
      }
    }
    await testInfo.attach("peer-chat-socket-diagnostics", { contentType: "application/json", body: Buffer.from(JSON.stringify({ conversationId: conversation, messageId: deletedProbeId, sockets: socketDiagnostics, probes, cacheProbe })) });
  });
  test.afterAll(async () => {
    if (a) {
      await api(a, "POST", `/projects/${project}/archive`).catch(() => undefined);
      await a.context().close();
    }
    await b?.context().close();
  });

  test("typing shows for the other user only, is throttled, clears when the box is emptied and when a message arrives", async () => {
    const signals: string[] = [];
    a.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith(`/conversations/${conversation}/typing`)) signals.push(request.postData() ?? "");
    });
    await a.getByTestId("chat-composer").pressSequentially("hello there", { delay: 30 });
    await expect(label(b)).toContainText(nicknameA);
    await expect(label(a)).toHaveCount(0);
    // Eleven keystrokes produced a handful of requests, not eleven.
    expect(signals.filter((body) => body.includes("true")).length).toBeLessThanOrEqual(2);

    await a.getByTestId("chat-composer").fill("");
    await expect(label(b)).toHaveCount(0);

    await a.getByTestId("chat-composer").pressSequentially("one more", { delay: 30 });
    await expect(label(b)).toContainText(nicknameA);
    await a.getByTestId("chat-composer").press("Enter");
    await expect(row(b, "one more")).toBeVisible();
    await expect(label(b)).toHaveCount(0);
  });

  test("the indicator goes away on its own when the typist's connection vanishes, and never follows a conversation switch", async () => {
    await a.getByTestId("chat-composer").pressSequentially("still typing", { delay: 30 });
    await expect(label(b)).toContainText(nicknameA);
    // Another conversation of the viewer shows nothing of what happens in the group.
    const peer = (await api(a, "GET", "/auth/me")).json as { id: string };
    await b.locator(`[data-testid="chat-conversation-direct"][data-peer-id="${peer.id}"]`).click();
    await expect(label(b)).toHaveCount(0);
    await b.locator(`[data-testid="chat-conversation-group"][data-conversation-id="${conversation}"]`).click();
    await a.context().setOffline(true);
    // No "stopped" signal can arrive; the receiver's own timeout clears it.
    await expect(label(b)).toHaveCount(0, { timeout: 12_000 });
    await a.context().setOffline(false);
  });

  test("a typing signal into a foreign conversation is refused by the server", async () => {
    const response = await api(b, "POST", `/chat/conversations/00000000-0000-0000-0000-000000000000/typing`, { typing: true });
    expect(response.status).toBe(404);
  });

  test("double click replies, each own message retains exact read proof, delete leaves a tombstone for both users", async () => {
    await send(a, "Double click me");
    const incoming = row(b, "Double click me");
    await expect(incoming).toBeVisible();
    await incoming.getByTestId("chat-message-bubble").dblclick();
    await expect(b.getByTestId("chat-reply-context")).toContainText("Double click me");
    await b.getByTestId("chat-reply-cancel").click();

    // b has the conversation open at the bottom, so a's message is seen soon after it arrived.
    await expect(row(a, "Double click me").getByTestId("chat-message-seen")).toBeVisible();
    await send(a, "Newer message");
    await expect(row(a, "Double click me").getByTestId("chat-message-seen")).toBeVisible();
    await expect(row(a, "Newer message").getByTestId("chat-message-seen")).toBeVisible();
    const originalId = (await incoming.getAttribute("data-message-id"))!;
    deletedProbeId = originalId;
    const newerId = (await row(a, "Newer message").getAttribute("data-message-id"))!;
    const readerId = ((await api(b, "GET", "/auth/me")).json as { id: string }).id;
    await expect.poll(async () => {
      const receipts = (await api(a, "GET", `/chat/conversations/${conversation}/receipts`)).json as { messageId?: string; userId: string; readAt: string }[];
      return [originalId, newerId].map(id => receipts.some(receipt => receipt.messageId === id && receipt.userId === readerId && Number.isFinite(Date.parse(receipt.readAt))));
    }).toEqual([true, true]);

    // Only the sender gets a delete action; confirming turns the message into a tombstone on both sides.
    await b.bringToFront();
    const peerTrigger = incoming.getByTestId("chat-message-actions");
    await peerTrigger.focus();
    await peerTrigger.press("Enter");
    const peerReplyAction = b.getByTestId("chat-message-reply");
    await expect(peerReplyAction).toBeVisible();
    await expect(peerReplyAction).toBeFocused();
    await expect(b.getByTestId("chat-message-delete")).toHaveCount(0);
    await peerReplyAction.press("Escape");
    await expect(peerReplyAction).toHaveCount(0);
    await expect(b.getByTestId("chat-panel")).toBeVisible();
    await expect(incoming).toBeVisible();
    const own = row(a, "Double click me");
    await a.bringToFront();
    await own.hover();
    await own.getByTestId("chat-message-actions").click();
    await a.getByTestId("chat-message-delete").click();
    // TEST-ONLY read-only fiber lookup: no app export/global or production instrumentation.
    await b.evaluate(({ actorId, conversationId, messageId }) => {
      type Entry = { at: number; type: string; status?: string; observers?: number; present: boolean; deleted: boolean | null };
      type Probe = { read: () => unknown; unsubscribe: () => void };
      type Fiber = { return?: Fiber | null; memoizedProps?: { client?: unknown; value?: unknown } };
      const shell = document.querySelector(".app-shell") as (HTMLElement & { __qaChatDeletionProbe?: Probe }) | null;
      if (!shell) return;
      const properties = shell as unknown as Record<string, unknown>;
      const fiberKey = Object.keys(properties).find(key => key.startsWith("__reactFiber$"));
      let fiber = fiberKey ? properties[fiberKey] as Fiber : undefined;
      let client: QueryClient | undefined;
      for (let depth = 0; fiber && depth < 200; depth++, fiber = fiber.return ?? undefined) {
        for (const candidate of [fiber.memoizedProps?.client, fiber.memoizedProps?.value]) {
          if (candidate && typeof candidate === "object" && typeof (candidate as QueryClient).getQueryCache === "function" && typeof (candidate as QueryClient).getQueryData === "function") {
            client = candidate as QueryClient;
            break;
          }
        }
        if (client) break;
      }
      if (!client) {
        shell.__qaChatDeletionProbe = { read: () => ({ available: false, reason: "query-client-not-found" }), unsubscribe: () => {} };
        return;
      }
      const key = ["accounts", actorId, "chat", "messages", conversationId];
      const entries: Entry[] = [];
      const snapshot = (type: string): Entry => {
        const query = client!.getQueryCache().find({ queryKey: key, exact: true });
        const data = query?.state.data as { pages?: { messages?: { id: string; deleted?: boolean }[] }[] } | undefined;
        const message = data?.pages?.flatMap(page => page.messages ?? []).find(item => item?.id === messageId);
        return { at: Date.now(), type, status: query?.state.status, observers: query?.getObserversCount(), present: !!message, deleted: message ? message.deleted === true : null };
      };
      const record = (type: string) => { entries.push(snapshot(type)); if (entries.length > 200) entries.shift(); };
      record("BEFORE_DELETE");
      const unsubscribe = client.getQueryCache().subscribe(event => {
        const queryKey = event.query.queryKey;
        if (queryKey.length !== key.length || !queryKey.every((part: unknown, index: number) => part === key[index])) return;
        record(event.type);
      });
      shell.__qaChatDeletionProbe = { unsubscribe, read: () => {
        const target = document.querySelector(`[data-testid="chat-message"][data-message-id="${messageId}"]`);
        return { available: true, target: snapshot("FAILURE_SNAPSHOT"), entries,
          dom: { rowCount: document.querySelectorAll(`[data-testid="chat-message"][data-message-id="${messageId}"]`).length,
            deletedCount: target?.querySelectorAll('[data-testid="chat-message-deleted"]').length ?? 0,
            activeGroups: [...document.querySelectorAll('[data-testid="chat-conversation-group"][aria-current="true"]')].filter(element => element.getClientRects().length > 0).map(element => element.getAttribute("data-conversation-id")) } };
      } };
    }, { actorId: readerId, conversationId: conversation, messageId: originalId }).catch(() => undefined);
    await a.getByTestId("chat-delete-confirm").click();
    await expect(a.locator(`[data-message-id="${originalId}"]`).getByTestId("chat-message-deleted")).toBeVisible();
    await b.bringToFront();
    await expect(b.locator(`[data-message-id="${originalId}"]`).getByTestId("chat-message-deleted")).toBeVisible();
    await expect(b.getByText("Double click me")).toHaveCount(0);
  });

  test("bubble padding is balanced and the avatar stays at the top of its row when reactions are added and removed", async () => {
    await open(a);
    const boundary = `Avatar sender boundary ${Date.now()}`;
    await send(b, boundary);
    await expect(row(a, boundary)).toBeVisible();
    await send(a, "Avatar probe\nsecond line https://example.com/a/very/long/link/that/keeps/going/and/going/and/going 😀");
    const received = row(b, "Avatar probe");
    await expect(received).toBeVisible();
    const id = (await received.getAttribute("data-message-id"))!;

    // Left and right padding of the bubble are the same, for a received and for an own message.
    const padding = (page: Page, text: string) =>
      row(page, text).getByTestId("chat-message-bubble").evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.paddingLeft, style.paddingRight];
      });
    const [left, right] = await padding(b, "Avatar probe");
    expect(left).toBe(right);
    const [ownLeft, ownRight] = await padding(a, "Avatar probe");
    expect(ownLeft).toBe(ownRight);

    const avatar = received.locator('[data-slot="avatar"]');
    await expect(avatar).toBeVisible();
    const top = async () => (await avatar.boundingBox())!.y;
    const rowTop = async () => (await received.boundingBox())!.y;
    const offset = (await top()) - (await rowTop());
    const rowPaddingTop = await received.evaluate(element => parseFloat(getComputedStyle(element).paddingTop));
    expect(offset - rowPaddingTop).toBeLessThanOrEqual(1);

    const url = `/chat/conversations/${conversation}/messages/${id}/reactions`;
    for (const code of ["THUMBS_UP", "HEART", "LAUGH"]) {
      expect((await api(a, "PUT", `${url}/${code}`)).status).toBe(200);
      await expect(received.getByTestId(`chat-reaction-${code}`)).toBeVisible();
      expect((await top()) - (await rowTop())).toBe(offset);
    }
    for (const code of ["THUMBS_UP", "HEART", "LAUGH"]) {
      expect((await api(a, "DELETE", `${url}/${code}`)).status).toBe(200);
    }
    await expect(received.getByTestId("chat-reactions")).toHaveCount(0);
    expect((await top()) - (await rowTop())).toBe(offset);
  });
});
