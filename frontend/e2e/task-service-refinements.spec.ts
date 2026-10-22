import { test, expect, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { api } from "./helpers";
import { psql, uuid } from "./db";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";
import type { Task } from "../src/features/tasks/types";

test.use({ storageState: MANAGER_STORAGE });
const catalogs = { tr, en, de };
async function fixture(page: Page) {
  await page.goto("/projects");
  const result = await api(page, "POST", "/projects", { name: `TSF QA ${Date.now()}` });
  expect(result.status).toBe(201);
  const project = result.json as { id: string; slug: string };
  expect((await api(page, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "BOTH" })).status).toBe(200);
  const actor = (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string };
  return { ...project, actor };
}
async function create(page: Page, project: string, title: string, ids: string[]) {
  const result = await api(page, "POST", `/projects/${project}/tasks`, { title, creationMode: "SIMPLE", assigneeIds: ids });
  expect(result.status).toBe(201); return result.json as Task;
}
async function remove(page: Page, project: string) {
  expect((await api(page, "DELETE", `/projects/${project}`)).status).toBe(204);
}
const card = (page: Page, id: string) => page.locator(`[data-task-card="${id}"]`);
async function settledScroll(list: Locator, action: () => Promise<unknown>) {
  await list.evaluate(el => {
    el.dataset.tsfScrollEnded = "0";
    el.addEventListener("scrollend", () => { el.dataset.tsfScrollEnded = "1"; }, { once: true });
  });
  await action();
  await expect.poll(() => list.getAttribute("data-tsf-scroll-ended")).toBe("1");
  return list.evaluate(el => el.scrollTop);
}

/** TEST-ONLY users belong to this newly created QA project; no login credentials are generated or exposed. */
function recipients(project: string, actor: string) {
  return JSON.parse(psql(`WITH fixture AS (SELECT gen_random_uuid() uid, gen_random_uuid() mid,n FROM generate_series(1,5) n),
    added_users AS (INSERT INTO users(id,email,nickname,password_hash,account_status,email_verification_status,global_role,email_verified_at,created_at,updated_at)
      SELECT f.uid,'tsf-'||f.uid||'@example.test','Long participant '||left(f.uid::text,15),u.password_hash,'ACTIVE','VERIFIED','USER',now(),now(),now()
      FROM fixture f CROSS JOIN users u WHERE u.id='${uuid(actor)}' RETURNING id,nickname),
    added_members AS (INSERT INTO project_memberships(id,project_id,user_id,joined_at,status)
      SELECT f.mid,'${uuid(project)}',f.uid,now(),'ACTIVE' FROM fixture f JOIN added_users u ON u.id=f.uid RETURNING id),
    added_roles AS (INSERT INTO project_membership_roles(membership_id,role) SELECT id,'TESTER' FROM added_members)
    SELECT json_agg(json_build_object('id',id,'nickname',nickname)) FROM added_users`)) as { id: string; nickname: string }[];
}

test("TSF self/other/unassigned and +N names are accessible across locales, themes and widths", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const p = await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  try {
    const others = recipients(p.id, p.actor.id);
    const task = await create(page, p.id, "TSF multi-person task", [p.actor.id, ...others.map(person => person.id)]);
    const nobody = await create(page, p.id, "TSF unassigned task", []);
    expect(task.assigners?.map(person => person.userId)).toEqual([p.actor.id]);
    expect(task.assignmentDetails?.find(row => row.userId === p.actor.id)?.assignedBy).toBe(p.actor.id);
    for (const locale of ["tr", "en", "de"] as const) for (const theme of ["light", "dark"]) {
      await page.goto(`/${locale}/projects/${p.slug}/tasks`);
      await page.evaluate(value => { document.documentElement.classList.toggle("dark", value === "dark"); document.documentElement.style.colorScheme = value; }, theme);
      for (const width of [320, 375, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const row = page.locator(`[data-task-row="${task.id}"]:visible`);
        await expect(row).toBeVisible();
        const summary = row.locator("[data-assignment-summary]");
        await expect(summary.locator("[data-assigner] [data-slot=avatar]")).toHaveCount(1);
        await expect(summary).toContainText("+3");
        const control = summary.locator("..");
        await control.focus(); await page.keyboard.press("Enter");
        const tooltip = page.getByRole("tooltip");
        await expect(tooltip).toBeVisible();
        for (const person of [p.actor, ...others]) await expect(tooltip).toContainText(person.nickname);
        await expect(control).toHaveAccessibleName(new RegExp(p.actor.nickname));
        await page.keyboard.press("Escape"); await expect(tooltip).toHaveCount(0);
        await expect(page.locator(`[data-task-row="${nobody.id}"]:visible`)).toContainText(catalogs[locale].tasks.common.unassigned);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        if (locale === "tr" && width === 320) {
          expect((await new AxeBuilder({ page }).include("#main-content").analyze()).violations).toEqual([]);
          await page.screenshot({ path: testInfo.outputPath(`assignments-${theme}-320.png`), fullPage: true });
        }
      }
    }
    expect(errors).toEqual([]);
  } finally { await remove(page, p.id); }
});

