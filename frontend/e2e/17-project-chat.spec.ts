import { readFileSync } from "node:fs";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { api, createProject, login, registerAndLogin } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE, MEMBER_USER_FILE } from "./global-setup";

/** A real 1x1 PNG: the server reads the type and size from the bytes, so a made-up header would be refused. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

type Person = { id: string; nickname: string };

const panelOf = (page: Page) => page.getByTestId("chat-panel");
const barOf = (page: Page) => page.getByTestId("chat-bar");
const compactOf = (page: Page) => page.getByTestId("chat-compact");
const navItemOf = (page: Page) => page.getByTestId("chat-nav-item");
const composerOf = (page: Page) => page.getByTestId("chat-composer");
const messagesOf = (page: Page) => page.getByTestId("chat-message");
const directRow = (page: Page, person: Person) => page.locator(`[data-testid="chat-conversation-direct"][data-peer-id="${person.id}"]`);

async function openPanel(page: Page) {
  await navItemOf(page).click();
  await expect(panelOf(page)).toBeVisible();
}

async function send(page: Page, text: string) {
  await composerOf(page).fill(text);
  await composerOf(page).press("Enter");
}

/** True while the socket is connected: sending is only enabled then, so tests wait for it before typing. */
async function expectSendEnabled(page: Page) {
  await expect(composerOf(page)).toBeEnabled();
}

/**
 * Project chat, end to end, with a Project Manager and a normal member in two browser contexts: the sidebar entry,
 * the full panel, direct and group messages arriving live, unread counting, the three panel states with navigation in
 * between, project change, avatars, plain-text rendering and the server-side refusal for someone outside the project.
 */
