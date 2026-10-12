import { expect, test, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

/**
 * Two real users in the project group: typing indicator (real STOMP/REST, nothing mocked) and the message layout
 * (balanced bubble padding, avatar pinned to the top of the row while reactions come and go).
 */
test.describe.serial("Chat typing indicator and message layout", () => {
  let a: Page, b: Page, slug: string, project: string, conversation: string, nicknameA: string;
  const label = (page: Page) => page.getByTestId("chat-typing-label");
  const row = (page: Page, text: string) =>
    page.getByTestId("chat-message").filter({ has: page.getByTestId("chat-message-text").filter({ hasText: text }) });
  async function open(page: Page) {
    await page.getByTestId("chat-nav-item").click();
    await expect(page.getByTestId("chat-composer")).toBeEnabled();
  }
  async function send(page: Page, text: string) {
    await page.getByTestId("chat-composer").fill(text);
    await page.getByTestId("chat-composer").press("Enter");
  }

  test.beforeAll(async ({ browser }) => {
    a = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    b = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
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
    await open(a);
    await open(b);
    conversation = ((await api(a, "GET", `/projects/${project}/chat/conversations`)).json as { group: { id: string } }).group.id;
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
    await b.getByTestId("chat-conversation-group").click();
    await a.context().setOffline(true);
    // No "stopped" signal can arrive; the receiver's own timeout clears it.
    await expect(label(b)).toHaveCount(0, { timeout: 12_000 });
    await a.context().setOffline(false);
  });

  test("a typing signal into a foreign conversation is refused by the server", async () => {
    const response = await api(b, "POST", `/projects/${project}/chat/conversations/00000000-0000-0000-0000-000000000000/typing`, { typing: true });
    expect(response.status).toBe(404);
  });

  test("double click replies, seen appears under the newest own message, delete leaves a tombstone for both users", async () => {
    await send(a, "Double click me");
    const incoming = row(b, "Double click me");
    await expect(incoming).toBeVisible();
    await incoming.getByTestId("chat-message-bubble").dblclick();
    await expect(b.getByTestId("chat-reply-context")).toContainText("Double click me");
    await b.getByTestId("chat-reply-cancel").click();

    // b has the conversation open at the bottom, so a's message is seen soon after it arrived.
    await expect(row(a, "Double click me").getByTestId("chat-message-seen")).toBeVisible();
    await send(a, "Newer message");
    await expect(row(a, "Double click me").getByTestId("chat-message-seen")).toHaveCount(0);
    await expect(row(a, "Newer message").getByTestId("chat-message-seen")).toBeVisible();

    // Only the sender gets a delete action; confirming turns the message into a tombstone on both sides.
    await incoming.hover();
    await incoming.getByTestId("chat-message-actions").click();
    await expect(b.getByTestId("chat-message-delete")).toHaveCount(0);
    await b.keyboard.press("Escape");
    const own = row(a, "Double click me");
    await own.hover();
    await own.getByTestId("chat-message-actions").click();
    await a.getByTestId("chat-message-delete").click();
    await a.getByTestId("chat-delete-confirm").click();
    await expect(a.getByTestId("chat-message-deleted")).toHaveCount(1);
    await expect(b.getByTestId("chat-message-deleted")).toHaveCount(1);
    await expect(b.getByText("Double click me")).toHaveCount(0);
  });

  test("bubble padding is balanced and the avatar stays at the top of its row when reactions are added and removed", async () => {
    await open(a);
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
    expect(offset).toBeLessThanOrEqual(1);

    const url = `/projects/${project}/chat/conversations/${conversation}/messages/${id}/reactions`;
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
