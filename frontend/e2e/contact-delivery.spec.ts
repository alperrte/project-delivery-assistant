import { test, expect, type Page } from "@playwright/test";
import { psql } from "./db";
import { mailpitAvailable, mailsContaining } from "./mailpit";

// A logged-out visitor on the real stack: browser -> frontend -> API -> SMTP code path -> Mailpit sink, rows in PostgreSQL.
// (No session cookies; the cookie banner is not the subject here, so the visitor has already decided.)

const RECIPIENT = "pdassistant.info@gmail.com";

const sentRows = () => Number(psql("SELECT count(*) FROM contact_requests WHERE delivery_status = 'SENT'"));
const failedRows = () => Number(psql("SELECT count(*) FROM contact_requests WHERE delivery_status = 'FAILED'"));

type SupportRow = { category: string; first_name: string; last_name: string | null; email: string; message: string; status: string; delivery_status: string };
/** The stored support messages written by one test (found by its unique address). */
function supportRows(marker: string): SupportRow[] {
  const out = psql(`SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
    SELECT category, first_name, last_name, email, message, status, delivery_status FROM support_requests WHERE email LIKE '${marker.replace(/[^A-Za-z0-9-]/g, "")}%' ORDER BY created_at) t`);
  return JSON.parse(out) as SupportRow[];
}

/** Posts to the real endpoint from the page (same CSRF dance the application client does). */
async function post(page: Page, body: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> {
  return page.evaluate(async (payload) => {
    const base = "http://localhost:8080/api/v1";
    const { headerName } = await (await fetch(`${base}/auth/csrf`, { credentials: "include" })).json();
    const token = decodeURIComponent(document.cookie.split("; ").find((row) => row.startsWith("XSRF-TOKEN="))?.slice(11) ?? "");
    const res = await fetch(`${base}/contact`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", [headerName]: token },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }, body);
}

test.beforeAll(async () => {
  expect(await mailpitAvailable(), "Start the e2e stack: docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d").toBe(true);
});

test("a logged-out visitor sends a message: the mail reaches the sink with the fixed recipient, Reply-To, sender and category, a row is stored and the count moves", async ({ page }) => {
  const marker = `e2e-contact-${Date.now()}`;
  const before = sentRows();
  await page.goto("/contact");
  await expect(page).toHaveURL(/\/tr\/iletisim$/);
  await page.getByLabel("Ad", { exact: true }).fill("Ece");
  await page.getByLabel("Soyad", { exact: true }).fill("Yıldız");
  await page.getByLabel("E-posta", { exact: true }).fill(`${marker}@example.test`);
  await page.getByLabel("Mesaj", { exact: true }).fill(`Merhaba,\nbu bir uçtan uca testtir: ${marker}`);
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByRole("status")).toContainText("Mesajınız gönderildi.");
  await expect(page.getByLabel("Mesaj", { exact: true })).toHaveCount(0);

  await expect.poll(async () => (await mailsContaining(marker)).length, { timeout: 15_000 }).toBe(1);
  const mail = (await mailsContaining(marker))[0];
  expect(mail.Subject).toBe("Yeni PDA İletişim Talebi [Genel]");
  expect(mail.To.map((a) => a.Address)).toEqual([RECIPIENT]);
  expect(mail.ReplyTo.map((a) => a.Address)).toEqual([`${marker}@example.test`]);
  expect(mail.From.Address).toBe("pda-e2e@example.test");
  expect(mail.Cc).toEqual([]);
  expect(mail.Bcc).toEqual([]);
  expect(mail.Text).toContain("Ece Yıldız");
  expect(mail.Text.replace(/\r\n/g, "\n")).toContain("Kategori:\nGenel");
  expect(mail.Text).toContain(`bu bir uçtan uca testtir: ${marker}`);
  expect(sentRows()).toBe(before + 1);

  // The message is also kept (12 months) with its category, as the notice under the form says.
  const rows = supportRows(marker);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ category: "GENERAL", first_name: "Ece", last_name: "Yıldız", email: `${marker}@example.test`, status: "NEW", delivery_status: "SENT" });
  expect(rows[0].message).toContain(marker);
});

test("the chosen category and an empty last name travel through the real form: subject label, stored category and no last name", async ({ page }) => {
  const marker = `e2e-category-${Date.now()}`;
  await page.goto("/contact");
  await page.getByLabel("Ad", { exact: true }).fill("Can");
  await page.getByLabel("E-posta", { exact: true }).fill(`${marker}@example.test`);
  await page.getByRole("combobox", { name: "Kategori" }).click();
  await page.getByRole("option", { name: "KVKK veya veri talebi" }).click();
  await page.getByLabel("Mesaj", { exact: true }).fill(`Verilerimin bir kopyasını istiyorum: ${marker}`);
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByRole("status")).toContainText("Mesajınız gönderildi.");

  await expect.poll(async () => (await mailsContaining(marker)).length, { timeout: 15_000 }).toBe(1);
  const mail = (await mailsContaining(marker))[0];
  expect(mail.Subject).toBe("Yeni PDA İletişim Talebi [KVKK/GDPR veri talebi]");
  expect(mail.Text.replace(/\r\n/g, "\n")).toContain("Kategori:\nKVKK/GDPR veri talebi");
  const rows = supportRows(marker);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ category: "DATA_REQUEST", first_name: "Can", last_name: null, status: "NEW" });
});

