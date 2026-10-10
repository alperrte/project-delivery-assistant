import { expect, test, type Page } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";
import { api, createProject } from "./helpers";
import tr from "../src/i18n/messages/tr.json";

test.use({ storageState: MANAGER_STORAGE });

// The browser checks are only a convenience: the server has to refuse the same bad input when the form is bypassed.
// Every case sends the same payload twice: a valid one (must be accepted) and one with only the field under test broken
// (must be refused with 400), so a wrong payload shape cannot make the test pass by accident.

type Case = { name: string; path: (projectId: string) => string; valid: object; invalid: object };

const long = (n: number) => "a".repeat(n);

const cases: Case[] = [
  { name: "ekip adı", path: (p) => `/projects/${p}/teams`, valid: { name: "Ekip A" }, invalid: { name: "   " } },
  { name: "ekip adı (çok uzun)", path: (p) => `/projects/${p}/teams`, valid: { name: "Ekip B" }, invalid: { name: long(300) } },
  { name: "kriter başlığı", path: (p) => `/projects/${p}/criteria`, valid: { title: "Kriter A" }, invalid: { title: "   " } },
  { name: "kriter başlığı (çok uzun)", path: (p) => `/projects/${p}/criteria`, valid: { title: "Kriter B" }, invalid: { title: long(500) } },
  { name: "görev başlığı", path: (p) => `/projects/${p}/tasks`, valid: { title: "Görev A", priority: "LOW" }, invalid: { title: "   ", priority: "LOW" } },
  { name: "görev başlığı (çok uzun)", path: (p) => `/projects/${p}/tasks`, valid: { title: "Görev B", priority: "LOW" }, invalid: { title: long(500), priority: "LOW" } },
  { name: "görev önceliği", path: (p) => `/projects/${p}/tasks`, valid: { title: "Görev C", priority: "LOW" }, invalid: { title: "Görev C", priority: "YOK" } },
];

