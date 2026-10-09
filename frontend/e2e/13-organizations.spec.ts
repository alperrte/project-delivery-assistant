import { test, expect, type Page } from "@playwright/test";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

/**
 * Creating and editing an organization happen on their own pages, not in a popup. Archiving keeps its small
 * confirmation. The shared manager owns the organization; the shared member is somebody else.
 */
test.describe.serial("Organizations", () => {
  let managerPage: Page;
  let memberPage: Page;
  let organizationUrl: string;
  const name = `E2E Organization ${Date.now()}`;
  const renamed = `${name} (renamed)`;

  test.beforeAll(async ({ browser }) => {
    managerPage = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    memberPage = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
  });

  test.afterAll(async () => {
    await managerPage.close();
    await memberPage.close();
  });

  test("the new organization button opens a page, and an empty name is refused there", async () => {
    await managerPage.goto("/organizations");
    await managerPage.getByRole("link", { name: "Yeni organizasyon" }).click();

    await expect(managerPage).toHaveURL(/\/tr\/organizasyonlar\/yeni-organizasyon$/);
    await expect(managerPage.getByRole("dialog")).toHaveCount(0);
    await expect(managerPage.getByRole("heading", { level: 1, name: "Yeni organizasyon" })).toBeVisible();

    await managerPage.getByRole("button", { name: /^Organizasyonu oluştur$/ }).click();
    await expect(managerPage.getByRole("alert").first()).toBeVisible();
    await expect(managerPage).toHaveURL(/\/tr\/organizasyonlar\/yeni-organizasyon$/);
  });

  test("the form shows a live preview card that follows what is typed, without a link to open", async () => {
    await managerPage.goto("/organizations/new");
    const preview = managerPage.locator("#organization-preview");
    // Empty form: the card still shows a placeholder name instead of an empty header.
    await expect(preview.locator("article").getByRole("heading", { name: "Organizasyon adı" })).toBeVisible();

    await managerPage.locator("#org-name").fill("Önizleme Ekibi");
    await managerPage.locator("#org-description").fill("Kartta görünecek açıklama");
    await expect(preview.locator("article").getByRole("heading", { name: "Önizleme Ekibi" })).toBeVisible();
    await expect(preview.locator("article").getByText("Kartta görünecek açıklama")).toBeVisible();
    await expect(managerPage.getByText("25/2000")).toBeVisible();
    // The preview is only a picture of the card: nothing in it can be opened.
    await expect(preview.getByRole("link")).toHaveCount(0);
  });

  test("creating an organization lands on its own page", async () => {
    await managerPage.locator("#org-name").fill(name);
    await managerPage.locator("#org-description").fill("Popup yerine sayfa");
    await managerPage.getByRole("button", { name: /^Organizasyonu oluştur$/ }).click();

    await expect(managerPage.getByText("Organizasyon oluşturuldu.")).toBeVisible();
    await expect(managerPage).toHaveURL(/\/tr\/organizasyonlar\/(?!yeni$)[^/]+$/);
    await expect(managerPage.getByRole("heading", { level: 1, name })).toBeVisible();
    organizationUrl = new URL(managerPage.url()).pathname;
  });

  test("editing happens on a page too and shows the saved name afterwards", async () => {
    await managerPage.getByRole("link", { name: "Düzenle" }).click();

    await expect(managerPage).toHaveURL(new RegExp(`${organizationUrl}/duzenle$`));
    await expect(managerPage.getByRole("dialog")).toHaveCount(0);
    await expect(managerPage.getByRole("heading", { level: 1, name: "Organizasyonu düzenle" })).toBeVisible();
    await expect(managerPage.locator("#org-name")).toHaveValue(name);
    await expect(managerPage.locator("#org-description")).toHaveValue("Popup yerine sayfa");

    await managerPage.locator("#org-name").fill(renamed);
    await managerPage.getByRole("button", { name: /^Kaydet$/ }).click();
    await expect(managerPage.getByText("Organizasyon güncellendi.")).toBeVisible();
    await expect(managerPage).toHaveURL(new RegExp(`${organizationUrl}$`));
    await expect(managerPage.getByRole("heading", { level: 1, name: renamed })).toBeVisible();
  });

  test("cancelling goes back without saving", async () => {
    await managerPage.goto(`${organizationUrl}/duzenle`);
    await managerPage.locator("#org-name").fill("Kaydedilmeyecek ad");
    await managerPage.getByRole("link", { name: "Vazgeç" }).click();
    await expect(managerPage).toHaveURL(new RegExp(`${organizationUrl}$`));
    await expect(managerPage.getByRole("heading", { level: 1, name: renamed })).toBeVisible();
  });

  test("somebody who cannot see the organization gets the 403 screen, not a form", async () => {
    await memberPage.goto(`${organizationUrl}/duzenle`);
    await expect(memberPage.locator('[data-error-code="403"]')).toBeVisible();
    await expect(memberPage.locator("#org-name")).toHaveCount(0);
  });

  test("archiving still asks first and an archived organization cannot be edited", async () => {
    await managerPage.goto(organizationUrl);
    await managerPage.getByRole("button", { name: /^Arşivle$/ }).click();
    await managerPage.getByRole("dialog").getByRole("button", { name: /^Arşivle$/ }).click();
    await expect(managerPage).toHaveURL(/\/tr\/organizasyonlar$/);

    // The server no longer serves an archived organization, so its edit address is a 404 and never a form.
    await managerPage.goto(`${organizationUrl}/duzenle`);
    await expect(managerPage.locator('[data-error-code="404"]')).toBeVisible();
    await expect(managerPage.locator("#org-name")).toHaveCount(0);
  });
});

for (const { locale, segment, create, edit, submit } of [
  { locale: "en", segment: "organizations", create: "new", edit: "edit", submit: "Create organization" },
  { locale: "de", segment: "organisationen", create: "neu", edit: "bearbeiten", submit: "Organisation erstellen" },
] as const) {
  test(`organization create and edit remain usable at ${locale} addresses`, async ({ browser }) => {
    const context = await browser.newContext({ storageState: MANAGER_STORAGE });
    const page = await context.newPage();
    const name = `E2E ${locale.toUpperCase()} Organization ${Date.now()}`;
    const renamed = `${name} updated`;
    // A fresh sign-in applies the account's saved language once. Exercise explicit localized URLs after that baseline.
    await page.goto("/tr/genel-bakis");
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("pda:session-baseline"))).not.toBeNull();
    await page.goto(`/${locale}/${segment}/${create}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("#org-name")).toBeVisible();
    await page.getByRole("button", { name: submit, exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await page.locator("#org-name").fill(name);
    await page.getByRole("button", { name: submit, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/${segment}/(?!${create}$)[^/]+$`));
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    const detail = new URL(page.url()).pathname;
    await page.goto(`${detail}/${edit}`);
    await expect(page.locator("#org-name")).toHaveValue(name);
    await page.locator("#org-name").fill(renamed);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();
    await page.goto(`${detail}/${edit}`);
    await page.locator("#org-name").fill("Unsaved value");
    await page.getByRole("link", { name: locale === "en" ? "Cancel" : "Abbrechen" }).click();
    await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();
    await context.close();
  });
}
