import { test, expect, type Page, type Browser } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { api, login } from "./helpers";
import { MANAGER_STORAGE, MANAGER_USER_FILE, MEMBER_USER_FILE } from "./global-setup";

type User = { email: string; password: string };
type Project = { id: string; slug: string; name: string };
type Note = { id: string; resourceId: string; read: boolean; popupPresentedAt: string | null; teamDeletion: { teamName: string } | null };
const member = () => JSON.parse(readFileSync(MEMBER_USER_FILE, "utf8")) as User;
const manager = () => JSON.parse(readFileSync(MANAGER_USER_FILE, "utf8")) as User;

async function setup(browser: Browser) {
  const ac = await browser.newContext({ storageState: MANAGER_STORAGE });
  const bc = await browser.newContext();
  const a = await ac.newPage(), b = await bc.newPage();
  await a.goto("/tr/projeler");
  await login(b, member().email, member().password);
  const user = (await api(b, "GET", "/auth/me")).json as { id: string };
  const response = await api(a, "POST", "/projects", { name: `Notification QA ${Date.now()}`, projectType: "WEB" });
  expect(response.status).toBe(201); const p = response.json as Project;
  const backup = (await api(a, "POST", `/projects/${p.id}/teams`, { name: "Notification backup", includeCreator: true })).json as { id: string };
  const teamName = `Notification target ${Date.now()}`;
  const team = (await api(a, "POST", `/projects/${p.id}/teams`, { name: teamName, includeCreator: true })).json as { id: string };
  const invited = await api(a, "POST", `/projects/${p.id}/invitations`, { userId: user.id, teamId: backup.id, roles: ["TESTER"] });
  expect(invited.status).toBe(201);
  const invitation = invited.json as { invitationId: string };
  expect((await api(b, "POST", `/project-invitations/${invitation.invitationId}/accept`)).status).toBe(200);
  expect((await api(a, "POST", `/projects/${p.id}/teams/${team.id}/members`, { userId: user.id })).status).toBe(201);
  return { ac, bc, a, b, p, team, teamName, user };
}
async function center(page: Page) {
  await page.mouse.move(20, 2);
  await page.getByRole("button", { name: "Bildirimler", exact: true }).click();
  return page.getByRole("dialog", { name: "Bildirimler", exact: true });
}
async function logout(page: Page) {
  await page.mouse.move(20, 2);
  await page.getByRole("button", { name: /Hesap menüsü/ }).click();
  await page.getByRole("menuitem", { name: "Çıkış yap", exact: true }).click();
  await expect(page.locator('input[name="email"]')).toBeVisible();
}
const popup = (page: Page) => page.locator('[data-sonner-toast][data-type="info"]').filter({ hasText: "Ekip silindi" });

test("offline login gets one team-deletion popup; close, refresh and center retain durable history and unread state", async ({ browser }) => {
  test.setTimeout(90_000); const f = await setup(browser);
  try {
    await logout(f.b);
    expect((await api(f.a, "DELETE", `/projects/${f.p.id}/teams/${f.team.id}`)).status).toBe(204);
    await login(f.b, member().email, member().password);
    await expect(popup(f.b)).toContainText(f.teamName, { timeout: 10_000 });
    const rows = (await api(f.b, "GET", "/notifications?type=SQUAD_DELETED&size=100")).json as { content: Note[] };
    const n = rows.content.find(n => n.resourceId === f.team.id)!;
    expect(n).toBeTruthy(); expect(n.read).toBe(false); expect(n.popupPresentedAt).toBeTruthy();
    await popup(f.b).getByRole("button", { name: "Bildirimi kapat", exact: true }).click();
    await expect(popup(f.b)).toHaveCount(0);
    await f.b.reload(); await expect(f.b.locator("#main-content")).toBeVisible();
    expect((await api(f.b, "POST", "/notifications/team-deletions/claim")).status).toBe(204);
    await expect(popup(f.b)).toHaveCount(0);
    const panel = await center(f.b);
    await expect(panel.getByText(f.teamName, { exact: false })).toBeVisible();
    const row = panel.locator(`[data-notification-id="${n.id}"]`);
    await row.getByRole("button", { name: "Okundu olarak işaretle" }).click();
    await expect(row).toContainText("Okundu");
    const after = (await api(f.b, "GET", "/notifications?type=SQUAD_DELETED&size=100")).json as { content: Note[] };
    expect(after.content.find(x => x.id === n.id)?.read).toBe(true);
    expect(after.content.find(x => x.id === n.id)?.popupPresentedAt).toBe(n.popupPresentedAt);
    const actorNotes = (await api(f.a, "GET", "/notifications?type=SQUAD_DELETED&size=100")).json as { content: Note[] };
    expect(actorNotes.content.some(x => x.resourceId === f.team.id)).toBe(false);
  } finally { await api(f.a, "POST", `/projects/${f.p.id}/archive`); await f.ac.close(); await f.bc.close(); }
});