test.describe.serial("Sunucu tarafı doğrulama: tarayıcı denetimi atlansa da kurallar geçerli", () => {
  let page: Page;
  let projectId: string;

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    const slug = await createProject(page, `Server Validation ${Date.now()}`);
    projectId = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
  });

  test.afterAll(async () => {
    expect((await api(page, "DELETE", `/projects/${projectId}`)).status).toBe(204);
    await page.context().close();
  });

  for (const c of cases) {
    test(`${c.name}: geçerli kabul, bozuk 400`, async () => {
      const ok = await api(page, "POST", c.path(projectId), c.valid);
      expect(ok.status, JSON.stringify(ok.json)).toBe(201);
      const bad = await api(page, "POST", c.path(projectId), c.invalid);
      expect(bad.status, JSON.stringify(bad.json)).toBe(400);
    });
  }

  test("etiket, sprint ve süre kaydı için bozuk veri 400 döner", async () => {
    const probe = async (path: string, valid: object, invalid: object) => {
      const ok = await api(page, "POST", path, valid);
      expect(ok.status, `${path} geçerli: ${JSON.stringify(ok.json)}`).toBeLessThan(300);
      const bad = await api(page, "POST", path, invalid);
      expect(bad.status, `${path} bozuk: ${JSON.stringify(bad.json)}`).toBe(400);
    };
    await probe(`/projects/${projectId}/labels`, { name: "Etiket A", color: "blue" }, { name: "   ", color: "blue" });
    await probe(`/projects/${projectId}/sprints`, { name: "Sprint A", goal: null, startDate: "2030-01-01", endDate: "2030-01-14" }, { name: "   ", goal: null, startDate: "2030-01-01", endDate: "2030-01-14" });
    await probe(`/projects/${projectId}/sprints`, { name: "Sprint B", goal: null, startDate: "2030-02-01", endDate: "2030-02-14" }, { name: "Sprint C", goal: null, startDate: "2030-02-14", endDate: "2030-02-01" });
    await probe(`/projects/${projectId}/tasks`, { title: "Tarih A", priority: "LOW", startDate: "2030-06-10", deadlineAt: "2030-06-12T10:00:00Z" }, { title: "Tarih B", priority: "LOW", startDate: "2030-06-10", deadlineAt: "2030-06-05T10:00:00Z" });
    const task = (await api(page, "POST", `/projects/${projectId}/tasks`, { title: "Süre görevi", priority: "LOW", creationMode: "ADVANCED" })).json as { id: string };
    const today = new Date().toISOString().slice(0, 10);
    await probe(`/projects/${projectId}/tasks/${task.id}/worklogs`, { minutes: 30, workDate: today, note: null }, { minutes: 0, workDate: today, note: null });
  });

  test("proje: ad boş ya da tür geçersizse 400 döner", async () => {
    const empty = await api(page, "POST", "/projects", { name: "   ", projectType: "WEB" });
    expect(empty.status, JSON.stringify(empty.json)).toBe(400);
    const badType = await api(page, "POST", "/projects", { name: "Tür testi", projectType: "YOK" });
    expect(badType.status, JSON.stringify(badType.json)).toBe(400);
  });

  test("şifre değiştirme: kısa yeni şifre ve eşleşmeyen tekrar reddedilir", async () => {
    const short = await api(page, "POST", "/auth/password/change", { currentPassword: "x", newPassword: "kisa", confirmNewPassword: "kisa" });
    expect(short.status, JSON.stringify(short.json)).toBe(400);
    // Eight characters are not enough any more: an uppercase letter, a digit and a special character are required too.
    const weak = await api(page, "POST", "/auth/password/change", { currentPassword: "x", newPassword: "aaaaaaaa", confirmNewPassword: "aaaaaaaa" });
    expect(weak.status, JSON.stringify(weak.json)).toBe(400);
    expect(short.status, JSON.stringify(short.json)).toBe(400);
    const mismatch = await api(page, "POST", "/auth/password/change", { currentPassword: "x", newPassword: "Yeni-Parola-12345", confirmNewPassword: "Baska-Parola-12345" });
    expect(mismatch.status, JSON.stringify(mismatch.json)).toBe(400);
  });
});

test.describe("Form verisini koruma: hata yazılanları silmez", () => {
  test("yeni görev: sunucu 500 dönünce başlık ve açıklama yerinde kalır, tekrar gönderilebilir", async ({ page }) => {
    const slug = await createProject(page, `Data Keep ${Date.now()}`);
    const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string };
    try {
      let calls = 0;
      await page.route(new RegExp(`/projects/${project.id}/tasks$`), async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        calls += 1;
        if (calls === 1) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR" }) });
        return route.continue();
      });
      await page.goto(`/projects/${slug}/tasks/new`);
      await page.locator("#task-title").fill("Korunacak başlık");
      await page.locator("#task-description").fill("Korunacak açıklama");
      await page.locator('form button[type="submit"]').click();
      await expect.poll(() => calls).toBe(1);
      await expect(page.locator("#task-title")).toHaveValue("Korunacak başlık");
      await expect(page.locator("#task-description")).toHaveValue("Korunacak açıklama");
      await expect(page.locator('form button[type="submit"]')).toBeEnabled();

      await page.locator('form button[type="submit"]').click();
      await expect(page).toHaveURL(/\/tr\/projeler\/[^/]+\/gorevler\/[^/]+/, { timeout: 15_000 });
      expect(calls).toBe(2);
    } finally {
      expect((await api(page, "DELETE", `/projects/${project.id}`)).status).toBe(204);
    }
  });

  test("doğrulama hatasında diğer alanlar silinmez", async ({ page }) => {
    await page.goto("/projects/new");
    await page.locator("#project-name").fill("   ");
    await page.locator("#project-tagline").fill("Korunacak slogan");
    await page.getByRole("button", { name: /^Projeyi oluştur$/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: tr.validation.required }).first()).toBeVisible();
    await expect(page.locator("#project-tagline")).toHaveValue("Korunacak slogan");
  });
});
