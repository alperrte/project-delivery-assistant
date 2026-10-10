import { test, expect, type Page } from "@playwright/test";
import { createProject, createTeam, uniqueUser } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";

test("external invitation registers an account and joins the invited team with the invited role", async ({ browser }) => {
  const managerContext = await browser.newContext({ storageState: MANAGER_STORAGE });
  const inviteeContext = await browser.newContext();
  const manager: Page = await managerContext.newPage();
  const invitee: Page = await inviteeContext.newPage();
  const user = uniqueUser("external");
  const projectName = `External invitation ${Date.now()}`;

  try {
    const slug = await createProject(manager, projectName);
    const teamId = await createTeam(manager, slug, "Backend");
    await manager.getByRole("link", { name: /^Üye davet et$/ }).first().click();
    await expect(manager).toHaveURL(`/tr/projeler/${slug}/ekip-davetleri/yeni?team=${teamId}`);
    const dialog = manager.locator("#main-content form"); // a full page since the invite dialog was retired
    await dialog.getByRole("tab", { name: "E-posta ile davet" }).click();
    await dialog.getByLabel("Ad", { exact: true }).fill("Çağrı");
    await dialog.getByLabel("Soyad").fill("Şahin");
    await dialog.getByLabel("E-posta").fill(user.email);
    await dialog.getByRole("checkbox").nth(6).check(); // TESTER
    await dialog.getByLabel("Davet mesajı (isteğe bağlı)").fill("Ekibimize katılın.");
    const [response] = await Promise.all([
      manager.waitForResponse((res) => res.url().endsWith("/invitations") && res.request().method() === "POST"),
      dialog.getByRole("button", { name: "Davet gönder" }).click(),
    ]);
    expect(response.status()).toBe(201);
    await expect(manager).toHaveURL(`/tr/projeler/${slug}/ekipler/${teamId}`);
    const created = await response.json();
    expect(created.token).toBeTruthy();

    await invitee.goto(`/register#invitation=${created.token}`);
    await expect(invitee.getByText(projectName)).toBeVisible();
    await expect(invitee.getByText("Ekibimize katılın.")).toBeVisible();
    await invitee.getByLabel("Kullanıcı adı").fill(user.nickname);
    await invitee.getByLabel("Şifre", { exact: true }).fill(user.password);
    await invitee.getByLabel("Şifre tekrarı").fill(user.password);
    // The invitation form carries the same notice as the normal one: links to the terms, the KVKK notice and the privacy policy, no consent box.
    const notice = invitee.locator("form p", { hasText: "Kayıt olarak" });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole("link", { name: /Kullanım Koşulları/ })).toHaveAttribute("href", "/tr/kullanim-kosullari");
    await expect(notice.getByRole("link", { name: /KVKK Aydınlatma Metni/ })).toHaveAttribute("href", "/tr/kvkk");
    await expect(notice.getByRole("link", { name: /Gizlilik Politikası/ })).toHaveAttribute("href", "/tr/gizlilik");
    await expect(invitee.locator("form").getByRole("checkbox")).toHaveCount(0);
    await invitee.getByRole("button", { name: "Kayıt ol ve projeye katıl" }).click();
    await expect(invitee).toHaveURL(new RegExp(`/tr/projeler/${slug}/genel-bakis$`), { timeout: 20_000 });

    await manager.goto(`/projects/${slug}/teams/${teamId}`);
    await expect(manager.getByRole("row", { name: new RegExp(user.nickname) })).toBeVisible();
    await expect(manager.getByRole("row", { name: new RegExp(user.nickname) }).getByText("Test Uzmanı")).toBeVisible();
  } finally {
    await managerContext.close();
    await inviteeContext.close();
  }
});
