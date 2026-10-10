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
    for (const [firstName, lastName, initials] of [["Alper", "Temiz", "A.T"], ["Nisa", "Camcı", "N.C"], ["Mehmet Ali", "Yılmaz", "M.Y"]]) {
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
      await expect(card.locator(`[data-member-preview="${identity.id}"]`)).toContainText(initials);
      await expect(card.locator(`[data-member-preview="${identity.id}"]`)).toHaveAttribute("aria-label", `${firstName} ${lastName}`);
      await expect.poll(() => card.locator(`[data-member-preview="${identity.id}"] img`).evaluateAll(imgs => (imgs[0] as HTMLImageElement | undefined)?.naturalWidth ?? 0)).toBeGreaterThan(0);
      if (firstName === "Alper") {
        // TEST-ONLY image network failure; the identity and initials must survive a failed image.
        await page.route(`**/users/${identity.id}/profile-photo?*`, route => route.abort("failed"));
        await page.goto(`/tr/projeler/${project.slug}?section=teams`);
        await expect(card.locator(`[data-member-preview="${identity.id}"]`)).toContainText(initials);
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
      await expect(card.locator(`[data-member-preview="${identity.id}"]`)).toContainText(initials);
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
      await expect(card.getByText("+1", { exact: true })).toBeVisible();
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
