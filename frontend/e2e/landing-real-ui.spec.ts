import { test, expect, type Page } from "@playwright/test";
import { demoData, demoPage, resolveDemoQuery, DEMO_USER } from "../src/features/landing/demo/demo-data";
import tr from "../src/i18n/landing/tr.json";

const data = demoData(tr);
async function mockRealApp(page: Page, origin: string) {
  await page.context().addCookies([{ name: "PDA_SESSION", value: "1", url: origin }]);
  await page.routeWebSocket(/\/api\/v1\/ws$/, socket => {
    socket.onMessage(message => {
      if (String(message).startsWith("CONNECT")) socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0");
    });
  });
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace("/api/v1", "");
    // The reference is the real protected route with fixture responses. No request reaches a backend.
    const headers = { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    // TEST-ONLY visual reference: no live notification owner data or mutation is exercised here.
    if (pathname === "/notifications/team-deletions/claim") return route.fulfill({ status: 204, headers });
    if (request.method() !== "GET") return route.fulfill({ status: 403, headers, body: "read only visual reference" });
    let body: unknown = {};
    if (pathname === "/auth/me") body = DEMO_USER;
    else if (pathname === "/auth/csrf") body = { headerName: "X-XSRF-TOKEN" };
    else if (pathname === "/users/me/preferences") body = { locale: null, theme: null, motion: null, themeTransition: null, languageTransition: null, navbarMode: null };
    else if (pathname === "/chat/conversations") body = { group: null, groups: [], directs: [], totalUnread: 0 };
    else if (pathname === "/chat/members") body = [];
    else if (pathname === "/notifications/unread-count") body = { count: 0 };
    else if (pathname === "/notifications") body = demoPage([]);
    else if (pathname === "/project-invitations/me") body = demoPage([]);
    else if (pathname === "/projects") body = demoPage([data.project]);
    else if (pathname.includes("/by-slug/")) body = data.project;
    else if (pathname.endsWith("/home")) body = data.home;
    else if (pathname.endsWith("/teams/" + data.team.id + "/members")) body = demoPage(data.roster);
    else if (pathname.endsWith("/teams/" + data.team.id)) body = data.team;
    else if (pathname.endsWith("/teams")) body = demoPage([data.team]);
    else if (pathname.endsWith("/members/" + DEMO_USER.id)) body = data.members[0];
    else if (pathname.endsWith("/members")) body = demoPage(data.members);
    else if (pathname.endsWith("/tasks/counts")) body = { open: 1, overdue: 0, dueSoon: 0, blocked: 0, poolAvailable: 0 };
    else if (pathname.endsWith("/tasks")) body = demoPage(data.tasks);
    else if (pathname.endsWith("/invitations")) body = demoPage([]);
    else if (pathname.endsWith("/criteria") || pathname.endsWith("/sprints") || pathname.endsWith("/labels")) body = [];
    else if (pathname === "/organizations") body = demoPage([]);
    if (pathname.endsWith("/events")) return route.fulfill({ status: 200, headers, contentType: "text/event-stream", body: ": fixture\n\n" });
    return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(body) });
  });
}
/** Look-and-feel only: layout size depends on the frame the demo sits in, so width and height are left out. */
async function look(page: Page, root: string, selector: string) {
  return page.locator(root + " " + selector).first().evaluate(element => {
    const css = getComputedStyle(element);
    return { font: css.fontFamily, size: css.fontSize, weight: css.fontWeight, background: css.backgroundColor, color: css.color, border: css.borderColor, radius: css.borderRadius };
  });
}

