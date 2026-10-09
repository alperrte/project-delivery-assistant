import { test, expect, type Page } from "@playwright/test";
import { createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

type ApiResult = { status: number; json: unknown };

/** Calls the backend with the page's own session and the CSRF dance, for setup and for asserting server-side rules. */
async function api(page: Page, method: string, path: string, body?: unknown): Promise<ApiResult> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const base = "http://localhost:8080/api/v1";
      const csrfRes = await fetch(`${base}/auth/csrf`, { credentials: "include" });
      const { headerName } = await csrfRes.json();
      const cookie = document.cookie.split("; ").find((row) => row.startsWith("XSRF-TOKEN="));
      const csrf = decodeURIComponent(cookie?.slice("XSRF-TOKEN=".length) ?? "");
      const res = await fetch(`${base}${path}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", [headerName]: csrf },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, json: await res.json().catch(() => null) };
    },
    { method, path, body },
  );
}

type TaskJson = { id: string; taskKey: string; status: string; assignees: { userId: string }[]; pool: { open: boolean } };

/**
 * Task management, end to end, with a Project Manager and a normal member:
 *   - the manager creates a task through the full-page form;
 *   - the member can read and comment but not edit, and the server refuses what the UI hides;
 *   - the pool: put a task there, claim it, and a double claim loses with a 409;
 *   - status changes follow the allowed transitions only;
 *   - comments and @mentions reach the mentioned person as a notification;
 *   - "Görevlerim" counts follow the assignments.
 */
test.describe.serial("Task management", () => {
  let managerPage: Page;
  let memberPage: Page;
  let slug: string;
  let projectId: string;
  let memberId: string;
  let memberNickname: string;
  let formTask: TaskJson;
  let poolTask: TaskJson;
  const formTitle = `Ödeme akışına 3-D Secure ekle ${Date.now()}`;
  const poolTitle = "Havuzdaki E2E görevi";
  const claimedTitle = `Üstlenilecek görev ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    managerPage = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    memberPage = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
  });

  test.afterAll(async () => {
    await managerPage.close();
    await memberPage.close();
  });

  test("a manager and a member share a project", async () => {
    slug = await createProject(managerPage, `E2E Task Project ${Date.now()}`);
    projectId = ((await api(managerPage, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;

    await memberPage.goto("/projects");
    const me = (await api(memberPage, "GET", "/auth/me")).json as { id: string; nickname: string };
    memberId = me.id;
    memberNickname = me.nickname;
    const team = await api(managerPage, "POST", `/projects/${projectId}/teams`, { name: "E2E Team" });
    expect(team.status).toBe(201);
    const invite = await api(managerPage, "POST", `/projects/${projectId}/invitations`, {
      userId: memberId,
      roles: ["FRONTEND_DEVELOPER"],
      teamId: (team.json as { id: string }).id,
    });
    expect(invite.status).toBe(201);
    const { invitationId, token } = invite.json as { invitationId: string; token: string };
    const accepted = await api(memberPage, "POST", `/projects/${projectId}/invitations/${invitationId}/accept`, { token });
    expect(accepted.status).toBe(200);
  });

  test("the manager creates a task with the form and sees it in the list", async () => {
    await managerPage.goto(`/projects/${slug}/tasks/new`);
    await managerPage.getByRole("button", { name: "Gelişmiş görev", exact: true }).click();
    await managerPage.getByRole("button", { name: "Geçiş yap", exact: true }).click();
    await managerPage.locator("#task-title").fill(formTitle);
    // The radio input is visually hidden, so the visible label is what a person clicks.
    await managerPage.getByRole("radiogroup", { name: "Öncelik" }).getByText("Yüksek", { exact: true }).click();
    // The live preview card follows what is typed.
    await expect(managerPage.getByRole("complementary", { name: "Önizleme" }).getByText(formTitle)).toBeVisible();
    await managerPage.getByRole("button", { name: /^Görevi oluştur$/ }).click();
    await expect(managerPage).toHaveURL(new RegExp(`/tr/projeler/${slug}/gorevler/(?!yeni-gorev$)[^/]+$`), { timeout: 15_000 });
    await expect(managerPage.getByRole("heading", { name: formTitle })).toBeVisible();

    const created = await api(managerPage, "GET", `/projects/${projectId}/tasks?q=${encodeURIComponent("3-D Secure")}`);
    formTask = (created.json as { content: TaskJson[] }).content[0];
    expect(formTask.status).toBe("BACKLOG");

    await managerPage.goto(`/projects/${slug}/tasks`);
    await expect(managerPage.getByRole("link", { name: formTitle })).toBeVisible();
  });

  test("status follows the allowed transitions, from the list menu and on the server", async () => {
    await managerPage.goto(`/projects/${slug}/tasks`);
    await managerPage.getByRole("button", { name: "Durumu değiştir, şu an: Bekleyen işler" }).click();
    // BACKLOG may only go to TODO; the other columns are not offered.
    await expect(managerPage.getByRole("menuitem", { name: "Sırada" })).toBeVisible();
    await expect(managerPage.getByRole("menuitem", { name: "Tamamlandı" })).toHaveCount(0);
    await managerPage.getByRole("menuitem", { name: "Sırada" }).click();
    await managerPage.getByRole("dialog").getByRole("button", { name: "Durumu güncelle", exact: true }).click();
    await expect(managerPage.getByText(/durumuna alındı/)).toBeVisible();

    const skipped = await api(managerPage, "PATCH", `/projects/${projectId}/tasks/${formTask.id}/status`, { status: "DONE" });
    expect(skipped.status).toBe(409);
    expect((skipped.json as { code?: string }).code).toBe("TASK_INVALID_TRANSITION");
  });

  test("a member cannot create, edit or archive a task, and the server says so", async () => {
    const create = await api(memberPage, "POST", `/projects/${projectId}/tasks`, { title: "Yetkisiz görev", priority: "LOW" });
    expect(create.status).toBe(403);
    const edit = await api(memberPage, "PATCH", `/projects/${projectId}/tasks/${formTask.id}`, { title: "Ele geçir", priority: "LOW" });
    expect(edit.status).toBe(403);
    const archive = await api(memberPage, "DELETE", `/projects/${projectId}/tasks/${formTask.id}`);
    expect(archive.status).toBe(403);

    // They can read it, and the page does not offer an edit button.
    await memberPage.goto(`/projects/${slug}/tasks/${formTask.id}`);
    await expect(memberPage.getByRole("heading", { name: formTitle })).toBeVisible();
    await expect(memberPage.getByRole("link", { name: "Düzenle" })).toHaveCount(0);
  });

  test("a task in the pool is claimed once: the second claim loses with a 409", async () => {
    const created = await api(managerPage, "POST", `/projects/${projectId}/tasks`, {
      title: poolTitle,
      priority: "MEDIUM",
      pool: { open: true, teamId: null },
    });
    expect(created.status).toBe(201);
    poolTask = created.json as TaskJson;
    expect(poolTask.pool.open).toBe(true);

    // The member sees it in the pool and in "Görevlerim > Havuz".
    await memberPage.goto(`/projects/${slug}/tasks/pool`);
    await expect(memberPage.getByRole("link", { name: poolTitle })).toBeVisible();

    const [first, second] = await Promise.all([
      api(memberPage, "POST", `/projects/${projectId}/tasks/${poolTask.id}/claim`),
      api(managerPage, "POST", `/projects/${projectId}/tasks/${poolTask.id}/claim`),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect((loser.json as { code?: string }).code).toBe("TASK_ALREADY_CLAIMED");

    const after = (await api(managerPage, "GET", `/projects/${projectId}/tasks/${poolTask.id}`)).json as TaskJson;
    expect(after.pool.open).toBe(false);
    expect(after.assignees).toHaveLength(1);
  });

  test("a member claims a pool task from the page and gets a confirmation", async () => {
    const extra = await api(managerPage, "POST", `/projects/${projectId}/tasks`, {
      title: claimedTitle,
      priority: "LOW",
      pool: { open: true, teamId: null },
    });
    expect(extra.status).toBe(201);

    await memberPage.goto(`/projects/${slug}/tasks/pool`);
    await expect(memberPage.getByRole("link", { name: claimedTitle })).toBeVisible();
    await memberPage.getByRole("button", { name: /^Üstlen$/ }).first().click();
    await expect(memberPage.getByText(/görevini üstlendiniz/)).toBeVisible();
    await expect(memberPage.getByRole("link", { name: claimedTitle })).toHaveCount(0);
  });

  test("a comment with a @mention reaches the mentioned member as a notification", async () => {
    await managerPage.goto(`/projects/${slug}/tasks/${formTask.id}`);
    const box = managerPage.getByRole("combobox", { name: "Yorum" });
    await box.click();
    await box.pressSequentially(`Bakar mısın @${memberNickname.slice(0, 6)}`);
    await managerPage.getByRole("option", { name: new RegExp(memberNickname) }).click();
    await box.pressSequentially(" bu iş sende.");
    await managerPage.getByRole("button", { name: /^Yorum yap$/ }).click();
    await expect(managerPage.getByText("bu iş sende.")).toBeVisible();

    await expect
      .poll(async () => {
        const list = (await api(memberPage, "GET", "/notifications?type=TASK_MENTIONED")).json as { content: { resourceId: string }[] };
        return list.content.some((item) => item.resourceId === formTask.id);
      })
      .toBe(true);

    // Typing a nickname by hand never mentions anybody, so a person outside the project gets nothing.
    const stranger = await api(managerPage, "POST", `/projects/${projectId}/tasks/${formTask.id}/comments`, {
      body: "@[00000000-0000-4000-8000-000000000000] merhaba",
    });
    expect(stranger.status).toBe(201);
    expect((stranger.json as { mentions: unknown[] }).mentions).toHaveLength(0);
  });

  test("a member can comment, and can only delete their own comment", async () => {
    const mine = await api(memberPage, "POST", `/projects/${projectId}/tasks/${formTask.id}/comments`, { body: "Üzerinde çalışıyorum" });
    expect(mine.status).toBe(201);
    const theirs = (
      (await api(managerPage, "GET", `/projects/${projectId}/tasks/${formTask.id}/comments`)).json as { content: { id: string; body: string | null }[] }
    ).content.find((comment) => comment.body?.includes("bu iş sende"))!;
    const denied = await api(memberPage, "DELETE", `/projects/${projectId}/tasks/${formTask.id}/comments/${theirs.id}`);
    expect(denied.status).toBe(403);
  });

  test("Görevlerim counts follow the assignments", async () => {
    const assigned = await api(managerPage, "PUT", `/projects/${projectId}/tasks/${formTask.id}/assignees`, { assigneeIds: [memberId] });
    expect(assigned.status).toBe(200);

    // Scope the worklist to this run's project; reused accounts have many older tasks on other pages.
    await memberPage.goto(`/tasks?project=${projectId}`);
    // Both the task assigned above and the one claimed from the pool are theirs now.
    await expect(memberPage.locator(`[data-task-card="${formTask.id}"]`).getByText(formTitle, { exact: true })).toBeVisible();
    await expect(memberPage.locator("[data-task-card]").getByText(claimedTitle, { exact: true })).toBeVisible();

    const mine = (await api(memberPage, "GET", "/tasks/mine?scope=OPEN")).json as { content: TaskJson[]; totalElements: number; counts: { open: number } };
    expect(mine.counts.open).toBe(mine.totalElements);
    expect(mine.content.every((task) => task.assignees.some((person) => person.userId === memberId))).toBe(true);

    // The sidebar badge says the same thing to a screen reader.
    await expect(memberPage.getByRole("link", { name: /açık görev/ })).toBeVisible();

    // The status filter lives in the URL, so a filtered view can be shared and reloaded.
    await memberPage.goto(`/tasks?project=${projectId}&status=TODO`);
    await expect(memberPage.locator(`[data-task-card="${formTask.id}"]`).getByText(formTitle, { exact: true })).toBeVisible();
    await expect(memberPage.locator("[data-task-card]").getByText(claimedTitle, { exact: true })).toHaveCount(0);
  });

  test("a stranger cannot see the project's tasks", async ({ browser }) => {
    const outsider = await (await browser.newContext()).newPage();
    await outsider.goto("/login");
    const unauthenticated = await api(outsider, "GET", `/projects/${projectId}/tasks`);
    expect(unauthenticated.status).toBe(401);
    await outsider.close();
  });
});
