import { test, expect, type Page } from "@playwright/test";
import { promoteToAdmin, psql } from "./db";
import { matchPath } from "../src/i18n/routing";
import { api, chooseDate, login } from "./helpers";
import { meId, newAdmin, newUser, sendContact } from "./admin-fixtures";

// The administration screens added for operations, on the real stack: user detail with sessions, system health, the
// audit trail and the support inbox. Presentation-only cases (error and paging states) simulate the API answer.

const API = "http://localhost:8080/api/v1";
const CORS = { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const formatNumber = (value: number) => new Intl.NumberFormat("tr-TR").format(value);
/** The tab badge stops counting at 99. */
const badge = (count: number) => (count > 99 ? "99+" : String(count));
const waitingRequests = async (page: Page) =>
  ((await api(page, "GET", "/admin/support-requests?status=NEW&page=0&size=1")).json as { totalElements: number }).totalElements;

test("the new admin routes have their own address in every language and keep the record id intact", () => {
  const id = "3f2b8c1e-5d4a-4b7e-9a10-2c6d8e0f1a23";
  const cases: [string, string, string][] = [
    ["/tr/yonetim/sistem", "/admin/system", "/tr/yonetim/sistem"],
    ["/en/admin/system", "/admin/system", "/en/admin/system"],
    ["/de/verwaltung/system", "/admin/system", "/de/verwaltung/system"],
    ["/tr/yonetim/denetim-kaydi", "/admin/audit", "/tr/yonetim/denetim-kaydi"],
    ["/de/verwaltung/audit-protokoll", "/admin/audit", "/de/verwaltung/audit-protokoll"],
    ["/tr/yonetim/destek-talepleri", "/admin/support", "/tr/yonetim/destek-talepleri"],
    ["/de/verwaltung/support-anfragen", "/admin/support", "/de/verwaltung/support-anfragen"],
    [`/tr/yonetim/kullanicilar/${id}`, "/admin/users/[userId]", `/tr/yonetim/kullanicilar/${id}`],
    [`/de/verwaltung/benutzer/${id}`, "/admin/users/[userId]", `/de/verwaltung/benutzer/${id}`],
    [`/en/admin/support/${id}`, "/admin/support/[requestId]", `/en/admin/support/${id}`],
    [`/tr/yonetim/destek-talepleri/${id}`, "/admin/support/[requestId]", `/tr/yonetim/destek-talepleri/${id}`],
    // An English address typed under another language is redirected to that language's own address.
    ["/tr/admin/system", "/admin/system", "/tr/yonetim/sistem"],
  ];
  for (const [url, route, canonical] of cases) {
    const match = matchPath(url);
    expect(match?.route, url).toBe(route);
    expect(match?.canonicalPath, url).toBe(canonical);
    if (route.includes("[")) expect(Object.values(match!.params), url).toEqual([id]);
  }
  // A detail address needs exactly one id segment.
  expect(matchPath("/tr/yonetim/kullanicilar/a/b")).toBeNull();
});

// ---------------------------------------------------------------------------------------------------------------------
// 8.1 User detail and sessions
// ---------------------------------------------------------------------------------------------------------------------

test("user detail opens from the list, shows profile, read-only permissions and the single-administrator note", async ({ browser }) => {
  const admin = await newAdmin(browser);
  const target = await newUser(browser, "det");
  try {
    const targetId = await meId(target.page);
    const page = admin.page;
    await page.goto("/admin/users");
    await page.getByLabel("Kullanıcı ara").fill(target.user.nickname);
    await page.getByRole("link", { name: new RegExp(`${target.user.nickname} ayrıntılarını aç`) }).first().click();
    await expect(page).toHaveURL(new RegExp(`/tr/yonetim/kullanicilar/${targetId}$`));
    await expect(page.locator("h1")).toContainText(target.user.nickname);

    const profile = page.getByTestId("user-profile");
    await expect(profile).toContainText(target.user.email);
    await expect(profile).toContainText("Aktif");
    await expect(profile).toContainText("Doğrulandı");
    await expect(profile).toContainText("Bağlı hesap yok");
    // An ordinary account: role "Kullanıcı", and no platform permission at all.
    await expect(page.getByText("Bu rolün platform izni yoktur.")).toBeVisible();
    await expect(page.getByTestId("single-admin-note")).toHaveText("Bu kurulumda tek yönetici vardır: ortam değişkenleriyle oluşturulan hesap. Roller değiştirilemez.");
    // There is nothing to change a role with: no role or permission control on the screen.
    await expect(page.locator("#main-content").getByRole("combobox")).toHaveCount(0);
    await expect(page.locator("[data-testid=user-permissions]")).toHaveCount(0);

    // The administrator's own page lists the four permissions of the role, as plain text.
    const adminId = await meId(page);
    await page.goto(`/admin/users/${adminId}`);
    await expect(page.locator("[data-permission]")).toHaveCount(4);
    await expect(page.getByTestId("user-permissions")).toContainText("Denetim kaydını görüntüleme");
    await expect(page.getByTestId("user-profile")).toContainText("Siz");

    // Breadcrumb leads back to the list.
    await page.getByRole("navigation", { name: "Yönetim yolu" }).getByRole("link", { name: "Kullanıcılar" }).click();
    await expect(page).toHaveURL(/\/tr\/yonetim\/kullanicilar$/);

    // An unknown account is a clear "not found", not an empty page.
    await page.goto("/admin/users/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: "Kullanıcı bulunamadı" })).toBeVisible();
  } finally {
    await admin.context.close();
    await target.context.close();
  }
});

test("ending one session and then all sessions of a user signs them out for real, with confirmations, toasts and audit rows", async ({ browser }) => {
  const admin = await newAdmin(browser);
  const target = await newUser(browser, "ses");
  // A second device of the same person: a separate browser context with its own session.
  const device = await browser.newContext({ locale: "tr-TR", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15" });
  try {
    const second = await device.newPage();
    await login(second, target.user.email, target.user.password);
    const targetId = await meId(target.page);
    const page = admin.page;
    await page.goto(`/admin/users/${targetId}`);

    const rows = page.locator("tr[data-session-row]");
    await expect(rows).toHaveCount(2);
    // The user agent is summarised for people: browser and system, not the raw string.
    await expect(page.locator("tr[data-session-row]", { hasText: "Safari 17" })).toContainText("macOS");
    await expect(page.locator("tr[data-session-row]", { hasText: "Chrome" }).first()).toContainText("Windows");

    // One session: the confirmation says what happens before anything is sent.
    await page.locator("tr[data-session-row]", { hasText: "Safari 17" }).getByRole("button", { name: "Oturumu kapat" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("bu cihazda hemen oturumdan çıkarılır");
    await expect(dialog).toContainText("diğer cihazlardaki oturumlar etkilenmez");
    await dialog.getByRole("button", { name: "Vazgeç" }).click();
    await expect(dialog).toHaveCount(0);
    expect((await api(second, "GET", "/auth/me")).status).toBe(200);

    await page.locator("tr[data-session-row]", { hasText: "Safari 17" }).getByRole("button", { name: "Oturumu kapat" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Oturumu kapat" }).click();
    await expect(page.getByText("Oturum kapatıldı.")).toBeVisible();
    await expect(rows).toHaveCount(1);
    // That device really lost its session; the other one still works.
    expect((await api(second, "GET", "/auth/me")).status).toBe(401);
    expect((await api(target.page, "GET", "/auth/me")).status).toBe(200);

    // All sessions.
    await page.getByRole("button", { name: "Tüm oturumları kapat" }).click();
    const all = page.getByRole("dialog");
    await expect(all).toContainText("1 açık oturum kapatılır");
    await expect(all).toContainText("tüm cihazlarda hemen oturumdan çıkar");
    await all.getByRole("button", { name: "Tüm oturumları kapat" }).click();
    await expect(page.getByText("1 oturum kapatıldı.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Açık oturum yok" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tüm oturumları kapat" })).toHaveCount(0);
    expect((await api(target.page, "GET", "/auth/me")).status).toBe(401);

    // Both actions are in the permanent audit trail, naming the administrator and the person.
    const events = psql(`SELECT action || ':' || outcome FROM admin_audit_events WHERE target_id = '${targetId}' ORDER BY occurred_at`).split("\n");
    expect(events).toEqual(["SESSION_REVOKE:SUCCESS", "SESSION_REVOKE_ALL:SUCCESS"]);
    await page.goto("/admin/audit");
    await expect(page.locator("tr[data-audit-row=SESSION_REVOKE_ALL]").first()).toContainText(target.user.nickname);
    await expect(page.locator("tr[data-audit-row=SESSION_REVOKE]").first()).toContainText(admin.user.nickname);
  } finally {
    await device.close();
    await admin.context.close();
    await target.context.close();
  }
});

test("a failed session action shows the error in the dialog and as a message, and the list is refreshed when the session is already gone", async ({ browser }) => {
  const admin = await newAdmin(browser);
  const target = await newUser(browser, "sfl");
  try {
    const targetId = await meId(target.page);
    const page = admin.page;
    await page.goto(`/admin/users/${targetId}`);
    await expect(page.locator("tr[data-session-row]")).toHaveCount(1);

    // The session was ended by someone else in the meantime: the server answers 404.
    await page.route(`${API}/admin/users/${targetId}/sessions/*/revoke`, (route) =>
      route.fulfill({ status: 404, contentType: "application/json", headers: CORS, body: JSON.stringify({ status: 404, code: "USER_NOT_FOUND" }) }));
    await page.getByRole("button", { name: "Oturumu kapat" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Oturumu kapat" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Bu oturum artık açık değil");
    await page.unroute(`${API}/admin/users/${targetId}/sessions/*/revoke`);

    // A server failure stays in the dialog so it can be retried.
    await page.route(`${API}/admin/users/${targetId}/sessions/revoke-all`, (route) =>
      route.fulfill({ status: 500, contentType: "application/json", headers: CORS, body: JSON.stringify({ status: 500 }) }));
    await page.getByRole("dialog").getByRole("button", { name: "Vazgeç" }).click();
    await page.getByRole("button", { name: "Tüm oturumları kapat" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Tüm oturumları kapat" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect((await api(target.page, "GET", "/auth/me")).status).toBe(200);
  } finally {
    await admin.context.close();
    await target.context.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// 8.2 System
// ---------------------------------------------------------------------------------------------------------------------

type Status = {
  status: string; database: boolean; googleLoginConfigured: boolean; githubLoginConfigured: boolean; mailEnabled: boolean;
  apiDocsEnabled: boolean; totpEncryptionKeyConfigured: boolean; activeSessions: number;
  httpErrorsLast24h: { clientErrors: number; serverErrors: number };
  scheduledJobs: { name: string; lastRunAt: string | null; lastOutcome: string | null; lastAffected: number }[];
};

test("the system tab shows the real status, counters, jobs, counts and a paged project list", async ({ browser }) => {
  const admin = await newAdmin(browser);
  try {
    const page = admin.page;
    await page.locator("[data-admin-link]").click();
    await page.getByRole("navigation", { name: "Yönetim bölümleri" }).getByRole("link", { name: "Sistem" }).click();
    await expect(page).toHaveURL(/\/tr\/yonetim\/sistem$/);
    await expect(page.locator("h1")).toHaveText("Sistem");
    await expect(page.getByTestId("health")).toBeVisible();

    const real = (await api(page, "GET", "/admin/system/status")).json as Status;
    const onOff = (on: boolean, yes = "Yapılandırıldı", no = "Yapılandırılmadı") => (on ? yes : no);
    const expected: Record<string, string> = {
      status: real.status === "UP" ? "Çalışıyor" : "Çalışmıyor",
      database: real.database ? "Erişilebilir" : "Erişilemiyor",
      mail: onOff(real.mailEnabled, "Açık", "Kapalı"),
      google: onOff(real.googleLoginConfigured),
      github: onOff(real.githubLoginConfigured),
      apiDocs: onOff(real.apiDocsEnabled, "Açık", "Kapalı"),
      totpKey: onOff(real.totpEncryptionKeyConfigured),
    };
    for (const [key, text] of Object.entries(expected)) await expect(page.locator(`[data-health="${key}"]`)).toContainText(text);
    // The key itself and any secret value never reach the screen: only words about whether they are set.
    expect(real.totpEncryptionKeyConfigured).toBe(true);
    await expect(page.locator("[data-health=totpKey]")).not.toContainText(/[A-Za-z0-9+/]{32,}/);

    await expect(page.getByTestId("stat-sessions").locator("dd")).toHaveText(formatNumber(real.activeSessions));
    const shown4xx = Number((await page.getByTestId("stat-4xx").locator("dd").innerText()).replace(/\D/g, ""));
    expect(shown4xx).toBeLessThanOrEqual(real.httpErrorsLast24h.clientErrors);
    await expect(page.getByTestId("stat-5xx").locator("dd")).toHaveText(formatNumber(real.httpErrorsLast24h.serverErrors));

    // Jobs: every job the server knows, with a readable name and an honest "not run yet".
    expect(real.scheduledJobs.length).toBeGreaterThanOrEqual(6);
    await expect(page.locator("tr[data-job]")).toHaveCount(real.scheduledJobs.length);
    await expect(page.locator('tr[data-job="retention.audit"]')).toContainText("Denetim kaydı saklama temizliği");
    for (const job of real.scheduledJobs) {
      const row = page.locator(`tr[data-job="${job.name}"]`);
      if (!job.lastRunAt) await expect(row).toContainText("Henüz çalışmadı");
      else await expect(row).toContainText(job.lastOutcome === "SUCCESS" ? "Başarılı" : "Başarısız");
    }

    // Counts agree with the API.
    const overview = (await api(page, "GET", "/admin/overview")).json as { users: { total: number; admins: number }; projects: { total: number } };
    await expect(page.getByTestId("counts-users").locator("dd").first()).toHaveText(formatNumber(overview.users.total));
    await expect(page.getByTestId("counts-projects").locator("dd").first()).toHaveText(formatNumber(overview.projects.total));

    // The project list is the server's page: ten rows, and a second page when there are more.
    const projects = (await api(page, "GET", "/admin/projects?page=0&size=10")).json as { items: { name: string }[]; totalElements: number };
    if (projects.totalElements > 0) {
      await expect(page.locator("tr[data-project-row]")).toHaveCount(projects.items.length);
      await expect(page.locator("tr[data-project-row]").first()).toContainText(/Planlama|Aktif|Beklemede|Tamamlandı|Arşivlendi/);
    }
    if (projects.totalElements > 10) {
      const requested: string[] = [];
      page.on("request", (request) => { if (request.url().includes("/admin/projects")) requested.push(request.url()); });
      await page.getByRole("button", { name: "Sonraki", exact: true }).click();
      await expect.poll(() => requested.some((url) => url.includes("page=1"))).toBe(true);
    }
  } finally {
    await admin.context.close();
  }
});

test("system tab loading, failure with retry, and the empty project list are all states of their own", async ({ browser }) => {
  const admin = await newAdmin(browser);
  try {
    const page = admin.page;
    await page.route(`${API}/admin/system/status`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ status: 500, contentType: "application/json", headers: CORS, body: JSON.stringify({ status: 500 }) });
    });
    await page.route(`${API}/admin/projects**`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify({ items: [], page: 0, size: 10, totalElements: 0 }) }));
    await page.goto("/admin/system");
    await expect(page.getByRole("status", { name: "Sistem bilgisi yükleniyor" }).first()).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Sistem durumu yüklenemedi." }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Henüz proje yok" })).toBeVisible();

    await page.unroute(`${API}/admin/system/status`);
    await page.getByRole("button", { name: "Yeniden dene" }).first().click();
    await expect(page.getByTestId("health")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Sistem durumu yüklenemedi." })).toHaveCount(0);
  } finally {
    await admin.context.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// 8.3 Audit log
// ---------------------------------------------------------------------------------------------------------------------

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("the audit tab shows what this test did (sign-in, disable, enable, a refused self-disable) and filters by action and by date with the browser time zone", async ({ browser }) => {
  const admin = await newAdmin(browser);
  const target = await newUser(browser, "aud");
  try {
    const page = admin.page;
    const targetId = await meId(target.page);
    const adminId = await meId(page);
    expect((await api(page, "POST", `/admin/users/${targetId}/disable`)).status).toBe(200);
    expect((await api(page, "POST", `/admin/users/${targetId}/enable`)).status).toBe(200);
    expect((await api(page, "POST", `/admin/users/${adminId}/disable`)).status).toBe(409);

    const requests: URL[] = [];
    page.on("request", (request) => { if (request.url().includes("/admin/audit-events")) requests.push(new URL(request.url())); });
    await page.goto("/admin/audit");
    await expect(page).toHaveURL(/\/tr\/yonetim\/denetim-kaydi$/);
    await expect(page.locator("h1")).toHaveText("Denetim kaydı");
    await expect.poll(() => requests.length).toBeGreaterThanOrEqual(1);
    expect(requests.at(-1)!.searchParams.get("zone")).toBe(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone));

    const disable = page.locator("tr[data-audit-row=USER_DISABLE]", { hasText: target.user.nickname });
    await expect(disable.first()).toContainText("Üyelik sonlandırıldı");
    await expect(disable.first()).toContainText(admin.user.nickname);
    await expect(disable.first()).toContainText("Başarılı");
    await expect(page.locator("tr[data-audit-row=USER_ENABLE]", { hasText: target.user.nickname }).first()).toContainText("Hesap yeniden etkinleştirildi");
    // The refused self-disable is recorded as "denied".
    const denied = page.locator('tr[data-audit-row=USER_DISABLE][data-audit-outcome=DENIED]', { hasText: admin.user.nickname });
    await expect(denied.first()).toContainText("Reddedildi");
    await expect(page.locator("tr[data-audit-row=ADMIN_SIGN_IN]", { hasText: admin.user.nickname }).first()).toContainText("Yönetici girişi");
    // The target is a link to the person's detail page.
    await expect(disable.first().getByRole("link", { name: target.user.nickname })).toHaveAttribute("href", new RegExp(`/tr/yonetim/kullanicilar/${targetId}$`));
    // No e-mail address anywhere in the trail.
    await expect(page.locator("tbody")).not.toContainText(target.user.email);

    // Action filter: only that action, sent to the server.
    await chooseOption(page, "İşlem", "Hesap yeniden etkinleştirildi");
    await expect.poll(() => requests.at(-1)!.searchParams.get("action")).toBe("USER_ENABLE");
    await expect(page.locator("tr[data-audit-row]").first()).toHaveAttribute("data-audit-row", "USER_ENABLE");
    const kinds = await page.locator("tr[data-audit-row]").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-audit-row")));
    expect(new Set(kinds)).toEqual(new Set(["USER_ENABLE"]));

    // Date range: today shows the events, a range that ended yesterday shows the filtered empty state.
    await chooseDate(page, "admin-audit-from", today());
    await chooseDate(page, "admin-audit-to", today());
    await expect.poll(() => requests.at(-1)!.searchParams.get("from")).toBe(today());
    expect(requests.at(-1)!.searchParams.get("to")).toBe(today());
    await expect(page.locator("tr[data-audit-row]").first()).toBeVisible();
    await chooseDate(page, "admin-audit-from", daysAgo(10));
    await chooseDate(page, "admin-audit-to", daysAgo(1));
    await expect(page.getByRole("heading", { name: "Bu filtreyle kayıt yok" })).toBeVisible();
    await page.getByRole("button", { name: "Filtreleri temizle" }).first().click();
    await expect(page.locator("tr[data-audit-row]").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtreleri temizle" })).toBeDisabled();

    // An inverted range is explained and never sent.
    await chooseDate(page, "admin-audit-from", daysAgo(1));
    const sent = requests.length;
    await chooseDate(page, "admin-audit-to", daysAgo(5));
    await expect(page.getByRole("alert").filter({ hasText: "Başlangıç tarihi bitişten sonra olamaz" })).toBeVisible();
    await page.waitForTimeout(400);
    expect(requests.length).toBe(sent);
  } finally {
    await admin.context.close();
    await target.context.close();
  }
});

test("audit states: loading, failure with retry, empty, and paging goes to the server", async ({ browser }) => {
  const admin = await newAdmin(browser);
  try {
    const page = admin.page;
    await page.route(`${API}/admin/audit-events**`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ status: 500, contentType: "application/json", headers: CORS, body: JSON.stringify({ status: 500 }) });
    });
    await page.goto("/admin/audit");
    await expect(page.getByRole("status", { name: "Denetim kaydı yükleniyor" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Denetim kaydı yüklenemedi." })).toBeVisible();
    await page.unroute(`${API}/admin/audit-events**`);

    const sample = (index: number) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      occurredAt: new Date(Date.UTC(2026, 9, 1, 10, 0, 0) + index * 60_000).toISOString(),
      actorUserId: null, actorNickname: null, action: "ADMIN_SIGN_IN", targetType: "SYSTEM", targetId: null, targetNickname: null,
      outcome: index % 2 ? "FAILURE" : "SUCCESS",
    });
    const pageParams: string[] = [];
    await page.route(`${API}/admin/audit-events**`, (route) => {
      const url = new URL(route.request().url());
      const index = Number(url.searchParams.get("page"));
      pageParams.push(String(index));
      const items = Array.from({ length: index === 0 ? 20 : 5 }, (_, row) => sample(index * 20 + row + 1));
      return route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify({ items, page: index, size: 20, totalElements: 25 }) });
    });
    await page.getByRole("button", { name: "Yeniden dene" }).click();
    await expect(page.locator("tr[data-audit-row]")).toHaveCount(20);
    // An unknown actor (a refused sign-in of an unknown account) has its own words, not a blank cell.
    await expect(page.locator("tr[data-audit-row]").first()).toContainText("Bilinmeyen hesap");
    await expect(page.locator('tr[data-audit-outcome=FAILURE]').first()).toContainText("Başarısız");
    await page.getByRole("button", { name: "Sonraki", exact: true }).click();
    await expect(page.locator("tr[data-audit-row]")).toHaveCount(5);
    expect(pageParams).toContain("1");

    await page.unroute(`${API}/admin/audit-events**`);
    await page.route(`${API}/admin/audit-events**`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify({ items: [], page: 0, size: 20, totalElements: 0 }) }));
    await chooseOption(page, "İşlem", "Oturum kapatıldı");
    await expect(page.getByRole("heading", { name: "Bu filtreyle kayıt yok" })).toBeVisible();
  } finally {
    await admin.context.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// 8.4 Support requests
// ---------------------------------------------------------------------------------------------------------------------

test("a request sent through the public contact API reaches the inbox with its category; detail keeps line breaks as plain text; status changes (with a confirmation to close) reach the database, the new-request counter and the audit trail", async ({ browser }) => {
  const admin = await newAdmin(browser);
  try {
    const marker = `e2e-sup-${Date.now()}`;
    const email = `${marker}@example.test`;
    const message = `Birinci satır ${marker}\nİkinci satır <b>kalın</b> & <script>alert(1)</script>\n\nÜçüncü paragraf`;
    expect(await sendContact(browser, { firstName: "Ece", lastName: "Yıldız", email, message, category: "BUG", startedAt: Date.now() - 20_000 })).toBe(200);
    const other = `${marker}-b@example.test`;
    expect(await sendContact(browser, { firstName: "Can", lastName: null, email: other, message: `Veri talebi ${marker}`, category: "DATA_REQUEST", startedAt: Date.now() - 20_000 })).toBe(200);
    const id = psql(`SELECT id FROM support_requests WHERE email = '${email}'`);
    expect(id).toMatch(UUID);

    const page = admin.page;
    await page.goto("/admin/users");
    // The tab carries the number of requests nobody has looked at yet.
    const counter = page.getByTestId("support-new-count");
    const waitingBefore = await waitingRequests(page);
    expect(waitingBefore).toBeGreaterThanOrEqual(2);
    await expect(counter).toHaveText(badge(waitingBefore));
    await page.getByRole("navigation", { name: "Yönetim bölümleri" }).getByRole("link", { name: /Destek talepleri/ }).click();
    await expect(page).toHaveURL(/\/tr\/yonetim\/destek-talepleri$/);
    await expect(page.locator("h1")).toHaveText("Destek talepleri");

    // Filters: category and status are sent to the server.
    const requested: URL[] = [];
    page.on("request", (request) => { if (request.url().includes("/admin/support-requests?")) requested.push(new URL(request.url())); });
    await chooseOption(page, "Kategori", "KVKK / veri talebi");
    await expect.poll(() => requested.at(-1)?.searchParams.get("category")).toBe("DATA_REQUEST");
    await expect(page.locator(`tr[data-support-row]`, { hasText: other })).toBeVisible();
    await expect(page.locator(`tr[data-support-row]`, { hasText: email })).toHaveCount(0);
    await chooseOption(page, "Kategori", "Hata bildirimi");
    await chooseOption(page, "Durum", "Yeni");
    await expect.poll(() => requested.at(-1)?.searchParams.get("status")).toBe("NEW");
    const row = page.locator(`tr[data-support-row="${id}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText("Ece Yıldız");
    await expect(row).toContainText("Hata bildirimi");
    await expect(row).toContainText(email);
    await expect(row).toContainText("Birinci satır");
    await expect(row).toContainText("Yeni");
    await expect(row).toContainText("İletildi");

    await row.getByRole("link", { name: "Ece Yıldız" }).click();
    await expect(page).toHaveURL(new RegExp(`/tr/yonetim/destek-talepleri/${id}$`));
    await expect(page.locator("h1")).toContainText("Ece Yıldız");

    // The message is text: line breaks are kept, markup is not interpreted.
    const text = page.getByTestId("support-message");
    expect(await text.innerText()).toBe(message);
    await expect(text.locator("b, script")).toHaveCount(0);
    expect(await text.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("pre-wrap");
    await expect(page.getByTestId("support-details")).toContainText(email);

    // Replying opens the mail program with the visitor's address; no body, no extra recipients.
    const reply = page.getByTestId("support-reply");
    const href = (await reply.getAttribute("href"))!;
    expect(href.startsWith(`mailto:${email}?subject=`)).toBe(true);
    expect(decodeURIComponent(href)).toContain("Hata bildirimi");
    expect(href).not.toMatch(/[&](?!subject)|body=|cc=|bcc=/i);

    // New → in progress (no confirmation) → closed (confirmation) → reopened.
    await page.getByRole("button", { name: "İşleme al" }).click();
    await expect(page.getByText('Talep durumu "İşlemde" olarak güncellendi.')).toBeVisible();
    await expect(page.locator("h1").locator("[data-status=IN_PROGRESS]")).toBeVisible();
    expect(psql(`SELECT status FROM support_requests WHERE id = '${id}'`)).toBe("IN_PROGRESS");
    await expect(counter).toHaveText(badge(waitingBefore - 1));

    await page.getByRole("button", { name: "Talebi kapat" }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toContainText("denetim kaydına yazılır");
    await confirm.getByRole("button", { name: "Vazgeç" }).click();
    expect(psql(`SELECT status FROM support_requests WHERE id = '${id}'`)).toBe("IN_PROGRESS");
    await page.getByRole("button", { name: "Talebi kapat" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Talebi kapat" }).click();
    await expect(page.locator("h1").locator("[data-status=CLOSED]")).toBeVisible();
    expect(psql(`SELECT status FROM support_requests WHERE id = '${id}'`)).toBe("CLOSED");
    await page.getByRole("button", { name: "Yeni olarak işaretle" }).click();
    await expect(page.locator("h1").locator("[data-status=NEW]")).toBeVisible();
    await expect(counter).toHaveText(badge(waitingBefore));

    // The audit trail has a row per real change, with a link back to the request.
    expect(psql(`SELECT count(*) FROM admin_audit_events WHERE action = 'SUPPORT_REQUEST_STATUS_CHANGE' AND target_id = '${id}' AND outcome = 'SUCCESS'`)).toBe("3");
    await page.getByRole("navigation", { name: "Yönetim bölümleri" }).getByRole("link", { name: "Denetim kaydı" }).click();
    await chooseOption(page, "İşlem", "Destek talebi durumu değişti");
    const link = page.locator("tr[data-audit-row=SUPPORT_REQUEST_STATUS_CHANGE]").getByRole("link", { name: `Destek talebi ${id.slice(0, 8)}` });
    await expect(link.first()).toBeVisible();
    await expect(link.first()).toHaveAttribute("href", new RegExp(`/tr/yonetim/destek-talepleri/${id}$`));

    // An unknown request is a clear "not found".
    await page.goto("/admin/support/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: "Destek talebi bulunamadı" })).toBeVisible();
  } finally {
    await admin.context.close();
  }
});

test("support states: loading, failure with retry, empty inbox and the filtered empty state", async ({ browser }) => {
  const admin = await newAdmin(browser);
  try {
    const page = admin.page;
    await page.route(`${API}/admin/support-requests?**`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ status: 500, contentType: "application/json", headers: CORS, body: JSON.stringify({ status: 500 }) });
    });
    await page.goto("/admin/support");
    await expect(page.getByRole("status", { name: "Destek talepleri yükleniyor" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Destek talepleri yüklenemedi." })).toBeVisible();
    await page.unroute(`${API}/admin/support-requests?**`);
    await page.route(`${API}/admin/support-requests?**`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify({ items: [], page: 0, size: 20, totalElements: 0 }) }));
    await page.getByRole("button", { name: "Yeniden dene" }).click();
    await expect(page.getByRole("heading", { name: "Henüz destek talebi yok" })).toBeVisible();
    await chooseOption(page, "Durum", "Kapandı");
    await expect(page.getByRole("heading", { name: "Bu filtreyle talep yok" })).toBeVisible();
  } finally {
    await admin.context.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------------------------------------------------

test("every new admin screen and endpoint stays closed to an ordinary account and to an administrator who has not signed in through /pd-admin", async ({ browser }) => {
  const admin = await newAdmin(browser);
  const ordinary = await newUser(browser, "nrm");
  const unverified = await newUser(browser, "unv");
  try {
    const adminId = await meId(admin.page);
    // Promoted after it signed in: an administrator account whose session was not opened by the administrator sign-in.
    promoteToAdmin(unverified.user.email);
    const old = unverified.page;

    const endpoints = [
      `/admin/users/${adminId}`, `/admin/users/${adminId}/sessions`, "/admin/system/status", "/admin/overview", "/admin/projects",
      "/admin/audit-events", "/admin/support-requests", "/admin/support-requests/00000000-0000-4000-8000-000000000000", "/admin/analytics",
    ];
    for (const endpoint of endpoints) {
      expect((await api(ordinary.page, "GET", endpoint)).status, `ordinary ${endpoint}`).toBe(403);
      const refused = await api(old, "GET", endpoint);
      expect(refused.status, `unverified ${endpoint}`).toBe(403);
      expect((refused.json as { code?: string }).code, `unverified ${endpoint}`).toBe("admin_reauthentication_required");
    }
    expect((await api(ordinary.page, "POST", `/admin/users/${adminId}/sessions/revoke-all`)).status).toBe(403);
    expect((await api(old, "POST", `/admin/users/${adminId}/sessions/revoke-all`)).status).toBe(403);
    expect((await api(ordinary.page, "POST", "/admin/support-requests/00000000-0000-4000-8000-000000000000/status", { status: "CLOSED" })).status).toBe(403);
    expect((await api(old, "POST", "/admin/support-requests/00000000-0000-4000-8000-000000000000/status", { status: "CLOSED" })).status).toBe(403);

    for (const path of ["/admin/system", "/admin/audit", "/admin/support", `/admin/users/${adminId}`, "/admin/support/00000000-0000-4000-8000-000000000000"]) {
      await ordinary.page.goto(path);
      await expect(ordinary.page, `ordinary ${path}`).toHaveURL(/\/tr\/genel-bakis$/);
      await old.goto(path);
      await expect(old, `unverified ${path}`).toHaveURL(/\/pd-admin\?reason=reauthenticate/);
    }
  } finally {
    await admin.context.close();
    await ordinary.context.close();
    await unverified.context.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// 8.6 Responsive, themes, keyboard
// ---------------------------------------------------------------------------------------------------------------------

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`user detail, system, audit and support fit ${width}px in both themes; tabs and actions are reachable by keyboard with real touch targets`, async ({ browser }) => {
    const admin = await newAdmin(browser);
    const target = await newUser(browser, "rsp");
    try {
      const marker = `e2e-rsp-${Date.now()}`;
      expect(await sendContact(browser, { firstName: "Ece", lastName: "Yıldız", email: `${marker}@example.test`, message: `Uzun bir mesaj ${marker} ${"kelime ".repeat(60)}`, category: "ACCESSIBILITY", startedAt: Date.now() - 20_000 })).toBe(200);
      const supportId = psql(`SELECT id FROM support_requests WHERE email = '${marker}@example.test'`);
      const targetId = await meId(target.page);
      const page = admin.page;
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });

      for (const theme of ["light", "dark"]) {
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
        const screens: [string, string][] = [
          [`/admin/users/${targetId}`, "[data-session-row]:visible"],
          ["/admin/system", "[data-health=status]"],
          ["/admin/audit", "[data-audit-row]:visible"],
          ["/admin/support", `[data-support-row]:visible`],
          [`/admin/support/${supportId}`, "[data-testid=support-message]"],
        ];
        for (const [path, ready] of screens) {
          await page.goto(path);
          await expect(page.locator(ready).first(), `${path} ${theme}`).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} ${theme}`).toBeLessThanOrEqual(width);
        }

        // Section tabs: every one is a link of at least 44px height, and the strip itself may scroll sideways.
        const tabs = page.getByRole("navigation", { name: "Yönetim bölümleri" }).getByRole("link");
        await expect(tabs).toHaveCount(5);
        for (const tab of await tabs.all()) expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(43);

        // Keyboard on the detail page: the destructive action opens a dialog, Escape closes it and focus returns.
        await page.goto(`/admin/users/${targetId}`);
        const revoke = page.getByRole("button", { name: "Oturumu kapat" }).locator("visible=true").first();
        await expect(revoke).toBeVisible();
        const box = (await revoke.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(width < 640 ? 43 : 35);
        await revoke.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(revoke).toBeFocused();
        expect((await api(target.page, "GET", "/auth/me")).status).toBe(200);
      }
    } finally {
      await admin.context.close();
      await target.context.close();
    }
  });
}
