import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import tr from "../src/i18n/messages/tr.json";

// V2.9.2 - the project task list opens on "last update, ascending" and remembers the sort the person chose, per signed-in user. The address
// still wins, paging/filters never reset it, My tasks keeps its completed-last rule (TSF-04) and the server (not the page) does the ordering.
test.use({ storageState: MANAGER_STORAGE });
const ASC = "updatedAt,asc", DESC = "updatedAt,desc";
const KEY = (userId: string) => `pda:tasks-sort:v1:${userId}`;

async function fixture(page: Page) {
  await page.goto("/dashboard");
  const project = (await api(page, "POST", "/projects", { name: `TSort ${Date.now()}`, projectTypes: ["WEB"] })).json as { id: string; slug: string };
  expect((await api(page, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "BOTH" })).status).toBe(200);
  const me = (await api(page, "GET", "/auth/me")).json as { id: string };
  const created: { id: string; title: string }[] = [];
  for (let i = 1; i <= 12; i++) {
    const task = await api(page, "POST", `/projects/${project.id}/tasks`, { title: `Sort task ${String(i).padStart(2, "0")}`, creationMode: "SIMPLE", assigneeIds: [me.id] });
    expect(task.status).toBe(201); created.push(task.json as { id: string; title: string });
  }
  // Two tasks are finished late (their last update is the newest of all): they must still come last in both directions.
  for (const index of [2, 6]) for (const status of ["IN_PROGRESS", "DONE"]) expect((await api(page, "PATCH", `/projects/${project.id}/tasks/${created[index].id}/status`, { status })).status).toBe(200);
  return { project, me, tasks: created };
}
/** The server's own order, all pages: the truth the page is compared with. */
async function serverOrder(page: Page, projectId: string, sort: string) {
  const first = (await api(page, "GET", `/projects/${projectId}/tasks?sort=${sort}&page=0&size=50`)).json as { content: { title: string; status: string }[] };
  return first.content;
}
const rows = (page: Page) => page.locator("table tbody tr");
const titles = async (page: Page) => (await rows(page).allTextContents()).map(text => /Sort task \d\d/.exec(text)?.[0] ?? text);
function watchSorts(page: Page, projectId: string) {
  const sorts: string[] = [];
  page.on("request", request => { const url = new URL(request.url()); if (url.pathname === `/api/v1/projects/${projectId}/tasks` && url.searchParams.has("sort")) sorts.push(url.searchParams.get("sort")!); });
  return sorts;
}
async function choose(page: Page, label: string) {
  await page.getByRole("button", { name: /^Sırala:/ }).click();
  await page.getByRole("menuitemradio", { name: label, exact: true }).click();
  await page.keyboard.press("Escape");
}
const sidebarTasks = (page: Page, name: string) => page.getByRole("link", { name, exact: true }).first();