test("a bot that fills the hidden field still sees success, but nothing is mailed and nothing is stored", async ({ page }) => {
  const marker = `e2e-honeypot-${Date.now()}`;
  const before = sentRows();
  await page.goto("/contact");
  await page.getByLabel("Ad", { exact: true }).fill("Bot");
  await page.getByLabel("E-posta", { exact: true }).fill(`${marker}@example.test`);
  await page.getByLabel("Mesaj", { exact: true }).fill(`Buy cheap watches ${marker}`);
  // A person cannot reach this field; filling it stands in for a form-filling bot.
  await page.locator('input[name="website"]').fill("https://spam.example.test");
  await page.getByRole("button", { name: "Gönder" }).click();
  await expect(page.getByRole("status")).toContainText("Mesajınız gönderildi.");

  await page.waitForTimeout(2500);
  expect(await mailsContaining(marker)).toHaveLength(0);
  expect(supportRows(marker)).toHaveLength(0);
  expect(sentRows()).toBe(before);
});

test("the server's bot traps through the real API: honeypot, too-fast, stale and future timers", async ({ page }) => {
  await page.goto("/contact");
  const marker = `e2e-trap-${Date.now()}`;
  const good = { firstName: "Eve", email: `${marker}@example.test`, message: `Trap test message ${marker}`, category: "GENERAL" };
  const before = sentRows();

  // Honeypot filled: the very same answer as a real send, and nothing happens (also with an otherwise invalid body).
  const honey = await post(page, { ...good, website: "x", startedAt: Date.now() - 10_000 });
  expect(honey).toEqual({ status: 200, json: { status: "SENT" } });
  const honeyInvalid = await post(page, { website: "x", email: "not-an-email" });
  expect(honeyInvalid).toEqual({ status: 200, json: { status: "SENT" } });

  // Submitted less than 3 seconds after the form was shown: dropped the same way.
  const fast = await post(page, { ...good, website: "", startedAt: Date.now() });
  expect(fast).toEqual({ status: 200, json: { status: "SENT" } });
  await page.waitForTimeout(2000);
  expect(await mailsContaining(marker)).toHaveLength(0);
  expect(supportRows(marker)).toHaveLength(0);
  expect(sentRows()).toBe(before);

  // A timer that is a day old or in the future is a mistake of the visitor, not a bot: a clear 400, nothing silently lost.
  for (const startedAt of [Date.now() - 25 * 3_600_000, Date.now() + 10 * 60_000]) {
    const stale = await post(page, { ...good, website: "", startedAt });
    expect(stale.status).toBe(400);
    expect(stale.json?.code).toBe("CONTACT_INVALID");
    expect(stale.json?.invalidFields).toContain("startedAt");
  }
  expect(supportRows(marker)).toHaveLength(0);

  // A normal timer (the form was open for a few seconds) is a real message.
  const real = await post(page, { ...good, website: "", startedAt: Date.now() - 10_000 });
  expect(real.status).toBe(200);
  await expect.poll(async () => (await mailsContaining(marker)).length, { timeout: 15_000 }).toBe(1);
  expect(supportRows(marker)).toHaveLength(1);

  // An unknown category is refused; a client without timer or category (an older one) keeps working: the answer is
  // always the same generic success, whichever way CONTACT_REQUIRE_STARTED_AT is set.
  const unknown = await post(page, { ...good, email: `${marker}-b@example.test`, category: "SALES", startedAt: Date.now() - 10_000 });
  expect(unknown.status).toBe(400);
  expect(unknown.json?.code).toBe("CONTACT_INVALID");
  const legacy = await post(page, { firstName: "Old", lastName: "Client", email: `${marker}-c@example.test`, message: `Legacy client message ${marker}` });
  expect(legacy).toEqual({ status: 200, json: { status: "SENT" } });
});

