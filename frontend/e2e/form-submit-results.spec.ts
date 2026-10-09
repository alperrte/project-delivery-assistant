import { expect, test, type Locator, type Page } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";
import { REJECTED_STATE } from "./consent-state";
import { api, createProject, login, uniqueUser } from "./helpers";
import tr from "../src/i18n/messages/tr.json";

test.use({ storageState: MANAGER_STORAGE });

// What happens after a form is sent, for every authenticated form:
//  - double submit: a double click and a double Enter reach the server once;
//  - error state: a refused request (500) and a lost connection show a message, keep the typed data and unlock the form;
//  - success state: a real request succeeds and the person sees the result.
// Failures are produced in the browser (route), so nothing is created by the failing runs. Successful runs create real
// records; the ones that live outside the test project are removed again.

const HOLD_MS = 1500;
const toast = (page: Page, type: "success" | "error") => page.locator(`[data-sonner-toast][data-type="${type}"]`);
const errorNotice = (page: Page, text: string) => page.locator('[data-sonner-toast][data-type="error"], [role="alert"]').filter({ hasText: text }).first();

type Ctx = { slug: string; projectId: string };
type Opened = { submit: Locator; field: Locator | null; enter: boolean };
type Created = { json: { id?: string } | null; url: string };
type Scenario = {
  name: string;
  method: string;
  url: (c: Ctx) => RegExp;
  dialog?: boolean;
  /** Success is answered by a stub (204) because a real success would change the account used by the other tests. */
  stubSuccess?: number;
  open: (page: Page, c: Ctx) => Promise<Opened>;
  expectSuccess: (page: Page, c: Ctx, opened: Opened) => Promise<void>;
  cleanup?: (page: Page, created: Created) => Promise<void>;
};

type Mode = { kind: "hold" } | { kind: "status"; status: number } | { kind: "abort" } | { kind: "stub"; status: number } | { kind: "pass" };

