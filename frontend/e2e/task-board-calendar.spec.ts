import { test, expect, type Page } from "@playwright/test";
import { api, createProject } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

type TaskJson = { id: string; taskKey: string; title: string; status: string };

const pad = (value: number) => String(value).padStart(2, "0");

/** The first and last day of the current month; the calendar opens on this month, so both are visible at once. */
function monthSpan() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const last = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    deadlineDay: `${year}-${pad(month)}-${pad(last)}`,
    // Midday UTC lands on the same calendar day in every time zone a test machine is likely to use.
    deadlineAt: `${year}-${pad(month)}-${pad(last)}T12:00:00Z`,
  };
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * Task detail for people who cannot manage, the wrapped board, the status names and the calendar link to the
 * tasks assigned to the signed-in person.
 */
test.describe.serial("Task board, status names and calendar", () => {
  let managerPage: Page;
  let memberPage: Page;
  let slug: string;
  let projectId: string;
  let memberId: string;
  let managerId: string;
  let poolTask: TaskJson;
  let ownTask: TaskJson;
  let otherTask: TaskJson;
  const span = monthSpan();
  const stamp = Date.now();
  const poolTitle = `Havuzdan alınan ${stamp}`;
  const ownTitle = `Takvimdeki görevim ${stamp}`;
  const otherTitle = `Başkasının görevi ${stamp}`;

  test.beforeAll(async ({ browser }) => {
    managerPage = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    memberPage = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
  });

  test.afterAll(async () => {
    await managerPage.close();
    await memberPage.close();
  });

  test("a manager and a member share a project with three tasks", async () => {
    slug = await createProject(managerPage, `Board calendar ${stamp}`);
    projectId = ((await api(managerPage, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    managerId = ((await api(managerPage, "GET", "/auth/me")).json as { id: string }).id;

    await memberPage.goto("/projects");
    memberId = ((await api(memberPage, "GET", "/auth/me")).json as { id: string }).id;
    const team = await api(managerPage, "POST", `/projects/${projectId}/teams`, { name: "E2E Team" });
    expect(team.status).toBe(201);
    const invite = await api(managerPage, "POST", `/projects/${projectId}/invitations`, {
      userId: memberId,
      roles: ["FRONTEND_DEVELOPER"],
      teamId: (team.json as { id: string }).id,
    });
    expect(invite.status).toBe(201);
    const { invitationId, token } = invite.json as { invitationId: string; token: string };
    expect((await api(memberPage, "POST", `/projects/${projectId}/invitations/${invitationId}/accept`, { token })).status).toBe(200);

    const pool = await api(managerPage, "POST", `/projects/${projectId}/tasks`, { title: poolTitle, priority: "MEDIUM", pool: { open: true, teamId: null } });
    expect(pool.status).toBe(201);
    poolTask = pool.json as TaskJson;

    const own = await api(managerPage, "POST", `/projects/${projectId}/tasks`, {
      title: ownTitle,
      priority: "HIGH",
      assigneeIds: [managerId],
      startDate: span.start,
      deadlineAt: span.deadlineAt,
    });
    expect(own.status).toBe(201);
    ownTask = own.json as TaskJson;

    const other = await api(managerPage, "POST", `/projects/${projectId}/tasks`, {
      title: otherTitle,
      priority: "LOW",
      assigneeIds: [memberId],
      startDate: span.start,
      deadlineAt: span.deadlineAt,
    });
    expect(other.status).toBe(201);
    otherTask = other.json as TaskJson;

    // Opening the project makes it the member's selected project.
    await memberPage.goto(`/projects/${slug}`);
  });

  test("a member who claimed a task cannot change assignees or priority, but still sees the priority", async () => {
    const claimed = await api(memberPage, "POST", `/projects/${projectId}/tasks/${poolTask.id}/claim`);
    expect(claimed.status).toBe(200);

    await memberPage.goto(`/projects/${slug}/tasks/${poolTask.id}`);
    await expect(memberPage.getByRole("heading", { name: poolTitle })).toBeVisible();
    // The manager-only controls are gone, not merely disabled.
    await expect(memberPage.getByRole("button", { name: "Atananları değiştir" })).toHaveCount(0);
    await expect(memberPage.getByRole("combobox", { name: "Öncelik" })).toHaveCount(0);
    await expect(memberPage.locator("#detail-priority")).toHaveText("Orta");

    // The server refuses the change as well.
    const patched = await api(memberPage, "PATCH", `/projects/${projectId}/tasks/${poolTask.id}`, { title: "Ele geçir", priority: "CRITICAL" });
    expect(patched.status).toBe(403);
  });

  test("a project manager still sees both controls", async () => {
    await managerPage.goto(`/projects/${slug}/tasks/${poolTask.id}`);
    await expect(managerPage.getByRole("heading", { name: poolTitle })).toBeVisible();
    await expect(managerPage.getByRole("button", { name: "Atananları değiştir" })).toBeVisible();
    await expect(managerPage.getByRole("combobox", { name: "Öncelik" })).toBeVisible();
  });

  test("the board wraps into a grid instead of scrolling sideways", async () => {
    await managerPage.goto(`/projects/${slug}/tasks/board?sprint=all`);
    const sections = managerPage.locator('[data-testid="board-grid"] > section');
    await expect(sections).toHaveCount(6);

    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]] as const) {
      await managerPage.setViewportSize({ width, height });
      await expect(sections.first()).toBeVisible();
      await noHorizontalOverflow(managerPage);
      const grid = await managerPage.locator('[data-testid="board-grid"]').evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(grid).toBeLessThanOrEqual(0);

      const first = (await sections.nth(0).boundingBox())!;
      const second = (await sections.nth(1).boundingBox())!;
      const fourth = (await sections.nth(3).boundingBox())!;
      if (width >= 1280) {
        // Three columns per row: the second row starts below the first.
        expect(Math.abs(second.y - first.y)).toBeLessThan(2);
        expect(fourth.y).toBeGreaterThan(first.y + first.height - 2);
        expect(Math.abs(fourth.x - first.x)).toBeLessThan(2);
      } else if (width >= 640) {
        expect(Math.abs(second.y - first.y)).toBeLessThan(2);
      } else {
        // One column on a phone.
        expect(Math.abs(second.x - first.x)).toBeLessThan(2);
        expect(second.y).toBeGreaterThan(first.y + first.height - 2);
      }
    }
    await managerPage.setViewportSize({ width: 1280, height: 720 });
  });

  test("a card moves from the menu after confirmation", async () => {
    await managerPage.goto(`/projects/${slug}/tasks/board?sprint=all`);
    await managerPage.getByRole("button", { name: `${ownTask.taskKey} görevini taşı`, exact: true }).click();
    await managerPage.getByRole("menuitem", { name: "Sırada", exact: true }).click();
    await managerPage.getByRole("dialog", { name: /görevinin durumu değiştirilsin mi/ }).getByRole("button", { name: "Durumu güncelle", exact: true }).click();
    await expect(managerPage.getByRole("region", { name: /^Sırada/ }).getByRole("link", { name: ownTitle })).toBeVisible();
    expect((await api(managerPage, "GET", `/projects/${projectId}/tasks/${ownTask.id}`)).json).toMatchObject({ status: "TODO" });
  });

  test("Turkish says Bekleyen işler / Sırada / Yapılıyor, English keeps Backlog / To do / In progress", async () => {
    await managerPage.goto(`/projects/${slug}/tasks/board?sprint=all`);
    const headings = managerPage.locator('[data-testid="board-grid"] h2');
    await expect(headings.filter({ hasText: "Bekleyen işler" })).toHaveCount(1);
    await expect(headings.filter({ hasText: "Sırada" })).toHaveCount(1);
    await expect(headings.filter({ hasText: "Yapılıyor" })).toHaveCount(1);
    await expect(managerPage.getByText("Backlog")).toHaveCount(0);
    await expect(managerPage.getByText("Yapılacak", { exact: true })).toHaveCount(0);
    await expect(managerPage.getByText("Devam ediyor", { exact: true })).toHaveCount(0);

    await managerPage.goto(`/en/projects/${slug}/tasks/board?sprint=all`);
    const english = managerPage.locator('[data-testid="board-grid"] h2');
    await expect(english.filter({ hasText: "Backlog" })).toHaveCount(1);
    await expect(english.filter({ hasText: "To do" })).toHaveCount(1);
    await expect(english.filter({ hasText: "In progress" })).toHaveCount(1);

    // The visit remembers English; go back to Turkish for the tests that follow.
    await managerPage.goto("/tr/genel-bakis");
    await expect(managerPage.locator("html")).toHaveAttribute("lang", "tr");
  });

  test("the calendar marks my task on its start and deadline days and opens it", async () => {
    await managerPage.goto("/calendar");
    await expect(managerPage.getByRole("heading", { level: 1, name: "Takvim" })).toBeVisible();

    // Two days carry a marker: the start day and the deadline day. The task assigned to someone else adds none.
    const markers = managerPage.locator("[data-calendar-tasks]");
    await expect(markers).toHaveCount(2);

    const startDay = managerPage.getByRole("button", { name: new RegExp(ownTask.taskKey) }).first();
    await startDay.click();
    const startRow = managerPage.locator(`[data-calendar-task="${ownTask.id}"]`);
    await expect(startRow).toHaveAttribute("data-kind", "start");
    await expect(startRow).toContainText("Görev başlangıcı");
    await expect(managerPage.getByText(otherTitle)).toHaveCount(0);

    await managerPage.getByRole("button", { name: new RegExp(ownTask.taskKey) }).last().click();
    const deadlineRow = managerPage.locator(`[data-calendar-task="${ownTask.id}"]`);
    await expect(deadlineRow).toHaveAttribute("data-kind", "deadline");
    await expect(deadlineRow).toContainText("Görev son tarihi");

    await deadlineRow.getByRole("link", { name: new RegExp(ownTitle) }).click();
    await expect(managerPage).toHaveURL(new RegExp(`/tr/projeler/${slug}/gorevler/${ownTask.id}$`));
    await expect(managerPage.getByRole("heading", { name: ownTitle })).toBeVisible();
  });

  test("the member sees only their own task on the calendar", async () => {
    await memberPage.goto("/calendar");
    await expect(memberPage.locator("[data-calendar-tasks]")).toHaveCount(2);
    await memberPage.getByRole("button", { name: new RegExp(otherTask.taskKey) }).first().click();
    await expect(memberPage.locator(`[data-calendar-task="${otherTask.id}"]`)).toBeVisible();
    await expect(memberPage.locator(`[data-calendar-task="${ownTask.id}"]`)).toHaveCount(0);
  });

  test("the home calendar shows the task too, with no overflow on a phone or in the dark theme", async () => {
    await managerPage.goto("/dashboard");
    await expect(managerPage.locator("#calendar [data-calendar-tasks]").first()).toBeVisible();

    await managerPage.setViewportSize({ width: 390, height: 844 });
    await managerPage.emulateMedia({ colorScheme: "dark" });
    for (const path of ["/dashboard", "/calendar", `/projects/${slug}/tasks/board?sprint=all`]) {
      await managerPage.goto(path);
      await expect(managerPage.locator("#main-content")).toBeVisible();
      await noHorizontalOverflow(managerPage);
    }
    await managerPage.emulateMedia({ colorScheme: "light" });
    await managerPage.setViewportSize({ width: 1280, height: 720 });
  });
});
