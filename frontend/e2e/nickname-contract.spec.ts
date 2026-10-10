import { test, expect, type Page } from "@playwright/test";
import { api, login, registerUser, uniqueUser } from "./helpers";
import { REJECTED_STATE } from "./consent-state";
import { hasConsecutiveSpaces, nicknameIdentityQuery, nicknameProblem, normalizeNickname, validNickname } from "../src/features/account/nickname";
import { activeMention, encodeMentions, insertMention } from "../src/features/tasks/mentions";

/**
 * Nickname contract: Unicode letters/digits, `_`, `-` and single spaces between words, 3-32 characters, trimmed first,
 * consecutive spaces and other whitespace/invisible characters rejected. These specs pin the shared frontend rule, then
 * prove the real backend gives the same verdict for register and profile rename, and that a rename reaches every
 * surface that shows it without a reload.
 */

const VALID = ["Hamza", "Hamza Taşbay", "hamza_tasbay", "hamza-tasbay", "Hamza Taşbay 27", "Hamza_Taşbay-27", "Çağrı Öztürk", "Ali Veli", "Ayşe-Nur", "İpek_Çelik", "𐐀".repeat(3), "a".repeat(32), "ab c".repeat(8)];
const INVALID = [
  "ab", "", "   ", "a".repeat(33), "Hamza  Taşbay", "Hamza   Taşbay", "Hamza\tTaşbay", "Hamza\nTaşbay", "Hamza Taşbay", "Hamza Taşbay",
  "Ha​mza", "Ha‍mza", "Ha﻿mza", "Ha⁠mza", "Ha\u0007mza", "<script>", "a@b", "a.b", "😀😀😀", "Ha😀mza", "café", "﻿name",
];

test("frontend nickname rule matches the contract and reports consecutive spaces separately", () => {
  for (const value of VALID) expect(validNickname(value), JSON.stringify(value)).toBe(true);
  for (const value of INVALID) expect(validNickname(value), JSON.stringify(value)).toBe(false);
  expect(normalizeNickname("  Hamza Taşbay  ")).toBe("Hamza Taşbay");
  expect(normalizeNickname("\t  Hamza Taşbay  \n")).toBe("Hamza Taşbay");
  expect(normalizeNickname("Hamza  Taşbay")).toBe("Hamza  Taşbay");
  expect(validNickname("  Hamza Taşbay  ")).toBe(true);
  expect(validNickname("  Hamza  Taşbay  ")).toBe(false);
  expect(nicknameProblem("Hamza Taşbay")).toBeNull();
  expect(nicknameProblem("  Hamza Taşbay  ")).toBeNull();
  expect(nicknameProblem("Hamza  Taşbay")).toBe("spaces");
  expect(nicknameProblem(" Hamza   Taşbay ")).toBe("spaces");
  expect(nicknameProblem("Hamza\tTaşbay")).toBe("invalid");
  expect(nicknameProblem("ab")).toBe("invalid");
  expect(hasConsecutiveSpaces("a  b")).toBe(true);
  expect(hasConsecutiveSpaces("a b")).toBe(false);
});

test("rename invalidates every surface that shows member nicknames and nothing unrelated", () => {
  const me = "A";
  for (const key of [
    ["projects", 0], ["projects", 3], ["projects", "dashboard"], ["projects", "by-slug", "slug"], ["projects", "detail", "id"],
    ["project-home", "id"], ["projects", "id", "home"], ["projects", "id", "members", 0], ["projects", "id", "squads", "all"],
    ["projects", "id", "chat", "overview"], ["projects", "id", "reminders", "2026-10-01", "2026-10-31"], ["projects", "id", "tasks", "list"],
    ["organizations", "projects", "org", 0], ["admin", me, "users", 0, 20, "", "ALL"], ["tasks", "mine"], ["tasks", "pool"],
    ["projects", "id", "invitations", me], ["project-invitations", me], ["notifications", me],
  ] as const) expect(nicknameIdentityQuery(key, me), JSON.stringify(key)).toBe(true);
  for (const key of [
    ["projects", "id", "criteria"], ["projects", "id", "tasks", "counts"], ["projects", "global-search"], ["projects", "calendar-switcher"],
    ["session"], ["admin", "B", "users", 0], ["admin", me, "analytics", "a", "b", "c"], ["organizations", "detail", "org"],
    ["notifications", "B"], ["projects", "id", "invitations", "B"], ["tasks", "counts"],
  ] as const) expect(nicknameIdentityQuery(key, me), JSON.stringify(key)).toBe(false);
});

