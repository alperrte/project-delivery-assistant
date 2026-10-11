import { test, expect, type Page } from "@playwright/test";
import { api } from "./helpers";
import { newAdmin, sendAnalytics } from "./admin-fixtures";

// The behaviour reports of the analytics page. Numbers come from events posted to the real public analytics endpoint
// (exactly what the consented tracker sends); the screen is compared with what the administrator API answers.
// Presentation cases (languages, layout, a missing report) simulate the API answer only for what the screen shows.

const API = "http://localhost:8080/api/v1";
const CORS = { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" };

type Behavior = {
  topPages: { path: string; views: number; sessions: number }[];
  entryPages: { path: string; sessions: number }[];
  exitPages: { path: string; sessions: number }[];
  flows: { fromPath: string; toPath: string; sessions: number }[];
  notFound: { views: number; sessions: number };
  ctas: { ctaId: string; clicks: number; sessions: number }[];
  conversions: {
    sessions: number; converted: number;
    bySource: { source: string; sessions: number; converted: number }[];
    byCampaign: { source: string | null; medium: string | null; campaign: string | null; sessions: number; converted: number }[];
  };
  clientErrors: { total: number; byKind: { kind: string; count: number }[]; byRoute: { path: string; kind: string; count: number }[] };
};

const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

/** The same default range the page asks for (the last 30 days in the browser's zone), read through the real API. */
async function behavior(page: Page): Promise<Behavior> {
  const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const result = await api(page, "GET", `/admin/analytics?${new URLSearchParams({ from: day(-29), to: day(0), zone })}`);
  expect(result.status).toBe(200);
  return (result.json as { behavior: Behavior }).behavior;
}

const number = (locale: string, value: number) => new Intl.NumberFormat(locale).format(value);
const cell = (row: ReturnType<Page["locator"]>, index: number) => row.locator("td").nth(index);
const normalized = (text: string) => text.replace(/\s+/g, " ").trim();

test("page, flow, 404, CTA, conversion and client-error reports show the data posted to the real analytics endpoint", async ({ browser }) => {
  const admin = await newAdmin(browser);
  const visitor = await browser.newContext({ locale: "tr-TR" });
  try {
    const stamp = Date.now();
    const landing = `/e2e-${stamp}-landing`;
    const features = `/e2e-${stamp}-features`;
    const campaign = `cmp-${stamp}`;
    const page = admin.page;
    const before = await behavior(page);

    const tracker = await visitor.newPage();
    await tracker.goto("/tr/sss");
    const ids = () => ({ visitorId: crypto.randomUUID(), sessionId: crypto.randomUUID() });
    const send = async (who: { visitorId: string; sessionId: string }, event: Record<string, unknown>) =>
      expect(await sendAnalytics(tracker, { ...who, consentVersion: 1, ...event })).toBe(204);

    // Visit A arrives through a campaign link, looks at two pages and registers.
    const a = ids();
    await send(a, { type: "PAGE_VIEW", path: landing, utmSource: "e2e", utmMedium: "playwright", utmCampaign: campaign });
    await send(a, { type: "CTA_CLICK", path: landing, ctaId: "landing_register" });
    await send(a, { type: "PAGE_VIEW", path: features });
    await send(a, { type: "CTA_CLICK", path: features, ctaId: "register_submit" });
    // Visit B comes from a search engine, opens a page that does not exist and hits a render error.
    const b = ids();
    await send(b, { type: "PAGE_VIEW", path: landing, referrerHost: "www.google.com" });
    await send(b, { type: "PAGE_VIEW", path: "/not-found" });
    await send(b, { type: "CLIENT_ERROR", path: landing, errorKind: "render" });
    await send(b, { type: "CTA_CLICK", path: landing, ctaId: "landing_login" });
    // Visit C has a network error and leaves.
    const c = ids();
    await send(c, { type: "PAGE_VIEW", path: landing });
    await send(c, { type: "CLIENT_ERROR", path: landing, errorKind: "network" });

    const after = await behavior(page);
    const ctaOf = (data: Behavior, id: string) => data.ctas.find((row) => row.ctaId === id) ?? { clicks: 0, sessions: 0 };
    // What the endpoint did with the events (these must move by exactly what was sent).
    expect(ctaOf(after, "register_submit").clicks - ctaOf(before, "register_submit").clicks).toBe(1);
    expect(ctaOf(after, "landing_register").clicks - ctaOf(before, "landing_register").clicks).toBe(1);
    expect(ctaOf(after, "landing_login").clicks - ctaOf(before, "landing_login").clicks).toBe(1);
    expect(after.notFound.views - before.notFound.views).toBe(1);
    expect(after.notFound.sessions - before.notFound.sessions).toBe(1);
    expect(after.conversions.sessions - before.conversions.sessions).toBe(3);
    expect(after.conversions.converted - before.conversions.converted).toBe(1);
    expect(after.clientErrors.total - before.clientErrors.total).toBe(2);

    await page.goto("/admin/analytics");
    await expect(page).toHaveURL(/\/tr\/yonetim\/analitik$/);
    await expect(page.getByTestId("top-pages")).toBeVisible();
    for (const heading of ["Sayfalar", "Akışlar", "Bulunamayan sayfalar (404)", "CTA tıklamaları", "Dönüşüm", "İstemci hataları"]) {
      await expect(page.getByRole("heading", { name: heading, level: 2, exact: true })).toBeVisible();
    }

    // CTA clicks: localized names, exact counts.
    const register = page.locator('tr[data-cta="register_submit"]');
    await expect(register).toContainText("Kayıt formu gönderildi");
    await expect(cell(register, 1)).toHaveText(number("tr-TR", ctaOf(after, "register_submit").clicks));
    await expect(page.locator('tr[data-cta="landing_register"]')).toContainText("Ana sayfa: Kayıt ol");
    await expect(page.locator('tr[data-cta="landing_login"]')).toContainText("Ana sayfa: Giriş yap");
    await expect(page.locator("tr[data-cta]")).toHaveCount(after.ctas.length);

    // 404.
    await expect(page.getByTestId("not-found").locator("dd").first()).toHaveText(number("tr-TR", after.notFound.views));
    await expect(page.getByTestId("not-found").locator("dd").nth(1)).toHaveText(number("tr-TR", after.notFound.sessions));

    // Conversion: sessions, converted and the rate, in total and for the campaign source.
    const rate = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });
    const total = page.getByTestId("conversion").locator("dd");
    await expect(total.nth(0)).toHaveText(number("tr-TR", after.conversions.sessions));
    await expect(total.nth(1)).toHaveText(number("tr-TR", after.conversions.converted));
    await expect(total.nth(2)).toHaveText(rate.format(after.conversions.converted / after.conversions.sessions));
    const campaignSource = after.conversions.bySource.find((row) => row.source === "CAMPAIGN")!;
    const sourceRow = page.getByTestId("conversion-source").locator("tr", { hasText: "Kampanya bağlantısı" });
    await expect(cell(sourceRow, 1)).toHaveText(number("tr-TR", campaignSource.sessions));
    await expect(cell(sourceRow, 2)).toHaveText(number("tr-TR", campaignSource.converted));
    await expect(cell(sourceRow, 3)).toHaveText(rate.format(campaignSource.converted / campaignSource.sessions));
    await expect(page.getByTestId("conversion-source").locator("tr", { hasText: "Arama motoru" })).toBeVisible();
    const ours = after.conversions.byCampaign.find((row) => row.campaign === campaign);
    if (ours) {
      const row = page.getByTestId("conversion-campaign").locator("tr", { hasText: campaign });
      await expect(row).toContainText("e2e / playwright");
      await expect(cell(row, 1)).toHaveText("1");
      await expect(cell(row, 3)).toHaveText(rate.format(1));
    }

    // Client errors: total, by kind (localized) and by route template.
    await expect(page.getByTestId("client-errors").locator("dd")).toHaveText(number("tr-TR", after.clientErrors.total));
    const kind = (id: string) => after.clientErrors.byKind.find((row) => row.kind === id)!.count;
    await expect(cell(page.getByTestId("errors-kind").locator("tr", { hasText: "Ekran çizimi hatası" }), 1)).toHaveText(number("tr-TR", kind("render")));
    await expect(cell(page.getByTestId("errors-kind").locator("tr", { hasText: "Ağ hatası" }), 1)).toHaveText(number("tr-TR", kind("network")));

    // The lists are the API's lists: same rows, same order, the route as plain text.
    const pathsOf = async (testId: string) => (await page.getByTestId(testId).locator("tbody tr").evaluateAll((rows) => rows.map((row) => row.querySelector("td")!.textContent!.trim())));
    expect(await pathsOf("top-pages")).toEqual(after.topPages.map((row) => row.path));
    expect(await pathsOf("entry-pages")).toEqual(after.entryPages.map((row) => row.path));
    expect(await pathsOf("exit-pages")).toEqual(after.exitPages.map((row) => row.path));
    expect(await pathsOf("flows")).toEqual(after.flows.map((row) => row.fromPath));
    const firstFlow = page.getByTestId("flows").locator("tbody tr").first();
    await expect(cell(firstFlow, 1)).toHaveText(after.flows[0].toPath);
    await expect(cell(firstFlow, 2)).toHaveText(number("tr-TR", after.flows[0].sessions));
    expect(await pathsOf("errors-route")).toEqual(after.clientErrors.byRoute.map((row) => row.path));
    const firstPage = page.getByTestId("top-pages").locator("tbody tr").first();
    await expect(cell(firstPage, 1)).toHaveText(number("tr-TR", after.topPages[0].views));

    // Every report is a real table: named, with column headers.
    for (const name of ["En çok görüntülenen sayfalar", "Giriş sayfaları", "Çıkış sayfaları", "Sayfa akışları", "CTA tıklamaları", "Trafik kaynağına göre", "Hata türüne göre"]) {
      const table = page.getByRole("table", { name, exact: true });
      await expect(table).toBeVisible();
      expect(await table.getByRole("columnheader").count()).toBeGreaterThanOrEqual(2);
    }
  } finally {
    await visitor.close();
    await admin.context.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------

function simulated(overrides: Record<string, unknown> = {}) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 9, 3 + index)).toISOString().slice(0, 10);
    return { date, visits: index * 2, sessions: index, value: index };
  });
  const longPath = "/projects/[slug]/tasks/[taskId]/edit/very-long-segment-that-could-break-a-narrow-layout-1234567890";
  const behavior: Behavior = {
    topPages: [{ path: "/", views: 120, sessions: 80 }, { path: longPath, views: 40, sessions: 12 }],
    entryPages: [{ path: "/", sessions: 70 }, { path: "/login", sessions: 10 }],
    exitPages: [{ path: "/faq", sessions: 30 }, { path: "/register", sessions: 22 }],
    flows: [{ fromPath: "/", toPath: "/register", sessions: 25 }, { fromPath: "/", toPath: longPath, sessions: 3 }],
    notFound: { views: 7, sessions: 5 },
    ctas: [{ ctaId: "landing_register", clicks: 30, sessions: 25 }, { ctaId: "github_repo", clicks: 4, sessions: 3 }, { ctaId: "future_cta", clicks: 1, sessions: 1 }],
    conversions: {
      sessions: 90, converted: 20,
      bySource: [{ source: "DIRECT", sessions: 60, converted: 15 }, { source: "SEARCH", sessions: 20, converted: 3 }, { source: "CAMPAIGN", sessions: 10, converted: 2 }],
      byCampaign: [{ source: "news", medium: "email", campaign: "<b>launch</b>", sessions: 10, converted: 2 }, { source: null, medium: null, campaign: null, sessions: 1, converted: 0 }],
    },
    clientErrors: { total: 6, byKind: [{ kind: "render", count: 4 }, { kind: "chunk_load", count: 2 }, { kind: "something_new", count: 1 }], byRoute: [{ path: longPath, kind: "render", count: 4 }, { path: "/", kind: "chunk_load", count: 2 }] },
  };
  return {
    range: { from: days[0].date, to: days[6].date, zone: "UTC", days: 7 },
    traffic: {
      visits: 42, uniqueSessions: 12, uniqueVisitors: 9, averageEngagedSeconds: 272,
      daily: days.map(({ date, visits, sessions }) => ({ date, visits, sessions })),
      sources: [{ source: "DIRECT", sessions: 6 }], topReferrers: [], topCampaigns: [],
    },
    registrations: { inRange: 3, daily: days.map(({ date, value }) => ({ date, value })) },
    accounts: { total: 20, active: 17, terminated: 2, pendingVerification: 1, admins: 1 },
    contactRequests: { inRange: 5, total: 11, daily: days.map(({ date, value }) => ({ date, value })) },
    behavior,
    ...overrides,
  };
}

