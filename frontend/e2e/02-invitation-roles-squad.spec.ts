import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { login, createProject, createTeam, openProjectListPage } from "./helpers";
import { MANAGER_STORAGE, MEMBER_USER_FILE } from "./global-setup";

/**
 * HMZ-PROJ-52 flows covered here (two users: PROJECT_MANAGER + a contributor):
 *   3. Search User -> Invite -> Accept -> Membership
 *   4. PROJECT_MANAGER -> Assign Role -> Member sees project
 *   5. PROJECT_MANAGER -> Create Team -> Add Member (people only ever join through a team)
 *   6. Non-manager -> Project Settings change denied
 *   7. Contributor -> Membership mutation denied
 */
test.describe.serial("Invitation, roles, squad, and denial checks", () => {
  let managerPage: Page;
  let memberPage: Page;
  let slug: string;
  let projectId: string;
  let teamId: string;
  let invitationId: string;
  let token: string;
  let member: { email: string; nickname: string; password: string };
  let memberUserId: string;
  const projectName = `E2E Invite Project ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const managerContext = await browser.newContext({ storageState: MANAGER_STORAGE });
    const memberContext = await browser.newContext();
    managerPage = await managerContext.newPage();
    memberPage = await memberContext.newPage();
  });

  test.afterAll(async () => {
    await managerPage.close();
    await memberPage.close();
  });

  test("manager (already authenticated) creates a project; the shared contributor account is loaded", async () => {
    slug = await createProject(managerPage, projectName);
    // Invitations always target a team, so the first team is created before anyone is invited.
    teamId = await createTeam(managerPage, slug, "Backend");

    // The contributor is the shared account from global-setup, so this spec adds no /auth/register call
    // (AuthRateLimitFilter allows only 5 per 10 minutes per path and IP).
    member = JSON.parse(readFileSync(MEMBER_USER_FILE, "utf-8"));
  });

  test("manager searches, invites the contributor, and captures the invitation token", async () => {
    await managerPage.goto(`/projects/${slug}/teams/${teamId}`);
    await managerPage.getByRole("button", { name: /^Üye ekle$/ }).first().click();
    await managerPage.getByLabel("Kişi ara").fill(member.nickname);
    await managerPage.getByRole("button", { name: new RegExp(`${member.nickname} kişisini ekibe davet et`) }).click();

    // FRONTEND_DEVELOPER: a non-manager contributor role, second checkbox in PROJECT_ROLES order.
    await managerPage.getByRole("dialog").getByRole("checkbox").nth(2).check();

    const [response] = await Promise.all([
      managerPage.waitForResponse(
        (res) => res.url().includes("/invitations") && res.request().method() === "POST",
      ),
      managerPage.getByRole("dialog").getByRole("button", { name: /^Davet gönder$/ }).click(),
    ]);

    const match = response.url().match(/\/projects\/([^/]+)\/invitations$/);
    expect(match).not.toBeNull();
    projectId = match![1];

    const body = await response.json();
    invitationId = body.invitationId;
    token = body.token;
    expect(invitationId).toBeTruthy();
    expect(token).toBeTruthy();

    await expect(managerPage.getByText("Davet gönderildi.")).toBeVisible();
  });

  test("contributor logs in, accepts the invitation, and becomes a member", async () => {
    await login(memberPage, member.email, member.password);

    memberUserId = await memberPage.evaluate(async () => {
      const res = await fetch("http://localhost:8080/api/v1/auth/me", { credentials: "include" });
      const data = await res.json();
      return data.id;
    });
    expect(memberUserId).toBeTruthy();

    await memberPage.goto(`/invitations/${projectId}/${invitationId}?token=${token}`);
    await memberPage.getByRole("button", { name: /^Kabul et$/ }).click();
    await expect(memberPage.getByText("Projeye katıldınız.")).toBeVisible();

    // Accepting puts the person into the project and the invited team in one step.
    await managerPage.goto(`/projects/${slug}/teams/${teamId}`);
    await expect(managerPage.getByRole("row", { name: new RegExp(member.nickname) })).toBeVisible();
  });

  test("manager assigns an additional role; member sees the project in their own list", async () => {
    await managerPage.getByRole("button", { name: /^Ekibi düzenle$/ }).click();
    const row = managerPage.getByRole("row", { name: new RegExp(member.nickname) });
    await row.getByRole("button", { name: /kişisinin rollerini düzenle/ }).click();
    // TESTER is index 6 in PROJECT_ROLES.
    await managerPage.getByRole("dialog").getByRole("checkbox").nth(6).check();
    await managerPage.getByRole("dialog").getByRole("button", { name: /^Kaydet$/ }).click();
    await expect(managerPage.getByText("Roller güncellendi.")).toBeVisible();

    await openProjectListPage(memberPage, slug);
    await expect(memberPage.getByRole("article").filter({ has: memberPage.locator(`a[href="/tr/projeler/${slug}"]`) })).toBeVisible();
  });

  test("non-manager cannot change project settings (UI hidden and API denies)", async () => {
    // The list tells a member nothing to edit: no pencil on the project's card.
    await openProjectListPage(memberPage, slug);
    const card = memberPage.getByRole("article").filter({ has: memberPage.locator(`a[href="/tr/projeler/${slug}"]`) });
    await expect(card).toBeVisible();
    await expect(card.getByRole("link", { name: /ayarlarını düzenle/ })).toHaveCount(0);

    const status = await memberPage.evaluate(async (id) => {
      const csrfRes = await fetch("http://localhost:8080/api/v1/auth/csrf", { credentials: "include" });
      const { headerName } = await csrfRes.json();
      const cookie = document.cookie.split("; ").find((r) => r.startsWith("XSRF-TOKEN="));
      const csrfToken = decodeURIComponent(cookie?.slice("XSRF-TOKEN=".length) ?? "");
      const res = await fetch(`http://localhost:8080/api/v1/projects/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", [headerName]: csrfToken },
        body: JSON.stringify({ name: "Hacked name", status: "ACTIVE", priority: "MEDIUM" }),
      });
      return res.status;
    }, projectId);

    expect(status).toBe(403);
  });

  test("contributor cannot mutate membership (UI hidden and API denies)", async () => {
    await memberPage.goto(`/projects/${slug}/teams/${teamId}`);
    await expect(memberPage.getByRole("row", { name: new RegExp(member.nickname) })).toBeVisible();
    await expect(memberPage.getByRole("button", { name: /^Ekibi düzenle$/ })).toHaveCount(0);
    await expect(memberPage.getByRole("button", { name: /kişisinin rollerini düzenle/ })).toHaveCount(0);
    await expect(memberPage.getByRole("button", { name: /kişisini ekipten çıkar/ })).toHaveCount(0);

    const status = await memberPage.evaluate(
      async ({ id, userId }) => {
        const csrfRes = await fetch("http://localhost:8080/api/v1/auth/csrf", { credentials: "include" });
        const { headerName } = await csrfRes.json();
        const cookie = document.cookie.split("; ").find((r) => r.startsWith("XSRF-TOKEN="));
        const csrfToken = decodeURIComponent(cookie?.slice("XSRF-TOKEN=".length) ?? "");
        const res = await fetch(`http://localhost:8080/api/v1/projects/${id}/members/${userId}/roles`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json", [headerName]: csrfToken },
          body: JSON.stringify({ roles: ["PROJECT_MANAGER"] }),
        });
        return res.status;
      },
      { id: projectId, userId: memberUserId },
    );

    expect(status).toBe(403);
  });

  test("manager creates a second team and moves the contributor in and out of it", async () => {
    // The contributor is already in Backend, so leaving the new team is allowed (a last team could not be left).
    await createTeam(managerPage, slug, "E2E Squad");
    await managerPage.getByRole("button", { name: /^Üye ekle$/ }).first().click();
    await managerPage.getByLabel("Kişi ara").fill(member.nickname);
    await managerPage.getByRole("button", { name: new RegExp(`${member.nickname} kişisini ekibe ekle`) }).click();
    await expect(managerPage.getByRole("row", { name: new RegExp(member.nickname) })).toBeVisible();

    await managerPage.getByRole("button", { name: /^Ekibi düzenle$/ }).click();
    await managerPage.getByRole("button", { name: new RegExp(`${member.nickname} kişisini ekipten çıkar`) }).click();
    await managerPage.getByRole("dialog").getByRole("button", { name: "Ekipten çıkar" }).click();
    await expect(managerPage.getByRole("row", { name: new RegExp(member.nickname) })).toHaveCount(0);

    await managerPage.getByRole("navigation", { name: "Konum" }).getByRole("link", { name: "Ekipler" }).click();
    await expect(managerPage).toHaveURL(`/tr/projeler/${slug}/ekipler`);
  });
});
