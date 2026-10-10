import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { api, createProject } from "./helpers";
import { createIsolatedInvitationRecipient } from "./invitation-fixture";
import { MANAGER_STORAGE } from "./global-setup";

/** The smallest valid PNG: the server decides the type from the magic bytes, the picture itself is stretched to fit. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
  "base64",
);
/** The quiet dotted surface `EntityCover` draws when there is no picture (or it failed to load). */
const FALLBACK_SURFACE = '[class*="radial-gradient"]';

/**
 * The invitation preview shows the real project banner through the invitation-scoped route:
 *   - a banner uploaded by the manager shows in the recipient's preview and actually loads;
 *   - a project without banner shows no picture and keeps the card's plain band;
 *   - a banner that fails to load falls back to the quiet dotted surface and the dialog stays usable.
 * Uses the isolated recipient, never the shared member.
 */
test.describe.serial("Invitation preview banner", () => {
  test.setTimeout(120_000);
  let managerContext: BrowserContext;
  let recipientContext: BrowserContext;
  let manager: Page;
  let recipient: Page;
  const stamp = Date.now();
  const withBanner = `E2E Preview Banner ${stamp}`;
  const withoutBanner = `E2E Preview Plain ${stamp}`;
  const invitationIds: Record<"banner" | "plain", string> = { banner: "", plain: "" };
  const projectIds: string[] = [];

  test.beforeAll(async ({ browser }) => {
    managerContext = await browser.newContext({ storageState: MANAGER_STORAGE });
    manager = await managerContext.newPage();
    recipientContext = await browser.newContext();
    recipient = await recipientContext.newPage();
    await manager.goto("/projects");
    await createIsolatedInvitationRecipient(manager, recipient);
  });

  test.afterAll(async () => {
    for (const invitationId of Object.values(invitationIds)) {
      if (invitationId) await api(recipient, "POST", `/project-invitations/${invitationId}/reject`, { message: "" }).catch(() => undefined);
    }
    for (const projectId of projectIds) await api(manager, "POST", `/projects/${projectId}/archive`).catch(() => undefined);
    await managerContext.close();
    await recipientContext.close();
  });

  async function inviteRecipient(name: string, slug: string): Promise<string> {
    const projectId = ((await api(manager, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    projectIds.push(projectId);
    const team = (await api(manager, "POST", `/projects/${projectId}/teams`, { name: "Core" })).json as { id: string };
    const me = (await api(recipient, "GET", "/auth/me")).json as { id: string };
    const invite = await api(manager, "POST", `/projects/${projectId}/invitations`, {
      userId: me.id, roles: ["FRONTEND_DEVELOPER"], teamId: team.id,
    });
    expect(invite.status, `invite to ${name}`).toBe(201);
    return (invite.json as { invitationId: string }).invitationId;
  }

  async function openPreview(name: string) {
    await recipient.goto("/invitations");
    const row = recipient.getByRole("row").filter({ hasText: name });
    await row.getByRole("button", { name: new RegExp(`${name} proje bilgilerini`) }).click();
    const dialog = recipient.getByRole("dialog");
    await expect(dialog).toContainText(name);
    return dialog;
  }

  test("the manager prepares one project with a banner and one without, and invites the recipient to both", async () => {
    const bannerSlug = await createProject(manager, withBanner);
    await manager.goto(`/projects/${bannerSlug}?section=settings`);
    await manager.getByLabel("Kapak görseli", { exact: true }).setInputFiles({ name: "kapak.png", mimeType: "image/png", buffer: PNG });
    await expect(manager.getByText("Kapak görseli güncellendi.")).toBeVisible();
    invitationIds.banner = await inviteRecipient(withBanner, bannerSlug);

    const plainSlug = await createProject(manager, withoutBanner);
    invitationIds.plain = await inviteRecipient(withoutBanner, plainSlug);
  });

  test("the recipient sees the real banner in the preview, and it loads", async () => {
    await recipient.setViewportSize({ width: 1440, height: 900 });
    const bannerRequest = recipient.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith(`/project-invitations/${invitationIds.banner}/banner`));
    const dialog = await openPreview(withBanner);
    const response = await bannerRequest;
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect(response.headers()["cache-control"]).toContain("no-store");

    const banner = dialog.locator(`img[src*="/project-invitations/${invitationIds.banner}/banner?v="]`);
    await expect(banner).toHaveCount(1);
    await expect(banner).toBeVisible();
    await expect.poll(() => banner.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(dialog.locator(FALLBACK_SURFACE)).toHaveCount(0);
    // The rest of the card is intact next to the banner.
    await expect(dialog.getByRole("link", { name: /Projeyi aç/ })).toHaveCount(0);
    await expect(dialog).toContainText("Son güncelleme");
  });

  test("a project without a banner shows no picture and keeps the plain band", async () => {
    let bannerRequests = 0;
    recipient.on("request", (request) => { if (request.url().includes("/banner")) bannerRequests += 1; });
    const dialog = await openPreview(withoutBanner);
    await expect(dialog.locator("img")).toHaveCount(0);
    // No cover is drawn at all: the card's own band stays plain and no banner request leaves the page.
    await expect(dialog.locator(FALLBACK_SURFACE)).toHaveCount(0);
    expect(bannerRequests).toBe(0);
    // The route itself refuses a banner that does not exist.
    expect((await api(recipient, "GET", `/project-invitations/${invitationIds.plain}/banner`)).status).toBe(404);
  });

  test("a banner that fails to load falls back to the plain surface and the dialog stays usable", async () => {
    await recipient.route(/\/project-invitations\/[^/]+\/banner/, (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    const dialog = await openPreview(withBanner);
    await expect(dialog.locator('img[src*="/banner?v="]')).toHaveCount(0);
    await expect(dialog.locator(FALLBACK_SURFACE)).toHaveCount(1);
    await expect(dialog).toContainText(withBanner);
    await expect(dialog).toContainText("Son güncelleme");
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await recipient.keyboard.press("Escape");
    await expect(recipient.getByRole("dialog")).toHaveCount(0);
    // The invitation can still be answered from the same row.
    const row = recipient.getByRole("row").filter({ hasText: withBanner });
    await expect(row.getByRole("button", { name: "Kabul et" })).toBeEnabled();
    await recipient.unroute(/\/project-invitations\/[^/]+\/banner/);
  });
});