/** Answers the form's request according to `mode` and counts how many such requests were sent. */
async function intercept(page: Page, sc: Scenario, c: Ctx, mode: Mode) {
  const seen = { count: 0 };
  await page.route(sc.url(c), async (route) => {
    if (route.request().method() !== sc.method) return route.continue();
    seen.count += 1;
    switch (mode.kind) {
      case "hold":
        await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
        return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR" }) });
      case "status":
        return route.fulfill({ status: mode.status, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR" }) });
      case "abort":
        return route.abort("connectionfailed");
      case "stub":
        return route.fulfill({ status: mode.status });
      default:
        return route.continue();
    }
  });
  return seen;
}

const newTask = async (page: Page, c: Ctx, title: string) =>
  (await api(page, "POST", `/projects/${c.projectId}/tasks`, { title, priority: "LOW", creationMode: "ADVANCED" })).json as { id: string };

const scenarios: Scenario[] = [
  {
    name: "yeni proje",
    method: "POST",
    url: () => /\/api\/v1\/projects$/,
    async open(page) {
      await page.goto("/projects/new");
      const field = page.locator("#project-name");
      await field.fill(`Sonuç projesi ${Date.now()}`);
      await page.getByRole("radio", { name: /^Web/ }).click();
      return { submit: page.getByRole("button", { name: /^Projeyi oluştur$/ }), field, enter: true };
    },
    async expectSuccess(page) {
      await expect(toast(page, "success")).toBeVisible();
      await expect(page.getByRole("dialog").filter({ hasText: "Henüz bir proje ekibiniz yok" })).toBeVisible();
    },
    async cleanup(page, created) {
      expect((await api(page, "DELETE", `/projects/${created.json?.id}`)).status).toBe(204);
    },
  },
  {
    name: "proje ayarları",
    method: "PUT",
    url: (c) => new RegExp(`/api/v1/projects/${c.projectId}$`),
    async open(page, c) {
      await page.goto(`/projects/${c.slug}/edit`);
      const field = page.locator("form#project-settings-form").locator('input[name="name"]');
      await field.fill(`Sonuç ayarı ${Date.now()}`);
      return { submit: page.locator('button[type="submit"][form="project-settings-form"], form#project-settings-form button[type="submit"]').first(), field, enter: true };
    },
    async expectSuccess(page, _c, opened) {
      await expect(toast(page, "success")).toBeVisible();
      await expect(opened.field!).not.toHaveValue("");
    },
  },
  {
    name: "yeni görev",
    method: "POST",
    url: (c) => new RegExp(`/projects/${c.projectId}/tasks$`),
    async open(page, c) {
      await page.goto(`/projects/${c.slug}/tasks/new`);
      const field = page.locator("#task-title");
      await field.fill(`Sonuç görevi ${Date.now()}`);
      return { submit: page.locator('form button[type="submit"]').first(), field, enter: true };
    },
    async expectSuccess(page) {
      await expect(toast(page, "success")).toBeVisible();
      await expect(page).toHaveURL(/\/tr\/projeler\/[^/]+\/gorevler\/[^/]+/, { timeout: 15_000 });
    },
  },
  {
    name: "yeni ekip",
    method: "POST",
    url: (c) => new RegExp(`/projects/${c.projectId}/teams$`),
    async open(page, c) {
      await page.goto(`/projects/${c.slug}/teams/new`);
      const field = page.locator("#team-name");
      await field.fill(`Sonuç ekibi ${Date.now()}`);
      return { submit: page.locator('form button[type="submit"]').first(), field, enter: true };
    },
    async expectSuccess(page) {
      await expect(toast(page, "success")).toBeVisible();
      await expect(page).toHaveURL(/\/tr\/projeler\/[^/]+\/ekipler\/[^/]+/, { timeout: 15_000 });
    },
  },
  {
    name: "yeni organizasyon",
    method: "POST",
    url: () => /\/api\/v1\/organizations$/,
    async open(page) {
      await page.goto("/organizations/new");
      const field = page.locator("#org-name");
      await field.fill(`Sonuç organizasyonu ${Date.now()}`);
      return { submit: page.locator('form button[type="submit"]').first(), field, enter: true };
    },
    async expectSuccess(page) {
      await expect(toast(page, "success")).toBeVisible();
      await expect(page).toHaveURL(/\/organizations\/[^/]+$|\/organizasyonlar\/[^/]+$/, { timeout: 15_000 });
    },
    async cleanup(page, created) {
      expect((await api(page, "POST", `/organizations/${created.json?.id}/archive`)).status).toBeLessThan(300);
    },
  },
  {
    name: "yeni anımsatıcı",
    method: "POST",
    url: () => /\/reminders$/,
    async open(page) {
      await page.goto("/calendar");
      await page.getByRole("link", { name: "Anımsatıcı oluştur" }).click();
      await expect(page).toHaveURL(/\/tr\/takvim\/yeni-animsatici\?date=/);
      const field = page.getByLabel("Anımsatıcı adı");
      await field.fill(`Sonuç anımsatıcısı ${Date.now()}`);
      await page.getByRole("combobox", { name: "Anımsatıcı türü" }).click();
      await page.getByRole("option").first().click();
      return { submit: page.getByRole("button", { name: /^Oluştur$/ }), field, enter: true };
    },
    async expectSuccess(page) {
      await expect(toast(page, "success")).toBeVisible();
      await expect(page).toHaveURL(/\/tr\/takvim(\?|$)/, { timeout: 15_000 });
    },
    async cleanup(page, created) {
      const projectId = /\/projects\/([^/]+)\/reminders/.exec(created.url)?.[1];
      expect((await api(page, "DELETE", `/projects/${projectId}/reminders/${created.json?.id}`)).status).toBe(204);
    },
  },
  {
    name: "kriter penceresi",
    method: "POST",
    dialog: true,
    url: (c) => new RegExp(`/projects/${c.projectId}/criteria$`),
    async open(page, c) {
      await page.goto(`/projects/${c.slug}/criteria`);
      await page.getByRole("button", { name: tr.criteria.create }).first().click();
      const dialog = page.getByRole("dialog");
      const field = dialog.locator("#criterion-title");
      await field.fill(`Sonuç kriteri ${Date.now()}`);
      return { submit: dialog.locator('button[type="submit"]'), field, enter: true };
    },
    async expectSuccess(page) {
      await expect(toast(page, "success")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    },
  },
  {
    name: "etiket penceresi",
    method: "POST",
    dialog: true,
    url: (c) => new RegExp(`/projects/${c.projectId}/labels$`),
    async open(page, c) {
      await page.goto(`/projects/${c.slug}/labels`);
      await page.getByRole("button", { name: tr.labels.create }).first().click();
      const dialog = page.getByRole("dialog");
      const field = dialog.locator("#label-name");
      await field.fill(`Sonuç ${Date.now() % 100000}`);
      return { submit: dialog.locator('button[type="submit"]'), field, enter: true };
    },
    async expectSuccess(page) {
      await expect(toast(page, "success")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    },
  },
  {
    name: "sprint penceresi",
    method: "POST",
    dialog: true,
    url: (c) => new RegExp(`/projects/${c.projectId}/sprints$`),
    async open(page, c) {
      await page.goto(`/projects/${c.slug}/sprints`);
      await page.getByRole("button", { name: tr.sprints.create }).first().click();
      const dialog = page.getByRole("dialog");
      const field = dialog.locator("#sprint-name");
      await field.fill(`Sonuç sprinti ${Date.now()}`);
      return { submit: dialog.locator('button[type="submit"]'), field, enter: true };
    },
    async expectSuccess(page) {
      await expect(toast(page, "success")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    },
  },
  {
    name: "süre kaydı penceresi",
    method: "POST",
    dialog: true,
    url: () => /\/worklogs$/,
    async open(page, c) {
      const task = await newTask(page, c, `Süre sonucu ${Date.now()}`);
      await page.goto(`/projects/${c.slug}/tasks/${task.id}`);
      await page.getByRole("button", { name: tr.tasks.detail.time.log }).first().click();
      const dialog = page.getByRole("dialog");
      const field = dialog.getByLabel(tr.tasks.detail.time.dialog.minutes, { exact: true });
      await field.fill("30");
      return { submit: dialog.locator('button[type="submit"]'), field, enter: true };
    },
    async expectSuccess(page) {
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /kaydı sil$/ })).toBeVisible();
    },
  },
  {
    name: "engel penceresi",
    method: "PATCH",
    dialog: true,
    url: () => /\/blocked$/,
    async open(page, c) {
      const task = await newTask(page, c, `Engel sonucu ${Date.now()}`);
      await page.goto(`/projects/${c.slug}/tasks/${task.id}`);
      await page.getByRole("button", { name: tr.tasks.detail.panel.block }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("#block-reason").fill("Sonuç testi");
      // The reason is a textarea, so Enter would only add a line; double Enter is checked with the other forms.
      return { submit: dialog.getByRole("button", { name: tr.tasks.detail.panel.blockDialog.confirm }), field: dialog.locator("#block-reason"), enter: false };
    },
    async expectSuccess(page) {
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText(tr.tasks.detail.panel.unblock).first()).toBeVisible();
    },
  },
  {
    name: "şifre değiştirme (hesap sayfası)",
    method: "POST",
    stubSuccess: 204,
    url: () => /\/auth\/password\/change$/,
    async open(page) {
      await page.goto("/account");
      await page.waitForLoadState("networkidle");
      const field = page.getByLabel(tr.changePassword.currentPassword, { exact: true });
      await field.fill("Gecerli-Parola-1");
      await page.getByLabel(tr.changePassword.newPassword, { exact: true }).fill("Yeni-Parola-12345");
      await page.getByLabel(tr.changePassword.confirmNewPassword, { exact: true }).fill("Yeni-Parola-12345");
      // The button text changes while sending, so the form's own button is found by position.
      return { submit: page.locator('form:has(input[autocomplete="current-password"]) button[type="submit"]'), field, enter: true };
    },
    async expectSuccess(page, _c, opened) {
      await expect(toast(page, "success")).toBeVisible();
      await expect(opened.field!).toHaveValue("");
    },
  },
];

test.describe.serial("Gönderim sonuçları: giriş gerektiren formlar", () => {
  let page: Page;
  const ctx: Ctx = { slug: "", projectId: "" };

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    ctx.slug = await createProject(page, `Submit Results ${Date.now()}`);
    ctx.projectId = ((await api(page, "GET", `/projects/by-slug/${ctx.slug}`)).json as { id: string }).id;
  });

  test.afterAll(async () => {
    expect((await api(page, "DELETE", `/projects/${ctx.projectId}`)).status).toBe(204);
    await page.context().close();
  });

  test.afterEach(async () => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  for (const sc of scenarios) {
    test(`${sc.name}: çift tıklama ve çift Enter sunucuya tek istek gönderir`, async () => {
      const seen = await intercept(page, sc, ctx, { kind: "hold" });
      const { submit, field, enter } = await sc.open(page, ctx);

      await submit.dblclick();
      await expect.poll(() => seen.count).toBe(1);
      await expect(submit).toBeEnabled({ timeout: HOLD_MS * 4 });
      expect(seen.count, "çift tıklama tek istek olmalı").toBe(1);

      if (enter && field) {
        await field.focus();
        await page.keyboard.press("Enter");
        await page.keyboard.press("Enter");
        await expect.poll(() => seen.count).toBe(2);
        await expect(submit).toBeEnabled({ timeout: HOLD_MS * 4 });
        expect(seen.count, "çift Enter tek ek istek olmalı").toBe(2);
      }
    });

    test(`${sc.name}: sunucu hatası ve bağlantı kesintisi mesaj gösterir, veri kalır, form açılır`, async () => {
      const { submit, field } = await sc.open(page, ctx);
      const typed = field ? await field.inputValue() : "";

      const refused = await intercept(page, sc, ctx, { kind: "status", status: 500 });
      await submit.click();
      await expect(errorNotice(page, tr.errors.generic)).toBeVisible();
      await expect(submit).toBeEnabled();
      expect(refused.count).toBe(1);

      await page.unrouteAll({ behavior: "ignoreErrors" });
      const lost = await intercept(page, sc, ctx, { kind: "abort" });
      await submit.click();
      await expect(errorNotice(page, tr.errors.network)).toBeVisible();
      await expect(submit).toBeEnabled();
      expect(lost.count).toBe(1);

      if (field) await expect(field).toHaveValue(typed);
      if (sc.dialog) await expect(page.getByRole("dialog")).toBeVisible();
    });

    test(`${sc.name}: başarılı gönderim sonucu gösterir`, async () => {
      const mode: Mode = sc.stubSuccess ? { kind: "stub", status: sc.stubSuccess } : { kind: "pass" };
      const seen = await intercept(page, sc, ctx, mode);
      const opened = await sc.open(page, ctx);
      const answered = page.waitForResponse((r) => r.request().method() === sc.method && sc.url(ctx).test(r.url()));

      await opened.submit.click();
      const response = await answered;
      expect(response.status(), "başarılı olmalı").toBeLessThan(300);
      await sc.expectSuccess(page, ctx, opened);
      expect(seen.count).toBe(1);

      if (sc.cleanup) {
        const json = (await response.json().catch(() => null)) as Created["json"];
        await sc.cleanup(page, { json, url: response.url() });
      }
    });
  }

  test("sunucu durum kodları, görev formunda doğru mesaja çevrilir", async () => {
    const sc = scenarios.find((s) => s.name === "yeni görev")!;
    const cases: [number, string][] = [
      [400, tr.errors.invalidFields],
      [403, tr.errors.forbidden],
      [404, tr.errors.notFound],
      [409, tr.errors.conflict],
      [429, tr.errors.tooManyRequests],
      [500, tr.errors.generic],
    ];
    const { submit } = await sc.open(page, ctx);
    for (const [status, message] of cases) {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await intercept(page, sc, ctx, { kind: "status", status });
      await submit.click();
      await expect(errorNotice(page, message), `${status} → ${message}`).toBeVisible();
      await expect(submit).toBeEnabled();
    }
  });

  test("gerçek bağlantı kesintisi (tarayıcı çevrimdışı): proje ayarları mesaj gösterir, bağlantı gelince aynı form kaydeder", async () => {
    const sc = scenarios.find((s) => s.name === "proje ayarları")!;
    const { submit, field } = await sc.open(page, ctx);
    const typed = await field!.inputValue();

    await page.context().setOffline(true);
    try {
      await submit.click();
      await expect(errorNotice(page, tr.errors.network)).toBeVisible();
      await expect(submit).toBeEnabled();
      await expect(field!).toHaveValue(typed);
    } finally {
      await page.context().setOffline(false);
    }

    await submit.click();
    await expect(toast(page, "success")).toBeVisible();
    await expect(field!).toHaveValue(typed);
  });

  test("gerçek bağlantı kesintisi (tarayıcı çevrimdışı): yeni görev yazılanları korur, bağlantı gelince oluşur", async () => {
    const sc = scenarios.find((s) => s.name === "yeni görev")!;
    const { submit, field } = await sc.open(page, ctx);
    const typed = await field!.inputValue();

    await page.context().setOffline(true);
    try {
      await submit.click();
      await expect(errorNotice(page, tr.errors.network)).toBeVisible();
      await expect(field!).toHaveValue(typed);
    } finally {
      await page.context().setOffline(false);
    }

    await submit.click();
    await expect(page).toHaveURL(/\/tr\/projeler\/[^/]+\/gorevler\/[^/]+/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: typed })).toBeVisible();
  });
});