for (const theme of ["light", "dark"]) {
  test("landing demos and the real protected screens share one look: " + theme, async ({ page, browser, baseURL }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(value => localStorage.setItem("theme", value), theme);
    const errors: string[] = [], backend: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", message => { if (message.type() === "error" || /hydration/i.test(message.text())) errors.push(message.text()); });
    page.on("request", request => { if (request.url().includes("/api/v1/")) backend.push(request.url()); });
    await page.goto("/");
    const real = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "tr-TR", baseURL });
    await real.addInitScript(value => localStorage.setItem("theme", value), theme);
    real.on("pageerror", e => errors.push(e.message));
    real.on("console", message => { if (message.type() === "error" || /hydration/i.test(message.text())) errors.push(message.text()); });
    await mockRealApp(real, new URL(baseURL!).origin);

    // Hero: the real board inside the real app shell.
    const hero = '[data-demo] > .workspace-preview';
    await expect.poll(() => page.locator(hero).first().evaluate(el => el.childElementCount)).toBeGreaterThan(0);
    await expect(page.locator(hero + " h2").first()).toHaveText(/.+/);
    await real.goto("/projects/pda-demo/tasks");
    await expect(real.locator(".app-shell h1")).toBeVisible();
    await real.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.fonts.ready);
    for (const selector of ["aside", "header", "header input", "header button"]) {
      expect(await look(page, hero, selector), "hero " + selector).toEqual(await look(real, ".app-shell", selector));
    }

    // Tasks: the real creation form.
    await page.locator("#tasks").scrollIntoViewIfNeeded();
    const form = "#tasks [data-demo] > .workspace-preview";
    await expect(page.locator(form + " #task-title")).toHaveValue(data.task.title);
    await real.goto("/projects/pda-demo/tasks/new");
    await expect(real.locator("#task-title")).toBeVisible();
    // The real form focuses its title on open; compare the resting state.
    await real.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await real.mouse.move(720, 20);
    for (const selector of ["#task-title", "label", "textarea", "form button[type=submit]"]) {
      await expect.poll(() => look(real, ".app-shell", selector), selector).toEqual(await look(page, form, selector));
    }
    await real.close();
    expect(backend).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("demo queries are fail-closed: unknown keys resolve to nothing", () => {
  expect(resolveDemoQuery(["unknown", "key"], data)).toBeUndefined();
  expect(resolveDemoQuery(["projects", "by-slug"], data)).toBeUndefined();
  expect(resolveDemoQuery(["projects", "x", "unknown-resource"], data)).toBeUndefined();
  expect(resolveDemoQuery(["projects", "x", "repository", "compare", "no-such-branch"], data)).toBeUndefined();
  expect(resolveDemoQuery(["tasks", "export"], data)).toBeUndefined();
  expect(resolveDemoQuery(["projects", "by-slug", data.project.slug], data)).toEqual(data.project);
  expect(resolveDemoQuery(["session"], data)).toEqual(DEMO_USER);
});

test("a demo cannot take focus, intercept shortcuts or submit a backend mutation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requests: string[] = [];
  page.on("request", r => { if (r.url().includes("/api/v1/")) requests.push(r.url()); });
  await page.goto("/");
  await page.locator("#tasks").scrollIntoViewIfNeeded();
  const demo = page.locator("#tasks [data-demo] > .workspace-preview");
  await expect(demo.locator("form")).toHaveCount(1);
  await page.keyboard.press("Control+k");
  await expect(page.locator("[data-popup-open]")).toHaveCount(0);
  await demo.locator("form").evaluate(form => (form as HTMLFormElement).requestSubmit());
  await demo.locator("input").first().evaluate(input => (input as HTMLInputElement).focus());
  expect(await page.evaluate(() => !!document.activeElement?.closest("[data-demo]"))).toBe(false);
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  await expect(page).toHaveURL(/\/tr\/ana-sayfa$/);
  await expect(page.locator("#landing-main")).toBeVisible();
});

for (const width of [1440, 1920]) {
  test("navbar logo keeps its size and alignment: " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const brand = page.locator('header > a[href="/tr/ana-sayfa"]').first();
    await expect(brand).toHaveCSS("width", "110px");
    const box = await brand.boundingBox();
    expect(box!.height).toBe(44);
    const header = await page.locator("header").first().boundingBox();
    expect(Math.abs(box!.y + box!.height / 2 - (header!.y + header!.height / 2))).toBeLessThanOrEqual(1);
  });
}
