import { test, expect, type Page } from "@playwright/test";
import { ANALYTICS_SESSION_KEY, ANALYTICS_VISITOR_KEY } from "../src/features/consent/contract";
import { FRESH_VISITOR } from "./consent-state";
import { analyticsSession } from "./db";
import { registerUser, uniqueUser } from "./helpers";

// First-time visitors on the real stack: browser -> real frontend -> real API -> PostgreSQL.
test.use({ storageState: FRESH_VISITOR });

type Sent = { url: string; body: Record<string, unknown> };

function watch(page: Page): Sent[] {
  const sent: Sent[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/analytics/events") && request.method() === "POST") {
      sent.push({ url: request.url(), body: request.postDataJSON() as Record<string, unknown> });
    }
  });
  return sent;
}

const banner = (page: Page) => page.locator("[data-cookie-banner]");
const accept = async (page: Page) => { await banner(page).getByRole("button", { name: "Tümünü kabul et" }).click(); await expect(banner(page)).toHaveCount(0); };
const reject = async (page: Page) => { await banner(page).getByRole("button", { name: "Tümünü reddet" }).click(); await expect(banner(page)).toHaveCount(0); };
const analyticsKeys = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("pda:analytics")));
const sessionId = async (page: Page) => {
  const raw = await page.evaluate((key) => localStorage.getItem(key), ANALYTICS_SESSION_KEY);
  return (JSON.parse(raw!) as { id: string }).id;
};

test("no decision: browsing sends no analytics request and creates no identifier", async ({ page }) => {
  const sent = watch(page);
  await page.goto("/login");
  await expect(banner(page)).toBeVisible();
  await page.goto("/faq");
  await page.goto("/register");
  await page.goto("/privacy");
  await page.waitForTimeout(1500);
  expect(sent).toEqual([]);
  expect(await analyticsKeys(page)).toEqual([]);
});

test("reject all: nothing is sent, also after a reload and across pages, and sign-in still works", async ({ page }) => {
  const sent = watch(page);
  await page.goto("/login");
  await reject(page);
  await page.reload();
  await page.goto("/faq");
  const user = uniqueUser("rej");
  await registerUser(page, user);
  await page.goto("/dashboard");
  await page.waitForTimeout(1500);
  expect(sent).toEqual([]);
  expect(await analyticsKeys(page)).toEqual([]);
});

test("accept: page views reach PostgreSQL as route templates without query, token or identity", async ({ page }) => {
  const sent = watch(page);
  const campaign = `e2e-${Date.now()}`;
  await page.goto(`/login?utm_source=e2e&utm_medium=playwright&utm_campaign=${campaign}&token=SECRET-TOKEN&invitation=abc`);
  await accept(page);
  await expect.poll(() => sent.length).toBeGreaterThanOrEqual(1);
  const id = await sessionId(page);
  const visitor = await page.evaluate((key) => localStorage.getItem(key), ANALYTICS_VISITOR_KEY);
  expect(visitor).toMatch(/^[0-9a-f-]{36}$/);

  await page.getByRole("link", { name: "Kayıt ol" }).first().click();
  await expect(page).toHaveURL(/\/tr\/kayit$/);
  await page.goto("/tr/sss?secret=123");
  await expect.poll(() => analyticsSession(id)?.page_views).toBe(3);

  const row = analyticsSession(id)!;
  expect(row.entry_path).toBe("/login");
  expect(row.source_type).toBe("CAMPAIGN");
  expect([row.utm_source, row.utm_medium, row.utm_campaign]).toEqual(["e2e", "playwright", campaign]);
  expect(row.visitor_id).toBe(visitor);
  expect(row.consent_version).toBe(1);
  expect(row.views).toEqual(["/login", "/register", "/faq"]);

  // What actually left the browser: only the allowed fields; never a query value, token, address or user identity.
  const allowed = new Set(["type", "path", "visitorId", "sessionId", "consentVersion", "referrerHost", "utmSource", "utmMedium", "utmCampaign", "engagedSeconds"]);
  for (const { body } of sent) {
    expect(Object.keys(body).every((key) => allowed.has(key))).toBe(true);
    expect(String(body.path)).toMatch(/^\/[A-Za-z0-9/_\[\]-]*$/);
  }
  const everything = JSON.stringify(sent.map(({ body }) => body));
  for (const secret of ["SECRET-TOKEN", "invitation", "secret=123", "?", "localhost", "userId"]) expect(everything).not.toContain(secret);
  // UTM values travel only with the first page view of the session.
  expect(sent.filter(({ body }) => body.type === "PAGE_VIEW" && body.utmCampaign).length).toBe(1);
});