test.describe("Gönderim sonuçları: kayıt ve giriş (gerçek sunucu)", () => {
  test.use({ storageState: REJECTED_STATE });

  test("kayıt başarılı olunca karşılama mesajı çıkar ve uygulama açılır; aynı hesapla giriş de başarılı olur", async ({ page, browser }) => {
    const user = uniqueUser("result");
    await page.goto("/register");
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="nickname"]').fill(user.nickname);
    await page.locator('input[name="password"]').fill(user.password);
    await page.locator('input[name="confirmPassword"]').fill(user.password);
    await page.getByRole("button", { name: /^Kayıt ol$/ }).click();
    await expect(toast(page, "success")).toBeVisible();
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 15_000 });

    const fresh = await (await browser.newContext({ storageState: REJECTED_STATE })).newPage();
    await login(fresh, user.email, user.password);
    await expect(fresh).toHaveURL(/\/tr\/genel-bakis/);
    await fresh.context().close();
  });

  test("giriş: yanlış şifre hata mesajı gösterir, e-posta yerinde kalır, form açılır", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("olmayan-kisi@example.test");
    await page.locator('input[name="password"]').fill("Yanlis-Parola-123");
    const submit = page.locator('form button[type="submit"]').first();
    await submit.click();
    await expect(errorNotice(page, tr.errors.invalidCredentials)).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect(page.locator('input[name="email"]')).toHaveValue("olmayan-kisi@example.test");
  });
});
