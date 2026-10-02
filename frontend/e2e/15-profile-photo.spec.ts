import { test, expect, type Page } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";
import { api } from "./helpers";

test.use({ storageState: MANAGER_STORAGE });

/** A real 1x1 PNG: the server reads the type and size from the bytes, so a made-up header would be refused. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const navbarPhoto = (page: Page) => page.locator('header img[src*="/profile-photo?v="]');

async function revealNavbar(page: Page) {
  // The navbar hides itself when idle; moving to the top edge brings it back.
  await page.mouse.move(700, 8);
}

/** The shared account must not keep a photo after the test, whatever happened in it. */
async function removePhotoIfAny(page: Page) {
  await api(page, "DELETE", "/users/me/profile-photo");
}

test("a profile photo is previewed, confirmed, shown in the navbar and removed again", async ({ page }) => {
  await page.goto("/account");
  const input = page.getByTestId("profile-photo-input");
  try {
    // Choosing a file only previews it: nothing is uploaded and the navbar still has no photo.
    await input.setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("Yeni fotoğraf önizlemesi")).toBeVisible();
    await expect(navbarPhoto(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Fotoğrafı kaydet" }).click();
    await expect(page.getByText("Profil fotoğrafı güncellendi.")).toBeVisible();

    // The photo replaces the initials in the navbar and really loads (the browser could decode it).
    await revealNavbar(page);
    await expect(navbarPhoto(page)).toHaveCount(1);
    await expect.poll(() => navbarPhoto(page).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    // It is still there after a reload, and the account page offers to change or remove it.
    await page.reload();
    await revealNavbar(page);
    await expect(navbarPhoto(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Fotoğrafı değiştir" })).toBeVisible();

    // Removing asks first; "Vazgeç" keeps the photo.
    const main = page.locator("#main-content");
    await main.getByRole("button", { name: "Kaldır" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Vazgeç" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await revealNavbar(page);
    await expect(navbarPhoto(page)).toHaveCount(1);

    await main.getByRole("button", { name: "Kaldır" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Kaldır" }).click();
    await expect(page.getByText("Profil fotoğrafı kaldırıldı.")).toBeVisible();
    await revealNavbar(page);
    await expect(navbarPhoto(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Fotoğraf seç" })).toBeVisible();
  } finally {
    await removePhotoIfAny(page);
  }
});

test("a file that is too big or not an image is refused with a clear message and nothing changes", async ({ page }) => {
  await page.goto("/account");
  const input = page.getByTestId("profile-photo-input");
  try {
    // Too big and a wrong type are stopped in the browser before anything is sent.
    await input.setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
    await expect(page.locator("#main-content").getByRole("alert")).toHaveText("Dosya en fazla 5 MB olabilir.");
    await input.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.locator("#main-content").getByRole("alert")).toHaveText("Dosya türü desteklenmiyor.");
    await expect(page.getByText("Yeni fotoğraf önizlemesi")).toHaveCount(0);

    // A file that only claims to be a PNG passes the browser check; the server looks at the bytes and says no.
    await input.setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") });
    await page.getByRole("button", { name: "Fotoğrafı kaydet" }).click();
    await expect(page.locator("#main-content").getByRole("alert")).toHaveText("Dosya türü desteklenmiyor.");
    await revealNavbar(page);
    await expect(navbarPhoto(page)).toHaveCount(0);
  } finally {
    await removePhotoIfAny(page);
  }
});
