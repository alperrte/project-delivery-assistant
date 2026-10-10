import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { api, login, uniqueUser } from "./helpers";
import { AUTH_DIR, MANAGER_STORAGE, MEMBER_USER_FILE } from "./global-setup";
import { memberIdentityInDatabase } from "./team-deletion-db";

test("real onboarding names reach the team card without member requests; 101 teams use server pages", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ storageState: MANAGER_STORAGE });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.goto("/tr/projeler");
  const created = await api(page, "POST", "/projects", { name: `Preview QA ${Date.now()}`, projectType: "WEB" });
  expect(created.status).toBe(201);
  const project = created.json as { id: string; slug: string };
  const actor=(await api(page,"GET","/auth/me")).json as {id:string};
  const peopleContexts = [];
  try {
    const backup = (await api(page, "POST", `/projects/${project.id}/teams`, { name: "Preview backup", includeCreator: true })).json as { id: string };
    const target = (await api(page, "POST", `/projects/${project.id}/teams`, { name: "Named preview", includeCreator: true })).json as { id: string };
    for (const [firstName, lastName] of [["Alper", "Temiz"], ["Nisa", "Camcı"], ["Mehmet Ali", "Yılmaz"]]) {
      const fullName = `${firstName} ${lastName}`;
      const user = uniqueUser("preview");
      const invitation = await api(page, "POST", `/projects/${project.id}/invitations`, { teamId: backup.id, email: user.email, firstName, lastName, roles: ["TESTER"] });
      expect(invitation.status).toBe(201);
      const personContext = await browser.newContext(); peopleContexts.push(personContext);
      const person = await personContext.newPage(); await person.goto("/tr/giris");
      expect((await api(person, "POST", "/auth/register/invitation", { ...user, firstName, lastName, token: (invitation.json as { token: string }).token, confirmPassword: user.password })).status).toBe(200);
      await login(person, user.email, user.password);
      await person.goto("/account");
      await person.getByTestId("profile-photo-input").setInputFiles({ name: "preview.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") });
      await person.getByRole("button", { name: "Fotoğrafı kaydet", exact: true }).click();
      await expect(person.getByText("Profil fotoğrafı güncellendi.", { exact: true })).toBeVisible();
      const identity = (await api(person, "GET", "/auth/me")).json as { id: string };
      expect(memberIdentityInDatabase(identity.id)).toMatchObject({ firstName, lastName, hasPhoto: true });
      expect((await api(page, "POST", `/projects/${project.id}/teams/${target.id}/members`, { userId: identity.id })).status).toBe(201);
      const detail = (await api(page, "GET", `/projects/${project.id}/teams/${target.id}`)).json as { memberPreview: { userId: string; firstName: string; lastName: string }[] };
      expect(detail.memberPreview.find(p => p.userId === identity.id)).toMatchObject({ firstName, lastName });
      await page.goto(`/tr/projeler/${project.slug}?section=teams`);
      const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Named preview", exact: true }) });
      await expect(card.locator(`[data-member-preview="${identity.id}"] [data-member-name]`)).toHaveText(fullName);
      await expect(card.locator(`[data-member-preview="${identity.id}"] [data-member-role]`)).toHaveText("Test Uzmanı");
      await expect(card.locator(`[data-member-preview="${identity.id}"]`)).toHaveAttribute("aria-label", `${fullName}, Test Uzmanı`);
      await expect.poll(() => card.locator(`[data-member-preview="${identity.id}"] img`).evaluateAll(imgs => (imgs[0] as HTMLImageElement | undefined)?.naturalWidth ?? 0)).toBeGreaterThan(0);
      if (firstName === "Alper") {
        // TEST-ONLY image network failure; the identity and initials must survive a failed image.
        await page.route(`**/users/${identity.id}/profile-photo?*`, route => route.abort("failed"));
        await page.goto(`/tr/projeler/${project.slug}?section=teams`);
        await expect(card.locator(`[data-member-preview="${identity.id}"] [data-member-name]`)).toHaveText(fullName);
        await expect(card.locator(`[data-member-preview="${identity.id}"] [data-slot="avatar"]`)).toHaveText("AT");
        await expect(card.locator(`[data-member-preview="${identity.id}"] img`)).toHaveCount(0);
        await page.unroute(`**/users/${identity.id}/profile-photo?*`);
      }
      await page.evaluate(() => { (window as unknown as { previewDocument: number }).previewDocument = 7; });
      await card.getByRole("link", { name: "Named preview ekibini aç", exact: true }).click();
      await page.getByRole("button", { name: "Ekibi düzenle", exact: true }).click();
      await page.getByRole("button", { name: `${user.nickname} kişisini ekipten çıkar`, exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Ekipten çıkar", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeHidden();
      await page.getByRole("navigation", { name: "Konum", exact: true }).getByRole("link", { name: "Ekipler", exact: true }).click();
      await expect(card.locator(`[data-member-preview="${identity.id}"]`)).toHaveCount(0);
      expect(await page.evaluate(() => (window as unknown as { previewDocument: number }).previewDocument)).toBe(7);
      await card.getByRole("link", { name: "Named preview ekibini aç", exact: true }).click();
      await page.getByRole("link", { name: "Üye davet et", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.getByLabel("Kişi ara", { exact: true }).fill(user.nickname);
      await page.getByRole("button", { name: `${user.nickname} kişisini ekibe ekle`, exact: true }).click();
      // Adding a project member is immediate: the page stays, the row turns into "in team" and the way back is a link.
      await expect(page.getByRole("list", { name: "Arama sonuçları", exact: true }).getByText("Ekipte", { exact: true })).toBeVisible();
      await page.getByRole("link", { name: "Ekibe dön", exact: true }).click();
      await page.getByRole("navigation", { name: "Konum", exact: true }).getByRole("link", { name: "Ekipler", exact: true }).click();
      await expect(card.locator(`[data-member-preview="${identity.id}"] [data-member-name]`)).toHaveText(fullName);
      expect(await page.evaluate(() => (window as unknown as { previewDocument: number }).previewDocument)).toBe(7);
      await api(person, "DELETE", "/users/me/profile-photo");
    }
    for (const file of [MEMBER_USER_FILE, path.join(AUTH_DIR, "chat-outsider-user.json")]) {
      const user = JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string };
      const session=path.join(AUTH_DIR,`${file===MEMBER_USER_FILE?"notification-setup":"chat-outsider-session"}-${actor.id}.json`);
      const personContext=await browser.newContext(existsSync(session)?{storageState:session}:{});peopleContexts.push(personContext);
      const person=await personContext.newPage();
      if(existsSync(session)){await person.goto("/projects");const current=await api(person,"GET","/auth/me");expect(current.status).toBe(200);expect((current.json as {email:string}).email).toBe(user.email);}
      else await login(person,user.email,user.password);
      const identity = (await api(person, "GET", "/auth/me")).json as { id: string };
      const invitation = await api(page, "POST", `/projects/${project.id}/invitations`, { userId: identity.id, teamId: backup.id, roles: ["TESTER"] });
      expect(invitation.status).toBe(201);
      expect((await api(person, "POST", `/project-invitations/${(invitation.json as { invitationId: string }).invitationId}/accept`)).status).toBe(200);
      expect((await api(page, "POST", `/projects/${project.id}/teams/${target.id}/members`, { userId: identity.id })).status).toBe(201);
    }
    for (const locale of ["tr", "en", "de"]) {
      await page.goto(`/${locale}/projects/${project.slug}?section=teams`);
      const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Named preview", exact: true }) });
      await expect(card.locator("[data-member-preview]")).toHaveCount(5);
      await expect(card.locator("[data-member-preview-extra]")).toHaveText("+1");
      for (const dark of [false, true]) {
        await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), dark);
        for (const width of [320, 390, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await card.screenshot({ path: path.resolve(__dirname, `../../.local/squad-modernization/preview-${locale}-${width}-${dark ? "dark" : "light"}.png`) });
        }
      }
    }
    let memberRequests = 0; const listPages = new Set<string>();
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith(`/api/v1/projects/${project.id}/teams/`) && url.pathname.endsWith("/members")) memberRequests++;
      if (url.pathname === `/api/v1/projects/${project.id}/teams` && request.method() === "GET") listPages.add(url.searchParams.get("page") ?? "0");
    });
    for (let i = 2; i < 101; i++) expect((await api(page, "POST", `/projects/${project.id}/teams`, { name: `Preview page ${i}`, includeCreator: false })).status).toBe(201);
    // Fresh document is fixture initialization for the performance dataset, not mutation invalidation proof.
    await page.goto(`/tr/projeler/${project.slug}?section=teams`);
    await expect.poll(() => listPages.has("0") && listPages.has("1")).toBe(true);
    expect(memberRequests).toBe(0);
    const second = await api(page, "GET", `/projects/${project.id}/teams?page=1&size=100`);
    expect(second.status).toBe(200); expect(second.json).toMatchObject({ totalElements: 101 });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      try {
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      } catch (error) {
        console.log("Preview overflow geometry", await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, nodes: [...document.querySelectorAll("#main-content *")].map(el => ({ tag: el.tagName, cls: el.getAttribute("class"), right: el.getBoundingClientRect().right })).filter(el => el.right > innerWidth).slice(0, 25) })));
        throw error;
      }
    }
  } finally {
    await api(page, "POST", `/projects/${project.id}/archive`);
    for (const personContext of peopleContexts) await personContext.close();
    await context.close();
  }
});

const PHOTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const SCREENSHOT_DIR = process.env.TEAM_CARD_SHOTS ?? path.resolve(__dirname, "../../.local/squad-modernization");

test("grid card shows photo, name and primary project role (+N) side by side without overflow; table and chart keep working", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ storageState: MANAGER_STORAGE });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.goto("/tr/projeler");
  const created = await api(page, "POST", "/projects", { name: `Role card QA ${Date.now()}`, projectType: "WEB" });
  expect(created.status).toBe(201);
  const project = created.json as { id: string; slug: string };
  const peopleContexts = [];
  const longName = "Maximiliana Alexandrina Konstantinopolitanische-Schwarzenberg";
  try {
    const team = (await api(page, "POST", `/projects/${project.id}/teams`, { name: "Role card team", includeCreator: true })).json as { id: string };
    await api(page, "POST", `/projects/${project.id}/teams`, { name: "Empty card team", includeCreator: false });
    // Accepting an invitation puts the person into the team it names; they join the card team separately.
    const backup = (await api(page, "POST", `/projects/${project.id}/teams`, { name: "Role backup", includeCreator: false })).json as { id: string };
    // Roles are sent out of enum order on purpose: the card must still read PROJECT_MANAGER first.
    const people = [
      { firstName: "Rolf", lastName: "Mehrfach", roles: ["TESTER", "PROJECT_MANAGER"], photo: true },
      { firstName: longName, lastName: "Langname", roles: ["FULL_STACK_DEVELOPER"], photo: false },
      { firstName: "Hamza", lastName: "Taşbay", roles: ["PROJECT_MANAGER"], photo: false },
    ];
    const ids: string[] = [];
    for (const person of people) {
      const user = uniqueUser("rolecard");
      const invitation = await api(page, "POST", `/projects/${project.id}/invitations`, { teamId: backup.id, email: user.email, firstName: person.firstName, lastName: person.lastName, roles: person.roles });
      expect(invitation.status).toBe(201);
      const personContext = await browser.newContext(); peopleContexts.push(personContext);
      const browserPage = await personContext.newPage(); await browserPage.goto("/tr/giris");
      expect((await api(browserPage, "POST", "/auth/register/invitation", { ...user, firstName: person.firstName, lastName: person.lastName, token: (invitation.json as { token: string }).token, confirmPassword: user.password })).status).toBe(200);
      await login(browserPage, user.email, user.password);
      if (person.photo) {
        await browserPage.goto("/account");
        await browserPage.getByTestId("profile-photo-input").setInputFiles({ name: "role.png", mimeType: "image/png", buffer: PHOTO });
        await browserPage.getByRole("button", { name: "Fotoğrafı kaydet", exact: true }).click();
        await expect(browserPage.getByText("Profil fotoğrafı güncellendi.", { exact: true })).toBeVisible();
      }
      const identity = (await api(browserPage, "GET", "/auth/me")).json as { id: string };
      ids.push(identity.id);
      expect((await api(page, "POST", `/projects/${project.id}/teams/${team.id}/members`, { userId: identity.id })).status).toBe(201);
    }
    const [multiId, longId, hamzaId] = ids;

    // Response contract: roles in enum order, no e-mail.
    const detail = (await api(page, "GET", `/projects/${project.id}/teams/${team.id}`)).json as { memberPreview: Record<string, unknown>[] };
    expect(detail.memberPreview.find(p => p.userId === multiId)).toMatchObject({ roles: ["PROJECT_MANAGER", "TESTER"] });
    expect(detail.memberPreview.every(p => !("email" in p))).toBe(true);

    const memberRequests: string[] = [];
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith(`/api/v1/projects/${project.id}/teams/`) && url.pathname.endsWith("/members")) memberRequests.push(request.url());
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/tr/projeler/${project.slug}?section=teams&view=grid`);
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Role card team", exact: true }) });
    const multi = card.locator(`[data-member-preview="${multiId}"]`);
    const long = card.locator(`[data-member-preview="${longId}"]`);
    await expect(card.locator("[data-member-preview]")).toHaveCount(4);

    // Several roles: primary role (enum order) plus "+1"; every role in the accessible name and the tooltip.
    await expect(multi.locator("[data-member-name]")).toHaveText("Rolf Mehrfach");
    await expect(multi.locator("[data-member-role]")).toHaveText("Proje Yöneticisi+1");
    await expect(multi).toHaveAttribute("aria-label", "Rolf Mehrfach, Proje Yöneticisi, Test Uzmanı");
    await expect.poll(() => multi.locator("img").evaluateAll(imgs => (imgs[0] as HTMLImageElement | undefined)?.naturalWidth ?? 0)).toBeGreaterThan(0);
    await multi.locator("[data-member-name]").hover();
    const tooltip = page.locator('[data-slot="tooltip-content"]');
    await expect(tooltip).toContainText("Rolf Mehrfach");
    await expect(tooltip).toContainText("Proje Yöneticisi");
    await expect(tooltip).toContainText("Test Uzmanı");
    await page.mouse.move(0, 0);

    // One long role, no photo, very long display name: initials avatar, truncated name, the full name stays reachable.
    await expect(long.locator("[data-member-role]")).toHaveText("Full-Stack Geliştirici");
    await expect(long.locator("img")).toHaveCount(0);
    await expect(long.locator('[data-slot="avatar"]')).toHaveText("MA");
    await expect(long).toHaveAttribute("aria-label", `${longName} Langname, Full-Stack Geliştirici`);
    // Nothing is clipped: the very long name wraps and stays whole, and the single-role label reads in full.
    await expect(long.locator("[data-member-name]")).toHaveText(`${longName} Langname`);
    await expect(card.locator(`[data-member-preview="${hamzaId}"] [data-member-name]`)).toHaveText("Hamza Taşbay");
    await expect(card.locator(`[data-member-preview="${hamzaId}"] [data-member-role]`)).toHaveText("Proje Yöneticisi");
    // Members sit side by side and wrap onto further rows; nothing sticks out of the card or is clipped.
    const geometry = async () => card.evaluate(article => {
      const box = article.getBoundingClientRect();
      const items = [...article.querySelectorAll<HTMLElement>("[data-member-preview], [data-member-preview-extra]")].map(el => el.getBoundingClientRect());
      const text = [...article.querySelectorAll<HTMLElement>("[data-member-name], [data-member-primary-role], [data-member-more-roles]")];
      return {
        overflow: items.some(r => r.left < box.left - 1 || r.right > box.right + 1),
        clipped: text.filter(el => el.scrollWidth > el.clientWidth + 1 || getComputedStyle(el).textOverflow === "ellipsis" || getComputedStyle(el).webkitLineClamp !== "none").length,
        cardOverflow: article.scrollWidth > article.clientWidth,
      };
    });
    expect(await geometry()).toMatchObject({ overflow: false, clipped: 0, cardOverflow: false });

    await expect(page.locator("article").filter({ has: page.getByRole("heading", { name: "Empty card team", exact: true }) }).getByText("Henüz üye yok", { exact: true })).toBeVisible();

    for (const dark of [false, true]) {
      await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), dark);
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await geometry()).toMatchObject({ overflow: false, clipped: 0, cardOverflow: false });
        if ([390, 1440].includes(width)) await card.screenshot({ path: path.join(SCREENSHOT_DIR, `teams-card-${width}-${dark ? "dark" : "light"}.png`) });
      }
    }
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(memberRequests).toEqual([]);

    // Table and chart keep their own presentation (compact avatars, no names / roles column).
    await page.goto(`/tr/projeler/${project.slug}?section=teams&view=table`);
    const row = page.getByTestId("teams-table").locator("tbody tr").filter({ hasText: "Role card team" });
    await expect(row.locator("[data-member-preview]")).toHaveCount(4);
    await expect(row.locator("[data-member-role]")).toHaveCount(0);
    await page.goto(`/tr/projeler/${project.slug}?section=teams&view=chart`);
    await expect(page.getByRole("link", { name: /Role card team/ }).first()).toBeVisible();
    expect(memberRequests).toEqual([]);
  } finally {
    await api(page, "POST", `/projects/${project.id}/archive`);
    for (const personContext of peopleContexts) await personContext.close();
    await context.close();
  }
});