test.describe.serial("Project chat", () => {
  let managerPage: Page;
  let memberPage: Page;
  let outsiderPage: Page;
  let slug: string;
  let slug2: string;
  let projectId: string;
  const projectName = `E2E Chat Project ${Date.now()}`;
  let manager: Person;
  let member: Person;
  const project2Name = `E2E Chat Second ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    managerPage = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    memberPage = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
    // The one extra account of this file: it has no project at all, so it is also the "outside the project" user.
    outsiderPage = await (await browser.newContext({ locale: "tr-TR" })).newPage();
    await registerAndLogin(outsiderPage, "chatout");
  });

  test.afterAll(async () => {
    // The shared accounts must not keep a photo after this file, whatever happened in it.
    await api(memberPage, "DELETE", "/users/me/profile-photo").catch(() => undefined);
    await api(managerPage, "DELETE", "/users/me/profile-photo").catch(() => undefined);
    await managerPage.close();
    await memberPage.close();
    await outsiderPage.close();
  });

  test("a manager and a member share a project", async () => {
    slug = await createProject(managerPage, projectName);
    projectId = ((await api(managerPage, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    manager = (await api(managerPage, "GET", "/auth/me")).json as Person;

    await memberPage.goto("/projects");
    member = (await api(memberPage, "GET", "/auth/me")).json as Person;
    const team = await api(managerPage, "POST", `/projects/${projectId}/teams`, { name: "Chat Team" });
    expect(team.status).toBe(201);
    const invite = await api(managerPage, "POST", `/projects/${projectId}/invitations`, {
      userId: member.id,
      roles: ["FRONTEND_DEVELOPER"],
      teamId: (team.json as { id: string }).id,
    });
    expect(invite.status).toBe(201);
    const { invitationId, token } = invite.json as { invitationId: string; token: string };
    const accepted = await api(memberPage, "POST", `/projects/${projectId}/invitations/${invitationId}/accept`, { token });
    expect(accepted.status).toBe(200);
  });

  test("the Mesajlaşma entry appears only with a selected project", async () => {
    // Somebody with no project has "choose a project" in the sidebar and no chat entry.
    await outsiderPage.goto("/dashboard");
    await expect(outsiderPage.getByRole("link", { name: "Proje seçin" }).first()).toBeVisible();
    await expect(navItemOf(outsiderPage)).toHaveCount(0);

    await managerPage.goto(`/projects/${slug}`);
    await expect(navItemOf(managerPage)).toBeVisible();
    await expect(navItemOf(managerPage)).toContainText("Mesajlaşma");
    // It belongs to the selected-project group, not to the global links.
    await expect(managerPage.getByRole("navigation", { name: "Gezinme menüsü" }).getByTestId("chat-nav-item")).toBeVisible();
  });

  test("it opens as a full panel that leaves the sidebar usable", async () => {
    await openPanel(managerPage);
    await expect(managerPage.getByTestId("chat-conversation-group")).toHaveAttribute("aria-current", "true");
    // The project group is called like the project itself.
    await expect(managerPage.getByTestId("chat-active-name")).toHaveText(projectName);
    await expect(managerPage.getByTestId("chat-conversation-group")).toContainText(projectName);
    await expect(directRow(managerPage, member)).toBeVisible();
    // Yourself is not offered as a conversation.
    await expect(directRow(managerPage, manager)).toHaveCount(0);

    // The panel sits to the right of the sidebar, not over it.
    const sidebar = await managerPage.locator("aside").first().boundingBox();
    const panel = await panelOf(managerPage).boundingBox();
    expect(sidebar).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(panel!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width - 1);
    expect(panel!.width).toBeGreaterThan(600);
  });

  test("a direct message reaches the member live, with an unread badge that clears on opening", async () => {
    await memberPage.goto(`/projects/${slug}`);
    await expect(navItemOf(memberPage)).toBeVisible();
    await expect(memberPage.getByTestId("chat-nav-badge")).toHaveCount(0);

    await directRow(managerPage, member).click();
    await expect(managerPage.getByTestId("chat-active-name")).toHaveText(member.nickname);
    await expectSendEnabled(managerPage);
    await send(managerPage, "Merhaba, bu birebir bir mesaj");
    await expect(messagesOf(managerPage).filter({ hasText: "Merhaba, bu birebir bir mesaj" })).toHaveAttribute("data-own", "true");

    // The member never reloaded: the badge appears because the message arrived over the socket.
    await expect(memberPage.getByTestId("chat-nav-badge")).toHaveText("1");
    await openPanel(memberPage);
    await expect(directRow(memberPage, manager)).toContainText("Merhaba, bu birebir bir mesaj");
    await directRow(memberPage, manager).click();
    const received = messagesOf(memberPage).filter({ hasText: "Merhaba, bu birebir bir mesaj" });
    await expect(received).toBeVisible();
    await expect(received).toHaveAttribute("data-own", "false");
    // Reading it clears the badge (locally at once, confirmed by the server).
    await expect(memberPage.getByTestId("chat-nav-badge")).toHaveCount(0);

    // A reply arrives for the manager in the open conversation.
    await send(memberPage, "Selam, mesaj geldi");
    await expect(messagesOf(managerPage).filter({ hasText: "Selam, mesaj geldi" })).toBeVisible();
  });

  test("a group message from the manager appears for the member", async () => {
    await memberPage.getByTestId("chat-conversation-group").click();
    await managerPage.getByTestId("chat-conversation-group").click();
    await expectSendEnabled(managerPage);
    await send(managerPage, "Herkese duyuru: yarın demo var");

    const announcement = messagesOf(memberPage).filter({ hasText: "Herkese duyuru: yarın demo var" });
    await expect(announcement).toBeVisible();
    // In the group, a message shows who wrote it.
    await expect(announcement.getByText(manager.nickname)).toBeVisible();
    // Both are looking at the group, so nothing stays unread.
    await expect(memberPage.getByTestId("chat-nav-badge")).toHaveCount(0);
  });

  test("unread counts in the list while the member is in another conversation", async () => {
    await directRow(memberPage, manager).click();
    await expect(memberPage.getByTestId("chat-active-name")).toHaveText(manager.nickname);
    await send(managerPage, "Grup için ikinci mesaj");

    const groupRow = memberPage.getByTestId("chat-conversation-group");
    await expect(groupRow).toContainText("Grup için ikinci mesaj");
    await expect(groupRow).toContainText("1 okunmamış mesaj");
    await expect(memberPage.getByTestId("chat-nav-badge")).toHaveText("1");

    await groupRow.click();
    await expect(messagesOf(memberPage).filter({ hasText: "Grup için ikinci mesaj" })).toBeVisible();
    await expect(memberPage.getByTestId("chat-nav-badge")).toHaveCount(0);
    await expect(groupRow).not.toContainText("okunmamış");
  });

  test("full, bar, compact: the chat survives navigation and keeps conversation, history and draft", async () => {
    await directRow(managerPage, member).click();
    await expect(messagesOf(managerPage).filter({ hasText: "Selam, mesaj geldi" })).toBeVisible();
    await composerOf(managerPage).fill("yarım kalan taslak");

    // "—" shrinks the full panel to the bottom-right bar ("×" closes it completely, see below).
    await managerPage.getByTestId("chat-minimize").click();
    await expect(panelOf(managerPage)).toHaveCount(0);
    await expect(barOf(managerPage)).toBeVisible();
    await expect(managerPage.getByTestId("chat-bar-title")).toHaveText(member.nickname);
    const viewport = managerPage.viewportSize()!;
    const bar = (await barOf(managerPage).boundingBox())!;
    expect(bar.x + bar.width).toBeGreaterThan(viewport.width - 40);
    expect(bar.y + bar.height).toBeGreaterThan(viewport.height - 4);

    await barOf(managerPage).getByTestId("chat-bar-expand").click();
    await expect(compactOf(managerPage)).toBeVisible();
    await managerPage.getByTestId("chat-minimize").click();
    await expect(barOf(managerPage)).toBeVisible();

    // Move through the project's pages with the bar still there.
    await managerPage.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Görevler", exact: true }).first().click();
    await expect(managerPage).toHaveURL(new RegExp(`/projects/${slug}/tasks`));
    await expect(barOf(managerPage)).toBeVisible();

    // Compact: the same conversation, the same history, the same unsent draft.
    await managerPage.getByTestId("chat-bar-expand").click();
    await expect(compactOf(managerPage)).toBeVisible();
    await expect(managerPage.getByTestId("chat-active-name")).toHaveText(member.nickname);
    await expect(messagesOf(managerPage).filter({ hasText: "Selam, mesaj geldi" })).toBeVisible();
    await expect(composerOf(managerPage)).toHaveValue("yarım kalan taslak");

    // A new message arrives while compact: it shows and (being read) leaves no unread behind.
    await directRow(memberPage, manager).click();
    await expectSendEnabled(memberPage);
    await send(memberPage, "Compact pencerede de görünür");
    await expect(messagesOf(managerPage).filter({ hasText: "Compact pencerede de görünür" })).toBeVisible();

    // Back to full size: the conversation is still the active one and the draft survived both trips.
    await managerPage.getByTestId("chat-fullscreen").click();
    await expect(panelOf(managerPage)).toBeVisible();
    await expect(directRow(managerPage, member)).toHaveAttribute("aria-current", "true");
    await expect(composerOf(managerPage)).toHaveValue("yarım kalan taslak");
    await expect(messagesOf(managerPage).filter({ hasText: "Compact pencerede de görünür" })).toBeVisible();

    // The "×" of the full panel closes the chat completely: no bar, no compact window.
    await managerPage.getByTestId("chat-panel-close").click();
    await expect(panelOf(managerPage)).toHaveCount(0);
    await expect(barOf(managerPage)).toHaveCount(0);
    await expect(compactOf(managerPage)).toHaveCount(0);
  });

  test("another project starts clean and leaving the project closes the chat", async () => {
    // A second project the member does not belong to (also used for the server-side refusal below).
    slug2 = await createProject(managerPage, project2Name);

    await managerPage.goto(`/projects/${slug}/tasks`);
    await openPanel(managerPage);
    await directRow(managerPage, member).click();
    await composerOf(managerPage).fill("bu taslak başka projeye taşınmamalı");
    await managerPage.getByTestId("chat-minimize").click();
    await expect(barOf(managerPage)).toBeVisible();

    // "Değiştir" leaves the project's pages: the chat is closed.
    await managerPage.getByRole("link", { name: "Değiştir", exact: true }).first().click();
    await expect(managerPage).toHaveURL(/\/projects$/);
    await expect(barOf(managerPage)).toHaveCount(0);

    // Opening the other project through the app router (a client-side navigation, like a click on its card; the
    // list is paged, so the card of a project created minutes ago is not always on the first page).
    await managerPage.evaluate((target) => (window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push(target), `/projects/${slug2}`);
    await expect(managerPage).toHaveURL(new RegExp(`/projects/${slug2}$`));
    await openPanel(managerPage);
    await expect(managerPage.getByTestId("chat-active-name")).toHaveText(project2Name);
    await expect(composerOf(managerPage)).toHaveValue("");
    await expect(managerPage.getByText("Selam, mesaj geldi")).toHaveCount(0);
    await expect(directRow(managerPage, member)).toHaveCount(0);
    await expect(managerPage.getByText("Bu projede henüz başka üye yok.")).toBeVisible();
    await managerPage.getByTestId("chat-minimize").click();
    await managerPage.getByTestId("chat-close").click();
  });

  test("a message that looks like HTML is shown as text and nothing runs", async () => {
    const payload = "<img src=x onerror=\"window.__xss = 1\"><script>window.__xss = 1</script><b>kalın</b>";
    await managerPage.goto(`/projects/${slug}`);
    await openPanel(managerPage);
    await directRow(managerPage, member).click();
    await expectSendEnabled(managerPage);
    await send(managerPage, payload);

    const own = messagesOf(managerPage).filter({ hasText: "window.__xss = 1" });
    await expect(own).toBeVisible();
    await expect(own).toContainText("<script>");
    await expect(own).toContainText("<b>kalın</b>");
    await expect(managerPage.getByTestId("chat-messages").locator("img, script, b")).toHaveCount(0);
    expect(await managerPage.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();

    // The receiver renders it as text as well.
    await openPanel(memberPage);
    await directRow(memberPage, manager).click();
    await expect(messagesOf(memberPage).filter({ hasText: "<script>" })).toBeVisible();
    await expect(memberPage.getByTestId("chat-messages").locator("img, script, b")).toHaveCount(0);
    expect(await memberPage.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test("the project group shows the project's logo when it has one and the people icon when it has none", async () => {
    // No logo yet: the group keeps its people icon.
    await managerPage.goto(`/projects/${slug}`);
    await openPanel(managerPage);
    const groupAvatar = managerPage.getByTestId("chat-conversation-group").locator('[data-slot="group-avatar"]');
    await expect(groupAvatar).toBeVisible();
    await expect(groupAvatar.locator("img")).toHaveCount(0);

    // The manager gives the project a logo (a real PNG, through the same endpoint as the settings page).
    const uploaded = await managerPage.evaluate(async ({ id, bytes }) => {
      const base = "http://localhost:8080/api/v1";
      const { headerName } = await (await fetch(`${base}/auth/csrf`, { credentials: "include" })).json();
      const cookie = document.cookie.split("; ").find((row) => row.startsWith("XSRF-TOKEN="));
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "logo.png");
      const res = await fetch(`${base}/projects/${id}/logo`, {
        method: "PUT",
        credentials: "include",
        headers: { [headerName]: decodeURIComponent(cookie?.slice("XSRF-TOKEN=".length) ?? "") },
        body: form,
      });
      return res.status;
    }, { id: projectId, bytes: [...PNG] });
    expect(uploaded).toBe(204);

    // The logo shows in the list and in the header of the group conversation, for the member as well.
    for (const page of [managerPage, memberPage]) {
      await page.goto(`/projects/${slug}`);
      await openPanel(page);
      for (const avatar of [
        page.getByTestId("chat-conversation-group").locator('[data-slot="group-avatar"]'),
        panelOf(page).locator('[data-slot="group-avatar"]').last(),
      ]) {
        const logo = avatar.locator('img[src*="/logo?v="]');
        await expect(logo).toHaveCount(1);
        await expect.poll(() => logo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
      }
      await expect(page.getByTestId("chat-active-name")).toHaveText(projectName);
    }

    // Shrunk to the bottom-right bar, the group still shows the project's logo.
    await managerPage.getByTestId("chat-minimize").click();
    const barLogo = barOf(managerPage).locator('[data-slot="group-avatar"] img[src*="/logo?v="]');
    await expect(barLogo).toHaveCount(1);
    await expect.poll(() => barLogo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await managerPage.getByTestId("chat-close").click();
  });

  test("the profile photo shows where there is one and initials where there is none", async () => {
    await memberPage.goto("/account");
    await memberPage.getByTestId("profile-photo-input").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
    await memberPage.getByRole("button", { name: "Fotoğrafı kaydet" }).click();
    await expect(memberPage.getByText("Profil fotoğrafı güncellendi.")).toBeVisible();

    await managerPage.goto(`/projects/${slug}`);
    await openPanel(managerPage);
    const memberAvatar = directRow(managerPage, member).locator('[data-slot="avatar"]');
    const photo = memberAvatar.locator('img[src*="/profile-photo?v="]');
    await expect(photo).toHaveCount(1);
    await expect.poll(() => photo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    // Shrunk to the bottom-right bar, a direct conversation shows the person's photo as well.
    await directRow(managerPage, member).click();
    await managerPage.getByTestId("chat-minimize").click();
    const barPhoto = barOf(managerPage).locator('[data-slot="avatar"] img[src*="/profile-photo?v="]');
    await expect(barPhoto).toHaveCount(1);
    await expect.poll(() => barPhoto.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await managerPage.getByTestId("chat-close").click();

    // The manager has no photo: the member sees initials for them.
    await memberPage.goto(`/projects/${slug}`);
    await openPanel(memberPage);
    const managerAvatar: Locator = directRow(memberPage, manager).locator('[data-slot="avatar"]');
    await expect(managerAvatar.locator("img")).toHaveCount(0);
    await expect(managerAvatar).toHaveText(manager.nickname.slice(0, 2).toUpperCase());
  });

  test("on a phone the list and the conversation are separate screens", async () => {
    await managerPage.setViewportSize({ width: 390, height: 800 });
    try {
      await managerPage.goto(`/projects/${slug}`);
      await managerPage.getByRole("button", { name: "Gezinme menüsü" }).click();
      // The desktop sidebar is hidden on a phone; the drawer carries the visible copy of the entry.
      await managerPage.locator('[data-testid="chat-nav-item"]:visible').click();
      await expect(panelOf(managerPage)).toBeVisible();
      // The list comes first; no conversation (and so no composer) is on screen yet.
      await expect(managerPage.getByTestId("chat-conversation-group")).toBeVisible();
      await expect(composerOf(managerPage)).toHaveCount(0);

      await directRow(managerPage, member).click();
      await expect(composerOf(managerPage)).toBeVisible();
      await expect(managerPage.getByTestId("chat-conversation-group")).toBeHidden();
      await managerPage.getByRole("button", { name: "Konuşmalara dön" }).click();
      await expect(managerPage.getByTestId("chat-conversation-group")).toBeVisible();
      // No horizontal scroll caused by the panel.
      expect(await managerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally {
      await managerPage.setViewportSize({ width: 1280, height: 720 });
    }
  });

  test("the connection is renewed before the access token runs out: a new socket takes over without a visible gap", async ({ browser }) => {
    test.setTimeout(90_000);
    const credentials: { email: string; password: string } = JSON.parse(readFileSync(MEMBER_USER_FILE, "utf-8"));
    // A login of its own, so renewing (which rotates the refresh token) never touches the shared member session.
    const context = await browser.newContext({ locale: "tr-TR" });
    const page = await context.newPage();
    try {
      // The server announces how long the access token stays valid (15 minutes); to see the renewal without waiting
      // that long, every authenticated answer says "20 seconds" (the client renews 90 s before, but not sooner than 10 s).
      await page.route("**/api/v1/**", async (route) => {
        const response = await route.fetch();
        const headers = response.headers();
        if ("x-access-token-expires-in" in headers) headers["x-access-token-expires-in"] = "20000";
        await route.fulfill({ response, headers });
      });
      const sockets: { closed: boolean }[] = [];
      page.on("websocket", (socket) => {
        const entry = { closed: false };
        sockets.push(entry);
        socket.on("close", () => { entry.closed = true; });
      });
      await login(page, credentials.email, credentials.password);
      // Whatever happens, the composer must never be seen disabled (that is what a dropped connection looks like).
      await page.addInitScript(() => {
        (window as unknown as { __chatBlocked: boolean }).__chatBlocked = false;
        setInterval(() => {
          const composer = document.querySelector<HTMLTextAreaElement>('[data-testid="chat-composer"]');
          if (composer?.disabled) (window as unknown as { __chatBlocked: boolean }).__chatBlocked = true;
        }, 25);
      });
      await page.goto(`/projects/${slug}`);
      await openPanel(page);
      await expectSendEnabled(page);
      expect(sockets).toHaveLength(1);

      // A second socket is opened with the renewed session, becomes the live one, and the first one is closed.
      await expect.poll(() => sockets.length, { timeout: 40_000 }).toBeGreaterThanOrEqual(2);
      await expect.poll(() => sockets[0].closed, { timeout: 15_000 }).toBe(true);
      await expect.poll(() => sockets.filter((entry) => !entry.closed).length).toBe(1);
      expect(await page.evaluate(() => (window as unknown as { __chatBlocked: boolean }).__chatBlocked)).toBe(false);
      await expectSendEnabled(page);

      // The new socket really is the live one: a message from the manager arrives without any reload.
      const overview = (await api(managerPage, "GET", `/projects/${projectId}/chat/conversations`)).json as { group: { id: string } };
      const text = `Yenilenen bağlantıdan geldi ${Date.now()}`;
      const sent = await api(managerPage, "POST", `/projects/${projectId}/chat/conversations/${overview.group.id}/messages`, { content: text });
      expect(sent.status).toBe(201);
      // Exactly once as a message (the list preview shows the text too): the two sockets never double a delivery.
      await expect(messagesOf(page).filter({ hasText: text })).toHaveCount(1);
      await page.waitForTimeout(1_500);
      await expect(messagesOf(page).filter({ hasText: text })).toHaveCount(1);
      expect(await page.evaluate(() => (window as unknown as { __chatBlocked: boolean }).__chatBlocked)).toBe(false);
    } finally {
      await context.close();
    }
  });

  test("a session that ends elsewhere also ends the open chat: the server closes the socket and the user is sent to login", async ({ browser }) => {
    // The server re-checks open sockets every 30 s, then the client's reconnect finds the session gone.
    test.setTimeout(120_000);
    const credentials: { email: string; password: string } = JSON.parse(readFileSync(MEMBER_USER_FILE, "utf-8"));
    // A login of its own (a new session), so the shared member session the other tests use is never touched.
    const context = await browser.newContext({ locale: "tr-TR" });
    const page = await context.newPage();
    try {
      await login(page, credentials.email, credentials.password);
      await page.goto(`/projects/${slug}`);
      await openPanel(page);
      await expectSendEnabled(page);
      // Let the page finish what it does after opening (it marks the conversation read a moment later), so that it
      // sends nothing of its own while its session is ended: only the server can tell it.
      await page.waitForTimeout(2_500);

      // The same session is ended from a second browser context (a copy of the cookies, like a logout in another
      // browser). This page's own cookies are untouched and it makes no request, so only the server can tell it.
      const other = await browser.newContext({ locale: "tr-TR", storageState: await context.storageState() });
      try {
        const otherPage = await other.newPage();
        await otherPage.goto("/projects");
        expect((await api(otherPage, "POST", "/auth/logout")).status).toBeLessThan(300);
      } finally {
        await other.close();
      }

      // Not at once: the socket is still open until the server's next session check (every 30 s) ...
      await page.waitForTimeout(3_000);
      await expect(page).toHaveURL(new RegExp(`/projects/${slug}`));
      // ... then the server closes it, the reconnect finds the session gone and the app leaves for the login page.
      await expect(page).toHaveURL(/\/login/, { timeout: 90_000 });
    } finally {
      await context.close();
    }
  });

  test("someone outside the project is refused by the server, whatever the UI shows", async () => {
    // No account may read or write another project's chat: 403 for the person without any project...
    expect((await api(outsiderPage, "GET", `/projects/${projectId}/chat/conversations`)).status).toBe(403);
    expect((await api(outsiderPage, "GET", `/projects/${projectId}/chat/members`)).status).toBe(403);
    expect((await api(outsiderPage, "POST", `/projects/${projectId}/chat/direct/${manager.id}`)).status).toBe(403);

    // ...and for a member of a different project (the member is not in the second project).
    const project2Id = ((await api(managerPage, "GET", `/projects/by-slug/${slug2}`)).json as { id: string }).id;
    expect((await api(memberPage, "GET", `/projects/${project2Id}/chat/conversations`)).status).toBe(403);

    // A member cannot reach a conversation of one project through another project's path either.
    const groupId = ((await api(managerPage, "GET", `/projects/${projectId}/chat/conversations`)).json as { group: { id: string } }).group.id;
    expect((await api(managerPage, "GET", `/projects/${project2Id}/chat/conversations/${groupId}/messages`)).status).toBe(404);

    // The member list never carries an email address.
    const members = await api(managerPage, "GET", `/projects/${projectId}/chat/members`);
    expect(members.status).toBe(200);
    expect(JSON.stringify(members.json)).not.toContain("@");
  });
});
