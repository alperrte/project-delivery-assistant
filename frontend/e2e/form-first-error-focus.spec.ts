import { expect, test, type Page } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";
import { api, chooseDate, chooseTime, createProject } from "./helpers";
import tr from "../src/i18n/messages/tr.json";

test.use({ storageState: MANAGER_STORAGE });

// Submitting a form with errors must put the keyboard focus on the first invalid field.
// The submit button is clicked (so focus starts on the button) with the leading field left empty.

const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text }).first();

/** Same three fields on the account page and on /change-password: current → new → confirmation. */
async function expectPasswordFocusOrder(page: Page) {
  const cp = tr.changePassword;
  const submit = page.getByRole("button", { name: cp.submit, exact: true });
  const current = page.getByLabel(cp.currentPassword, { exact: true });
  const next = page.getByLabel(cp.newPassword, { exact: true });
  const confirm = page.getByLabel(cp.confirmNewPassword, { exact: true });

  await submit.click();
  await expect(alertWith(page, tr.validation.required).first()).toBeVisible();
  await expect(current).toBeFocused();

  await current.fill("Gecerli-Parola-1");
  await submit.click();
  await expect(alertWith(page, tr.validation.passwordMin)).toBeVisible();
  await expect(next).toBeFocused();

  await next.fill("Yeni-Parola-12345");
  await confirm.fill("Farkli-Parola-12345");
  await submit.click();
  await expect(alertWith(page, tr.validation.passwordMatch)).toBeVisible();
  await expect(confirm).toBeFocused();
}

