import { test, expect, type Page, type Request } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Query } from "@tanstack/react-query";
import { api } from "./helpers";
import { MANAGER_STORAGE, MANAGER_USER_FILE } from "./global-setup";
import { ApiError } from "../src/lib/api/client";
import { LIVE_REFRESH_MS, hasBlockingError, isLiveQueryKey, liveRefetchInterval, liveRefetchOnFocus } from "../src/lib/api/live-sync";

test.use({ storageState: MANAGER_STORAGE, trace: "off", actionTimeout: 15_000 });

type Project = { id: string; slug: string; name: string };

const fakeQuery = (queryKey: unknown[], state: { error?: unknown; fetchFailureCount?: number } = {}) =>
  ({ queryKey, state: { error: null, fetchFailureCount: 0, ...state } }) as unknown as Query;

test.describe("GF-02 live-sync policy", () => {
  test("follows workspace data families and leaves chat, meetings, session, notifications and repository alone", () => {
    for (const key of [["projects", "by-slug", "x"], ["projects", "selected", "u", "x"], ["projects", "p", "tasks", "list", {}],
      ["projects", "p", "criteria"], ["projects", "p", "squads", "all"], ["projects", "p", "home"], ["tasks", "mine", {}], ["tasks", "counts"],
      ["projects", "dashboard"], ["organizations", "list", 0]]) {
      expect(isLiveQueryKey(key), JSON.stringify(key)).toBe(true);
      expect(liveRefetchOnFocus(fakeQuery(key))).toBe(true);
      expect(liveRefetchInterval(fakeQuery(key))).toBe(LIVE_REFRESH_MS);
    }
    for (const key of [["auth", "session"], ["accounts", "u", "chat", "messages"], ["accounts", "u", "meetings", "p"],
      ["notifications", "u"], ["invitations", "u"], ["projects", "p", "repository", "commits"], ["projects", "p", "squads", "t", "candidates", "q"],
      ["projects", "sidebar-switcher", "u"], ["organizations", "picker"]]) {
      expect(isLiveQueryKey(key), JSON.stringify(key)).toBe(false);
      expect(liveRefetchInterval(fakeQuery(key))).toBe(false);
      expect(liveRefetchOnFocus(fakeQuery(key))).toBe(false);
    }
  });

  test("backs off while the server keeps failing and stops on answers that cannot change", () => {
    const key = ["projects", "p", "tasks", "list"];
    expect(liveRefetchInterval(fakeQuery(key, { error: new ApiError(503), fetchFailureCount: 1 }))).toBe(LIVE_REFRESH_MS * 2);
    expect(liveRefetchInterval(fakeQuery(key, { error: new ApiError(503), fetchFailureCount: 2 }))).toBe(LIVE_REFRESH_MS * 4);
    expect(liveRefetchInterval(fakeQuery(key, { error: new ApiError(503), fetchFailureCount: 9 }))).toBe(120_000);
    expect(liveRefetchInterval(fakeQuery(key, { error: new TypeError("network"), fetchFailureCount: 1 }))).toBe(LIVE_REFRESH_MS * 2);
    expect(liveRefetchInterval(fakeQuery(key, { error: new ApiError(429), fetchFailureCount: 1 }))).toBe(LIVE_REFRESH_MS * 2);
    for (const status of [400, 401, 403, 404]) {
      expect(liveRefetchInterval(fakeQuery(key, { error: new ApiError(status), fetchFailureCount: 1 })), String(status)).toBe(false);
    }
  });

  test("a failed background refresh keeps the page; a failed first load or a gone item takes it over", () => {
    expect(hasBlockingError({ isError: false, data: undefined, error: null })).toBe(false);
    expect(hasBlockingError({ isError: true, data: undefined, error: new ApiError(503) })).toBe(true);
    expect(hasBlockingError({ isError: true, data: [1], error: new ApiError(503) })).toBe(false);
    expect(hasBlockingError({ isError: true, data: [1], error: new TypeError("network") })).toBe(false);
    expect(hasBlockingError({ isError: true, data: [1], error: new ApiError(404) })).toBe(true);
    expect(hasBlockingError({ isError: true, data: [1], error: new ApiError(403) })).toBe(true);
  });
});

