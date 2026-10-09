import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

const normalize = (text: string) => text.replace(/\r\n/g, "\n").trim();

test("license page shows the repository LICENSE verbatim", async ({ page }) => {
  const rootLicense = normalize(readFileSync(path.resolve(__dirname, "../../LICENSE"), "utf8"));
  const response = await page.goto("/license");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/tr\/lisans$/);
  await expect(page.locator("h1")).toHaveText("Lisans");
  expect(normalize(await page.locator("pre").innerText())).toBe(rootLicense);
});

test("footer keeps source code and license as separate links", async ({ page }) => {
  await page.goto("/login");
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "Kaynak kod" })).toHaveAttribute("href", "https://github.com/alperrte/project-delivery-assistant");
  await expect(footer.getByRole("link", { name: "Lisans" })).toHaveAttribute("href", "/tr/lisans");
  await footer.getByRole("link", { name: "Lisans" }).click();
  await expect(page).toHaveURL(/\/tr\/lisans$/);
});

for (const [locale, url, title] of [["en", "/en/license", "License"], ["de", "/de/lizenz", "Lizenz"]] as const) {
  test(`license page is localized: ${locale}`, async ({ page }) => {
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText(title);
    await expect(page.locator("pre")).toContainText("Apache License");
  });
}
