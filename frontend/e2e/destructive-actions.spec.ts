import { expect, test, type Locator, type Page } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";
import { api, createProject } from "./helpers";
import tr from "../src/i18n/messages/tr.json";

test.use({ storageState: MANAGER_STORAGE });

// Delete / critical action confirmation. For every delete reachable from the UI:
//  - the first click only opens a confirmation, nothing is sent;
//  - "Vazgeç" closes it and the record is still there;
//  - a refused request (500) shows an error and the record is still there;
//  - a double click on the confirm button sends exactly one DELETE;
//  - after the confirmation the record is really gone (checked after a reload).
// The project delete additionally needs the exact project name to be typed.

const DELAY_MS = 800;
const errorNotice = (page: Page) => page.locator('[data-sonner-toast][data-type="error"], [role="alert"]').first();

type Ctx = { slug: string; projectId: string; taskId: string };
type Scenario = {
  name: string;
  /** Confirm button label inside the dialog. */
  confirm: string;
  /** The error is shown inside the dialog (true) or as a toast after the dialog closed (false). */
  inlineFailure: boolean;
  deleteUrl: (c: Ctx) => RegExp;
  page: (c: Ctx) => string;
  create: (page: Page, c: Ctx, label: string) => Promise<void>;
  trigger: (row: Locator, label: string) => Locator;
  row: (page: Page, label: string) => Locator;
};

const listItem = (page: Page, label: string) => page.locator("li").filter({ hasText: label });

const scenarios: Scenario[] = [
  {
    name: "kriter",
    confirm: tr.criteria.delete,
    inlineFailure: true,
    deleteUrl: (c) => new RegExp(`/projects/${c.projectId}/criteria/[^/]+$`),
    page: (c) => `/projects/${c.slug}/criteria`,
    create: async (page, c, label) => {
      expect((await api(page, "POST", `/projects/${c.projectId}/criteria`, { title: label })).status).toBe(201);
    },
    row: listItem,
    trigger: (row) => row.getByRole("button", { name: tr.criteria.delete, exact: true }),
  },
  {
    name: "etiket",
    confirm: tr.labels.row.archive,
    inlineFailure: false,
    deleteUrl: (c) => new RegExp(`/projects/${c.projectId}/labels/[^/]+$`),
    page: (c) => `/projects/${c.slug}/labels`,
    create: async (page, c, label) => {
      expect((await api(page, "POST", `/projects/${c.projectId}/labels`, { name: label, color: "blue" })).status).toBe(201);
    },
    row: listItem,
    trigger: (row, label) => row.getByRole("button", { name: tr.labels.row.archiveLabel.replace("{name}", label) }),
  },
  {
    name: "sprint",
    confirm: tr.sprints.actions.archive,
    inlineFailure: false,
    deleteUrl: (c) => new RegExp(`/projects/${c.projectId}/sprints/[^/]+$`),
    page: (c) => `/projects/${c.slug}/sprints`,
    create: async (page, c, label) => {
      const r = await api(page, "POST", `/projects/${c.projectId}/sprints`, { name: label, goal: null, startDate: "2031-01-01", endDate: "2031-01-14" });
      expect(r.status, JSON.stringify(r.json)).toBe(201);
    },
    row: listItem,
    trigger: (row) => row.getByRole("button", { name: tr.sprints.actions.archive, exact: true }),
  },
  {
    name: "yorum",
    confirm: tr.tasks.detail.activity.delete,
    inlineFailure: false,
    deleteUrl: (c) => new RegExp(`/projects/${c.projectId}/tasks/${c.taskId}/comments/[^/]+$`),
    page: (c) => `/projects/${c.slug}/tasks/${c.taskId}`,
    create: async (page, c, label) => {
      expect((await api(page, "POST", `/projects/${c.projectId}/tasks/${c.taskId}/comments`, { body: label })).status).toBe(201);
    },
    row: listItem,
    trigger: (row) => row.getByRole("button", { name: tr.tasks.detail.activity.deleteComment }),
  },
  {
    name: "süre kaydı",
    confirm: tr.tasks.detail.time.delete,
    inlineFailure: false,
    deleteUrl: (c) => new RegExp(`/projects/${c.projectId}/tasks/${c.taskId}/worklogs/[^/]+$`),
    page: (c) => `/projects/${c.slug}/tasks/${c.taskId}`,
    create: async (page, c, label) => {
      const today = new Date().toISOString().slice(0, 10);
      const r = await api(page, "POST", `/projects/${c.projectId}/tasks/${c.taskId}/worklogs`, { minutes: 37, workDate: today, note: label });
      expect(r.status, JSON.stringify(r.json)).toBeLessThan(300);
    },
    row: listItem,
    trigger: (row) => row.getByRole("button", { name: /kaydı sil$/ }),
  },
];

