import { test, expect, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE });
type TaskJson = { id: string; creationMode: string; title: string; estimatePoints: number | null; deadlineAt: string | null };

async function projectFixture(page: Page, mode: "SIMPLE" | "ADVANCED" | "BOTH" | null = "BOTH") {
  const slug = await createProject(page, `Task models ${Date.now()}`, { taskMode: mode });
  const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string };
  return { slug, id: project.id };
}
async function changeType(page: Page, mode: "Basit görev" | "Gelişmiş görev") {
  await page.getByRole("button", { name: mode, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Geçiş yap", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function createTask(page: Page, id: string, body: object) {
  const result = await api(page, "POST", `/projects/${id}/tasks`, { title: "Test task", priority: "MEDIUM", ...body });
  expect(result.status).toBe(201);
  return result.json as TaskJson;
}

test("founder chooses the project model before the first task", async ({ page }) => {
  const project = await projectFixture(page, null);
  await page.goto(`/projects/${project.slug}/tasks/new`);
  await expect(page.getByRole("heading", { name: "Bu projede görevleri nasıl oluşturmak istersiniz?" })).toBeVisible();
  await expect(page.locator("#task-title")).toHaveCount(0);
  await page.getByRole("radio", { name: /Yalnız basit/ }).check();
  await page.getByRole("button", { name: "Kaydet ve görev oluşturmaya geç" }).click();
  await expect(page.locator("#task-title")).toBeVisible();
  await expect(page.getByRole("button", { name: "Basit görev", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Gelişmiş görev", exact: true })).toBeDisabled();
  await expect(page.locator("#task-checklist")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sprintler", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Etiketler", exact: true })).toHaveCount(0);
  expect((await api(page, "GET", `/projects/${project.id}`)).json).toMatchObject({ taskManagementMode: "SIMPLE" });
});

test("mode help preserves drafts, suppression is optional, simple submit excludes advanced data", async ({ page }) => {
  const project = await projectFixture(page);
  await page.goto(`/projects/${project.slug}/tasks/new`);
  await page.locator("#task-title").fill("Simple draft survives");
  await page.locator("#task-description").fill("Shared description");
  await changeType(page, "Gelişmiş görev");
  await page.locator("#task-checklist").fill("Keep this advanced draft");
  await page.getByRole("button", { name: "Basit görev", exact: true }).click();
  await page.getByRole("dialog").getByRole("checkbox", { name: "Geçişlerde bu açıklamayı bir daha gösterme" }).check();
  await page.getByRole("dialog").getByRole("button", { name: "Geçiş yap", exact: true }).click();
  await page.getByRole("button", { name: "Gelişmiş görev", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#task-checklist")).toHaveValue("Keep this advanced draft");
  await page.getByRole("button", { name: "Basit görev", exact: true }).click();
  await page.getByRole("button", { name: "Basit ve gelişmiş görevlerin farkları", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Anladım", exact: true }).click();
  await expect(page.locator("#task-title")).toHaveValue("Simple draft survives");
  const request = page.waitForRequest(r => r.method() === "POST" && r.url().endsWith(`/projects/${project.id}/tasks`));
  await page.getByRole("button", { name: "Görevi oluştur", exact: true }).click();
  const payload = (await request).postDataJSON();
  expect(payload.creationMode).toBe("SIMPLE");
  for (const key of ["estimatePoints", "labelIds", "parentTaskId", "sprintId", "pool"]) expect(payload).not.toHaveProperty(key);
  await expect(page).toHaveURL(/gorevler\/(?!yeni$)[^/]+$/);
  await expect(page.locator("#detail-checklist")).toHaveCount(0);
  await expect(page.locator("#detail-attachments")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Yorum", exact: true }).fill("Comments work on simple tasks");
  await page.getByRole("button", { name: "Yorum yap", exact: true }).click();
  await expect(page.getByText("Comments work on simple tasks", { exact: true })).toBeVisible();
});

test("advanced-only creation makes a checklist", async ({ page }) => {
  const project = await projectFixture(page, "ADVANCED");
  await page.goto(`/projects/${project.slug}/tasks/new`);
  await expect(page.getByRole("button", { name: "Gelişmiş görev", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Basit görev", exact: true })).toBeDisabled();
  await page.locator("#task-title").fill("Advanced UI task");
  await page.locator("#task-checklist").fill("First step\nSecond step");
  await page.getByRole("button", { name: "Görevi oluştur", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Advanced UI task", exact: true })).toBeVisible();
  await expect(page.getByText("First step", { exact: true })).toBeVisible();
  await expect(page.getByText("Second step", { exact: true })).toBeVisible();
});

test("task type filters are shareable and reset pagination", async ({ page }) => {
  const project = await projectFixture(page);
  await createTask(page, project.id, { title: "Filter simple", creationMode: "SIMPLE" });
  await createTask(page, project.id, { title: "Filter advanced", creationMode: "ADVANCED" });
  await page.goto(`/projects/${project.slug}/tasks?page=2`);
  await page.getByRole("button", { name: /^Görev türü/ }).click();
  await page.getByRole("menuitemradio", { name: "Basit görev", exact: true }).click();
  await expect(page).toHaveURL(/creationMode=SIMPLE/);
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(page.getByRole("link", { name: "Filter simple", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Filter advanced", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("link", { name: "Filter simple", exact: true })).toBeVisible();
});

test("simple-only preserves old advanced data and exact deadline during basic edits", async ({ page }) => {
  const project = await projectFixture(page);
  const task = await createTask(page, project.id, { title: "Legacy advanced", creationMode: "ADVANCED", estimatePoints: 5, deadlineAt: "2030-10-05T11:24:37Z" });
  expect((await api(page, "POST", `/projects/${project.id}/tasks/${task.id}/checklist`, { text: "Preserved advanced step" })).status).toBe(201);
  await page.goto(`/projects/${project.slug}?section=settings`);
  await page.getByRole("radio", { name: /Yalnız basit/ }).check();
  await page.getByRole("button", { name: "Tercihi kaydet", exact: true }).click();
  await expect(page.getByText("Görev oluşturma tercihi kaydedildi.", { exact: true })).toBeVisible();
  await page.goto(`/projects/${project.slug}/tasks/${task.id}`);
  await expect(page.getByText(/Gelişmiş alanlar salt okunur/)).toBeVisible();
  await expect(page.getByText("Preserved advanced step", { exact: true })).toBeVisible();
  await expect(page.locator("#detail-points")).toBeDisabled();
  await expect(page.getByRole("button", { name: "İzle", exact: true })).toHaveCount(0);
  await page.goto(`/projects/${project.slug}/tasks/${task.id}/edit`);
  await page.locator("#task-title").fill("Legacy renamed");
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Legacy renamed", exact: true })).toBeVisible();
  const updated = (await api(page, "GET", `/projects/${project.id}/tasks/${task.id}`)).json as TaskJson;
  expect(updated.estimatePoints).toBe(5);
  expect(new Date(updated.deadlineAt!).toISOString()).toBe("2030-10-05T11:24:37.000Z");
  expect(updated.creationMode).toBe("ADVANCED");
  await page.goto(`/projects/${project.slug}/sprints`);
  await expect(page.getByText(/Gelişmiş alanlar salt okunur/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sprint oluştur", exact: true })).toHaveCount(0);
});

test("conversion never deletes advanced data and succeeds for an empty advanced task", async ({ page }) => {
  const project = await projectFixture(page);
  const task = await createTask(page, project.id, { creationMode: "ADVANCED", estimatePoints: 3 });
  await page.goto(`/projects/${project.slug}/tasks/${task.id}/edit`);
  await changeType(page, "Basit görev");
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await expect(page.getByText(/Gelişmiş verileri olan görev basite dönüştürülemez/)).toBeVisible();
  expect((await api(page, "GET", `/projects/${project.id}/tasks/${task.id}`)).json).toMatchObject({ creationMode: "ADVANCED", estimatePoints: 3 });
  const clean = await createTask(page, project.id, { creationMode: "ADVANCED", title: "Convertible" });
  await page.goto(`/projects/${project.slug}/tasks/${clean.id}/edit`);
  await changeType(page, "Basit görev");
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/gorevler/${clean.id}$`));
  expect((await api(page, "GET", `/projects/${project.id}/tasks/${clean.id}`)).json).toMatchObject({ creationMode: "SIMPLE" });
});

test("a policy conflict refreshes the form without losing the draft", async ({ page }) => {
  const project = await projectFixture(page);
  await page.goto(`/projects/${project.slug}/tasks/new`);
  await changeType(page, "Gelişmiş görev");
  await page.locator("#task-title").fill("Draft survives policy conflict");
  expect((await api(page, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "SIMPLE" })).status).toBe(200);
  await page.getByRole("button", { name: "Görevi oluştur", exact: true }).click();
  await expect(page.getByText(/Gelişmiş alanlar salt okunur/).first()).toBeVisible();
  await expect(page.locator("#task-title")).toHaveValue("Draft survives policy conflict");
  await changeType(page, "Basit görev");
  await page.getByRole("button", { name: "Görevi oluştur", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Draft survives policy conflict", exact: true })).toBeVisible();
});

test("a co-manager can read but cannot change the founder's preference", async ({ page, browser }) => {
  const project = await projectFixture(page, null);
  const context = await browser.newContext({ storageState: MEMBER_STORAGE });
  const member = await context.newPage();
  await member.goto("/projects");
  const me = (await api(member, "GET", "/auth/me")).json as { id: string };
  const team = (await api(page, "POST", `/projects/${project.id}/teams`, { name: "Co-manager team" })).json as { id: string };
  const invite = (await api(page, "POST", `/projects/${project.id}/invitations`, { userId: me.id, roles: ["PROJECT_MANAGER"], teamId: team.id })).json as { invitationId: string; token: string };
  expect((await api(member, "POST", `/projects/${project.id}/invitations/${invite.invitationId}/accept`, { token: invite.token })).status).toBe(200);
  await member.goto(`/projects/${project.slug}/tasks/new`);
  await expect(member.getByText(/projeyi kuran kişinin bu tercihi belirlemesi/)).toBeVisible();
  await expect(member.getByRole("radio", { name: /Her ikisi/ })).toBeDisabled();
  await member.goto(`/projects/${project.slug}?section=settings`);
  await expect(member.getByRole("radio", { name: /Yalnız basit/ })).toBeDisabled();
  expect((await api(member, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "BOTH" })).status).toBe(403);
  await context.close();
});

test("forms fit mobile, both themes and reduced motion without runtime errors", async ({ page }) => {
  const project = await projectFixture(page);
  const errors: string[] = [];
  page.on("pageerror", err => errors.push(err.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["light", "dark"]) {
    await page.addInitScript(value => localStorage.setItem("theme", value), theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/projects/${project.slug}/tasks/new`);
    await expect(page.locator("#task-title")).toBeVisible();
    await page.locator("#task-title").fill(`Mobile ${theme}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/task-model-simple-${theme}-390.png`, fullPage: true });
    await changeType(page, "Gelişmiş görev");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/task-model-${theme}-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `test-results/task-model-${theme}-1440.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test("advanced parent picker excludes simple tasks and child links choose advanced", async ({ page }) => {
  const project = await projectFixture(page);
  await createTask(page, project.id, { creationMode: "SIMPLE", title: "Simple parent excluded" });
  const parent = await createTask(page, project.id, { creationMode: "ADVANCED", title: "Advanced parent available" });
  await page.goto(`/projects/${project.slug}/tasks/new?parent=${parent.id}`);
  await expect(page.getByRole("button", { name: "Gelişmiş görev", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Üst görevi kaldır", exact: true }).click();
  await expect(page.getByRole("button", { name: /Advanced parent available/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Simple parent excluded/ })).toHaveCount(0);
  await page.goto(`/projects/${project.slug}/tasks/${parent.id}`);
  const section = page.locator('section[aria-labelledby="detail-subtasks"]');
  await section.getByRole("textbox", { name: "Yeni alt görev başlığı", exact: true }).fill("Quick advanced child");
  await section.getByRole("button", { name: "Ekle", exact: true }).click();
  await expect(section.getByRole("link", { name: /Quick advanced child/ })).toBeVisible();
  const children = (await api(page, "GET", `/projects/${project.id}/tasks/${parent.id}/subtasks`)).json as { creationMode: string; parent: { id: string } }[];
  expect(children).toHaveLength(1);
  expect(children[0]).toMatchObject({ creationMode: "ADVANCED", parent: { id: parent.id } });
});

test("basic edits retain a claimed pool task's advanced metadata", async ({ page }) => {
  const project = await projectFixture(page);
  const task = await createTask(page, project.id, { creationMode: "ADVANCED", pool: { open: true, teamId: null } });
  expect((await api(page, "POST", `/projects/${project.id}/tasks/${task.id}/claim`)).status).toBe(200);
  const previous = (await api(page, "GET", `/projects/${project.id}/tasks/${task.id}`)).json as { pool: unknown };
  expect((await api(page, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "SIMPLE" })).status).toBe(200);
  await page.goto(`/projects/${project.slug}/tasks/${task.id}/edit`);
  await page.locator("#task-title").fill("Claim metadata retained");
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Claim metadata retained", exact: true })).toBeVisible();
  expect((await api(page, "GET", `/projects/${project.id}/tasks/${task.id}`)).json).toMatchObject({ pool: previous.pool });
  expect((await api(page, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "BOTH" })).status).toBe(200);
  await page.goto(`/projects/${project.slug}/tasks/${task.id}`);
  await page.getByRole("button", { name: "Havuz bilgisini temizle", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Havuz bilgisini temizle", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await api(page, "GET", `/projects/${project.id}/tasks/${task.id}`)).json).toMatchObject({ pool: { open: false, claimed: false, teamId: null } });
});

test("keyboard help, validation and cancel protect the draft; EN and DE render translated modes", async ({ page }) => {
  const project = await projectFixture(page);
  await page.goto(`/projects/${project.slug}/tasks/new`);
  const help = page.getByRole("button", { name: "Basit ve gelişmiş görevlerin farkları", exact: true });
  await help.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(help).toBeFocused();
  await page.getByRole("button", { name: "Görevi oluştur", exact: true }).click();
  await expect(page.locator("#task-title")).toHaveAttribute("aria-invalid", "true");
  await page.locator("#task-title").fill("Keep draft on cancel");
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Düzenlemeye devam et", exact: true }).click();
  await expect(page.locator("#task-title")).toHaveValue("Keep draft on cancel");
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("button", { name: "Taslağı bırak ve ayrıl", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/gorevler$`));
  await page.goto(`/en/projects/${project.slug}/tasks/new`);
  await expect(page.getByRole("button", { name: "Simple task", exact: true })).toBeVisible();
  await page.goto(`/de/projekte/${project.slug}/aufgaben/neu`);
  await expect(page.getByRole("button", { name: "Einfache Aufgabe", exact: true })).toBeVisible();
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/de/projekte/${project.slug}?section=settings`);
    await expect(page.getByRole("radio", { name: /Nur einfach/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
