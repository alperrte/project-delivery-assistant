import { test, expect } from "@playwright/test";
import path from "node:path";
import { api } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import { invitationInDatabase, seedQaInvitationPage } from "./invitation-db";
import { PROJECT_ROLES } from "../src/features/projects/types";
import tr from "../src/i18n/messages/tr.json";

test("real invitation form, eight role icons, inviter summary and responsive history preserve resend/cancel/accept", async ({ browser }) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({ storageState: MANAGER_STORAGE }), page = await context.newPage();
  const memberContext = await browser.newContext({ storageState: MEMBER_STORAGE }), member = await memberContext.newPage();
  page.setDefaultTimeout(15_000);
  await page.goto("/tr/projeler");
  const project = (await api(page, "POST", "/projects", { name: `Invitation UI QA ${Date.now()}`, projectType: "WEB" })).json as { id: string; slug: string };
  try {
    const team = (await api(page, "POST", `/projects/${project.id}/teams`, { name: "Modern invitation team", includeCreator: true })).json as { id: string };
    const actor = (await api(page, "GET", "/auth/me")).json as { nickname: string };
    await page.goto(`/projects/${project.slug}?section=invitations`);
    await page.getByRole("button", { name: tr.invitations.invite, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: tr.squads.addMember.title, exact: true });
    await dialog.getByRole("combobox", { name: tr.squads.addMember.team, exact: true }).click();
    await page.getByRole("option", { name: "Modern invitation team", exact: true }).click();
    await dialog.getByRole("tab", { name: tr.squads.addMember.modeEmail, exact: true }).click();
    await dialog.getByLabel(tr.invitations.firstName, { exact: true }).fill("Mehmet Ali");
    await dialog.getByLabel(tr.invitations.lastName, { exact: true }).fill("Yılmaz");
    const email = `e2e-modern-invitation-long-address-${Date.now()}@example.test`;
    await dialog.getByLabel(tr.invitations.email, { exact: true }).fill(email);
    for (const role of PROJECT_ROLES) await dialog.getByRole("checkbox", { name: tr.roles[role], exact: true }).check();
    await expect(dialog.locator("fieldset label svg.shrink-0[aria-hidden=true]")).toHaveCount(8);
    const createResponse = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/projects/${project.id}/invitations`));
    await dialog.getByRole("button", { name: tr.invitations.send, exact: true }).click();
    const response = await createResponse; expect(response.status()).toBe(201);
    const created = await response.json() as { invitationId: string };
    await expect(dialog).toBeHidden();
    const row = page.getByRole("row").filter({ hasText: "Mehmet Ali Yılmaz" });
    await expect(row).toContainText(actor.nickname);
    await expect(row.locator('[data-slot="badge"] svg[aria-hidden=true]')).toHaveCount(8);
    const all = (await api(page, "GET", `/projects/${project.id}/invitations/all?status=PENDING`)).json as { content: { invitedByNickname: string; initialRoles: string[] }[] };
    expect(all.content[0].invitedByNickname).toBe(actor.nickname);
    expect(new Set(all.content[0].initialRoles)).toEqual(new Set(PROJECT_ROLES));
    await page.evaluate(() => { (window as unknown as { invitationDocument: number }).invitationDocument = 5; });
    const resendResponse = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/invitations/${created.invitationId}/resend`));
    await row.getByRole("button", { name: tr.invitations.resendNamed.replace("{name}", "Mehmet Ali Yılmaz"), exact: true }).click();
    const renewedResponse = await resendResponse; expect(renewedResponse.status()).toBe(200);
    const renewed = await renewedResponse.json() as { invitationId: string };
    expect(renewed.invitationId).not.toBe(created.invitationId);
    await row.getByRole("button", { name: tr.invitations.cancelNamed.replace("{name}", "Mehmet Ali Yılmaz"), exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: tr.invitations.cancel, exact: true }).click();
    await expect(row).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { invitationDocument: number }).invitationDocument)).toBe(5);
    await member.goto("/projects");
    const principal = (await api(member, "GET", "/auth/me")).json as { id: string };
    const registered = (await api(page, "POST", `/projects/${project.id}/invitations`, { userId: principal.id, teamId: team.id, roles: PROJECT_ROLES })).json as { invitationId: string };
    expect((await api(member, "POST", `/project-invitations/${registered.invitationId}/accept`)).status).toBe(200);
    expect(invitationInDatabase(registered.invitationId, principal.id)).toMatchObject({ status: "ACCEPTED", membership: "ACTIVE", teamRows: 1 });
    expect(new Set(invitationInDatabase(registered.invitationId, principal.id).roles)).toEqual(new Set(PROJECT_ROLES));
    for (const locale of ["tr", "en", "de"]) {
      await page.goto(`/${locale}/projects/${project.slug}?section=invitations&status=CANCELLED`);
      for (const dark of [false, true]) {
        await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), dark);
        for (const width of [320, 390, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          const surface = page.locator(width < 768 ? '#main-content ul[aria-label]' : '#main-content table');
          await expect(surface.getByText("Mehmet Ali Yılmaz", { exact: true }).first()).toBeVisible();
          await expect.poll(() => surface.locator('[data-slot="badge"]').evaluateAll(badges => badges.every(badge => [...badge.querySelectorAll("span")].every(text => text.getBoundingClientRect().bottom <= badge.getBoundingClientRect().bottom + 0.5)))).toBe(true);
          await page.locator("#main-content").screenshot({ path: path.resolve(__dirname, `../../.local/squad-modernization/invitations-${locale}-${width}-${dark ? "dark" : "light"}.png`) });
        }
      }
    }
  } finally {
    await api(page, "POST", `/projects/${project.id}/archive`);
    await context.close(); await memberContext.close();
  }
});

test("real server pagination clamps after cancelling the last invitation on page2", async ({ browser }) => {
  const context = await browser.newContext({ storageState: MANAGER_STORAGE }), page = await context.newPage();
  await page.goto("/tr/projeler");
  const project = (await api(page, "POST", "/projects", { name: `Invitation page QA ${Date.now()}`, projectType: "WEB" })).json as { id: string; slug: string };
  try {
    const team = (await api(page, "POST", `/projects/${project.id}/teams`, { name: "Page boundary team", includeCreator: true })).json as { id: string };
    const template = await api(page, "POST", `/projects/${project.id}/invitations`, { teamId: team.id, email: `e2e-page-template-${Date.now()}@example.test`, firstName: "Pagination", lastName: "Template", roles: ["TESTER"] });
    expect(template.status).toBe(201);
    seedQaInvitationPage((template.json as { invitationId: string }).invitationId);
    await page.goto(`/projects/${project.slug}?section=invitations&page=2`);
    await expect(page.getByRole("row").filter({ hasText: "Pagination Template" })).toBeVisible();
    await page.evaluate(() => { (window as unknown as { pageBoundaryDocument: number }).pageBoundaryDocument = 9; });
    await page.getByRole("button", { name: tr.invitations.cancelNamed.replace("{name}", "Pagination Template"), exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: tr.invitations.cancel, exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBeNull();
    await expect(page.getByRole("row").filter({ hasText: "Pagination Page" })).toHaveCount(20);
    expect(await page.evaluate(() => (window as unknown as { pageBoundaryDocument: number }).pageBoundaryDocument)).toBe(9);
    expect((await api(page, "GET", `/projects/${project.id}/invitations/all?status=PENDING`)).json).toMatchObject({ totalElements: 20, totalPages: 1 });
  } finally { await api(page, "POST", `/projects/${project.id}/archive`); await context.close(); }
});