test("mention suggestions follow names with single spaces and hyphens, and encoding keeps the longest name", () => {
  const ali = { userId: "11111111-1111-4111-8111-111111111111", nickname: "Ali" };
  const aliVeli = { userId: "22222222-2222-4222-8222-222222222222", nickname: "Ali Veli" };
  const ayse = { userId: "33333333-3333-4333-8333-333333333333", nickname: "Ayşe-Nur" };
  const end = (text: string) => activeMention(text, text.length);

  expect(end("hi @")).toEqual({ start: 3, query: "" });
  expect(end("hi @Ali")).toEqual({ start: 3, query: "Ali" });
  expect(end("hi @Ali Ve")).toEqual({ start: 3, query: "Ali Ve" });
  expect(end("hi @Ali ")).toEqual({ start: 3, query: "Ali " });
  expect(end("hi @Ayşe-N")).toEqual({ start: 3, query: "Ayşe-N" });
  expect(end("hi @Ali  Veli")).toBeNull();
  expect(end("hi @Ali\nVeli")).toBeNull();
  expect(end("hi @ Ali")).toBeNull();
  expect(end("write to me@example")).toBeNull();
  expect(end(`@${"a".repeat(32)}`)).not.toBeNull();
  expect(end(`@${"a".repeat(33)}`)).toBeNull();
  expect(end(`@${"ab c".repeat(8)}`)).not.toBeNull();
  expect(activeMention("hi @Ali Veli and more", 7)).toEqual({ start: 3, query: "Ali" });

  const picked = insertMention("hi @Ali V", 9, 3, "Ali Veli");
  expect(picked).toEqual({ text: "hi @Ali Veli ", caret: 13 });
  expect(end(picked.text)).toEqual({ start: 3, query: "Ali Veli " });

  const both = [ali, aliVeli, ayse];
  expect(encodeMentions("@Ali Veli selam", both)).toBe(`@[${aliVeli.userId}] selam`);
  expect(encodeMentions("@Ali selam", both)).toBe(`@[${ali.userId}] selam`);
  expect(encodeMentions("@Ali Veli ", both)).toBe(`@[${aliVeli.userId}] `);
  expect(encodeMentions("@Ali, @Ali Veli.", both)).toBe(`@[${ali.userId}], @[${aliVeli.userId}].`);
  expect(encodeMentions("@Ali Velix", both)).toBe(`@[${ali.userId}] Velix`);
  expect(encodeMentions("@Ayşe-Nur ve @Ali", both)).toBe(`@[${ayse.userId}] ve @[${ali.userId}]`);
  expect(encodeMentions("@Ali Veli", [ali])).toBe(`@[${ali.userId}] Veli`);
  expect(encodeMentions("@Ali", [aliVeli])).toBe("@Ali");
  expect(encodeMentions("@Ali-Veli", [ali])).toBe("@Ali-Veli");
  expect(encodeMentions("x@Ali", [ali])).toBe("x@Ali");
  expect(encodeMentions("@Ali Veli", [])).toBe("@Ali Veli");
});

