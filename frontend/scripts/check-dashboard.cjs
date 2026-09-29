/* eslint-disable @typescript-eslint/no-require-imports */
// Browser-only fixtures: no backend data is created or changed.
const { chromium, expect } = require("@playwright/test");
const { mkdirSync } = require("node:fs");
const path = require("node:path");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "tr-TR", reducedMotion: "reduce" });
  const origin = process.argv[2] || "http://localhost:3000";
  await context.addCookies([{ name: "NEXT_LOCALE", value: "tr", url: origin }]);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("Failed to load resource")) errors.push(message.text());
  });
  let mode = "populated";
  const projects = ["PDA", "Web Platformu", "Mobil Uygulama", "Açık Kaynak"].map((name, i) => ({
    id: `preview-${i}`, slug: `preview-${i}`, name, description: "Platform geliştirme ve ekip çalışması",
    status: ["ACTIVE", "PLANNING", "ON_HOLD", "ACTIVE"][i], priority: "MEDIUM",
    updatedAt: "2026-09-29T09:00:00Z", createdAt: "2026-09-01T09:00:00Z", targetEndDate: "2026-09-29",
  }));
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    let data;
    if (url.pathname.endsWith("/auth/me")) data = { id: "preview", nickname: "Hamza", email: "preview@example.com", globalRole: "USER", mustChangePassword: false };
    else if (url.pathname.endsWith("/home")) data = { teamMemberCount: 4, criteriaProgress: { completed: 3, total: 8 } };
    else if (url.pathname.endsWith("/projects")) {
      if (mode === "error") return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      data = { content: mode === "empty" ? [] : projects, totalElements: mode === "empty" ? 0 : 4, totalPages: 1, page: 0, size: 6 };
    } else if (url.pathname.endsWith("/organizations")) data = { content: [], totalElements: 0 };
    else return route.fulfill({ status: 404, body: "{}" });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  });
  const captures = path.resolve(__dirname, "../../tmp/dashboard-review");
  mkdirSync(captures, { recursive: true });
  try {
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      for (const width of [1440, 1024, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${origin}/dashboard`);
        await expect(page.getByRole("heading", { name: "Tekrar hoş geldin, Hamza." })).toBeVisible();
        await expect(page.getByRole("cell", { name: "3/8" }).first()).toBeVisible();
        await expect(page.getByRole("cell", { name: "Aktif", exact: true }).first()).toBeVisible();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: path.join(captures, `${theme}-${width}.png`), fullPage: true });
      }
    }
    await page.getByRole("button", { name: "Gezinme menüsü", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.keyboard.press("Control+k");
    await page.getByRole("textbox", { name: "Projelerde ara…" }).fill("Web");
    await expect(page.getByRole("dialog").getByRole("link")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Genel bakış" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Son güncellemeler" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Genel bakış" }).click();
    await page.getByRole("button", { name: "Proje oluştur", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Sonraki ay" }).click();
    await page.getByRole("button", { name: "Önceki ay" }).click();
    await page.getByRole("button", { name: "Tema", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Açık", exact: true }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitemradio", { name: "Açık", exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Tema", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Koyu", exact: true }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.keyboard.press("Escape");
    for (const [locale, greeting] of [["en", "Welcome back, Hamza."], ["de", "Willkommen zurück, Hamza."]]) {
      await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: origin }]);
      await page.reload();
      await expect(page.getByRole("heading", { name: greeting })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await context.addCookies([{ name: "NEXT_LOCALE", value: "tr", url: origin }]);
    for (const state of ["empty", "error"]) {
      mode = state;
      await page.reload();
      await expect(page.getByText(state === "empty" ? "İlk projenle başla" : "Projeler yüklenemedi. Tekrar deneyin.", { exact: true })).toBeVisible({ timeout: 20000 });
      await page.screenshot({ path: path.join(captures, `${state}.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
    console.log("PASS: light/dark at 1440/1024/390px, overflow, mobile menu, search, keyboard tabs, create dialog, calendar, theme menu, TR/EN/DE, empty/error states, runtime errors.");
    console.log(`Screenshots: ${captures}`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
