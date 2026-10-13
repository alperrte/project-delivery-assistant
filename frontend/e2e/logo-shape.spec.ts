import { expect, test, type Locator, type Page } from "@playwright/test";
import { api, createdProjectSlug, declineTeamPrompt, openProjectListPage } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import type { Project } from "../src/features/projects/types";
import type { Organization } from "../src/features/organizations/types";

test.use({ storageState: MANAGER_STORAGE });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const file = { name: "logo.png", mimeType: "image/png", buffer: PNG };
const picker = (page: Page) => page.getByRole("group", { name: "Logo şekli", exact: true });

async function frameShape(frame: Locator, circle: boolean) {
  await expect(frame).toBeVisible();
  await expect(frame.locator("[data-logo-shape]")).toHaveAttribute("data-logo-shape", circle ? "CIRCLE" : "SQUARE");
  if (circle) await expect(frame).toHaveCSS("border-radius", "50%");
  else await expect(frame).not.toHaveCSS("border-radius", "50%");
  await expect(frame.locator("img")).toHaveCSS("object-fit", "cover").catch(async () => {
    await expect(frame.locator("img")).toHaveCount(0);
  });
}

test("project create and edit retain the shape across preview, refresh, cards, sidebar and media removal", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const name = `Logo shape project ${Date.now()}`;
  await page.goto("/projects/new");
  await page.locator("#project-name").fill(name);
  await page.getByRole("checkbox", { name: /^Web/ }).check();
  await picker(page).getByRole("radio", { name: "Yuvarlak", exact: true }).check();
  await frameShape(page.locator("#project-preview [data-logo-frame]"), true);
  await page.locator('input[type="file"]').first().setInputFiles(file);
  await expect(page.locator('#project-preview img[src^="blob:"]')).toBeVisible();
  await page.getByRole("button", { name: "Projeyi oluştur", exact: true }).click();
  await declineTeamPrompt(page);
  const slug = await createdProjectSlug(page);
  const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as Project;
  expect(project.logoShape).toBe("CIRCLE");
  await frameShape(page.getByTestId("project-header-mark"), true);
  await page.reload();
  await frameShape(page.getByTestId("project-header-mark"), true);
  await expect(page.locator('aside [data-logo-frame]:visible').first()).toHaveCSS("border-radius", "50%");
  await openProjectListPage(page, slug);
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await frameShape(card.locator("[data-logo-frame]"), true);
  await card.getByRole("link", { name: `${name} ayarlarını düzenle` }).click();
  await expect(picker(page).getByRole("radio", { name: "Yuvarlak" })).toBeChecked();
  await picker(page).getByRole("radio", { name: "Köşeli", exact: true }).check();
  await frameShape(page.getByTestId("project-settings-mark"), false);
  await frameShape(page.locator("#project-preview [data-logo-frame]"), false);
  const save = page.locator('#project-settings-form button[type="submit"]');
  await save.click();
  await expect(save).toBeDisabled();
  expect(((await api(page, "GET", `/projects/${project.id}`)).json as Project).logoVersion).toBe(project.logoVersion);
  await page.reload();
  await expect(picker(page).getByRole("radio", { name: "Köşeli" })).toBeChecked();
  await frameShape(page.getByTestId("project-header-mark"), false);
  await picker(page).getByRole("radio", { name: "Yuvarlak" }).check();
  await save.click();
  await expect(save).toBeDisabled();
  // Shape persists through the existing immediate media removal flow.
  await page.getByTestId("project-logo-field").getByRole("button", { name: "Logo kaldır", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Logo kaldır", exact: true }).click();
  await expect(page.getByTestId("project-settings-mark").locator("img")).toHaveCount(0);
  await frameShape(page.getByTestId("project-settings-mark"), true);
  await page.reload();
  const after = (await api(page, "GET", `/projects/${project.id}`)).json as Project;
  expect(after.logoShape).toBe("CIRCLE"); expect(after.logoVersion).toBeNull();
  await frameShape(page.getByTestId("project-header-mark"), true);
  expect(errors).toEqual([]);
});

test("organization shape saves independently, previews instantly and survives logo replacement and removal", async ({ page }) => {
  const name = `Logo shape organization ${Date.now()}`;
  await page.goto("/organizations/new");
  await page.locator("#org-name").fill(name);
  await picker(page).getByRole("radio", { name: "Yuvarlak", exact: true }).check();
  for (const frame of await page.locator("#organization-preview [data-logo-frame]").all()) await frameShape(frame, true);
  await page.locator('input[type="file"]').first().setInputFiles(file);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/tr\/organizasyonlar\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const org = (await api(page, "GET", `/organizations/${id}`)).json as Organization;
  expect(org.logoShape).toBe("CIRCLE");
  await frameShape(page.locator("main [data-logo-frame]").first(), true);
  await page.reload();
  await frameShape(page.locator("main [data-logo-frame]").first(), true);
  await page.goto(`/organizations/${id}/edit`);
  await picker(page).getByRole("radio", { name: "Köşeli", exact: true }).check();
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/tr\/organizasyonlar\/[0-9a-f-]{36}$/);
  const square = (await api(page, "GET", `/organizations/${id}`)).json as Organization;
  expect(square.logoShape).toBe("SQUARE"); expect(square.logoVersion).toBe(org.logoVersion);
  await frameShape(page.locator("main [data-logo-frame]").first(), false);
  await page.goto(`/organizations/${id}/edit`);
  await picker(page).getByRole("radio", { name: "Yuvarlak" }).check();
  await page.locator('input[type="file"]').first().setInputFiles(file);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/tr\/organizasyonlar\/[0-9a-f-]{36}$/);
  await page.goto(`/organizations/${id}/edit`);
  await page.getByRole("button", { name: "Kaldır", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Kaldır", exact: true }).click();
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/tr\/organizasyonlar\/[0-9a-f-]{36}$/);
  const after = (await api(page, "GET", `/organizations/${id}`)).json as Organization;
  expect(after.logoShape).toBe("CIRCLE"); expect(after.logoVersion).toBeNull();
  await frameShape(page.locator("main [data-logo-frame]").first(), true);
  await page.goto("/organizations");
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await frameShape(card.locator("[data-logo-frame]"), true);
});

