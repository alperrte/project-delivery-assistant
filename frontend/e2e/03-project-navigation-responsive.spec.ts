import { test, expect, type Page } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE });

const project = {
  id: "responsive-project",
  name: "Responsive project",
  slug: "responsive-project",
  description: "Project navigation test",
  projectGoal: null,
  status: "ACTIVE",
  priority: "MEDIUM",
  startDate: null,
  targetEndDate: null,
  techStack: null,
  organizationId: null,
  createdBy: "responsive-user",
  createdAt: "2026-09-28T00:00:00Z",
  updatedAt: "2026-09-28T00:00:00Z",
  archivedAt: null,
  visibility: "PRIVATE",
};

const team = {
  id: "backend-team", projectId: "responsive-project", name: "Backend", description: null, parentTeamId: null,
  memberCount: 1, createdBy: "responsive-user", createdAt: "2026-09-28T00:00:00Z", updatedAt: "2026-09-28T00:00:00Z",
  updatedBy: { userId: "responsive-user", nickname: "testuser" },
  memberPreview: [{ userId: "responsive-user", nickname: "testuser" }],
  lastJoined: { userId: "responsive-user", nickname: "testuser", joinedAt: "2026-09-28T00:00:00Z" },
};

/** API answers for one project of which the signed-in user is the manager. */
async function mockResponsiveProject(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown;
    if (path === "/api/v1/auth/me") data = { id: "responsive-user", nickname: "testuser", email: "test@example.com", globalRole: "USER", mustChangePassword: false };
    if (path === "/api/v1/projects/by-slug/responsive-project") data = project;
    if (path === "/api/v1/projects/responsive-project/home") data = {
      ...project, organization: null, managers: [], teamMemberCount: 1,
      criteriaProgress: { completed: 0, total: 0 }, repository: { connected: false },
    };
    if (path === "/api/v1/projects/responsive-project/members/responsive-user") data = { userId: "responsive-user", nickname: "testuser", roles: ["PROJECT_MANAGER"], joinedAt: "2026-09-28T00:00:00Z" };
    if (path === "/api/v1/projects/responsive-project/members") data = { content: [{ userId: "responsive-user", nickname: "testuser", roles: ["PROJECT_MANAGER"], joinedAt: "2026-09-28T00:00:00Z" }], page: 0, totalPages: 1, totalElements: 1 };
    if (path === "/api/v1/projects/responsive-project/teams") data = { content: [team], page: 0, totalPages: 1, totalElements: 1 };
    if (path === "/api/v1/projects/responsive-project/teams/backend-team") data = team;
    if (path === "/api/v1/projects/responsive-project/teams/backend-team/members") data = { content: [{ userId: "responsive-user", nickname: "testuser", email: "test@example.com", roles: ["PROJECT_MANAGER"], addedBy: "responsive-user", addedAt: "2026-09-28T00:00:00Z", otherTeams: [] }], page: 0, totalPages: 1, totalElements: 1 };
    if (path === "/api/v1/projects/responsive-project/criteria") data = [];

    await route.fulfill({
      status: data === undefined ? 404 : 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" },
      body: JSON.stringify(data ?? {}),
    });
  });
}

test("project sections use the shared sidebar on desktop and its mobile drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockResponsiveProject(page);

  await page.goto("/projects/responsive-project");
  await expect(page.getByRole("heading", { name: "Responsive project" })).toBeVisible();
  await page.getByRole("button", { name: "Gezinme menüsü" }).click();
  // The drawer carries the same navigation: one "Ayarlar" link of its own, none among the project sections.
  await expect(page.getByRole("dialog").getByRole("link", { name: "Ayarlar", exact: true })).toHaveCount(1);
  await page.getByRole("dialog").getByRole("link", { name: "Kriterler" }).click();
  await expect(page.getByRole("heading", { name: "Başarı kriterleri" })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await page.getByRole("button", { name: "Yeni kriter" }).evaluate((button) => getComputedStyle(button).cursor)).toBe("pointer");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("button", { name: "Ekipler", exact: true }).click();
  await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Tüm Ekipler", exact: true }).click();
  await page.getByRole("link", { name: /Backend ekibini aç/ }).first().click();
  await expect(page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Tüm Ekipler", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("row", { name: /testuser/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("listitem").filter({ hasText: "testuser" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Genel Bakış" }).click();
  await page.getByRole("button", { name: "Kriterleri tanımla" }).click();
  await expect(page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Kriterler" })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
});

