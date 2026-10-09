import { expect, test } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";
import { api, createProject } from "./helpers";

test.use({ storageState: MANAGER_STORAGE });

test("tür seçilmeden gönderilen anımsatıcı formunda odak tür alanına gider", async ({ page }) => {
  const slug = await createProject(page, `Reminder Focus ${Date.now()}`);
  const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string };
  try {
    await page.goto("/calendar");
    await page.getByRole("link", { name: "Anımsatıcı oluştur" }).click();
    await page.getByLabel("Anımsatıcı adı").fill("Odak denemesi");
    await page.getByRole("button", { name: /^Oluştur$/ }).click();

    const type = page.getByRole("combobox", { name: "Anımsatıcı türü" });
    await expect(page.getByRole("alert").filter({ hasText: "Bir anımsatıcı türü seçin." })).toBeVisible();
    await expect(type).toHaveAttribute("aria-invalid", "true");
    await expect(type).toBeFocused();
  } finally {
    expect((await api(page, "DELETE", `/projects/${project.id}`)).status).toBe(204);
  }
});
