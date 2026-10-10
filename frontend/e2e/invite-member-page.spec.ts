import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { MANAGER_STORAGE, MEMBER_STORAGE, MEMBER_USER_FILE } from "./global-setup";
import { api, createProject } from "./helpers";
import { PROJECT_ROLES } from "../src/features/projects/types";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

test.use({ storageState: MANAGER_STORAGE });

// "Üye davet et" is a full page (not a dialog): its own localized URL below the (virtual) team-invitations section, an
// optional `?team=` that fixes the team and decides where success returns to, the team form standard (first invalid field
// focus + summary), and the server stays the authority (foreign team 404, duplicate 409, manager-only).
// Invitation creation is rate limited to 10 per 10 minutes per IP and project path, so this file stays well under it.

type Team = { id: string; name: string };
type PendingInvitation = { id: string; nickname?: string | null; email?: string | null; initialRoles: string[] };

const addMember = tr.squads.addMember;
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe.serial("Üye davet et sayfası", () => {
  let page: Page;
  let member: Page;
  let slug: string;
  let projectId: string;
  let projectName: string;
  let teamB: Team;
  let foreignTeam: Team;
  let foreignProjectId: string;
  let memberNickname: string;
  let memberEmail: string;
  let memberId: string;
  let memberInvitation: { invitationId: string; token: string };
  const emailBase = `e2e-invite-page-${Date.now()}`;

  const pageUrl = () => `/tr/projeler/${slug}/ekip-davetleri/yeni`;
  const listUrl = () => `/tr/projeler/${slug}/ekip-davetleri`;
  const send = () => page.getByRole("button", { name: tr.invitations.send, exact: true });
  const summary = () => page.getByRole("alert").filter({ hasText: tr.forms.summary.memberInviteTitle });
  const teamSelect = () => page.getByRole("combobox", { name: addMember.team, exact: true });
  const pending = async (): Promise<PendingInvitation[]> =>
    ((await api(page, "GET", `/projects/${projectId}/invitations/all?status=PENDING&size=50`)).json as { content: PendingInvitation[] }).content;

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    projectName = `Üye Davet Sayfası ${Date.now()}`;
    slug = await createProject(page, projectName);
    projectId = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    expect((await api(page, "POST", `/projects/${projectId}/teams`, { name: "Ekip A", includeCreator: true })).status).toBe(201);
    teamB = (await api(page, "POST", `/projects/${projectId}/teams`, { name: "Ekip B", includeCreator: true })).json as Team;

    // A team of another project: this project's server must refuse it.
    const other = (await api(page, "POST", "/projects", { name: `Yabancı Ekip Projesi ${Date.now()}`, projectType: "WEB" })).json as { id: string };
    foreignProjectId = other.id;
    foreignTeam = (await api(page, "POST", `/projects/${foreignProjectId}/teams`, { name: "Yabancı ekip", includeCreator: true })).json as Team;

    member = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
    await member.goto("/projects");
    memberId = ((await api(member, "GET", "/auth/me")).json as { id: string }).id;
    const memberUser = JSON.parse(readFileSync(MEMBER_USER_FILE, "utf-8")) as { nickname: string; email: string };
    memberNickname = memberUser.nickname;
    memberEmail = memberUser.email;
  });

  test.afterAll(async () => {
    expect((await api(page, "DELETE", `/projects/${projectId}`)).status).toBe(204);
    expect((await api(page, "DELETE", `/projects/${foreignProjectId}`)).status).toBe(204);
    await page.context().close();
    await member.context().close();
  });

  test("Ekip Davetleri'ndeki bağlantı tam sayfa açar; konum, kenar çubuğu ve geri/ileri doğru çalışır", async () => {
    await page.goto(`/projects/${slug}?section=invitations`);
    await page.getByRole("link", { name: tr.invitations.invite, exact: true }).click();

    await expect(page).toHaveURL(pageUrl());
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: addMember.title, exact: true })).toBeVisible();
    await expect(page.locator("[data-sticky-actions]")).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`${tr.pageTitles.memberInvite} · PDA$`));
    // No team hint: the page asks for the team.
    await expect(teamSelect()).toBeVisible();

    const trail = page.getByRole("navigation", { name: tr.common.breadcrumb });
    await expect(trail.getByRole("listitem")).toHaveText([tr.pageTitles.projects, projectName, tr.projects.detail.tabs.invitations, tr.pageTitles.memberInvite]);
    await expect(trail.getByRole("link", { name: tr.projects.detail.tabs.invitations })).toHaveAttribute("href", listUrl());
    // The virtual section stays the highlighted sidebar item.
    await expect(page.locator(`a[aria-label="${tr.projects.detail.tabs.invitations}"]`)).toHaveAttribute("aria-current", "page");

    await page.goBack();
    await expect(page).toHaveURL(listUrl());
    await page.goForward();
    await expect(page).toHaveURL(pageUrl());

    // Cancel goes back to the list (no team hint).
    await page.getByRole("link", { name: addMember.cancel, exact: true }).click();
    await expect(page).toHaveURL(listUrl());
  });

  test("boş gönderim ilk geçersiz alana odaklanır ve özet gösterir; geçerli davet oluşur ve listeye dönülür", async () => {
    await page.goto(pageUrl());
    let posts = 0;
    page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith(`/projects/${projectId}/invitations`)) posts++; });

    await send().click();
    await expect(teamSelect()).toBeFocused();
    await expect(teamSelect()).toHaveAttribute("aria-invalid", "true");
    await expect(summary()).toBeVisible();
    await expect(summary().getByRole("button")).toHaveText([addMember.sections.team.title, addMember.sections.roles.title]);
    // The summary links move focus to that section's first invalid field.
    await summary().getByRole("button", { name: addMember.sections.roles.title }).click();
    await expect(page.getByRole("checkbox").first()).toBeFocused();
    expect(posts).toBe(0);

    await teamSelect().click();
    await page.getByRole("option", { name: "Ekip A", exact: true }).click();
    await send().click();
    await expect(page.getByLabel(addMember.searchLabel, { exact: true })).toBeFocused();
    await expect(page.getByRole("alert").filter({ hasText: addMember.errors.personRequired })).toBeVisible();
    expect(posts).toBe(0);

    await page.getByLabel(addMember.searchLabel, { exact: true }).fill(memberNickname);
    await page.getByRole("button", { name: new RegExp(`${memberNickname} kişisini ekibe davet et`) }).click();
    await page.getByRole("checkbox", { name: tr.roles[PROJECT_ROLES[2]], exact: true }).check();
    await page.getByLabel(tr.invitations.message, { exact: true }).fill("Ekibe hoş geldin.");
    await expect(summary()).toHaveCount(0);

    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith(`/projects/${projectId}/invitations`) && res.request().method() === "POST"),
      send().click(),
    ]);
    expect(response.status()).toBe(201);
    memberInvitation = await response.json() as { invitationId: string; token: string };

    await expect(page).toHaveURL(listUrl());
    await expect(page.getByText(tr.invitations.sent)).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: memberNickname })).toBeVisible();
    const created = (await pending()).find((invitation) => invitation.nickname === memberNickname);
    expect(created?.initialRoles).toEqual([PROJECT_ROLES[2]]);
  });

  test("ekip sayfasından gelince ekip kilitlidir; e-posta ile dış davet oluşur, aynı adres tekrar 409 verir ve sayfada kalır", async () => {
    await page.goto(`/projects/${slug}/teams/${teamB.id}`);
    await page.getByRole("link", { name: addMember.button, exact: true }).first().click();
    await expect(page).toHaveURL(`${pageUrl()}?team=${teamB.id}`);
    await expect(teamSelect()).toHaveCount(0);
    await expect(page.getByTestId("locked-team")).toHaveText("Ekip B");

    const email = `${emailBase}-ext@example.test`;
    const fillExternal = async () => {
      await page.getByRole("tab", { name: addMember.modeEmail, exact: true }).click();
      await page.getByLabel(tr.invitations.firstName, { exact: true }).fill("Çağrı");
      await page.getByLabel(tr.invitations.lastName, { exact: true }).fill("Şahin");
      await page.getByLabel(tr.invitations.email, { exact: true }).fill(email);
      await page.getByRole("checkbox", { name: tr.roles[PROJECT_ROLES[6]], exact: true }).check();
    };
    await fillExternal();
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith(`/projects/${projectId}/invitations`) && res.request().method() === "POST"),
      send().click(),
    ]);
    expect(response.status()).toBe(201);
    // Success returns to the team the page was opened from.
    await expect(page).toHaveURL(`/tr/projeler/${slug}/ekipler/${teamB.id}`);
    expect((await pending()).filter((invitation) => invitation.email === email)).toHaveLength(1);

    // The same address again: the server refuses, the message stays on the page and nothing is created twice.
    await page.goto(`${pageUrl()}?team=${teamB.id}`);
    await fillExternal();
    const [duplicate] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith(`/projects/${projectId}/invitations`) && res.request().method() === "POST"),
      send().click(),
    ]);
    expect(duplicate.status()).toBe(409);
    await expect(page.getByRole("alert").filter({ hasText: tr.errors.invitationAlreadyPending })).toBeVisible();
    await expect(page.getByText(tr.errors.conflict, { exact: true })).toHaveCount(0);
    await expect(page.getByText("son yönetici")).toHaveCount(0);
    await expect(page).toHaveURL(`${pageUrl()}?team=${teamB.id}`);
    expect((await pending()).filter((invitation) => invitation.email === email)).toHaveLength(1);

    // The back link returns to the team it was opened from.
    await page.getByRole("link", { name: addMember.backToTeam, exact: true }).click();
    await expect(page).toHaveURL(`/tr/projeler/${slug}/ekipler/${teamB.id}`);
  });

  test("projedeki biri için 'Ekibe ekle' anında ekler; sayfada kalır ve satır 'Ekipte' olur", async () => {
    // The invited user accepts (API), which makes them a project member (in Ekip A only).
    expect((await api(member, "POST", `/projects/${projectId}/invitations/${memberInvitation.invitationId}/accept`, { token: memberInvitation.token })).status).toBe(200);

    await page.goto(`${pageUrl()}?team=${teamB.id}`);
    await page.getByLabel(addMember.searchLabel, { exact: true }).fill(memberNickname);
    const results = page.getByRole("list", { name: addMember.results, exact: true });
    let posts = 0;
    page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith(`/projects/${projectId}/invitations`)) posts++; });
    const [added] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith(`/teams/${teamB.id}/members`) && res.request().method() === "POST"),
      page.getByRole("button", { name: new RegExp(`${memberNickname} kişisini ekibe ekle`) }).click(),
    ]);
    expect(added.status()).toBe(201);
    await expect(page.getByText(addMember.added)).toBeVisible();
    await expect(results.getByText(addMember.inTeam, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${pageUrl()}?team=${teamB.id}`);
    expect(posts).toBe(0);

    const members = (await api(page, "GET", `/projects/${projectId}/teams/${teamB.id}/members`)).json as { content: { userId: string }[] };
    expect(members.content.map((item) => item.userId)).toContain(memberId);
  });

  test("zaten üye olan birinin e-postasıyla davet 409 verir ve 'zaten projenin üyesi' mesajı gösterilir", async () => {
    await page.goto(`${pageUrl()}?team=${teamB.id}`);
    await page.getByRole("tab", { name: addMember.modeEmail, exact: true }).click();
    await page.getByLabel(tr.invitations.firstName, { exact: true }).fill("Zaten");
    await page.getByLabel(tr.invitations.lastName, { exact: true }).fill("Üye");
    await page.getByLabel(tr.invitations.email, { exact: true }).fill(memberEmail);
    await page.getByRole("checkbox", { name: tr.roles[PROJECT_ROLES[6]], exact: true }).check();
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith(`/projects/${projectId}/invitations`) && res.request().method() === "POST"),
      send().click(),
    ]);
    expect(response.status()).toBe(409);
    expect((await response.json()).code).toBe("INVITATION_TARGET_ALREADY_MEMBER");
    await expect(page.getByRole("alert").filter({ hasText: tr.errors.invitationTargetAlreadyMember })).toBeVisible();
    await expect(page.getByText(tr.errors.conflict, { exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(`${pageUrl()}?team=${teamB.id}`);
  });

  test("proje yöneticisi olmayan üye yetkisiz durumu görür", async () => {
    await member.goto(`/projects/${slug}/team-invitations/new`);
    await expect(member.getByRole("alert").filter({ hasText: tr.errors.forbidden })).toBeVisible();
    await expect(member.getByRole("button", { name: tr.invitations.send, exact: true })).toHaveCount(0);
    await expect(member.getByRole("link", { name: tr.squads.detail.backToTeams, exact: true })).toBeVisible();
  });

  test("başka projenin ekibi ?team= ile verilirse sunucu 404 döner ve davet oluşmaz", async () => {
    const before = (await pending()).length;
    await page.goto(`${pageUrl()}?team=${foreignTeam.id}`);
    await expect(page.getByTestId("locked-team")).toHaveText(addMember.teamUnknown);

    // The person search is refused by the server.
    await page.getByLabel(addMember.searchLabel, { exact: true }).fill(memberNickname);
    await expect(page.getByRole("alert").filter({ hasText: tr.errors.notFound })).toBeVisible();

    await page.getByRole("tab", { name: addMember.modeEmail, exact: true }).click();
    await page.getByLabel(tr.invitations.firstName, { exact: true }).fill("Yabancı");
    await page.getByLabel(tr.invitations.lastName, { exact: true }).fill("Ekip");
    await page.getByLabel(tr.invitations.email, { exact: true }).fill(`${emailBase}-foreign@example.test`);
    await page.getByRole("checkbox", { name: tr.roles[PROJECT_ROLES[6]], exact: true }).check();
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith(`/projects/${projectId}/invitations`) && res.request().method() === "POST"),
      send().click(),
    ]);
    expect(response.status()).toBe(404);
    await expect(page.getByRole("alert").filter({ hasText: tr.errors.notFound }).last()).toBeVisible();
    await expect(page).toHaveURL(`${pageUrl()}?team=${foreignTeam.id}`);
    expect(await pending()).toHaveLength(before);
    expect((await api(page, "GET", `/projects/${foreignProjectId}/invitations/all?status=PENDING`)).json).toMatchObject({ totalElements: 0 });
  });

  test("TR/EN/DE başlık, 390 px'te yatay taşma yok, açık/koyu temada hata özeti", async () => {
    for (const [locale, messages, path] of [
      ["tr", tr, "projeler"], ["en", en, "projects"], ["de", de, "projekte"],
    ] as const) {
      const segment = locale === "tr" ? "ekip-davetleri/yeni" : locale === "en" ? "team-invitations/new" : "team-einladungen/neu";
      await page.goto(`/${locale}/${path}/${slug}/${segment}`);
      await expect(page).toHaveURL(`/${locale}/${path}/${slug}/${segment}`);
      await expect(page.getByRole("heading", { level: 1, name: messages.squads.addMember.title, exact: true })).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(`${messages.pageTitles.memberInvite} · PDA$`));
    }

    await page.goto(pageUrl());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("tab", { name: addMember.modeEmail, exact: true }).click();
    await send().click();
    await expect(summary()).toBeVisible();
    for (const dark of [false, true]) {
      await page.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
      await expect.poll(() => noHorizontalScroll(page)).toBe(true);
      await expect(page.locator("[data-sticky-actions]")).toBeVisible();
      await expect(summary()).toBeVisible();
    }
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
  });
});
