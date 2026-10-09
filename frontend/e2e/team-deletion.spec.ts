import { test, expect, type Page, type Browser } from "@playwright/test";
import { api } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import { teamDeletionInDatabase } from "./team-deletion-db";

type Project = { id: string; slug: string };
async function setup(browser: Browser, withMember = false) {
  const ac = await browser.newContext({ storageState: MANAGER_STORAGE }), a = await ac.newPage();
  await a.goto("/tr/projeler");
  const p = (await api(a, "POST", "/projects", { name: `Delete UX QA ${Date.now()}`, projectType: "WEB" })).json as Project;
  const backup = (await api(a, "POST", `/projects/${p.id}/teams`, { name: "Delete UX backup", includeCreator: true })).json as { id: string };
  const name = `Delete UX target ${Date.now()}`;
  const team = (await api(a, "POST", `/projects/${p.id}/teams`, { name, includeCreator: true })).json as { id: string };
  const actor = (await api(a, "GET", "/auth/me")).json as { id: string };
  const bc = await browser.newContext({ storageState: MEMBER_STORAGE }), b = await bc.newPage(); let user: { id: string } | undefined;
  if (withMember) {
    await b.goto("/projects");
    user = (await api(b, "GET", "/auth/me")).json as { id: string };
    const invited = (await api(a, "POST", `/projects/${p.id}/invitations`, { userId: user.id, teamId: backup.id, roles: ["TESTER"] })).json as { invitationId: string };
    expect((await api(b, "POST", `/project-invitations/${invited.invitationId}/accept`)).status).toBe(200);
    expect((await api(a, "POST", `/projects/${p.id}/teams/${team.id}/members`, { userId: user.id })).status).toBe(201);
  }
  return { ac, bc, a, b, p, backup, team, name, actor, user };
}
async function deleteDialog(page: Page, name: string) {
  await page.getByRole("button", { name: `${name} ekibini sil`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `${name} ekibini sil`, exact: true }); await expect(dialog).toBeVisible(); return dialog;
}

test("confirmed UI deletion dispatches once, keeps DB history and redirects another member's open detail without reload", async ({ browser }) => {
  test.setTimeout(90_000); const f = await setup(browser, true); let release!: () => void;
  const gate = new Promise<void>(r => { release = r; }); let requests = 0;
  try {
    await f.a.goto(`/tr/projeler/${f.p.slug}?section=teams`); await expect(f.a.getByRole("heading", { name: f.name, exact: true })).toBeVisible();
    await f.b.goto(`/tr/projeler/${f.p.slug}/ekipler/${f.team.id}`); await expect(f.b.getByRole("heading", { name: f.name, exact: true })).toBeVisible();
    await f.a.evaluate(() => { (window as unknown as { deleteDocumentMarker: number }).deleteDocumentMarker = 99; });
    // TEST-ONLY same-frame submission latency gate; the successful response remains the real backend response.
    await f.a.route(`**/api/v1/projects/${f.p.id}/teams/${f.team.id}`, async route => {
      if (route.request().method() === "DELETE") { requests++; await gate; } await route.continue();
    });
    const dialog = await deleteDialog(f.a, f.name);
    await expect(dialog).toContainText("Görevler ve geçmiş veriler korunur.");
    const confirm = dialog.getByRole("button", { name: "Ekibi Sil", exact: true });
    await confirm.evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
    await expect(confirm).toBeDisabled(); await expect.poll(() => requests).toBe(1); release();
    await expect(dialog).toBeHidden(); await expect(f.a.getByRole("heading", { name: f.name, exact: true })).toHaveCount(0);
    expect(await f.a.evaluate(() => (window as unknown as { deleteDocumentMarker: number }).deleteDocumentMarker)).toBe(99);
    await f.b.bringToFront(); await expect(f.b).toHaveURL(new RegExp(`/tr/projeler/${f.p.slug}/ekipler`), { timeout: 45_000 });
    const state = teamDeletionInDatabase(f.team.id, f.user!.id); expect(state.deleted).toBe(true); expect(state.memberRows).toBe(2); expect(state.notifications).toBe(1);
    expect(teamDeletionInDatabase(f.team.id, f.actor.id).notifications).toBe(0);
    const live = (await api(f.a, "GET", `/projects/${f.p.id}/teams`)).json as { content: { id: string }[] };
    expect(live.content.map(x => x.id)).toEqual([f.backup.id]);
  } finally { release?.(); await api(f.a, "POST", `/projects/${f.p.id}/archive`); await f.ac.close(); await f.bc.close(); }
});

test("last-team and child guards show accessible inline errors and preserve the team", async ({ browser }) => {
  const f = await setup(browser);
  try {
    await f.a.goto(`/tr/projeler/${f.p.slug}/ekipler/${f.backup.id}`);
    const backupName = "Delete UX backup";
    // Put a child under the backup; the server child guard must reject the actual DELETE.
    expect((await api(f.a, "POST", `/projects/${f.p.id}/teams`, { name: "Delete child", parentTeamId: f.backup.id, includeCreator: false })).status).toBe(201);
    let dialog = await deleteDialog(f.a, backupName); await dialog.getByRole("button", { name: "Ekibi Sil", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Önce alt ekipleri taşıyın veya silin.");
    await expect(dialog.getByRole("button", { name: "Ekibi Sil", exact: true })).toBeEnabled();
    await dialog.getByRole("button", { name: "İptal", exact: true }).click();
    expect(teamDeletionInDatabase(f.backup.id, f.actor.id).deleted).toBe(false);
    // Target becomes the actor's last team after removing their backup membership.
    expect((await api(f.a, "DELETE", `/projects/${f.p.id}/teams/${f.backup.id}/members/${f.actor.id}`)).status).toBe(204);
    await f.a.goto(`/tr/projeler/${f.p.slug}/ekipler/${f.team.id}`); dialog = await deleteDialog(f.a, f.name);
    await dialog.getByRole("button", { name: "Ekibi Sil", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Önce bu üyeleri başka bir ekibe ekleyin:");
    expect(teamDeletionInDatabase(f.team.id, f.actor.id).deleted).toBe(false);
  } finally { await api(f.a, "POST", `/projects/${f.p.id}/archive`); await f.ac.close(); await f.bc.close(); }
});

test("direct stale detail of a deleted team replaces to the living list; non-manager sees no delete action", async ({ browser }) => {
  const f = await setup(browser, true);
  try {
    await f.b.goto(`/tr/projeler/${f.p.slug}/ekipler/${f.team.id}`);
    await expect(f.b.getByRole("heading", { name: f.name, exact: true })).toBeVisible();
    await expect(f.b.getByRole("button", { name: `${f.name} ekibini sil`, exact: true })).toHaveCount(0);
    expect((await api(f.b, "DELETE", `/projects/${f.p.id}/teams/${f.team.id}`)).status).toBe(403);
    expect((await api(f.a, "DELETE", `/projects/${f.p.id}/teams/${f.team.id}`)).status).toBe(204);
    await f.b.goto(`/tr/projeler/${f.p.slug}/ekipler/${f.team.id}`);
    await expect(f.b).toHaveURL(new RegExp(`/tr/projeler/${f.p.slug}/ekipler`));
    await expect(f.b.getByRole("heading", { name: "Ekipler", exact: true })).toBeVisible();
  } finally { await api(f.a, "POST", `/projects/${f.p.id}/archive`); await f.ac.close(); await f.bc.close(); }
});
