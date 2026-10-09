import { test, expect, type Browser, type Page } from "@playwright/test";
import { FRESH_VISITOR } from "./consent-state";
import { promoteToAdmin } from "./db";
import { chooseDate, registerUser, uniqueUser } from "./helpers";

// The administration analytics dashboard. Counts that must move are proven on the real stack; presentation cases
// (language, duration format, empty/error states) use a simulated API answer ONLY for what the screen shows.

const API = "http://localhost:8080/api/v1";
const CORS = { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" };

async function newAdmin(browser: Browser, options: { timezoneId?: string; locale?: string } = {}) {
  const context = await browser.newContext({ locale: options.locale ?? "tr-TR", timezoneId: options.timezoneId });
  const page = await context.newPage();
  const user = uniqueUser("dash");
  await registerUser(page, user);
  promoteToAdmin(user.email);
  return { context, page, user };
}

/** The six overview cards in order: visits, sessions, engagement, registrations, active accounts, contact requests. */
async function overview(page: Page) {
  const values = page.locator('[data-testid="overview"] dd');
  await expect(values).toHaveCount(6);
  return (await values.allTextContents()).map((text) => text.trim());
}
const asNumber = (text: string) => Number(text.replace(/[^\d]/g, ""));

function dashboard(overrides: Record<string, unknown> = {}) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 9, 3 + index)).toISOString().slice(0, 10);
    return { date, visits: index * 2, sessions: index, value: index };
  });
  return {
    range: { from: days[0].date, to: days[6].date, zone: "UTC", days: 7 },
    traffic: {
      visits: 42, uniqueSessions: 12, uniqueVisitors: 9, averageEngagedSeconds: 272,
      daily: days.map(({ date, visits, sessions }) => ({ date, visits, sessions })),
      sources: [{ source: "DIRECT", sessions: 6 }, { source: "SEARCH", sessions: 4 }, { source: "CAMPAIGN", sessions: 2 }],
      topReferrers: [{ name: "google.com", sessions: 4 }],
      topCampaigns: [{ source: "news", medium: "email", campaign: "<b>launch</b>", sessions: 2 }],
    },
    registrations: { inRange: 3, daily: days.map(({ date, value }) => ({ date, value })) },
    accounts: { total: 20, active: 17, terminated: 2, pendingVerification: 1, admins: 1 },
    contactRequests: { inRange: 5, total: 11, daily: days.map(({ date, value }) => ({ date, value })) },
    ...overrides,
  };
}

async function simulate(page: Page, body: unknown, status = 200) {
  await page.route(`${API}/admin/analytics**`, (route) => route.fulfill({
    status, contentType: "application/json", headers: CORS, body: JSON.stringify(body),
  }));
}

test("the dashboard has all five sections and its numbers move with real registrations, contact messages and consented visits", async ({ browser }) => {
  const admin = await newAdmin(browser);
  const page = admin.page;
  try {
    await page.goto("/admin/analytics");
    await expect(page).toHaveURL(/\/tr\/yonetim\/analitik$/);
    for (const heading of ["Genel bakış", "Trafik", "Kayıtlar", "Kullanıcılar", "İletişim talepleri"]) {
      await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible();
    }
    const before = await overview(page);

    // A new account that never allowed analytics: still a registration.
    const registrant = await browser.newContext({ locale: "tr-TR" });
    await registerUser(await registrant.newPage(), uniqueUser("reg"));
    await registrant.close();

    // A real contact message from a logged-out visitor.
    const visitor = await browser.newContext({ locale: "tr-TR" });
    const contact = await visitor.newPage();
    await contact.goto("/contact");
    await contact.getByLabel("Ad", { exact: true }).fill("Ece");
    await contact.getByLabel("Soyad", { exact: true }).fill("Yıldız");
    await contact.getByLabel("E-posta", { exact: true }).fill(`dash-${Date.now()}@example.test`);
    await contact.getByLabel("Mesaj", { exact: true }).fill(`Gösterge testi mesajı ${Date.now()}`);
    await contact.getByRole("button", { name: "Gönder" }).click();
    await expect(contact.getByRole("status")).toContainText("Mesajınız gönderildi.");
    await visitor.close();

    // Page views from a visitor who allowed analytics.
    const consented = await browser.newContext({ locale: "tr-TR", storageState: FRESH_VISITOR });
    const browsing = await consented.newPage();
    // Each page view is waited for, so a following navigation cannot cancel it half-way.
    const viewSent = () => browsing.waitForResponse((r) => r.url().includes("/analytics/events") && r.request().method() === "POST");
    await browsing.goto("/tr/sss");
    const first = viewSent();
    await browsing.locator("[data-cookie-banner]").getByRole("button", { name: "Tümünü kabul et" }).click();
    expect((await first).status()).toBe(204);
    for (const path of ["/tr/gizlilik", "/tr/erisilebilirlik"]) {
      const next = viewSent();
      await browsing.goto(path);
      expect((await next).status()).toBe(204);
    }
    await consented.close();

    await expect.poll(async () => {
      await page.reload();
      const after = await overview(page);
      return [asNumber(after[0]) - asNumber(before[0]), asNumber(after[3]) - asNumber(before[3]), asNumber(after[5]) - asNumber(before[5])];
    }, { timeout: 30_000, intervals: [1_000] }).toEqual([3, 1, 1]);

    // The accounts block and the contact block agree with the overview.
    await expect(page.locator('[data-testid="accounts"] dd').first()).toHaveText(/\d+/);
    await expect(page.getByRole("img", { name: /^Talep: toplam \d+/ })).toBeVisible();
  } finally {
    await admin.context.close();
  }
});

