import { test, expect, type Page } from "@playwright/test";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";
import { seedQaInvitationPage } from "./invitation-db";
import { api } from "./helpers";
import { createIsolatedInvitationRecipient } from "./invitation-fixture";
import { MANAGER_STORAGE } from "./global-setup";

const refresh = async (page: Page) => { await page.evaluate(() => window.dispatchEvent(new Event("offline"))); await page.evaluate(() => window.dispatchEvent(new Event("online"))); };
const incoming = (page: Page) => page.locator("aside").getByRole("link", { name: "Davetler", exact: true });
const badge = (scope: ReturnType<Page["locator"]>) => scope.locator("[data-pending-invitation-count]");

test("real incoming and managed badges share totals; Teams disclosure and flyout retain route semantics", async ({ browser }) => {
  const ac = await browser.newContext({ storageState: MANAGER_STORAGE }), a = await ac.newPage();
  const bc = await browser.newContext(), b = await bc.newPage();
  const ids: string[] = [];
  try {
    await a.goto("/projects"); await b.goto("/login");
    ids.push((await createIsolatedInvitationRecipient(a,b)).bootstrapId);
    await b.goto("/invitations");
    const recipient = (await api(b, "GET", "/auth/me")).json as { id: string };
    await expect(badge(incoming(b))).toHaveCount(0);
    const invitations: string[] = [], slugs: string[] = [], targets: string[] = [];
    for (let i = 0; i < 2; i++) {
      const made = await api(a, "POST", "/projects", { name: `Badge QA ${Date.now()} ${i}`, projectType: "WEB" });
      expect(made.status).toBe(201);
      const project = made.json as { id: string; slug: string }; ids.push(project.id); targets.push(project.id); slugs.push(project.slug);
      const team = await api(a, "POST", `/projects/${project.id}/teams`, { name: "Badge team", includeCreator: true });
      expect(team.status).toBe(201);
      const invite = await api(a, "POST", `/projects/${project.id}/invitations`, { userId: recipient.id, teamId: (team.json as { id: string }).id, roles: ["TESTER"] });
      expect(invite.status).toBe(201); invitations.push((invite.json as { invitationId: string }).invitationId);
      await refresh(b);
      await expect(badge(incoming(b))).toHaveAttribute("data-pending-invitation-count", String(i + 1));
      await expect(b.locator("h1 [data-pending-invitation-count]")).toHaveAttribute("data-pending-invitation-count", String(i + 1));
    }
    // TEST-ONLY count transport failure: list/normal invitation success stays real.
    await b.route("**/api/v1/project-invitations/me?**", route => new URL(route.request().url()).searchParams.get("size") === "1" ? route.abort("failed") : route.continue());
    await refresh(b); await expect(badge(incoming(b))).toHaveCount(0); await expect(b.locator("h1 [data-pending-invitation-count]")).toHaveCount(0);
    await b.unroute("**/api/v1/project-invitations/me?**"); await refresh(b);
    await expect(badge(incoming(b))).toHaveAttribute("data-pending-invitation-count", "2");
    await a.goto(`/projects/${slugs[0]}?section=invitations`);
    const sidebar = a.locator("aside"), parent = sidebar.getByRole("button", { name: "Ekipler", exact: true });
    await expect(parent).toHaveAttribute("aria-expanded", "true");
    const managed = sidebar.getByRole("link", { name: "Ekip Davetleri", exact: true });
    await expect(managed).toHaveAttribute("aria-current", "page");
    await expect(badge(managed)).toHaveAttribute("data-pending-invitation-count", "1");
    await expect(a.locator("h1 [data-pending-invitation-count]")).toHaveAttribute("data-pending-invitation-count", "1");
    await parent.press("Space"); await expect(managed).toHaveCount(0);
    await parent.press("Enter"); await expect(managed).toBeVisible();
    await sidebar.getByRole("link", { name: "Tüm Ekipler", exact: true }).click();
    await expect(a).toHaveURL(/\/ekipler$/);
    await expect(parent).toHaveAttribute("aria-expanded", "true");
    await sidebar.getByRole("button", { name: /daralt/ }).click();
    const flyout = sidebar.getByRole("button", { name: "Ekipler", exact: true });
    await flyout.press("Enter");
    await a.getByRole("link", { name: "Ekip Davetleri", exact: true }).click();
    await expect(a).toHaveURL(/\/ekip-davetleri$/);
    await expect(a.getByRole("link", { name: "Ekip Davetleri", exact: true })).toHaveCount(0);
    // Real acceptance and rejection, while both consumers retain their warm query cache.
    expect((await api(b, "POST", `/project-invitations/${invitations[0]}/accept`)).status).toBe(200);
    await refresh(b); await refresh(a);
    await expect(a.locator("h1 [data-pending-invitation-count]")).toHaveCount(0);
    await expect(badge(incoming(b))).toHaveAttribute("data-pending-invitation-count", "1");
    await expect(b.locator("h1 [data-pending-invitation-count]")).toHaveAttribute("data-pending-invitation-count", "1");
    expect((await api(b, "POST", `/project-invitations/${invitations[1]}/reject`)).status).toBe(204);
    await refresh(b);
    await expect(badge(incoming(b))).toHaveCount(0);
    await expect(b.locator("h1 [data-pending-invitation-count]")).toHaveCount(0);
    expect((await api(b, "GET", `/projects/${targets[1]}/invitations/all?status=PENDING&size=1`)).status).toBe(403);
  } finally {
    for (const id of ids) await api(a, "POST", `/projects/${id}/archive`);
    await ac.close(); await bc.close();
  }
});


