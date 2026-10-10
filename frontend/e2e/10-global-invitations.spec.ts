import { test, expect, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

/**
 * The global "Davetler" page against the real backend (the mocked spec covers rendering and error states):
 *   - an invitation sent while the recipient already has the app open shows up without a reload;
 *   - the default "Bekleyen" tab lists what can still be answered, "Tümü" keeps the history;
 *   - accepting from the list moves the invitation out of "Bekleyen" and into the history.
 * Both accounts are the shared ones from global-setup, so this spec registers nobody.
 */
test.describe.serial("Global invitations", () => {
  let managerPage: Page;
  let memberPage: Page;
  let projectName: string;
  let projectId: string;
  let teamId: string;

  test.beforeAll(async ({ browser }) => {
    managerPage = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    memberPage = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
  });

  test.afterAll(async () => {
    await managerPage.close();
    await memberPage.close();
  });

  test("the recipient has the list open before the manager invites them", async () => {
    projectName = `E2E Invitations Project ${Date.now()}`;
    const slug = await createProject(managerPage, projectName);
    projectId = ((await api(managerPage, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    const team = await api(managerPage, "POST", `/projects/${projectId}/teams`, { name: "Core" });
    expect(team.status).toBe(201);
    teamId = (team.json as { id: string }).id;

    // Reading the list now caches it, which is what used to hide the invitation that arrives next.
    await memberPage.goto("/invitations");
    await expect(memberPage.getByRole("tab", { name: "Bekleyen" })).toHaveAttribute("aria-selected", "true");
    await expect(memberPage.getByRole("heading", { level: 1, name: "Proje davetlerim" })).toBeVisible();
  });

  test("an invitation sent meanwhile shows up when the recipient comes back to the page", async () => {
    const me = (await api(memberPage, "GET", "/auth/me")).json as { id: string };
    const invite = await api(managerPage, "POST", `/projects/${projectId}/invitations`, {
      userId: me.id,
      roles: ["FRONTEND_DEVELOPER"],
      teamId,
      message: "Katılmanı bekliyoruz",
    });
    expect(invite.status).toBe(201);

    // A client-side round trip, no reload: the list must be read again instead of served from the cache.
    await memberPage.getByRole("link", { name: "Projeler", exact: true }).click();
    await expect(memberPage).toHaveURL(/\/tr\/projeler$/);
    await memberPage.getByRole("link", { name: "Davetler", exact: true }).click();
    await expect(memberPage).toHaveURL(/\/tr\/davetler$/);

    const row = memberPage.getByRole("row").filter({ hasText: projectName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Bekliyor");
    // The team is a secondary line under the project; the full sentence lives in its title.
    await expect(row.getByTitle("Core ekibine katılım daveti")).toHaveCount(1);
    await expect(row).toContainText("Katılmanı bekliyoruz");
  });

  test("accepting from the list moves the invitation from Bekleyen into the history", async () => {
    const row = memberPage.getByRole("row").filter({ hasText: projectName });
    await row.getByRole("button", { name: "Kabul et" }).click();
    await expect(memberPage.getByText("Davet kabul edildi.")).toBeVisible();

    // Pending tab: it is answered, so it is gone.
    await expect(memberPage.getByRole("row").filter({ hasText: projectName })).toHaveCount(0);

    await memberPage.getByRole("tab", { name: "Tümü" }).click();
    const history = memberPage.getByRole("row").filter({ hasText: projectName });
    await expect(history).toBeVisible();
    await expect(history).toContainText("Kabul edildi");
    await expect(history.getByRole("button", { name: /Kabul et|Reddet/ })).toHaveCount(0);
  });
});
