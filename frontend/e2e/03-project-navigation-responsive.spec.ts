import { test, expect } from "@playwright/test";
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

test("project sections use the shared sidebar on desktop and its mobile drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
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

  await page.goto("/projects/responsive-project");
  await expect(page.getByRole("heading", { name: "Responsive project" })).toBeVisible();
  await page.getByRole("button", { name: "Gezinme menüsü" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Kriterler" }).click();
  await expect(page.getByRole("heading", { name: "Başarı kriterleri" })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await page.getByRole("button", { name: "Yeni kriter" }).evaluate((button) => getComputedStyle(button).cursor)).toBe("pointer");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Ekipler" }).click();
  await page.getByRole("link", { name: /Backend ekibini aç/ }).first().click();
  await expect(page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Ekipler" })).toHaveAttribute("aria-current", "page");
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
  // The overview's criteria preview and the criteria list can both be mounted for a moment while the section switches.
  await expect(page.getByRole("heading", { name: "Başarı kriterleri" })).toBeVisible();
  await expect(page.getByText("Giriş sistemi")).toBeVisible();
  await expect(page.getByText("Ekip modülü")).toBeVisible();
  await page.getByRole("button", { name: "Tamamlanan 1" }).click();
  await expect(page.getByText("Giriş sistemi")).toBeVisible();
  await expect(page.getByText("Ekip modülü")).toBeHidden();
  await page.getByRole("button", { name: "Tümü 2" }).click();
  await page.getByRole("textbox", { name: "Kriter ara..." }).fill("Ekip");
  await expect(page.getByText("Ekip modülü")).toBeVisible();
  await expect(page.getByText("Giriş sistemi")).toBeHidden();
});
