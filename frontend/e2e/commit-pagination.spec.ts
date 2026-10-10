import { test, expect, type Page, type Route } from "@playwright/test";
import { api } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";

/**
 * Commit history pagination (Previous / numbered pages / Next) of the branch view. The project and the session are
 * real; only the GitHub-backed repository endpoints are answered by `page.route`, because GitHub is external and
 * rate-limited. The mock follows the backend contract: `page` 1..10, `limit` 1..50, `X-Has-Next-Page` (exposed to the
 * browser through CORS) and page 10 always reports "no next page".
 */
const sha = (n: number) => String(n).padStart(40, "0");
const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

function commit(n: number) {
  return {
    sha: sha(n),
    shortSha: sha(n).slice(0, 7),
    message: `Commit number ${n}`,
    author: "Alice Dev",
    authorLogin: "alice",
    authorAvatarUrl: null,
    committedAt: iso(n),
    commitUrl: `https://github.com/octocat/demo-repo/commit/${sha(n)}`,
  };
}

// feature/login: 75 commits, newest first -> pages of 30 / 30 / 15. long/history never runs out (page 10 is the cap).
const FEATURE = Array.from({ length: 75 }, (_, i) => commit(i + 1));
const RELEASE = [201, 202, 203].map(commit);
const MAIN = [101, 102, 103].map(commit);

const CONNECTION = {
  provider: "GITHUB",
  repositoryUrl: "https://github.com/octocat/demo-repo",
  repositoryOwner: "octocat",
  repositoryName: "demo-repo",
  defaultBranch: "main",
  trackingMode: "ADVANCED",
  notifyOnCommits: true,
  connectedBy: "someone",
  connectedAt: iso(600),
  updatedAt: iso(600),
};

const BRANCHES = {
  branches: [
    { name: "main", isDefault: true, isProtected: true, headShortSha: "0000101" },
    { name: "feature/login", isDefault: false, isProtected: false, headShortSha: "0000001" },
    { name: "release/1.0", isDefault: false, isProtected: false, headShortSha: "0000201" },
    { name: "long/history", isDefault: false, isProtected: false, headShortSha: "0000301" },
  ],
  truncated: false,
};

const FIRST_PAGE_URL = (slug: string, branch = "feature%2Flogin") => `/projects/${slug}?section=repository&view=branches&branch=${branch}`;

/** Requests to the commits endpoint, in order, so tests can assert what the page asked for. */
type Mock = { commitRequests: URL[]; hold: (page: number) => () => void };

async function mockRepository(page: Page): Promise<Mock> {
  const cors = {
    "access-control-allow-origin": "http://localhost:3000",
    "access-control-allow-credentials": "true",
    "access-control-expose-headers": "X-Has-Next-Page",
  };
  const mock: Mock = { commitRequests: [], hold: () => () => undefined };
  const gates = new Map<number, Promise<void>>();
  mock.hold = (pageNo) => {
    let release = () => undefined as void;
    gates.set(pageNo, new Promise<void>((resolve) => { release = resolve; }));
    return () => { release(); gates.delete(pageNo); };
  };

  await page.route("**/api/v1/projects/*/repository**", async (route: Route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS", "access-control-allow-headers": "*" } });
      return;
    }
    if (request.method() !== "GET") return route.continue();
    const url = new URL(request.url());
    const json = (body: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({ status: 200, contentType: "application/json", headers: { ...cors, ...headers }, body: JSON.stringify(body) });

    if (url.pathname.endsWith("/repository/branches")) return json(BRANCHES);
    if (url.pathname.endsWith("/repository/compare")) {
      return json({ base: "main", branch: url.searchParams.get("branch"), aheadBy: 0, behindBy: 0, unmergedCommits: [], truncated: false });
    }
    if (url.pathname.endsWith("/repository/commits")) {
      mock.commitRequests.push(url);
      const branch = url.searchParams.get("branch");
      const limit = Number(url.searchParams.get("limit") ?? 10);
      const pageNo = Number(url.searchParams.get("page") ?? 1);
      await gates.get(pageNo);
      let list: ReturnType<typeof commit>[];
      let hasNext: boolean;
      if (branch === "long/history") {
        list = Array.from({ length: limit }, (_, i) => commit(1000 + (pageNo - 1) * limit + i));
        hasNext = pageNo < 10;
      } else {
        const all = branch === "feature/login" ? FEATURE : branch === "release/1.0" ? RELEASE : MAIN;
        list = all.slice((pageNo - 1) * limit, pageNo * limit);
        hasNext = pageNo < 10 && all.length > pageNo * limit;
      }
      return json(list, { "X-Has-Next-Page": String(hasNext) });
    }
    return json(CONNECTION);
  });
  return mock;
}

