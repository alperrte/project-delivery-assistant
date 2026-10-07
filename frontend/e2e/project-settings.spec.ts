import { test, expect, type Page } from "@playwright/test";
import { api, chooseDate, createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

/**
 * Project settings: live preview beside the form, the technology pop-up, the date picker, the cover preview, the goal
 * that is no longer edited but still kept, the one-row technology strip on the card, and the type-the-name deletion that
 * only the project's founder is offered.
 */
test.describe.serial("Project settings", () => {
  let founderPage: Page;
  let coManagerPage: Page;
  let slug: string;
  let projectId: string;
  const projectName = `E2E Settings ${Date.now()}`;
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  async function stored() {
    return (await api(founderPage, "GET", `/projects/${projectId}`)).json as Record<string, unknown>;
  }

  test.beforeAll(async ({ browser }) => {
    founderPage = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    coManagerPage = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
  });

  test.afterAll(async () => {
    await founderPage.close();
    await coManagerPage.close();
  });

  test("a founder and a second project manager share a project", async () => {
    slug = await createProject(founderPage, projectName);
    projectId = ((await api(founderPage, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    const team = await api(founderPage, "POST", `/projects/${projectId}/teams`, { name: "Core" });
    expect(team.status).toBe(201);

    await coManagerPage.goto("/projects");
    const me = (await api(coManagerPage, "GET", "/auth/me")).json as { id: string };
    const invite = await api(founderPage, "POST", `/projects/${projectId}/invitations`, {
      userId: me.id,
      roles: ["PROJECT_MANAGER"],
      teamId: (team.json as { id: string }).id,
    });
    expect(invite.status).toBe(201);
    const { invitationId, token } = invite.json as { invitationId: string; token: string };
    const accepted = await api(coManagerPage, "POST", `/projects/${projectId}/invitations/${invitationId}/accept`, { token });
    expect(accepted.status).toBe(200);
  });

  test("the form has no goal field and the card previews what is typed", async () => {
    await founderPage.goto(`/projects/${slug}?section=settings`);
    await expect(founderPage.locator("#settings-name")).toBeVisible();
    await expect(founderPage.locator("#settings-goal")).toHaveCount(0);
    await expect(founderPage.getByText("Proje hedefi", { exact: true })).toHaveCount(0);

    const preview = founderPage.locator("#project-preview");
    await expect(preview).toBeVisible();
    await expect(preview.getByRole("heading", { name: projectName })).toBeVisible();

    await founderPage.locator("#settings-name").fill(`${projectName} yeni`);
    await founderPage.locator("#settings-tagline").fill("Canlı önizleme sloganı");
    await expect(preview.getByRole("heading", { name: `${projectName} yeni` })).toBeVisible();
    await expect(preview.getByText("Canlı önizleme sloganı")).toBeVisible();

    await founderPage.getByRole("button", { name: /^Değişiklikleri at$/ }).click();
    await expect(preview.getByRole("heading", { name: projectName })).toBeVisible();
  });

  test("the preview stays in view on the right while the form scrolls", async () => {
    await founderPage.setViewportSize({ width: 1440, height: 900 });
    await founderPage.goto(`/projects/${slug}?section=settings`);
    const card = founderPage.locator("#project-preview article");
    await expect(card).toBeVisible();
    await founderPage.evaluate(() => window.scrollTo(0, 600));
    await founderPage.evaluate(() => window.scrollTo(0, 100000));
    await expect.poll(async () => {
      const box = await card.boundingBox();
      return box ? box.y >= 0 && box.y + box.height <= 900 : false;
    }).toBe(true);
    const form = await founderPage.locator("#settings-name").boundingBox();
    const box = await card.boundingBox();
    // The card sits to the right of the form column, not below it.
    expect(box!.x).toBeGreaterThan(form!.x + form!.width);
    await founderPage.setViewportSize({ width: 1280, height: 720 });
  });

  test("the technology pop-up opens with the current choice and the preview follows it", async () => {
    await founderPage.goto(`/projects/${slug}?section=settings`);
    await expect(founderPage.getByText("Henüz teknoloji seçilmedi.")).toBeVisible();

    await founderPage.getByRole("button", { name: /^Teknolojileri düzenle$/ }).click();
    const dialog = founderPage.getByRole("dialog", { name: "Teknolojileri düzenle" });
    await expect(dialog.getByRole("button", { name: "React", exact: true })).toHaveAttribute("aria-pressed", "false");
    await dialog.getByRole("button", { name: "React", exact: true }).click();
    await dialog.getByRole("button", { name: "TypeScript", exact: true }).click();
    await dialog.getByRole("button", { name: /^Uygula$/ }).click();
    await expect(dialog).toHaveCount(0);

    const preview = founderPage.locator("#project-preview");
    await expect(preview.getByRole("img", { name: "React", exact: true })).toBeVisible();
    await expect(preview.getByRole("img", { name: "TypeScript", exact: true })).toBeVisible();
    // Nothing is stored until the save bar is used.
    expect((await stored()).techStack).toBeNull();

    await founderPage.getByRole("button", { name: /^Değişiklikleri kaydet$/ }).click();
    await expect(founderPage.getByText("Ayarlar kaydedildi.")).toBeVisible();
    expect((await stored()).techStack).toBe("React, TypeScript");

    await founderPage.reload();
    await founderPage.getByRole("button", { name: /^Teknolojileri düzenle$/ }).click();
    const reopened = founderPage.getByRole("dialog", { name: "Teknolojileri düzenle" });
    await expect(reopened.getByRole("button", { name: "React", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(reopened.getByRole("button", { name: "Docker", exact: true })).toHaveAttribute("aria-pressed", "false");
    await reopened.getByRole("button", { name: /^Vazgeç$/ }).click();
  });

  test("the dates use the date picker and keep their order", async () => {
    await founderPage.goto(`/projects/${slug}?section=settings`);
    await expect(founderPage.locator('input[type="date"]')).toHaveCount(0);

    await chooseDate(founderPage, "settings-start", "2030-04-10");
    await chooseDate(founderPage, "settings-end", "2030-04-05");
    await expect(founderPage.locator("#settings-end")).toHaveAttribute("aria-invalid", "true");
    await expect(founderPage.locator("#settings-end-error")).toBeVisible();

    await chooseDate(founderPage, "settings-end", "2030-04-20");
    await expect(founderPage.locator("#settings-end")).not.toHaveAttribute("aria-invalid", "true");
    await founderPage.getByRole("button", { name: /^Değişiklikleri kaydet$/ }).click();
    await expect(founderPage.getByText("Ayarlar kaydedildi.")).toBeVisible();
    const project = await stored();
    expect(project.startDate).toBe("2030-04-10");
    expect(project.targetEndDate).toBe("2030-04-20");
  });

  test("the cover is previewed in the settings, with a placeholder before one exists", async () => {
    await founderPage.goto(`/projects/${slug}?section=settings`);
    const cover = founderPage.getByTestId("project-settings-banner");
    await expect(cover).toBeVisible();
    await expect(cover.locator("img")).toHaveCount(0);

    await founderPage.getByLabel("Kapak görseli", { exact: true }).setInputFiles({ name: "kapak.png", mimeType: "image/png", buffer: PNG });
    await expect(founderPage.getByText("Kapak görseli güncellendi.")).toBeVisible();
    await expect(cover.locator('img[src*="/banner?v="]')).toBeVisible();
    await expect(founderPage.locator("#project-preview").locator('img[src*="/banner?v="]')).toBeVisible();
  });

  test("a stored goal is kept when the settings are saved, and the overview still shows it", async () => {
    const put = await api(founderPage, "PUT", `/projects/${projectId}`, {
      name: projectName,
      priority: "MEDIUM",
      status: "PLANNING",
      projectType: "WEB",
      projectGoal: "Eski hedef metni",
      techStack: "React, TypeScript",
    });
    expect(put.status).toBe(200);

    await founderPage.goto(`/projects/${slug}?section=settings`);
    await founderPage.locator("#settings-name").fill(`${projectName} v2`);
    await founderPage.getByRole("button", { name: /^Değişiklikleri kaydet$/ }).click();
    await expect(founderPage.getByText("Ayarlar kaydedildi.")).toBeVisible();
    expect((await stored()).projectGoal).toBe("Eski hedef metni");

    await founderPage.goto(`/projects/${slug}`);
    await expect(founderPage.getByRole("region", { name: "Proje profili" }).getByText("Eski hedef metni")).toBeVisible();
  });

  test("the card shows each technology once, in a single row", async () => {
    const put = await api(founderPage, "PUT", `/projects/${projectId}`, {
      name: projectName,
      priority: "MEDIUM",
      status: "PLANNING",
      projectType: "WEB",
      techStack: "React, react, ReactJS, Docker, TypeScript, PostgreSQL, Redis, Go, Python, Rust, Eski Araç",
    });
    expect(put.status).toBe(200);

    await founderPage.goto(`/projects/${slug}?section=settings`);
    const strip = founderPage.locator("#project-preview").getByRole("list", { name: "Teknoloji" });
    const items = strip.getByRole("listitem");
    // Nine distinct technologies: six logos and "+3".
    await expect(items).toHaveCount(7);
    await expect(strip.getByRole("img", { name: "React", exact: true })).toHaveCount(1);
    await expect(strip.getByRole("img", { name: "+3" }).or(strip.getByText("+3"))).toBeVisible();

    const tops = await items.evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });

  test("a second project manager is not offered the deletion, and the server refuses it", async () => {
    await coManagerPage.goto(`/projects/${slug}?section=settings`);
    await expect(coManagerPage.locator("#settings-name")).toBeVisible();
    await expect(coManagerPage.getByRole("button", { name: /^Projeyi sil$/ })).toHaveCount(0);
    expect((await api(coManagerPage, "DELETE", `/projects/${projectId}`)).status).toBe(403);
    expect((await api(founderPage, "GET", `/projects/${projectId}`)).status).toBe(200);
  });

  test("deleting needs the exact project name, then removes the project for good", async () => {
    const name = ((await stored()).name as string);
    await founderPage.goto(`/projects/${slug}?section=settings`);
    await founderPage.getByRole("button", { name: /^Projeyi sil$/ }).click();
    const dialog = founderPage.getByRole("dialog");
    const confirm = dialog.getByRole("button", { name: /^Bu projeyi sil$/ });
    const field = dialog.getByLabel(/Onaylamak için proje adını yazın/);

    await expect(confirm).toBeDisabled();
    await field.fill(name.toLowerCase());
    await expect(confirm).toBeDisabled();
    await field.fill(name.slice(0, -1));
    await expect(confirm).toBeDisabled();
    await field.fill(name);
    await expect(confirm).toBeEnabled();

    await confirm.click();
    await expect(founderPage).toHaveURL(/\/tr\/projeler$/, { timeout: 15_000 });
    await expect(founderPage.getByText("Proje silindi.")).toBeVisible();

    expect((await api(founderPage, "GET", `/projects/by-slug/${slug}`)).status).toBe(404);
    expect((await api(founderPage, "GET", `/projects/${projectId}`)).status).toBe(403);
    await founderPage.goto(`/projects/${slug}`);
    await expect(founderPage.getByRole("heading", { level: 1, name: name })).toHaveCount(0);
  });
});
