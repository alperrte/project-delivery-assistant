import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { demoData, demoPage, DEMO_USER } from "../src/features/landing/demo/demo-data";
import tr from "../src/i18n/landing/tr.json";

const captures = path.resolve("../tmp/landing-qa");
const data = demoData(tr);
async function scrollStory(page: Page, progress: number) {
  await page.locator("#product").evaluate((element, fraction) => window.scrollTo(0, element.getBoundingClientRect().top + scrollY + (element.clientHeight - innerHeight) * fraction), progress);
}
async function mockRealApp(page: Page) {
  await page.context().addCookies([{ name: "PDA_SESSION", value: "1", url: "http://localhost:3000" }]);
  await page.routeWebSocket(/\/api\/v1\/ws$/, socket => {
    socket.onMessage(message => {
      if (String(message).startsWith("CONNECT")) socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0");
    });
  });
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace("/api/v1", "");
    // The reference is the real protected route with fixture responses. No request reaches a backend.
    const headers = { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    // TEST-ONLY visual reference: no live notification owner data or mutation is exercised here.
    if (pathname === "/notifications/team-deletions/claim") return route.fulfill({ status: 204, headers });
    if (request.method() !== "GET") return route.fulfill({ status: 403, headers, body: "read only visual reference" });
    let body: unknown = {};
    if (pathname === "/auth/me") body = DEMO_USER;
    else if (pathname === "/auth/csrf") body = { headerName: "X-XSRF-TOKEN" };
    else if (pathname === "/notifications/unread-count") body = { count: 0 };
    else if (pathname === "/notifications") body = demoPage([]);
    else if (pathname === "/projects") body = demoPage([data.project]);
    else if (pathname.includes("/by-slug/")) body = data.project;
    else if (pathname.endsWith("/home")) body = data.home;
    else if (pathname.endsWith("/teams/" + data.team.id + "/members")) body = demoPage(data.roster);
    else if (pathname.endsWith("/teams/" + data.team.id)) body = data.team;
    else if (pathname.endsWith("/teams")) body = demoPage([data.team]);
    else if (pathname.endsWith("/members/" + DEMO_USER.id)) body = data.members[0];
    else if (pathname.endsWith("/members")) body = demoPage(data.members);
    else if (pathname.endsWith("/tasks/counts")) body = { open: 1, overdue: 0, dueSoon: 0, blocked: 0, poolAvailable: 0 };
    else if (pathname.endsWith("/tasks")) body = demoPage([data.task]);
    else if (pathname.endsWith("/invitations")) body = demoPage([]);
    else if (pathname.endsWith("/criteria") || pathname.endsWith("/sprints") || pathname.endsWith("/labels")) body = [];
    else if (pathname === "/organizations") body = demoPage([]);
    else if (pathname.includes("/chat/")) body = { totalUnread: 0, conversations: [] };
    if (pathname.endsWith("/events")) return route.fulfill({ status: 200, headers, contentType: "text/event-stream", body: ": fixture\n\n" });
    return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(body) });
  });
}
async function uiMetrics(page: Page, root: string, selector: string) {
  return page.locator(root + " " + selector).first().evaluate(element => {
    const css = getComputedStyle(element);
    return { width: css.width, height: css.height, font: css.fontFamily, size: css.fontSize, weight: css.fontWeight, background: css.backgroundColor, color: css.color, border: css.borderColor, radius: css.borderRadius, padding: css.padding, gap: css.gap };
  });
}

