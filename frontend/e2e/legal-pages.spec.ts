import { test, expect, type Page } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { buildPath } from "../src/i18n/routing";

// The final legal texts (KVKK notice, privacy policy, terms of use, cookie policy, accessibility statement): content
// facts, the absence of any draft wording, the cookie inventory against the code, and the notice at registration.
// No backend needed.

const EMAIL = "pdassistant.info@gmail.com";
const PLACEHOLDERS = /HUKUKİ İÇERİK|teyit edilmemiştir|Yayın öncesi|henüz teyit|Review before launch|not yet confirmed|Prüfung vor Veröffentlichung|noch nicht bestätigt|taslak|Entwurf|TODO|lorem/i;

const locales = ["tr", "en", "de"] as const;
const pages = ["/kvkk", "/privacy", "/terms", "/cookies", "/accessibility"] as const;

async function articleText(page: Page, route: string, locale: (typeof locales)[number]) {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
  const response = await page.goto(route);
  expect(response?.status(), route).toBe(200);
  await expect(page).toHaveURL(new RegExp(`${buildPath(route as never, {}, locale)}$`));
  return (await page.locator("article").innerText()).replace(/\s+/g, " ");
}

for (const locale of locales) {
  test(`every legal page is final and indexable, with no draft wording: ${locale}`, async ({ page, request }) => {
    for (const route of pages) {
      const text = await articleText(page, route, locale);
      expect(text, `${locale} ${route}`).not.toMatch(PLACEHOLDERS);
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
      // The response does not forbid indexing either (the administrator sign-in is the only page that does).
      const response = await request.get(buildPath(route as never, {}, locale));
      expect(response.headers()["x-robots-tag"] ?? "").not.toContain("noindex");
      await expect(page.locator("article aside[aria-label]")).toHaveCount(0);
      // Controllers and the one public address are on every one of them (the cookie and accessibility pages through the contact block).
      expect(text, `${locale} ${route}`).toContain(EMAIL);
    }
  });
}

test("KVKK notice (TR): controllers, legal bases, recipients, retention table, rights, application route and VERBİS", async ({ page }) => {
  const text = await articleText(page, "/kvkk", "tr");
  await expect(page.locator("h1")).toHaveText("KVKK Aydınlatma Metni");
  for (const fact of ["Hamza Taşbay", "Alper Temiz", "gerçek kişi", "MERSİS", "KEP", "m.5/2(c)", "m.5/2(f)", "m.5/2(ç)", "m.5/2(e)", "m.5/1", "Gmail SMTP", "Google", "GitHub", "ABD", "barındırma sağlayıcısı henüz belirlenmemiştir", "VERBİS", "Google LLC", "GitHub, Inc.", "30 gün", "KVKK / veri talebi", "Kişisel Verileri Koruma Kurulu", "dışa aktarılması henüz uygulama içinden", "açık rıza talebi değildir"]) {
    expect(text, fact).toContain(fact);
  }
  // Purposes and bases are a real table with a header row; the retention periods are one too.
  const tables = page.locator("article table");
  await expect(tables).toHaveCount(2);
  await expect(tables.first().locator("th[scope=col]")).toHaveText(["Amaç", "Veri kategorileri", "Hukuki sebep"]);
  const retention = tables.nth(1);
  for (const [data, period] of [["Hesap bilgileri", "Hesabı siz silene kadar"], ["İptal edilen veya süresi dolan oturum", "30 gün"], ["destek mesajları", "12 ay"], ["Ziyaret analitiği", "12 ay"], ["Yönetim işlem günlüğü", "24 ay"]]) {
    await expect(retention.locator("tr", { hasText: data }).first()).toContainText(period);
  }
  // Scrolling tables are keyboard reachable.
  await expect(page.locator("article [role=region][tabindex='0']").first()).toBeVisible();
});

test("privacy policy (TR): categories, account deletion and anonymisation, retention, children, GDPR note", async ({ page }) => {
  const text = await articleText(page, "/privacy", "tr");
  await expect(page.locator("h1")).toHaveText("Gizlilik Politikası");
  for (const fact of ["profil fotoğrafı", "İki adımlı doğrulama", "sohbet", "bildirim", "organizasyon", "takvim", "hatırlatıcı", "Destek mesajları", "anonimleştirilir", "sahipliği devretmeli", "Yönetici hesabı kendini silemez", "yasal temsilcilerinin bilgisi dahilinde", "GDPR"]) {
    expect(text, fact).toContain(fact);
  }
  expect(text).not.toContain("otomatik hesap silme ekranı bulunmaz");
  expect(text).not.toContain("Mevcut sürümde otomatik hesap silme");
  await expect(page.locator("article table")).toHaveCount(1);
});