test("abuse through the real API: bad input, injected headers, a chosen recipient and a rapid repeat", async ({ page }) => {
  await page.goto("/contact");
  const marker = `e2e-abuse-${Date.now()}`;
  const good = { firstName: "Eve", lastName: "Tester", email: `${marker}@example.test`, message: `Abuse test message ${marker}`, startedAt: Date.now() - 10_000 };
  const sentBefore = sentRows();

  for (const bad of [
    { ...good, email: "not-an-email" },
    { ...good, message: "" },
    { ...good, message: "kısa" },
    { ...good, message: "x".repeat(5001) },
    { ...good, firstName: "Eve\r\nBcc: victim@example.test" },
    { ...good, lastName: "Tester\nCc: victim@example.test" },
    { ...good, email: `${marker}@example.test\r\nBcc: victim@example.test` },
    { ...good, email: `${marker}@example.test, victim@example.test` },
  ]) {
    const result = await post(page, bad);
    expect(result.status, JSON.stringify(bad).slice(0, 80)).toBe(400);
    expect(result.json?.code).toBe("CONTACT_INVALID");
  }
  expect((await post(page, { ...good, message: "y".repeat(17_000) })).status).toBe(413);
  expect((await mailsContaining(marker)).length).toBe(0);
  expect(sentRows()).toBe(sentBefore);

  // A visitor who tries to pick the recipient or sender only gets the normal, fixed mail.
  const ok = await post(page, { ...good, to: "victim@example.test", cc: "victim2@example.test", bcc: "victim3@example.test", from: "ceo@example.test", subject: "Hacked" });
  expect(ok.status).toBe(200);
  await expect.poll(async () => (await mailsContaining(marker)).length, { timeout: 15_000 }).toBe(1);
  const mail = (await mailsContaining(marker))[0];
  expect(mail.To.map((a) => a.Address)).toEqual([RECIPIENT]);
  expect(mail.Cc).toEqual([]);
  expect(mail.Bcc).toEqual([]);
  expect(mail.From.Address).toBe("pda-e2e@example.test");
  expect(mail.Subject).toBe("Yeni PDA İletişim Talebi [Genel]");

  // The same message again straight away is refused and sends nothing more.
  const repeat = await post(page, good);
  expect(repeat.status).toBe(409);
  expect(repeat.json?.code).toBe("CONTACT_DUPLICATE");
  expect((await mailsContaining(marker)).length).toBe(1);
  expect(sentRows()).toBe(sentBefore + 1);
  expect(supportRows(marker)).toHaveLength(1);
  expect(failedRows()).toBeGreaterThanOrEqual(0);
});
