import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { api } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

/**
 * Teams page views: Grid (cards), Table and Chart are three presentations of the SAME query. The table shows the same
 * page slice as the grid, switching views never refetches, the choice is remembered per account, and phones get a
 * stacked list instead of a horizontally scrolling table.
 */
const TEAM_COUNT = 14; // 12 per page -> two pages
const PAGE_SIZE = 12;

type Fixture = { projectId: string; slug: string; managerId: string; memberId: string };

let fixture: Fixture;
let managerContext: BrowserContext;
let manager: Page;

const tab = (page: Page, name: string) => page.getByRole("tablist", { name: "Görünüm" }).getByRole("tab", { name, exact: true });
const teamsUrl = (query = "") => `/tr/projeler/${fixture.slug}?section=teams${query}`;

async function gridNames(page: Page) {
  const names = await page.locator("article h2").allInnerTexts();
  return names.map((name) => name.trim()).sort();
}

async function tableNames(page: Page) {
  const names = await page.getByTestId("teams-table").locator("tbody tr td:first-child a").allInnerTexts();
  return names.map((name) => name.trim()).sort();
}

async function openTeams(page: Page, query = "") {
  await page.goto(teamsUrl(query));
  await expect(page.getByRole("tablist", { name: "Görünüm" })).toBeVisible();
}

async function newContext(browser: Browser, storageState: string) {
  const context = await browser.newContext({ storageState });
  return { context, page: await context.newPage() };
}

