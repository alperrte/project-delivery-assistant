import { expect, test, type Locator, type Page } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";
import { api, createProject } from "./helpers";
import tr from "../src/i18n/messages/tr.json";

test.use({ storageState: MANAGER_STORAGE });

// Loading state: while a form is being sent the submit button is disabled and shows a spinner, and once the answer
// arrives the form is usable again. The server answer is held back and then replaced by a 500, so nothing is created
// and the "after" state (form back to normal, typed data kept) is checked as well.

const HOLD_MS = 1500;

type Hold = { method: string; url: RegExp };

/** Holds the matching request for HOLD_MS, then answers 500. Returns a counter of how many such requests were sent. */
async function hold(page: Page, { method, url }: Hold) {
  const seen = { count: 0 };
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.continue();
    seen.count += 1;
    await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR" }) });
  });
  return seen;
}

async function expectLoadingThenIdle(submit: Locator, seen: { count: number }) {
  await expect(submit).toBeDisabled();
  await expect(submit.locator("svg.animate-spin")).toBeVisible();
  await expect.poll(() => seen.count).toBe(1);
  // The answer (500) arrives: spinner gone, button usable again so the person can retry.
  await expect(submit).toBeEnabled({ timeout: HOLD_MS * 4 });
  await expect(submit.locator("svg.animate-spin")).toHaveCount(0);
  expect(seen.count).toBe(1);
}

const formSubmit = (page: Page) => page.locator('button[type="submit"][form="project-settings-form"], form button[type="submit"]').first();