test.describe.serial("Silme ve kritik eylem onayı", () => {
  let page: Page;
  let ctx: Ctx;

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext({ storageState: MANAGER_STORAGE })).newPage();
    const slug = await createProject(page, `Silme Onayı ${Date.now()}`);
    const projectId = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    const task = (await api(page, "POST", `/projects/${projectId}/tasks`, { title: "Silme görevi", priority: "LOW", creationMode: "ADVANCED" })).json as { id: string };
    ctx = { slug, projectId, taskId: task.id };
  });

  test.afterAll(async () => {
    expect((await api(page, "DELETE", `/projects/${ctx.projectId}`)).status).toBe(204);
    await page.context().close();
  });

  test.afterEach(async () => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  for (const sc of scenarios) {
    test(`${sc.name}: onay ister, vazgeçilince kalır, hata verince kalır, çift tıklamada tek istek gider, onaylanınca gerçekten silinir`, async () => {
      const label = `Silinecek ${sc.name} ${Date.now()}`;
      await sc.create(page, ctx, label);
      await page.goto(sc.page(ctx));

      let deletes = 0;
      const countDeletes = async (mode: "count" | "fail" | "slow") => {
        await page.unroute(sc.deleteUrl(ctx)).catch(() => undefined);
        await page.route(sc.deleteUrl(ctx), async (route) => {
          if (route.request().method() !== "DELETE") return route.continue();
          deletes += 1;
          if (mode === "fail") return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR" }) });
          if (mode === "slow") await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
          return route.continue();
        });
      };
      const openDialog = async () => {
        await sc.trigger(sc.row(page, label), label).first().click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        return dialog;
      };

      // 1) Opening the confirmation sends nothing; "Vazgeç" closes it and the record stays.
      await countDeletes("count");
      let dialog = await openDialog();
      expect(deletes).toBe(0);
      await dialog.getByRole("button", { name: /^(Vazgeç|İptal)/ }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(deletes).toBe(0);
      await expect(sc.row(page, label).first()).toBeVisible();

      // 2) The server refuses: an error is shown and the record stays.
      await countDeletes("fail");
      dialog = await openDialog();
      await dialog.getByRole("button", { name: sc.confirm, exact: true }).click();
      await expect.poll(() => deletes).toBe(1);
      if (sc.inlineFailure) {
        await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
        await expect(page.getByRole("dialog").getByRole("button", { name: sc.confirm, exact: true })).toBeEnabled();
        await page.getByRole("dialog").getByRole("button", { name: /^(Vazgeç|İptal)/ }).click();
      } else {
        await expect(errorNotice(page)).toBeVisible();
        await page.keyboard.press("Escape");
      }
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.reload();
      await expect(sc.row(page, label).first()).toBeVisible();

      // 3) A double click on the confirm button reaches the server once, and the record is really gone.
      deletes = 0;
      await countDeletes("slow");
      dialog = await openDialog();
      await dialog.getByRole("button", { name: sc.confirm, exact: true }).dblclick();
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
      expect(deletes).toBe(1);
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.reload();
      await expect(sc.row(page, label)).toHaveCount(0);
    });
  }

  test("proje silme: proje adı yazılmadan onay düğmesi kapalı kalır, hata kayıt bırakır, onayda proje silinir", async () => {
    const name = `Silinecek Proje ${Date.now()}`;
    const slug = await createProject(page, name);
    const projectId = ((await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string }).id;
    let deletes = 0;
    const url = new RegExp(`/api/v1/projects/${projectId}$`);
    const route = async (mode: "fail" | "slow") => {
      await page.unroute(url).catch(() => undefined);
      await page.route(url, async (r) => {
        if (r.request().method() !== "DELETE") return r.continue();
        deletes += 1;
        if (mode === "fail") return r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR" }) });
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        return r.continue();
      });
    };
    try {
      await page.goto(`/projects/${slug}/edit`);
      await route("fail");
      await page.getByRole("button", { name: tr.projects.settings.delete, exact: true }).click();
      const dialog = page.getByRole("dialog");
      const confirm = dialog.getByRole("button", { name: tr.projects.settings.deleteConfirm, exact: true });
      const typed = dialog.getByRole("textbox");

      // The button stays off for an empty, a wrong-case and a partial name; Enter does not send either.
      await expect(confirm).toBeDisabled();
      await typed.fill(name.toLowerCase());
      await expect(confirm).toBeDisabled();
      await typed.fill(name.slice(0, -1));
      await expect(confirm).toBeDisabled();
      await typed.press("Enter");
      expect(deletes).toBe(0);

      // Exact name: unlocked. The server refuses first: error shown, project stays.
      await typed.fill(name);
      await expect(confirm).toBeEnabled();
      await confirm.click();
      await expect.poll(() => deletes).toBe(1);
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(confirm).toBeEnabled();
      expect((await api(page, "GET", `/projects/by-slug/${slug}`)).status).toBe(200);

      // "Vazgeç" keeps the project and clears what was typed.
      await dialog.getByRole("button", { name: tr.projects.settings.cancel }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByRole("button", { name: tr.projects.settings.delete, exact: true }).click();
      await expect(page.getByRole("dialog").getByRole("textbox")).toHaveValue("");
      await page.getByRole("dialog").getByRole("button", { name: tr.projects.settings.cancel }).click();

      // Now it goes through: a double click sends one DELETE and the project is gone.
      deletes = 0;
      await route("slow");
      await page.getByRole("button", { name: tr.projects.settings.delete, exact: true }).click();
      await page.getByRole("dialog").getByRole("textbox").fill(name);
      await page.getByRole("dialog").getByRole("button", { name: tr.projects.settings.deleteConfirm, exact: true }).dblclick();
      await expect.poll(() => deletes).toBe(1);
      await expect(page).not.toHaveURL(/\/edit/, { timeout: 15_000 });
      expect(deletes).toBe(1);
      await page.unrouteAll({ behavior: "ignoreErrors" });
      expect((await api(page, "GET", `/projects/by-slug/${slug}`)).status).toBe(404);
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await api(page, "DELETE", `/projects/${projectId}`);
    }
  });
});
