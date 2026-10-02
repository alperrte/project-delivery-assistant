import { expect, test } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE });

// 1x1 transparent PNG; enough for the server's magic byte check.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Yeni proje sayfası", () => {
  test("önizleme yazdıkça güncellenir ve teknoloji seçilebilir", async ({ page }) => {
    await page.goto("/projects/new");

    const preview = page.getByRole("complementary", { name: "Önizleme" });
    await expect(preview.getByRole("heading", { name: "Proje adı" })).toBeVisible();

    await page.locator("#project-name").fill("Teslimat Portalı");
    await page.locator("#project-tagline").fill("Sevkiyatı tek yerden izleyin");
    await page.getByRole("radio", { name: /^Mobil/ }).click();

    await expect(preview.getByRole("heading", { name: "Teslimat Portalı" })).toBeVisible();
    await expect(preview.getByText("Sevkiyatı tek yerden izleyin")).toBeVisible();
    await expect(preview.getByText("Mobil", { exact: true })).toBeVisible();

    const flutter = page.getByRole("button", { name: "Flutter" });
    await flutter.click();
    await expect(flutter).toHaveAttribute("aria-pressed", "true");
    await expect(preview.getByRole("img", { name: "Flutter" })).toBeVisible();

    await flutter.click();
    await expect(preview.getByRole("img", { name: "Flutter" })).toHaveCount(0);
  });

  test("geçersiz logo reddedilir ve tür seçilmeden gönderilemez", async ({ page }) => {
    await page.goto("/projects/new");

    await page.locator('input[type="file"]').first().setInputFiles({
      name: "logo.png",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
    });
    await expect(page.getByRole("alert").filter({ hasText: "PNG, JPEG veya WebP" })).toBeVisible();

    await page.locator("#project-name").fill("Türsüz proje");
    await page.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
    await expect(page).toHaveURL(/\/projects\/new$/);
    await expect(page.getByRole("alert").filter({ hasText: "Bu alan zorunlu." })).toBeVisible();
  });

  test("logo ile oluşturulan proje listede logosuyla görünür, kart başına /home çağrılmaz", async ({ page }) => {
    await page.goto("/projects/new");

    await page.locator('input[type="file"]').first().setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await page.locator("#project-name").fill("Logolu Proje");
    await page.getByRole("radio", { name: /^Web/ }).click();
    await page.getByRole("button", { name: "React", exact: true }).click();
    await page.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
    await expect(page).toHaveURL(/\/projects\/(?!new$)[^/]+$/, { timeout: 15_000 });

    // The detail page loads its own /home; let it finish so only requests made by the list page are counted.
    await page.waitForLoadState("networkidle");
    const homeCalls: string[] = [];
    page.on("request", (request) => {
      if (/\/projects\/[^/]+\/home/.test(request.url())) homeCalls.push(request.url());
    });

    await page.goto("/projects");
    const card = page.getByRole("article").filter({ hasText: "Logolu Proje" });
    await expect(card).toBeVisible();
    await expect(card.locator('img[src*="/logo?v="]')).toBeVisible();
    await expect(card.getByText("1 üye")).toBeVisible();
    expect(homeCalls).toHaveLength(0);
  });

  test("kapak görseli oluşturma sırasında seçilir, önizleme kartında görünür ve proje kartına yüklenir", async ({ page }) => {
    await page.goto("/projects/new");
    const preview = page.locator("#project-preview");
    await expect(preview.locator("img")).toHaveCount(0);

    // The second picker is the cover image (the first is the logo).
    await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "kapak.png", mimeType: "image/png", buffer: PNG });
    // Like the logo, the picked file is shown at once: in its own field and behind the preview card's header band.
    await expect(preview.locator('img[src^="blob:"]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Kaldır" })).toBeVisible();

    await page.locator("#project-name").fill("Kapaklı Proje");
    await page.getByRole("radio", { name: /^Web/ }).click();
    await page.getByRole("button", { name: "React", exact: true }).click();
    await page.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
    await expect(page).toHaveURL(/\/projects\/(?!new$)[^/]+$/, { timeout: 15_000 });

    await page.goto("/projects");
    const card = page.getByRole("article").filter({ hasText: "Kapaklı Proje" });
    await expect(card.locator('img[src*="/banner?v="]')).toBeVisible();
  });

  test("seçilen kapak görseli kaldırılınca önizleme kartından da gider", async ({ page }) => {
    await page.goto("/projects/new");
    await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "kapak.png", mimeType: "image/png", buffer: PNG });
    await expect(page.locator("#project-preview").locator('img[src^="blob:"]')).toHaveCount(1);
    await page.getByRole("button", { name: "Kaldır" }).click();
    await expect(page.locator("#project-preview img")).toHaveCount(0);
  });

  test("alt çubuk kaydırırken yerinde durur, sayfanın sonunda bile yukarı zıplamaz", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/projects/new");
    const bar = page.getByRole("button", { name: /^Projeyi oluştur$/ }).locator("xpath=ancestor::div[contains(@class,'sticky')][1]");
    await expect(bar).toBeVisible();

    const gapBelow = async () => bar.evaluate((el) => Math.round(window.innerHeight - el.getBoundingClientRect().bottom));
    // Top, middle and the very end of the page: the bar always rests on the bottom edge of the screen.
    for (const where of [0, 600, 100_000]) {
      await page.evaluate((y) => window.scrollTo(0, y), where);
      await expect.poll(gapBelow).toBe(0);
    }
  });
});