test.describe.serial("Commit history pagination", () => {
  let managerPage: Page;
  let slug: string;
  let projectId: string;
  let mock: Mock;

  test.beforeAll(async ({ browser }) => {
    managerPage = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    await managerPage.goto("/tr/projeler");
    const created = await api(managerPage, "POST", "/projects", { name: `E2E Commit Pages ${Date.now()}`, projectType: "WEB" });
    expect(created.status).toBe(201);
    ({ id: projectId, slug } = created.json as { id: string; slug: string });
    mock = await mockRepository(managerPage);
  });

  test.afterAll(async () => {
    await api(managerPage, "POST", `/projects/${projectId}/archive`).catch(() => undefined);
    await managerPage.close();
  });

  const nav = () => managerPage.getByRole("navigation", { name: "Sayfalama" });
  const rows = () => managerPage.getByTestId("branch-commits").getByRole("listitem");
  const previous = () => nav().getByRole("button", { name: "Önceki" });
  const next = () => nav().getByRole("button", { name: "Sonraki" });
  const pageButton = (n: number) => nav().getByRole("button", { name: `Sayfa ${n}`, exact: true });

  test("page 1 shows a full page, Next is enabled and Previous is not", async () => {
    await managerPage.goto(FIRST_PAGE_URL(slug));
    await expect(rows()).toHaveCount(30);
    await expect(rows().first()).toContainText("Commit number 1");
    await expect(next()).toBeEnabled();
    await expect(previous()).toBeDisabled();
    await expect(pageButton(1)).toHaveAttribute("aria-current", "page");
    await expect(pageButton(2)).not.toHaveAttribute("aria-current", "page");
    await expect(pageButton(3)).toHaveCount(0);

    // The request asks the server for the page and its size; the order is the server's, newest first.
    const request = mock.commitRequests.filter((url) => url.searchParams.get("branch") === "feature/login").at(-1)!;
    expect(request.searchParams.get("page")).toBe("1");
    expect(request.searchParams.get("limit")).toBe("30");
  });

  test("Next goes to page 2 in the URL with different commits, and a page number goes back deterministically", async () => {
    await next().click();
    await expect(managerPage).toHaveURL(/cpage=2/);
    await expect(rows().first()).toContainText("Commit number 31");
    await expect(rows()).toHaveCount(30);
    await expect(previous()).toBeEnabled();
    await expect(pageButton(2)).toHaveAttribute("aria-current", "page");
    await expect(pageButton(3)).toBeVisible();

    await pageButton(1).click();
    await expect(managerPage).not.toHaveURL(/cpage=/);
    await expect(rows().first()).toContainText("Commit number 1");
    await expect(pageButton(1)).toHaveAttribute("aria-current", "page");
    // Page 2 stays reachable from the numbers after having been there.
    await expect(pageButton(2)).toBeVisible();

    // Browser history steps through the pages like GitHub.
    await next().click();
    await expect(managerPage).toHaveURL(/cpage=2/);
    await managerPage.goBack();
    await expect(rows().first()).toContainText("Commit number 1");
  });

  test("a loading page never shows the previous page's commits as its own", async () => {
    await managerPage.goto(FIRST_PAGE_URL(slug));
    await expect(rows().first()).toContainText("Commit number 1");

    const release = mock.hold(3);
    await next().click();
    await expect(managerPage.getByTestId("branch-commits").getByText("Commit number 31")).toBeVisible();
    await next().click();
    await expect(managerPage).toHaveURL(/cpage=3/);
    // Page 3 is held back: the old rows are gone, the skeleton is there and the controls do nothing yet.
    await expect(managerPage.getByTestId("branch-commits")).toHaveCount(0);
    await expect(managerPage.locator('[role="status"][aria-hidden="true"]').first()).toBeVisible();
    await expect(next()).toHaveAttribute("aria-disabled", "true");
    release();

    await expect(rows()).toHaveCount(15);
    await expect(rows().first()).toContainText("Commit number 61");
    // The last page: no Next.
    await expect(next()).toBeDisabled();
    await expect(pageButton(3)).toHaveAttribute("aria-current", "page");
    await expect(pageButton(4)).toHaveCount(0);
  });

  test("a deep link opens that page and a bad ?cpage= falls back to page 1", async () => {
    await managerPage.goto(`${FIRST_PAGE_URL(slug)}&cpage=2`);
    await expect(rows().first()).toContainText("Commit number 31");
    await expect(pageButton(2)).toHaveAttribute("aria-current", "page");

    await managerPage.goto(`${FIRST_PAGE_URL(slug)}&cpage=99`);
    await expect(rows().first()).toContainText("Commit number 1");
    await managerPage.goto(`${FIRST_PAGE_URL(slug)}&cpage=abc`);
    await expect(rows().first()).toContainText("Commit number 1");
  });

  test("choosing another branch starts again on page 1", async () => {
    await managerPage.goto(`${FIRST_PAGE_URL(slug)}&cpage=2`);
    await expect(rows().first()).toContainText("Commit number 31");
    await managerPage.getByRole("list", { name: "Dallar" }).getByRole("button", { name: /release\/1\.0/ }).click();
    await expect(managerPage).toHaveURL(/branch=release%2F1\.0/);
    await expect(managerPage).not.toHaveURL(/cpage=/);
    await expect(rows().first()).toContainText("Commit number 201");
    // A single short page needs no pagination.
    await expect(nav()).toHaveCount(0);
  });

  test("filtering by author goes back to page 1", async () => {
    await managerPage.goto(`${FIRST_PAGE_URL(slug)}&cpage=2`);
    await expect(rows().first()).toContainText("Commit number 31");
    await managerPage.getByRole("button", { name: /Alice Dev/ }).click();
    await expect(managerPage).not.toHaveURL(/cpage=/);
    await expect(rows().first()).toContainText("Commit number 1");
    const last = mock.commitRequests.at(-1)!;
    expect(last.searchParams.get("author")).toBe("alice");
    expect(last.searchParams.get("page")).toBe("1");
  });

  test("the history ends at page 10 with a note, in light and dark, and fits 390 px", async () => {
    for (const theme of ["light", "dark"] as const) {
      await managerPage.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await managerPage.goto(`${FIRST_PAGE_URL(slug, "long%2Fhistory")}&cpage=10`);
      await expect(rows().first()).toContainText("Commit number 1270");
      if (theme === "dark") await expect(managerPage.locator("html")).toHaveClass(/dark/);
      else await expect(managerPage.locator("html")).not.toHaveClass(/dark/);
      await expect(pageButton(10)).toHaveAttribute("aria-current", "page");
      await expect(pageButton(1)).toBeVisible();
      await expect(next()).toBeDisabled();
      await expect(managerPage.getByText("GitHub'dan en fazla son 300 commit gösterilir.")).toBeVisible();
    }

    await managerPage.setViewportSize({ width: 390, height: 844 });
    await managerPage.reload();
    await expect(rows().first()).toBeVisible();
    // On a phone the numbers collapse into "Sayfa N" and the buttons are 44 px targets.
    await expect(nav().getByText("Sayfa 10", { exact: true })).toBeVisible();
    const box = await previous().boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(await managerPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

    // Keyboard: Tab reaches the buttons and Enter activates Previous.
    await previous().focus();
    await managerPage.keyboard.press("Enter");
    await expect(managerPage).toHaveURL(/cpage=9/);
    await managerPage.setViewportSize({ width: 1280, height: 720 });
  });
});