test("the project task list opens on last update ascending, remembers the chosen sort across pages and visits, and leaves My tasks completed-last (TSF-04) alone", async ({ page, context }) => {
  test.setTimeout(240_000);
  const { project, me } = await fixture(page);
  const sorts = watchSorts(page, project.id);
  const list = `/projects/${project.slug}/tasks`;
  try {
    // 1. Nothing chosen yet: the default is last update, ascending (oldest update first), asked of the server.
    const asc = await serverOrder(page, project.id, ASC), desc = await serverOrder(page, project.id, DESC);
    // The project list is ordered by the chosen field alone (the completed-last rule of TSF-04 belongs to My tasks "all", checked at the end).
    expect(asc[0].title).toBe("Sort task 01"); expect(desc[0].title, "the task finished last was updated last").toBe("Sort task 07"); expect(asc.map(t => t.title)).toEqual([...desc.map(t => t.title)].reverse());
    await page.goto(list); await expect(rows(page).first()).toBeVisible();
    expect(sorts[0]).toBe(ASC); expect(new URL(page.url()).searchParams.has("sort")).toBe(false);
    await expect(page.getByRole("button", { name: /^Sırala: Son güncelleme/ })).toBeVisible();
    expect(await titles(page)).toEqual(asc.slice(0, 9).map(t => t.title));
    await page.getByRole("button", { name: /^Sırala:/ }).click();
    await expect(page.getByRole("menuitemradio", { name: tr.tasks.filters.direction.asc, exact: true })).toHaveAttribute("aria-checked", "true"); await page.keyboard.press("Escape");
    // 2. Page two continues the same order, with the sort kept in the address.
    await page.getByRole("button", { name: "Sayfa 2", exact: true }).click(); await expect(page).toHaveURL(/page=2/);
    await expect.poll(async () => (await titles(page)).length).toBe(3);
    expect(await titles(page)).toEqual(asc.slice(9).map(t => t.title));
    // 3. Choosing descending: the server is asked for it, the order flips, the address says so, and it is remembered.
    await page.goto(list); await choose(page, tr.tasks.filters.direction.desc);
    await expect(page).toHaveURL(/dir=desc/); await expect.poll(() => sorts.at(-1)).toBe(DESC);
    await expect.poll(async () => titles(page)).toEqual(desc.slice(0, 9).map(t => t.title));
    expect(await page.evaluate(key => localStorage.getItem(key), KEY(me.id))).toBe(JSON.stringify({ sort: "updatedAt", dir: "desc" }));
    // 4. Leaving through the sidebar and coming back by its plain link (no query): still descending, and asked of the server so.
    await sidebarTasks(page, "Genel Bakış").click(); await expect(page).toHaveURL(new RegExp(`/projeler/${project.slug}/genel-bakis$`));
    await sidebarTasks(page, tr.tasks.list.title).click();
    await expect(page).toHaveURL(new RegExp(`/projeler/${project.slug}/gorevler$`)); await expect(rows(page).first()).toBeVisible();
    await expect.poll(() => sorts.at(-1)).toBe(DESC); expect(await titles(page)).toEqual(desc.slice(0, 9).map(t => t.title));
    await page.getByRole("button", { name: /^Sırala:/ }).click();
    await expect(page.getByRole("menuitemradio", { name: tr.tasks.filters.direction.desc, exact: true })).toHaveAttribute("aria-checked", "true"); await page.keyboard.press("Escape");
    // 5. A reload, a new tab, Back and Forward: the same.
    await page.reload(); await expect(rows(page).first()).toBeVisible(); expect(await titles(page)).toEqual(desc.slice(0, 9).map(t => t.title));
    const tab = await context.newPage(); const tabSorts = watchSorts(tab, project.id);
    await tab.goto(list); await expect(rows(tab).first()).toBeVisible(); expect(tabSorts[0]).toBe(DESC); expect(await titles(tab)).toEqual(desc.slice(0, 9).map(t => t.title)); await tab.close();
    await page.goto(`/projects/${project.slug}`); await page.goBack(); await expect(rows(page).first()).toBeVisible(); expect(await titles(page)).toEqual(desc.slice(0, 9).map(t => t.title));
    await page.goForward(); await page.goBack(); await expect.poll(() => sorts.at(-1)).toBe(DESC);
    // 6. The address wins over the remembered sort without replacing it.
    await page.goto(`${list}?sort=priority&dir=desc`); await expect.poll(() => sorts.at(-1)).toBe("priority,desc");
    await page.goto(list); await expect.poll(() => sorts.at(-1)).toBe(DESC);
    await page.goto(`${list}?dir=asc`); await expect.poll(() => sorts.at(-1)).toBe(ASC);
    await page.goto(list); await expect.poll(() => sorts.at(-1)).toBe(DESC);
    // 7. Filters, clearing them and paging never reset the sort; the second page of the descending order follows the server.
    await page.getByRole("button", { name: "Sayfa 2", exact: true }).click(); await expect(page).toHaveURL(/page=2/); await expect(page).toHaveURL(/dir=desc/);
    expect(await titles(page)).toEqual(desc.slice(9).map(t => t.title));
    await page.goto(`${list}?status=DONE`); await expect.poll(() => sorts.at(-1)).toBe(DESC);
    await page.getByRole("button", { name: tr.tasks.filters.clear, exact: true }).click(); await expect.poll(() => sorts.at(-1)).toBe(DESC); await expect(page).not.toHaveURL(/status=/);
    // 8. Choosing ascending again: a clean address, remembered, and the default for the next visit.
    await choose(page, tr.tasks.filters.direction.asc);
    await expect(page).not.toHaveURL(/dir=/); await expect.poll(() => sorts.at(-1)).toBe(ASC);
    expect(await page.evaluate(key => localStorage.getItem(key), KEY(me.id))).toBe(JSON.stringify({ sort: "updatedAt", dir: "asc" }));
    // 9. Another sort field is remembered the same way (priority keeps its own "most urgent first" default).
    await choose(page, tr.tasks.filters.sort.priority); await expect.poll(() => sorts.at(-1)).toBe("priority,desc");
    await page.goto(list); await expect.poll(() => sorts.at(-1)).toBe("priority,desc");
    await choose(page, tr.tasks.filters.sort.updatedAt); await expect.poll(() => sorts.at(-1)).toBe(ASC);
    // 10. Garbage in storage falls back to the default; it never breaks the page.
    for (const value of ["{not json", JSON.stringify({ sort: "nope", dir: "up" }), JSON.stringify({ sort: "priority" }), "null"]) {
      await page.evaluate(([key, stored]) => localStorage.setItem(key, stored), [KEY(me.id), value]);
      await page.goto(list); await expect.poll(() => sorts.at(-1)).toBe(ASC); await expect(rows(page).first()).toBeVisible();
    }
    // 11. TSF-04 is untouched: My tasks "all" still puts completed tasks last, in both directions, across the whole result (the server does it).
    for (const direction of ["asc", "desc"]) {
      const mine = (await api(page, "GET", `/tasks/mine?scope=ALL&projectId=${project.id}&sort=updatedAt&direction=${direction}&page=0&size=50`)).json as { content: { status: string }[] };
      expect(mine.content.slice(-2).map(t => t.status), `completed last, ${direction}`).toEqual(["DONE", "DONE"]); expect(mine.content.slice(0, -2).every(t => t.status !== "DONE")).toBe(true);
    }
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); }
});

