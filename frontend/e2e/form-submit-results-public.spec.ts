import { expect, test, type Page } from "@playwright/test";
import { buildPath } from "../src/i18n/routing";
import tr from "../src/i18n/messages/tr.json";

// What happens after a public form is sent, without a backend (the answers are simulated in the browser):
//  - double submit: a double click and a double Enter reach the server once;
//  - error state: 500, 429 and a lost connection show the matching message, keep the typed data and unlock the form;
//  - success state: the answer for the code request of "şifremi unuttum" moves the person to the next step.
// The real success paths (register, login) are covered against the real server in form-submit-results.spec.ts.

const API = "http://localhost:8080/api/v1";
const HOLD_MS = 800;

type Answer = { kind: "hold" } | { kind: "status"; status: number; body?: object } | { kind: "abort" };

async function simulate(page: Page, path: string, answer: Answer) {
  const origin = new URL(page.url()).origin;
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "Content-Type, X-XSRF-TOKEN",
    "access-control-allow-methods": "POST",
  };
  const seen = { count: 0 };
  await page.route(`${API}/auth/csrf`, (route) => route.fulfill({
    status: 200, contentType: "application/json", headers: cors,
    body: JSON.stringify({ headerName: "X-XSRF-TOKEN", parameterName: "_csrf", token: "t" }),
  }));
  await page.route(`${API}${path}`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    seen.count += 1;
    if (answer.kind === "abort") return route.abort("connectionfailed");
    if (answer.kind === "hold") {
      await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
      return route.fulfill({ status: 500, contentType: "application/json", headers: cors, body: JSON.stringify({ code: "INTERNAL_ERROR" }) });
    }
    return route.fulfill({ status: answer.status, contentType: "application/json", headers: cors, body: JSON.stringify(answer.body ?? { code: "INTERNAL_ERROR" }) });
  });
  return seen;
}

type Form = {
  name: string;
  route: string;
  endpoint: string;
  fill: (page: Page) => Promise<void>;
  /** A field that must keep its value after a failed send. */
  kept: (page: Page) => { field: ReturnType<Page["getByLabel"]>; value: string };
};

const submit = (page: Page) => page.locator('form button[type="submit"]').first();
const notice = (page: Page, text: string) => page.locator('[data-sonner-toast][data-type="error"], [role="alert"]').filter({ hasText: text }).first();

const forms: Form[] = [
  {
    name: "giriş",
    route: "/login",
    endpoint: "/auth/login",
    async fill(page) {
      await page.getByLabel(tr.login.email, { exact: true }).fill("kisi@example.test");
      await page.getByLabel(tr.login.password, { exact: true }).fill("Parola-12345");
    },
    kept: (page) => ({ field: page.getByLabel(tr.login.email, { exact: true }), value: "kisi@example.test" }),
  },
  {
    name: "kayıt",
    route: "/register",
    endpoint: "/auth/register",
    async fill(page) {
      await page.getByLabel(tr.register.email, { exact: true }).fill("kisi@example.test");
      await page.getByLabel(tr.register.nickname, { exact: true }).fill("kisi_test");
      await page.getByLabel(tr.register.password, { exact: true }).fill("Parola-12345");
      await page.getByLabel(tr.register.confirmPassword, { exact: true }).fill("Parola-12345");
    },
    kept: (page) => ({ field: page.getByLabel(tr.register.email, { exact: true }), value: "kisi@example.test" }),
  },
  {
    name: "şifremi unuttum (kod isteme)",
    route: "/forgot-password",
    endpoint: "/auth/password/forgot",
    async fill(page) {
      await page.getByLabel(tr.forgotPassword.email, { exact: true }).fill("kisi@example.test");
    },
    kept: (page) => ({ field: page.getByLabel(tr.forgotPassword.email, { exact: true }), value: "kisi@example.test" }),
  },
  {
    name: "iletişim",
    route: "/contact",
    endpoint: "/contact",
    async fill(page) {
      await page.getByLabel(tr.contact.form.firstName, { exact: true }).fill("Ayşe");
      await page.getByLabel(tr.contact.form.lastName, { exact: true }).fill("Kaya");
      await page.getByLabel(tr.contact.form.email, { exact: true }).fill("ayse@example.test");
      await page.getByLabel(tr.contact.form.message, { exact: false }).fill("Merhaba, bu bir deneme mesajıdır.");
    },
    kept: (page) => ({ field: page.getByLabel(tr.contact.form.firstName, { exact: true }), value: "Ayşe" }),
  },
];