test("TSF real two-account refresh keeps exact sources, ALL ordering, open dialog and comment draft", async ({ page, browser }) => {
  test.setTimeout(140_000);
  const p = await fixture(page);
  const context = await browser.newContext({ storageState: MEMBER_STORAGE });
  const viewer = await context.newPage();
  try {
    await viewer.goto("/projects");
    const member = (await api(viewer, "GET", "/auth/me")).json as { id: string; nickname: string };
    const team = (await api(page, "POST", `/projects/${p.id}/teams`, { name: "TSF shared team" })).json as { id: string };
    const invite = (await api(page, "POST", `/projects/${p.id}/invitations`, { userId: member.id, roles: ["PROJECT_MANAGER"], teamId: team.id })).json as { invitationId: string; token: string };
    expect((await api(viewer, "POST", `/projects/${p.id}/invitations/${invite.invitationId}/accept`, { token: invite.token })).status).toBe(200);
    const task = await create(page, p.id, "TSF remote assignment", [member.id]);
    const other = await create(page, p.id, "TSF stays open", [member.id]);
    await viewer.goto(`/tasks?project=${p.id}&tab=all`);
    await expect(card(viewer, task.id)).toBeVisible();
    await card(viewer, task.id).getByRole("button", { name: new RegExp(task.title) }).click();
    const dialog = viewer.getByRole("dialog", { name: "Görev detayı", exact: true });
    await expect(dialog).toBeVisible();
    const draft = dialog.getByRole("combobox", { name: "Yorum", exact: true });
    await draft.fill("TSF unsent draft survives refresh");
    expect((await api(viewer, "PUT", `/projects/${p.id}/tasks/${task.id}/assignees`, { assigneeIds: [member.id, p.actor.id] })).status).toBe(200);
    expect((await api(page, "PATCH", `/projects/${p.id}/tasks/${task.id}/status`, { status: "IN_PROGRESS" })).status).toBe(200);
    expect((await api(page, "PATCH", `/projects/${p.id}/tasks/${task.id}/status`, { status: "DONE" })).status).toBe(200);
    await expect(card(viewer, task.id).locator("[data-assignment-summary]")).toHaveAttribute("title", new RegExp(`${member.nickname} atadı: ${p.actor.nickname}`), { timeout: 40_000 });
    await expect.poll(() => viewer.locator("[data-task-card]").evaluateAll(items => items.map(item => item.getAttribute("data-task-card")))).toEqual([other.id, task.id]);
    await expect(dialog).toBeVisible(); await expect(draft).toHaveValue("TSF unsent draft survives refresh");
    await expect(viewer).toHaveURL(new RegExp(`project=${p.id}.*task=${task.id}`));
    const actual = (await api(page, "GET", `/projects/${p.id}/tasks/${task.id}`)).json as Task;
    expect(actual.assignmentDetails?.find(row => row.userId === member.id)?.assignedBy).toBe(p.actor.id);
    expect(actual.assignmentDetails?.find(row => row.userId === p.actor.id)?.assignedBy).toBe(member.id);
    expect((await api(page, "PATCH", `/projects/${p.id}/tasks/${task.id}/status`, { status: "IN_PROGRESS" })).status).toBe(200);
    await expect.poll(() => viewer.locator("[data-task-card]").evaluateAll(items => items.map(item => item.getAttribute("data-task-card"))), { timeout: 40_000 }).toEqual([task.id, other.id]);
    await expect(draft).toHaveValue("TSF unsent draft survives refresh");
    await viewer.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
    await viewer.getByRole("tab", { name: "Tablo", exact: true }).click();
    await expect(viewer.locator(`[data-task-row="${task.id}"]:visible [data-assignment-summary]`)).toHaveAttribute("title", /atadı/);
    expect((await api(page, "PUT", `/projects/${p.id}/tasks/${task.id}/assignees`, { assigneeIds: [p.actor.id] })).status).toBe(200);
    await expect(viewer.locator(`[data-task-row="${task.id}"]:visible`)).toHaveCount(0, { timeout: 40_000 });
  } finally { await context.close(); await remove(page, p.id); }
});

