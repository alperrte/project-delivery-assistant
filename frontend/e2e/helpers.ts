import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

const PASSWORD = "E2ePassword1!";

export function uniqueUser(prefix: string) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    email: `e2e-${prefix}-${suffix}@example.test`,
    nickname: `e2e${prefix}${suffix}`.slice(0, 32),
    password: PASSWORD,
  };
}

export async function registerUser(page: Page, user: { email: string; nickname: string; password: string }) {
  await page.goto("/register");
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="nickname"]').fill(user.nickname);
  await page.locator('input[name="password"]').fill(user.password);
  await page.locator('input[name="confirmPassword"]').fill(user.password);
  await page.getByRole("button", { name: /^Kayıt ol$/ }).click();
  // Registration signs the new account in and opens the app.
  await expect(page.getByRole("navigation")).toBeVisible({ timeout: 15_000 });
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^Giriş yap$/ }).click();
  await expect(page.getByRole("navigation")).toBeVisible({ timeout: 15_000 });
}

export async function registerAndLogin(page: Page, prefix: string) {
  const user = uniqueUser(prefix);
  await registerUser(page, user);
  return user;
}

export async function createOrganization(page: Page, name: string) {
  await page.goto("/organizations");
  await page.getByRole("button", { name: /^Yeni organizasyon$/ }).click();
  await page.locator("#org-name").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: /^Oluştur$/ }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
}

/** Creates a project and returns its slug, parsed from the post-create redirect URL. */
export async function createProject(
  page: Page,
  name: string,
  opts: { organizationName?: string } = {},
): Promise<string> {
  await page.goto("/projects/new");
  await page.locator("#project-name").fill(name);
  await page.getByRole("radio", { name: /^Web/ }).click();

  if (opts.organizationName) {
    const orgSelect = page.getByRole("combobox");
    if (await orgSelect.isVisible().catch(() => false)) {
      await orgSelect.click();
      await page.getByRole("option", { name: opts.organizationName }).click();
    }
  }

  await page.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
  // The create page itself is `/projects/new`, so the new project is the first detail URL that is not "new".
  await expect(page).toHaveURL(/\/projects\/(?!new$)[^/]+$/, { timeout: 15_000 });
  const url = new URL(page.url());
  return url.pathname.split("/").pop()!;
}

/** Creates a team through the full-page form and returns its id, parsed from the post-create redirect. */
export async function createTeam(page: Page, slug: string, name: string): Promise<string> {
  await page.goto(`/projects/${slug}/teams/new`);
  await page.locator("#team-name").fill(name);
  await page.getByRole("button", { name: /^Ekibi oluştur$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${slug}/teams/(?!new$)[^/]+$`), { timeout: 15_000 });
  return new URL(page.url()).pathname.split("/").pop()!;
}

export async function gotoProjectTab(page: Page, slug: string, tabName: string) {
  await page.goto(`/projects/${slug}`);
  await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: tabName }).click();
}
