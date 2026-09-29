/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium, expect } = require("@playwright/test");
const { mkdirSync } = require("node:fs");
const path = require("node:path");

const origin = process.argv[2] || "http://localhost:3000";
const project = {
  id: "sidebar-project", slug: "sidebar-project", name: "Kampüs Etkinlik Takip",
  description: "Öğrenci ekip alanı", status: "ACTIVE", priority: "MEDIUM",
  startDate: null, targetEndDate: null, projectGoal: null, techStack: null,
  organizationId: null, createdBy: "sidebar-user", createdAt: "2026-09-29T09:00:00Z",
  updatedAt: "2026-09-29T09:00:00Z", archivedAt: null, visibility: "PRIVATE",
};
const secondProject = { ...project, id: "second-project", slug: "second-project", name: "İkinci Proje" };
const pageData = content => ({ content, page: 0, totalPages: 1, totalElements: content.length, size: 20 });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "tr-TR", reducedMotion: "reduce" });
  await context.addCookies([{ name: "NEXT_LOCALE", value: "tr", url: origin }]);
  const page = await context.newPage();
  let manager = true;
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/v1/**", async route => {
    const key = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, "");
    let data;
    if (key === "/auth/me") data = { id: "sidebar-user", nickname: "Hamza", email: "preview@example.com", globalRole: "USER", mustChangePassword: false };
    else if (key === "/projects/by-slug/sidebar-project") data = project;
    else if (key === "/projects/by-slug/second-project") data = secondProject;
    else if (key === "/projects/sidebar-project/home") data = { ...project, managers: [], organization: null, teamMemberCount: 1, criteriaProgress: { completed: 0, total: 0 }, repository: { connected: false } };
    else if (key === "/projects/second-project/home") data = { ...secondProject, managers: [], organization: null, teamMemberCount: 1, criteriaProgress: { completed: 0, total: 0 }, repository: { connected: false } };
    else if (key === "/projects/sidebar-project/members/sidebar-user") data = { userId: "sidebar-user", nickname: "Hamza", roles: [manager ? "PROJECT_MANAGER" : "TESTER"], joinedAt: project.createdAt };
    else if (key === "/projects/second-project/members/sidebar-user") data = { userId: "sidebar-user", nickname: "Hamza", roles: ["PROJECT_MANAGER"], joinedAt: project.createdAt };
    else if (key === "/projects/sidebar-project/criteria") data = [];
    else if (key === "/projects/sidebar-project/members") data = pageData([{ userId: "sidebar-user", nickname: "Hamza", roles: [manager ? "PROJECT_MANAGER" : "TESTER"], joinedAt: project.createdAt }]);
    else if (key === "/projects/sidebar-project/invitations" || key === "/projects/sidebar-project/squads" || key === "/projects") data = pageData(key === "/projects" ? [project, secondProject] : []);
    else return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  });
  const output = path.resolve(__dirname, "../../tmp/project-sidebar-review");
  mkdirSync(output, { recursive: true });
  try {
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${origin}/dashboard`);
      const nav = page.getByRole("navigation", { name: "Gezinme menüsü" });
      await expect(nav.getByRole("link", { name: "Kriterler" })).toHaveAttribute("href", "/projects/sidebar-project?section=criteria");
      await expect(nav.getByText("Seçili proje")).toBeVisible();
      await expect(nav.getByRole("link", { name: project.name })).toHaveAttribute("href", "/projects/sidebar-project");
      await expect(nav.getByRole("link", { name: "Değiştir" })).toHaveAttribute("href", "/projects");
      await page.goto(`${origin}/projects/sidebar-project`);
      await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
      await expect(page.locator("main [data-slot='tabs-list']")).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Projeler", exact: true })).not.toHaveAttribute("aria-current", "page");
      await expect(nav.getByRole("link", { name: "Genel Bakış" })).toHaveAttribute("aria-current", "page");
      await expect(nav.getByRole("link", { name: "Ayarlar" })).toBeVisible();
      await page.screenshot({ path: path.join(output, `${theme}-desktop.png`), fullPage: true });
      await nav.getByRole("link", { name: "Kriterler" }).click();
      await expect(page).toHaveURL(/\?section=criteria$/);
      await expect(page.getByRole("heading", { name: "Başarı kriterleri" })).toBeVisible();
      await page.reload();
      await expect(nav.getByRole("link", { name: "Kriterler" })).toHaveAttribute("aria-current", "page");
      await nav.getByRole("link", { name: "Genel Bakış" }).click();
      await expect(page).toHaveURL(/\/projects\/sidebar-project$/);
      await nav.getByRole("link", { name: "Ana Sayfa" }).click();
      await expect(nav.getByRole("link", { name: "Kriterler" })).toHaveAttribute("href", "/projects/sidebar-project?section=criteria");
      await nav.getByRole("link", { name: "Değiştir" }).click();
      await expect(nav.getByRole("link", { name: "Projeler", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(nav.getByRole("link", { name: "Değiştir" })).toHaveCount(0);
      await expect(nav.getByRole("link", { name: "Üyeler" })).toHaveAttribute("href", "/projects/sidebar-project?section=members");
      await page.screenshot({ path: path.join(output, `${theme}-project-list.png`), fullPage: true });
      await page.reload();
      await expect(nav.getByRole("link", { name: "Üyeler" })).toHaveAttribute("href", "/projects/sidebar-project?section=members");
      await nav.getByRole("link", { name: "Genel Bakış" }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Gezinme menüsü" }).click();
      const drawer = page.getByRole("dialog");
      await expect(drawer.getByRole("link", { name: "Üyeler" })).toBeVisible();
      await page.screenshot({ path: path.join(output, `${theme}-mobile-drawer.png`), fullPage: true });
      await drawer.getByRole("link", { name: "Üyeler" }).click();
      await expect(drawer).toBeHidden();
      await expect(page.getByRole("row", { name: /Hamza/ })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}/projects/second-project`);
    await expect(page.getByRole("heading", { name: secondProject.name })).toBeVisible();
    await page.goto(`${origin}/dashboard`);
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Kriterler" })).toHaveAttribute("href", "/projects/second-project?section=criteria");
    await expect(page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: secondProject.name })).toBeVisible();
    manager = false;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${origin}/projects/sidebar-project?section=settings`);
    const nav = page.getByRole("navigation", { name: "Gezinme menüsü" });
    await expect(nav.getByRole("link", { name: "Ayarlar" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Davetler" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Genel Bakış" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
    expect(errors).toEqual([]);
    console.log("PASS: one persistent sidebar; project links across dashboard/list and reload, last project selection, deep links, mobile drawer, light/dark, manager visibility and overflow.");
    console.log(`Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
