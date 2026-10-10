import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { matchPath } from "../src/i18n/routing";
import tr from "../src/i18n/messages/tr.json";
import { psql } from "./db";
import { mailsTo, waitForCode } from "./mailpit";

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
  // The account starts unverified: the mailed code (read from the e2e stack's Mailpit) activates it and the page
  // signs the person in with the password just typed. The auth pages have their own navigation, so wait for the app
  // shell's main region: it only exists once the session cookies are set.
  await expect(page).toHaveURL(url => matchPath(url.pathname)?.route === "/verify-email", { timeout: 15_000 });
  await page.getByLabel(tr.codeEntry.label, { exact: true }).fill(await waitForCode(user.email));
  await page.getByRole("button", { name: tr.verifyEmail.verify, exact: true }).click();
  await expect(page.locator("#main-content")).toBeVisible({ timeout: 15_000 });
}

/**
 * Account settings → password: the form sits behind a mailed code. Requests the code, enters it, and leaves the page
 * on the open current/new/confirm form.
 */
export async function openPasswordChangeForm(page: Page, email: string) {
  // The server mails at most one code a minute per account; several tests share one account, so start each from a
  // clean slate (test-only database access, like the other helpers in db.ts).
  if (!/^[\w.+-]+@[\w.-]+$/.test(email)) throw new Error("Unexpected e-mail address in a test");
  psql(`DELETE FROM password_change_challenges WHERE user_id = (SELECT id FROM users WHERE email = '${email}')`);
  await page.goto("/account");
  await page.waitForLoadState("networkidle");
  const mailsBefore = (await mailsTo(email)).length;
  await page.getByRole("button", { name: tr.securityFlow.password.start, exact: true }).click();
  await page.getByLabel(tr.codeEntry.label, { exact: true }).fill(await waitForCode(email, mailsBefore));
  await page.getByRole("button", { name: tr.securityFlow.password.verify, exact: true }).click();
  await expect(page.getByLabel(tr.changePassword.currentPassword, { exact: true })).toBeVisible();
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
  await expect(page).toHaveURL(url => matchPath(url.pathname)?.route === "/organizations/[organizationId]", { timeout: 10_000 });
}

/** Creates a project and returns its slug, parsed from the post-create redirect URL. */
/** After "Projeyi oluştur" the page asks whether to create a team now; most tests just want the project page. */
export async function declineTeamPrompt(page: Page) {
  const dialog = page.getByRole("dialog").filter({ hasText: "Henüz bir proje ekibiniz yok" });
  await dialog.getByRole("button", { name: "Hayır", exact: true }).click();
}

/** Wait for the canonical post-create overview and read the slug, not its translated leaf segment. */
export async function createdProjectSlug(page: Page): Promise<string> {
  await expect(page).toHaveURL(url => matchPath(url.pathname)?.route === "/projects/[slug]/overview", { timeout: 15_000 });
  return matchPath(new URL(page.url()).pathname)!.params.slug;
}

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
  await declineTeamPrompt(page);
  const slug = await createdProjectSlug(page);
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

/** Picks an "HH:mm" time in a `TimePicker` through its hour and minute columns, then closes the popup. */
export async function chooseTime(page: Page, id: string, time: string) {
  const [hour, minute] = time.split(":");
  await page.locator(`#${id}`).click();
  const panel = page.locator(`#${id}-time`);
  await panel.locator(`[data-hour="${hour}"]`).click();
  await panel.locator(`[data-minute="${minute}"]`).click();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
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
  await expect(page).toHaveURL(url => {
    const match = matchPath(url.pathname);
    return match?.route === "/projects/[slug]/teams/[teamId]" && match.params.slug === slug;
  }, { timeout: 15_000 });
  return matchPath(new URL(page.url()).pathname)!.params.teamId;
}

export async function gotoProjectTab(page: Page, slug: string, tabName: string) {
  await page.goto(`/projects/${slug}`);
  await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: tabName }).click();
}
