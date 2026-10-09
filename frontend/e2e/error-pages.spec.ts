import { test, expect, type Page } from "@playwright/test";

const codes = ["404", "403", "500", "503"] as const;
const user = { id: "error-test-user", nickname: "ErrorTest", email: "errors@example.com", globalRole: "USER", mustChangePassword: false };

async function mockApi(page: Page, failure: (path: string) => number) {
  await page.context().addCookies([{ name: "PDA_SESSION", value: "1", url: "http://localhost:3000" }]);
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const status = failure(path);
    const data = status !== 200 ? { status, detail: "Internal diagnostic must not be displayed", code: "ERROR_TEST" }
      : path.endsWith("/auth/me") ? user
      : path.endsWith("/auth/csrf") ? { headerName: "X-XSRF-TOKEN" }
      : path.endsWith("/tasks/mine") ? { content: [], counts: {}, totalElements: 0, totalPages: 0 }
      : { content: [], totalElements: 0, totalPages: 0 };
    await route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" }, body: JSON.stringify(data) });
  });
}

for (const [locale, title] of [["tr", "Bu sayfayı bulamadık."], ["en", "We could not find this page."], ["de", "Diese Seite wurde nicht gefunden."]] as const) {
  test(`four preview screens have content and no footer: ${locale}`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    for (const code of codes) {
      const response = await page.goto(`/errors/${code}`);
      // A preview is a normal page, not an actual HTTP error.
      expect(response?.status()).toBe(200);
      await expect(page.locator(`[data-error-code="${code}"]`)).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("footer")).toHaveCount(0);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
      await expect(page.locator('a[href="/contact"]')).toBeVisible();
      if (code === "404") await expect(page.locator("h1")).toHaveText(title);
    }
    expect(errors).toEqual([]);
  });
}

test("unknown address returns the PDA 404 screen and HTTP 404", async ({ page }) => {
  const response = await page.goto("/pda-boyle-bir-sayfa-yok");
  expect(response?.status()).toBe(404);
  await expect(page.locator('[data-error-code="404"]')).toBeVisible();
  await expect(page.locator("footer")).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "İçeriğe geç" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#error-main")).toBeFocused();
  await page.getByRole("link", { name: "Giriş sayfası", exact: true }).click();
  await expect(page).toHaveURL(/\/tr\/giris$/);
});

for (const width of [320, 390, 768, 1440]) {
  test(`four error screens fit ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const theme of ["light", "dark"]) {
      await page.addInitScript(value => localStorage.setItem("theme", value), theme);
      for (const code of codes) {
        await page.goto(`/errors/${code}`);
        await expect(page.locator(`[data-error-code="${code}"]`)).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        expect(await page.locator("main a, main button").evaluateAll(elements => elements.every(el => {
          const rect = el.getBoundingClientRect();
          return rect.left >= -1 && rect.right <= innerWidth + 1 && rect.height >= 44;
        }))).toBe(true);
      }
    }
  });
}

for (const status of [403, 404, 500, 503]) {
  test(`project load HTTP ${status} shows the correct screen without leaking diagnostics`, async ({ page }) => {
    let requests = 0;
    await mockApi(page, path => {
      if (path.includes("/projects/by-slug/")) { requests++; return status; }
      return 200;
    });
    await page.goto("/projects/error-test-project");
    await expect(page.locator(`[data-error-code="${status}"]`)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Internal diagnostic");
    await expect(page.locator("footer")).toHaveCount(0);
    if (status >= 500) {
      const before = requests;
      await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
      await expect.poll(() => requests).toBeGreaterThan(before);
    }
  });
}

test("session service 503 shows availability screen and recovers after retry", async ({ page }) => {
  let unavailable = true;
  await mockApi(page, path => path.endsWith("/auth/me") && unavailable ? 503 : 200);
  await page.goto("/settings");
  await expect(page.locator('[data-error-code="503"]')).toBeVisible();
  await expect(page).toHaveURL(/\/tr\/ayarlar$/);
  unavailable = false;
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator("h1")).toHaveText("Ayarlar");
});

test("expired session still redirects to login instead of a 403 screen", async ({ page }) => {
  await mockApi(page, path => path.endsWith("/auth/me") ? 401 : path.endsWith("/auth/refresh") ? 403 : 200);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/tr\/giris$/);
  await expect(page.locator('[data-error-code="403"]')).toHaveCount(0);
});

test("development crash reaches the real 500 boundary and retry recovers", async ({ page }) => {
  await page.goto("/dev/error-test");
  test.skip(await page.locator('[data-error-code="404"]').count() > 0, "Controlled crash route is disabled in production.");
  await page.getByRole("button", { name: "Test hatası oluştur", exact: true }).click();
  await expect(page.locator('[data-error-code="500"]')).toBeVisible();
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.getByRole("button", { name: "Test hatası oluştur", exact: true })).toBeVisible();
});

for (const [locale, title] of [["tr", "Kısa bir ara veriyoruz."], ["en", "We are taking a short break."], ["de", "Wir machen eine kurze Pause."]] as const) {
  test(`portable 503 works without external resources: ${locale}`, async ({ page, context }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    const external: string[] = [];
    page.on("request", request => { if (request.resourceType() !== "document") external.push(request.url()); });
    await page.goto("/errors/503.html");
    await expect(page.locator("h1")).toHaveText(title);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    expect(external).toEqual([]);
    await expect(page.locator('a[href="/contact"]')).toBeVisible();
  });
}