test("the remembered task sort belongs to the signed-in user: another account on the same browser starts from the default, and gets it back", async ({ browser }) => {
  test.setTimeout(240_000);
  const owner = await browser.newContext({ storageState: MANAGER_STORAGE }); const page = await owner.newPage();
  const { project, me } = await fixture(page);
  const sorts = watchSorts(page, project.id); const list = `/projects/${project.slug}/tasks`;
  try {
    // The second shared account is a member of this project (TEST-ONLY fixture membership in a project created above).
    const other = await browser.newContext({ storageState: MEMBER_STORAGE }); const otherPage = await other.newPage(); await otherPage.goto("/dashboard");
    const member = (await api(otherPage, "GET", "/auth/me")).json as { id: string }; await other.close();
    psql(`WITH membership AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES(gen_random_uuid(),'${uuid(project.id)}','${uuid(member.id)}',now()) RETURNING id) INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM membership`);
    await page.goto(list); await choose(page, tr.tasks.filters.direction.desc); await expect.poll(() => sorts.at(-1)).toBe(DESC);
    // Same browser profile, another session: the manager's choice is not theirs.
    const memberCookies = (JSON.parse(readFileSync(MEMBER_STORAGE, "utf8")) as { cookies: Parameters<typeof owner.addCookies>[0] }).cookies;
    const managerCookies = await owner.cookies();
    await owner.clearCookies(); await owner.addCookies(memberCookies);
    await page.goto(list); await expect(rows(page).first()).toBeVisible(); await expect.poll(() => sorts.at(-1)).toBe(ASC);
    expect(await page.evaluate(([mine, theirs]) => [localStorage.getItem(mine), localStorage.getItem(theirs)], [KEY(me.id), KEY(member.id)])).toEqual([JSON.stringify({ sort: "updatedAt", dir: "desc" }), null]);
    // Their own choice stays theirs, and the manager still finds theirs when signing back in.
    await choose(page, tr.tasks.filters.sort.priority); await expect.poll(() => sorts.at(-1)).toBe("priority,desc");
    await owner.clearCookies(); await owner.addCookies(managerCookies);
    await page.goto(list); await expect(rows(page).first()).toBeVisible(); await expect.poll(() => sorts.at(-1)).toBe(DESC);
  } finally { await api(page, "POST", `/projects/${project.id}/archive`).catch(() => {}); await owner.close(); }
});

test("My tasks keeps its own fixed order (open: deadline, others: last update newest first) and has no remembered sort", async ({ page }) => {
  test.setTimeout(120_000);
  const requests: string[] = [];
  page.on("request", request => { const url = new URL(request.url()); if (url.pathname === "/api/v1/tasks/mine") requests.push(`${url.searchParams.get("scope")}|${url.searchParams.get("sort")}|${url.searchParams.get("direction")}`); });
  await page.goto("/tasks"); await expect.poll(() => requests.at(-1)).toBe("OPEN|deadlineAt|asc");
  await page.goto("/tasks?tab=all"); await expect.poll(() => requests.at(-1)).toBe("ALL|updatedAt|desc");
  await page.goto("/tasks?tab=done"); await expect.poll(() => requests.at(-1)).toBe("DONE|updatedAt|desc");
});