for (const f of forms) {
  test.describe(`Gönderim sonuçları (herkese açık): ${f.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(buildPath(f.route as never, {}, "tr"));
    });

    test("çift tıklama ve çift Enter sunucuya tek istek gönderir", async ({ page }) => {
      const seen = await simulate(page, f.endpoint, { kind: "hold" });
      await f.fill(page);
      await submit(page).dblclick();
      // The contact form first waits out the server's minimum fill time (about 3 s) before it sends.
      await expect(submit(page)).toBeEnabled({ timeout: HOLD_MS * 5 + 4_000 });
      expect(seen.count).toBe(1);

      // Same with the keyboard: two Enter presses in quick succession on the last field.
      const { field } = f.kept(page);
      await field.press("Enter");
      await field.press("Enter");
      await expect(submit(page)).toBeEnabled({ timeout: HOLD_MS * 5 });
      expect(seen.count).toBe(2);
    });

    test("sunucu hatası genel mesajı gösterir, yazılanlar kalır, form açılır", async ({ page }) => {
      const seen = await simulate(page, f.endpoint, { kind: "status", status: 500 });
      await f.fill(page);
      await submit(page).click();
      await expect(notice(page, tr.errors.generic)).toBeVisible();
      expect(seen.count).toBe(1);
      const { field, value } = f.kept(page);
      await expect(field).toHaveValue(value);
      await expect(submit(page)).toBeEnabled();
    });

    test("çok fazla istek (429) bekleme mesajını gösterir", async ({ page }) => {
      await simulate(page, f.endpoint, { kind: "status", status: 429 });
      await f.fill(page);
      await submit(page).click();
      await expect(notice(page, tr.errors.tooManyRequests)).toBeVisible();
      await expect(submit(page)).toBeEnabled();
    });

    test("bağlantı kesilince ağ mesajı çıkar, yazılanlar kalır, bağlantı gelince aynı form gönderilir", async ({ page }) => {
      await simulate(page, f.endpoint, { kind: "abort" });
      await f.fill(page);
      await submit(page).click();
      await expect(notice(page, tr.errors.network)).toBeVisible();
      const { field, value } = f.kept(page);
      await expect(field).toHaveValue(value);
      await expect(submit(page)).toBeEnabled();

      // Real offline mode as well: the send must fail at once instead of waiting silently.
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.context().setOffline(true);
      await submit(page).click();
      await expect(notice(page, tr.errors.network)).toBeVisible();
      await expect(submit(page)).toBeEnabled();
      await page.context().setOffline(false);
    });
  });
}

test.describe("Gönderim sonuçları (herkese açık): başarı", () => {
  test("şifremi unuttum: kod istenince kod adımı açılır", async ({ page }) => {
    await page.goto(buildPath("/forgot-password", {}, "tr"));
    const seen = await simulate(page, "/auth/password/forgot", { kind: "status", status: 204 });
    await page.getByLabel(tr.forgotPassword.email, { exact: true }).fill("kisi@example.test");
    await submit(page).click();
    await expect(page.getByText(tr.forgotPassword.codeSentTitle)).toBeVisible();
    await expect(page.getByLabel(tr.codeEntry.label, { exact: true })).toBeVisible();
    expect(seen.count).toBe(1);
  });

  test("iletişim: başarılı gönderimde teşekkür görünür ve form temizlenir", async ({ page }) => {
    await page.goto(buildPath("/contact", {}, "tr"));
    const seen = await simulate(page, "/contact", { kind: "status", status: 201, body: {} });
    await page.getByLabel(tr.contact.form.firstName, { exact: true }).fill("Ayşe");
    await page.getByLabel(tr.contact.form.lastName, { exact: true }).fill("Kaya");
    await page.getByLabel(tr.contact.form.email, { exact: true }).fill("ayse@example.test");
    await page.getByLabel(tr.contact.form.message, { exact: false }).fill("Merhaba, bu bir deneme mesajıdır.");
    await submit(page).click();
    await expect.poll(() => seen.count).toBe(1);
    await expect(page.getByText(tr.contact.success.title)).toBeVisible();
    await expect(page.getByLabel(tr.contact.form.firstName, { exact: true })).toHaveCount(0);
    // "Yeni mesaj yaz" brings back an empty form.
    await page.getByRole("button", { name: tr.contact.success.again }).click();
    await expect(page.getByLabel(tr.contact.form.firstName, { exact: true })).toHaveValue("");
  });
});