// Corrections of 2026-10-11 (user decisions): VERBİS is final, no age threshold, yearly mailbox cleanup, honest Art. 9 / Chapter V wording.
const AGE_CLAIM = /\b16\s*(yaş|years?|Jahre)|under 16|unter 16|16 yaşın/i;
const OLD_WORDING = /aktarım mekanizmalarına dayanır|providers' own|own privacy and data-processing documents|eigenen Datenschutz- und Datenverarbeitungsunterlagen|bu otomatik silmeye dahil değildir|is not covered by this automatic deletion|von dieser automatischen Löschung nicht erfasst|değerlendirilmektedir|is being assessed against|wird anhand der vom Datenschutzrat|hesabı sileriz|we will delete it|wir löschen es/;

for (const locale of locales) {
  test(`no age threshold, no deletion claim and none of the replaced wording on any legal page: ${locale}`, async ({ page }) => {
    test.slow(); // six pages in one test; the dev server compiles them on first visit
    for (const route of pages) {
      const text = await articleText(page, route, locale);
      expect(text, `${locale} ${route}`).not.toMatch(AGE_CLAIM);
      expect(text, `${locale} ${route}`).not.toMatch(OLD_WORDING);
    }
    // The FAQ (answers sit in closed <details>) too.
    await articleText(page, "/faq", locale);
    const faq = ((await page.locator("article").textContent()) ?? "").replace(/\s+/g, " ");
    expect(faq).not.toMatch(AGE_CLAIM);
    expect(faq).not.toMatch(OLD_WORDING);
  });
}

test("minors: neutral wording (not directed at children, with the legal representative's knowledge) in the terms and the privacy policy", async ({ page }) => {
  const expected = {
    tr: ["çocuklara yönelik değildir", "yasal temsilcilerinin bilgisi dahilinde"],
    en: ["not directed at children", "knowledge of their legal representative"],
    de: ["nicht an Kinder", "Wissen ihres gesetzlichen Vertreters"],
  } as const;
  for (const locale of locales) {
    for (const route of ["/terms", "/privacy"] as const) {
      const text = await articleText(page, route, locale);
      for (const fact of expected[locale]) expect(text, `${locale} ${route}`).toContain(fact);
    }
  }
});

test("VERBİS: the final statement (no registration obligation at present) is on the KVKK notice in all three languages", async ({ page }) => {
  const expected = {
    tr: ["kayıt yükümlülüğü bulunmamaktadır", "yasal süre içinde yerine getirilecek", "çalışanı ve şirketi ya da ticari geliri bulunmamaktadır", "50'den az"],
    en: ["no obligation to register in the Data Controllers' Registry (VERBİS)", "fulfilled within the legal period", "no employees and no company or commercial revenue", "fewer than 50 employees"],
    de: ["keine Pflicht zur Eintragung in das Register der Verantwortlichen (VERBİS)", "innerhalb der gesetzlichen Frist erfüllt", "keine Beschäftigten und kein Unternehmen und keine kommerziellen Einnahmen", "weniger als 50 Beschäftigte"],
  } as const;
  for (const locale of locales) {
    const text = await articleText(page, "/kvkk", locale);
    for (const fact of expected[locale]) expect(text, `${locale} ${fact}`).toContain(fact);
    // No specific amount or Board decision number is cited.
    expect(text, locale).not.toMatch(/\b\d[\d.,]*\s*(TL|TRY|₺|Mio|million|milyon)/i);
    expect(text, locale).not.toMatch(/Karar(ı)? (No|Sayı)|Board Decision (No|\d)|Beschluss Nr|\b20\d\d\/\d+\b/i);
  }
});

test("mailbox copies of contact messages: the yearly manual cleanup and the immediate deletion on request are stated consistently", async ({ page }) => {
  const expected = {
    tr: ["en az yılda bir elle temizlenir", "12 aydan eski mesajlar en geç yıllık temizlikte silinir", "hemen silinir"],
    en: ["cleaned up manually by the controllers at least once a year", "messages older than 12 months are deleted at the latest in the yearly cleanup", "immediately on request"],
    de: ["mindestens einmal jährlich manuell bereinigt", "älter als 12 Monate sind, werden spätestens bei der jährlichen Bereinigung gelöscht", "auf Anfrage sofort"],
  } as const;
  for (const locale of locales) {
    for (const route of ["/kvkk", "/privacy"] as const) {
      const text = await articleText(page, route, locale);
      for (const fact of expected[locale]) expect(text, `${locale} ${route}`).toContain(fact);
    }
  }
});

