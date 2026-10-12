import { test, expect } from "@playwright/test";
import { createProject } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE });

/** A real 1x1 PNG: the picker decodes it in the browser and the server reads the type from the bytes. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** One byte over the 1 MB image limit; the picker refuses it by size before it ever decodes it. */
const TOO_BIG = Buffer.alloc(1024 * 1024 + 1);

test("images picked on the create form are listed, an oversized one is refused, and the detail page shows the saved ones", async ({ page }) => {
  const slug = await createProject(page, `Task images ${Date.now()}`, { taskMode: "SIMPLE" });
  await page.goto(`/projects/${slug}/tasks/new`);
  await page.locator("#task-title").fill("Görselli E2E görevi");

  const input = page.locator('input[type="file"]');
  const previews = page.getByTestId("task-image-previews").getByRole("listitem");
  await input.setInputFiles([
    { name: "ilk-ekran.png", mimeType: "image/png", buffer: PNG },
    { name: "ikinci-ekran.png", mimeType: "image/png", buffer: PNG },
  ]);
  await expect(previews).toHaveCount(2);

  // An image over 1 MB is refused with a message and does not join the list.
  await input.setInputFiles({ name: "buyuk.png", mimeType: "image/png", buffer: TOO_BIG });
  await expect(page.getByRole("alert").filter({ hasText: "1 MB sınırını aştığı için eklenmedi" })).toBeVisible();
  await expect(previews).toHaveCount(2);

  // A removed preview leaves the list; put it back so the saved task has two images.
  await page.getByRole("button", { name: "ikinci-ekran.png görselini kaldır" }).click();
  await expect(previews).toHaveCount(1);
  await input.setInputFiles({ name: "ikinci-ekran.png", mimeType: "image/png", buffer: PNG });
  await expect(previews).toHaveCount(2);

  await page.getByRole("button", { name: "Görevi oluştur", exact: true }).click();
  await expect(page).toHaveURL(/gorevler\/(?!yeni-gorev$)[^/]+$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Görselli E2E görevi", exact: true })).toBeVisible();

  await expect(page.locator("#detail-attachments")).toHaveText(/^Görseller/);
  const cards = page.locator('section[aria-labelledby="detail-attachments"] ul > li');
  await expect(cards).toHaveCount(2);
  await expect(cards.first().locator("img")).toBeVisible();
  await expect.poll(() => cards.first().locator("img").evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
});
