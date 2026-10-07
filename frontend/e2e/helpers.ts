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
  await page.getByRole("button", { name: /^Organizasyonu oluştur$/ }).click();
  // Creating opens the new organization's own page.
  await expect(page).toHaveURL(/\/tr\/organizasyonlar\/(?!yeni$)[^/]+$/, { timeout: 10_000 });
}

/** Creates a project and returns its slug, parsed from the post-create redirect URL. */
export async function createProject(
  page: Page,
  name: string,
  opts: { organizationName?: string; taskMode?: "SIMPLE" | "ADVANCED" | "BOTH" | null } = {},
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
  await expect(page).toHaveURL(/\/tr\/projeler\/(?!yeni$)[^/]+$/, { timeout: 15_000 });
  const url = new URL(page.url());
  const slug = url.pathname.split("/").pop()!;
  // Unrelated tests use an explicitly configured fixture; onboarding tests leave the policy unset.
  if (opts.taskMode !== null) {
    const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string };
    expect((await api(page, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: opts.taskMode ?? "BOTH" })).status).toBe(200);
  }
  return slug;
}

/** Picks a day in a `DatePicker` (year, then month, then the day cell), the way a person does. */
export async function chooseDate(page: Page, id: string, date: string) {
  await page.locator(`#${id}`).click();
  const calendar = page.locator(`#${id}-calendar`);
  await calendar.getByRole("combobox", { name: "Yıl", exact: true }).click();
  await page.getByRole("option", { name: date.slice(0, 4), exact: true }).click();
  await calendar.getByRole("combobox", { name: "Ay", exact: true }).click();
  const month = new Intl.DateTimeFormat("tr", { month: "long" }).format(new Date(2024, Number(date.slice(5, 7)) - 1, 1));
  await page.getByRole("option", { name: month, exact: true }).click();
  await calendar.locator(`[data-date="${date}"]`).click();
  await expect(calendar).toHaveCount(0);
}

/** Finds this project's card even when a reused E2E account has several pages of projects. */
export async function openProjectListPage(page: Page, slug: string) {
  const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string };
  let pageIndex = 0;
  let totalPages = 1;
  while (pageIndex < totalPages) {
    const result = await api(page, "GET", `/projects?page=${pageIndex}&size=12`);
    expect(result.status).toBe(200);
    const data = result.json as { content: { id: string }[]; totalPages: number };
    if (data.content.some((item) => item.id === project.id)) {
      await page.goto(pageIndex === 0 ? "/projects" : `/projects?page=${pageIndex + 1}`);
      return;
    }
    totalPages = data.totalPages;
    pageIndex += 1;
  }
  throw new Error(`Created project ${slug} was not returned by the project list`);
}

/** Creates a team through the full-page form and returns its id, parsed from the post-create redirect. */
export async function createTeam(page: Page, slug: string, name: string): Promise<string> {
  await page.goto(`/projects/${slug}/teams/new`);
  await page.locator("#team-name").fill(name);
  await page.getByRole("button", { name: /^Ekibi oluştur$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/tr/projeler/${slug}/ekipler/(?!yeni$)[^/]+$`), { timeout: 15_000 });
  return new URL(page.url()).pathname.split("/").pop()!;
}

export async function gotoProjectTab(page: Page, slug: string, tabName: string) {
  await page.goto(`/projects/${slug}`);
  await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: tabName }).click();
}