test("cross-border transfers: recipients, country and data are named, the safeguards are not claimed to be in place, and KVKK m.9 is tracked", async ({ page }) => {
  const expected = {
    tr: ["Google LLC", "GitHub, Inc.", "ABD", "takip etmektedir", "güvenceler sağlandıkça bu metni güncelleyecektir", "tamamlandığı beyan edilmemektedir", "kullanılmayarak bu aktarımlardan kaçınılabilir"],
    en: ["Google LLC", "GitHub, Inc.", "USA", "track compliance", "will update this text as these safeguards are put in place", "does not state that any specific safeguard or contract is already in place", "can be avoided"],
    de: ["Google LLC", "GitHub, Inc.", "USA", "verfolgen die Einhaltung", "sobald diese Garantien geschaffen sind", "gibt nicht an, dass bereits eine bestimmte Garantie oder ein bestimmter Vertrag besteht", "lassen sich vermeiden"],
  } as const;
  for (const locale of locales) {
    const text = await articleText(page, "/kvkk", locale);
    for (const fact of expected[locale]) expect(text, `${locale} ${fact}`).toContain(fact);
    // The hosting provider is still undecided.
    expect(text, locale).toMatch(/barındırma sağlayıcısı henüz belirlenmemiştir|hosting provider for PDA's production environment has not been chosen yet|Hosting-Anbieter für die Produktivumgebung von PDA ist noch nicht ausgewählt/);
  }
  // The GDPR section of the English and German policies reflects the same honest status, in the Chapter V section.
  for (const [locale, facts] of [["en", ["Chapter V GDPR", "does not claim that any specific safeguard or contract is already in place"]], ["de", ["Kapitel V DSGVO", "behauptet nicht, dass bereits eine bestimmte Garantie oder ein bestimmter Vertrag besteht"]]] as const) {
    const text = await articleText(page, "/privacy", locale);
    for (const fact of facts) expect(text, `${locale} ${fact}`).toContain(fact);
  }
});

test("GDPR Art. 27: the 'being assessed, no representative appointed' wording is unchanged", async ({ page }) => {
  const en = await articleText(page, "/privacy", "en");
  expect(en).toContain("Whether Article 3(2) GDPR applies to PDA, and therefore whether a representative in the Union must be appointed under Article 27, is being assessed. No representative has been appointed at present; this section will be updated when the assessment concludes.");
  const de = await articleText(page, "/privacy", "de");
  expect(de).toContain("wird derzeit geprüft. Derzeit ist kein Vertreter benannt; dieser Abschnitt wird aktualisiert, sobald die Prüfung abgeschlossen ist.");
});

test("terms of use: the route is localized, final, linked from the footer and covers the agreed subjects", async ({ page }) => {
  for (const [locale, route, title] of [["tr", "/tr/kullanim-kosullari", "Kullanım Koşulları"], ["en", "/en/terms", "Terms of Use"], ["de", "/de/nutzungsbedingungen", "Nutzungsbedingungen"]] as const) {
    await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    await page.goto(route);
    await expect(page.locator("h1")).toHaveText(title);
    await expect(page).toHaveTitle(new RegExp(title));
    await expect(page.locator(`footer a[href="${route}"]`)).toBeVisible();
    await expect(page.locator("nav[aria-label] ol li").last()).toContainText(title);
    expect(await page.locator("article section").count()).toBeGreaterThanOrEqual(10);
  }
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "tr", url: "http://localhost:3000" }]);
  const text = await articleText(page, "/terms", "tr");
  for (const subject of ["Kapsam ve kabul", "Hesap kuralları", "Kabul edilebilir kullanım", "zin almadan güvenlik testi", "Kullanıcı içeriği", "olduğu gibi", "devre dışı bırakabilir", "Hesabı silme", "Apache License 2.0", "Sorumluluğun sınırı", "Türkiye Cumhuriyeti hukuku", "Değişiklikler"]) {
    expect(text.toLowerCase(), subject).toContain(subject.toLowerCase());
  }
  await expect(page.locator('article a[href="/tr/lisans"], article a[href="/tr/kullanim-kosullari"]')).toHaveCount(0);
});