test("real 101-row managed total stays bounded and accessible on mobile and in three languages", async ({ browser }) => {
  const context = await browser.newContext({ storageState: MANAGER_STORAGE });
  const page = await context.newPage(); let id: string | undefined;
  try {
    await page.goto("/projects");
    const made = await api(page, "POST", "/projects", { name: `Overflow badge QA ${Date.now()}`, projectType: "WEB" });
    expect(made.status).toBe(201); const project = made.json as { id: string; slug: string }; id = project.id;
    const team = await api(page, "POST", `/projects/${id}/teams`, { name: "Count team", includeCreator: true });
    expect(team.status).toBe(201);
    const invite = await api(page, "POST", `/projects/${id}/invitations`, { email: `e2e-page-template-${Date.now()}@example.test`, firstName: "Page", lastName: "Count", teamId: (team.json as { id: string }).id, roles: ["TESTER"] });
    expect(invite.status).toBe(201);
    // TEST-ONLY bounded page fixture: actual server total, no usable token or synthetic UI response.
    seedQaInvitationPage((invite.json as { invitationId: string }).invitationId, 100);
    for (const [lang, route] of [["tr", "projeler"], ["en", "projects"], ["de", "projekte"]]) {
      await page.goto(`/${lang}/${route}/${project.slug}?section=invitations`);
      const headingBadge = page.locator("h1 [data-pending-invitation-count]");
      await expect(headingBadge).toHaveAttribute("data-pending-invitation-count", "101");
      await expect(headingBadge).toHaveText("99+");
      await expect(headingBadge).toHaveAttribute("aria-label", /101/);
      expect((await api(page, "GET", `/projects/${id}/invitations/all?status=PENDING&size=1`)).status).toBe(200);
      const labels=({tr,en,de})[lang as "tr"|"en"|"de"].projects.detail.tabs;
      const child=page.locator("aside").getByRole("link",{name:labels.invitations,exact:true});
      await expect.poll(()=>child.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
      await page.screenshot({path:`../.local/project-invitations-create-implementation/task7-nav-${lang}.png`});
    }
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(`/tr/projeler/${project.slug}?section=invitations`);
    await page.getByRole("button", { name: "Gezinme menüsü", exact: true }).click();
    const drawer = page.getByRole("dialog");
    const parent = drawer.getByRole("button", { name: "Ekipler", exact: true });
    await expect(parent).toHaveAttribute("aria-expanded", "true");
    await expect.poll(async () => (await parent.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await drawer.getByRole("link", { name: "Tüm Ekipler", exact: true }).click();
    await expect(page).toHaveURL(/\/ekipler$/);
    await expect(drawer).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  } finally {
    if (id) await api(page, "POST", `/projects/${id}/archive`);
    await context.close();
  }
});
