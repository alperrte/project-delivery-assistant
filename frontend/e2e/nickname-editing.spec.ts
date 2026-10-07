import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { api, login } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE, MANAGER_USER_FILE, MEMBER_USER_FILE } from "./global-setup";
import { normalizeNickname, validNickname, nicknameIdentityQuery } from "../src/features/account/nickname";

function dbNickname(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("Invalid QA UUID");
  const cid = execFileSync("docker", ["compose", "ps", "-q", "postgres"], { cwd: path.resolve(__dirname, "../.."), encoding: "utf8" }).trim();
  const args: string[] = JSON.parse(execFileSync("docker", ["inspect", "--format", "{{json .Config.Cmd}}", cid], { encoding: "utf8" }));
  const port = args.indexOf("-p") >= 0 ? args[args.indexOf("-p") + 1] : "5432";
  return execFileSync("docker", ["exec", cid, "sh", "-c", 'psql -p "$1" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAtc "$2"', "qa", port,
    `PREPARE nickname_qa(uuid) AS SELECT nickname FROM users WHERE id=$1; EXECUTE nickname_qa('${id}');`], { encoding: "utf8" }).trim();
}

test("nickname normalization and cache scope preserve exact identity rules", () => {
  expect(normalizeNickname("\u00a0İpek_Çelik\u00a0")).toBe("İpek_Çelik");
  for (const value of ["İpek_Çelik", "𐐀".repeat(3), "a".repeat(32)]) expect(validNickname(value)).toBe(true);
  for (const value of ["ab", "a".repeat(33), "x-y", "cafe\u0301", "\ufeffname"]) expect(validNickname(value)).toBe(false);
  expect(nicknameIdentityQuery(["projects", "p", "members", "all"], "A")).toBe(true);
  expect(nicknameIdentityQuery(["projects", "p", "criteria"], "A")).toBe(false);
  expect(nicknameIdentityQuery(["tasks", "counts"], "A")).toBe(false);
  expect(nicknameIdentityQuery(["notifications", "actor", "B", "list"], "A")).toBe(false);
});

test("late real rename response never overwrites the next account", async ({ browser }) => {
  const context = await browser.newContext({ storageState: MANAGER_STORAGE }), page = await context.newPage();
  const cleanup = await browser.newContext({ storageState: MANAGER_STORAGE }), owner = await cleanup.newPage();
  const manager = JSON.parse(readFileSync(MANAGER_USER_FILE, "utf8")), member = JSON.parse(readFileSync(MEMBER_USER_FILE, "utf8"));
  let release!: () => void, arrived!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; }), seen = new Promise<void>(resolve => { arrived = resolve; });
  try {
    await login(page, manager.email, manager.password); await page.goto("/account");
    // TEST-ONLY late delivery of the actual successful server response; no fabricated success body.
    await page.route("**/api/v1/users/me/profile", async route => {
      const response = await route.fetch(); arrived(); await held; await route.fulfill({ response }).catch(() => undefined);
    });
    await page.getByRole("textbox", { name: "Kullanıcı adı", exact: true }).fill(`late_${Date.now()}`);
    await page.getByRole("button", { name: "Kullanıcı adını kaydet", exact: true }).click(); await seen;
    await page.mouse.move(2, 2); await page.getByRole("button", { name: /Hesap menüsü/ }).click(); await page.getByRole("menuitem", { name: "Çıkış yap", exact: true }).click();
    await page.locator('input[name="email"]').fill(member.email); await page.locator('input[name="password"]').fill(member.password);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click(); await expect(page.locator("#main-content")).toBeVisible();
    release(); await page.unroute("**/api/v1/users/me/profile");
    await page.mouse.move(2, 2); await page.getByRole("button", { name: /Hesap menüsü/ }).click(); await page.getByRole("menuitem", { name: "Hesap ayarları", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Kullanıcı adı", exact: true })).toHaveValue(member.nickname);
    expect((await api(page, "GET", "/auth/me")).json).toMatchObject({ nickname: member.nickname });
    await expect(page.getByText("Kullanıcı adı güncellendi.", { exact: true })).toHaveCount(0);
  } finally {
    release?.(); await owner.goto("/account"); await api(owner, "PUT", "/users/me/profile", { nickname: manager.nickname });
    await context.close(); await cleanup.close();
  }
});

