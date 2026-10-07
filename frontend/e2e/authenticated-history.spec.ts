import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { authenticatedRoute, AUTHENTICATED_ROUTES } from "../src/components/layout/authenticated-route";
import { authenticatedHistorySnapshot, HISTORY_BACK, HISTORY_FORWARD, HISTORY_BACK_BOUNDARY, HISTORY_BACK_UNVERIFIED, HISTORY_UNAUTHENTICATED } from "../src/components/layout/workspace-history";
import { api, login } from "./helpers";
import { MANAGER_USER_FILE } from "./global-setup";

test("history policy covers actual protected layouts and fails closed at adjacent public/unreadable entries", () => {
  const root = path.resolve(__dirname, "../src/app/(app)");
  function pages(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? pages(path.join(directory, item.name)) : item.name === "page.tsx" ? ["/" + path.relative(root, directory).split(path.sep).join("/")] : []);
  }
  expect(new Set(AUTHENTICATED_ROUTES)).toEqual(new Set(pages(root)));
  for (const url of ["/tr/genel-bakis", "/en/projects/a/tasks", "/de/konto", "/tr/projeler/a/ekipler/t", "/tasks"]) expect(authenticatedRoute(url)).toBe(true);
  for (const url of ["/", "/tr", "/tr/giris", "/en/register", "/de/anmelden", "/change-password", "/api/v1/auth/logout", "/logout", "/faq", "/projects-logout", "/unknown"]) expect(authenticatedRoute(url)).toBe(false);
  const native = { canGoBack: true, canGoForward: true, currentEntry: { index: 1 }, entries: () => [{ index: 0, url: "https://pda.test/tr/giris" }, { index: 1, url: "https://pda.test/tr/projeler" }, { index: 2, url: "https://pda.test/de/konto?tab=profile#field" }] };
  const snapshot = authenticatedHistorySnapshot(native, "https://pda.test/tr/projeler", true);
  expect(snapshot & HISTORY_BACK).toBe(0); expect(snapshot & HISTORY_BACK_BOUNDARY).toBeTruthy(); expect(snapshot & HISTORY_FORWARD).toBeTruthy();
  expect(authenticatedHistorySnapshot(native, "https://pda.test/tr/projeler", false)).toBe(HISTORY_UNAUTHENTICATED);
  expect(authenticatedHistorySnapshot({ ...native, entries: () => [{ index: 0, url: null }] }, "https://pda.test/tr/projeler", true) & HISTORY_BACK_UNVERIFIED).toBeTruthy();
  expect(authenticatedHistorySnapshot({ ...native, entries: undefined }, "https://pda.test/tr/projeler", true)).toBe(0);
});

test("real public-login-workspace boundary disables PDA back while private navigation and browser arrows remain native", async ({ browser }) => {
  const context = await browser.newContext(), page = await context.newPage();
  const account = JSON.parse(readFileSync(MANAGER_USER_FILE, "utf8")); let projectId: string | undefined;
  try {
    await page.goto("/tr/sss"); await login(page, account.email, account.password);
    await expect(page.getByTestId("workspace-back")).toBeDisabled();
    const native = await page.evaluate(() => (window as unknown as { navigation: { canGoBack: boolean } }).navigation.canGoBack);
    expect(native).toBe(true); // The public entry still exists; only the PDA policy blocks it.
    await page.locator('.app-shell a[href="/tr/projeler"]').first().click(); await expect(page.getByTestId("workspace-back")).toBeEnabled();
    await page.mouse.move(2, 2); await page.getByTestId("workspace-back").click(); await expect(page).toHaveURL(/\/tr\/genel-bakis$/);
    await expect(page.getByTestId("workspace-back")).toBeDisabled(); await page.mouse.move(2, 2); await page.getByTestId("workspace-forward").click(); await expect(page).toHaveURL(/\/tr\/projeler$/);
    const project = (await api(page, "POST", "/projects", { name: `Authenticated history QA ${Date.now()}`, projectType: "WEB" })).json as { id: string; slug: string }; projectId = project.id;
    await page.goto(`/projects/${project.slug}`); await expect(page.getByTestId("workspace-back")).toBeEnabled();
    await page.goBack(); await expect(page.getByTestId("workspace-forward")).toBeEnabled(); await page.mouse.move(2, 2); await page.getByTestId("workspace-forward").click(); await expect(page).toHaveURL(new RegExp(`/tr/projeler/${project.slug}$`));
  } finally { if (projectId) await api(page, "POST", `/projects/${projectId}/archive`); await context.close(); }
});
