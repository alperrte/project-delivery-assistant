import { expect, test, type Locator, type Page } from "@playwright/test";
import { api, createProject, openProjectListPage } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";
import { localizeHref } from "../src/i18n/routing";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const SECOND_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const field = (page: Page) => page.getByTestId("project-logo-field");
const mark = (page: Page) => page.getByTestId("project-settings-mark");
const header = (page: Page) => page.getByTestId("project-header-mark");
async function loaded(image: Locator) {
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
}

test.describe.serial("Project settings logo", () => {
  let page: Page;
  let slug: string;
  let projectId: string;
  let version: number;
  const name = `E2E Logo Settings ${Date.now()}`;
  const card = () => page.locator("article").filter({ has: page.locator(`a[href="/tr/projeler/${slug}/genel-bakis"]`) });
  test.beforeAll(async ({ browser }) => { page = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage(); });
  test.afterAll(async () => { await page.context().close(); });

  test("no logo uses an initial; uploading from settings updates the header and cached card", async () => {
    slug = await createProject(page, name);
    projectId = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    await openProjectListPage(page, slug);
    await card().getByRole("link", { name: `${name} ayarlarını düzenle` }).click();
    await expect(mark(page)).toHaveText("E");
    await expect(header(page)).toHaveText("E");
    await expect(field(page).getByRole("button", { name: "Logo kaldır" })).toHaveCount(0);
    await field(page).getByLabel("Proje logosu", { exact: true }).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("Proje logosu güncellendi.")).toBeVisible();
    await loaded(mark(page).locator("img"));
    await loaded(header(page).locator("img"));
    version = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { logoVersion: number }).logoVersion;
    await expect(mark(page).locator("img")).toHaveAttribute("src", new RegExp(`v=${version}$`));
    await page.goBack();
    await loaded(card().locator('img[src*="/logo?v="]'));
    await expect(card().locator('img[src*="/logo?v="]')).toHaveAttribute("src", new RegExp(`v=${version}$`));
  });

  test("pencil shows the current logo; replace keeps dirty text and refreshes header, chat and card", async () => {
    await card().getByRole("link", { name: `${name} ayarlarını düzenle` }).click();
    await loaded(mark(page).locator("img"));
    await page.getByTestId("chat-nav-item").click();
    await expect(page.getByTestId("chat-composer")).toBeEnabled();
    await page.getByTestId("chat-minimize").click();
    await page.locator("#settings-tagline").fill("unsaved logo test");
    const bar = page.getByTestId("chat-bar");
    const actions = page.locator("[data-sticky-actions]");
    const barBox = (await bar.boundingBox())!;
    const actionsBox = (await actions.locator("[role=region]").boundingBox())!;
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(actionsBox.y);
    await field(page).getByLabel("Proje logosu", { exact: true }).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: SECOND_PNG });
    await expect.poll(async () => ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { logoVersion: number }).logoVersion).not.toBe(version);
    version = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { logoVersion: number }).logoVersion;
    for (const image of [mark(page).locator("img"), header(page).locator("img"), bar.locator("img")]) {
      await loaded(image);
      await expect(image).toHaveAttribute("src", new RegExp(`v=${version}$`));
    }
    await expect(page.locator("#settings-tagline")).toHaveValue("unsaved logo test");
    await expect(page.getByRole("region", { name: "Kaydedilmemiş değişiklikler var" })).toBeVisible();
    await page.getByRole("button", { name: "Değişiklikleri at", exact: true }).click();
    await page.goBack();
    await expect(card().locator('img[src*="/logo?v="]')).toHaveAttribute("src", new RegExp(`v=${version}$`));
    await loaded(card().locator('img[src*="/logo?v="]'));
    await card().getByRole("link", { name: `${name} ayarlarını düzenle` }).click();
  });

  test("validation and server failures keep the previous logo; pending operations cannot race", async () => {
    const input = field(page).getByLabel("Proje logosu", { exact: true });
    let writes = 0;
    const countWrite = (request: import("@playwright/test").Request) => {
      if (request.method() === "PUT" && request.url().includes(`/projects/${projectId}/logo`)) writes += 1;
    };
    page.on("request", countWrite);
    for (const [mimeType, buffer, message] of [
      ["image/svg+xml", Buffer.from("<svg/>"), "PNG, JPEG veya WebP"],
      ["image/png", Buffer.alloc(512 * 1024 + 1), "en fazla 512 KB"],
      ["image/png", Buffer.alloc(0), "boş olamaz"],
    ] as const) {
      await input.setInputFiles({ name: "invalid.png", mimeType, buffer });
      await expect(field(page).getByRole("alert")).toContainText(message);
      await loaded(mark(page).locator("img"));
    }
    expect(writes).toBe(0);
    page.off("request", countWrite);
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const url = `**/projects/${projectId}/logo`;
    await page.route(url, async (route) => {
      if (route.request().method() === "PUT") await wait;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR" }) });
    });
    try {
      await page.locator("#settings-tagline").fill("still unsaved");
      await input.setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
      await expect(field(page).getByRole("button", { name: "Logo değiştir" })).toBeDisabled();
      await expect(field(page).getByRole("button", { name: "Logo kaldır" })).toBeDisabled();
      release();
      await expect(field(page).getByRole("alert")).toBeVisible();
      await expect(mark(page).locator("img")).toHaveAttribute("src", new RegExp(`v=${version}$`));
      await expect(page.locator("#settings-tagline")).toHaveValue("still unsaved");
      await field(page).getByRole("button", { name: "Logo kaldır" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Logo kaldır" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(mark(page).locator("img")).toHaveAttribute("src", new RegExp(`v=${version}$`));
    } finally { release(); await page.unroute(url); }
  });

  test("cancel preserves the logo; confirmed removal restores settings/header/card/chat fallback", async () => {
    await field(page).getByRole("button", { name: "Logo kaldır" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Vazgeç" }).click();
    await loaded(mark(page).locator("img"));
    await field(page).getByRole("button", { name: "Logo kaldır" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Logo kaldır" }).click();
    await expect(mark(page)).toHaveText("E");
    await expect(header(page)).toHaveText("E");
    await expect(page.getByTestId("chat-bar").locator("img")).toHaveCount(0);
    expect(((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { logoVersion: number | null }).logoVersion).toBeNull();
    await expect(page.locator("#settings-tagline")).toHaveValue("still unsaved");
    await page.getByRole("button", { name: "Değişiklikleri at", exact: true }).click();
    await page.goBack();
    await expect(card().locator('img[src*="/logo?v="]')).toHaveCount(0);
  });

  test("failed images fall back and a new version can load; localized light/dark mobile controls fit", async () => {
    await page.evaluate((target) => (window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push(target), `/projects/${slug}?section=settings`);
    const url = `**/projects/${projectId}/logo?v=*`;
    await page.route(url, (route) => route.fulfill({ status: 404 }));
    await field(page).getByLabel("Proje logosu", { exact: true }).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await expect(field(page).getByRole("button", { name: "Logo kaldır" })).toBeEnabled();
    await expect(mark(page)).toHaveText("E");
    await expect(header(page)).toHaveText("E");
    await page.unroute(url);
    await field(page).getByLabel("Proje logosu", { exact: true }).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: SECOND_PNG });
    await loaded(mark(page).locator("img"));
    await loaded(header(page).locator("img"));
    for (const locale of ["tr", "en", "de"] as const) {
      await page.goto(localizeHref(`/projects/${slug}?section=settings`, locale));
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await loaded(mark(page).locator("img"));
      await page.setViewportSize({ width: 390, height: 844 });
      for (const dark of [false, true]) {
        await page.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
        await field(page).scrollIntoViewIfNeeded();
        for (const button of await field(page).getByRole("button").all()) {
          await button.focus();
          await expect(button).toBeFocused();
          const box = (await button.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(390);
        }
        await page.screenshot({ path: test.info().outputPath(`logo-${locale}-${dark ? "dark" : "light"}.png`) });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
    }
  });
});
