import { test, expect, type Locator, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

/** A real 1x1 PNG: the server reads the type and size from the bytes, so a made-up header would be refused. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** The initials the shared `Avatar` shows for a single-word nickname: its first two letters, upper-cased. */
const initialsOf = (nickname: string) => nickname.slice(0, 2).toUpperCase();

const avatarOf = (scope: Locator | Page, nickname: string) => scope.locator(`[data-slot="avatar"][title="${nickname}"]`);

/** The avatar whose photo really loaded (the browser could decode it), not just an <img> in the markup. */
async function expectPhoto(avatar: Locator) {
  const img = avatar.locator('img[src*="/profile-photo?v="]');
  await expect(img).toHaveCount(1);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
}

async function expectInitials(avatar: Locator, nickname: string) {
  await expect(avatar.locator("img")).toHaveCount(0);
  await expect(avatar).toHaveText(initialsOf(nickname));
}

/**
 * A person's profile photo follows them into tasks: the member uploads a photo, and it shows on the task detail
 * (as an assignee) and on their comment, while the manager, who has no photo, gets initials in both places.
 */
test.describe.serial("Task avatars", () => {
  let managerPage: Page;
  let memberPage: Page;
  let slug: string;
  let projectId: string;
  let taskId: string;
  let member: { id: string; nickname: string };
  let manager: { id: string; nickname: string };

  test.beforeAll(async ({ browser }) => {
    managerPage = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    memberPage = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
  });

  test.afterAll(async () => {
    // The shared accounts must not keep a photo after this file, whatever happened in it.
    await api(memberPage, "DELETE", "/users/me/profile-photo").catch(() => undefined);
    await api(managerPage, "DELETE", "/users/me/profile-photo").catch(() => undefined);
    await managerPage.close();
    await memberPage.close();
  });

  test("a task with two assignees: the manager has no photo, the member uploads one", async () => {
    slug = await createProject(managerPage, `E2E Avatar Project ${Date.now()}`);
    projectId = ((await api(managerPage, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    manager = (await api(managerPage, "GET", "/auth/me")).json as typeof manager;

    await memberPage.goto("/projects");
    member = (await api(memberPage, "GET", "/auth/me")).json as typeof member;
    const team = await api(managerPage, "POST", `/projects/${projectId}/teams`, { name: "Avatar Team" });
    expect(team.status).toBe(201);
    const invite = await api(managerPage, "POST", `/projects/${projectId}/invitations`, {
      userId: member.id,
      roles: ["FRONTEND_DEVELOPER"],
      teamId: (team.json as { id: string }).id,
    });
    expect(invite.status).toBe(201);
    const { invitationId, token } = invite.json as { invitationId: string; token: string };
    expect((await api(memberPage, "POST", `/projects/${projectId}/invitations/${invitationId}/accept`, { token })).status).toBe(200);

    // The member uploads the photo the way a person does: on the account page, with a preview and a confirmation.
    await memberPage.goto("/account");
    await memberPage.getByTestId("profile-photo-input").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
    await memberPage.getByRole("button", { name: "Fotoğrafı kaydet" }).click();
    await expect(memberPage.getByText("Profil fotoğrafı güncellendi.")).toBeVisible();

    const created = await api(managerPage, "POST", `/projects/${projectId}/tasks`, {
      title: "Avatarlı E2E görevi",
      priority: "MEDIUM",
      assigneeIds: [member.id, manager.id],
    });
    expect(created.status).toBe(201);
    taskId = (created.json as { id: string }).id;
  });

  test("on the task detail the assignee with a photo shows it and the one without shows initials", async () => {
    await memberPage.goto(`/projects/${slug}/tasks/${taskId}`);
    const main = memberPage.locator("#main-content");
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible();

    const withPhoto = avatarOf(main, member.nickname);
    await expect(withPhoto.first()).toBeVisible();
    for (const avatar of await withPhoto.all()) await expectPhoto(avatar);

    const without = avatarOf(main, manager.nickname);
    await expect(without.first()).toBeVisible();
    for (const avatar of await without.all()) await expectInitials(avatar, manager.nickname);
  });

  test("a comment shows its author's photo, and a comment by the person without a photo shows initials", async () => {
    const memberText = "Fotoğraflı yorum: üzerinde çalışıyorum";
    await memberPage.goto(`/projects/${slug}/tasks/${taskId}`);
    await memberPage.getByRole("combobox", { name: "Yorum" }).fill(memberText);
    await memberPage.getByRole("button", { name: /^Yorum yap$/ }).click();
    await expect(memberPage.getByText(memberText)).toBeVisible();

    // The comment row is the nearest ancestor of its text that holds an avatar.
    const row = (page: Page, text: string) => page.getByText(text).locator("xpath=ancestor::*[.//*[@data-slot='avatar']][1]");
    await expectPhoto(avatarOf(row(memberPage, memberText), member.nickname));

    const managerText = "Fotoğrafsız yorum: ben de bakıyorum";
    await managerPage.goto(`/projects/${slug}/tasks/${taskId}`);
    await managerPage.getByRole("combobox", { name: "Yorum" }).fill(managerText);
    await managerPage.getByRole("button", { name: /^Yorum yap$/ }).click();
    await expect(managerPage.getByText(managerText)).toBeVisible();
    await expectInitials(avatarOf(row(managerPage, managerText), manager.nickname), manager.nickname);

    // Seen by the manager, the member's earlier comment still carries the member's photo.
    await expectPhoto(avatarOf(row(managerPage, memberText), member.nickname));
  });
});