test.describe.serial("Yükleniyor durumu: giriş gerektiren formlar", () => {
  let page: Page;
  let slug: string;
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    slug = await createProject(page, `Loading State ${Date.now()}`);
    projectId = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
  });

  test.afterAll(async () => {
    expect((await api(page, "DELETE", `/projects/${projectId}`)).status).toBe(204);
    await page.context().close();
  });

  test.afterEach(async () => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("yeni proje", async () => {
    const seen = await hold(page, { method: "POST", url: /\/api\/v1\/projects$/ });
    await page.goto("/projects/new");
    await page.locator("#project-name").fill("Yükleniyor projesi");
    await page.getByRole("radio", { name: /^Web/ }).click();
    const submit = page.getByRole("button", { name: /^Projeyi oluştur$/ });
    await submit.click();
    await expectLoadingThenIdle(submit, seen);
    await expect(page.locator("#project-name")).toHaveValue("Yükleniyor projesi");
  });

  test("proje ayarları", async () => {
    const seen = await hold(page, { method: "PUT", url: new RegExp(`/api/v1/projects/${projectId}$`) });
    await page.goto(`/projects/${slug}/edit`);
    const name = page.locator("form#project-settings-form").locator('input[name="name"]');
    await name.fill(`${await name.inputValue()} v2`);
    const submit = formSubmit(page);
    await submit.click();
    await expectLoadingThenIdle(submit, seen);
  });

  test("yeni görev", async () => {
    const seen = await hold(page, { method: "POST", url: new RegExp(`/projects/${projectId}/tasks$`) });
    await page.goto(`/projects/${slug}/tasks/new`);
    await page.locator("#task-title").fill("Yükleniyor görevi");
    const submit = formSubmit(page);
    await submit.click();
    await expectLoadingThenIdle(submit, seen);
    await expect(page.locator("#task-title")).toHaveValue("Yükleniyor görevi");
  });

  test("yeni ekip", async () => {
    const seen = await hold(page, { method: "POST", url: new RegExp(`/projects/${projectId}/teams$`) });
    await page.goto(`/projects/${slug}/teams/new`);
    await page.locator("#team-name").fill("Yükleniyor ekibi");
    const submit = formSubmit(page);
    await submit.click();
    await expectLoadingThenIdle(submit, seen);
  });

  test("yeni organizasyon", async () => {
    const seen = await hold(page, { method: "POST", url: /\/api\/v1\/organizations$/ });
    await page.goto("/organizations/new");
    await page.locator("#org-name").fill("Yükleniyor organizasyonu");
    const submit = formSubmit(page);
    await submit.click();
    await expectLoadingThenIdle(submit, seen);
  });

  test("yeni anımsatıcı", async () => {
    const seen = await hold(page, { method: "POST", url: /\/reminders$/ });
    await page.goto("/calendar");
    await page.getByRole("link", { name: "Anımsatıcı oluştur" }).click();
    await expect(page).toHaveURL(/\/tr\/takvim\/yeni-animsatici\?date=/);
    await page.getByLabel("Anımsatıcı adı").fill("Yükleniyor anımsatıcısı");
    await page.getByRole("combobox", { name: "Anımsatıcı türü" }).click();
    await page.getByRole("option").first().click();
    const submit = page.getByRole("button", { name: /^Oluştur$/ });
    await submit.click();
    await expectLoadingThenIdle(submit, seen);
  });

  test("kriter penceresi", async () => {
    const seen = await hold(page, { method: "POST", url: new RegExp(`/projects/${projectId}/criteria$`) });
    await page.goto(`/projects/${slug}/criteria`);
    await page.getByRole("button", { name: tr.criteria.create }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#criterion-title").fill("Yükleniyor kriteri");
    const submit = dialog.locator('button[type="submit"]');
    await submit.click();
    await expectLoadingThenIdle(submit, seen);
  });

  test("etiket penceresi", async () => {
    const seen = await hold(page, { method: "POST", url: new RegExp(`/projects/${projectId}/labels$`) });
    await page.goto(`/projects/${slug}/labels`);
    await page.getByRole("button", { name: tr.labels.create }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#label-name").fill("Yükleniyor");
    const submit = dialog.locator('button[type="submit"]');
    await submit.click();
    await expectLoadingThenIdle(submit, seen);
  });

  test("sprint penceresi", async () => {
    const seen = await hold(page, { method: "POST", url: new RegExp(`/projects/${projectId}/sprints$`) });
    await page.goto(`/projects/${slug}/sprints`);
    await page.getByRole("button", { name: tr.sprints.create }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#sprint-name").fill("Yükleniyor sprinti");
    const submit = dialog.locator('button[type="submit"]');
    await submit.click();
    await expectLoadingThenIdle(submit, seen);
  });

  test("süre kaydı ve engel penceresi", async () => {
    const task = (await api(page, "POST", `/projects/${projectId}/tasks`, { title: "Yükleniyor süre görevi", priority: "LOW", creationMode: "ADVANCED" })).json as { id: string };
    await page.goto(`/projects/${slug}/tasks/${task.id}`);

    const worklog = await hold(page, { method: "POST", url: /\/worklogs$/ });
    await page.getByRole("button", { name: tr.tasks.detail.time.log }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(tr.tasks.detail.time.dialog.minutes, { exact: true }).fill("30");
    let submit = dialog.locator('button[type="submit"]');
    await submit.click();
    await expectLoadingThenIdle(submit, worklog);
    await dialog.getByRole("button", { name: tr.tasks.detail.time.dialog.cancel }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const block = await hold(page, { method: "PATCH", url: /\/blocked$/ });
    await page.getByRole("button", { name: tr.tasks.detail.panel.block }).first().click();
    dialog = page.getByRole("dialog");
    submit = dialog.getByRole("button", { name: tr.tasks.detail.panel.blockDialog.confirm });
    await submit.click();
    await expectLoadingThenIdle(submit, block);
  });

  test("şifre değiştirme (hesap sayfası)", async () => {
    const seen = await hold(page, { method: "POST", url: /\/auth\/password\/change$/ });
    await page.goto("/account");
    await page.waitForLoadState("networkidle");
    await page.getByLabel(tr.changePassword.currentPassword, { exact: true }).fill("Gecerli-Parola-1");
    await page.getByLabel(tr.changePassword.newPassword, { exact: true }).fill("Yeni-Parola-12345");
    await page.getByLabel(tr.changePassword.confirmNewPassword, { exact: true }).fill("Yeni-Parola-12345");
    // The button text changes to "Güncelleniyor..." while sending, so it is found by position, not by name.
    const submit = page.locator("form:has(input[autocomplete=\"current-password\"]) button[type=\"submit\"]");
    await submit.click();
    await expectLoadingThenIdle(submit, seen);
  });
});
