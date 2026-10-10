import { expect, test, type Page } from "@playwright/test";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import { api, chooseDate, createProject } from "./helpers";
import tr from "../src/i18n/messages/tr.json";

test.use({ storageState: MANAGER_STORAGE });

// Sprint create and edit are full pages (not dialogs): localized URLs, shared date pickers, validation, redirects, and
// the same permission rules as the sprint list (managers of a project whose task model allows advanced work).

type Sprint = { id: string; name: string; goal: string | null; startDate: string; endDate: string };

const listSprints = async (page: Page, projectId: string) => (await api(page, "GET", `/projects/${projectId}/sprints`)).json as Sprint[];
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const dayNumber = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / 86_400_000;

test.describe.serial("Sprint oluşturma ve düzenleme sayfaları", () => {
  let page: Page;
  let member: Page;
  let slug: string;
  let projectId: string;
  let sprintId: string;
  const listUrl = () => `/tr/projeler/${slug}/sprintler`;
  const submit = () => page.locator('form button[type="submit"]');
  const success = (text: string) => page.locator('[data-sonner-toast][data-type="success"]').filter({ hasText: text });

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    slug = await createProject(page, `Sprint Sayfaları ${Date.now()}`, { taskMode: "ADVANCED" });
    projectId = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;

    // A project member who is not a manager.
    member = await (await browser.newContext({ storageState: MEMBER_STORAGE })).newPage();
    await member.goto("/projects");
    const me = (await api(member, "GET", "/auth/me")).json as { id: string };
    const team = await api(page, "POST", `/projects/${projectId}/teams`, { name: "Üyeler", includeCreator: true });
    expect(team.status).toBe(201);
    const invite = await api(page, "POST", `/projects/${projectId}/invitations`, { userId: me.id, roles: ["TESTER"], teamId: (team.json as { id: string }).id });
    expect(invite.status).toBe(201);
    const { invitationId, token } = invite.json as { invitationId: string; token: string };
    expect((await api(member, "POST", `/projects/${projectId}/invitations/${invitationId}/accept`, { token })).status).toBe(200);
  });

  test.afterAll(async () => {
    expect((await api(page, "DELETE", `/projects/${projectId}`)).status).toBe(204);
    await page.context().close();
    await member.context().close();
  });

  test("Sprint oluştur bağlantısı tam sayfa açar; boş gönderimde ad odaklanır", async () => {
    await page.goto(`/projects/${slug}/sprints`);
    await page.getByRole("link", { name: tr.sprints.create }).first().click();

    await expect(page).toHaveURL(`${listUrl()}/yeni`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: tr.sprints.dialog.createTitle })).toBeVisible();
    await expect(page.locator("[data-sticky-actions]")).toBeVisible();
    await expect(page.locator("#sprint-name")).toBeFocused();

    await submit().click();
    await expect(page.getByRole("alert").filter({ hasText: tr.validation.required })).toBeVisible();
    await expect(page.locator("#sprint-name")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#sprint-name")).toBeFocused();
    await expect(page).toHaveURL(`${listUrl()}/yeni`);
  });

  test("bitiş başlangıçtan önceyse hata gösterilir; düzeltilince sprint oluşur ve liste açılır", async () => {
    await page.goto(`/projects/${slug}/sprints/new`);
    await page.locator("#sprint-name").fill("  Sayfa sprinti  ");
    await page.locator("#sprint-goal").fill("Sayfadan eklenen hedef");
    await expect(page.locator("#sprint-goal")).toHaveValue("Sayfadan eklenen hedef");

    await chooseDate(page, "sprint-start", "2030-01-01");
    await chooseDate(page, "sprint-end", "2030-01-14");
    // Moving the start past the end flags the end date straight away and blocks the submit.
    await chooseDate(page, "sprint-start", "2030-03-01");
    await expect(page.locator("#sprint-end")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert").filter({ hasText: tr.validation.sprintDateOrder })).toBeVisible();

    let posted = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith(`/projects/${projectId}/sprints`)) posted += 1;
    });
    await submit().click();
    await expect(page.getByRole("alert").filter({ hasText: tr.validation.sprintDateOrder })).toBeVisible();
    await expect(page.locator("#sprint-end")).toBeFocused();
    expect(posted).toBe(0);
    await expect(page).toHaveURL(`${listUrl()}/yeni`);

    await chooseDate(page, "sprint-end", "2030-03-14");
    await expect(page.locator("#sprint-end")).not.toHaveAttribute("aria-invalid", "true");
    await submit().click();

    await expect(success("Sayfa sprinti oluşturuldu")).toBeVisible();
    await expect(page).toHaveURL(listUrl());
    await expect(page.getByRole("link", { name: "Sayfa sprinti", exact: true })).toBeVisible();

    const created = (await listSprints(page, projectId)).filter((item) => item.name === "Sayfa sprinti");
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ goal: "Sayfadan eklenen hedef", startDate: "2030-03-01", endDate: "2030-03-14" });
    sprintId = created[0].id;
  });

  test("varsayılan tarihler bugün ve 13 gün sonrasıdır", async () => {
    await page.goto(`/projects/${slug}/sprints/new`);
    await page.locator("#sprint-name").fill("Varsayılan tarihli sprint");
    await submit().click();
    await expect(page).toHaveURL(listUrl());
    const created = (await listSprints(page, projectId)).find((item) => item.name === "Varsayılan tarihli sprint")!;
    expect(created).toBeTruthy();
    expect(dayNumber(created.endDate) - dayNumber(created.startDate)).toBe(13);
    expect(created.goal).toBeNull();
  });

  test("düzenleme bağlantısı dolu formu açar, değişiklik kaydedilir ve sprint sayfasına dönülür", async () => {
    await page.goto(`/projects/${slug}/sprints`);
    const row = page.locator("li").filter({ has: page.getByRole("link", { name: "Sayfa sprinti", exact: true }) });
    await row.getByRole("link", { name: tr.sprints.actions.edit, exact: true }).click();

    await expect(page).toHaveURL(`${listUrl()}/${sprintId}/duzenle`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: tr.sprints.dialog.editTitle })).toBeVisible();
    await expect(page.locator("#sprint-name")).toHaveValue("Sayfa sprinti");
    await expect(page.locator("#sprint-goal")).toHaveValue("Sayfadan eklenen hedef");
    await expect(page.locator("#sprint-start")).toContainText("2030");
    await expect(page.locator("#sprint-end")).toContainText("2030");

    await page.locator("#sprint-name").fill("Güncel sprint");
    await chooseDate(page, "sprint-end", "2030-03-20");
    await submit().click();

    await expect(success("Güncel sprint güncellendi")).toBeVisible();
    await expect(page).toHaveURL(`${listUrl()}/${sprintId}`);
    await expect(page.getByRole("heading", { name: "Güncel sprint" })).toBeVisible();
    expect((await listSprints(page, projectId)).find((item) => item.id === sprintId)).toMatchObject({ name: "Güncel sprint", startDate: "2030-03-01", endDate: "2030-03-20" });
  });

  test("Vazgeç ve tarayıcı geri düğmesi önceki sayfaya döner; konum izi ve kenar çubuğu doğrudur", async () => {
    const trail = page.getByRole("navigation", { name: "Konum", exact: true });
    await page.goto(`/projects/${slug}/sprints`);
    await page.getByRole("link", { name: tr.sprints.create }).first().click();
    await expect(page).toHaveURL(`${listUrl()}/yeni`);
    await expect(trail.locator("[aria-current=page]")).toHaveText(tr.pageTitles.sprintNew);
    await expect(trail.getByRole("link", { name: "Sprintler" })).toHaveAttribute("href", listUrl());
    await expect(page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Sprintler", exact: true })).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(page).toHaveURL(listUrl());

    await page.goto(`/projects/${slug}/sprints/${sprintId}/edit`);
    await expect(trail.getByRole("listitem")).toHaveText(["Projeler", /./, "Sprintler", "Güncel sprint", tr.pageTitles.sprintEdit]);
    await expect(page).toHaveTitle(new RegExp(`${tr.pageTitles.sprintEdit} · PDA$`));
    await page.getByRole("link", { name: tr.sprints.dialog.cancel }).click();
    await expect(page).toHaveURL(`${listUrl()}/${sprintId}`);

    await page.goto(`/projects/${slug}/sprints/00000000-0000-4000-8000-000000000000/edit`);
    await expect(page.locator("#sprint-name")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: tr.sprints.dialog.editTitle })).toHaveCount(0);
  });

  test("kirli form sayfadan çıkışta uyarır", async () => {
    const extra = await page.context().newPage();
    await extra.goto(`/projects/${slug}/sprints/new`);
    // beforeunload only prompts after a real user gesture on the page.
    await extra.locator("#sprint-name").click();
    await extra.keyboard.type("Yarım kalan sprint");
    const warned = extra.waitForEvent("dialog");
    await extra.close({ runBeforeUnload: true });
    const dialog = await warned;
    expect(dialog.type()).toBe("beforeunload");
    await dialog.accept();
  });

  test("yönetici olmayan üye bağlantı görmez; doğrudan adresler yetkisiz durumu gösterir", async () => {
    await member.goto(`/projects/${slug}/sprints`);
    await expect(member.getByRole("link", { name: "Güncel sprint", exact: true })).toBeVisible();
    await expect(member.getByRole("link", { name: tr.sprints.create })).toHaveCount(0);

    for (const path of ["sprints/new", `sprints/${sprintId}/edit`]) {
      await member.goto(`/projects/${slug}/${path}`);
      await expect(member.getByRole("alert").filter({ hasText: tr.errors.forbidden })).toBeVisible();
      await expect(member.locator("#sprint-name")).toHaveCount(0);
      await expect(member.getByRole("link", { name: tr.sprints.dialog.back })).toBeVisible();
    }
  });

  test("yalnız basit görev modelindeki projede sprint oluşturulamaz", async () => {
    const simpleSlug = await createProject(page, `Basit Sprint ${Date.now()}`, { taskMode: "SIMPLE" });
    const simpleId = ((await api(page, "GET", `/projects/by-slug/${simpleSlug}`)).json as { id: string }).id;
    try {
      await page.goto(`/projects/${simpleSlug}/sprints`);
      await expect(page.getByRole("link", { name: tr.sprints.create })).toHaveCount(0);

      await page.goto(`/projects/${simpleSlug}/sprints/new`);
      await expect(page.getByText(tr.taskModels.readOnly)).toBeVisible();
      await expect(page.locator("#sprint-name")).toHaveCount(0);
      await expect(page.getByRole("link", { name: tr.sprints.dialog.back })).toBeVisible();
      // The server stays the authority.
      const refused = await api(page, "POST", `/projects/${simpleId}/sprints`, { name: "Yasak", goal: null, startDate: "2031-01-01", endDate: "2031-01-14" });
      expect(refused.status).toBeGreaterThanOrEqual(400);
    } finally {
      expect((await api(page, "DELETE", `/projects/${simpleId}`)).status).toBe(204);
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`390 px genişlikte yatay taşma yok (${theme})`, async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const path of ["sprints/new", `sprints/${sprintId}/edit`]) {
        await page.goto(`/projects/${slug}/${path}`);
        await page.evaluate((value) => document.documentElement.classList.toggle("dark", value === "dark"), theme);
        await expect(page.locator("#sprint-name")).toBeVisible();
        await expect(page.locator("#sprint-end")).toBeVisible();
        await expect(submit()).toBeInViewport();
        expect(await noHorizontalScroll(page), path).toBe(true);
      }
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  }
});