test("the choice survives a reload and a returning visitor is measured without being asked again", async ({ page }) => {
  const sent = watch(page);
  await page.goto("/faq");
  await accept(page);
  await expect.poll(() => sent.length).toBeGreaterThanOrEqual(1);
  const before = sent.length;
  await page.reload();
  await expect(banner(page)).toHaveCount(0);
  await expect.poll(() => sent.length).toBeGreaterThan(before);
});

test("withdrawal stops sending at once and removes the analytics identifiers", async ({ page }) => {
  const sent = watch(page);
  await page.goto("/faq");
  await accept(page);
  await expect.poll(() => sent.length).toBeGreaterThanOrEqual(1);
  expect((await analyticsKeys(page)).sort()).toEqual([ANALYTICS_SESSION_KEY, ANALYTICS_VISITOR_KEY].sort());

  await page.locator("footer").getByRole("button", { name: "Çerez tercihlerini yönet" }).click();
  await page.getByRole("dialog").getByRole("checkbox", { name: "Analitik" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tercihleri kaydet" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await analyticsKeys(page)).toEqual([]);

  const afterWithdrawal = sent.length;
  await page.goto("/privacy");
  await page.goto("/kvkk");
  await page.waitForTimeout(2000);
  expect(sent.length).toBe(afterWithdrawal);
  expect(await analyticsKeys(page)).toEqual([]);

  // Switching it on again starts a new anonymous identity (never the removed one).
  await page.locator("footer").getByRole("button", { name: "Çerez tercihlerini yönet" }).click();
  await page.getByRole("dialog").getByRole("checkbox", { name: "Analitik" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tercihleri kaydet" }).click();
  await expect.poll(() => sent.length).toBeGreaterThan(afterWithdrawal);
});

test("traffic sources: direct, search engine and other site (host only, through a real link click)", async ({ browser }) => {
  const cases = [
    { from: undefined, source: "DIRECT", domain: null },
    { from: "https://www.google.com/search?q=pda+secret", source: "SEARCH", domain: "google.com" },
    { from: "https://example.org/some/page?token=abc#frag", source: "REFERRAL", domain: "example.org" },
  ] as const;
  for (const entry of cases) {
    const context = await browser.newContext({ storageState: FRESH_VISITOR });
    const page = await context.newPage();
    const sent = watch(page);
    if (entry.from) {
      // A stand-in for the external site; it asks the browser to send the FULL address as the referrer, so the test
      // proves PDA itself reduces it to a host. The click is a real cross-site navigation into PDA.
      await context.route((url) => url.host === new URL(entry.from).host, (route) => route.fulfill({
        contentType: "text/html",
        body: '<meta name="referrer" content="unsafe-url"><a id="go" href="http://localhost:3000/tr/sss">PDA</a>',
      }));
      await page.goto(entry.from);
      await page.locator("#go").click();
    } else {
      await page.goto("/tr/sss");
    }
    await expect(page).toHaveURL(/\/tr\/sss$/);
    await accept(page);
    await expect.poll(() => sent.length).toBeGreaterThanOrEqual(1);
    const id = await sessionId(page);
    await expect.poll(() => analyticsSession(id)?.source_type).toBe(entry.source);
    expect(analyticsSession(id)!.referrer_domain).toBe(entry.domain);
    // Only the host crossed the wire, never the referring path, query or fragment.
    const bodies = JSON.stringify(sent.map(({ body }) => body));
    expect(bodies).not.toMatch(/secret|token=|some\/page|#frag|search/);
    if (entry.domain) expect(bodies).toContain(`"referrerHost":"${entry.domain === "google.com" ? "www.google.com" : entry.domain}"`);
    await context.close();
  }
});

test("only visible, focused time counts: a background tab accrues no engagement", async ({ page }) => {
  await page.clock.install();
  const sent = watch(page);
  await page.goto("/faq");
  await accept(page);
  await expect.poll(() => sent.length).toBeGreaterThanOrEqual(1);
  const seconds = () => sent.filter(({ body }) => body.type === "ENGAGEMENT").reduce((sum, { body }) => sum + Number(body.engagedSeconds), 0);

  // Foreground: the heartbeat reports the visible time.
  await page.clock.runFor(16_000);
  await expect.poll(seconds).toBeGreaterThanOrEqual(14);
  const foreground = seconds();
  expect(foreground).toBeLessThanOrEqual(20);

  // The tab goes to the background for a long time: nothing is added.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
  const atHide = seconds();
  await page.clock.runFor(120_000);
  await page.waitForTimeout(300);
  expect(seconds()).toBe(atHide);
  expect(atHide - foreground).toBeLessThanOrEqual(2);

  // Back in the foreground: counting resumes from now, not from the time away.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(16_000);
  await expect.poll(seconds).toBeGreaterThan(atHide + 10);
  expect(seconds() - atHide).toBeLessThanOrEqual(20);
});

test("real foreground time is stored: engagement is credited by the server", async ({ page }) => {
  test.setTimeout(90_000);
  const sent = watch(page);
  await page.goto("/faq");
  await accept(page);
  await expect.poll(() => sent.length).toBeGreaterThanOrEqual(1);
  const id = await sessionId(page);
  await expect.poll(() => sent.some(({ body }) => body.type === "ENGAGEMENT"), { timeout: 40_000, intervals: [1_000] }).toBe(true);
  await expect.poll(() => analyticsSession(id)!.engaged_seconds, { timeout: 10_000 }).toBeGreaterThanOrEqual(10);
  expect(analyticsSession(id)!.engaged_seconds).toBeLessThanOrEqual(30);
});

test("signed in or out, events carry no account identity and switching accounts leaks nothing", async ({ page }) => {
  const sent = watch(page);
  await page.goto("/login");
  await accept(page);
  await expect.poll(() => sent.length).toBeGreaterThanOrEqual(1);

  const a = uniqueUser("ana");
  await registerUser(page, a);
  await page.goto("/dashboard");
  const meA = await page.evaluate(async () => (await (await fetch("http://localhost:8080/api/v1/auth/me", { credentials: "include" })).json()) as { id: string });
  await page.goto("/settings");
  await expect.poll(() => sent.length).toBeGreaterThanOrEqual(3);
  const visitorBefore = await page.evaluate((key) => localStorage.getItem(key), ANALYTICS_VISITOR_KEY);
  const markA = sent.length;

  // Sign out and in as another account on the same device: consent stays, identity must not.
  await page.context().clearCookies();
  const b = uniqueUser("ben");
  await registerUser(page, b);
  const meB = await page.evaluate(async () => (await (await fetch("http://localhost:8080/api/v1/auth/me", { credentials: "include" })).json()) as { id: string });
  await page.goto("/account");
  await expect.poll(() => sent.length).toBeGreaterThan(markA);

  const text = JSON.stringify(sent);
  for (const needle of [meA.id, meB.id, a.email, b.email, a.nickname, b.nickname]) expect(text).not.toContain(needle);
  for (const { body } of sent) expect(Object.keys(body)).not.toContain("userId");
  // The anonymous visitor id is a property of the browser, not of an account.
  expect(await page.evaluate((key) => localStorage.getItem(key), ANALYTICS_VISITOR_KEY)).toBe(visitorBefore);
  // Consent was not flipped by the account change.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pda:cookie-consent")!).analytics)).toBe(true);
});