test("native shape radios support keyboard, three locales, both themes and narrow screens", async ({ page }) => {
  for (const locale of ["tr", "en", "de"] as const) {
    const labels = locale === "tr" ? ["Logo şekli", "Köşeli", "Yuvarlak"] : locale === "en" ? ["Logo shape", "Square", "Circle"] : ["Logoform", "Eckig", "Rund"];
    for (const route of ["projects/new", "organizations/new"]) {
      await page.goto(`/${locale}/${route}`);
      const group = page.getByRole("group", { name: labels[0], exact: true });
      const square = group.getByRole("radio", { name: labels[1], exact: true });
      await expect(square).toBeChecked();
      await square.focus(); await page.keyboard.press("ArrowRight");
      await expect(group.getByRole("radio", { name: labels[2], exact: true })).toBeChecked();
      for (const dark of [false, true]) {
        await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), dark);
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await group.scrollIntoViewIfNeeded();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          expect((await group.boundingBox())!.width).toBeLessThanOrEqual(width);
          if (locale === "tr" && [390, 1440].includes(width)) await page.screenshot({ path: `../.local/logo-shape-${route.split('/')[0]}-${dark ? "dark" : "light"}-${width}.png` });
        }
      }
    }
  }
});

test("team, chat and recipient invitation surfaces use the project's own shape", async ({ page, browser }) => {
  await page.goto("/dashboard");
  const name = `Shared logo shape ${Date.now()}`;
  const created = await api(page, "POST", "/projects", { name, logoShape: "CIRCLE" });
  expect(created.status).toBe(201);
  const project = created.json as Project;
  const teamResult = await api(page, "POST", `/projects/${project.id}/teams`, { name: "Shape team", includeCreator: true });
  expect(teamResult.status).toBe(201);
  const team = teamResult.json as { id: string };
  await page.goto(`/projects/${project.slug}/teams`);
  await frameShape(page.locator("main article [data-logo-frame]").first(), true);
  await page.goto(`/projects/${project.slug}/teams?view=chart`);
  await frameShape(page.locator("main [data-logo-frame]").first(), true);
  await page.goto(`/projects/${project.slug}/teams/${team.id}`);
  await frameShape(page.locator("main [data-logo-frame]").first(), true);
  const overview = (await api(page, "GET", "/chat/conversations")).json as { groups: { id: string; projectId: string }[] };
  const groupId = overview.groups.find(group => group.projectId === project.id)!.id;
  await page.getByTestId("chat-nav-item").filter({ visible: true }).click();
  const group = page.locator(`[data-testid="chat-conversation-group"][data-conversation-id="${groupId}"]`);
  await group.click();
  await expect(group.locator('[data-slot="group-avatar"]')).toHaveCSS("border-radius", "50%");
  await page.getByTestId("chat-panel-close").click();
  const context = await browser.newContext({ storageState: MEMBER_STORAGE });
  const recipient = await context.newPage();
  try {
    await recipient.goto("/dashboard");
    const user = (await api(recipient, "GET", "/auth/me")).json as { id: string };
    const invited = await api(page, "POST", `/projects/${project.id}/invitations`, { userId: user.id, roles: ["ANALYST"], teamId: team.id });
    expect(invited.status).toBe(201);
    const invitationId = (invited.json as { invitationId: string }).invitationId;
    expect(((await api(recipient, "GET", `/project-invitations/${invitationId}/preview`)).json as { logoShape: string }).logoShape).toBe("CIRCLE");
    await recipient.goto("/invitations");
    await expect(recipient.locator('main [data-logo-frame]').first()).toHaveCSS("border-radius", "50%");
    await recipient.getByRole("button", { name: new RegExp(name) }).first().click();
    await frameShape(recipient.getByRole("dialog").locator("article [data-logo-frame]"), true);
  } finally { await context.close(); }
});
