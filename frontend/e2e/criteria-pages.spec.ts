import { expect, test, type Page } from "@playwright/test";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import { api, createProject } from "./helpers";
import tr from "../src/i18n/messages/tr.json";

test.use({ storageState: MANAGER_STORAGE });

// Criteria create and edit are full pages (not dialogs): real localized URLs, back/cancel to the list, first-invalid-field
// focus, list + overview refresh after saving, and the same permission rules as the rest of the project.

type Criterion = { id: string; title: string; description: string | null };

const listCriteria = async (page: Page, projectId: string) => (await api(page, "GET", `/projects/${projectId}/criteria`)).json as Criterion[];
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe.serial("Kriter oluşturma ve düzenleme sayfaları", () => {
  let page: Page;
  let member: Page;
  let slug: string;
  let projectId: string;
  let criterionId: string;
  const listUrl = () => `/tr/projeler/${slug}/kriterler`;
  const submit = () => page.locator('form button[type="submit"]');

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    slug = await createProject(page, `Kriter Sayfaları ${Date.now()}`);
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

  test("Yeni kriter bağlantısı tam sayfa açar; boş gönderimde hata gösterilir ve başlık odaklanır", async () => {
    await page.goto(`/projects/${slug}/criteria`);
    await page.getByRole("link", { name: tr.criteria.create }).first().click();

    await expect(page).toHaveURL(`${listUrl()}/yeni`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: tr.criteria.form.createTitle })).toBeVisible();
    await expect(page.locator("[data-sticky-actions]")).toBeVisible();
    // Create starts in the title field.
    await expect(page.locator("#criterion-title")).toBeFocused();

    await page.getByRole("button", { name: tr.criteria.form.create }).click();
    await expect(page.getByRole("alert").filter({ hasText: tr.validation.required })).toBeVisible();
    await expect(page.locator("#criterion-title")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#criterion-title")).toBeFocused();
    await expect(page).toHaveURL(`${listUrl()}/yeni`);
  });

  test("doldurup gönderince liste açılır, kriter API'de vardır ve genel bakış yeniden yüklemeden güncellenir", async () => {
    // Warm the project home so that only the invalidation (not a fresh page load) can update the overview.
    await page.goto(`/projects/${slug}`);
    await expect(page.getByText(tr.projects.overview.noCriteriaDescription)).toBeVisible();
    await page.getByRole("button", { name: tr.projects.overview.defineCriteria }).click();
    await expect(page).toHaveURL(listUrl());

    await page.getByRole("link", { name: tr.criteria.create }).first().click();
    await page.locator("#criterion-title").fill("  Sayfa kriteri  ");
    await page.locator("#criterion-description").fill("Sayfadan eklenen açıklama");
    await submit().click();

    await expect(page.locator('[data-sonner-toast][data-type="success"]').filter({ hasText: tr.criteria.form.created })).toBeVisible();
    await expect(page).toHaveURL(listUrl());
    await expect(page.getByText("Sayfa kriteri", { exact: true })).toBeVisible();
    await expect(page.getByText("Sayfadan eklenen açıklama")).toBeVisible();

    const created = (await listCriteria(page, projectId)).filter((item) => item.title === "Sayfa kriteri");
    expect(created).toHaveLength(1);
    expect(created[0].description).toBe("Sayfadan eklenen açıklama");
    criterionId = created[0].id;

    // Client-side navigation to the overview: the cached home was invalidated, so the progress is already correct.
    await page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("link", { name: "Genel Bakış" }).click();
    await expect(page.getByText("1 kriterin 0 tanesi tamamlandı")).toBeVisible();
  });

  test("düzenleme bağlantısı dolu formu açar ve değişiklik kaydedilir", async () => {
    await page.goto(`/projects/${slug}/criteria`);
    await page.getByRole("link", { name: `${tr.criteria.form.editTitle}: Sayfa kriteri` }).click();

    await expect(page).toHaveURL(`${listUrl()}/${criterionId}/duzenle`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: tr.criteria.form.editTitle })).toBeVisible();
    await expect(page.locator("#criterion-title")).toHaveValue("Sayfa kriteri");
    await expect(page.locator("#criterion-description")).toHaveValue("Sayfadan eklenen açıklama");

    await page.locator("#criterion-title").fill("Güncel kriter");
    await page.getByRole("button", { name: tr.criteria.form.save }).click();

    await expect(page.locator('[data-sonner-toast][data-type="success"]').filter({ hasText: tr.criteria.form.updated })).toBeVisible();
    await expect(page).toHaveURL(listUrl());
    await expect(page.getByText("Güncel kriter", { exact: true })).toBeVisible();
    expect((await listCriteria(page, projectId)).find((item) => item.id === criterionId)).toMatchObject({ title: "Güncel kriter", description: "Sayfadan eklenen açıklama" });
  });

  test("Vazgeç ve tarayıcı geri düğmesi listeye döner; olmayan kriter bulunamadı gösterir", async () => {
    await page.goto(`/projects/${slug}/criteria`);
    await page.getByRole("link", { name: tr.criteria.create }).first().click();
    await expect(page).toHaveURL(`${listUrl()}/yeni`);
    await page.goBack();
    await expect(page).toHaveURL(listUrl());
    await expect(page.getByRole("heading", { name: tr.criteria.title })).toBeVisible();

    await page.getByRole("link", { name: `${tr.criteria.form.editTitle}: Güncel kriter` }).click();
    await expect(page).toHaveURL(`${listUrl()}/${criterionId}/duzenle`);
    await page.getByRole("link", { name: tr.criteria.form.cancel }).click();
    await expect(page).toHaveURL(listUrl());

    await page.goto(`/projects/${slug}/criteria/00000000-0000-4000-8000-000000000000/edit`);
    await expect(page.getByRole("alert").filter({ hasText: tr.errors.notFound })).toBeVisible();
    await expect(page.locator("#criterion-title")).toHaveCount(0);
    await page.getByRole("link", { name: tr.criteria.form.back }).click();
    await expect(page).toHaveURL(listUrl());
  });

  test("kirli form sayfadan çıkışta uyarır", async () => {
    const extra = await page.context().newPage();
    await extra.goto(`/projects/${slug}/criteria/new`);
    // beforeunload only prompts after a real user gesture on the page.
    await extra.locator("#criterion-title").click();
    await extra.keyboard.type("Yarım kalan kriter");
    const warned = extra.waitForEvent("dialog");
    await extra.close({ runBeforeUnload: true });
    const dialog = await warned;
    expect(dialog.type()).toBe("beforeunload");
    await dialog.accept();
  });

  test("yönetici olmayan üye bağlantı görmez; doğrudan adres yetkisiz durumu gösterir", async () => {
    await member.goto(`/projects/${slug}/criteria`);
    await expect(member.getByRole("heading", { name: tr.criteria.title })).toBeVisible();
    await expect(member.getByText("Güncel kriter", { exact: true })).toBeVisible();
    await expect(member.getByRole("link", { name: tr.criteria.create })).toHaveCount(0);
    await expect(member.getByRole("link", { name: new RegExp(`^${tr.criteria.form.editTitle}`) })).toHaveCount(0);

    for (const path of ["criteria/new", `criteria/${criterionId}/edit`]) {
      await member.goto(`/projects/${slug}/${path}`);
      await expect(member.getByRole("alert").filter({ hasText: tr.errors.forbidden })).toBeVisible();
      await expect(member.locator("#criterion-title")).toHaveCount(0);
      await expect(member.getByRole("link", { name: tr.criteria.form.back })).toBeVisible();
    }
  });

  test("kenar çubuğunda Kriterler etkin kalır ve konum izi sayfayı adlandırır", async () => {
    const nav = page.getByRole("navigation", { name: "Gezinme menüsü" });
    const trail = page.getByRole("navigation", { name: "Konum", exact: true });
    await page.goto(`/projects/${slug}/criteria/new`);
    await expect(nav.getByRole("link", { name: "Kriterler" })).toHaveAttribute("aria-current", "page");
    await expect(trail.locator("[aria-current=page]")).toHaveText(tr.pageTitles.criterionNew);
    await expect(trail.getByRole("link", { name: "Kriterler" })).toHaveAttribute("href", listUrl());

    await page.goto(`/projects/${slug}/criteria/${criterionId}/edit`);
    await expect(nav.getByRole("link", { name: "Kriterler" })).toHaveAttribute("aria-current", "page");
    await expect(trail.locator("[aria-current=page]")).toHaveText(tr.pageTitles.criterionEdit);
    await expect(page).toHaveTitle(new RegExp(`${tr.pageTitles.criterionEdit} · PDA$`));

    // The virtual section URL keeps working next to the physical pages.
    await page.goto(`/projects/${slug}/criteria`);
    await expect(page).toHaveURL(listUrl());
    await expect(nav.getByRole("link", { name: "Kriterler" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: tr.criteria.title })).toBeVisible();
  });

  for (const theme of ["light", "dark"] as const) {
    test(`390 px genişlikte yatay taşma yok (${theme})`, async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const path of [`criteria/new`, `criteria/${criterionId}/edit`]) {
        await page.goto(`/projects/${slug}/${path}`);
        await page.evaluate((value) => document.documentElement.classList.toggle("dark", value === "dark"), theme);
        await expect(page.locator("#criterion-title")).toBeVisible();
        await expect(submit()).toBeInViewport();
        expect(await noHorizontalScroll(page), path).toBe(true);
      }
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  }
});
