import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Language Transition Preference", () => {
  test("Settings page displays Dil Geçiş Animasyonu option defaulting to Açık", async ({ page, context }) => {
    let preferences: Record<string, unknown> = {
      locale: "tr",
      theme: "system",
      motion: "on",
      themeTransition: true,
      languageTransition: true,
      navbarMode: "always-visible",
    };

    await context.addCookies([
      { name: "PDA_SESSION", value: "lang-trans-test", url: "http://localhost:3000" },
      { name: "XSRF-TOKEN", value: "lang-trans-test", url: "http://localhost:3000" },
    ]);

    await page.routeWebSocket(/\/api\/v1\/ws$/, socket => socket.onMessage(message => {
      if (String(message).startsWith("CONNECT")) socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0");
    }));
    await page.route("**/api/v1/**", async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const noContent = request.method() === "OPTIONS" || pathname.endsWith("/notifications/team-deletions/claim");
      let body: unknown = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
      if (pathname.endsWith("/chat/conversations")) body = { group: null, groups: [], directs: [], totalUnread: 0 };
      if (pathname.endsWith("/chat/members")) body = [];
      if (pathname.endsWith("/notifications/unread-count")) body = { count: 0 };
      if (pathname.endsWith("/auth/me")) {
        body = { id: "lang-trans-test", nickname: "LangTester", email: "lang@example.com", globalRole: "USER", mustChangePassword: false };
      } else if (pathname.endsWith("/auth/csrf")) {
        body = { headerName: "X-XSRF-TOKEN" };
      } else if (pathname.endsWith("/users/me/preferences")) {
        if (request.method() === "PUT") {
          preferences = { ...preferences, ...request.postDataJSON() };
        }
        body = preferences;
      }
      await route.fulfill({
        status: noContent ? 204 : 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "http://localhost:3000",
          "access-control-allow-credentials": "true",
          "access-control-allow-headers": "content-type,x-xsrf-token",
          "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
        },
        body: noContent ? "" : JSON.stringify(body),
      });
    });

    await page.goto("/tr/ayarlar");

    const langGroup = page.getByRole("radiogroup", { name: "Dil geçiş animasyonu", exact: true });
    await expect(langGroup).toBeVisible();
    await expect(langGroup.getByRole("radio", { name: "Açık", exact: true })).toBeChecked();
    await expect(langGroup.getByRole("radio", { name: "Kapalı", exact: true })).not.toBeChecked();

    // Toggle to Kapalı and save
    await langGroup.getByRole("radio", { name: "Kapalı", exact: true }).click();
    await expect(langGroup.getByRole("radio", { name: "Kapalı", exact: true })).toBeChecked();

    const saveButton = page.getByRole("button", { name: "Kaydet", exact: true });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect.poll(() => preferences.languageTransition).toBe(false);

    // Persisted to localStorage and survives reload
    await expect.poll(() => page.evaluate(() => localStorage.getItem("pda:language-transition"))).toBe("off");
    await page.reload();

    const reloadedGroup = page.getByRole("radiogroup", { name: "Dil geçiş animasyonu", exact: true });
    await expect(reloadedGroup.getByRole("radio", { name: "Kapalı", exact: true })).toBeChecked();
  });

  test("Language transition is independent of theme transition", async ({ page, context }) => {
    let preferences: Record<string, unknown> = {
      locale: "tr",
      theme: "system",
      motion: "on",
      themeTransition: false,
      languageTransition: true,
      navbarMode: "always-visible",
    };

    await context.addCookies([
      { name: "PDA_SESSION", value: "indep-test", url: "http://localhost:3000" },
      { name: "XSRF-TOKEN", value: "indep-test", url: "http://localhost:3000" },
    ]);

    await page.routeWebSocket(/\/api\/v1\/ws$/, socket => socket.onMessage(message => {
      if (String(message).startsWith("CONNECT")) socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0");
    }));
    await page.route("**/api/v1/**", async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const noContent = request.method() === "OPTIONS" || pathname.endsWith("/notifications/team-deletions/claim");
      let body: unknown = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
      if (pathname.endsWith("/chat/conversations")) body = { group: null, groups: [], directs: [], totalUnread: 0 };
      if (pathname.endsWith("/chat/members")) body = [];
      if (pathname.endsWith("/notifications/unread-count")) body = { count: 0 };
      if (pathname.endsWith("/auth/me")) {
        body = { id: "indep-test", nickname: "IndepTester", email: "indep@example.com", globalRole: "USER", mustChangePassword: false };
      } else if (pathname.endsWith("/auth/csrf")) {
        body = { headerName: "X-XSRF-TOKEN" };
      } else if (pathname.endsWith("/users/me/preferences")) {
        if (request.method() === "PUT") {
          preferences = { ...preferences, ...request.postDataJSON() };
        }
        body = preferences;
      }
      await route.fulfill({
        status: noContent ? 204 : 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "http://localhost:3000",
          "access-control-allow-credentials": "true",
          "access-control-allow-headers": "content-type,x-xsrf-token",
          "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
        },
        body: noContent ? "" : JSON.stringify(body),
      });
    });

    await page.goto("/tr/ayarlar");

    const themeGroup = page.getByRole("radiogroup", { name: "Tema geçiş animasyonu", exact: true });
    const langGroup = page.getByRole("radiogroup", { name: "Dil geçiş animasyonu", exact: true });

    // Theme transition is Kapalı, Language transition is Açık
    await expect(themeGroup.getByRole("radio", { name: "Kapalı", exact: true })).toBeChecked();
    await expect(langGroup.getByRole("radio", { name: "Açık", exact: true })).toBeChecked();

    // Toggle theme to Açık and language to Kapalı
    await themeGroup.getByRole("radio", { name: "Açık", exact: true }).click();
    await langGroup.getByRole("radio", { name: "Kapalı", exact: true }).click();

    await page.getByRole("button", { name: "Kaydet", exact: true }).click();

    await expect.poll(() => preferences.themeTransition).toBe(true);
    await expect.poll(() => preferences.languageTransition).toBe(false);
  });
});
