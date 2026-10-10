import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

for (const legacy of [false, true]) {
  test(`${legacy ? "legacy device-follow preference" : "a fresh browser"} respects the device reduced-motion preference`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (legacy) await page.addInitScript(() => {
      if (localStorage.getItem("pda:motion") === null) localStorage.setItem("pda:motion", "system");
    });
    await page.goto("/tr");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
    await expect(page.locator("#product")).not.toHaveAttribute("data-choreographed", "true");
    await expect(page.locator("#open-source")).not.toHaveAttribute("data-choreographed", "true");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator("#product")).toHaveAttribute("data-choreographed", "true");
    await expect(page.locator("#open-source")).toHaveAttribute("data-choreographed", "true");
    await page.evaluate(() => {
      localStorage.setItem("pda:motion", "off");
      window.dispatchEvent(new Event("pda:preferences-changed"));
    });
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await expect(page.locator("#product")).not.toHaveAttribute("data-choreographed", "true");
    await expect(page.locator("#open-source")).not.toHaveAttribute("data-choreographed", "true");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await expect(page.locator("#product")).not.toHaveAttribute("data-choreographed", "true");
  });
}

for (const savedMotion of [undefined, null, "system", "off"]) {
  test(`settings show only on/off, normalize ${savedMotion === null ? "null" : savedMotion ?? "missing"} account preferences and save the explicit choice`, async ({ page, context }) => {
    // Isolated API fixtures: this test does not alter a real account.
    let preferences: Record<string, unknown> = savedMotion === null
      ? { locale: null, theme: null, motion: null, themeTransition: null }
      : savedMotion ? { motion: savedMotion, ...(savedMotion === "system" ? { themeTransition: false } : {}) } : {};
    if (savedMotion === null) await page.addInitScript(() => {
      // Reproduce a previously poisoned local preference in an already-started session too.
      localStorage.setItem("pda:theme-transition", "off");
      sessionStorage.setItem("pda:session-baseline", JSON.stringify({ userId: "motion-fixture", theme: "system", locale: "tr" }));
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await context.addCookies([
      { name: "PDA_SESSION", value: "motion-fixture", url: "http://localhost:3000" },
      { name: "XSRF-TOKEN", value: "motion-fixture", url: "http://localhost:3000" },
    ]);
    await page.route("**/api/v1/**", async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      let body: unknown = { content: [], totalElements: 0, totalPages: 0, counts: {} };
      if (pathname.endsWith("/auth/me")) body = {
        id: "motion-fixture", nickname: "MotionFixture", email: "motion@example.com",
        globalRole: "USER", mustChangePassword: false,
      };
      if (pathname.endsWith("/auth/csrf")) body = { headerName: "X-XSRF-TOKEN" };
      if (pathname.endsWith("/users/me/preferences")) {
        if (request.method() === "PUT") preferences = request.postDataJSON();
        body = preferences;
      }
      await route.fulfill({
        status: request.method() === "OPTIONS" ? 204 : 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "http://localhost:3000",
          "access-control-allow-credentials": "true",
          "access-control-allow-headers": "content-type,x-xsrf-token",
          "access-control-allow-methods": "GET,PUT,OPTIONS",
        },
        body: request.method() === "OPTIONS" ? "" : JSON.stringify(body),
      });
    });
    await page.goto("/tr/ayarlar");
    const motion = page.getByRole("radiogroup", { name: "Arayüz animasyonları", exact: true });
    await expect(motion.getByRole("radio")).toHaveCount(2);
    await expect(motion.getByRole("radio", { name: savedMotion === "off" ? "Kapalı" : "Açık", exact: true })).toBeChecked();
    const theme = page.getByRole("radiogroup", { name: "Tema geçiş animasyonu", exact: true });
    await expect(theme.getByRole("radio", { name: savedMotion === "system" ? "Kapalı" : "Açık", exact: true })).toBeChecked();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("pda:theme-transition"))).toBe(savedMotion === "system" ? "off" : "on");
    if (savedMotion === null || savedMotion === undefined) {
      await page.evaluate(() => {
        Object.assign(window, { __defaultThemeAnimated: false });
        new MutationObserver(() => {
          if (document.documentElement.classList.contains("theme-close-in")) {
            Object.assign(window, { __defaultThemeAnimated: true });
          }
        }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      });
      await page.mouse.move(700, 8);
      await page.getByRole("button", { name: "Koyu", exact: true }).click();
      await expect.poll(() => page.evaluate(() => (window as typeof window & { __defaultThemeAnimated: boolean }).__defaultThemeAnimated)).toBe(false);
      await expect(page.locator("html")).not.toHaveClass(/theme-close-in/);
    }
    const next = savedMotion === "off" ? "Açık" : "Kapalı";
    await motion.getByRole("radio", { name: next, exact: true }).click();
    if (next === "Kapalı") await expect(theme.getByRole("radio", { name: "Açık", exact: true })).toBeDisabled();
    else await expect(theme.getByRole("radio", { name: "Açık", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect.poll(() => preferences.motion).toBe(next === "Kapalı" ? "off" : "on");
    await expect(page.locator("html")).toHaveAttribute("data-motion", String(preferences.motion));
    await page.reload();
    await expect(motion.getByRole("radio", { name: next, exact: true })).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-motion", String(preferences.motion));
  });
}