test.describe.serial("Teams view toggle (grid / table / chart)", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    managerContext = await browser.newContext({ storageState: MANAGER_STORAGE });
    manager = await managerContext.newPage();
    await manager.goto("/tr/projeler");
    const managerId = ((await api(manager, "GET", "/auth/me")).json as { id: string }).id;
    const created = await api(manager, "POST", "/projects", { name: `View toggle QA ${Date.now()}`, projectType: "WEB" });
    expect(created.status).toBe(201);
    const project = created.json as { id: string; slug: string };

    const root = await api(manager, "POST", `/projects/${project.id}/teams`, { name: "Tablo Ekibi 00", description: "Kök ekip", includeCreator: true });
    expect(root.status).toBe(201);
    const rootId = (root.json as { id: string }).id;
    for (let index = 1; index < TEAM_COUNT; index += 1) {
      const body = { name: `Tablo Ekibi ${String(index).padStart(2, "0")}`, includeCreator: true, ...(index === 1 ? { parentTeamId: rootId } : {}) };
      expect((await api(manager, "POST", `/projects/${project.id}/teams`, body)).status).toBe(201);
    }

    // A second account that only belongs to the project, so it has no manager actions.
    const { context, page: member } = await newContext(browser, MEMBER_STORAGE);
    await member.goto("/tr/projeler");
    const memberId = ((await api(member, "GET", "/auth/me")).json as { id: string }).id;
    const invited = await api(manager, "POST", `/projects/${project.id}/invitations`, { userId: memberId, teamId: rootId, roles: ["TESTER"] });
    expect(invited.status).toBe(201);
    expect((await api(member, "POST", `/project-invitations/${(invited.json as { invitationId: string }).invitationId}/accept`)).status).toBe(200);
    await context.close();

    fixture = { projectId: project.id, slug: project.slug, managerId, memberId };
  });

  test.afterAll(async () => {
    await managerContext?.close();
  });

  test("default is the grid; the table shows the same names, parent and manager actions", async () => {
    await openTeams(manager);
    await expect(tab(manager, "Kart")).toHaveAttribute("aria-selected", "true");
    await expect(manager.locator("article")).toHaveCount(PAGE_SIZE);
    const grid = await gridNames(manager);
    expect(grid).toHaveLength(PAGE_SIZE);

    await tab(manager, "Tablo").click();
    await expect(manager).toHaveURL(/view=table/);
    const table = manager.getByTestId("teams-table");
    await expect(table.locator("tbody tr")).toHaveCount(PAGE_SIZE);
    expect(await tableNames(manager)).toEqual(grid);
    await expect(manager.locator("article")).toHaveCount(0);

    for (const column of ["Ekip", "Üyeler", "Üye sayısı", "Son güncelleme", "İşlemler"]) {
      await expect(table.getByRole("columnheader", { name: column, exact: true })).toBeVisible();
    }
    // Parent column only from xl; the default 1280 desktop viewport already shows it.
    await expect(table.getByRole("columnheader", { name: "Üst ekip", exact: true })).toBeVisible();
    const child = table.getByRole("row").filter({ has: manager.getByRole("link", { name: "Tablo Ekibi 01", exact: true }) });
    if (await child.count()) await expect(child.first()).toContainText("Tablo Ekibi 00");

    const first = table.locator("tbody tr").first();
    await expect(first.getByRole("link", { name: /ekibini düzenle$/ })).toBeVisible();
    await expect(first.getByRole("button", { name: /ekibini sil$/ })).toBeVisible();
    const teamLink = first.locator("td:first-child a");
    const href = await teamLink.getAttribute("href");
    expect(href).toMatch(new RegExp(`/ekipler/[0-9a-f-]{36}$`));
    // Real, dense rows: the native <table> has no zebra stripes and the member preview carries the real members.
    await expect(first.locator("[data-member-preview]").first()).toBeVisible();
  });

  test("table and grid share the page: page 2 survives switching, chart works, no extra requests", async () => {
    const teamRequests: string[] = [];
    await openTeams(manager, "&view=table");
    await expect(manager.getByTestId("teams-table").locator("tbody tr")).toHaveCount(PAGE_SIZE);
    manager.on("request", (request) => {
      const url = new URL(request.url());
      if (request.method() === "GET" && url.pathname.includes(`/projects/${fixture.projectId}/teams`)) teamRequests.push(request.url());
    });

    await manager.getByRole("button", { name: "Sayfa 2", exact: true }).click();
    await expect(manager).toHaveURL(/page=2/);
    const rows = manager.getByTestId("teams-table").locator("tbody tr");
    await expect(rows).toHaveCount(TEAM_COUNT - PAGE_SIZE);
    const secondPage = await tableNames(manager);

    await tab(manager, "Kart").click();
    await expect(manager).toHaveURL(/view=grid/);
    await expect(manager).toHaveURL(/page=2/);
    await expect(manager.locator("article")).toHaveCount(TEAM_COUNT - PAGE_SIZE);
    expect(await gridNames(manager)).toEqual(secondPage);

    await tab(manager, "Şema").click();
    await expect(manager).toHaveURL(/view=chart/);
    await expect(manager.getByRole("link", { name: /Tablo Ekibi 00 ekibini aç/ })).toBeVisible();

    await tab(manager, "Tablo").click();
    await expect(manager).toHaveURL(/view=table/);
    await expect(manager).toHaveURL(/page=2/);
    await expect(rows).toHaveCount(TEAM_COUNT - PAGE_SIZE);
    expect(await tableNames(manager)).toEqual(secondPage);

    expect(teamRequests).toEqual([]);
  });

  test("the choice is remembered per account and survives a reload without ?view=", async ({ browser }) => {
    await openTeams(manager);
    await tab(manager, "Tablo").click();
    await expect(manager.getByTestId("teams-table")).toBeVisible();
    expect(await manager.evaluate((id) => localStorage.getItem(`pda:teams-view:v1:${id}`), fixture.managerId)).toBe("table");

    await openTeams(manager);
    await expect(tab(manager, "Tablo")).toHaveAttribute("aria-selected", "true");
    await expect(manager.getByTestId("teams-table")).toBeVisible();

    // A different account in a fresh browser profile starts from the default and sees no manager actions.
    const { context, page: member } = await newContext(browser, MEMBER_STORAGE);
    try {
      await openTeams(member);
      await expect(tab(member, "Kart")).toHaveAttribute("aria-selected", "true");
      await expect(member.locator("article")).toHaveCount(PAGE_SIZE);
      expect(await member.evaluate((id) => localStorage.getItem(`pda:teams-view:v1:${id}`), fixture.managerId)).toBeNull();

      await tab(member, "Tablo").click();
      const table = member.getByTestId("teams-table");
      await expect(table.locator("tbody tr")).toHaveCount(PAGE_SIZE);
      await expect(table.getByRole("columnheader", { name: "İşlemler", exact: true })).toHaveCount(0);
      await expect(table.getByRole("link", { name: /ekibini düzenle$/ })).toHaveCount(0);
      await expect(table.getByRole("button", { name: /ekibini sil$/ })).toHaveCount(0);
      expect(await member.evaluate((id) => localStorage.getItem(`pda:teams-view:v1:${id}`), fixture.memberId)).toBe("table");
    } finally {
      await context.close();
    }
  });

  test("a stored view of another account in the same browser is not inherited", async () => {
    // Same browser profile as the manager: only the member-scoped key is missing.
    await manager.evaluate((id) => {
      localStorage.setItem(`pda:teams-view:v1:${id}`, "chart");
    }, fixture.memberId);
    await openTeams(manager);
    await expect(tab(manager, "Tablo")).toHaveAttribute("aria-selected", "true");
    await manager.evaluate((id) => localStorage.removeItem(`pda:teams-view:v1:${id}`), fixture.memberId);
  });

  test("legacy ?view=list opens the grid and the old global key migrates to the account once", async () => {
    await openTeams(manager, "&view=list");
    await expect(tab(manager, "Kart")).toHaveAttribute("aria-selected", "true");
    await expect(manager.locator("article")).toHaveCount(PAGE_SIZE);

    await manager.evaluate((id) => {
      localStorage.removeItem(`pda:teams-view:v1:${id}`);
      localStorage.setItem("pda.teams.view", "table");
    }, fixture.managerId);
    await openTeams(manager);
    await expect(tab(manager, "Tablo")).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => manager.evaluate((id) => ({
      legacy: localStorage.getItem("pda.teams.view"),
      scoped: localStorage.getItem(`pda:teams-view:v1:${id}`),
    }), fixture.managerId)).toEqual({ legacy: null, scoped: "table" });
  });

  test("320 and 390 show a stacked list without horizontal overflow, in light and dark", async ({ browser }) => {
    test.setTimeout(90_000);
    for (const theme of ["light", "dark"]) {
      for (const width of [320, 390]) {
        const { context, page } = await newContext(browser, MANAGER_STORAGE);
        try {
          await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
          // Saved/system preferences are applied after hydration; drive the system scheme too and wait for the class
          // before measuring, so the layout is checked in the intended theme instead of racing it.
          await page.emulateMedia({ colorScheme: theme === "dark" ? "dark" : "light" });
          await page.setViewportSize({ width, height: 800 });
          await openTeams(page, "&view=table");
          if (theme === "dark") await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
          else await expect(page.locator("html")).not.toHaveClass(/(^|\s)dark(\s|$)/);
          const list = page.getByTestId("teams-stacked-list");
          await expect(list).toBeVisible();
          await expect(page.getByTestId("teams-table")).toBeHidden();
          await expect(list.locator("> li")).toHaveCount(PAGE_SIZE);
          await expect(list.locator("> li").first().getByRole("link", { name: /ekibini düzenle$/ })).toBeVisible();
          const box = await list.locator("> li").first().getByRole("link", { name: /ekibini düzenle$/ }).boundingBox();
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height).toBeGreaterThanOrEqual(44);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          expect(await list.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
        } finally {
          await context.close();
        }
      }
    }
  });

  test("768 and 1280 tables stay inside the page", async ({ browser }) => {
    for (const width of [768, 1024, 1280]) {
      const { context, page } = await newContext(browser, MANAGER_STORAGE);
      try {
        await page.setViewportSize({ width, height: 900 });
        await openTeams(page, "&view=table");
        await expect(page.getByTestId("teams-table")).toBeVisible();
        await expect(page.getByTestId("teams-stacked-list")).toBeHidden();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      } finally {
        await context.close();
      }
    }
  });
});
