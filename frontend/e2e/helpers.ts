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
  // Registration signs the new account in and opens the app. The auth pages have their own navigation, so wait for
  // the app shell's main region: it only exists once the session cookies are set.
  await expect(page.locator("#main-content")).toBeVisible({ timeout: 15_000 });
}

/** Calls the backend with the page's own session and the CSRF dance, for setup and for asserting server-side rules. */
export async function api(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const base = "http://localhost:8080/api/v1";
      const csrfRes = await fetch(`${base}/auth/csrf`, { credentials: "include" });
      const { headerName } = await csrfRes.json();
      const cookie = document.cookie.split("; ").find((row) => row.startsWith("XSRF-TOKEN="));
      const csrf = decodeURIComponent(cookie?.slice("XSRF-TOKEN=".length) ?? "");
      const res = await fetch(`${base}${path}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", [headerName]: csrf },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, json: await res.json().catch(() => null) };
    },
    { method, path, body },
  );
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^Giriş yap$/ }).click();
  await expect(page.locator("#main-content")).toBeVisible({ timeout: 15_000 });
}

export async function registerAndLogin(page: Page, prefix: string) {
  const user = uniqueUser(prefix);
  await registerUser(page, user);
  return user;
}

export async function createOrganization(page: Page, name: string) {
  await page.goto("/organizations/new");
  await page.locator("#org-name").fill(name);
  await page.getByRole("button", { name: /^Oluştur$/ }).click();
  // Creating opens the new organization's own page.
  await expect(page).toHaveURL(/\/organizations\/(?!new$)[^/]+$/, { timeout: 10_000 });
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