test("foreground polling delivers to only one of two user contexts without stealing focus", async ({ browser }) => {
  test.setTimeout(90_000); const f = await setup(browser);
  const cc = await browser.newContext({ storageState: await f.bc.storageState() }), c = await cc.newPage();
  try {
    await c.goto("/tr/projeler"); await expect(c.locator("#main-content")).toBeVisible();
    const bell = c.getByRole("button", { name: "Bildirimler", exact: true }); await bell.focus();
    expect((await api(f.a, "DELETE", `/projects/${f.p.id}/teams/${f.team.id}`)).status).toBe(204);
    await c.bringToFront();
    await expect.poll(async () => await popup(f.b).count() + await popup(c).count(), { timeout: 45_000 }).toBe(1);
    await expect(bell).toBeFocused();
    expect((await api(c, "POST", "/notifications/team-deletions/claim")).status).toBe(204);
    const rows = (await api(c, "GET", "/notifications?type=SQUAD_DELETED&size=100")).json as { content: Note[] };
    expect(rows.content.filter(x => x.resourceId === f.team.id)).toHaveLength(1);
    expect(rows.content.find(x => x.resourceId === f.team.id)?.popupPresentedAt).toBeTruthy();
  } finally { await api(f.a, "POST", `/projects/${f.p.id}/archive`); await cc.close(); await f.ac.close(); await f.bc.close(); }
});

test("same-document recipient logout and another-account login never shows the previous private notification", async ({ browser }) => {
  const f = await setup(browser); let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  try {
    expect((await api(f.a, "DELETE", `/projects/${f.p.id}/teams/${f.team.id}`)).status).toBe(204);
    await f.b.reload(); await expect(popup(f.b)).toContainText(f.teamName);
    await popup(f.b).getByRole("button", { name: "Bildirimi kapat", exact: true }).click();
    const oldCenter = await center(f.b); await expect(oldCenter).toContainText(f.teamName);
    await f.b.keyboard.press("Escape");
    await f.b.evaluate(() => { (window as unknown as { notificationDocumentMarker: number }).notificationDocumentMarker = 42; });
    await logout(f.b);
    // TEST-ONLY latency gate; the response remains the real new-principal backend response, never route.fulfill.
    await f.b.route("**/api/v1/notifications?**", async route => { await delayed; await route.continue().catch(() => undefined); });
    const user = manager();
    await f.b.locator('input[name="email"]').fill(user.email); await f.b.locator('input[name="password"]').fill(user.password);
    await f.b.getByRole("button", { name: /^Giriş yap$/ }).click(); await expect(f.b.locator("#main-content")).toBeVisible();
    expect(await f.b.evaluate(() => (window as unknown as { notificationDocumentMarker: number }).notificationDocumentMarker)).toBe(42);
    const newCenter = await center(f.b); await expect(newCenter).not.toContainText(f.teamName); release();
    await expect(newCenter.getByRole("status", { name: "Bildirimler yükleniyor" })).toHaveCount(0);
    await expect(newCenter).not.toContainText(f.teamName);
  } finally { release?.(); await api(f.a, "POST", `/projects/${f.p.id}/archive`); await f.ac.close(); await f.bc.close(); }
});

test("notification center supports three languages, theme, mobile keyboard and real retry recovery", async ({ browser }) => {
  test.setTimeout(120_000); const f = await setup(browser);
  const labels = { tr: { path: "/tr/projeler", title: "Bildirimler", retry: "Tekrar dene" },
    en: { path: "/en/projects", title: "Notifications", retry: "Retry" },
    de: { path: "/de/projekte", title: "Benachrichtigungen", retry: "Erneut versuchen" } };
  try {
    expect((await api(f.a, "DELETE", `/projects/${f.p.id}/teams/${f.team.id}`)).status).toBe(204);
    // Claim before the visual matrix; subsequent document reloads must not replay the popup.
    await api(f.b, "POST", "/notifications/team-deletions/claim");
    for (const [locale, label] of Object.entries(labels)) {
      for (const dark of [false, true]) {
        await f.b.goto(label.path); await expect(f.b.locator("#main-content")).toBeVisible();
        await f.b.evaluate(value => { document.documentElement.classList.toggle("dark", value); }, dark);
        for (const width of [320, 390, 768, 1440]) {
          await f.b.setViewportSize({ width, height: 900 }); await f.b.mouse.move(20, 2);
          const bell = f.b.getByRole("button", { name: label.title, exact: true });
          await bell.focus(); await bell.press("Enter");
          const panel = f.b.getByRole("dialog", { name: label.title, exact: true });
          await expect(panel).toContainText(f.teamName);
          const box = (await panel.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
          expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
          if (width === 320 || width === 1440) await f.b.screenshot({ path: path.resolve(`../.local/squad-modernization/notification-${locale}-${width}-${dark ? "dark" : "light"}.png`) });
          await f.b.keyboard.press("Escape"); await expect(panel).toBeHidden(); await expect(bell).toBeFocused();
        }
      }
    }
    await f.b.goto("/tr/projeler");
    // TEST-ONLY network failure, then retry receives the actual server history.
    await f.b.route("**/api/v1/notifications?**", route => route.abort("failed"));
    const panel = await center(f.b); await expect(panel.getByRole("alert")).toBeVisible({ timeout: 15_000 });
    await f.b.unroute("**/api/v1/notifications?**");
    await panel.getByRole("button", { name: "Tekrar dene", exact: true }).click(); await expect(panel).toContainText(f.teamName);
  } finally { await api(f.a, "POST", `/projects/${f.p.id}/archive`); await f.ac.close(); await f.bc.close(); }
});
