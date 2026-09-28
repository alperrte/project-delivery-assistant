import { test, expect } from "@playwright/test";

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

test("project navigation uses a mobile dropdown and a desktop section menu without page overflow", async ({ page }) => {
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
  const mobileMenu = page.getByRole("combobox", { name: "Proje menüsü" });
  await mobileMenu.click();
  await page.getByRole("option", { name: "Kriterler" }).click();
  await expect(page.getByRole("heading", { name: "Başarı kriterleri" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await page.getByRole("button", { name: "Yeni kriter" }).evaluate((button) => getComputedStyle(button).cursor)).toBe("pointer");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("tab", { name: "Üyeler" }).click();
  await expect(page.getByRole("tab", { name: "Üyeler" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("row", { name: /testuser/ })).toBeVisible();
  await page.getByRole("tab", { name: "Genel Bakış" }).click();
  await page.getByRole("button", { name: "Kriterleri tanımla" }).click();
  await expect(page.getByRole("tab", { name: "Kriterler" })).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
});
