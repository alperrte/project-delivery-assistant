import { test, expect, type Page, type Route } from "@playwright/test";
import { api } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

/**
 * Repository management page: Overview / Branches views, branch selection kept in the URL, ahead/behind summary,
 * merged / not-merged filter, author strip + author filter, "load more", GitHub failure states and the notification
 * for new commits. The project, membership and notifications are real; only the GitHub-backed repository endpoints
 * are answered by `page.route` so the content is deterministic and no external service is called.
 */
const sha = (n: number) => String(n).padStart(40, "0");
const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

function commit(n: number, login: "alice" | "bob") {
  return {
    sha: sha(n),
    shortSha: sha(n).slice(0, 7),
    message: `Commit number ${n}`,
    author: login === "alice" ? "Alice Dev" : "Bob Dev",
    authorLogin: login,
    authorAvatarUrl: null,
    committedAt: iso(n),
    commitUrl: `https://github.com/octocat/demo-repo/commit/${sha(n)}`,
  };
}

// 35 commits on the feature branch, newest first: alice 1-20, bob 21-35. The three newest are not on main yet.
const FEATURE = Array.from({ length: 35 }, (_, i) => commit(i + 1, i < 20 ? "alice" : "bob"));
const MAIN = [101, 102, 103].map((n) => commit(n, "bob"));
const UNMERGED = FEATURE.slice(0, 3);

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
    { name: "release/1.0", isDefault: false, isProtected: false, headShortSha: "0000050" },
  ],
  truncated: false,
};

type Mode = { failCompare?: number; failCommits?: number; trackingMode?: "BASIC" | "ADVANCED" };

/** Answers the repository GET endpoints (including the CORS preflight the cross-origin API call may trigger). */
async function mockRepository(page: Page, mode: Mode = {}) {
  const cors = { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" };
  await page.route("**/api/v1/projects/*/repository**", async (route: Route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS", "access-control-allow-headers": "*" } });
      return;
    }
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

    if (url.pathname.endsWith("/repository/branches")) return json(BRANCHES);
    if (url.pathname.endsWith("/repository/compare")) {
      if (mode.failCompare) return json({ status: mode.failCompare, detail: "GitHub" }, mode.failCompare);
      return json({ base: "main", branch: url.searchParams.get("branch"), aheadBy: 3, behindBy: 2, unmergedCommits: UNMERGED, truncated: false });
    }
    if (url.pathname.endsWith("/repository/commits")) {
      if (mode.failCommits) return json({ status: mode.failCommits, detail: "GitHub" }, mode.failCommits);
      const branch = url.searchParams.get("branch");
      const author = url.searchParams.get("author");
      const limit = Number(url.searchParams.get("limit") ?? 10);
      const pageNo = Number(url.searchParams.get("page") ?? 1);
      let list = branch === "feature/login" ? FEATURE : branch && branch !== "main" ? [] : MAIN;
      if (author) list = list.filter((item) => item.authorLogin === author);
      return json(list.slice((pageNo - 1) * limit, pageNo * limit));
    }
    return json({ ...CONNECTION, trackingMode: mode.trackingMode ?? "ADVANCED" });
  });
}

