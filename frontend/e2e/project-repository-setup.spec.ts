import { test, expect, type Page, type Route } from "@playwright/test";
import { api } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";

/**
 * Connecting a GitHub repository: optionally while creating the project, later in the project settings. Covers the
 * Basit / Gelişmiş choice with its (i) explanation, the notification switch, the "Depo" sidebar item that only exists
 * while a repository is connected, the one-line repository strip on the overview and the team question after creating.
 * Projects, membership and sessions are real; the GitHub-backed repository endpoints are answered by a small stateful
 * `page.route` (connect / change / disconnect) and the project home is patched with the same state, so nothing calls
 * GitHub and the result is deterministic.
 */
const sha = (n: number) => String(n).padStart(40, "0");
const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const COMMIT = {
  sha: sha(101),
  shortSha: sha(101).slice(0, 7),
  message: "Fix login redirect",
  author: "Bob Dev",
  authorLogin: "bob",
  authorAvatarUrl: null,
  committedAt: iso(5),
  commitUrl: `https://github.com/octocat/demo-repo/commit/${sha(101)}`,
};
const REPOSITORY_URL = "https://github.com/octocat/demo-repo";

type Settings = { trackingMode: "BASIC" | "ADVANCED"; notifyOnCommits: boolean };
type RepositoryMock = { repo: Settings | null; posts: unknown[]; patches: unknown[]; deletes: number };

/** Installs the stateful repository + home routes on a page and returns the state they read and write. */
async function mockRepository(page: Page): Promise<RepositoryMock> {
  const state: RepositoryMock = { repo: null, posts: [], patches: [], deletes: 0 };
  const cors = { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" };
  const connection = () => ({
    provider: "GITHUB",
    repositoryUrl: REPOSITORY_URL,
    repositoryOwner: "octocat",
    repositoryName: "demo-repo",
    defaultBranch: "main",
    ...state.repo,
    connectedBy: "someone",
    connectedAt: iso(600),
    updatedAt: iso(600),
  });

  await page.route("**/api/v1/projects/*/repository**", async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS", "access-control-allow-headers": "*" } });
      return;
    }
    if (method === "POST") {
      state.posts.push(request.postDataJSON());
      const { trackingMode, notifyOnCommits } = request.postDataJSON() as Settings;
      state.repo = { trackingMode, notifyOnCommits };
      return json(connection(), 201);
    }
    if (method === "PATCH") {
      state.patches.push(request.postDataJSON());
      const { trackingMode, notifyOnCommits } = request.postDataJSON() as Settings;
      state.repo = { trackingMode, notifyOnCommits };
      return json(connection());
    }
    if (method === "DELETE") {
      state.deletes += 1;
      state.repo = null;
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (!state.repo) return json({ status: 404, title: "Not Found", code: "REPOSITORY_NOT_CONNECTED" }, 404);
    if (url.pathname.endsWith("/repository/branches")) {
      return json({ branches: [{ name: "main", isDefault: true, isProtected: true, headShortSha: "0000101" }], truncated: false });
    }
    if (url.pathname.endsWith("/repository/commits")) return json([COMMIT]);
    if (url.pathname.endsWith("/repository/compare")) {
      return json({ base: "main", branch: "main", aheadBy: 0, behindBy: 0, unmergedCommits: [], truncated: false });
    }
    return json(connection());
  });

  // The project home decides the sidebar item and the overview strip; keep it in step with the mocked connection.
  await page.route("**/api/v1/projects/*/home", async (route: Route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    body.repository = state.repo
      ? {
          connected: true,
          provider: "GITHUB",
          repositoryOwner: "octocat",
          repositoryName: "demo-repo",
          defaultBranch: "main",
          trackingMode: state.repo.trackingMode,
          notifyOnCommits: state.repo.notifyOnCommits,
          lastCommit: { shortSha: COMMIT.shortSha, message: COMMIT.message, author: COMMIT.author, authorAvatarUrl: null, committedAt: COMMIT.committedAt, commitUrl: COMMIT.commitUrl },
          githubUnavailable: false,
        }
      : { connected: false, provider: null, repositoryOwner: null, repositoryName: null, defaultBranch: null, trackingMode: null, notifyOnCommits: false, lastCommit: null, githubUnavailable: false };
    await route.fulfill({ response, json: body });
  });
  return state;
}

async function fillCreateForm(page: Page, name: string) {
  await page.goto("/projects/new");
  await page.locator("#project-name").fill(name);
  await page.getByRole("radio", { name: /^Web/ }).click();
}

