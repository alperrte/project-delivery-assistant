import { test, expect, type Page } from "@playwright/test";
import { ANALYTICS_SESSION_KEY, ANALYTICS_VISITOR_KEY } from "../src/features/consent/contract";
import { FRESH_VISITOR } from "./consent-state";
import { analyticsClientErrors, analyticsCtaClicks, analyticsSession } from "./db";
import { uniqueUser } from "./helpers";
import { mailpitAvailable } from "./mailpit";

// Button clicks (CTA_CLICK), client errors (CLIENT_ERROR) and the 12-month visitor renewal, on the real stack:
// browser -> real frontend -> real API -> PostgreSQL. Nothing leaves the browser without analytics consent.
test.use({ storageState: FRESH_VISITOR });

type Sent = { body: Record<string, unknown> };

function watch(page: Page): Sent[] {
  const sent: Sent[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/analytics/events") && request.method() === "POST") sent.push({ body: request.postDataJSON() as Record<string, unknown> });
  });
  return sent;
}

const banner = (page: Page) => page.locator("[data-cookie-banner]");
const accept = async (page: Page) => { await banner(page).getByRole("button", { name: "Tümünü kabul et" }).click(); await expect(banner(page)).toHaveCount(0); };
const reject = async (page: Page) => { await banner(page).getByRole("button", { name: "Tümünü reddet" }).click(); await expect(banner(page)).toHaveCount(0); };
const stored = async (page: Page, key: string) => page.evaluate((name) => localStorage.getItem(name), key);
const sessionId = async (page: Page) => (JSON.parse((await stored(page, ANALYTICS_SESSION_KEY))!) as { id: string }).id;
const visitor = async (page: Page) => JSON.parse((await stored(page, ANALYTICS_VISITOR_KEY))!) as { id: string; createdAt: string };

/** Waits until the page view of this load reached the server, so the session exists before anything else is measured. */
async function firstView(page: Page, sent: Sent[]) {
  await expect.poll(() => sent.some(({ body }) => body.type === "PAGE_VIEW")).toBe(true);
  const id = await sessionId(page);
  await expect.poll(() => analyticsSession(id)?.page_views).toBeGreaterThanOrEqual(1);
  return id;
}

test("without a decision, after a rejection or after withdrawal: no click, error or rejection is ever sent", async ({ page }) => {
  const sent = watch(page);
  const crash = async () => {
    const response = await page.goto("/dev/error-test");
    if (response?.status() === 404) {
      // Production intentionally has no crash button. Exercise its actual browser error listeners instead.
      await expect(page.locator('[data-error-code="404"]')).toBeVisible();
      await page.evaluate(() => {
        window.dispatchEvent(new Event("pda:network-failure"));
        const script = document.createElement("script");
        script.src = "/_next/static/chunks/does-not-exist-e2e.js";
        document.head.appendChild(script);
      });
      return;
    }
    await page.getByRole("button", { name: "Test hatası oluştur", exact: true }).click();
    await expect(page.locator('[data-error-code="500"]')).toBeVisible();
  };

  // No decision yet.
  await page.goto("/");
  await expect(banner(page)).toBeVisible();
  await page.locator("header a[href$='/kayit']").click();
  await page.evaluate(() => { void Promise.reject(new Error("no consent yet")); });
  await crash();
  await page.waitForTimeout(1200);
  expect(sent).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("pda:analytics")))).toEqual([]);

  // Rejected.
  await page.goto("/");
  await reject(page);
  await page.locator("header a[href$='/giris']").click();
  await page.evaluate(() => { void Promise.reject(new Error("rejected")); });
  await crash();
  await page.waitForTimeout(1200);
  expect(sent).toEqual([]);

  // Accepted, then withdrawn: whatever happens afterwards stays local.
  await page.goto("/");
  await page.locator("footer").getByRole("button", { name: "Çerez tercihlerini yönet" }).click();
  await page.getByRole("dialog").getByRole("checkbox", { name: "Analitik" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tercihleri kaydet" }).click();
  await expect.poll(() => sent.length).toBeGreaterThanOrEqual(1);
  await page.locator("footer").getByRole("button", { name: "Çerez tercihlerini yönet" }).click();
  await page.getByRole("dialog").getByRole("checkbox", { name: "Analitik" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tercihleri kaydet" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const afterWithdrawal = sent.length;
  await page.locator("header a[href$='/kayit']").click();
  await page.evaluate(() => { void Promise.reject(new Error("withdrawn")); });
  await crash();
  await page.waitForTimeout(1200);
  expect(sent.length).toBe(afterWithdrawal);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("pda:analytics")))).toEqual([]);
});

