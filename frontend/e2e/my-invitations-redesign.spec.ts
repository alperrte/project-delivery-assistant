import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import path from "node:path";
import { api } from "./helpers";
import { createIsolatedInvitationRecipient } from "./invitation-fixture";
import { MANAGER_STORAGE } from "./global-setup";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

/**
 * "Proje Davetlerim" redesign against the real backend and an isolated recipient (the shared member is untouched):
 *   - desktop (xl and up; below that the card list, since the sidebar leaves ~720 px at 1024) is a semantic table: Proje, Roller, Davet eden, Tarih, Durum, İşlemler;
 *   - accepting from the table creates the membership and the pending badge falls without a reload;
 *   - rejecting asks for an optional reason, which the manager sees;
 *   - `?status=ALL` is a deep link to the history, including the rejected invitation;
 *   - 320, 390, 768 and 1024 show cards with no horizontal overflow and 44 px action targets, in both themes;
 *   - the column labels follow the locale (TR/EN/DE).
 */
test.describe.serial("My invitations redesign", () => {
  test.setTimeout(120_000);
  let managerContext: BrowserContext;
  let recipientContext: BrowserContext;
  let manager: Page;
  let recipient: Page;
  let managerNickname: string;
  const stamp = Date.now();
  const names = {
    accept: `Redesign Accept ${stamp}`,
    reject: `Redesign Reject ${stamp}`,
    stale: `Redesign Stale ${stamp}`,
    long: `Redesign-Uzun-Proje-Adi-${stamp}-Redesign-Uzun-Proje-Adi`,
  };
  const ids: Record<"accept" | "reject" | "stale" | "long", { projectId: string; invitationId: string }> = {
    accept: { projectId: "", invitationId: "" },
    reject: { projectId: "", invitationId: "" },
    stale: { projectId: "", invitationId: "" },
    long: { projectId: "", invitationId: "" },
  };
  const shotDir = path.resolve(__dirname, "../../.local/my-invitations-redesign");

  const incomingBadge = (page: Page) => page.locator("h1 [data-pending-invitation-count]");
  const pendingTotal = async () => {
    const result = await api(recipient, "GET", "/project-invitations/me?status=PENDING&page=0&size=1");
    expect(result.status).toBe(200);
    return (result.json as { totalElements: number }).totalElements;
  };

  test.beforeAll(async ({ browser }) => {
    managerContext = await browser.newContext({ storageState: MANAGER_STORAGE });
    manager = await managerContext.newPage();
    recipientContext = await browser.newContext();
    recipient = await recipientContext.newPage();
    await manager.goto("/projects");
    await createIsolatedInvitationRecipient(manager, recipient);
    managerNickname = ((await api(manager, "GET", "/auth/me")).json as { nickname: string }).nickname;
    const me = (await api(recipient, "GET", "/auth/me")).json as { id: string };

    const invite = async (key: keyof typeof names, roles: string[], message: string | undefined) => {
      const project = await api(manager, "POST", "/projects", { name: names[key], projectType: "WEB" });
      expect(project.status).toBe(201);
      const projectId = (project.json as { id: string }).id;
      const team = await api(manager, "POST", `/projects/${projectId}/teams`, { name: `Team ${key}`, includeCreator: true });
      expect(team.status).toBe(201);
      const invitation = await api(manager, "POST", `/projects/${projectId}/invitations`, {
        userId: me.id, teamId: (team.json as { id: string }).id, roles, message,
      });
      expect(invitation.status, JSON.stringify(invitation.json)).toBe(201);
      ids[key] = { projectId, invitationId: (invitation.json as { invitationId: string }).invitationId };
    };
    await invite("accept", ["TESTER", "FRONTEND_DEVELOPER"], "Katılmanı bekliyoruz");
    await invite("reject", ["BACKEND_DEVELOPER"], undefined);
    await invite("stale", ["TESTER"], undefined);
    await invite("long", ["PROJECT_MANAGER", "FULL_STACK_DEVELOPER", "AI_ML_DEVELOPER", "UI_UX_DEVELOPER", "ANALYST"], "Uzun bir davet mesajı ".repeat(4).trim());
  });

  test.afterAll(async () => {
    // Leave the isolated recipient without pending rows of this run; the history rows are harmless.
    for (const { invitationId } of Object.values(ids)) {
      if (invitationId) await api(recipient, "POST", `/project-invitations/${invitationId}/reject`, { message: "" }).catch(() => undefined);
    }
    for (const { projectId } of Object.values(ids)) {
      if (projectId) await api(manager, "POST", `/projects/${projectId}/archive`).catch(() => undefined);
    }
    await managerContext.close();
    await recipientContext.close();
  });

  test("desktop 1440 and 1280 show the table with its six columns and real data", async () => {
    for (const width of [1440, 1280]) {
      await recipient.setViewportSize({ width, height: 900 });
      await recipient.goto("/tr/davetler");
      const table = recipient.getByRole("table");
      await expect(table).toBeVisible();
      for (const label of [tr.invitations.mineProject, tr.invitations.columns.roles, tr.invitations.mineInviter,
        tr.invitations.mineDate, tr.invitations.columns.status, tr.invitations.columns.actions]) {
        await expect(table.getByRole("columnheader", { name: label, exact: true })).toBeVisible();
      }
      // The card list belongs to the narrow layout only.
      await expect(recipient.getByRole("list", { name: tr.invitations.mineListLabel })).toHaveCount(0);

      const row = recipient.getByRole("row").filter({ hasText: names.accept });
      await expect(row).toBeVisible();
      await expect(row).toContainText("Team accept");
      await expect(row).toContainText("Katılmanı bekliyoruz");
      await expect(row).toContainText(tr.roles.TESTER);
      await expect(row).toContainText(tr.roles.FRONTEND_DEVELOPER);
      await expect(row).toContainText(managerNickname);
      await expect(row).toContainText(tr.invitations.statusValues.PENDING);
      await expect(row.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
      await expect(row.locator("time")).toContainText("2026");

      // Actions: icon preview with an accessible name, reject and accept, all at least 44 px tall.
      const preview = row.getByRole("button", { name: tr.invitations.minePreviewNamed.replace("{project}", names.accept) });
      for (const button of [preview, row.getByRole("button", { name: tr.invitations.respond.reject }),
        row.getByRole("button", { name: tr.invitations.respond.accept })]) {
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(43.5);
        expect(box!.width).toBeGreaterThanOrEqual(43.5);
      }
      await preview.hover();
      await expect(recipient.locator("[data-slot='tooltip-content']")).toContainText(tr.invitations.minePreviewAction);

      // Neither the page nor the table scrolls sideways.
      expect(await recipient.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await table.evaluate((element) => {
        const container = element.closest('[data-slot="table-container"]')!;
        return container.scrollWidth <= container.clientWidth + 1;
      })).toBe(true);
    }
  });

  test("the long project keeps the table and the cards inside their bounds", async () => {
    await recipient.setViewportSize({ width: 1280, height: 900 });
    await recipient.goto("/tr/davetler");
    const row = recipient.getByRole("row").filter({ hasText: names.long });
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: tr.invitations.respond.accept })).toBeVisible();
    expect(await recipient.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("accepting from the table creates the membership and the pending badge falls without a reload", async () => {
    await recipient.setViewportSize({ width: 1440, height: 900 });
    await recipient.goto("/tr/davetler");
    const before = await pendingTotal();
    expect(before).toBeGreaterThanOrEqual(3);
    await expect(incomingBadge(recipient)).toHaveAttribute("data-pending-invitation-count", String(before));
    expect((await api(recipient, "GET", `/projects/${ids.accept.projectId}`)).status).not.toBe(200);

    await recipient.evaluate(() => { (window as unknown as { __noReload: boolean }).__noReload = true; });
    const row = recipient.getByRole("row").filter({ hasText: names.accept });
    await row.getByRole("button", { name: tr.invitations.respond.accept }).click();
    await expect(recipient.getByText(tr.invitations.acceptSuccess)).toBeVisible();
    await expect(recipient.getByRole("row").filter({ hasText: names.accept })).toHaveCount(0);
    await expect(incomingBadge(recipient)).toHaveAttribute("data-pending-invitation-count", String(before - 1));
    expect(await recipient.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
    expect((await api(recipient, "GET", `/projects/${ids.accept.projectId}`)).status).toBe(200);
  });

  test("rejecting asks for an optional reason and the manager sees it", async () => {
    await recipient.setViewportSize({ width: 1440, height: 900 });
    await recipient.goto("/tr/davetler");
    const row = recipient.getByRole("row").filter({ hasText: names.reject });
    await row.getByRole("button", { name: tr.invitations.respond.reject }).click();
    const dialog = recipient.getByRole("dialog");
    await expect(dialog).toContainText(tr.invitations.mineRejectTitle);
    await dialog.getByRole("textbox").fill("Şu an uygun değilim");
    await dialog.getByRole("button", { name: tr.invitations.respond.reject }).click();
    await expect(recipient.getByText(tr.invitations.rejectSuccess)).toBeVisible();
    await expect(recipient.getByRole("row").filter({ hasText: names.reject })).toHaveCount(0);

    const rejected = await api(manager, "GET", `/projects/${ids.reject.projectId}/invitations/all?status=REJECTED`);
    expect(rejected.status).toBe(200);
    expect((rejected.json as { content: { id: string; rejectionMessage: string | null }[] }).content
      .find((item) => item.id === ids.reject.invitationId)?.rejectionMessage).toBe("Şu an uygun değilim");
  });

  test("accepting an invitation answered elsewhere shows the specific 'no longer pending' message", async () => {
    await recipient.setViewportSize({ width: 1440, height: 900 });
    await recipient.goto("/tr/davetler");
    const row = recipient.getByRole("row").filter({ hasText: names.stale });
    await expect(row).toBeVisible();
    // The invitation is answered from another tab/device while this list is still on screen.
    expect((await api(recipient, "POST", `/project-invitations/${ids.stale.invitationId}/reject`, { message: "" })).status).toBe(204);
    const [response] = await Promise.all([
      recipient.waitForResponse((res) => res.url().endsWith(`/project-invitations/${ids.stale.invitationId}/accept`)),
      row.getByRole("button", { name: tr.invitations.respond.accept }).click(),
    ]);
    expect(response.status()).toBe(409);
    expect((await response.json()).code).toBe("INVITATION_NOT_PENDING");
    await expect(recipient.getByText(tr.errors.invitationNotPending)).toBeVisible();
    await expect(recipient.getByText(tr.errors.conflict, { exact: true })).toHaveCount(0);
  });

  test("?status=ALL is a deep link to the history; the tabs write the URL", async () => {
    await recipient.setViewportSize({ width: 1440, height: 900 });
    await recipient.goto("/tr/davetler?status=ALL");
    await expect(recipient.getByRole("tab", { name: tr.invitations.mineTabAll })).toHaveAttribute("aria-selected", "true");
    const rejected = recipient.getByRole("row").filter({ hasText: names.reject });
    await expect(rejected).toContainText(tr.invitations.statusValues.REJECTED);
    await expect(rejected.getByRole("button")).toHaveCount(0);
    const accepted = recipient.getByRole("row").filter({ hasText: names.accept });
    await expect(accepted).toContainText(tr.invitations.statusValues.ACCEPTED);
    await expect(accepted.getByRole("button")).toHaveCount(0);
    // Still pending rows keep their actions in the history.
    await expect(recipient.getByRole("row").filter({ hasText: names.long }).getByRole("button", { name: tr.invitations.respond.accept })).toBeVisible();

    await recipient.reload();
    await expect(recipient.getByRole("tab", { name: tr.invitations.mineTabAll })).toHaveAttribute("aria-selected", "true");

    await recipient.getByRole("tab", { name: tr.invitations.mineTabPending }).click();
    await expect(recipient).not.toHaveURL(/status=/);
    await expect(recipient.getByRole("row").filter({ hasText: names.reject })).toHaveCount(0);
    await expect(recipient.getByRole("row").filter({ hasText: names.long })).toBeVisible();
    await recipient.getByRole("tab", { name: tr.invitations.mineTabAll }).click();
    await expect(recipient).toHaveURL(/status=ALL/);
    await expect(recipient.getByRole("row").filter({ hasText: names.reject })).toBeVisible();
  });

  test("320 and 390 show cards with no horizontal overflow and 44 px actions, in light and dark", async () => {
    await recipient.goto("/tr/davetler");
    for (const dark of [false, true]) {
      await recipient.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
      for (const width of [320, 390, 768, 1024]) {
        await recipient.setViewportSize({ width, height: 900 });
        await expect(recipient.getByRole("table")).toHaveCount(0);
        const list = recipient.getByRole("list", { name: tr.invitations.mineListLabel });
        await expect(list).toBeVisible();
        const card = list.getByRole("listitem").filter({ hasText: names.long });
        await expect(card).toBeVisible();
        await expect(card).toContainText(tr.roles.PROJECT_MANAGER);
        await expect(card).toContainText(managerNickname);
        await expect(card.locator("time")).toHaveAttribute("datetime", /^\d{4}-/);
        expect(await recipient.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await list.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        for (const button of await card.getByRole("button").all()) {
          const box = await button.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(43.5);
          expect(box!.width).toBeGreaterThan(80);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }
        await recipient.locator("#main-content").screenshot({ path: path.join(shotDir, `cards-${width}-${dark ? "dark" : "light"}.png`) });
      }
    }
    await recipient.evaluate(() => document.documentElement.classList.remove("dark"));
  });

  test("preview and reject dialogs work from a card", async () => {
    await recipient.setViewportSize({ width: 390, height: 844 });
    await recipient.goto("/tr/davetler");
    const card = recipient.getByRole("list", { name: tr.invitations.mineListLabel }).getByRole("listitem").filter({ hasText: names.long });
    await card.getByRole("button", { name: tr.invitations.minePreviewNamed.replace("{project}", names.long) }).click();
    await expect(recipient.getByRole("dialog")).toContainText(names.long);
    await recipient.keyboard.press("Escape");
    await expect(recipient.getByRole("dialog")).toHaveCount(0);
  });

  test("column labels follow the locale (TR, EN, DE) in both themes", async () => {
    await recipient.setViewportSize({ width: 1440, height: 900 });
    const locales = [
      { prefix: "tr/davetler", messages: tr },
      { prefix: "en/invitations", messages: en },
      { prefix: "de/einladungen", messages: de },
    ];
    for (const { prefix, messages } of locales) {
      await recipient.goto(`/${prefix}`);
      for (const dark of [false, true]) {
        await recipient.evaluate((value) => document.documentElement.classList.toggle("dark", value), dark);
        const table = recipient.getByRole("table");
        for (const label of [messages.invitations.mineProject, messages.invitations.columns.roles, messages.invitations.mineInviter,
          messages.invitations.mineDate, messages.invitations.columns.status, messages.invitations.columns.actions]) {
          await expect(table.getByRole("columnheader", { name: label, exact: true })).toBeVisible();
        }
        expect(await recipient.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await recipient.locator("#main-content").screenshot({ path: path.join(shotDir, `table-${prefix.slice(0, 2)}-${dark ? "dark" : "light"}.png`) });
      }
      await recipient.evaluate(() => document.documentElement.classList.remove("dark"));
    }
  });
});
