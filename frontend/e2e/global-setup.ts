import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { registerUser, uniqueUser } from "./helpers";

export const AUTH_DIR = path.join(__dirname, ".auth");
export const MANAGER_STORAGE = path.join(AUTH_DIR, "manager.json");
export const MANAGER_USER_FILE = path.join(AUTH_DIR, "manager-user.json");
export const MEMBER_STORAGE = path.join(AUTH_DIR, "member.json");
export const MEMBER_USER_FILE = path.join(AUTH_DIR, "member-user.json");

/**
 * Registers the two shared accounts once per suite run (a manager, and a second user for specs that need someone
 * who is not the manager) and saves their sessions as Playwright storageState, so individual spec files reuse the
 * same logins instead of each registering their own. Keeps the number of /auth/register calls per run low and
 * safely under AuthRateLimitFilter's 10-minute window, even across repeated local/pre-push runs.
 */
export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  for (const [prefix, storage, userFile] of [
    ["mgr", MANAGER_STORAGE, MANAGER_USER_FILE],
    ["shared", MEMBER_STORAGE, MEMBER_USER_FILE],
  ] as const) {
    const user = uniqueUser(prefix);
    const context = await browser.newContext({
      locale: "tr-TR",
      baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    });
    await registerUser(await context.newPage(), user);
    await context.storageState({ path: storage });
    writeFileSync(userFile, JSON.stringify(user));
    await context.close();
  }

  await browser.close();
}