test.describe.serial("İlk hataya yönlendirme: giriş gerektiren formlar", () => {
  let page: Page;
  let slug: string;
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STORAGE });
    page = await context.newPage();
    slug = await createProject(page, `Focus Forms ${Date.now()}`);
    projectId = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
  });

  test.afterAll(async () => {
    expect((await api(page, "DELETE", `/projects/${projectId}`)).status).toBe(204);
    await page.context().close();
  });

  test("yeni ekip: ad boşken ad alanı odaklanır", async () => {
    await page.goto(`/projects/${slug}/teams/new`);
    await page.locator('form button[type="submit"]').click();
    await expect(alertWith(page, tr.validation.required)).toBeVisible();
    await expect(page.locator("#team-name")).toBeFocused();
  });

  test("yeni organizasyon: ad boşken ad alanı odaklanır", async () => {
    await page.goto("/organizations/new");
    await page.locator('form button[type="submit"]').click();
    await expect(alertWith(page, tr.validation.required)).toBeVisible();
    await expect(page.locator("#org-name")).toBeFocused();
  });

  test("proje ayarları: ad silinince ad alanı odaklanır", async () => {
    await page.goto(`/projects/${slug}/edit`);
    const form = page.locator("form#project-settings-form");
    const name = form.locator('input[name="name"]');
    const original = await name.inputValue();
    await name.fill("");
    await page.locator('button[type="submit"][form="project-settings-form"], form#project-settings-form button[type="submit"]').first().click();
    await expect(alertWith(page, tr.validation.required)).toBeVisible();
    await expect(name).toBeFocused();
    await name.fill(original);
  });

  test("yeni görev: başlık boşken başlık alanı odaklanır", async () => {
    await page.goto(`/projects/${slug}/tasks/new`);
    await page.locator('form button[type="submit"]').click();
    await expect(alertWith(page, tr.validation.required)).toBeVisible();
    await expect(page.locator("#task-title")).toBeFocused();
  });

  test("yeni kriter: başlık boşken başlık alanı odaklanır", async () => {
    await page.goto(`/projects/${slug}/criteria`);
    await page.getByRole("link", { name: tr.criteria.create }).first().click();
    await expect(page).toHaveURL(/\/tr\/projeler\/[^/]+\/kriterler\/yeni$/);
    await page.locator('form button[type="submit"]').click();
    await expect(alertWith(page, tr.validation.required)).toBeVisible();
    await expect(page.locator("#criterion-title")).toBeFocused();
  });

  test("etiket penceresi: ad boşken ad alanı odaklanır", async () => {
    await page.goto(`/projects/${slug}/labels`);
    await page.getByRole("button", { name: tr.labels.create }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('button[type="submit"]').click();
    await expect(alertWith(page, tr.validation.required)).toBeVisible();
    await expect(dialog.locator("#label-name")).toBeFocused();
  });

  test("proje ayarları: hedef bitiş başlangıçtan önceyse bitiş tarihi odaklanır", async () => {
    await page.goto(`/projects/${slug}/edit`);
    await chooseDate(page, "settings-start", "2030-06-10");
    await chooseDate(page, "settings-end", "2030-06-05");
    await expect(alertWith(page, tr.validation.dateOrder)).toBeVisible();
    await page.locator('button[type="submit"][form="project-settings-form"], form#project-settings-form button[type="submit"]').first().click();
    await expect(page.locator("#settings-end")).toBeFocused();
  });

  test("yeni görev: son tarih başlangıçtan önceyse son tarih alanı odaklanır", async () => {
    await page.goto(`/projects/${slug}/tasks/new`);
    await page.locator("#task-title").fill("Tarih sırası görevi");
    await chooseDate(page, "task-start", "2030-06-10");
    await chooseDate(page, "task-deadline-date", "2030-06-05");
    await page.locator('form button[type="submit"]').click();
    await expect(alertWith(page, tr.validation.taskDateOrder)).toBeVisible();
    await expect(page.locator("#task-deadline-date")).toBeFocused();
  });

  test("yeni gelişmiş görev: tarihsiz saat girilince son tarih alanı odaklanır", async () => {
    await page.goto(`/projects/${slug}/tasks/new`);
    await page.locator("#task-title").fill("Saat tarih görevi");
    await page.getByRole("button", { name: "Gelişmiş görev", exact: true }).click();
    const switchDialog = page.getByRole("dialog");
    // The explanation only shows until the person suppresses it, so it may or may not appear.
    if (await switchDialog.isVisible().catch(() => false)) await switchDialog.getByRole("button", { name: "Geçiş yap", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await chooseTime(page, "task-deadline-time", "10:30");
    await page.locator('form button[type="submit"]').click();
    await expect(alertWith(page, tr.validation.timeNeedsDate)).toBeVisible();
    await expect(page.locator("#task-deadline-date")).toBeFocused();
  });

  test("süre kaydı penceresi: boş süre ve silinen tarih için hata ilgili alana odaklanır", async () => {
    const task = (await api(page, "POST", `/projects/${projectId}/tasks`, { title: "Süre kaydı görevi", priority: "LOW", creationMode: "ADVANCED" })).json as { id: string };
    await page.goto(`/projects/${slug}/tasks/${task.id}`);
    await page.getByRole("button", { name: tr.tasks.detail.time.log }).first().click();
    const dialog = page.getByRole("dialog");
    const minutes = dialog.getByLabel(tr.tasks.detail.time.dialog.minutes, { exact: true });

    await dialog.locator('button[type="submit"]').click();
    await expect(alertWith(page, tr.validation.worklogRange)).toBeVisible();
    await expect(minutes).toBeFocused();
    await expect(minutes).toHaveAttribute("aria-invalid", "true");

    await dialog.getByLabel(tr.tasks.detail.time.dialog.hours, { exact: true }).fill("1");
    // The date is a picker now: open it and use its Clear button to remove the date.
    await dialog.locator("#worklog-date").click();
    await page.locator("#worklog-date-calendar").getByRole("button", { name: "Temizle" }).click();
    await expect(page.locator("#worklog-date-calendar")).toHaveCount(0);
    await dialog.locator('button[type="submit"]').click();
    await expect(alertWith(page, tr.validation.required)).toBeVisible();
    await expect(dialog.locator("#worklog-date")).toBeFocused();
  });

  test("engel penceresi: neden boş bırakılabilir, hata durumu yoktur", async () => {
    // The reason is optional and the textarea stops typing at its limit, so this dialog has no invalid state to focus.
    const task = (await api(page, "POST", `/projects/${projectId}/tasks`, { title: "Engel görevi", priority: "LOW", creationMode: "ADVANCED" })).json as { id: string };
    await page.goto(`/projects/${slug}/tasks/${task.id}`);
    await page.getByRole("button", { name: tr.tasks.detail.panel.block }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("#block-reason")).toBeFocused();
    await dialog.locator("#block-reason").fill("   ");
    await dialog.getByRole("button", { name: tr.tasks.detail.panel.blockDialog.confirm }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: tr.validation.required })).toHaveCount(0);
  });

  test("hesap sayfası, güvenlik: şifre alanları sırayla odaklanır", async () => {
    await page.goto("/account");
    await expectPasswordFocusOrder(page);
  });

  test("şifre değiştir sayfası: şifre alanları sırayla odaklanır", async () => {
    await page.goto("/change-password");
    await expectPasswordFocusOrder(page);
  });

  test("yeni sprint: ad boşken ad alanı odaklanır", async () => {
    await page.goto(`/projects/${slug}/sprints`);
    await page.getByRole("link", { name: tr.sprints.create }).first().click();
    await expect(page).toHaveURL(/\/tr\/projeler\/[^/]+\/sprintler\/yeni$/);
    await page.locator('form button[type="submit"]').click();
    await expect(alertWith(page, tr.validation.required)).toBeVisible();
    await expect(page.locator("#sprint-name")).toBeFocused();
  });
});