async function signIn(page: Page) {
  const account = JSON.parse(readFileSync(MANAGER_USER_FILE, "utf8")) as { email: string; password: string };
  await page.context().request.get("http://localhost:8080/api/v1/auth/csrf");
  const csrf = (await page.context().cookies()).find(cookie => cookie.name === "XSRF-TOKEN")!;
  const result = await page.context().request.post("http://localhost:8080/api/v1/auth/login", {
    headers: { "X-XSRF-TOKEN": decodeURIComponent(csrf.value), Origin: "http://localhost:3000" }, data: account,
  });
  expect(result.status()).toBe(200);
  await page.goto("/dashboard");
}

async function createProject(page: Page, name: string): Promise<Project> {
  const result = await api(page, "POST", "/projects", { name });
  expect(result.status).toBe(201);
  const project = result.json as Project;
  expect((await api(page, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "BOTH" })).status).toBe(200);
  return project;
}

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Gezinme menüsü" });
const selectionKey = (actor: string) => `pda:last-project:${actor}`;
const stored = (page: Page, actor: string) => page.evaluate(key => localStorage.getItem(key), selectionKey(actor));
const archive = (page: Page, ...projects: Project[]) => Promise.all(projects.map(item => api(page, "POST", `/projects/${item.id}/archive`).catch(() => undefined)));
async function expectSelected(page: Page, project: Project) {
  await expect.poll(() => sidebar(page).locator(`a[href*="${project.slug}"]`).count()).toBeGreaterThan(0);
}