for (const [locale, expected, zero] of [
  ["tr-TR", /4\s?dk\s+32\s?sn/, "Ortalama etkileşim"],
  ["en-US", /4\s?min\s+32\s?sec/, "Average engagement"],
  ["de-DE", /4\s?Min\.?\s+32\s?Sek\.?/, "Durchschnittliche Interaktion"],
] as const) {
  test(`durations read naturally and chart data has a text alternative: ${locale}`, async ({ browser }) => {
    const admin = await newAdmin(browser, { locale });
    try {
      await admin.context.addCookies([{ name: "NEXT_LOCALE", value: locale.slice(0, 2), url: "http://localhost:3000" }]);
      await simulate(admin.page, dashboard());
      await admin.page.goto("/admin/analytics");
      const card = admin.page.locator('[data-testid="overview"] > div').filter({ hasText: zero });
      await expect(card.locator("dd")).toHaveText(expected);
      // Every chart is an image with a label and a hidden table with the same numbers.
      const tables = admin.page.locator("table.sr-only");
      await expect(tables).toHaveCount(3);
      await expect(tables.first().locator("tbody tr")).toHaveCount(7);
      await expect(admin.page.locator("svg[role=img]")).toHaveCount(3);
      // Campaign text is plain text, never markup.
      await expect(admin.page.getByText("<b>launch</b>")).toBeVisible();
      await expect(admin.page.locator("b", { hasText: "launch" })).toHaveCount(0);
    } finally {
      await admin.context.close();
    }
  });
}

test("loading, failure and empty states", async ({ browser }) => {
  const admin = await newAdmin(browser);
  const page = admin.page;
  try {
    await page.route(`${API}/admin/analytics**`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ status: 500, contentType: "application/json", headers: CORS, body: JSON.stringify({ status: 500 }) });
    });
    await page.goto("/admin/analytics");
    await expect(page.getByRole("status", { name: "Analitik yükleniyor" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Analitik verileri yüklenemedi." })).toBeVisible();
    await page.unroute(`${API}/admin/analytics**`);
    await simulate(page, dashboard({
      traffic: { visits: 0, uniqueSessions: 0, uniqueVisitors: 0, averageEngagedSeconds: 0, daily: [], sources: [], topReferrers: [], topCampaigns: [] },
    }));
    await page.getByRole("button", { name: "Yeniden dene" }).click();
    await expect(page.getByText("Bu aralıkta çerez izni vermiş ziyaretçiden veri yok.").first()).toBeVisible();
    await expect(page.getByText("0 sn").first()).toBeVisible();
  } finally {
    await admin.context.close();
  }
});

test("presets and a custom range are sent with the browser's own time zone", async ({ browser }) => {
  const admin = await newAdmin(browser, { timezoneId: "Europe/Istanbul" });
  const page = admin.page;
  try {
    const calls: URL[] = [];
    page.on("request", (request) => { if (request.url().includes("/api/v1/admin/analytics")) calls.push(new URL(request.url())); });
    await page.goto("/admin/analytics");
    await expect.poll(() => calls.length).toBeGreaterThanOrEqual(1);
    expect(calls.at(-1)!.searchParams.get("zone")).toBe("Europe/Istanbul");
    const span = (url: URL) => (Date.parse(url.searchParams.get("to")!) - Date.parse(url.searchParams.get("from")!)) / 86_400_000 + 1;
    expect(span(calls.at(-1)!)).toBe(30);

    await page.getByRole("radio", { name: "Son 7 gün" }).click();
    await expect.poll(() => span(calls.at(-1)!)).toBe(7);
    await page.getByRole("radio", { name: "Son 90 gün" }).click();
    await expect.poll(() => span(calls.at(-1)!)).toBe(90);

    await page.getByRole("radio", { name: "Özel" }).click();
    const day = (offset: number) => {
      const date = new Date(); date.setDate(date.getDate() + offset);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    await chooseDate(page, "admin-range-from", day(-10));
    await chooseDate(page, "admin-range-to", day(-3));
    await expect.poll(() => calls.at(-1)!.searchParams.get("from")).toBe(day(-10));
    expect(calls.at(-1)!.searchParams.get("to")).toBe(day(-3));

    // An inverted range is explained and never sent.
    const sent = calls.length;
    await chooseDate(page, "admin-range-to", day(-12));
    await expect(page.getByRole("alert").filter({ hasText: "Başlangıç tarihi bitişten sonra olamaz" })).toBeVisible();
    await page.waitForTimeout(500);
    expect(calls.length).toBe(sent);
  } finally {
    await admin.context.close();
  }
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`the dashboard fits ${width}px in both themes`, async ({ browser }) => {
    const admin = await newAdmin(browser);
    const page = admin.page;
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await simulate(page, dashboard());
      for (const theme of ["light", "dark"]) {
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
        await page.goto("/admin/analytics");
        await expect(page.locator("svg[role=img]").first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        for (const svg of await page.locator("svg[role=img]").all()) {
          const box = (await svg.boundingBox())!;
          expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        }
      }
    } finally {
      await admin.context.close();
    }
  });
}