test("English and German privacy policies carry the GDPR information: Art. 13, Art. 6, Chapter V, rights, complaint, Art. 27", async ({ page }) => {
  const en = await articleText(page, "/privacy", "en");
  for (const fact of ["Articles 13 and 14", "Art. 6(1)(b)", "Art. 6(1)(f)", "Art. 6(1)(a)", "Art. 6(1)(c)", "Chapter V", "standard contractual clauses", "data portability", "object", "lodge a complaint with a supervisory authority", "Art. 27", "being assessed", "Hamza Taşbay and Alper Temiz"]) {
    expect(en, fact).toContain(fact);
  }
  await expect(page.locator("article section[id^=gdpr-]")).toHaveCount(6);
  const de = await articleText(page, "/privacy", "de");
  for (const fact of ["Art. 13 und 14", "Art. 6 Abs. 1 lit. b", "Art. 6 Abs. 1 lit. f", "Art. 6 Abs. 1 lit. a", "Art. 6 Abs. 1 lit. c", "Kapitel V", "Standardvertragsklauseln", "Datenübertragbarkeit", "Widerspruch", "Beschwerde einzulegen", "Art. 27", "geprüft", "Hamza Taşbay und Alper Temiz"]) {
    expect(de, fact).toContain(fact);
  }
  await expect(page.locator("article section[id^=gdpr-]")).toHaveCount(6);
  // The KVKK notice names itself per language.
  await articleText(page, "/kvkk", "en");
  await expect(page.locator("h1")).toHaveText("KVKK Privacy Notice");
  await articleText(page, "/kvkk", "de");
  await expect(page.locator("h1")).toHaveText("KVKK-Datenschutzhinweis");
});

test("German cookie policy is worded for § 25 TDDDG (formerly TTDSG); the English one names the same grounds", async ({ page }) => {
  const de = await articleText(page, "/cookies", "de");
  for (const fact of ["§ 25 Abs. 1 TDDDG", "TTDSG", "§ 25 Abs. 2 Nr. 2 TDDDG", "unbedingt erforderlich", "ausdrücklich gewünschten digitalen Dienst", "Einwilligung", "12 Monate"]) expect(de, fact).toContain(fact);
  const en = await articleText(page, "/cookies", "en");
  for (const fact of ["§ 25(2) No. 2 TDDDG", "Article 5(3) of the ePrivacy Directive", "12 months", "button clicks"]) expect(en.toLowerCase(), fact).toContain(fact.toLowerCase());
});

test("the cookie policy lists every cookie and storage key the code writes", async ({ page }) => {
  // Collect the keys from the source: every quoted `pda:...` / `pda....` key, the PDA_* cookies and next-themes' `theme`.
  const root = path.resolve(__dirname, "../src");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
    }
  };
  walk(root);
  const keys = new Set<string>();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/["'`](pda[:.][A-Za-z0-9:._-]+)(?:\$\{[^}]*\})?[A-Za-z0-9:._-]*["'`]/g)) keys.add(match[1]);
  }
  for (const known of ["PDA_ACCESS", "PDA_REFRESH", "PDA_SESSION", "PDA_MFA", "PDA_ADMIN_MFA", "PDA_ADMIN_ENROLL", "PDA_RESET", "PDA_PWCHANGE", "XSRF-TOKEN", "JSESSIONID", "NEXT_LOCALE", "theme"]) keys.add(known);
  // Keys that are not browser storage: Web Lock names, event names, translation namespaces and the like.
  const notStorage = new Set(["pda:cookie-consent-changed", "pda:session-expired", "pda:network-failure", "pda:consent-not-read", "pda-session-refresh", "pda.teams.view", "pda:sidebar-collapsed-changed", "pda:story-progress", "pda:project-selection-changed", "pda:preferences-changed"]);
  const expected = [...keys].filter((key) => !notStorage.has(key) && !/^pda\.(?:teams|projects|tasks)\b/.test(key) || key === "pda.pendingVerification" || key === "pda.rememberedEmail");
  expect(expected.length).toBeGreaterThan(15);

  const text = await articleText(page, "/cookies", "tr");
  const missing = expected.filter((key) => !text.includes(key.replace(/:$/, "")));
  expect(missing, "keys written by the code but missing from the cookie policy").toEqual([]);
  // The old key is named only as the one that was replaced.
  expect(text).toContain("pda:teams-view:v1:<kullanıcı kimliği>");
  expect(text).toContain("eski pda.teams.view anahtarının yerine geçer");
  // Retention of analytics and the visitor renewal are stated.
  expect(text).toContain("12 ay sonra otomatik silinir");
  expect(text).toContain("12 ayda bir yenilenir");
});