for (const theme of ["light", "dark"]) {
  test("real protected PDA screens and landing use the same UI: " + theme, async ({ page, browser }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(value => localStorage.setItem("theme", value), theme);
    const errors: string[] = [], backend: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", message => { if (message.type() === "error" || /hydration/i.test(message.text())) errors.push(message.text()); });
    page.on("request", request => { if (request.url().includes("/api/v1/")) backend.push(request.url()); });
    await page.goto("/");
    await expect(page.locator("#product")).toHaveAttribute("data-choreographed", "true");
    const real = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
    await real.addInitScript(value => localStorage.setItem("theme", value), theme);
    real.on("pageerror", e => errors.push(e.message));
    real.on("console", message => { if (message.type() === "error" || /hydration/i.test(message.text())) errors.push(message.text()); });
    await mockRealApp(real);
    for (const [stage, progress, route] of [
      ["project", 0.21, "/projects/pda-demo"],
      ["team", 0.4, "/projects/pda-demo/teams/pda-demo-team"],
      ["delivery", 0.95, "/projects/pda-demo/tasks"],
    ] as const) {
      await scrollStory(page, progress);
      await expect(page.locator("#product")).toHaveAttribute("data-chapter", stage);
      const demo = `[data-pda-demo-stage="${stage}"] .workspace-preview`;
      await expect(page.locator(demo + " h1")).toBeVisible();
      const dimensions = await page.locator(`[data-pda-viewport="${stage}"] > div`).evaluate(element => ({ width: element.clientWidth, height: Math.round(element.clientHeight) }));
      await real.setViewportSize(dimensions);
      await real.goto(route);
      await expect(real.locator(".app-shell h1")).toBeVisible();
      await real.mouse.move(dimensions.width / 2, 20);
      await expect(real.locator(".app-shell header").first()).toHaveCSS("opacity", "1");
      await real.evaluate(() => document.fonts.ready);
      await page.evaluate(() => document.fonts.ready);
      for (const selector of ["> aside", "header", "header input", "header button", "nav a[aria-current=page]", "h1"]) {
        expect(await uiMetrics(page, demo, selector), stage + " " + selector).toEqual(await uiMetrics(real, ".app-shell", selector));
      }
      if (stage === "team") {
        for (const selector of ["table", "tbody tr", "tbody td", "tbody td span"])
          expect(await uiMetrics(page, demo, selector)).toEqual(await uiMetrics(real, ".app-shell", selector));
      }
      if (stage === "delivery") {
        await expect(page.locator('[data-pda-demo-stage="delivery"]')).toHaveAttribute("data-demo-status", "DONE");
        expect(await uiMetrics(page, demo, "main ul > li")).toEqual(await uiMetrics(real, ".app-shell", "main ul > li"));
      }
      await real.screenshot({ path: path.join(captures, `real-${theme}-${stage}.png`) });
      await page.locator(`[data-pda-viewport="${stage}"]`).screenshot({ path: path.join(captures, `demo-${theme}-${stage}.png`) });
      await page.screenshot({ path: path.join(captures, `story-${theme}-${stage}.png`) });
    }
    // Capture both unchanged full forms too; the demo uses these very same components.
    // Revisit earlier form stages in a fresh document: the completed story no
    // longer rewinds within one page load. Reset scroll before reload so browser
    // scroll restoration cannot immediately advance the new scene to delivery.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.reload();
    await expect(page.locator("#product")).toHaveAttribute("data-choreographed", "true");
    await expect(page.locator("#product")).toHaveAttribute("data-chapter", "project");
    for (const [stage, progress, route, field] of [
      ["project", 0.079, "/projects/new", "#project-name"],
      ["task", 0.54, "/projects/pda-demo/tasks/new", "#task-title"],
    ] as const) {
      await scrollStory(page, progress);
      const demo = `[data-pda-demo-stage="${stage}"] .workspace-preview`;
      await expect(page.locator(demo + " " + field)).toHaveValue(stage === "project" ? data.project.name : data.task.title);
      await real.goto(route);
      await expect(real.locator(field)).toBeVisible();
      await real.locator(field).fill(stage === "project" ? data.project.name : data.task.title);
      await real.locator(stage === "project" ? "#project-description" : "#task-description").fill(data.project.description!);
      if (stage === "project") {
        await real.getByRole("radio").first().click();
        for (const tech of ["Next.js", "Spring Boot", "PostgreSQL"]) await real.getByRole("button", { name: tech, exact: true }).first().click();
      }
      await real.locator("textarea").first().blur();
      await real.evaluate(() => window.scrollTo(0, 0));
      await real.mouse.move(720, 20);
      for (const selector of [field, "label", "textarea", "form button[type=submit]"]) {
        const actual = await uiMetrics(page, demo, selector);
        // Filling focuses the real input; compare after its normal focus transition has settled.
        await expect.poll(() => uiMetrics(real, ".app-shell", selector)).toEqual(actual);
      }
      await real.screenshot({ path: path.join(captures, `real-${theme}-${stage}-form.png`) });
      await page.locator(`[data-pda-viewport="${stage}"]`).screenshot({ path: path.join(captures, `demo-${theme}-${stage}-form.png`) });
    }
    await scrollStory(page, 0.59);
    const taskForm = page.locator('[data-pda-demo-stage="task"]');
    await expect.poll(() => taskForm.locator("main").evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    const viewport = await page.locator('[data-pda-viewport="task"]').boundingBox();
    const submit = await taskForm.locator('button[type="submit"]').boundingBox();
    expect(submit!.y + submit!.height).toBeLessThanOrEqual(viewport!.y + viewport!.height + 1);
    expect(submit!.y).toBeGreaterThan(viewport!.y);
    await page.screenshot({ path: path.join(captures, `story-${theme}-task-assignment.png`) });
    await real.close();
    expect(backend).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const width of [1440, 1920]) {
  test("larger existing navbar logo preserves alignment: " + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const brand = page.locator('header > a[href="/tr"]').first();
    await expect(brand).toHaveCSS("width", "110px");
    await expect(page.locator("body > div header").first()).toHaveCSS("min-height", "88px");
    await expect(brand.locator("span:visible")).toHaveCSS("max-width", "110px");
    const box = await brand.boundingBox();
    expect(box!.height).toBe(44);
    await page.screenshot({ path: path.join(captures, `logo-${width}-hero.png`) });
    await brand.screenshot({ path: path.join(captures, `logo-${width}-detail.png`) });
  });
}

test("demo cannot take focus, intercept shortcuts, or submit a backend mutation", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", r => { if (r.url().includes("/api/v1/")) requests.push(r.url()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await expect(page.locator("[data-popup-open]")).toHaveCount(0);
  await page.locator('[data-pda-demo-stage="project"] form').evaluate(form => (form as HTMLFormElement).requestSubmit());
  await expect(page.locator('[data-pda-demo-stage="project"] form button[type=submit]')).not.toBeDisabled();
  await page.waitForTimeout(300);
  expect(requests).toEqual([]);
  await expect(page).toHaveURL("/tr");
  expect(await page.locator(".app-shell").count()).toBe(0);
  await expect(page.locator("#landing-main")).toBeVisible();
});
