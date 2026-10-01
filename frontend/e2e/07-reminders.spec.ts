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

/** The shared Tooltip renders its popup with this data-slot; it is not exposed with the tooltip role. */
function tooltip(page: Page) {
  return page.locator("[data-slot='tooltip-content']");
}

/** A calendar cell whose whole text is a day number, i.e. a day without reminder icons. */
const DAY_NUMBER = /^\s*\d{1,2}\s*$/;

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Project reminders, end to end, with a Project Manager and a normal member:
 *   - the member can only create personal reminders (no scope choice, and the server refuses PROJECT);
 *   - the manager chooses between "for me" and "for everyone in the project";
 *   - an icon shows on the day with the title on hover, on the calendar page and on the home calendar;
 *   - personal reminders stay private, project ones are shared.
 */
test.describe.serial("Project reminders", () => {
  let managerPage: Page;
  let memberPage: Page;
  let slug: string;
  let projectId: string;
  const personalTitle = "Backend API'yi bitir";
  const managerNote = "Kendime not";
  const projectTitle = "Sprint Toplantısı";
  const today = localToday();

  test.beforeAll(async ({ browser }) => {
    managerPage = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    memberPage = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
  });

  test.afterAll(async () => {
    await managerPage.close();
    await memberPage.close();
  });

  async function createReminder(page: Page, title: string, type: string, scopeLabel?: string) {
    await page.goto("/calendar");
    await page.getByRole("link", { name: "Anımsatıcı oluştur" }).click();
    await expect(page).toHaveURL(/\/calendar\/new\?date=/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (scopeLabel) await page.getByText(scopeLabel, { exact: true }).click();
    await page.getByLabel("Anımsatıcı adı").fill(title);
    await page.getByRole("combobox", { name: "Anımsatıcı türü" }).click();
    await page.getByRole("option", { name: type }).click();
    await page.getByRole("button", { name: /^Oluştur$/ }).click();
    await expect(page.getByText("Anımsatıcı oluşturuldu.")).toBeVisible();
    await expect(page).toHaveURL(/\/calendar$/);
  }

  test("a manager and a member share a project", async () => {
    slug = await createProject(managerPage, `E2E Reminder Project ${Date.now()}`);
    projectId = ((await api(managerPage, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;

    await memberPage.goto("/projects");
    const me = (await api(memberPage, "GET", "/auth/me")).json as { id: string };
    // An invitation names the team the invitee joins, so the project needs one first.
    const team = await api(managerPage, "POST", `/projects/${projectId}/teams`, { name: "E2E Team" });
    expect(team.status).toBe(201);
    const invite = await api(managerPage, "POST", `/projects/${projectId}/invitations`, {
      userId: me.id,
      roles: ["FRONTEND_DEVELOPER"],
      teamId: (team.json as { id: string }).id,
    });
    expect(invite.status).toBe(201);
    const { invitationId, token } = invite.json as { invitationId: string; token: string };
    const accepted = await api(memberPage, "POST", `/projects/${projectId}/invitations/${invitationId}/accept`, { token });
    expect(accepted.status).toBe(200);

    // Opening the project makes it the member's selected project, which is what the calendar follows.
    await memberPage.goto(`/projects/${slug}`);
  });

  test("a member creates a personal reminder: no scope choice, icon on the day, title on hover", async () => {
    await memberPage.goto("/calendar");
    await memberPage.getByRole("link", { name: "Anımsatıcı oluştur" }).click();
    await expect(memberPage.getByRole("radiogroup")).toHaveCount(0);
    await memberPage.getByLabel("Anımsatıcı adı").fill(personalTitle);
    await memberPage.getByRole("combobox", { name: "Anımsatıcı türü" }).click();
    await memberPage.getByRole("option", { name: "Toplantı" }).click();
    await memberPage.getByRole("button", { name: /^Oluştur$/ }).click();
    await expect(memberPage.getByText("Anımsatıcı oluşturuldu.")).toBeVisible();
    await expect(memberPage).toHaveURL(/\/calendar$/);

    const marker = memberPage.getByRole("img", { name: `Toplantı: ${personalTitle}` });
    await expect(marker).toBeVisible();
    await marker.hover();
    await expect(tooltip(memberPage)).toHaveText(personalTitle);

    // One reminder: just its own icon, standing where the day number would be.
    const todayCell = memberPage.locator("button[aria-current='date']");
    await expect(todayCell.getByRole("img")).toHaveCount(1);
    await expect(todayCell).not.toHaveText(DAY_NUMBER);
  });

  test("the server refuses a member who asks for a project-wide reminder", async () => {
    const denied = await api(memberPage, "POST", `/projects/${projectId}/reminders`, {
      title: "Herkese duyuru",
      type: "MEETING",
      scope: "PROJECT",
      date: today,
    });
    expect(denied.status).toBe(403);
  });

  test("the manager sees the scope choice and creates a personal and a project-wide reminder", async () => {
    await managerPage.goto("/calendar");
    await managerPage.getByRole("link", { name: "Anımsatıcı oluştur" }).click();
    await expect(managerPage.getByRole("radiogroup")).toBeVisible();
    await expect(managerPage.getByText("Kendim için", { exact: true })).toBeVisible();
    await expect(managerPage.getByText("Projedeki herkes için", { exact: true })).toBeVisible();

    await createReminder(managerPage, managerNote, "Sunum");
    await createReminder(managerPage, projectTitle, "Toplantı", "Projedeki herkes için");

    await expect(managerPage.getByRole("img", { name: `Toplantı: ${projectTitle}` })).toBeVisible();
    await expect(managerPage.getByRole("img", { name: `Sunum: ${managerNote}` })).toBeVisible();
  });

  test("personal reminders stay private while the project one is shared", async () => {
    await memberPage.goto("/calendar");
    await expect(memberPage.getByRole("img", { name: `Toplantı: ${projectTitle}` })).toBeVisible();
    await expect(memberPage.getByRole("img", { name: `Sunum: ${managerNote}` })).toHaveCount(0);

    // Two reminders on the same day show as two icons in the one cell.
    const todayCell = memberPage.locator("button[aria-current='date']");
    await expect(todayCell.getByRole("img")).toHaveCount(2);
    // The number gives way to the icons on a day with reminders, and stays on every other day.
    await expect(todayCell).not.toHaveText(DAY_NUMBER);
    const plainDays = memberPage.locator("#main-content button[aria-pressed]").filter({ hasNot: memberPage.locator("[role='img']") });
    expect(await plainDays.count()).toBeGreaterThan(20);
    await expect(plainDays.first()).toHaveText(DAY_NUMBER);
    await memberPage.getByRole("img", { name: `Toplantı: ${projectTitle}` }).hover();
    await expect(tooltip(memberPage)).toHaveText(projectTitle);

    await managerPage.goto("/calendar");
    await expect(managerPage.getByRole("img", { name: `Toplantı: ${personalTitle}` })).toHaveCount(0);

    // Not just hidden in the UI: the API itself leaves the other person's personal reminder out.
    const range = `from=${today}&to=${today}`;
    const memberView = (await api(memberPage, "GET", `/projects/${projectId}/reminders?${range}`)).json as { title: string }[];
    const managerView = (await api(managerPage, "GET", `/projects/${projectId}/reminders?${range}`)).json as { title: string }[];
    expect(memberView.map((r) => r.title).sort()).toEqual([personalTitle, projectTitle].sort());
    expect(managerView.map((r) => r.title).sort()).toEqual([managerNote, projectTitle].sort());
  });

  test("the home calendar shows the same reminders", async () => {
    await memberPage.goto("/dashboard");
    const homeCalendar = memberPage.locator("#calendar");
    await expect(homeCalendar.getByRole("img", { name: `Toplantı: ${personalTitle}` })).toBeVisible();
    // The compact grid shows one icon per day and "+N" for the rest; the selected day lists every title.
    await expect(homeCalendar.getByRole("img", { name: projectTitle })).toBeVisible();
    await expect(homeCalendar.getByText(projectTitle, { exact: true })).toBeVisible();
    await homeCalendar.getByRole("img", { name: `Toplantı: ${personalTitle}` }).hover();
    await expect(tooltip(memberPage)).toHaveText(personalTitle);
  });

  test("on a touch screen there is no hover, so tapping the day lists the reminder titles", async ({ browser }) => {
    const touch = await browser.newContext({
      storageState: MEMBER_STORAGE,
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const phone = await touch.newPage();
    await phone.goto(`/projects/${slug}`);
    await expect.poll(() => phone.evaluate((selectedSlug) =>
      Object.keys(sessionStorage).some((key) => key.startsWith("pda:last-project:") && sessionStorage.getItem(key) === selectedSlug),
    slug)).toBe(true);
    await phone.goto("/calendar");

    // Two icons fit the narrow cell; the day button's own accessible name already carries every title.
    const day = phone.locator("button[aria-current='date']");
    await expect(day).toHaveAccessibleName(new RegExp(`Toplantı: ${projectTitle}`));
    await day.tap();
    await expect(phone.getByText(projectTitle, { exact: true })).toBeVisible();
    await expect(phone.getByText(personalTitle, { exact: true })).toBeVisible();
    await touch.close();
  });

  test("a member can change and delete only their own reminder", async () => {
    await memberPage.goto("/calendar");
    // The shared project reminder has no edit/delete for a member; their own one does.
    await expect(memberPage.getByRole("link", { name: `${projectTitle} anımsatıcısını düzenle` })).toHaveCount(0);
    await expect(memberPage.getByRole("button", { name: `${projectTitle} anımsatıcısını sil` })).toHaveCount(0);
    const projectReminder = (
      (await api(memberPage, "GET", `/projects/${projectId}/reminders?from=${today}&to=${today}`)).json as { id: string; title: string }[]
    ).find((r) => r.title === projectTitle)!;
    expect((await api(memberPage, "PATCH", `/projects/${projectId}/reminders/${projectReminder.id}`, {
      title: "Ele geçir", type: "MEETING", date: today,
    })).status).toBe(403);
    expect((await api(memberPage, "DELETE", `/projects/${projectId}/reminders/${projectReminder.id}`)).status).toBe(403);

    await memberPage.getByRole("link", { name: `${personalTitle} anımsatıcısını düzenle` }).click();
    await expect(memberPage.getByLabel("Anımsatıcı adı")).toHaveValue(personalTitle);
    await memberPage.getByLabel("Anımsatıcı adı").fill(`${personalTitle} (güncel)`);
    await memberPage.getByRole("button", { name: /^Kaydet$/ }).click();
    await expect(memberPage.getByText("Anımsatıcı güncellendi.")).toBeVisible();
    await expect(memberPage.getByRole("img", { name: `Toplantı: ${personalTitle} (güncel)` })).toBeVisible();

    await memberPage.getByRole("button", { name: `${personalTitle} (güncel) anımsatıcısını sil` }).click();
    await memberPage.getByRole("dialog").getByRole("button", { name: /^Sil$/ }).click();
    await expect(memberPage.getByText("Anımsatıcı silindi.")).toBeVisible();
    await expect(memberPage.getByRole("img", { name: `Toplantı: ${personalTitle} (güncel)` })).toHaveCount(0);
    await expect(memberPage.getByRole("img", { name: `Toplantı: ${projectTitle}` })).toBeVisible();
  });

  test("the manager edits and deletes the project-wide reminder", async () => {
    await managerPage.goto("/calendar");
    await managerPage.getByRole("link", { name: `${projectTitle} anımsatıcısını düzenle` }).click();
    await managerPage.getByLabel("Anımsatıcı adı").fill(`${projectTitle} v2`);
    await managerPage.getByRole("button", { name: /^Kaydet$/ }).click();
    await expect(managerPage.getByText("Anımsatıcı güncellendi.")).toBeVisible();
    await expect(managerPage.getByRole("img", { name: `Toplantı: ${projectTitle} v2` })).toBeVisible();

    await managerPage.getByRole("button", { name: `${projectTitle} v2 anımsatıcısını sil` }).click();
    await managerPage.getByRole("dialog").getByRole("button", { name: /^Sil$/ }).click();
    await expect(managerPage.getByText("Anımsatıcı silindi.")).toBeVisible();

    await memberPage.goto("/calendar");
    await expect(memberPage.getByRole("img", { name: /Sprint Toplantısı/ })).toHaveCount(0);
  });
});