test("landing and header buttons and the source link are counted, in order, after the page view of the same session", async ({ page, context }) => {
  // The source link leaves the site: answer GitHub with a stand-in so the test needs no internet.
  await context.route("https://github.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>stand-in</title>" }));
  const sent = watch(page);
  await page.goto("/");
  await accept(page);
  const id = await firstView(page, sent);

  const clicks: string[] = [];
  const click = async (selector: string, expected: string) => {
    // The click waits behind the page view of this load in the sending queue, and a link that leaves the site ends the
    // page: give the view time to arrive, as a person reading the page would.
    const views = analyticsSession(id)!.page_views;
    await page.goto("/");
    await expect.poll(() => analyticsSession(id)!.page_views).toBeGreaterThan(views);
    await page.locator(selector).first().scrollIntoViewIfNeeded();
    await page.locator(selector).first().click();
    clicks.push(expected);
    await expect.poll(() => analyticsCtaClicks(id), { timeout: 15_000 }).toEqual(clicks);
  };
  await click("header a[href$='/giris']", "header_login");
  await click("header a[href$='/kayit']", "header_register");
  await click("#join a[href$='/kayit']", "landing_register");
  await click("#join a[href$='/giris']", "landing_login");
  await click("footer a[href='https://github.com/alperrte/project-delivery-assistant']", "github_repo");
  await click("#open-source a[href='https://github.com/alperrte/project-delivery-assistant']", "github_repo");

  // The session exists before its first click was stored: page views came first.
  expect(analyticsSession(id)!.page_views).toBeGreaterThanOrEqual(2);
  // Only the id and the page type left the browser, never a label, address or identity.
  const ctaBodies = sent.filter(({ body }) => body.type === "CTA_CLICK").map(({ body }) => body);
  expect(ctaBodies.length).toBeGreaterThanOrEqual(5);
  for (const body of ctaBodies) {
    expect(Object.keys(body).sort()).toEqual(["consentVersion", "ctaId", "path", "sessionId", "type", "visitorId"]);
    expect(body.path).toBe("/");
    expect(body.sessionId).toBe(id);
  }
});

test("public header buttons on information pages are counted too", async ({ page }) => {
  const sent = watch(page);
  await page.goto("/faq");
  await accept(page);
  const id = await firstView(page, sent);
  await page.locator("header a[href$='/giris']").click();
  await expect(page).toHaveURL(/\/tr\/giris$/);
  await expect.poll(() => analyticsCtaClicks(id)).toEqual(["header_login"]);
  await page.goto("/faq");
  await page.locator("header a[href$='/kayit']").click();
  await expect.poll(() => analyticsCtaClicks(id)).toEqual(["header_login", "header_register"]);
});

