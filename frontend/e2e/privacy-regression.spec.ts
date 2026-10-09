import { test, expect, type Page } from "@playwright/test";
import { ANALYTICS_SESSION_KEY } from "../src/features/consent/contract";
import { FRESH_VISITOR } from "./consent-state";
import { analyticsSession, psql } from "./db";
import { mailpitAvailable, mailsContaining } from "./mailpit";
import { registerUser, uniqueUser } from "./helpers";

// Cross-cutting privacy and abuse checks on the real stack (the focused scenarios live in the analytics, contact and
// admin specs): cookies, hostile input on the public endpoints, and what the server keeps.

const watch = (page: Page) => {
  const sent: { body: Record<string, unknown> }[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/analytics/events") && request.method() === "POST") sent.push({ body: request.postDataJSON() });
  });
  return sent;
};

/** A POST to a public endpoint with the page's own CSRF token, returning the status and the problem code. */
async function post(page: Page, path: string, body: unknown, raw = false) {
  return page.evaluate(async ({ path, body, raw }) => {
    const base = "http://localhost:8080/api/v1";
    const { headerName } = await (await fetch(`${base}/auth/csrf`, { credentials: "include" })).json();
    const token = decodeURIComponent(document.cookie.split("; ").find((row) => row.startsWith("XSRF-TOKEN="))?.slice(11) ?? "");
    const res = await fetch(`${base}${path}`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", [headerName]: token },
      body: raw ? (body as string) : JSON.stringify(body),
    });
    return { status: res.status, code: ((await res.json().catch(() => null)) as { code?: string } | null)?.code ?? null };
  }, { path, body, raw });
}

test.describe("fresh visitor", () => {
  test.use({ storageState: FRESH_VISITOR });

  test("no analytics cookie exists in any consent state: the only cookies are the necessary ones", async ({ page, context }) => {
    const necessary = new Set(["NEXT_LOCALE", "XSRF-TOKEN", "PDA_SESSION", "PDA_ACCESS", "PDA_REFRESH", "JSESSIONID"]);
    await page.goto("/login");
    await expect(page.locator("[data-cookie-banner]")).toBeVisible();
    await registerUser(page, uniqueUser("cok"));
    for (const state of ["undecided", "rejected", "accepted"]) {
      if (state === "rejected") await page.evaluate(() => localStorage.setItem("pda:cookie-consent", JSON.stringify({ version: 1, necessary: true, analytics: false, updatedAt: new Date().toISOString() })));
      if (state === "accepted") await page.evaluate(() => localStorage.setItem("pda:cookie-consent", JSON.stringify({ version: 1, necessary: true, analytics: true, updatedAt: new Date().toISOString() })));
      await page.goto("/dashboard");
      await page.waitForTimeout(800);
      const names = (await context.cookies()).map((cookie) => cookie.name);
      expect(names.filter((name) => !necessary.has(name)), `${state}: ${names.join(",")}`).toEqual([]);
    }
  });

  test("analytics refuses fake events and hostile values through the real API, and keeps nothing it should not", async ({ page }) => {
    await page.goto("/faq");
    const visitor = crypto.randomUUID();
    const session = crypto.randomUUID();
    const good = { type: "PAGE_VIEW", visitorId: visitor, sessionId: session, path: "/faq", consentVersion: 1 };
    for (const type of ["ADMIN_LOGIN", "REGISTRATION", "CONTACT_SUBMITTED", "LOGIN"]) {
      expect((await post(page, "/analytics/events", { ...good, type })).status, type).toBe(400);
    }
    for (const path of ["/faq?token=abc", "https://evil.example/", "//evil", "/a b", `/${"x".repeat(250)}`]) {
      expect((await post(page, "/analytics/events", { ...good, path })).status, path).toBe(400);
    }
    expect((await post(page, "/analytics/events", "{not json", true)).status).toBe(400);
    expect((await post(page, "/analytics/events", { ...good, utmCampaign: "x".repeat(3000) })).status).toBe(413);
    expect(analyticsSession(session)).toBeNull();

    // Identity fields and markup in campaign values are not stored: the page view is kept, the extras are dropped.
    const accepted = await post(page, "/analytics/events", { ...good, userId: crypto.randomUUID(), role: "ADMIN", utmCampaign: "<script>alert(1)</script>", referrerHost: "evil.example/path?x=1" });
    expect(accepted.status).toBe(204);
    const row = analyticsSession(session)!;
    expect(row.utm_campaign).toBeNull();
    expect(row.referrer_domain).toBeNull();
    expect(row.source_type).toBe("DIRECT");
    expect(psql("SELECT count(*) FROM information_schema.columns WHERE table_name IN ('analytics_sessions','analytics_page_views') AND column_name ~ '(user|email|ip|agent|query|token)'")).toBe("0");
  });

  test("a campaign link with a token in the address never lets the token reach analytics", async ({ page }) => {
    const sent = watch(page);
    await page.goto("/login?utm_campaign=%3Cb%3Ex%3C%2Fb%3E&invitation=SECRET-INVITE&code=123456&reset=abc");
    await page.locator("[data-cookie-banner]").getByRole("button", { name: "Tümünü kabul et" }).click();
    await expect.poll(() => sent.length).toBeGreaterThanOrEqual(1);
    const everything = JSON.stringify(sent);
    for (const secret of ["SECRET-INVITE", "123456", "reset=", "invitation", "code="]) expect(everything).not.toContain(secret);
    const id = (JSON.parse((await page.evaluate((key) => localStorage.getItem(key), ANALYTICS_SESSION_KEY))!) as { id: string }).id;
    await expect.poll(() => analyticsSession(id)?.page_views).toBe(1);
    expect(analyticsSession(id)!.utm_campaign).toBeNull();
  });
});

test("the contact form keeps markup as text and never relays: script text arrives verbatim, nobody else gets a copy", async ({ page }) => {
  expect(await mailpitAvailable()).toBe(true);
  const marker = `xss-${Date.now()}`;
  await page.goto("/contact");
  await page.getByLabel("Ad", { exact: true }).fill("<img src=x onerror=alert(1)>");
  await page.getByLabel("Soyad", { exact: true }).fill("Test");
  await page.getByLabel("E-posta", { exact: true }).fill(`${marker}@example.test`);
  await page.getByLabel("Mesaj", { exact: true }).fill(`<script>alert("${marker}")</script> merhaba`);
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByRole("status")).toContainText("Mesajınız gönderildi.");
  await expect.poll(async () => (await mailsContaining(marker)).length, { timeout: 15_000 }).toBe(1);
  const mail = (await mailsContaining(marker))[0];
  expect(mail.Text).toContain(`<script>alert("${marker}")</script> merhaba`);
  expect(mail.Text).toContain("<img src=x onerror=alert(1)> Test");
  expect(mail.To.map((address) => address.Address)).toEqual(["pdassistant@gmail.com"]);
  // Nothing of the submission is persisted by the application.
  expect(psql(`SELECT count(*) FROM contact_requests WHERE id::text LIKE '%${marker}%'`)).toBe("0");
});