async function simulate(page: Page, body: unknown) {
  await page.route(`${API}/admin/analytics**`, (route) => route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: JSON.stringify(body) }));
}

for (const [locale, code, expectations] of [
  ["tr-TR", "tr", { pages: "Sayfalar", cta: "Ana sayfa: Kayıt ol", unknownKind: "something_new", kind: "Ekran çizimi hatası", empty: "Bu aralıkta kayıt yok." }],
  ["en-US", "en", { pages: "Pages", cta: "Home page: Sign up", unknownKind: "something_new", kind: "Rendering error", empty: "No records in this range." }],
  ["de-DE", "de", { pages: "Seiten", cta: "Startseite: Registrieren", unknownKind: "something_new", kind: "Darstellungsfehler", empty: "Keine Einträge in diesem Zeitraum." }],
] as const) {
  test(`behaviour reports read naturally and stay plain text: ${locale}`, async ({ browser }) => {
    const admin = await newAdmin(browser);
    try {
      const page = admin.page;
      await admin.context.addCookies([{ name: "NEXT_LOCALE", value: code, url: "http://localhost:3000" }]);
      await simulate(page, simulated());
      await page.goto("/admin/analytics");
      await expect(page.getByRole("heading", { name: expectations.pages, level: 2, exact: true })).toBeVisible();
      await expect(page.locator('tr[data-cta="landing_register"]')).toContainText(expectations.cta);
      // An id the page does not know yet is shown as it is, not as a broken translation key.
      await expect(page.locator('tr[data-cta="future_cta"]')).toContainText("future_cta");
      await expect(page.getByTestId("errors-kind")).toContainText(expectations.kind);
      await expect(page.getByTestId("errors-kind")).toContainText(expectations.unknownKind);
      // The rate uses the viewer's language.
      const rate = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(20 / 90);
      expect(normalized(await page.getByTestId("conversion").locator("dd").nth(2).innerText())).toBe(normalized(rate));
      // Campaign names are text, never markup.
      await expect(page.getByText("<b>launch</b>")).toBeVisible();
      await expect(page.locator("b", { hasText: "launch" })).toHaveCount(0);
      // The first-seen client text of a missing campaign is a dash, and a long route is cut visually but kept whole.
      await expect(page.getByTestId("top-pages").locator("[title*='very-long-segment']").first()).toBeVisible();

      // Empty reports say so instead of showing an empty table.
      await page.unroute(`${API}/admin/analytics**`);
      const empty = simulated({
        behavior: {
          topPages: [], entryPages: [], exitPages: [], flows: [], notFound: { views: 0, sessions: 0 }, ctas: [],
          conversions: { sessions: 0, converted: 0, bySource: [], byCampaign: [] }, clientErrors: { total: 0, byKind: [], byRoute: [] },
        },
      });
      await simulate(page, empty);
      await page.reload();
      await expect(page.getByTestId("top-pages")).toContainText(expectations.empty);
      await expect(page.getByTestId("flows")).toContainText(expectations.empty);
      await expect(page.getByTestId("ctas")).toContainText(expectations.empty);
      await expect(page.getByTestId("errors-route")).toContainText(expectations.empty);
      // No sessions: the rate is a dash, never "NaN%".
      await expect(page.getByTestId("conversion").locator("dd").nth(2)).toHaveText("—");
    } finally {
      await admin.context.close();
    }
  });
}

test("a dashboard answer without the behaviour report still renders every other section", async ({ browser }) => {
  const admin = await newAdmin(browser);
  try {
    const page = admin.page;
    const { behavior: _omitted, ...withoutBehavior } = simulated();
    void _omitted;
    await simulate(page, withoutBehavior);
    await page.goto("/admin/analytics");
    await expect(page.getByTestId("overview")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sayfalar", level: 2 })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Kayıtlar", level: 2 })).toBeVisible();
  } finally {
    await admin.context.close();
  }
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`the behaviour reports fit ${width}px in both themes`, async ({ browser }) => {
    const admin = await newAdmin(browser);
    try {
      const page = admin.page;
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await simulate(page, simulated());
      for (const theme of ["light", "dark"]) {
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
        await page.goto("/admin/analytics");
        await expect(page.getByTestId("errors-route")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth), theme).toBeLessThanOrEqual(width);
        // A table may scroll inside its own box, but never push the page sideways.
        for (const table of await page.locator("[data-slot=table-container]").all()) {
          const box = (await table.boundingBox())!;
          expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        }
      }
    } finally {
      await admin.context.close();
    }
  });
}