test("the accessibility statement states the target, the date, the method, the limits and how to report", async ({ page }) => {
  const text = await articleText(page, "/accessibility", "tr");
  await expect(page.locator("h1")).toHaveText("Erişilebilirlik Bildirimi");
  for (const fact of ["WCAG 2.2 AA", "10 Ekim 2026", "axe", "a11y-public", "klavye", "Bilinen sınırlamalar", "Google ve GitHub giriş sayfaları", "“Erişilebilirlik” kategorisini", "30 gün", EMAIL]) expect(text, fact).toContain(fact);
  expect(text).toContain("tam uygunluk beyan etmiyoruz");
});

test("the 'last updated' date of every changed information page is 11 October 2026", async ({ page }) => {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "tr", url: "http://localhost:3000" }]);
  for (const route of ["/kvkk", "/privacy", "/terms", "/cookies", "/accessibility", "/faq"]) {
    await page.goto(route);
    await expect(page.locator("header p").filter({ hasText: "Son güncelleme" })).toContainText("11 Ekim 2026");
  }
});

test("the FAQ answers match the product: account deletion exists and the data request route is the form or the address", async ({ page }) => {
  await articleText(page, "/faq", "tr");
  // The answers sit inside closed <details>, which innerText leaves out.
  const text = ((await page.locator("article").textContent()) ?? "").replace(/\s+/g, " ");
  expect(text).not.toContain("otomatik hesap silme düğmesi bulunmaz");
  expect(text).toContain("hesap ekranından kendiniz silebilirsiniz");
  expect(text).toContain("KVKK / veri talebi");
  expect(text).toContain(EMAIL);
  expect(text).toContain("altı haneli bir doğrulama kodu");
});

test("registration shows a notice (not a consent box) with links to the terms, the KVKK notice and the privacy policy, next to the form and the sign-in buttons", async ({ page }) => {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "tr", url: "http://localhost:3000" }]);
  await page.goto("/register");
  const main = page.locator("#auth-main, main").first();
  const notices = page.locator("p", { hasText: /Kullanım Koşulları.*KVKK Aydınlatma Metni.*Gizlilik Politikası/ });
  await expect(notices).toHaveCount(2);
  const form = page.locator("form p", { hasText: "Kayıt olarak" });
  const oauth = page.locator("p", { hasText: "Google veya GitHub ile devam ederek" });
  await expect(form).toBeVisible();
  await expect(oauth).toBeVisible();
  for (const notice of [form, oauth]) {
    for (const [name, href] of [["Kullanım Koşulları", "/tr/kullanim-kosullari"], ["KVKK Aydınlatma Metni", "/tr/kvkk"], ["Gizlilik Politikası", "/tr/gizlilik"]] as const) {
      const link = notice.getByRole("link", { name: new RegExp(name) });
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
  }
  // Notice, not consent: no checkbox anywhere, and the text says so.
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(form).toContainText("açık rıza talebi değildir");
  void main;
  // The links really open the pages (new tab).
  const [popup] = await Promise.all([page.context().waitForEvent("page"), form.getByRole("link", { name: /KVKK Aydınlatma Metni/ }).click()]);
  await expect(popup).toHaveURL(/\/tr\/kvkk$/);
  await expect(popup.locator("h1")).toHaveText("KVKK Aydınlatma Metni");
  // The form and its typed text are untouched by that.
  await expect(page).toHaveURL(/\/tr\/kayit$/);
});

test("the footer shows the single public address next to the contact link on public pages, in every language", async ({ page, context }) => {
  for (const locale of locales) {
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    await page.goto("/about");
    const footer = page.locator("footer");
    await expect(footer.locator('a[href^="mailto:"]')).toHaveAttribute("href", `mailto:${EMAIL}`);
    await expect(footer.locator(`a[href="${buildPath("/contact", {}, locale)}"]`)).toBeVisible();
    await expect(footer.locator(`a[href="${buildPath("/terms", {}, locale)}"]`)).toBeVisible();
  }
});