test("real nickname save updates session and warm team/chat identity without resetting draft or document", async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ storageState: MANAGER_STORAGE }), page = await context.newPage();
  const memberContext = await browser.newContext({ storageState: MEMBER_STORAGE }), member = await memberContext.newPage();
  await page.goto("/projects"); const original = (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string };
  const project = (await api(page, "POST", "/projects", { name: `Nickname QA ${Date.now()}`, projectType: "WEB" })).json as { id: string; slug: string };
  const wanted = `name_${Date.now()}`;
  try {
    const team = (await api(page, "POST", `/projects/${project.id}/teams`, { name: "Nickname team", includeCreator: true })).json as { id: string };
    const person = JSON.parse(readFileSync(MEMBER_USER_FILE, "utf8")); await member.goto("/projects");
    const recipient = (await api(member, "GET", "/auth/me")).json as { id: string };
    const invite = (await api(page, "POST", `/projects/${project.id}/invitations`, { userId: recipient.id, teamId: team.id, roles: ["TESTER"] })).json as { invitationId: string };
    expect((await api(member, "POST", `/project-invitations/${invite.invitationId}/accept`)).status).toBe(200);
    await page.goto(`/projects/${project.slug}?section=teams`);
    await expect(page.locator("article").filter({ hasText: "Nickname team" })).toContainText(original.nickname);
    await page.getByTestId("chat-nav-item").click(); await expect(page.getByTestId("chat-panel")).toBeVisible();
    await expect(page.getByTestId("chat-composer")).toBeEnabled();
    await page.getByTestId("chat-composer").fill("persistent nickname draft"); await page.getByTestId("chat-minimize").click();
    await page.getByTestId("chat-bar-expand").click(); await expect(page.getByTestId("chat-compact")).toBeVisible();
    await page.evaluate(() => { (window as unknown as { nicknameDocument: number }).nicknameDocument = 17; });
    await page.mouse.move(2, 2); await page.getByRole("button", { name: /Hesap menüsü/ }).click(); await page.getByRole("menuitem", { name: "Hesap ayarları", exact: true }).click();
    const field = page.getByRole("textbox", { name: "Kullanıcı adı", exact: true });
    await expect(field).toHaveValue(original.nickname); await field.fill(wanted);
    await page.getByRole("button", { name: "Kullanıcı adını kaydet", exact: true }).click();
    await expect(page.getByText("Kullanıcı adı güncellendi.", { exact: true })).toBeVisible();
    expect(dbNickname(original.id)).toBe(wanted);
    expect((await api(page, "GET", "/auth/me")).json).toMatchObject({ id: original.id, nickname: wanted });
    await expect(page.locator("header").getByRole("button", { name: new RegExp(wanted) })).toBeAttached();
    await expect(page.getByTestId("chat-compact")).toBeVisible(); await expect(page.getByTestId("chat-composer")).toHaveValue("persistent nickname draft");
    expect(await page.evaluate(() => (window as unknown as { nicknameDocument: number }).nicknameDocument)).toBe(17);
    await page.locator(`.app-shell a[href="/tr/projeler/${project.slug}?section=teams"]`).first().click();
    await expect(page.locator("article").filter({ hasText: "Nickname team" })).toContainText(wanted);
    expect(await page.evaluate(() => (window as unknown as { nicknameDocument: number }).nicknameDocument)).toBe(17);
    await page.goto("/account"); await expect(field).toHaveValue(wanted);
    await field.fill(person.nickname); await page.getByRole("button", { name: "Kullanıcı adını kaydet", exact: true }).click();
    await expect(page.locator("form").filter({ has: field }).getByRole("alert")).toContainText("Bu kullanıcı adı kullanılıyor.");
    expect(dbNickname(original.id)).toBe(wanted);
  } finally { await api(page, "PUT", "/users/me/profile", { nickname: original.nickname }); await api(page, "POST", `/projects/${project.id}/archive`); await context.close(); await memberContext.close(); }
});

test("rename refreshes real task/invitation projections while committed notification snapshots keep their original actor", async ({ browser }) => {
  const context = await browser.newContext({ storageState: MANAGER_STORAGE }), page = await context.newPage(), recipientContext = await browser.newContext({ storageState: MEMBER_STORAGE }), recipient = await recipientContext.newPage();
  await page.goto("/projects"); await recipient.goto("/projects");
  const actor = (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string };
  const person = (await api(recipient, "GET", "/auth/me")).json as { id: string };
  const project = (await api(page, "POST", "/projects", { name: `Identity projections QA ${Date.now()}`, projectType: "WEB" })).json as { id: string; slug: string };
  try {
    const backup = (await api(page, "POST", `/projects/${project.id}/teams`, { name: "Identity backup", includeCreator: true })).json as { id: string };
    const target = (await api(page, "POST", `/projects/${project.id}/teams`, { name: "Snapshot before rename", includeCreator: true })).json as { id: string };
    const invitation = (await api(page, "POST", `/projects/${project.id}/invitations`, { teamId: backup.id, userId: person.id, roles: ["TESTER"] })).json as { invitationId: string };
    expect((await api(recipient, "POST", `/project-invitations/${invitation.invitationId}/accept`)).status).toBe(200);
    expect((await api(page, "POST", `/projects/${project.id}/teams/${target.id}/members`, { userId: person.id })).status).toBe(201);
    expect((await api(page, "DELETE", `/projects/${project.id}/teams/${target.id}`)).status).toBe(204);
    expect((await api(page, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "SIMPLE" })).status).toBe(200);
    const task = (await api(page, "POST", `/projects/${project.id}/tasks`, { title: "Live nickname task", creationMode: "SIMPLE", assigneeIds: [actor.id] })).json as { id: string };
    await page.goto("/account"); const wanted = `projection_${Date.now()}`;
    await page.getByRole("textbox", { name: "Kullanıcı adı", exact: true }).fill(wanted); await page.getByRole("button", { name: "Kullanıcı adını kaydet", exact: true }).click();
    await expect(page.getByText("Kullanıcı adı güncellendi.", { exact: true })).toBeVisible();
    expect((await api(page, "GET", `/projects/${project.id}/tasks/${task.id}`)).json).toMatchObject({ createdByName: wanted });
    const invitations = (await api(page, "GET", `/projects/${project.id}/invitations/all?status=ACCEPTED`)).json as { content: { invitedByNickname: string }[] };
    expect(invitations.content[0].invitedByNickname).toBe(wanted);
    const history = (await api(recipient, "GET", "/notifications?type=SQUAD_DELETED&size=100")).json as { content: { resourceId: string; teamDeletion: { actorNickname: string } }[] };
    expect(history.content.find(note => note.resourceId === target.id)?.teamDeletion.actorNickname).toBe(actor.nickname);
    expect(dbNickname(actor.id)).toBe(wanted);
  } finally { await api(page, "PUT", "/users/me/profile", { nickname: actor.nickname }); await api(page, "POST", `/projects/${project.id}/archive`); await context.close(); await recipientContext.close(); }
});
