import { test, expect } from "@playwright/test";
import { Findings } from "./ui-audit";
import { api, login, registerUser, uniqueUser } from "./helpers";

// Checklist section 7 (membership, session, authorization), checked in a real browser against the real backend.
// One throw-away account is registered (the register route is limited to 5 per 10 minutes and per address).

// AUDIT_EMAIL / AUDIT_PASSWORD reuse an existing account when the register limit is already used up.
const user = process.env.AUDIT_EMAIL
  ? { email: process.env.AUDIT_EMAIL, nickname: process.env.AUDIT_NICKNAME ?? "audit", password: process.env.AUDIT_PASSWORD ?? "" }
  : uniqueUser("authaudit");

test.describe.configure({ mode: "serial" });

test.describe("Üyelik, oturum ve yetkilendirme", () => {
  test("kayıt, çerez bayrakları ve oturum kapatma", async ({ page, context }) => {
    const f = new Findings("7-session-cookies");
    if (process.env.AUDIT_EMAIL) await login(page, user.email, user.password);
    else await registerUser(page, user);

    const cookies = await context.cookies();
    const byName = (name: string) => cookies.find((cookie) => cookie.name === name);
    for (const name of ["PDA_ACCESS", "PDA_REFRESH", "PDA_SESSION"]) {
      const cookie = byName(name);
      f.check(`${name} var`, !!cookie);
      f.check(`${name} HttpOnly`, cookie?.httpOnly === true);
      f.check(`${name} SameSite=Lax`, cookie?.sameSite === "Lax", String(cookie?.sameSite));
    }
    f.check("PDA_ACCESS yalnız /api yoluna gidiyor", byName("PDA_ACCESS")?.path === "/api", String(byName("PDA_ACCESS")?.path));
    f.check("PDA_REFRESH yalnız /api/v1/auth yoluna gidiyor", byName("PDA_REFRESH")?.path === "/api/v1/auth", String(byName("PDA_REFRESH")?.path));
    // The browser only sets Secure when asked to; the backend asks for it in production and over HTTPS (AuthCookies).
    f.warn("Secure bayrağı yerelde (http) kapalı; üretimde APP_ENV=prod ile açılır", String(byName("PDA_ACCESS")?.secure));
    const accessLife = (byName("PDA_ACCESS")?.expires ?? 0) - Date.now() / 1000;
    f.check("erişim çerezi ~15 dk yaşıyor", accessLife > 600 && accessLife <= 900 + 5, `${Math.round(accessLife)} sn`);
    const refreshLife = (byName("PDA_REFRESH")?.expires ?? 0) - Date.now() / 1000;
    f.check("yenileme çerezi ≤ 7 gün", refreshLife > 6 * 86_400 && refreshLife <= 7 * 86_400 + 5, `${Math.round(refreshLife)} sn`);

    // Client-side storage must not hold tokens.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    f.check("localStorage/sessionStorage'da token yok", !/eyJ[A-Za-z0-9_-]{10,}/.test(stored));
    f.check("JS çerezleri okuyabildiği alanda token yok", !/PDA_ACCESS|PDA_REFRESH/.test(await page.evaluate(() => document.cookie)));

    // Logout: the old access cookie must stop working on the server, not only disappear in the browser.
    const oldAccess = byName("PDA_ACCESS")!.value;
    const oldRefresh = byName("PDA_REFRESH")!.value;
    const me = await api(page, "GET", "/auth/me");
    f.check("giriş sonrası /auth/me 200", me.status === 200, String(me.status));
    await page.mouse.move(2, 2);
    await page.locator("header").getByRole("button", { name: /Hesap/ }).click();
    await page.getByRole("menuitem", { name: "Çıkış yap", exact: true }).click();
    await expect(page).toHaveURL(/\/giris/, { timeout: 15_000 });
    const afterLogout = await context.cookies();
    f.check("çıkışta üç çerez de siliniyor", !afterLogout.some((cookie) => cookie.name.startsWith("PDA_")), afterLogout.map((c) => c.name).join(","));
    // Plain fetch from Node: the browser's own cookie jar must not take part in the replay.
    const replay = await fetch("http://localhost:8080/api/v1/auth/me", { headers: { Cookie: `PDA_ACCESS=${oldAccess}` } });
    f.check("çıkıştan sonra eski erişim çerezi 401", replay.status === 401, String(replay.status));
    const csrf = await fetch("http://localhost:8080/api/v1/auth/csrf");
    const token = (csrf.headers.getSetCookie().find((c) => c.startsWith("XSRF-TOKEN=")) ?? "").split(";")[0].split("=")[1] ?? "";
    const refresh = await fetch("http://localhost:8080/api/v1/auth/refresh", {
      method: "POST",
      headers: { Cookie: `PDA_REFRESH=${oldRefresh}; XSRF-TOKEN=${token}`, "X-XSRF-TOKEN": token, Origin: "http://localhost:3000" },
    });
    f.check("çıkıştan sonra eski yenileme çerezi 401", refresh.status === 401, String(refresh.status));
    expect(f.fails, f.message()).toEqual([]);
  });

  test("giriş sonrası yönlendirme (open redirect) ve korumalı sayfalar", async ({ page }) => {
    const f = new Findings("7-open-redirect");
    for (const path of ["/dashboard", "/projects", "/settings", "/account", "/admin"]) {
      await page.goto(path);
      f.check(`${path}: oturumsuz girişe yönleniyor`, /\/giris/.test(page.url()), page.url());
      f.check(`${path}: dönüş adresi (next) korunuyor`, new URL(page.url()).searchParams.has("next"), page.url());
    }

    const evil = [
      "//evil.example/x",
      "https://evil.example/x",
      "/\\evil.example",
      "javascript:alert(1)",
      "/%2F%2Fevil.example",
      "///evil.example",
      "/\t/evil.example",
    ];
    for (const next of evil) {
      await page.context().clearCookies();
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await page.locator('input[name="email"]').fill(user.email);
      await page.locator('input[name="password"]').fill(user.password);
      await page.getByRole("button", { name: /^Giriş yap$/ }).click();
      await expect(page.locator("#main-content")).toBeVisible({ timeout: 15_000 });
      const landed = new URL(page.url());
      f.check(`next=${JSON.stringify(next)} kendi sitemizde kalıyor`, landed.origin === "http://localhost:3000", page.url());
      f.check(`next=${JSON.stringify(next)} dashboard'a düşüyor`, /\/genel-bakis/.test(landed.pathname), landed.pathname);
    }

    await page.context().clearCookies();
    await page.goto(`/login?next=${encodeURIComponent("/projects?page=1")}`);
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="password"]').fill(user.password);
    await page.getByRole("button", { name: /^Giriş yap$/ }).click();
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 15_000 });
    f.check("geçerli next (/projects) işleniyor", /\/projeler/.test(page.url()), page.url());
    expect(f.fails, f.message()).toEqual([]);
  });

  test("rol tabanlı yetki: normal kullanıcı yönetim sayfasına ve API'sine giremiyor", async ({ page }) => {
    const f = new Findings("7-rbac");
    await login(page, user.email, user.password);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    const adminVisible = await page.getByRole("heading", { level: 1 }).allInnerTexts();
    f.check("/admin içeriği normal kullanıcıya açılmıyor", !/Kullanıcılar|Analitik|Sistem/.test(adminVisible.join("|")) || /yetki|erişim|404|bulunamadı/i.test(adminVisible.join("|")), `${page.url()} ${adminVisible.join("|")}`);
    for (const [method, path] of [["GET", "/admin/users"], ["GET", "/admin/overview"], ["GET", "/admin/analytics"], ["GET", "/admin/system/status"], ["POST", "/admin/users/00000000-0000-0000-0000-000000000001/disable"]] as const) {
      const response = await api(page, method, path);
      f.check(`${method} ${path} → 403`, response.status === 403, String(response.status));
    }
    const me = await api(page, "GET", "/auth/me");
    f.check("globalRole USER", (me.json as { globalRole?: string }).globalRole === "USER");
    f.check("normal oturum yönetici doğrulamalı değil (adminVerified=false)", (me.json as { adminVerified?: boolean }).adminVerified === false);
    // The separate administrator sign-in is a page, not a door: a regular session still gets the sign-in and 403 from the API.
    await page.goto("/pd-admin");
    await page.waitForLoadState("networkidle");
    f.check("/pd-admin normal oturumda yönetici girişini gösteriyor", (await page.getByRole("heading", { level: 1 }).allInnerTexts()).join("|").includes("Yönetici Girişi"), page.url());
    f.check("/pd-admin adresi yerinde kalıyor (panele geçmiyor)", new URL(page.url()).pathname === "/pd-admin", page.url());
    // Mass assignment: a role in the profile body must not change anything.
    await api(page, "PUT", "/users/me/profile", { nickname: user.nickname, globalRole: "ADMIN", role: "ADMIN" });
    const after = await api(page, "GET", "/auth/me");
    f.check("profil isteğine eklenen globalRole yok sayılıyor", (after.json as { globalRole?: string }).globalRole === "USER");
    expect(f.fails, f.message()).toEqual([]);
  });

  test("oturum bitince kullanıcıya ne gösteriliyor", async ({ browser }) => {
    const f = new Findings("7-session-timeout-message");
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, user.email, user.password);
    await context.clearCookies({ name: "PDA_ACCESS" });
    await context.clearCookies({ name: "PDA_REFRESH" });
    await page.getByRole("link", { name: "Projeler", exact: true }).click({ timeout: 3_000 }).catch(() => undefined);
    await expect(page).toHaveURL(/\/giris/, { timeout: 15_000 });
    const notice = page.getByText(/oturum.*(sona|süre|doldu|kapandı)|tekrar giriş/i);
    f.check("giriş sayfası 'oturumunuz sona erdi' diye açıklıyor", (await notice.count()) > 0, "açıklama yok, kullanıcı sessizce giriş ekranına atılıyor");
    f.check("giriş sonrası kaldığı sayfaya dönmek için next taşınıyor", new URL(page.url()).searchParams.has("next"), page.url());
    await context.close();
    expect(f.fails, f.message()).toEqual([]);
  });
});