test.describe.serial("Repository management", () => {
  let managerPage: Page;
  let memberPage: Page;
  let slug: string;
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    managerPage = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    memberPage = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
    await managerPage.goto("/tr/projeler");
    const created = await api(managerPage, "POST", "/projects", { name: `E2E Repo ${Date.now()}`, projectType: "WEB" });
    expect(created.status).toBe(201);
    ({ id: projectId, slug } = created.json as { id: string; slug: string });
    const team = await api(managerPage, "POST", `/projects/${projectId}/teams`, { name: "Core", includeCreator: true });
    expect(team.status).toBe(201);

    await memberPage.goto("/tr/projeler");
    const me = (await api(memberPage, "GET", "/auth/me")).json as { id: string };
    const invite = await api(managerPage, "POST", `/projects/${projectId}/invitations`, {
      userId: me.id,
      roles: ["FRONTEND_DEVELOPER"],
      teamId: (team.json as { id: string }).id,
    });
    expect(invite.status).toBe(201);
    const { invitationId, token } = invite.json as { invitationId: string; token: string };
    expect((await api(memberPage, "POST", `/projects/${projectId}/invitations/${invitationId}/accept`, { token })).status).toBe(200);
  });

  test.afterAll(async () => {
    await api(managerPage, "POST", `/projects/${projectId}/archive`).catch(() => undefined);
    await managerPage.close();
    await memberPage.close();
  });

  test("overview lists the latest default-branch commits and leads to the branch view", async () => {
    await mockRepository(managerPage);
    await managerPage.goto(`/projects/${slug}?section=repository`);
    await expect(managerPage.getByRole("heading", { name: "main dalındaki son commit'ler" })).toBeVisible();
    await expect(managerPage.getByText("Commit number 101")).toBeVisible();
    await expect(managerPage.getByText("3 dal")).toBeVisible();
    await expect(managerPage.getByText(/Varsayılan dal: main/)).toBeVisible();
    await expect(managerPage.getByRole("link", { name: /octocat\/demo-repo/ })).toHaveAttribute("href", "https://github.com/octocat/demo-repo");

    await managerPage.getByRole("button", { name: "Dalları incele" }).click();
    await expect(managerPage).toHaveURL(/view=branches/);
    await expect(managerPage.getByRole("list", { name: "Dallar" }).getByRole("button", { name: /feature\/login/ })).toBeVisible();
  });

  test("selecting a branch shows ahead/behind, merge badges, filters, authors and load more", async () => {
    await managerPage.getByRole("list", { name: "Dallar" }).getByRole("button", { name: /feature\/login/ }).click();
    await expect(managerPage).toHaveURL(/branch=feature%2Flogin/);
    await expect(managerPage.getByTestId("branch-status")).toContainText("main dalının 3 commit ilerisinde, 2 commit gerisinde.");

    const list = managerPage.getByTestId("branch-commits");
    await expect(list.getByRole("listitem")).toHaveCount(30);
    await expect(list.getByText("Birleşmedi", { exact: true })).toHaveCount(3);
    await expect(list.getByText("Ana dalda", { exact: true })).toHaveCount(27);

    await managerPage.getByRole("button", { name: "Ana dala girmemiş" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await managerPage.getByRole("button", { name: "Ana dala girmiş" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(27);
    await managerPage.getByRole("button", { name: "Tümü" }).click();

    await managerPage.getByRole("button", { name: "Daha fazla yükle" }).click();
    await expect(list.getByRole("listitem")).toHaveCount(35);
    await expect(managerPage.getByRole("button", { name: "Daha fazla yükle" })).toHaveCount(0);

    // The author strip is built from the loaded commits and filters from the server.
    const alice = managerPage.getByRole("button", { name: /Alice Dev/ });
    await expect(alice).toContainText("20 commit");
    await expect(managerPage.getByRole("button", { name: /Bob Dev/ })).toContainText("15 commit");
    await alice.click();
    await expect(alice).toHaveAttribute("aria-pressed", "true");
    await expect(managerPage.getByRole("heading", { name: "alice commit'leri" })).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveCount(20);
    await alice.click();
    await expect(list.getByRole("listitem")).toHaveCount(35);
  });

  test("the selected branch survives a reload and an unknown branch falls back with a notice", async () => {
    await managerPage.reload();
    await expect(managerPage.getByTestId("branch-status")).toContainText("3 commit ilerisinde");
    await managerPage.goto(`/projects/${slug}?section=repository&view=branches&branch=gone`);
    await expect(managerPage.getByRole("alert").getByText("Dal bulunamadı")).toBeVisible();
    await managerPage.getByRole("button", { name: "main dalına dön" }).click();
    await expect(managerPage.getByText("Bu, deponun varsayılan (ana) dalıdır.")).toBeVisible();
  });

  test("a GitHub rate limit and an outage are explained and can be retried", async () => {
    await managerPage.unrouteAll({ behavior: "ignoreErrors" });
    await mockRepository(managerPage, { failCompare: 429 });
    await managerPage.goto(`/projects/${slug}?section=repository&view=branches&branch=feature%2Flogin`);
    await expect(managerPage.getByText("GitHub çok fazla istek aldı")).toBeVisible();

    await managerPage.unrouteAll({ behavior: "ignoreErrors" });
    await mockRepository(managerPage, { failCommits: 503 });
    await managerPage.goto(`/projects/${slug}?section=repository`);
    await expect(managerPage.getByText("GitHub şu anda yanıt vermiyor")).toBeVisible();
    await managerPage.unrouteAll({ behavior: "ignoreErrors" });
    await mockRepository(managerPage);
    await managerPage.getByRole("button", { name: "Tekrar dene" }).first().click();
    await expect(managerPage.getByText("Commit number 101")).toBeVisible();
  });

  test("repository settings and disconnecting live in the project settings and only for a project manager", async () => {
    await mockRepository(managerPage);
    await managerPage.goto(`/projects/${slug}?section=repository`);
    await expect(managerPage.getByRole("link", { name: "Depo ayarları" })).toBeVisible();
    await expect(managerPage.getByRole("button", { name: "Bağlantıyı kes" })).toHaveCount(0);

    await managerPage.goto(`/projects/${slug}?section=settings`);
    const section = managerPage.locator("section").filter({ has: managerPage.getByRole("heading", { name: "GitHub deposu", exact: true }) });
    await expect(section.getByRole("button", { name: "Bağlantıyı kes" })).toBeVisible();
    await expect(section.getByRole("radio", { name: /Gelişmiş/ })).toBeChecked();

    await mockRepository(memberPage);
    await memberPage.goto(`/projects/${slug}?section=repository`);
    await expect(memberPage.getByRole("heading", { name: "main dalındaki son commit'ler" })).toBeVisible();
    await expect(memberPage.getByRole("link", { name: "Depo ayarları" })).toHaveCount(0);
    await expect(memberPage.getByRole("button", { name: "Bağlantıyı kes" })).toHaveCount(0);
    await expect(memberPage.getByRole("button", { name: "Depo bağla" })).toHaveCount(0);
  });

  test("the basic mode shows only the default branch commits, without the overview and branches tabs", async () => {
    await managerPage.unrouteAll({ behavior: "ignoreErrors" });
    await mockRepository(managerPage, { trackingMode: "BASIC" });
    await managerPage.goto(`/projects/${slug}?section=repository&view=branches&branch=feature%2Flogin`);
    await expect(managerPage.getByRole("heading", { name: "main dalındaki son commit'ler" })).toBeVisible();
    await expect(managerPage.getByText("Commit number 101")).toBeVisible();
    await expect(managerPage.getByText("Basit", { exact: true })).toBeVisible();
    await expect(managerPage.getByRole("tab")).toHaveCount(0);
    await expect(managerPage.getByRole("button", { name: "Dalları incele" })).toHaveCount(0);
    await expect(managerPage.getByText("3 dal")).toHaveCount(0);
    await managerPage.unrouteAll({ behavior: "ignoreErrors" });
    await mockRepository(managerPage);
  });

  test("the branch view fits a 390 px wide screen", async () => {
    await managerPage.setViewportSize({ width: 390, height: 844 });
    await managerPage.goto(`/projects/${slug}?section=repository&view=branches&branch=feature%2Flogin`);
    await expect(managerPage.getByTestId("branch-commits").getByRole("listitem").first()).toBeVisible();
    const overflow = await managerPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await managerPage.setViewportSize({ width: 1280, height: 720 });
  });

  test("new commits show up as a notification that links to the repository page", async () => {
    await managerPage.route("**/api/v1/notifications?**", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" },
        body: JSON.stringify({
          content: [{
            id: "00000000-0000-4000-8000-000000000042",
            type: "REPOSITORY_COMMITS_PUSHED",
            title: "ignored",
            message: "ignored",
            read: false,
            createdAt: iso(2),
            readAt: null,
            actorUserId: null,
            projectId,
            resourceType: "PROJECT",
            resourceId: projectId,
            repositoryCommits: {
              projectName: "E2E Repo",
              repositoryFullName: "octocat/demo-repo",
              branch: "main",
              commitCount: 3,
              truncated: false,
              headMessage: "Fix login redirect",
              headAuthor: "Alice Dev",
            },
          }],
          page: 0, size: 20, totalElements: 1, totalPages: 1,
        }),
      });
    });
    await managerPage.goto(`/projects/${slug}`);
    await managerPage.mouse.move(20, 2);
    await managerPage.getByRole("button", { name: "Bildirimler", exact: true }).click();
    const panel = managerPage.getByRole("dialog", { name: "Bildirimler", exact: true });
    await expect(panel.getByRole("heading", { name: "Depoya yeni commit geldi" })).toBeVisible();
    await expect(panel).toContainText("octocat/demo-repo deposunun main dalına 3 yeni commit geldi.");
    await expect(panel).toContainText("Son commit: Fix login redirect (Alice Dev)");

    await panel.getByRole("link", { name: "Depoyu aç" }).click();
    await expect(managerPage).toHaveURL(new RegExp(`/projeler/${slug}\\?section=repository|/projects/${slug}\\?section=repository`));
  });
});
