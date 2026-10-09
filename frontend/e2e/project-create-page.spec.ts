import { expect, test } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";
import { createdProjectSlug, api, createProject, declineTeamPrompt, openProjectListPage } from "./helpers";

test.use({ storageState: MANAGER_STORAGE });

// 1x1 transparent PNG; enough for the server's magic byte check.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Yeni proje sayfası", () => {
  test("overview shows catalog logos and the original name for unknown technologies", async ({ page }) => {
    const slug = await createProject(page, `Tech Overview ${Date.now()}`);
    const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as {
      id: string; name: string; description: string | null; priority: string; status: string; projectType: string;
    };
    const updated = await api(page, "PUT", `/projects/${project.id}`, {
      name: project.name, description: project.description, priority: project.priority,
      status: project.status, projectType: project.projectType, techStack: "React, QuantumScript",
    });
    expect(updated.status).toBe(200);
    await page.goto(`/projects/${slug}`);
    await expect(page.getByRole("button", { name: "React", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "QuantumScript", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "React", exact: true }).locator("img[src*='/images/tech/react.svg']")).toBeVisible();
  });
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
    await expect(page).toHaveURL(/\/tr\/projeler\/yeni-proje$/);
    await expect(page.getByRole("alert").filter({ hasText: "Bu alan zorunlu." })).toBeVisible();
    // The type cards are the only invalid field, so focus has to land on them instead of staying on the button.
    await expect(page.getByRole("radio").first()).toBeFocused();
  });

  test("yalnız boşluktan oluşan ad kabul edilmez", async ({ page }) => {
    await page.goto("/projects/new");
    await page.locator("#project-name").fill("     ");
    await page.getByRole("radio", { name: /^Web/ }).click();
    await page.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
    await expect(page).toHaveURL(/\/tr\/projeler\/yeni-proje$/);
    await expect(page.locator("#project-name")).toBeFocused();
    await expect(page.getByRole("alert").filter({ hasText: "Bu alan zorunlu." })).toBeVisible();
  });

  test("logo ile oluşturulan proje listede logosuyla görünür, kart başına /home çağrılmaz", async ({ page }) => {
    const name = `Logolu Proje ${Date.now()}`;
    await page.goto("/projects/new");

    await page.locator('input[type="file"]').first().setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await page.locator("#project-name").fill(name);
    await page.getByRole("radio", { name: /^Web/ }).click();
    await page.getByRole("button", { name: "React", exact: true }).click();
    await page.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
    await declineTeamPrompt(page);
    await expect(page).toHaveURL(/\/tr\/projeler\/[^/]+\/genel-bakis$/, { timeout: 15_000 });

    // The detail page loads its own /home; let it finish so only requests made by the list page are counted.
    await page.waitForLoadState("networkidle");
    const homeCalls: string[] = [];
    page.on("request", (request) => {
      if (/\/projects\/[^/]+\/home/.test(request.url())) homeCalls.push(request.url());
    });

    const slug = await createdProjectSlug(page);
    await openProjectListPage(page, slug);
    const card = page.getByRole("article").filter({ has: page.locator(`a[href="/tr/projeler/${slug}/genel-bakis"]`) });
    await expect(card).toBeVisible();
    await expect(card.locator('img[src*="/logo?v="]')).toBeVisible();
    await expect(card.getByText("1 üye")).toBeVisible();
    // A full page load lets the sidebar read the selected project's home once (for the "Depo" item); cards never do.
    expect(homeCalls.length).toBeLessThanOrEqual(1);
  });

  test("kapak görseli oluşturma sırasında seçilir, önizleme kartında görünür ve proje kartına yüklenir", async ({ page }) => {
    const name = `Kapaklı Proje ${Date.now()}`;
    await page.goto("/projects/new");
    const preview = page.locator("#project-preview");
    await expect(preview.locator("img")).toHaveCount(0);

    // The second picker is the cover image (the first is the logo).
    await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "kapak.png", mimeType: "image/png", buffer: PNG });
    // Like the logo, the picked file is shown at once: in its own field and behind the preview card's header band.
    await expect(preview.locator('img[src^="blob:"]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Kaldır" })).toBeVisible();

    await page.locator("#project-name").fill(name);
    await page.getByRole("radio", { name: /^Web/ }).click();
    await page.getByRole("button", { name: "React", exact: true }).click();
    await page.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
    await declineTeamPrompt(page);
    await expect(page).toHaveURL(/\/tr\/projeler\/[^/]+\/genel-bakis$/, { timeout: 15_000 });

    const slug = await createdProjectSlug(page);
    await openProjectListPage(page, slug);
    const card = page.getByRole("article").filter({ has: page.locator(`a[href="/tr/projeler/${slug}/genel-bakis"]`) });
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
