import { expect, test, type Page } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";
import { declineTeamPrompt, createdProjectSlug } from "./helpers";

test.use({ storageState: MANAGER_STORAGE });

const submitProject = (page: Page) => page.getByRole("button", { name: /^Projeyi oluştur$/ });
const submitOrganization = (page: Page) => page.getByRole("button", { name: /^Organizasyonu oluştur$/ });
const activeId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? "");

test.describe("Validation summary on create forms", () => {
  test("project: empty submit lists the invalid sections, entries move focus, fixing them removes the summary", async ({ page }) => {
    await page.goto("/projects/new");
    await submitProject(page).click();

    // Inline errors stay.
    await expect(page.locator("#project-name")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert").filter({ hasText: "Bu alan zorunlu." })).toHaveCount(2);

    const summary = page.getByRole("alert").filter({ hasText: "Proje oluşturulamadı." });
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("Eksik bölümler:");
    await expect(summary.getByRole("button", { name: "Kimlik" })).toBeVisible();
    await expect(summary.getByRole("button", { name: "Proje türü" })).toBeVisible();
    await expect(summary.getByRole("button")).toHaveCount(2);
    await expect(summary).toBeFocused();
    await expect(submitProject(page)).toHaveAttribute("aria-describedby", /.+/);

    // Entries scroll to and focus the first invalid control of their section.
    await summary.getByRole("button", { name: "Proje türü" }).click();
    await expect(page.getByRole("radiogroup").getByRole("radio").first()).toBeFocused();
    await summary.getByRole("button", { name: "Kimlik" }).click();
    await expect(page.locator("#project-name")).toBeFocused();

    // Typing between submits does not pull focus back to the summary; fixed sections drop out of the list.
    await page.locator("#project-name").fill("Özet doğrulama projesi");
    await expect(page.locator("#project-name")).toBeFocused();
    await expect(summary.getByRole("button")).toHaveCount(1);
    await page.getByRole("radio", { name: /^Web/ }).click();
    await expect(summary).toHaveCount(0);
    await expect(submitProject(page)).not.toHaveAttribute("aria-describedby", /.+/);

    await submitProject(page).click();
    await declineTeamPrompt(page);
    await createdProjectSlug(page);
  });

  test("project: a valid form with an invalid repository URL lists the repository section", async ({ page }) => {
    await page.goto("/projects/new");
    await page.locator("#project-name").fill("Depo hatası projesi");
    await page.getByRole("radio", { name: /^Web/ }).click();
    await page.locator("#project-repository-url").fill("not-a-repository");
    await submitProject(page).click();

    const summary = page.getByRole("alert").filter({ hasText: "Proje oluşturulamadı." });
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("button")).toHaveCount(1);
    await expect(page.getByRole("alert").filter({ hasText: "GitHub depo URL" })).toBeVisible();
    await expect(page).toHaveURL(/\/tr\/projeler\/yeni-proje$/);

    await summary.getByRole("button", { name: "GitHub deposu" }).click();
    await expect(page.locator("#project-repository-url")).toBeFocused();

    // Both error kinds can show together.
    await page.locator("#project-name").fill("");
    await submitProject(page).click();
    await expect(summary.getByRole("button")).toHaveCount(2);
    await expect(summary.getByRole("button", { name: "Kimlik" })).toBeVisible();
    await expect(summary.getByRole("button", { name: "GitHub deposu" })).toBeVisible();
  });

  test("organization: empty submit lists the general section, the entry focuses the name, then creation succeeds", async ({ page }) => {
    await page.goto("/organizations/new");
    await page.locator("#org-name").fill("");
    await submitOrganization(page).click();

    const summary = page.getByRole("alert").filter({ hasText: "Organizasyon oluşturulamadı." });
    await expect(summary).toBeVisible();
    await expect(summary.getByRole("button", { name: "Genel Bilgiler" })).toBeVisible();
    await expect(summary.getByRole("button")).toHaveCount(1);
    await expect(summary).toBeFocused();
    await expect(page.locator("#org-name")).toHaveAttribute("aria-invalid", "true");

    // A second failing section (contact) joins the list; entries are in page order.
    await page.locator("#org-website").fill("not a url");
    await submitOrganization(page).click();
    await expect(summary.getByRole("button")).toHaveText(["Genel Bilgiler", "İletişim ve Bağlantılar"]);
    await summary.getByRole("button", { name: "İletişim ve Bağlantılar" }).click();
    await expect(page.locator("#org-website")).toBeFocused();
    await summary.getByRole("button", { name: "Genel Bilgiler" }).click();
    expect(await activeId(page)).toBe("org-name");

    await page.locator("#org-name").fill(`Özet Organizasyonu ${Date.now()}`);
    await page.locator("#org-website").fill("");
    await expect(summary).toHaveCount(0);
    await submitOrganization(page).click();
    await expect(page).toHaveURL(/\/tr\/organizasyonlar\/[^/]+$/, { timeout: 15_000 });
  });

  for (const width of [320, 390, 1440]) {
    for (const scheme of ["light", "dark"] as const) {
      test(`summary fits without horizontal overflow at ${width}px (${scheme})`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto("/projects/new");
        await submitProject(page).click();
        const summary = page.getByRole("alert").filter({ hasText: "Proje oluşturulamadı." });
        await expect(summary).toBeVisible();
        await expect(summary).toBeInViewport();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        const box = (await summary.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        // Entries keep a comfortable touch target.
        for (const entry of await summary.getByRole("button").all()) {
          expect((await entry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
      });
    }
  }
});