test("the sidebar has no project settings item, and its own Ayarlar link stays in view", async ({ page }) => {
  // Short on purpose: the project navigation is taller than this, so the sidebar's middle part has to scroll.
  await page.setViewportSize({ width: 1440, height: 640 });
  await mockResponsiveProject(page);

  await page.goto("/projects/responsive-project");
  await expect(page.getByRole("heading", { name: "Responsive project" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Gezinme menüsü" });
  await expect(nav.getByRole("link", { name: "Kriterler" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Ayarlar" })).toHaveCount(0);

  // The page header carries no pencil either; the settings section itself is unchanged and opens by address.
  await expect(page.getByRole("link", { name: /ayarlarını düzenle/ })).toHaveCount(0);
  await page.goto("/projects/responsive-project?section=settings");
  await expect(page.getByRole("heading", { level: 1, name: "Proje ayarları" })).toBeVisible();

  // The sidebar's own settings link sits below the scrolling part and never leaves the screen.
  const settings = page.getByRole("link", { name: "Ayarlar", exact: true });
  await expect(settings).toBeInViewport();
  await page.getByRole("button", { name: "Kenar çubuğunu daralt" }).click();
  await expect(page.getByRole("link", { name: "Ayarlar", exact: true })).toBeInViewport();
  await expect(page.getByRole("link", { name: "Ayarlar", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Kenar çubuğunu genişlet" }).click();

  // The old "workspace" card is gone.
  await expect(page.getByText("Çalışma alanın")).toHaveCount(0);
});

test("Projeler stays highlighted on the list and the create page, not inside a project", async ({ page }) => {
  await page.goto("/projects");
  const nav = page.getByRole("navigation", { name: "Gezinme menüsü" });
  await expect(nav.getByRole("link", { name: "Projeler", exact: true })).toHaveAttribute("aria-current", "page");
  await page.goto("/projects/new");
  await expect(nav.getByRole("link", { name: "Projeler", exact: true })).toHaveAttribute("aria-current", "page");
});

test("language changes keep the selected project, section and sidebar target", async ({ page }) => {
  await mockResponsiveProject(page);
  await page.goto("/tr/projeler/responsive-project?section=teams");
  await expect(page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Tüm Ekipler", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Dil" }).click();
  await page.getByRole("menuitem", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/projects\/responsive-project\?section=teams$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Deutsch" }).click();
  await expect(page).toHaveURL(/\/de\/projekte\/responsive-project\?section=teams$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
});

test("criteria filters and search show only matching real criteria", async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown;
    if (path === "/api/v1/auth/me") data = { id: "responsive-user", nickname: "testuser", email: "test@example.com", globalRole: "USER", mustChangePassword: false };
    if (path === "/api/v1/projects/by-slug/responsive-project") data = project;
    if (path === "/api/v1/projects/responsive-project/home") data = {
      ...project, organization: null, managers: [], teamMemberCount: 1,
      criteriaProgress: { completed: 1, total: 2 }, repository: { connected: false },
    };
    if (path === "/api/v1/projects/responsive-project/members/responsive-user") data = { userId: "responsive-user", nickname: "testuser", roles: ["PROJECT_MANAGER"], joinedAt: "2026-09-28T00:00:00Z" };
    if (path === "/api/v1/projects/responsive-project/criteria") data = [
      { id: "done", title: "Giriş sistemi", description: null, completed: true },
      { id: "open", title: "Ekip modülü", description: null, completed: false },
    ];
    await route.fulfill({ status: data === undefined ? 404 : 200, contentType: "application/json", body: JSON.stringify(data ?? {}) });
  });

  await page.goto("/projects/responsive-project");
  await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Kriterler" }).click();
  await expect(page.getByRole("checkbox", { name: "Giriş sistemi" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Ekip modülü" })).toBeVisible();
  await page.getByRole("button", { name: "Tamamlanan 1" }).click();
  await expect(page.getByRole("checkbox", { name: "Giriş sistemi" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Ekip modülü" })).toBeHidden();
  await page.getByRole("button", { name: "Tümü 2" }).click();
  await page.getByRole("textbox", { name: "Kriter ara..." }).fill("Ekip");
  await expect(page.getByRole("checkbox", { name: "Ekip modülü" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Giriş sistemi" })).toBeHidden();
});
