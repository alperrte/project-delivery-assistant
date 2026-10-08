import { test, expect } from "@playwright/test";
import { api } from "./helpers";
import { createIsolatedInvitationRecipient } from "./invitation-fixture";
import { MANAGER_STORAGE } from "./global-setup";

type InvitationPage = { totalElements: number; content: { id: string; status: string; projectName: string | null }[] };

test("real incoming totals exclude archived projects and retain invitation history", async ({ browser }) => {
  const ac = await browser.newContext({ storageState: MANAGER_STORAGE }), a = await ac.newPage();
  const bc = await browser.newContext(), b = await bc.newPage();
  const projects: string[] = [];
  let bootstrapId: string | undefined;
  try {
    await a.goto("/projects");
    bootstrapId=(await createIsolatedInvitationRecipient(a,b)).bootstrapId;
    await b.goto("/invitations");
    const recipient = (await api(b, "GET", "/auth/me")).json as { id: string };
    const count = async () => {
      const result = await api(b, "GET", "/project-invitations/me?status=PENDING&page=0&size=1");
      expect(result.status).toBe(200); return (result.json as InvitationPage).totalElements;
    };
    expect(await count()).toBe(0);
    const invitations: string[] = [];
    for (let i = 0; i < 2; i++) {
      const project = await api(a, "POST", "/projects", { name: `Pending contract QA ${Date.now()} ${i}`, projectType: "WEB" });
      expect(project.status).toBe(201); const id = (project.json as { id: string }).id; projects.push(id);
      const team = await api(a, "POST", `/projects/${id}/teams`, { name: "Contract team", includeCreator: true });
      expect(team.status).toBe(201);
      const invite = await api(a, "POST", `/projects/${id}/invitations`, { userId: recipient.id, teamId: (team.json as { id: string }).id, roles: ["TESTER"] });
      expect(invite.status).toBe(201); invitations.push((invite.json as { invitationId: string }).invitationId);
      expect(await count()).toBe(i + 1);
      const managed = await api(a, "GET", `/projects/${id}/invitations/all?status=PENDING&page=0&size=1`);
      expect(managed.status).toBe(200); expect((managed.json as InvitationPage).totalElements).toBe(1);
      expect((await api(b, "GET", `/projects/${id}/invitations/all?status=PENDING&size=1`)).status).toBe(403);
    }
    expect((await api(a, "POST", `/projects/${projects[0]}/archive`)).status).toBe(204);
    expect(await count()).toBe(1);
    const history = await api(b, "GET", "/project-invitations/me?size=100");
    expect(history.status).toBe(200);
    expect((history.json as InvitationPage).content.find(row => row.id === invitations[0])).toMatchObject({ status: "PENDING", projectName: null });
    expect((await api(b, "POST", `/project-invitations/${invitations[1]}/reject`)).status).toBe(204);
    expect(await count()).toBe(0);
  } finally {
    for (const id of projects) await api(a, "POST", `/projects/${id}/archive`);
    if(bootstrapId)await api(a,"POST",`/projects/${bootstrapId}/archive`);
    await ac.close(); await bc.close();
  }
});
