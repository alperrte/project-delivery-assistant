import { expect, type Browser, type Page } from "@playwright/test";
import { api } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

export type HistoryNote = { id: string; resourceId: string; read: boolean; readAt: string | null };
export async function notificationFixture(browser: Browser, tasks = 2) {
  const ac = await browser.newContext({ storageState: MANAGER_STORAGE }), a = await ac.newPage();
  const bc = await browser.newContext({ storageState: MEMBER_STORAGE }), b = await bc.newPage();
  let projectId: string | undefined;
  try {
    await a.goto("/projects"); await b.goto("/projects");
    const user = (await api(b, "GET", "/auth/me")).json as { id: string };
    const created = await api(a, "POST", "/projects", { name: `Read state QA ${Date.now()}`, projectType: "WEB" });
    expect(created.status).toBe(201); projectId = (created.json as { id: string }).id;
    await api(a, "PATCH", `/projects/${projectId}/task-management-mode`, { mode: "BOTH" });
    const team = (await api(a, "POST", `/projects/${projectId}/teams`, { name: "Read state team", includeCreator: true })).json as { id: string };
    const invite = await api(a, "POST", `/projects/${projectId}/invitations`, { userId: user.id, teamId: team.id, roles: ["TESTER"] });
    expect(invite.status).toBe(201);
    expect((await api(b, "POST", `/project-invitations/${(invite.json as { invitationId: string }).invitationId}/accept`)).status).toBe(200);
    // Only the suite's own QA recipient is used; clear setup unread state with the real read-all API.
    await api(b, "PATCH", "/notifications/read-all");
    for (let i = 0; i < tasks; i++) expect((await api(a, "POST", `/projects/${projectId}/tasks`, {
      title: `Read state task ${i}`, creationMode: "SIMPLE", assigneeIds: [user.id],
    })).status).toBe(201);
    const notes = ((await api(b, "GET", "/notifications?read=false&size=100")).json as { content: HistoryNote[] }).content;
    expect(notes).toHaveLength(tasks);
    return { ac, bc, a, b, user, notes, projectId,
      cleanup: async () => { await api(a, "POST", `/projects/${projectId}/archive`); await ac.close(); await bc.close(); } };
  } catch (error) { if (projectId) await api(a, "POST", `/projects/${projectId}/archive`); await ac.close(); await bc.close(); throw error; }
}

export async function openNotificationCenter(page: Page) {
  await page.mouse.move(20, 2);
  await page.getByRole("button", { name: "Bildirimler", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Bildirimler", exact: true });
  await expect(panel).toBeVisible(); return panel;
}