test("a submitted registration and a sent contact message are counted as conversions; a failed one is not", async ({ page }) => {
  test.setTimeout(90_000);
  expect(await mailpitAvailable()).toBe(true);
  const sent = watch(page);
  await page.goto("/register");
  await accept(page);
  const id = await firstView(page, sent);

  // A refused registration (a taken e-mail would be a real send; a network failure is the simplest refusal) counts nothing.
  await page.route("**/api/v1/auth/register", (route) => route.abort());
  const user = uniqueUser("cta");
  const fillRegistration = async () => {
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="nickname"]').fill(user.nickname);
    await page.locator('input[name="password"]').fill(user.password);
    await page.locator('input[name="confirmPassword"]').fill(user.password);
    await page.getByRole("button", { name: /^Kayıt ol$/ }).click();
  };
  await fillRegistration();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await page.waitForTimeout(800);
  expect(analyticsCtaClicks(id)).toEqual([]);
  // ...but the dead connection itself is a "network" error, once.
  await expect.poll(() => analyticsClientErrors(id).map((error) => error.error_kind)).toEqual(["NETWORK"]);
  await page.unroute("**/api/v1/auth/register");

  await page.getByRole("button", { name: /^Kayıt ol$/ }).click();
  await expect(page).toHaveURL(/\/tr\/e-posta-dogrula$/, { timeout: 15_000 });
  await expect.poll(() => analyticsCtaClicks(id)).toEqual(["register_submit"]);

  // The contact form: counted after the server confirmed, not before.
  await page.goto("/contact");
  await page.getByLabel("Ad", { exact: true }).fill("Ece");
  await page.getByLabel("E-posta", { exact: true }).fill(`${user.nickname}@example.test`);
  await page.getByLabel("Mesaj", { exact: true }).fill(`Analitik uçtan uca testi ${user.nickname}`);
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByRole("status")).toContainText("Mesajınız gönderildi.");
  await expect.poll(() => analyticsCtaClicks(id)).toEqual(["register_submit", "contact_submit"]);
});

test("controlled render crashes are reported by kind only, once per session and route", async ({ page }) => {
  const sent = watch(page);
  const response = await page.goto("/dev/error-test");
  test.skip(response?.status() === 404, "The controlled render-crash route is intentionally disabled in production.");
  await accept(page);
  const id = await firstView(page, sent);

  // Render error (the controlled crash of the development-only route): twice, reported once.
  for (let round = 0; round < 2; round++) {
    await page.getByRole("button", { name: "Test hatası oluştur", exact: true }).click();
    await expect(page.locator('[data-error-code="500"]')).toBeVisible();
    await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
    await expect(page.getByRole("button", { name: "Test hatası oluştur", exact: true })).toBeVisible();
  }
  await expect.poll(() => analyticsClientErrors(id)).toEqual([{ path: "/dev/error-test", error_kind: "RENDER" }]);
  const errorBodies = sent.filter(({ body }) => body.type === "CLIENT_ERROR").map(({ body }) => body);
  expect(errorBodies).toHaveLength(1);
  expect(Object.keys(errorBodies[0]).sort()).toEqual(["consentVersion", "errorKind", "path", "sessionId", "type", "visitorId"]);
  expect(JSON.stringify(errorBodies)).not.toMatch(/PDA controlled error|stack|localhost/);
});

test("client errors: an unhandled promise, a missing script and a dead connection are reported by kind only, once per session and route", async ({ page }) => {
  const sent = watch(page);
  await page.goto("/faq");
  await accept(page);
  const id = await firstView(page, sent);

  // Unhandled promise rejection (twice, with a secret in the message that must not travel), then a script of the
  // application that does not load.
  for (let i = 0; i < 2; i++) await page.evaluate(() => { void Promise.reject(new Error("SECRET-MESSAGE-123 token=abc")); });
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.src = "/_next/static/chunks/does-not-exist-e2e.js";
    document.head.appendChild(script);
  });
  for (let i = 0; i < 2; i++) await page.evaluate(() => window.dispatchEvent(new Event("pda:network-failure")));
  await expect.poll(() => analyticsClientErrors(id).map((error) => error.error_kind).sort()).toEqual(["CHUNK_LOAD", "NETWORK", "UNHANDLED_REJECTION"]);
  await page.waitForTimeout(800);
  expect(analyticsClientErrors(id)).toHaveLength(3);

  // A cancelled request is routine and is not an error.
  await page.evaluate(() => { void Promise.reject(new DOMException("aborted", "AbortError")); });
  await page.waitForTimeout(800);
  expect(analyticsClientErrors(id)).toHaveLength(3);

  // What left the browser: kind and route only. No message, stack, token or address.
  const errorBodies = sent.filter(({ body }) => body.type === "CLIENT_ERROR").map(({ body }) => body);
  expect(errorBodies).toHaveLength(3);
  for (const body of errorBodies) {
    expect(Object.keys(body).sort()).toEqual(["consentVersion", "errorKind", "path", "sessionId", "type", "visitorId"]);
    expect(["render", "chunk_load", "unhandled_rejection", "network"]).toContain(body.errorKind);
  }
  const wire = JSON.stringify(sent.map(({ body }) => body));
  for (const secret of ["SECRET-MESSAGE", "token=abc", "does-not-exist", "PDA controlled error", "localhost", "stack"]) expect(wire).not.toContain(secret);
});