async function expectRegisterBlocked(page: Page, nickname: string, message: RegExp, email: string) {
  let sent = 0;
  const count = (request: { url(): string; method(): string }) => { if (request.method() === "POST" && request.url().endsWith("/auth/register")) sent += 1; };
  page.on("request", count);
  await page.goto("/register");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="nickname"]').fill(nickname);
  await page.locator('input[name="password"]').fill("E2ePassword1!");
  await page.locator('input[name="confirmPassword"]').fill("E2ePassword1!");
  await page.getByRole("button", { name: /^Kayıt ol$/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
  await expect(page.locator('input[name="nickname"]')).toHaveAttribute("aria-invalid", "true");
  expect(sent).toBe(0);
  page.off("request", count);
}

test("register trims a spaced name, blocks ambiguous ones with the right message, and the backend agrees on rename", async ({ page }) => {
  test.setTimeout(120_000);
  const tag = `${Date.now()}`.slice(-9);
  const user = uniqueUser("contract");

  await expectRegisterBlocked(page, "Hamza  Taşbay", /art arda boşluk olamaz/, user.email);
  await expectRegisterBlocked(page, "Hamza\tTaşbay", /3-32 karakter; harf, rakam, tek boşluk/, user.email);
  await expectRegisterBlocked(page, "Hamza Taşbay", /3-32 karakter; harf, rakam, tek boşluk/, user.email);
  await expectRegisterBlocked(page, "Ha​mza", /3-32 karakter; harf, rakam, tek boşluk/, user.email);
  await expectRegisterBlocked(page, "ab", /3-32 karakter; harf, rakam, tek boşluk/, user.email);

  const wanted = `Çağrı Öz ${tag}`;
  const sent = page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/auth/register"));
  await registerUser(page, { ...user, nickname: `  ${wanted}  ` });
  // The form submits the trimmed value, not the padded input.
  expect((JSON.parse((await sent).postData() ?? "{}") as { nickname: string }).nickname).toBe(wanted);
  const me = (await api(page, "GET", "/auth/me")).json as { id: string; nickname: string };
  expect(me.nickname).toBe(wanted);
  await expect(page.locator("header").getByRole("button", { name: /Hesap menüsü/ })).toContainText(wanted);

  // Login is still by e-mail, and the stored name is exactly the trimmed one.
  await page.context().clearCookies();
  await login(page, user.email, user.password);
  expect(((await api(page, "GET", "/auth/me")).json as { id: string; nickname: string })).toMatchObject({ id: me.id, nickname: wanted });

  // The real backend must give the same verdict as the shared frontend rule for every value.
  const rename = (nickname: string) => api(page, "PUT", "/users/me/profile", { nickname });
  for (const value of INVALID) {
    const result = await rename(value);
    expect(result.status, JSON.stringify(value)).toBe(400);
    expect(result.json, JSON.stringify(value)).toMatchObject({ code: "NICKNAME_INVALID" });
  }
  let n = 0;
  for (const base of VALID) {
    // A short unique suffix keeps names unique across runs; names that are already at the length limit stay as they are.
    const suffix = ` ${tag}${++n}`;
    const value = Array.from(base).length + suffix.length <= 32 ? `${base}${suffix}` : base;
    const result = await rename(value);
    if (value === base && result.status === 409) continue; // already taken by an earlier run: the rule itself accepted it
    expect(result.status, JSON.stringify(value)).toBe(200);
    expect(result.json, JSON.stringify(value)).toMatchObject({ nickname: value });
  }
  const padded = `Hamza Taşbay ${tag}`;
  const trimmed = await rename(`\t  ${padded}   `);
  expect(trimmed.status).toBe(200);
  expect(trimmed.json).toMatchObject({ nickname: padded });
  expect((await api(page, "GET", "/auth/me")).json).toMatchObject({ id: me.id, nickname: padded });
  expect((await rename(`Hamza  Taşbay ${tag}`)).status).toBe(400);
});

test("profile field shows the distinct consecutive-space message in every language and saves a trimmed spaced name", async ({ page }) => {
  const tag = `${Date.now()}`.slice(-9);
  const user = uniqueUser("field");
  await registerUser(page, { ...user, nickname: `Alan Adı ${tag}` });
  await page.mouse.move(700, 8);
  await page.getByRole("button", { name: /Hesap menüsü/ }).click();
  await page.getByRole("menuitem", { name: "Hesap ayarları" }).click();
  const field = page.getByRole("textbox", { name: "Kullanıcı adı", exact: true });
  const save = page.getByRole("button", { name: "Kullanıcı adını kaydet", exact: true });
  const form = page.locator("form").filter({ has: field });
  await expect(form).toContainText("tek boşluk");
  await field.fill(`Yeni  Ad ${tag}`);
  await expect(form.getByRole("alert")).toContainText("Art arda boşluk kullanılamaz");
  await expect(save).toBeDisabled();
  await field.fill(`Yeni\tAd ${tag}`);
  await expect(form.getByRole("alert")).toContainText("3–32 karakter; harf, rakam, tek boşluk");
  await field.fill(`  Yeni Ad ${tag}  `);
  await expect(form.getByRole("alert")).toHaveCount(0);
  await save.click();
  await expect(page.getByText("Kullanıcı adı güncellendi.", { exact: true })).toBeVisible();
  await expect(field).toHaveValue(`Yeni Ad ${tag}`);
  expect((await api(page, "GET", "/auth/me")).json).toMatchObject({ nickname: `Yeni Ad ${tag}` });
  await expect(page.locator("header").getByRole("button", { name: /Hesap menüsü/ })).toContainText(`Yeni Ad ${tag}`);

  for (const [locale, space, tab] of [["en", "Consecutive spaces are not allowed", "3–32 characters: letters, digits, single spaces"], ["de", "Aufeinanderfolgende Leerzeichen sind nicht erlaubt", "3–32 Zeichen: Buchstaben, Ziffern, einzelne Leerzeichen"]] as const) {
    await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    await page.goto("/account");
    const localized = page.locator("#main-content form").filter({ has: page.locator('input[name="nickname"]') });
    await localized.locator('input[name="nickname"]').fill(`New  Name ${tag}`);
    await expect(localized.getByRole("alert")).toContainText(space);
    await localized.locator('input[name="nickname"]').fill(`New\tName ${tag}`);
    await expect(localized.getByRole("alert")).toContainText(tab);
  }
});

test("renaming to a spaced name updates navbar, account, project list and team surfaces without a reload", async ({ page }) => {
  test.setTimeout(150_000);
  const tag = `${Date.now()}`.slice(-9);
  const oldName = `Eski Ad ${tag}`, newName = `Çağrı Öztürk ${tag}`.slice(0, 32);
  await registerUser(page, { ...uniqueUser("rename"), nickname: oldName });
  const project = (await api(page, "POST", "/projects", { name: `Rename surfaces ${tag}`, projectType: "WEB" })).json as { id: string; slug: string };
  expect((await api(page, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "BOTH" })).status).toBe(200);
  const team = await api(page, "POST", `/projects/${project.id}/teams`, { name: "Rename team", includeCreator: true });
  expect(team.status).toBe(201);

  // Warm the caches the rename must refresh inside one document: the project list card and the team page.
  const openTeams = async () => {
    const teamsDisclosure = page.getByRole("navigation", { name: "Gezinme menüsü" }).getByRole("button", { name: "Ekipler", exact: true });
    if (await teamsDisclosure.count()) {
      if ((await teamsDisclosure.getAttribute("aria-expanded")) !== "true") await teamsDisclosure.click();
    }
    await page.locator(`.app-shell a[href="/tr/projeler/${project.slug}/ekipler"]`).first().click();
    await expect(page.locator("article").filter({ hasText: "Rename team" })).toBeVisible();
  };
  await page.goto("/projects");
  const card = page.locator("article").filter({ hasText: `Rename surfaces ${tag}` });
  await expect(card).toContainText(oldName);
  await page.evaluate(() => { (window as unknown as { renameDocument: number }).renameDocument = 31; });
  await card.getByRole("link").first().click();
  await expect(page).toHaveURL(new RegExp(`/tr/projeler/${project.slug}`));
  await openTeams();
  await expect(page.locator("article").filter({ hasText: "Rename team" })).toContainText(oldName);

  await page.mouse.move(700, 8);
  await page.getByRole("button", { name: /Hesap menüsü/ }).click();
  await page.getByRole("menuitem", { name: "Hesap ayarları" }).click();
  const field = page.getByRole("textbox", { name: "Kullanıcı adı", exact: true });
  await expect(field).toHaveValue(oldName);
  await field.fill(newName);
  await page.getByRole("button", { name: "Kullanıcı adını kaydet", exact: true }).click();
  await expect(page.getByText("Kullanıcı adı güncellendi.", { exact: true })).toBeVisible();

  await expect(page.locator("header").getByRole("button", { name: /Hesap menüsü/ })).toContainText(newName);
  await expect(field).toHaveValue(newName);

  // Team page through the sidebar (client-side navigation).
  await openTeams();
  await expect(page.locator("article").filter({ hasText: "Rename team" })).toContainText(newName);

  // Project list through the sidebar (client-side navigation): the cached card must show the new name.
  await page.locator('.app-shell a[href="/tr/projeler"]').first().click();
  await expect(card).toContainText(newName);
  await expect(card).not.toContainText(oldName);
  expect(await page.evaluate(() => (window as unknown as { renameDocument: number }).renameDocument)).toBe(31);
});

