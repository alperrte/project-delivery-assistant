import { test, expect, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import { quickDeadline } from "../src/features/tasks/deadline";

test.use({ storageState: MANAGER_STORAGE, timezoneId: "Europe/Istanbul" });

async function fixture(page: Page, mode: "SIMPLE" | "ADVANCED" = "SIMPLE") {
  const slug = await createProject(page, `Planning ${Date.now()}`, { taskMode: mode });
  const { id } = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string };
  await page.goto(`/projects/${slug}/tasks/new`);
  await expect(page.locator("#task-title")).toBeVisible();
  return { slug, id };
}

test("calendar presets handle Sunday, month/year boundaries and end of day", () => {
  expect(quickDeadline("weekEnd", new Date(2026, 9, 11, 9))).toEqual({ date: "2026-10-11", time: "23:59" });
  expect(quickDeadline("weekEnd", new Date(2026, 9, 12, 9))).toEqual({ date: "2026-10-18", time: "23:59" });
  expect(quickDeadline("tomorrow", new Date(2028, 1, 28, 9))).toEqual({ date: "2028-02-29", time: "23:59" });
  expect(quickDeadline("nextWeek", new Date(2026, 11, 31, 9))).toEqual({ date: "2027-01-07", time: "23:59" });
});

for (const mode of ["SIMPLE", "ADVANCED"] as const) {
  test(`${mode} quick deadlines select local calendar dates and persist 23:59`, async ({ page }) => {
    const project = await fixture(page, mode);
    await page.locator("#task-title").fill(`${mode} quick deadline`);
    const quick = page.getByRole("group", { name: "Hızlı son tarih seçimi" });
    const current = await page.evaluate(() => { const d = new Date(); return [d.getFullYear(), d.getMonth(), d.getDate()]; });
    const now = new Date(current[0], current[1], current[2], 9);
    for (const [kind, label] of [["today", "Bugün"], ["tomorrow", "Yarın"], ["weekEnd", "Bu hafta sonuna kadar"], ["nextWeek", "Haftaya bugüne kadar"]] as const) {
      await quick.getByRole("button", { name: label, exact: true }).click();
      const expected = quickDeadline(kind, now);
      await page.locator("#task-deadline-date").click();
      await expect(page.locator(`[data-date="${expected.date}"]`)).toBeFocused();
      await page.keyboard.press("Escape");
      if (mode === "ADVANCED") await expect(page.getByLabel("Son tarih saati", { exact: true })).toHaveValue("23:59");
    }
    await quick.getByRole("button", { name: "Temizle", exact: true }).click();
    await expect(page.locator("#task-deadline-date")).toContainText("Tarih seçin");
    await quick.getByRole("button", { name: "Haftaya bugüne kadar", exact: true }).click();
    const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/projects/${project.id}/tasks`));
    await page.getByRole("button", { name: "Görevi oluştur", exact: true }).click();
    const result = await response;
    expect(result.status()).toBe(201);
    const task = await result.json() as { deadlineAt: string };
    const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(task.deadlineAt));
    expect(date).toBe(quickDeadline("nextWeek", now).date);
    expect(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" }).format(new Date(task.deadlineAt))).toBe("23:59");
  });
}

test("priority indicators use shared colors in both themes, previews, lists and detail", async ({ page }, testInfo) => {
  const project = await fixture(page);
  await page.locator("#task-title").fill("Critical priority appearance");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => { document.documentElement.classList.toggle("dark", value === "dark"); }, theme);
    for (const [priority, label, token] of [["LOW", "Düşük", "label-blue"], ["MEDIUM", "Orta", "label-orange"], ["HIGH", "Yüksek", "destructive"], ["CRITICAL", "Kritik", "destructive"]] as const) {
      await page.getByRole("radio", { name: label, exact: true }).locator("..").click();
      await expect(page.getByRole("radio", { name: label, exact: true })).toBeChecked();
      const marker = page.getByRole("radiogroup", { name: "Öncelik", exact: true }).locator(`[data-priority="${priority}"]`);
      const color = await marker.evaluate((el, variable) => {
        const probe = document.createElement("span");
        probe.style.color = `var(--${variable})`;
        el.append(probe);
        const expected = getComputedStyle(probe).color;
        probe.remove();
        const indicator = el.firstElementChild!;
        return { actual: getComputedStyle(indicator)[indicator.tagName.toLowerCase() === "svg" ? "color" : "backgroundColor"], expected };
      }, token);
      expect(color.actual).toBe(color.expected);
      if (priority === "CRITICAL") await expect(marker.locator("[data-priority-alert]")).toHaveCount(1);
      await expect(page.getByRole("article", { name: "Önizleme" }).locator(`[data-priority="${priority}"]`)).toHaveCount(1);
    }
    await page.getByRole("radiogroup", { name: "Öncelik", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`priorities-${theme}.png`) });
  }
  await page.getByRole("button", { name: "Görevi oluştur", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Critical priority appearance", exact: true })).toBeVisible();
  await expect(page.locator("#detail-priority [data-priority-alert]")).toHaveCount(1);
  await page.locator("#detail-priority").click();
  await page.getByRole("option", { name: "Düşük", exact: true }).click();
  await expect(page.locator('#detail-priority [data-priority="LOW"]')).toHaveCount(1);
  await page.goto(`/projects/${project.slug}/tasks`);
  const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Critical priority appearance", exact: true }) });
  await expect(row.locator('[data-priority="LOW"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("creator is hidden from people and team searches; Assign me is the self-assignment action", async ({ page, browser }) => {
  const project = await fixture(page);
  const me = (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string };
  const team = (await api(page, "POST", `/projects/${project.id}/teams`, { name: "Shared team", includeCreator: true })).json as { id: string };
  const context = await browser.newContext({ storageState: MEMBER_STORAGE });
  try {
    const member = await context.newPage();
    await member.goto("/projects");
    const other = (await api(member, "GET", "/auth/me")).json as { id: string; nickname: string };
    const invite = (await api(page, "POST", `/projects/${project.id}/invitations`, { userId: other.id, roles: ["FRONTEND_DEVELOPER"], teamId: team.id })).json as { invitationId: string; token: string };
    expect((await api(member, "POST", `/projects/${project.id}/invitations/${invite.invitationId}/accept`, { token: invite.token })).status).toBe(200);
    await page.reload();
    const people = page.getByRole("group", { name: "Proje üyeleri", exact: true });
    await expect(people.locator(`[id$="-${me.id}"]`)).toHaveCount(0);
    await expect(people.locator(`[id$="-${other.id}"]`)).toBeVisible();
    await page.getByRole("combobox", { name: "Ekibe göre süz", exact: true }).click();
    await page.getByRole("option", { name: "Shared team", exact: true }).click();
    await expect(people.locator(`[id$="-${other.id}"]`)).toBeVisible();
    await expect(people.locator(`[id$="-${me.id}"]`)).toHaveCount(0);
    await page.getByRole("textbox", { name: "Üye ara", exact: true }).fill(me.nickname);
    await expect(people.getByRole("checkbox")).toHaveCount(0);
    await page.getByRole("button", { name: "Bana ata", exact: true }).click();
    await expect(page.getByRole("list", { name: "Atananlar", exact: true })).toContainText(me.nickname);
    await expect(page.getByRole("button", { name: "Bana ata", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: `${me.nickname} atamasını kaldır`, exact: true }).click();
    await page.getByRole("button", { name: "Bana ata", exact: true }).click();
    await page.locator("#task-title").fill("Assigned to creator");
    const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/projects/${project.id}/tasks`));
    await page.getByRole("button", { name: "Görevi oluştur", exact: true }).click();
    expect(await (await response).json()).toMatchObject({ assigneeIds: [me.id], creationMode: "SIMPLE" });
  } finally { await context.close(); }
});

