import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REJECTED_STATE } from "./consent-state";
import { login, registerUser, uniqueUser } from "./helpers";

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
  const shared: { user: ReturnType<typeof uniqueUser>; storage: string }[] = [];
  for (const [prefix, storage, userFile] of [
    ["mgr", MANAGER_STORAGE, MANAGER_USER_FILE],
    ["shared", MEMBER_STORAGE, MEMBER_USER_FILE],
  ] as const) {
    const reuse = process.env.E2E_REUSE_USERS === "1" && existsSync(userFile);
    const user = reuse ? JSON.parse(readFileSync(userFile, "utf-8")) as ReturnType<typeof uniqueUser> : uniqueUser(prefix);
    const context = await browser.newContext({
      locale: "tr-TR",
      baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
      storageState: REJECTED_STATE,
    });
    if (reuse) await login(await context.newPage(), user.email, user.password);
    else await registerUser(await context.newPage(), user);
    await context.storageState({ path: storage });
    if (!reuse) writeFileSync(userFile, JSON.stringify(user));
    await context.close();
    shared.push({ user, storage });
  }

  // A full serial suite can outlive the 15-minute access token. New contexts
  // must load a current real session, without changing production token rules.
  let pending: Promise<void> | undefined;
  let renewalError: unknown;
  const renew = async () => {
    for (const { user, storage } of shared) {
      const context = await browser.newContext({
        locale: "tr-TR",
        baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
        storageState: REJECTED_STATE,
      });
      try {
        // API-only preparation must not mount notification/popup owners.
        const base = "http://localhost:8080/api/v1";
        const csrf = await context.request.get(`${base}/auth/csrf`);
        if (csrf.status() !== 200) throw new Error(`Shared fixture CSRF failed (${csrf.status()})`);
        const { headerName } = await csrf.json() as { headerName: string };
        const token = (await context.cookies(base)).find(cookie => cookie.name === "XSRF-TOKEN");
        if (!token) throw new Error("Shared fixture CSRF cookie is missing");
        const response = await context.request.post(`${base}/auth/login`, {
          headers: {
            [headerName]: decodeURIComponent(token.value),
            Origin: new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000").origin,
          },
          data: { email: user.email, password: user.password },
        });
        if (response.status() !== 200) throw new Error(`Shared fixture login failed (${response.status()})`);
        const state = await context.storageState();
        // Readers see either complete old JSON or complete new JSON.
        writeFileSync(storage + ".next", JSON.stringify(state));
        renameSync(storage + ".next", storage);
      } finally {
        await context.close();
      }
    }
    console.log("Shared E2E sessions renewed through real login.");
  };
  const timer = setInterval(() => {
    if (pending) return;
    pending = renew().catch(error => {
      renewalError = error;
      clearInterval(timer);
    }).finally(() => { pending = undefined; });
  }, 5 * 60_000);
  timer.unref();

  return async () => {
    clearInterval(timer);
    await pending;
    await browser.close();
    if (renewalError) throw renewalError;
  };
}
