import { test, expect, type Page } from "@playwright/test";
import { api, createProject, openProjectListPage } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

/** The smallest valid PNG: the server decides the type from the magic bytes, the picture itself is stretched to fit. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
  "base64",
);
const BANNER_IMG = 'img[src*="/banner?v="]';

/**
 * Project banner (cover image), end to end with the shared manager and member:
 *   - the manager uploads a banner and it shows only on the project's card in the Projeler list, nowhere else;
 *   - wrong type and oversize files are refused with a clear message;
 *   - the pencil on the project card in the list leads to the settings and is only there for a manager;
 *   - the invitation preview has no banner and the old invitation banner address is gone.
 * Registers nobody: both accounts come from global-setup.
 */
test.describe.serial("Project banner", () => {
  let managerPage: Page;
  let memberPage: Page;
  let slug: string;
  let projectId: string;
  let teamId: string;
  const projectName = `E2E Banner Project ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    managerPage = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    memberPage = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
  });

  test.afterAll(async () => {
    await managerPage.close();
    await memberPage.close();
  });

  test("a manager and a member share a project", async () => {
    slug = await createProject(managerPage, projectName);
    projectId = ((await api(managerPage, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    const team = await api(managerPage, "POST", `/projects/${projectId}/teams`, { name: "Core" });
    expect(team.status).toBe(201);
    teamId = (team.json as { id: string }).id;

    await memberPage.goto("/projects");
    const me = (await api(memberPage, "GET", "/auth/me")).json as { id: string };
    const invite = await api(managerPage, "POST", `/projects/${projectId}/invitations`, {
      userId: me.id,
      roles: ["FRONTEND_DEVELOPER"],
      teamId,
    });
    expect(invite.status).toBe(201);
    const { invitationId, token } = invite.json as { invitationId: string; token: string };
    const accepted = await api(memberPage, "POST", `/projects/${projectId}/invitations/${invitationId}/accept`, { token });
    expect(accepted.status).toBe(200);
  });

  test("without a banner the project page shows no empty banner area", async () => {
    await managerPage.goto(`/projects/${slug}`);
    await expect(managerPage.getByRole("heading", { level: 1, name: projectName })).toBeVisible();
    await expect(managerPage.locator(BANNER_IMG)).toHaveCount(0);
    await openProjectListPage(managerPage, slug);
    const card = managerPage.locator("article").filter({ has: managerPage.locator(`a[href="/tr/projeler/${slug}"]`) });
    await expect(card).toBeVisible();
    // No strip is opened on the card either: the card is just the card.
    await expect(card.locator("img")).toHaveCount(0);
  });

  test("the pencil on the project card opens the settings, for a manager only", async () => {
    // Not on the project page itself: its header has the banner and nothing to edit.
    await managerPage.goto(`/projects/${slug}`);
    await expect(managerPage.getByRole("heading", { level: 1, name: projectName })).toBeVisible();
    await expect(managerPage.getByRole("link", { name: /ayarlarını düzenle/ })).toHaveCount(0);

    await openProjectListPage(managerPage, slug);
    const card = managerPage.locator("article").filter({ has: managerPage.locator(`a[href="/tr/projeler/${slug}"]`) });
    await card.getByRole("link", { name: `${projectName} ayarlarını düzenle` }).click();
    await expect(managerPage).toHaveURL(/section=settings/);
    await expect(managerPage.getByRole("heading", { level: 1, name: "Proje ayarları" })).toBeVisible();

    await openProjectListPage(memberPage, slug);
    const memberCard = memberPage.locator("article").filter({ has: memberPage.locator(`a[href="/tr/projeler/${slug}"]`) });
    await expect(memberCard).toBeVisible();
    await expect(memberCard.getByRole("link", { name: /ayarlarını düzenle/ })).toHaveCount(0);
  });

  test("a wrong type or an oversize file is refused before anything is uploaded", async () => {
    await managerPage.goto(`/projects/${slug}?section=settings`);
    const input = managerPage.getByLabel("Kapak görseli", { exact: true });

    await input.setInputFiles({ name: "kapak.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
    await expect(managerPage.getByRole("alert").filter({ hasText: "PNG, JPEG veya WebP olmalıdır" })).toBeVisible();

    await input.setInputFiles({ name: "kapak.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
    await expect(managerPage.getByRole("alert").filter({ hasText: "en fazla 2 MB" })).toBeVisible();
    await expect(managerPage.locator(BANNER_IMG)).toHaveCount(0);
  });

  test("the manager uploads a banner; it shows on the project card only", async () => {
    await managerPage.goto(`/projects/${slug}?section=settings`);
    await managerPage.getByLabel("Kapak görseli", { exact: true }).setInputFiles({ name: "kapak.png", mimeType: "image/png", buffer: PNG });
    await expect(managerPage.getByText("Kapak görseli güncellendi.")).toBeVisible();
    // The settings only state it: no picture there, and none in the project page header.
    await expect(managerPage.getByText("Bu proje için bir kapak görseli yüklü.")).toBeVisible();
    await expect(managerPage.locator(BANNER_IMG)).toHaveCount(0);
    await managerPage.goto(`/projects/${slug}`);
    await expect(managerPage.getByRole("heading", { level: 1, name: projectName })).toBeVisible();
    await expect(managerPage.locator(BANNER_IMG)).toHaveCount(0);

    await openProjectListPage(managerPage, slug);
    const card = managerPage.locator("article").filter({ has: managerPage.locator(`a[href="/tr/projeler/${slug}"]`) });
    await expect(card.locator(BANNER_IMG)).toBeVisible();
  });

  test("an invited person sees no banner in the invitation preview, and the old banner address is gone", async () => {
    const other = `E2E Banner Invite ${Date.now()}`;
    const otherSlug = await createProject(managerPage, other);
    const otherId = ((await api(managerPage, "GET", `/projects/by-slug/${otherSlug}`)).json as { id: string }).id;
    const otherTeam = (await api(managerPage, "POST", `/projects/${otherId}/teams`, { name: "Core" })).json as { id: string };

    await memberPage.goto("/projects");
    const me = (await api(memberPage, "GET", "/auth/me")).json as { id: string };
    const invite = await api(managerPage, "POST", `/projects/${otherId}/invitations`, {
      userId: me.id,
      roles: ["FRONTEND_DEVELOPER"],
      teamId: otherTeam.id,
    });
    expect(invite.status).toBe(201);
    const { invitationId } = invite.json as { invitationId: string };

    await memberPage.goto("/invitations");
    const row = memberPage.getByRole("row").filter({ hasText: other });
    await row.getByRole("button", { name: new RegExp(`${other} proje bilgilerini`) }).click();
    const dialog = memberPage.getByRole("dialog");
    await expect(dialog).toContainText(other);
    await expect(dialog.locator("img")).toHaveCount(0);
    expect((await api(memberPage, "GET", `/project-invitations/${invitationId}/banner`)).status).toBe(403);
  });

  test("the manager removes the banner after confirming, and the card loses it", async () => {
    await managerPage.goto(`/projects/${slug}?section=settings`);
    await managerPage.getByRole("button", { name: /^Kaldır$/ }).click();
    await managerPage.getByRole("dialog").getByRole("button", { name: /^Kaldır$/ }).click();
    await expect(managerPage.getByText("Kapak görseli kaldırıldı.")).toBeVisible();
    await expect(managerPage.getByText("Henüz kapak görseli yok.")).toBeVisible();

    await openProjectListPage(managerPage, slug);
    const card = managerPage.locator("article").filter({ has: managerPage.locator(`a[href="/tr/projeler/${slug}"]`) });
    await expect(card).toBeVisible();
    await expect(card.locator(BANNER_IMG)).toHaveCount(0);
  });
});
