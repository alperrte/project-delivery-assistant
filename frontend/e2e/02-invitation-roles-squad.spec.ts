import { test, expect, type Page } from "@playwright/test";
import { registerUser, login, createProject, uniqueUser } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";

/**
 * HMZ-PROJ-52 flows covered here (two users: PROJECT_MANAGER + a contributor):
 *   3. Search User -> Invite -> Accept -> Membership
 *   4. PROJECT_MANAGER -> Assign Role -> Member sees project
 *   5. PROJECT_MANAGER -> Create Squad -> Add Member
 *   6. Non-manager -> Project Settings change denied
 *   7. Contributor -> Membership mutation denied
 */
test.describe.serial("Invitation, roles, squad, and denial checks", () => {
  let managerPage: Page;
  let memberPage: Page;
  let slug: string;
  let projectId: string;
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

  test("manager (already authenticated) creates a project; contributor account is registered", async () => {
    slug = await createProject(managerPage, projectName);

    member = uniqueUser("member");
    await registerUser(memberPage, member);
  });

  test("manager searches, invites the contributor, and captures the invitation token", async () => {
    await managerPage.getByRole("tab", { name: "Davetler" }).click();
    await managerPage.getByRole("button", { name: /^Üye davet et$/ }).click();
    await managerPage.getByPlaceholder("Kullanıcı adı veya e-posta ile ara").fill(member.nickname);
    await managerPage.getByRole("button", { name: new RegExp(member.nickname) }).click();

    // FRONTEND_DEVELOPER: a non-manager contributor role, second checkbox in PROJECT_ROLES order.
    await managerPage.getByRole("dialog").getByRole("checkbox").nth(2).check();

    const [response] = await Promise.all([
      managerPage.waitForResponse(
        (res) => res.url().includes("/invitations") && res.request().method() === "POST",
      ),
      managerPage.getByRole("button", { name: /^Davet gönder$/ }).click(),
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

    await managerPage.goto(`/projects/${slug}`);
    await managerPage.getByRole("tab", { name: "Üyeler" }).click();
    await expect(managerPage.getByRole("row", { name: new RegExp(member.nickname) })).toBeVisible();
  });

  test("manager assigns an additional role; member sees the project in their own list", async () => {
    const row = managerPage.getByRole("row", { name: new RegExp(member.nickname) });
    await row.getByRole("button", { name: "Rolleri düzenle" }).click();
    // TESTER is index 6 in PROJECT_ROLES.
    await managerPage.getByRole("dialog").getByRole("checkbox").nth(6).check();
    await managerPage.getByRole("dialog").getByRole("button", { name: /^Kaydet$/ }).click();
    await expect(managerPage.getByText("Roller güncellendi.")).toBeVisible();

    await memberPage.goto("/projects");
    await expect(memberPage.getByRole("link", { name: projectName })).toBeVisible();
  });

  test("non-manager cannot change project settings (UI hidden and API denies)", async () => {
    await memberPage.goto(`/projects/${slug}`);
    await expect(memberPage.getByRole("tab", { name: "Ayarlar" })).toHaveCount(0);

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
    await expect(memberPage.getByRole("button", { name: "Rolleri düzenle" })).toHaveCount(0);
    await expect(memberPage.getByRole("button", { name: "Çıkar" })).toHaveCount(0);

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

  test("manager creates a squad and adds the contributor to it", async () => {
    await managerPage.getByRole("tab", { name: "Ekipler" }).click();
    await managerPage.getByRole("button", { name: /^Yeni ekip$/ }).click();
    await managerPage.locator("#squad-name").fill("E2E Squad");
    await managerPage.getByRole("dialog").getByRole("button", { name: /^Oluştur$/ }).click();
    await expect(managerPage.getByText("Ekip oluşturuldu.")).toBeVisible();

    await managerPage.getByRole("button", { name: /E2E Squad üyeleri/ }).click();
    await managerPage.getByPlaceholder("Proje üyelerinde ara").fill(member.nickname);
    await managerPage.getByRole("button", { name: new RegExp(member.nickname) }).click();
    await expect(managerPage.getByRole("dialog").getByText(member.nickname)).toBeVisible();
  });
});
