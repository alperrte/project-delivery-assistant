import { test, expect, type Page } from "@playwright/test";
import { psql } from "./db";
import { mailpitAvailable, mailsContaining } from "./mailpit";

// A logged-out visitor on the real stack: browser -> frontend -> API -> SMTP code path -> Mailpit sink, rows in PostgreSQL.
// (No session cookies; the cookie banner is not the subject here, so the visitor has already decided.)

const sentRows = () => Number(psql("SELECT count(*) FROM contact_requests WHERE delivery_status = 'SENT'"));
const failedRows = () => Number(psql("SELECT count(*) FROM contact_requests WHERE delivery_status = 'FAILED'"));

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

test("a logged-out visitor sends a message: the mail reaches the sink with the fixed recipient, Reply-To and sender, and the count moves", async ({ page }) => {
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
  expect(mail.To.map((a) => a.Address)).toEqual(["pdassistant.info@gmail.com"]);
  expect(mail.ReplyTo.map((a) => a.Address)).toEqual([`${marker}@example.test`]);
  expect(mail.From.Address).toBe("pda-e2e@example.test");
  expect(mail.Cc).toEqual([]);
  expect(mail.Bcc).toEqual([]);
  expect(mail.Text).toContain("Ece Yıldız");
  expect(mail.Text).toContain(`bu bir uçtan uca testtir: ${marker}`);
  expect(sentRows()).toBe(before + 1);
});

test("abuse through the real API: bad input, injected headers, a chosen recipient and a rapid repeat", async ({ page }) => {
  await page.goto("/contact");
  const marker = `e2e-abuse-${Date.now()}`;
  const good = { firstName: "Eve", lastName: "Tester", email: `${marker}@example.test`, message: `Abuse test message ${marker}` };
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
  expect(mail.To.map((a) => a.Address)).toEqual(["pdassistant.info@gmail.com"]);
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
  expect(failedRows()).toBeGreaterThanOrEqual(0);
});