test.describe("GF-01 selected project survives tabs, visits and sessions", () => {
  test("a new tab and a reopened browser keep the project, the URL still wins, and storage holds the slug only", async ({ page, browser }) => {
    test.setTimeout(120_000);
    await signIn(page);
    const a = await createProject(page, `Persist A ${Date.now()}`), b = await createProject(page, `Persist B ${Date.now()}`);
    const actor = ((await api(page, "GET", "/auth/me")).json as { id: string }).id;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    try {
      await page.goto(`/projects/${a.slug}`);
      await expect.poll(() => stored(page, actor)).toBe(a.slug);
      await page.goto(`/projects/${b.slug}/tasks`);
      await expect.poll(() => stored(page, actor)).toBe(b.slug);

      // A second tab of the same browser opens on a page without a project in its URL and lands in the same project.
      const second = await page.context().newPage();
      await second.goto("/dashboard");
      await expectSelected(second, b);
      expect(await stored(second, actor)).toBe(b.slug);
      await second.goto("/calendar");
      await expectSelected(second, b);

      // A project named by the URL beats the remembered one, and becomes the remembered one.
      await second.goto(`/projects/${a.slug}`);
      await expectSelected(second, a);
      await expect.poll(() => stored(second, actor)).toBe(a.slug);
      await second.close();

      // Closing the browser and coming back later: a fresh context carrying only what the browser persisted.
      await page.goto(`/projects/${b.slug}`);
      await expect.poll(() => stored(page, actor)).toBe(b.slug);
      const reopened = await browser.newContext({ storageState: await page.context().storageState() });
      const later = await reopened.newPage();
      await later.goto("/dashboard");
      await expectSelected(later, b);
      await reopened.close();

      // Nothing but the slug is written; no credential-like value reaches web storage.
      const entries = await page.evaluate(() => [...Object.entries(localStorage), ...Object.entries(sessionStorage)]);
      expect(Object.fromEntries(entries)[selectionKey(actor)]).toBe(b.slug);
      for (const [key, value] of entries) {
        expect(`${key}`, key).not.toMatch(/token|jwt|secret|password/i);
        expect(value, key).not.toMatch(/eyJ[\w-]{10,}\./);
      }
      expect(await page.evaluate(() => sessionStorage.getItem("pda:last-project:x"))).toBeNull();
      expect(errors.filter(text => /hydrat/i.test(text))).toEqual([]);
    } finally { await archive(page, a, b); }
  });

  test("the old per-tab selection is moved once, and a lost project falls back to the first one", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);
    const a = await createProject(page, `Migrate A ${Date.now()}`), b = await createProject(page, `Migrate B ${Date.now()}`);
    const actor = ((await api(page, "GET", "/auth/me")).json as { id: string }).id;
    try {
      await page.evaluate(({ key, slug }) => { localStorage.removeItem(key); sessionStorage.setItem(key, slug); }, { key: selectionKey(actor), slug: a.slug });
      await page.goto("/dashboard");
      await expectSelected(page, a);
      await expect.poll(() => stored(page, actor)).toBe(a.slug);
      expect(await page.evaluate(key => sessionStorage.getItem(key), selectionKey(actor))).toBeNull();

      // An existing shared choice is never overwritten by an older per-tab one.
      await page.evaluate(({ key, mine, old }) => { localStorage.setItem(key, mine); sessionStorage.setItem(key, old); }, { key: selectionKey(actor), mine: b.slug, old: a.slug });
      await page.goto("/dashboard");
      await expectSelected(page, b);
      await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), selectionKey(actor))).toBeNull();
      expect(await stored(page, actor)).toBe(b.slug);

      // The remembered project is gone: the stale value is dropped and the workspace does not stay empty or broken.
      await archive(page, b);
      await page.goto("/dashboard");
      await expect.poll(() => stored(page, actor)).not.toBe(b.slug);
      await expect(page.locator(".app-shell")).toBeVisible();
      expect(await sidebar(page).locator(`a[href*="${b.slug}"]`).count()).toBe(0);
    } finally { await archive(page, a, b); }
  });

  test("another tab switching project updates this tab without moving the page it shows", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);
    const a = await createProject(page, `Sync A ${Date.now()}`), b = await createProject(page, `Sync B ${Date.now()}`);
    const actor = ((await api(page, "GET", "/auth/me")).json as { id: string }).id;
    try {
      await page.goto(`/projects/${a.slug}`);
      await expect.poll(() => stored(page, actor)).toBe(a.slug);
      await page.goto("/dashboard");
      await expectSelected(page, a);
      const url = page.url();

      const other = await page.context().newPage();
      await other.goto(`/projects/${b.slug}`);
      await expect.poll(() => stored(other, actor)).toBe(b.slug);
      await expectSelected(page, b);
      expect(page.url()).toBe(url);

      // The project page that stays open keeps showing its own project even though the shared choice moved on.
      await other.goto(`/projects/${a.slug}`);
      await expect.poll(() => stored(other, actor)).toBe(a.slug);
      await other.close();
    } finally { await archive(page, a, b); }
  });
});

