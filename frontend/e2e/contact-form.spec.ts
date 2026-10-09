import { test, expect, type Page } from "@playwright/test";
import { buildPath } from "../src/i18n/routing";

// The form without a backend: validation, accessibility, failure handling (API answers are simulated ONLY for the
// failure and slow-answer cases; the real delivery is proven in contact-delivery.spec.ts against the e2e stack).

const API = "http://localhost:8080/api/v1";

async function simulateApi(page: Page, contact: { status: number; body: unknown; delayMs?: number }, onContact?: () => void) {
  await page.route(`${API}/auth/csrf`, (route) => route.fulfill({
    status: 200, contentType: "application/json",
    headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" },
    body: JSON.stringify({ headerName: "X-XSRF-TOKEN", parameterName: "_csrf", token: "t" }),
  }));
  await page.route(`${API}/contact`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true", "access-control-allow-headers": "Content-Type, X-XSRF-TOKEN", "access-control-allow-methods": "POST" } });
    onContact?.();
    if (contact.delayMs) await new Promise((resolve) => setTimeout(resolve, contact.delayMs));
    await route.fulfill({
      status: contact.status, contentType: "application/json",
      headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" },
      body: JSON.stringify(contact.body),
    });
  });
}

async function fill(page: Page, values: { first?: string; last?: string; email?: string; message?: string }) {
  if (values.first !== undefined) await page.getByLabel("Ad", { exact: true }).fill(values.first);
  if (values.last !== undefined) await page.getByLabel("Soyad", { exact: true }).fill(values.last);
  if (values.email !== undefined) await page.getByLabel("E-posta", { exact: true }).fill(values.email);
  if (values.message !== undefined) await page.getByLabel("Mesaj", { exact: true }).fill(values.message);
}

for (const [locale, title, send] of [["tr", "İletişim", "Gönder"], ["en", "Contact", "Send"], ["de", "Kontakt", "Senden"]] as const) {
  test(`contact page is public, localized and has no visible mailto: ${locale}`, async ({ page, context }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    const response = await page.goto("/contact");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`${buildPath("/contact", {}, locale)}$`));
    await expect(page.locator("h1")).toHaveText(title);
    await expect(page.locator("form input, form textarea")).toHaveCount(4);
    await expect(page.getByRole("button", { name: send })).toBeVisible();
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(page.locator(`footer a[href="${buildPath("/contact", {}, locale)}"]`)).toBeVisible();
    await expect(page.locator("meta[name=\"robots\"]")).toHaveCount(0);
  });
}

test("every field is validated in the browser and each error is tied to its field", async ({ page }) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Gönder" }).click();
  for (const label of ["Ad", "Soyad", "E-posta", "Mesaj"]) {
    const field = page.getByLabel(label, { exact: true });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    const describedBy = (await field.getAttribute("aria-describedby"))!.split(" ");
    const alert = page.locator(describedBy.map((id) => `[id="${id}"]`).join(", ")).filter({ hasText: "Bu alan zorunlu." });
    await expect(alert).toHaveCount(1);
    await expect(alert).toHaveAttribute("role", "alert");
  }

  await fill(page, { first: "   ", last: "Y", email: "not-an-email", message: "kısa" });
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByText("Geçerli bir e-posta adresi girin.")).toBeVisible();
  await expect(page.getByText("Mesaj en az 10 karakter olmalı.")).toBeVisible();
  await expect(page.getByLabel("Ad", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Soyad", { exact: true })).not.toHaveAttribute("aria-invalid", "true");

  await fill(page, { message: "x".repeat(5001) });
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByText("Mesaj en fazla 5000 karakter olabilir.")).toBeVisible();
  await expect(page.getByText("5001 / 5000")).toBeVisible();
});

test("a server failure is shown as an error and never as success", async ({ page }) => {
  await simulateApi(page, { status: 503, body: { status: 503, code: "CONTACT_DELIVERY_FAILED", detail: "internal host smtp.internal:587 refused" } });
  await page.goto("/contact");
  await fill(page, { first: "Ece", last: "Yıldız", email: "ece@example.test", message: "Merhaba, bu bir deneme mesajıdır." });
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Mesajınız gönderilemedi" })).toBeVisible();
  await expect(page.getByText("Mesajınız gönderildi.")).toHaveCount(0);
  // Nothing about the server reaches the page, and the typed text is kept for another try.
  await expect(page.locator("body")).not.toContainText("smtp.internal");
  await expect(page.getByLabel("Mesaj", { exact: true })).toHaveValue("Merhaba, bu bir deneme mesajıdır.");
  await expect(page.getByRole("button", { name: "Gönder" })).toBeEnabled();
});

test("a duplicate and an unavailable form get their own friendly message", async ({ page }) => {
  await simulateApi(page, { status: 409, body: { status: 409, code: "CONTACT_DUPLICATE" } });
  await page.goto("/contact");
  await fill(page, { first: "Ece", last: "Y", email: "ece@example.test", message: "Merhaba, bu bir deneme mesajıdır." });
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "az önce gönderdiniz" })).toBeVisible();
  await page.unroute(`${API}/contact`);
  await simulateApi(page, { status: 503, body: { status: 503, code: "CONTACT_UNAVAILABLE" } });
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "şu anda kullanılamıyor" })).toBeVisible();
});

test("a double click or a double Enter sends exactly one request", async ({ page }) => {
  let requests = 0;
  await simulateApi(page, { status: 200, body: { status: "SENT" }, delayMs: 800 }, () => { requests += 1; });
  await page.goto("/contact");
  await fill(page, { first: "Ece", last: "Y", email: "ece@example.test", message: "Merhaba, bu bir deneme mesajıdır." });
  const button = page.getByRole("button", { name: "Gönder" });
  await button.dblclick();
  await expect(button).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("Mesajınız gönderildi.");
  expect(requests).toBe(1);

  await page.getByRole("button", { name: "Yeni mesaj yaz" }).click();
  await fill(page, { first: "Ece", last: "Y", email: "ece@example.test", message: "İkinci deneme mesajım burada." });
  await page.getByLabel("E-posta", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Mesajınız gönderildi.");
  expect(requests).toBe(2);
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`contact form fits ${width}px in both themes with keyboard-reachable fields`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const theme of ["light", "dark"]) {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.goto("/contact");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      for (const control of await page.locator("form input, form textarea, form button").all()) {
        const box = (await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    }
    // Tab order: the four fields, then Send.
    await page.goto("/contact");
    await page.getByLabel("Ad", { exact: true }).focus();
    for (const label of ["Soyad", "E-posta", "Mesaj"]) {
      await page.keyboard.press("Tab");
      await expect(page.getByLabel(label, { exact: true })).toBeFocused();
    }
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Gönder" })).toBeFocused();
  });
}
