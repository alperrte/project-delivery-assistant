import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { registerUser, login, uniqueUser } from "./helpers";

export const AUTH_DIR = path.join(__dirname, ".auth");
export const MANAGER_STORAGE = path.join(AUTH_DIR, "manager.json");
export const MANAGER_USER_FILE = path.join(AUTH_DIR, "manager-user.json");

/**
 * Registers the single shared manager account once per suite run and saves its
 * session as Playwright storageState, so individual spec files reuse the same
 * login instead of each registering their own account. Keeps the number of
 * /auth/register calls per run low and safely under AuthRateLimitFilter's
 * 10-minute window, even across repeated local/pre-push runs.
 */
export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true });

  const manager = uniqueUser("mgr");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    locale: "tr-TR",
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
  });
  const page = await context.newPage();

  await registerUser(page, manager);
  await login(page, manager.email, manager.password);

  await context.storageState({ path: MANAGER_STORAGE });
  writeFileSync(MANAGER_USER_FILE, JSON.stringify(manager));

  await browser.close();
}
