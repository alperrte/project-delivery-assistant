import type { Page } from "@playwright/test";
import { DEFAULT_THEME_COLORS } from "../src/features/settings/theme-colors";
import { DEFAULT_THEME_ANIMATION } from "../src/features/settings/theme-animation";

export async function fixture(page: Page, locale = "tr", dark = false, animated = false) {
  const origin = new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000").origin;
  await page.context().addCookies([{ name: "PDA_SESSION", value: "theme-fixture", url: origin }, { name: "XSRF-TOKEN", value: "theme-fixture", url: origin }]);
  let preferences = { locale, theme: dark ? "dark" : "light", motion: "on", themeTransition: false, languageTransition: false,
    navbarMode: "always-visible", themeColors: { ...DEFAULT_THEME_COLORS, themeType: animated ? "ANIMATED" : "SOLID" }, themeAnimation: { ...DEFAULT_THEME_ANIMATION } };
  let failSave = false, failReset = false, failRead = false;
  await page.routeWebSocket(/\/api\/v1\/ws$/, socket => socket.onMessage(message => {
    if (String(message).startsWith("CONNECT")) socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0");
  }));
  await page.route("**/api/v1/**", async route => {
    const req = route.request(), url = new URL(req.url());
    let status = 200;
    let body: unknown = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    if (url.pathname.endsWith("/auth/me")) body = { id: "theme-fixture", nickname: "ThemeFixture", email: "theme@example.test", globalRole: "USER", mustChangePassword: false };
    if (url.pathname.endsWith("/auth/csrf")) body = { headerName: "X-XSRF-TOKEN" };
    if (url.pathname.endsWith("/chat/conversations")) body = { group: null, groups: [], directs: [], totalUnread: 0 };
    if (url.pathname.endsWith("/chat/members")) body = [];
    if (url.pathname.endsWith("/notifications/unread-count")) body = { count: 0 };
    if (req.method() === "OPTIONS" || url.pathname.endsWith("/notifications/team-deletions/claim")) status = 204;
    if (url.pathname.endsWith("/users/me/preferences")) {
      if (req.method() === "GET" && failRead) status = 503;
      if (req.method() === "PUT") {
        if (failSave) { status = 503; failSave = false; }
        else preferences = req.postDataJSON();
      }
      body = preferences;
    }
    if (url.pathname.endsWith("/preferences/theme")) {
      if (failReset) { status = 503; failReset = false; }
      else preferences = { ...preferences, themeColors: { ...DEFAULT_THEME_COLORS }, themeAnimation: { ...DEFAULT_THEME_ANIMATION } };
      body = preferences;
    }
    await route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-xsrf-token",
      "access-control-allow-methods": "GET,PUT,POST,DELETE,OPTIONS" }, body: status === 204 ? "" : JSON.stringify(body) });
  });
  return { saved: () => preferences, failSave: () => { failSave = true; }, failReset: () => { failReset = true; },
    failRead: (value: boolean) => { failRead = value; },
    changeSavedColor: (color: string) => { preferences = { ...preferences, themeColors: { ...preferences.themeColors, solidColor: color } }; } };
}