test.describe.serial("Project repository setup", () => {
  let managerPage: Page;
  let memberPage: Page;
  let slug: string;
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    managerPage = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    memberPage = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
    await managerPage.goto("/tr/projeler");
    const created = await api(managerPage, "POST", "/projects", { name: `E2E Repo Setup ${Date.now()}`, projectType: "WEB" });
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

  test("a project is created without a repository and the team question leads to the project page on Hayır", async () => {
    const mock = await mockRepository(managerPage);
    await fillCreateForm(managerPage, `E2E No Repo ${Date.now()}`);
    await expect(managerPage.getByRole("radio", { name: /Gelişmiş/ })).toHaveCount(0);
    await managerPage.getByRole("button", { name: /^Projeyi oluştur$/ }).click();

    const dialog = managerPage.getByRole("dialog").filter({ hasText: "Henüz bir proje ekibiniz yok. Şimdi ekip oluşturmak ister misiniz?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Hayır", exact: true }).click();
    await expect(managerPage).toHaveURL(/\/tr\/projeler\/(?!yeni$)[^/]+$/, { timeout: 15_000 });
    expect(mock.posts).toHaveLength(0);
    // No repository: the sidebar has no "Depo" item.
    await expect(managerPage.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("button", { name: "Ekipler", exact: true })).toBeVisible();
    await expect(managerPage.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Depo" })).toHaveCount(0);
    await managerPage.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("the create form validates the repository address and sends the chosen mode and notification setting", async () => {
    const mock = await mockRepository(managerPage);
    await fillCreateForm(managerPage, `E2E With Repo ${Date.now()}`);
    await managerPage.locator("#project-repository-url").fill("https://example.com/not-github");
    await managerPage.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
    await expect(managerPage.getByText("Genel bir GitHub depo URL'si girin")).toBeVisible();
    await expect(managerPage).toHaveURL(/\/projects\/new|\/projeler\/yeni/);
    expect(mock.posts).toHaveLength(0);

    await managerPage.locator("#project-repository-url").fill(REPOSITORY_URL);
    // Defaults: Basit, notifications on. Choose Gelişmiş and switch the notifications off.
    await expect(managerPage.getByRole("radio", { name: /Basit/ })).toBeChecked();
    const notify = managerPage.getByRole("switch", { name: /Yeni commit'lerde üyelere bildirim gönder/ });
    await expect(notify).toBeChecked();
    await managerPage.getByRole("radio", { name: /Gelişmiş/ }).check();
    await notify.click();
    await expect(notify).not.toBeChecked();

    await managerPage.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
    const dialog = managerPage.getByRole("dialog").filter({ hasText: "Henüz bir proje ekibiniz yok" });
    await expect(dialog).toBeVisible();
    expect(mock.posts).toEqual([{ repositoryUrl: REPOSITORY_URL, trackingMode: "ADVANCED", notifyOnCommits: false }]);

    // Evet opens the full-page team form of the new project.
    await dialog.getByRole("button", { name: "Evet", exact: true }).click();
    await expect(managerPage).toHaveURL(/\/projeler\/[^/]+\/ekipler\/yeni-ekip$/, { timeout: 15_000 });
    await managerPage.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("the (i) button explains both modes", async () => {
    await mockRepository(managerPage);
    await managerPage.goto(`/projects/${slug}?section=settings`);
    const section = managerPage.locator("section").filter({ has: managerPage.getByRole("heading", { name: "GitHub deposu", exact: true }) });
    await section.getByRole("button", { name: "Basit ve Gelişmiş mod farkını göster" }).click();
    const dialog = managerPage.getByRole("dialog", { name: "Basit ve Gelişmiş mod" });
    await expect(dialog.getByText("yalnız ana dalın commit listesi gösterilir", { exact: false })).toBeVisible();
    await expect(dialog.getByText("merge edilen veya edilmeyen tüm commit'leri ve her commit'i kimin attığını", { exact: false })).toBeVisible();
    await expect(dialog.getByText("yalnız ana dal içindir", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Kapat", exact: true }).first().click();
    await expect(dialog).toBeHidden();
    await managerPage.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("a repository is connected, changed and disconnected from the project settings; the sidebar follows", async () => {
    const mock = await mockRepository(managerPage);
    const nav = managerPage.getByRole("navigation", { name: "Gezinme menüsü" });
    await managerPage.goto(`/projects/${slug}?section=settings`);
    await expect(nav.getByRole("button", { name: "Ekipler", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Depo" })).toHaveCount(0);

    // Connect with the defaults (Basit, notifications on).
    const section = managerPage.locator("section").filter({ has: managerPage.getByRole("heading", { name: "GitHub deposu", exact: true }) });
    await section.locator("#settings-repository-url").fill("https://github.com/octocat/");
    await section.getByRole("button", { name: /^Depo bağla$/ }).click();
    await expect(section.getByText("Genel bir GitHub depo URL'si girin")).toBeVisible();
    expect(mock.posts).toHaveLength(0);
    await section.locator("#settings-repository-url").fill(REPOSITORY_URL);
    await section.getByRole("button", { name: /^Depo bağla$/ }).click();
    await expect(managerPage.getByText("Depo bağlandı.")).toBeVisible();
    expect(mock.posts).toEqual([{ repositoryUrl: REPOSITORY_URL, trackingMode: "BASIC", notifyOnCommits: true }]);
    await expect(nav.getByRole("link", { name: "Depo" })).toBeVisible();

    // Change the mode: the save button is only enabled once something differs, and sends a PATCH.
    const save = section.getByRole("button", { name: /^Kaydet$/ });
    await expect(save).toBeDisabled();
    await section.getByRole("radio", { name: /Gelişmiş/ }).check();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(managerPage.getByText("Depo ayarları kaydedildi.")).toBeVisible();
    expect(mock.patches).toEqual([{ trackingMode: "ADVANCED", notifyOnCommits: true }]);

    // The repository page now offers Özet and Dallar and shows the mode.
    await nav.getByRole("link", { name: "Depo" }).click();
    await expect(managerPage.getByRole("tab", { name: "Özet" })).toBeVisible();
    await expect(managerPage.getByRole("tab", { name: "Dallar" })).toBeVisible();
    await expect(managerPage.getByText("Gelişmiş", { exact: true })).toBeVisible();

    // Back to Basit and notifications off: no tabs any more, the page says notifications are off.
    await managerPage.goto(`/projects/${slug}?section=settings`);
    await section.getByRole("radio", { name: /Basit/ }).check();
    await section.getByRole("switch", { name: /Yeni commit'lerde üyelere bildirim gönder/ }).click();
    await section.getByRole("button", { name: /^Kaydet$/ }).click();
    await expect(managerPage.getByText("Depo ayarları kaydedildi.")).toBeVisible();
    expect(mock.patches.at(-1)).toEqual({ trackingMode: "BASIC", notifyOnCommits: false });
    await section.getByRole("link", { name: "Depo sayfasını aç" }).click();
    await expect(managerPage.getByRole("heading", { name: "main dalındaki son commit'ler" })).toBeVisible();
    await expect(managerPage.getByRole("tab")).toHaveCount(0);

    // Disconnect (confirmed in a dialog): the sidebar item disappears again.
    await managerPage.goto(`/projects/${slug}?section=settings`);
    await section.getByRole("button", { name: "Bağlantıyı kes" }).click();
    await managerPage.getByRole("alertdialog").or(managerPage.getByRole("dialog")).getByRole("button", { name: "Bağlantıyı kes" }).click();
    await expect(managerPage.getByText("Depo bağlantısı kesildi.")).toBeVisible();
    expect(mock.deletes).toBe(1);
    await expect(nav.getByRole("link", { name: "Depo" })).toHaveCount(0);
    await expect(section.getByRole("button", { name: /^Depo bağla$/ })).toBeVisible();
    await managerPage.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("the overview shows the one-line repository strip with the last commit and its author", async () => {
    const mock = await mockRepository(managerPage);
    mock.repo = { trackingMode: "ADVANCED", notifyOnCommits: true };
    await managerPage.goto(`/projects/${slug}`);
    const strip = managerPage.getByRole("region", { name: "Depo takibi" });
    await expect(strip).toBeVisible();
    await expect(strip.getByText("octocat/demo-repo")).toBeVisible();
    await expect(strip.getByText("Fix login redirect")).toBeVisible();
    await expect(strip.getByText("Bob Dev gönderdi")).toBeVisible();

    await managerPage.setViewportSize({ width: 390, height: 844 });
    await managerPage.reload();
    await expect(strip).toBeVisible();
    const overflow = await managerPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await managerPage.setViewportSize({ width: 1280, height: 720 });
    await managerPage.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("a member sees the repository but has no settings to manage it", async () => {
    const mock = await mockRepository(memberPage);
    const nav = memberPage.getByRole("navigation", { name: "Gezinme menüsü" });

    // Not connected: no sidebar item, and the repository section only explains that nothing is connected.
    await memberPage.goto(`/projects/${slug}`);
    await expect(nav.getByRole("button", { name: "Ekipler", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Depo" })).toHaveCount(0);

    mock.repo = { trackingMode: "BASIC", notifyOnCommits: true };
    await memberPage.reload();
    await expect(nav.getByRole("link", { name: "Depo" })).toBeVisible();
    await expect(memberPage.getByRole("region", { name: "Depo takibi" })).toBeVisible();

    await memberPage.goto(`/projects/${slug}?section=settings`);
    await expect(memberPage.getByRole("heading", { name: "GitHub deposu", exact: true })).toHaveCount(0);
    await memberPage.goto(`/projects/${slug}?section=repository`);
    await expect(memberPage.getByRole("heading", { name: "main dalındaki son commit'ler" })).toBeVisible();
    await expect(memberPage.getByRole("link", { name: "Depo ayarları" })).toHaveCount(0);
    await expect(memberPage.getByRole("button", { name: "Bağlantıyı kes" })).toHaveCount(0);
    await memberPage.unrouteAll({ behavior: "ignoreErrors" });
  });
});
