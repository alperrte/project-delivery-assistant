import { test, expect, type Page } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";
import { createProject } from "./helpers";

test.use({ storageState: MANAGER_STORAGE });

/**
 * The Content-Security-Policy (src/proxy.ts, src/lib/security/csp.ts) must not block anything the signed-in app really
 * does: scripts, API calls, API images, the chat WebSocket and blob previews. A blocked request shows up as a
 * `securitypolicyviolation` event; any one of them fails the test.
 */
async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __cspViolations: string[] }).__cspViolations = [];
    document.addEventListener("securitypolicyviolation", event => {
      (window as unknown as { __cspViolations: string[] }).__cspViolations.push(`${event.violatedDirective} ${event.blockedURI} ${event.sourceFile ?? ""}`);
    });
  });
}

async function violations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? []);
}

test("the signed-in screens, the API images and the chat socket run without a single CSP violation", async ({ page }) => {
  await recordViolations(page);
  const consoleCsp: string[] = [];
  page.on("console", message => {
    if (/content security policy/i.test(message.text())) consoleCsp.push(message.text().slice(0, 240));
  });

  const slug = await createProject(page, `CSP ${Date.now().toString(36)}`);
  const seen: string[] = [];
  for (const path of ["/dashboard", `/projects/${slug}`, `/projects/${slug}/tasks`, `/projects/${slug}/tasks/board`, `/projects/${slug}/calendar`, "/organizations", "/account", "/settings", "/invitations"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    seen.push(...await violations(page));
  }

  // Chat: opening the dock connects the WebSocket to the API origin (connect-src ws:/wss:).
  await page.goto(`/projects/${slug}`);
  const chat = page.getByRole("button", { name: "Mesajlaşma" }).first();
  await expect(chat).toBeVisible();
  await chat.click();
  await page.waitForTimeout(1500);
  seen.push(...await violations(page));

  expect(seen, "CSP violations reported by the page").toEqual([]);
  expect(consoleCsp, "CSP messages in the console").toEqual([]);
  // The policy really is the nonce-based one, not an accidentally missing header.
  const response = await page.request.get("/tr/giris");
  expect(response.headers()["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
});