test("simple projects offer whole-project and team pools, claims and releases", async ({ page }, testInfo) => {
  const project = await fixture(page);
  const team = (await api(page, "POST", `/projects/${project.id}/teams`, { name: "Pool team", includeCreator: true })).json as { id: string };
  await page.reload();
  await page.locator("#task-title").fill("Simple pooled task");
  await page.getByRole("button", { name: "Bana ata", exact: true }).click();
  await page.getByRole("radio", { name: "Havuza koy", exact: true }).locator("..").click();
  const audience = page.getByRole("combobox", { name: "Kimler üstlenebilir", exact: true });
  await expect(audience).toContainText("Tüm proje");
  await audience.click();
  await page.getByRole("option", { name: "Pool team", exact: true }).click();
  const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/projects/${project.id}/tasks`));
  await page.getByRole("button", { name: "Görevi oluştur", exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(201);
  const task = await result.json() as { id: string };
  expect(result.request().postDataJSON()).toMatchObject({ creationMode: "SIMPLE", assigneeIds: [], pool: { open: true, teamId: team.id } });
  await expect(page.getByRole("button", { name: "Üstlen", exact: true })).toBeVisible();
  await expect(page.locator("#detail-checklist")).toHaveCount(0);
  await page.getByRole("button", { name: "Üstlen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Havuza bırak", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Havuza bırak", exact: true }).click();
  await expect(page.getByRole("button", { name: "Üstlen", exact: true })).toBeVisible();
  await page.goto(`/projects/${project.slug}/tasks/pool`);
  await expect(page.getByRole("link", { name: "Simple pooled task", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Üstlen", exact: true })).toBeEnabled();
  await expect(page.getByText(/Gelişmiş alanlar salt okunur/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Havuz", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sprintler", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Etiketler", exact: true })).toHaveCount(0);
  expect((await api(page, "GET", `/tasks/pool?projectId=${project.id}`)).json).toMatchObject({ content: [expect.objectContaining({ id: task.id, creationMode: "SIMPLE" })] });
  await page.screenshot({ path: testInfo.outputPath("simple-pool.png") });
});

test("planning and pool controls fit narrow screens in both themes and three languages", async ({ page }, testInfo) => {
  const project = await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const locale of ["tr", "en", "de"]) {
    const prefix = locale === "tr" ? "projeler" : locale === "de" ? "projekte" : "projects";
    const tasks = locale === "tr" ? "gorevler/yeni" : locale === "de" ? "aufgaben/neu" : "tasks/new";
    await page.goto(`/${locale}/${prefix}/${project.slug}/${tasks}`);
    await expect(page.locator("#task-title")).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await page.evaluate(value => { document.documentElement.classList.toggle("dark", value === "dark"); }, theme);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('input[type="radio"][value="CRITICAL"]').locator("..").click();
      await page.locator('input[type="radio"][value="pool"]').locator("..").click();
      await page.locator('input[type="radio"][value="pool"]').locator("..").scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`mobile-${locale}-${theme}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
