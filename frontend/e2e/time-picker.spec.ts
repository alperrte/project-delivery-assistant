import { test, expect, type Page } from "@playwright/test";
import { api, chooseDate, chooseTime, createProject } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE, timezoneId: "Europe/Istanbul" });

/** The browser's own local today and yesterday, so the test follows the same clock as the page. */
async function localDays(page: Page) {
  return page.evaluate(() => {
    const p = (n: number) => String(n).padStart(2, "0");
    const k = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    return { today: k(today), yesterday: k(yesterday) };
  });
}

async function fixture(page: Page, mode: "SIMPLE" | "ADVANCED" | "BOTH" = "BOTH") {
  const slug = await createProject(page, `Time picker ${Date.now()}`, { taskMode: mode });
  const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string };
  return { slug, id: project.id };
}

async function openNewReminder(page: Page, slug: string) {
  await page.goto(`/projects/${slug}`);
  await page.goto("/calendar/new");
  await expect(page.locator("#reminder-time")).toBeVisible();
}

test("a reminder created with the date and time pickers persists the exact chosen values", async ({ page }) => {
  const project = await fixture(page);
  await openNewReminder(page, project.slug);
  const date = "2030-06-15";
  await page.getByLabel("Anımsatıcı adı").fill("Picker reminder");
  await page.getByRole("combobox", { name: "Anımsatıcı türü" }).click();
  await page.getByRole("option", { name: "Toplantı" }).click();
  await chooseDate(page, "reminder-date", date);
  await chooseTime(page, "reminder-time", "09:30");
  await expect(page.locator("#reminder-time")).toContainText("09:30");
  await page.getByRole("button", { name: /^Oluştur$/ }).click();
  await expect(page.getByText("Anımsatıcı oluşturuldu.")).toBeVisible();

  const result = await api(page, "GET", `/projects/${project.id}/reminders?from=${date}&to=${date}`);
  expect(result.status).toBe(200);
  const reminders = (result.json as { title: string; date: string; time: string | null }[]).filter(r => r.title === "Picker reminder");
  expect(reminders).toHaveLength(1);
  expect(reminders[0].date).toBe(date);
  expect(reminders[0].time?.startsWith("09:30")).toBe(true);
});