test("a click after a long idle period opens its session first: the page view comes before the click", async ({ page }) => {
  const sent = watch(page);
  await page.goto("/faq");
  await accept(page);
  const first = await firstView(page, sent);

  // The 30-minute idle limit passed: the stored session is stale, so the next event starts a new one.
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ id: JSON.parse(localStorage.getItem(key)!).id, lastActive: 1 })), ANALYTICS_SESSION_KEY);
  await page.locator("header a[href$='/kayit']").click();
  await expect.poll(async () => (await sessionId(page)) !== first).toBe(true);
  const second = await sessionId(page);
  await expect.poll(() => analyticsCtaClicks(second)).toEqual(["header_register"]);
  // The new session knows the page it was announced on and was opened by exactly one view of it (no duplicate).
  const row = analyticsSession(second)!;
  expect(row.views[0]).toBe("/faq");
  expect(row.views.filter((path) => path === "/faq")).toHaveLength(1);
});

test("the anonymous visitor id is renewed after 12 months, kept before, and an older plain id is adopted", async ({ page }) => {
  const sent = watch(page);
  await page.goto("/faq");
  await accept(page);
  await firstView(page, sent);
  const original = await visitor(page);
  expect(original.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(Math.abs(Date.now() - Date.parse(original.createdAt))).toBeLessThan(60_000);

  const monthsAgo = (months: number) => { const date = new Date(); date.setMonth(date.getMonth() - months); return date.toISOString(); };
  const seed = (value: string) => page.evaluate(([key, raw]) => localStorage.setItem(key, raw), [ANALYTICS_VISITOR_KEY, value]);

  // 11 months old: kept.
  const young = { id: "33333333-3333-4333-8333-333333333333", createdAt: monthsAgo(11) };
  await seed(JSON.stringify(young));
  await page.reload();
  await expect.poll(() => sent.some(({ body }) => body.visitorId === young.id)).toBe(true);
  expect(await visitor(page)).toEqual(young);

  // 13 months old: replaced by a new random id, and the session moves with it (the server refuses a foreign visitor id).
  const old = { id: "44444444-4444-4444-8444-444444444444", createdAt: monthsAgo(13) };
  await seed(JSON.stringify(old));
  const sentBefore = sent.length;
  await page.reload();
  await expect.poll(() => sent.length).toBeGreaterThan(sentBefore);
  const renewed = await visitor(page);
  expect(renewed.id).not.toBe(old.id);
  expect(renewed.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(Math.abs(Date.now() - Date.parse(renewed.createdAt))).toBeLessThan(60_000);
  const after = sent.slice(sentBefore).map(({ body }) => body);
  expect(after.every((body) => body.visitorId === renewed.id)).toBe(true);
  const renewedSession = await sessionId(page);
  await expect.poll(() => analyticsSession(renewedSession)?.visitor_id).toBe(renewed.id);

  // A plain id from an earlier version is kept (its age is unknown, so it counts from now) and stored in the new format.
  const plain = "55555555-5555-4555-8555-555555555555";
  await seed(plain);
  const sentMid = sent.length;
  await page.reload();
  await expect.poll(() => sent.length).toBeGreaterThan(sentMid);
  const adopted = await visitor(page);
  expect(adopted.id).toBe(plain);
  expect(Math.abs(Date.now() - Date.parse(adopted.createdAt))).toBeLessThan(60_000);
});