test("TSF Kanban shares scrollbar tokens and preserves keyboard, wheel, touch, drag and polling scroll", async ({ page, browser }, testInfo) => {
  test.setTimeout(140_000);
  const p = await fixture(page);
  try {
    const first = await create(page, p.id, "TSF draggable", [p.actor.id]);
    let refreshed = first;
    for (let i = 0; i < 14; i++) refreshed = await create(page, p.id, `TSF board ${i}`, [p.actor.id]);
    await create(page, p.id, "TSF short column", []);
    await page.goto(`/tr/projects/${p.slug}/tasks/board`);
    const column = page.getByRole("region", { name: new RegExp(tr.tasks.common.status.BACKLOG) });
    const scroller = column.locator("ul[data-workspace-scroll]");
    await expect(scroller).toBeVisible();
    for (const locale of ["tr", "en", "de"]) for (const theme of ["light", "dark"]) {
      await page.goto(`/${locale}/projects/${p.slug}/tasks/board`);
      await page.evaluate(value => document.documentElement.classList.toggle("dark", value === "dark"), theme);
      const list = page.locator("[data-testid=board-grid] ul[data-workspace-scroll]").first();
      for (const width of [320, 375, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(list).toBeVisible();
        const style = await list.evaluate(el => ({ width: getComputedStyle(el).scrollbarWidth, color: getComputedStyle(el).scrollbarColor, root: getComputedStyle(document.documentElement).scrollbarColor, over: getComputedStyle(el).overscrollBehaviorY, scrollable: el.scrollHeight > el.clientHeight }));
        expect(style.width).toBe("thin"); expect(style.color).toBe(style.root); expect(style.over).toBe("contain"); expect(style.scrollable).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      }
    }
    await page.goto(`/tr/projects/${p.slug}/tasks/board`);
    await page.setViewportSize({ width: 1440, height: 900 });
    await scroller.focus();
    expect(await settledScroll(scroller, () => page.keyboard.press("PageDown"))).toBeGreaterThan(0);
    const beforeWheel = await scroller.evaluate(el => el.scrollTop);
    await scroller.hover();
    const top = await settledScroll(scroller, () => page.mouse.wheel(0, 250));
    expect(top).toBeGreaterThan(beforeWheel);
    expect((await api(page, "PATCH", `/projects/${p.id}/tasks/${refreshed.id}`, { title: "TSF background edit", priority: "MEDIUM" })).status).toBe(200);
    await expect(scroller.getByRole("link", { name: "TSF background edit", exact: true })).toHaveCount(1, { timeout: 40_000 });
    expect(await scroller.evaluate(el => el.scrollTop)).toBe(top);
    await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const dragged = column.getByRole("link", { name: first.title, exact: true }).locator("..");
    const target = page.getByRole("region", { name: new RegExp(tr.tasks.common.status.TODO) });
    await dragged.dragTo(target);
    const confirmation = page.getByRole("dialog", { name: /görevinin durumu değiştirilsin mi/ });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Durumu güncelle", exact: true }).click();
    await expect(target.getByRole("link", { name: first.title, exact: true })).toBeVisible();
    await expect(target.locator("ul[data-workspace-scroll]")).toHaveAttribute("tabindex", "0");
    expect(await target.locator("ul[data-workspace-scroll]").evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("board-scroll-dark.png"), fullPage: true });
    const touchContext = await browser.newContext({ storageState: MANAGER_STORAGE, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    try {
      const phone = await touchContext.newPage();
      await phone.goto(`/tr/projects/${p.slug}/tasks/board`);
      const touchList = phone.locator("[data-testid=board-grid] ul[data-workspace-scroll]").first();
      const summary = touchList.locator("[data-assignment-summary]").first().locator("..");
      await summary.tap();
      await expect(phone.getByRole("tooltip")).toBeVisible();
      await expect(phone.getByRole("tooltip")).toContainText(p.actor.nickname);
      await phone.screenshot({ path: testInfo.outputPath("board-touch-details-375.png") });
      await phone.getByRole("heading", { name: tr.tasks.common.status.BACKLOG, exact: true }).tap();
      await expect(phone.getByRole("tooltip")).toHaveCount(0);
      await touchList.scrollIntoViewIfNeeded();
      const box = (await touchList.boundingBox())!;
      const cdp = await touchContext.newCDPSession(phone);
      const x = box.x + 12;
      const from = box.y + Math.min(300, box.height - 20);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: from }] });
      for (let i = 1; i <= 10; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: from - 200 * i / 10 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect.poll(() => touchList.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
      await phone.screenshot({ path: testInfo.outputPath("board-touch-375.png") });
    } finally { await touchContext.close(); }
  } finally { await remove(page, p.id); }
});
