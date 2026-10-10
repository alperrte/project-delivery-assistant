import { expect, test, type Browser, type Page } from "@playwright/test";
import tr from "../src/i18n/messages/tr.json";
import { api, registerAndLogin } from "./helpers";

// Real backend, real users, no mocks: the inviting manager's "+N" (unread accepted/rejected answers of the selected
// project) is a separate number from the pending count, follows the notification read state, belongs to the inviter
// only, and never leaks into the next account that signs in on the same tab.

const RESPONSES = "type=PROJECT_INVITATION_ACCEPTED&type=PROJECT_INVITATION_REJECTED";
const responseLabel = (count: number) => tr.invitations.responseCount.replace("{count}", String(count));
const pendingLabel = (count: number) => tr.invitations.pendingCount.replace("{count}", String(count));

type Account = { page: Page; id: string; email: string; password: string; nickname: string };
type Project = { id: string; slug: string; teamId: string };

/** The app listens to online/offline for reconnect refetches; this is the same nudge the other badge specs use. */
const refresh = async (page: Page) => {
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
};
const responseBadge = (scope: ReturnType<Page["locator"]>) => scope.locator("[data-invitation-response-count]");
const pendingBadge = (scope: ReturnType<Page["locator"]>) => scope.locator("[data-pending-invitation-count]");
const unread = async (page: Page, query = "") =>
  ((await api(page, "GET", `/notifications/unread-count${query}`)).json as { count: number }).count;

async function account(browser: Browser, prefix: string): Promise<Account> {
  const page = await (await browser.newContext()).newPage();
  const user = await registerAndLogin(page, prefix);
  const me = (await api(page, "GET", "/auth/me")).json as { id: string };
  return { page, id: me.id, ...user };
}
async function project(page: Page, name: string): Promise<Project> {
  const made = await api(page, "POST", "/projects", { name, projectType: "WEB" });
  expect(made.status).toBe(201);
  const { id, slug } = made.json as { id: string; slug: string };
  const team = await api(page, "POST", `/projects/${id}/teams`, { name: "Yanıt ekibi", includeCreator: true });
  expect(team.status).toBe(201);
  return { id, slug, teamId: (team.json as { id: string }).id };
}
async function invite(manager: Page, target: Project, userId: string, roles: string[]) {
  const made = await api(manager, "POST", `/projects/${target.id}/invitations`, { userId, teamId: target.teamId, roles });
  expect(made.status).toBe(201);
  return (made.json as { invitationId: string }).invitationId;
}