test("a comment mention resolves to a member whose nickname contains a space", async ({ browser }) => {
  test.setTimeout(150_000);
  const tag = `${Date.now()}`.slice(-9);
  const managerContext = await browser.newContext({ storageState: REJECTED_STATE }), memberContext = await browser.newContext({ storageState: REJECTED_STATE });
  const manager = await managerContext.newPage(), member = await memberContext.newPage();
  const memberName = `Çağrı Öz ${tag}`;
  try {
    await registerUser(manager, { ...uniqueUser("mentionm"), nickname: `Yönetici ${tag}` });
    await registerUser(member, { ...uniqueUser("mentiont"), nickname: memberName });
    const memberId = ((await api(member, "GET", "/auth/me")).json as { id: string }).id;
    const project = (await api(manager, "POST", "/projects", { name: `Mention spaces ${tag}`, projectType: "WEB" })).json as { id: string; slug: string };
    expect((await api(manager, "PATCH", `/projects/${project.id}/task-management-mode`, { mode: "SIMPLE" })).status).toBe(200);
    const team = (await api(manager, "POST", `/projects/${project.id}/teams`, { name: "Mention team", includeCreator: true })).json as { id: string };
    const invite = (await api(manager, "POST", `/projects/${project.id}/invitations`, { userId: memberId, teamId: team.id, roles: ["TESTER"] })).json as { invitationId: string; token: string };
    expect((await api(member, "POST", `/projects/${project.id}/invitations/${invite.invitationId}/accept`, { token: invite.token })).status).toBe(200);
    const task = (await api(manager, "POST", `/projects/${project.id}/tasks`, { title: `Mention task ${tag}`, creationMode: "SIMPLE", assigneeIds: [] })).json as { id: string };

    await manager.goto(`/projects/${project.slug}/tasks/${task.id}`);
    const box = manager.getByRole("combobox", { name: "Yorum" });
    await box.click();
    // The popup stays open across the single space in the name and offers the member.
    await box.pressSequentially("Bakar mısın @Çağrı Ö");
    const option = manager.getByRole("option", { name: new RegExp(`@${memberName}`) });
    await expect(option).toBeVisible();
    await option.click();
    await expect(box).toHaveValue(`Bakar mısın @${memberName} `);
    await box.pressSequentially("bu iş sende.");
    await manager.getByRole("button", { name: /^Yorum yap$/ }).click();
    await expect(manager.getByText("bu iş sende.")).toBeVisible();

    const fetchComment = async () => ((await api(manager, "GET", `/projects/${project.id}/tasks/${task.id}/comments`)).json as { content: { body: string | null; mentions: { userId: string; nickname: string }[] }[] }).content.find(item => item.body?.includes("bu iş sende"));
    await expect.poll(async () => !!(await fetchComment())).toBe(true);
    const comment = (await fetchComment())!;
    expect(comment.body).toBe(`Bakar mısın @[${memberId}] bu iş sende.`);
    expect(comment.mentions).toMatchObject([{ userId: memberId, nickname: memberName }]);
    await expect(manager.getByText(`@${memberName}`, { exact: true }).first()).toBeVisible();
    await expect
      .poll(async () => ((await api(member, "GET", "/notifications?type=TASK_MENTIONED")).json as { content: { resourceId: string }[] }).content.some(item => item.resourceId === task.id))
      .toBe(true);
  } finally {
    await managerContext.close();
    await memberContext.close();
  }
});
