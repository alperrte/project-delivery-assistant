import { test, expect, type Page } from "@playwright/test";
import { createProject, uniqueUser } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";

test("external invitation registers an account and joins General Team with invited role", async ({ browser }) => {
  const managerContext = await browser.newContext({ storageState: MANAGER_STORAGE });
  const inviteeContext = await browser.newContext();
  const manager: Page = await managerContext.newPage();
  const invitee: Page = await inviteeContext.newPage();
  const user = uniqueUser("external");
  const projectName = `External invitation ${Date.now()}`;

  try {
    const slug = await createProject(manager, projectName);
    await manager.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Ekipler" }).click();
    await manager.getByRole("button", { name: /^Üye davet et$/ }).click();
    const dialog = manager.getByRole("dialog");
    await dialog.getByRole("button", { name: "Yeni PDA kullanıcısı" }).click();
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
    const created = await response.json();
    expect(created.token).toBeTruthy();

    await invitee.goto(`/register#invitation=${created.token}`);
    await expect(invitee.getByText(projectName)).toBeVisible();
    await expect(invitee.getByText("Ekibimize katılın.")).toBeVisible();
    await invitee.getByLabel("Kullanıcı adı").fill(user.nickname);
    await invitee.getByLabel("Şifre", { exact: true }).fill(user.password);
    await invitee.getByLabel("Şifre tekrarı").fill(user.password);
    await invitee.getByRole("button", { name: "Kayıt ol ve projeye katıl" }).click();
    await expect(invitee).toHaveURL(new RegExp(`/projects/${slug}$`), { timeout: 20_000 });

    await manager.goto(`/projects/${slug}?section=teams`);
    await manager.getByRole("link", { name: /General Team üyeleri/ }).click();
    await expect(manager.getByRole("row", { name: new RegExp(user.nickname) })).toBeVisible();
    await expect(manager.getByRole("row", { name: new RegExp(user.nickname) }).getByText("Test Uzmanı")).toBeVisible();
  } finally {
    await managerContext.close();
    await inviteeContext.close();
  }
});