test("inviter's +N follows unread answers per project, read state and account; pending count stays separate", async ({ browser }) => {
  test.setTimeout(240_000);
  const manager = await account(browser, "rmgr"), x = await account(browser, "rx"), y = await account(browser, "ry"),
    z = await account(browser, "rz"), w = await account(browser, "rw");
  const a = manager.page;
  try {
    const projectA = await project(a, `Yanıt rozeti A ${Date.now()}`), projectB = await project(a, `Yanıt rozeti B ${Date.now()}`);
    // X joins as a co-manager (not the inviter), Y declines, Z answers in the other project, W answers late.
    const inviteX = await invite(a, projectA, x.id, ["PROJECT_MANAGER"]);
    const inviteY = await invite(a, projectA, y.id, ["TESTER"]);
    const inviteZ = await invite(a, projectB, z.id, ["TESTER"]);
    const inviteW = await invite(a, projectA, w.id, ["TESTER"]);

    // After the account switch is armed, any "+N" that ever renders is recorded (sessionStorage survives navigations).
    await a.addInitScript(() => {
      const mark = () => {
        if (sessionStorage.getItem("pda-test-armed") && document.querySelector("[data-invitation-response-count]"))
          sessionStorage.setItem("pda-test-response-badge-seen", "1");
      };
      new MutationObserver(mark).observe(document, { childList: true, subtree: true, attributes: true });
    });
    await a.goto(`/tr/projeler/${projectA.slug}?section=invitations`);
    const sidebar = a.locator("aside"), parent = sidebar.getByRole("button", { name: "Ekipler", exact: true });
    const child = sidebar.getByRole("link", { name: "Ekip Davetleri", exact: true });
    await expect(child).toBeVisible();
    await expect(pendingBadge(child)).toHaveAttribute("data-pending-invitation-count", "3");
    await expect(responseBadge(child)).toHaveCount(0);
    await expect(a.locator("[data-invitation-response-strip]")).toHaveCount(0);

    // X accepts: "+1" for project A while the pending badge keeps counting the open ones (Y, W).
    expect((await api(x.page, "POST", `/project-invitations/${inviteX}/accept`)).status).toBe(200);
    await expect.poll(async () => { await refresh(a); return responseBadge(child).getAttribute("data-invitation-response-count"); }).toBe("1");
    await expect(pendingBadge(child)).toHaveAttribute("data-pending-invitation-count", "2");
    // Two different numbers with two different accessible names: never pending + 1.
    await expect(responseBadge(child)).toHaveAttribute("aria-label", responseLabel(1));
    await expect(pendingBadge(child)).toHaveAttribute("aria-label", pendingLabel(2));
    await expect(responseBadge(child)).toHaveText("+1");
    await expect(pendingBadge(child)).toHaveText("2");
    await expect(responseBadge(parent)).toHaveAttribute("data-invitation-response-count", "1");
    await expect(pendingBadge(parent)).toHaveAttribute("data-pending-invitation-count", "2");

    // Y declines: "+2".
    expect((await api(y.page, "POST", `/project-invitations/${inviteY}/reject`, { message: "Uygun değilim" })).status).toBe(204);
    await expect.poll(async () => { await refresh(a); return responseBadge(child).getAttribute("data-invitation-response-count"); }).toBe("2");
    await expect(pendingBadge(child)).toHaveAttribute("data-pending-invitation-count", "1");
    await expect(responseBadge(child)).toHaveAttribute("aria-label", responseLabel(2));

    // Project B has its own value (nothing answered yet), never project A's.
    await sidebar.getByRole("link", { name: tr.projects.detail.changeProject, exact: true }).click();
    await a.getByRole("link", { name: new RegExp(`Yanıt rozeti B`) }).first().click();
    await expect(a).toHaveURL(new RegExp(`/${projectB.slug}`));
    await parent.click();
    await expect(sidebar.getByRole("link", { name: "Ekip Davetleri", exact: true })).toBeVisible();
    await expect(pendingBadge(parent)).toHaveAttribute("data-pending-invitation-count", "1");
    await expect(responseBadge(parent)).toHaveCount(0);
    expect((await api(z.page, "POST", `/project-invitations/${inviteZ}/accept`)).status).toBe(200);
    await expect.poll(async () => { await refresh(a); return responseBadge(parent).getAttribute("data-invitation-response-count"); }).toBe("1");
    expect(await unread(a, `?projectId=${projectB.id}&${RESPONSES}`)).toBe(1);
    expect(await unread(a, `?projectId=${projectA.id}&${RESPONSES}`)).toBe(2);

    // Back to project A through the client router (no hard reload), then to its invitations page.
    await sidebar.getByRole("link", { name: tr.projects.detail.changeProject, exact: true }).click();
    await a.getByRole("link", { name: new RegExp(`Yanıt rozeti A`) }).first().click();
    await expect(a).toHaveURL(new RegExp(`/${projectA.slug}`));
    await expect(responseBadge(parent)).toHaveAttribute("data-invitation-response-count", "2");
    await expect(pendingBadge(parent)).toHaveAttribute("data-pending-invitation-count", "1");
    if ((await parent.getAttribute("aria-expanded")) !== "true") await parent.click();
    await sidebar.getByRole("link", { name: "Ekip Davetleri", exact: true }).click();
    await expect(a).toHaveURL(/ekip-davetleri$/);

    const strip = a.locator("[data-invitation-response-strip]");
    await expect(strip).toBeVisible();
    await expect(strip.getByRole("heading", { name: responseLabel(2) })).toBeVisible();
    await expect(strip.locator("li")).toHaveCount(2);
    await expect(strip.locator("li", { hasText: x.nickname })).toContainText(tr.invitations.responses.accepted.replace("{name}", x.nickname));
    await expect(strip.locator("li", { hasText: y.nickname })).toContainText(tr.invitations.responses.rejected.replace("{name}", y.nickname));
    await expect(strip.locator("li").first()).toContainText("Yanıt rozeti A");
    // Opening the page does not read anything.
    await refresh(a);
    await expect(responseBadge(child)).toHaveAttribute("data-invitation-response-count", "2");
    expect(await unread(a, `?projectId=${projectA.id}&${RESPONSES}`)).toBe(2);

    // Marking one read: badge +1, the bell drops by one, the strip keeps the other.
    const bell = a.getByRole("button", { name: "Bildirimler", exact: true });
    const bellBadge = bell.locator("[aria-label$='okunmamış bildirim']");
    const total = await unread(a);
    expect(total).toBeGreaterThanOrEqual(3);
    // The bell count has its own 30 s foreground poll; the first read of a fresh answer waits at most one cycle.
    await expect.poll(async () => { await refresh(a); return bellBadge.textContent(); }, { timeout: 45_000 }).toBe(String(total));
    await strip.locator("li", { hasText: x.nickname }).getByRole("button").click();
    await expect(responseBadge(child)).toHaveAttribute("data-invitation-response-count", "1");
    await expect(responseBadge(child)).toHaveText("+1");
    await expect(strip.locator("li")).toHaveCount(1);
    await expect(strip.locator("li", { hasText: y.nickname })).toBeVisible();
    await expect(bellBadge).toHaveText(String(total - 1));
    expect(await unread(a, `?projectId=${projectB.id}&${RESPONSES}`)).toBe(1);

    // Mark all (only this project's listed answers, never read-all): badge gone, strip gone, project B untouched.
    await strip.getByRole("button", { name: tr.invitations.responses.markAllRead, exact: true }).click();
    await expect(strip).toHaveCount(0);
    await expect(responseBadge(sidebar)).toHaveCount(0);
    expect(await unread(a, `?projectId=${projectA.id}&${RESPONSES}`)).toBe(0);
    expect(await unread(a, `?projectId=${projectB.id}&${RESPONSES}`)).toBe(1);
    await expect(bellBadge).toHaveText(String(total - 2));

    // The co-manager who did not send the invitation sees no "+N" and no strip (documented recipient rule).
    await x.page.goto(`/tr/projeler/${projectA.slug}?section=invitations`);
    await expect(x.page.locator("aside").getByRole("link", { name: "Ekip Davetleri", exact: true })).toBeVisible();
    expect(await unread(x.page, `?projectId=${projectA.id}&${RESPONSES}`)).toBe(0);
    await expect(responseBadge(x.page.locator("aside"))).toHaveCount(0);
    await expect(x.page.locator("[data-invitation-response-strip]")).toHaveCount(0);

    // A late answer reaches the open page on the next refresh, without a reload.
    expect((await api(w.page, "POST", `/project-invitations/${inviteW}/accept`)).status).toBe(200);
    await expect.poll(async () => { await refresh(a); return responseBadge(child).getAttribute("data-invitation-response-count"); }).toBe("1");
    await expect(strip).toBeVisible();
    await expect(strip.locator("li")).toHaveCount(1);

    // Account switch on the same tab: the previous manager's badge never shows for the next account.
    await a.mouse.move(20, 2);
    await a.getByRole("button", { name: /Hesap menüsü/ }).click();
    await a.getByRole("menuitem", { name: "Çıkış yap", exact: true }).click();
    await expect(a.locator('input[name="email"]')).toBeVisible();
    await a.evaluate(() => { sessionStorage.removeItem("pda-test-response-badge-seen"); sessionStorage.setItem("pda-test-armed", "1"); });
    await expect(responseBadge(a.locator("body"))).toHaveCount(0);
    const counted = a.waitForResponse(r => r.url().includes("/notifications/unread-count") && r.url().includes(`projectId=${projectA.id}`));
    await a.locator('input[name="email"]').fill(x.email);
    await a.locator('input[name="password"]').fill(x.password);
    await a.getByRole("button", { name: /^Giriş yap$/ }).click();
    await expect(a.locator("#main-content")).toBeVisible();
    const nextSidebar = a.locator("aside");
    await expect(nextSidebar.getByRole("button", { name: "Ekipler", exact: true })).toBeVisible();
    expect((await counted).status()).toBe(200);
    await expect(responseBadge(nextSidebar)).toHaveCount(0);
    await expect.poll(() => a.evaluate(() => sessionStorage.getItem("pda-test-response-badge-seen"))).toBeNull();
  } finally {
    for (const user of [manager, x, y, z, w]) await user.page.context().close();
  }
});
