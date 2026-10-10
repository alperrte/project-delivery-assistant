import { expect, type Browser, type Page } from "@playwright/test";
import { promoteToAdmin } from "./db";
import { adminSignIn, api, registerUser, uniqueUser } from "./helpers";

/** A registered, signed-in ordinary account in its own browser context. */
export async function newUser(browser: Browser, prefix: string, locale = "tr-TR") {
  const context = await browser.newContext({ locale });
  const page = await context.newPage();
  const user = uniqueUser(prefix);
  await registerUser(page, user);
  return { context, page, user };
}

/** Registered, promoted, then signed in through the separate administrator sign-in (password + authenticator). */
export async function newAdmin(browser: Browser, prefix = "adm") {
  const made = await newUser(browser, prefix);
  promoteToAdmin(made.user.email);
  await adminSignIn(made.page, made.user);
  await made.page.goto("/dashboard");
  await expect(made.page.locator("[data-admin-link]")).toBeVisible();
  return made;
}

export async function meId(page: Page): Promise<string> {
  return ((await api(page, "GET", "/auth/me")).json as { id: string }).id;
}

/** Posts to the real public contact endpoint from a logged-out visitor (same CSRF dance the application client does). */
export async function sendContact(browser: Browser, body: Record<string, unknown>): Promise<number> {
  const context = await browser.newContext({ locale: "tr-TR" });
  try {
    const page = await context.newPage();
    await page.goto("/tr/sss");
    return await page.evaluate(async (payload) => {
      const base = "http://localhost:8080/api/v1";
      const { headerName } = await (await fetch(`${base}/auth/csrf`, { credentials: "include" })).json();
      const token = decodeURIComponent(document.cookie.split("; ").find((row) => row.startsWith("XSRF-TOKEN="))?.slice(11) ?? "");
      const res = await fetch(`${base}/contact`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", [headerName]: token },
        body: JSON.stringify(payload),
      });
      return res.status;
    }, body);
  } finally {
    await context.close();
  }
}

/** Posts one analytics event to the real public endpoint, as the browser tracker would after consent. */
export async function sendAnalytics(page: Page, event: Record<string, unknown>): Promise<number> {
  return page.evaluate(async (payload) => {
    const base = "http://localhost:8080/api/v1";
    const { headerName } = await (await fetch(`${base}/auth/csrf`, { credentials: "include" })).json();
    const token = decodeURIComponent(document.cookie.split("; ").find((row) => row.startsWith("XSRF-TOKEN="))?.slice(11) ?? "");
    const res = await fetch(`${base}/analytics/events`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", [headerName]: token },
      body: JSON.stringify(payload),
    });
    return res.status;
  }, event);
}