test("the reminder form shows the date error through the picker and links it with aria-describedby", async ({ page }) => {
  const project = await fixture(page);
  await openNewReminder(page, project.slug);
  await page.getByLabel("Anımsatıcı adı").fill("No date");
  await page.getByRole("combobox", { name: "Anımsatıcı türü" }).click();
  await page.getByRole("option", { name: "Toplantı" }).click();
  await page.getByRole("button", { name: /^Oluştur$/ }).click();
  await expect(page.locator("#reminder-date")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#reminder-date")).toHaveAttribute("aria-describedby", "reminder-date-error");
  await expect(page.locator("#reminder-date-error")).toBeVisible();
});

test("TimePicker keyboard: arrows and Enter pick the hour, Escape returns focus, Clear empties the value", async ({ page }) => {
  const project = await fixture(page);
  await openNewReminder(page, project.slug);
  const trigger = page.locator("#reminder-time");
  await expect(trigger).toContainText("Saat seçin");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const panel = page.locator("#reminder-time-time");
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-hour="00"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(panel.locator('[data-hour="02"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText("02:00");
  await page.keyboard.press("ArrowUp");
  await expect(panel.locator('[data-hour="01"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText("01:00");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole("dialog").getByRole("button", { name: "Temizle", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(trigger).toContainText("Saat seçin");
});

test("DatePicker min on create: yesterday is disabled, today is selectable; editing keeps no minimum", async ({ page }) => {
  const project = await fixture(page);
  await openNewReminder(page, project.slug);
  const { today, yesterday } = await localDays(page);
  await page.locator("#reminder-date").click();
  const calendar = page.locator("#reminder-date-calendar");
  await expect(calendar).toBeVisible();
  await expect(calendar.locator(`[data-date="${yesterday}"]`)).toBeDisabled();
  await expect(calendar.locator(`[data-date="${today}"]`)).toBeEnabled();
  await calendar.locator(`[data-date="${today}"]`).click();
  await expect(page.locator("#reminder-date")).not.toContainText("Tarih seçin");

  // Editing has no minimum: an existing reminder keeps working even when its date is already in the past.
  const created = await api(page, "POST", `/projects/${project.id}/reminders`, { title: "Past", type: "MEETING", scope: "PERSONAL", date: today });
  expect(created.status).toBe(201);
  const id = (created.json as { id: string }).id;
  await page.goto(`/calendar/reminders/${id}/edit`);
  await page.locator("#reminder-date").click();
  const editCalendar = page.locator("#reminder-date-calendar");
  await expect(editCalendar.locator(`[data-date="${yesterday}"]`)).toBeEnabled();
});

for (const theme of ["light", "dark"] as const) {
  test(`opening the TimePicker at 390px causes no horizontal overflow (${theme})`, async ({ page }) => {
    const project = await fixture(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await openNewReminder(page, project.slug);
    await page.evaluate(value => document.documentElement.classList.toggle("dark", value === "dark"), theme);
    await page.locator("#reminder-time").click();
    const panel = page.locator("#reminder-time-time");
    await expect(panel).toBeVisible();
    const popup = page.getByRole("dialog", { name: "Saat (isteğe bağlı)" });
    await expect(popup).toBeVisible();
    const box = await popup.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    const overflow = await page.evaluate(() => ({ scroll: document.scrollingElement!.scrollWidth, client: document.scrollingElement!.clientWidth }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  });
}

test("the date pickers work inside the sprint dialog and keep the end date after the start date", async ({ page }) => {
  const project = await fixture(page);
  await page.goto(`/projects/${project.slug}/sprints`);
  await page.getByRole("button", { name: "Sprint oluştur", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Yeni sprint" });
  await expect(dialog).toBeVisible();
  await dialog.locator("#sprint-name").fill("Picker sprint");

  await chooseDate(page, "sprint-start", "2030-02-01");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#sprint-start")).toContainText("2030");
  // The end picker's minimum is the chosen start date.
  await page.locator("#sprint-end").click();
  const endCalendar = page.locator("#sprint-end-calendar");
  await expect(endCalendar).toBeVisible();
  await endCalendar.getByRole("combobox", { name: "Yıl", exact: true }).click();
  await page.getByRole("option", { name: "2030", exact: true }).click();
  await endCalendar.getByRole("combobox", { name: "Ay", exact: true }).click();
  await page.getByRole("option", { name: "Şubat", exact: true }).click();
  await expect(endCalendar.locator('[data-date="2030-01-31"]')).toBeDisabled();
  await expect(endCalendar.locator('[data-date="2030-02-01"]')).toBeEnabled();
  await endCalendar.locator('[data-date="2030-02-14"]').click();
  await expect(endCalendar).toHaveCount(0);
  await expect(dialog).toBeVisible();

  // Moving the start after the end re-validates the end date.
  await chooseDate(page, "sprint-start", "2030-03-01");
  await expect(page.locator("#sprint-end")).toHaveAttribute("aria-invalid", "true");
  await chooseDate(page, "sprint-end", "2030-03-14");
  await expect(page.locator("#sprint-end")).not.toHaveAttribute("aria-invalid", "true");

  const request = page.waitForRequest(r => r.method() === "POST" && r.url().endsWith(`/projects/${project.id}/sprints`));
  await dialog.getByRole("button", { name: "Oluştur", exact: true }).click();
  const payload = (await request).postDataJSON();
  expect(payload).toMatchObject({ name: "Picker sprint", startDate: "2030-03-01", endDate: "2030-03-14" });
  await expect(dialog).toHaveCount(0);
});

test("the work date picker works inside the worklog dialog and cannot pick a future day", async ({ page }) => {
  const project = await fixture(page);
  const me = (await api(page, "GET", "/auth/me")).json as { id: string };
  const created = await api(page, "POST", `/projects/${project.id}/tasks`, {
    title: "Worklog task", priority: "MEDIUM", creationMode: "ADVANCED", assigneeIds: [me.id],
  });
  expect(created.status).toBe(201);
  const task = created.json as { id: string };
  await page.goto(`/projects/${project.slug}/tasks/${task.id}`);
  await page.getByRole("button", { name: "Süre kaydet", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /için süre kaydet/ });
  await expect(dialog).toBeVisible();
  const { today } = await localDays(page);
  await dialog.locator("#worklog-hours").fill("1");
  await dialog.locator("#worklog-date").click();
  const calendar = page.locator("#worklog-date-calendar");
  await expect(calendar).toBeVisible();
  const tomorrow = await page.evaluate(() => {
    const p = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
  await expect(calendar.locator(`[data-date="${tomorrow}"]`)).toBeDisabled();
  await calendar.locator(`[data-date="${today}"]`).click();
  await expect(calendar).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#worklog-date")).toBeFocused();

  const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/tasks/${task.id}/worklogs`));
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  expect((await response).status()).toBe(201);
  await expect(dialog).toHaveCount(0);
});