test.describe("GF-02 data follows the server without F5", () => {
  async function tasksFixture(page: Page) {
    await signIn(page);
    const project = await createProject(page, `Live ${Date.now()}`);
    const me = (await api(page, "GET", "/auth/me")).json as { id: string };
    const addTask = async (title: string) => {
      const created = await api(page, "POST", `/projects/${project.id}/tasks`, { title, creationMode: "SIMPLE", priority: "HIGH", assigneeIds: [me.id] });
      expect(created.status).toBe(201);
      return created.json as { id: string; title: string };
    };
    return { project, me, addTask };
  }

  test("a task created elsewhere appears in the list and in Görevlerim, and the page is not blanked meanwhile", async ({ page }) => {
    test.setTimeout(120_000);
    const { project, addTask } = await tasksFixture(page);
    try {
      await addTask("Existing live task");
      await page.goto(`/projects/${project.slug}/tasks`);
      await expect(page.getByRole("link", { name: "Existing live task", exact: true })).toBeVisible();
      await page.evaluate(() => { document.body.dataset.liveMarker = "1"; });

      await addTask("Added behind the page");
      await expect(page.getByRole("link", { name: "Added behind the page", exact: true })).toBeVisible({ timeout: 40_000 });
      // The same document: no reload, and the older row never disappeared on the way.
      expect(await page.evaluate(() => document.body.dataset.liveMarker)).toBe("1");
      await expect(page.getByRole("link", { name: "Existing live task", exact: true })).toBeVisible();

      // Filtered to this project: the shared account keeps tasks of earlier runs, which would push new ones off page one.
      await page.goto(`/tasks?project=${project.id}`);
      await expect(page.getByText("Added behind the page", { exact: true }).first()).toBeVisible();
      await addTask("Added while on Görevlerim");
      await expect(page.getByText("Added while on Görevlerim", { exact: true }).first()).toBeVisible({ timeout: 40_000 });
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    } finally { await archive(page, project); }
  });

  test("a hidden tab does not poll, and showing it again catches up", async ({ page }) => {
    test.setTimeout(120_000);
    const { project, addTask } = await tasksFixture(page);
    try {
      await addTask("Hidden tab first");
      await page.goto(`/projects/${project.slug}/tasks`);
      await expect(page.getByRole("link", { name: "Hidden tab first", exact: true })).toBeVisible();

      const setVisibility = (state: "hidden" | "visible") => page.evaluate(value => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
        document.dispatchEvent(new Event("visibilitychange"));
      }, state);
      await setVisibility("hidden");
      const reads: string[] = [];
      const onRequest = (request: Request) => { if (new URL(request.url()).pathname.endsWith(`/projects/${project.id}/tasks`)) reads.push(request.url()); };
      page.on("request", onRequest);
      await page.waitForTimeout(LIVE_REFRESH_MS + 6_000);
      expect(reads).toEqual([]);

      await addTask("Hidden tab second");
      await setVisibility("visible");
      await expect(page.getByRole("link", { name: "Hidden tab second", exact: true })).toBeVisible({ timeout: 40_000 });
      page.off("request", onRequest);
    } finally { await archive(page, project); }
  });

  test("a failing refresh keeps the list, shows no error or toast, and the next good answer is applied", async ({ page }) => {
    test.setTimeout(150_000);
    const { project, addTask } = await tasksFixture(page);
    try {
      await addTask("Survives outage");
      await page.goto(`/projects/${project.slug}/tasks`);
      await expect(page.getByRole("link", { name: "Survives outage", exact: true })).toBeVisible();

      let failing = true, failures = 0;
      await page.route(url => url.pathname.endsWith(`/projects/${project.id}/tasks`), async route => {
        if (failing && route.request().method() === "GET") { failures++; await route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ status: 503, title: "down" }) }); }
        else await route.continue();
      });
      await expect.poll(() => failures, { timeout: 60_000 }).toBeGreaterThan(0);
      await expect(page.getByRole("link", { name: "Survives outage", exact: true })).toBeVisible();
      await expect(page.getByRole("alert").filter({ hasText: /./ })).toHaveCount(0);
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);

      failing = false;
      await addTask("Back after outage");
      await expect(page.getByRole("link", { name: "Back after outage", exact: true })).toBeVisible({ timeout: 100_000 });
    } finally { await page.unroute(() => true).catch(() => undefined); await archive(page, project); }
  });

  test("an edit form is not overwritten while open, and a typed value survives a refresh cycle", async ({ page }) => {
    test.setTimeout(120_000);
    const { project, me, addTask } = await tasksFixture(page);
    try {
      const task = await addTask("Form original");
      await page.goto(`/projects/${project.slug}/tasks/${task.id}/edit`);
      await expect(page.locator("#task-title")).toHaveValue("Form original");
      await page.locator("#task-title").fill("Form being typed");
      expect((await api(page, "PATCH", `/projects/${project.id}/tasks/${task.id}`, { title: "Form changed elsewhere", creationMode: "SIMPLE", priority: "HIGH", assigneeIds: [me.id] })).status).toBeLessThan(300);

      await page.waitForTimeout(LIVE_REFRESH_MS + 8_000);
      await expect(page.locator("#task-title")).toHaveValue("Form being typed");
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    } finally { await archive(page, project); }
  });
});
