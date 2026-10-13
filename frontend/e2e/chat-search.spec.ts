import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { api } from "./helpers";
import { MANAGER_STORAGE, MANAGER_USER_FILE, MEMBER_STORAGE, MEMBER_USER_FILE } from "./global-setup";
import { psql, uuid } from "./db";
import { localizeHref } from "../src/i18n/routing";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

test.use({ storageState: MANAGER_STORAGE, actionTimeout: 15_000, trace: "off" });
const screenshots = "../.local/chat-search/screens";

async function signIn(page: Page, file = MANAGER_USER_FILE) {
  const account = JSON.parse(readFileSync(file, "utf8")) as { email: string; password: string };
  await page.context().request.get("http://localhost:8080/api/v1/auth/csrf");
  const csrf = (await page.context().cookies()).find(cookie => cookie.name === "XSRF-TOKEN")!;
  const response = await page.context().request.post("http://localhost:8080/api/v1/auth/login", {
    headers: { "X-XSRF-TOKEN": decodeURIComponent(csrf.value), Origin: "http://localhost:3000" }, data: account,
  });
  expect(response.status()).toBe(200);
  await page.goto("/dashboard");
  await expect(page.getByTestId("chat-nav-item")).toBeVisible();
}

async function groupFixture(page: Page) {
  await signIn(page);
  const created = await api(page, "POST", "/projects", { name: `Search QA ${Date.now()}` });
  expect(created.status).toBe(201);
  const project = (created.json as { id: string }).id;
  const overview = (await api(page, "GET", "/chat/conversations")).json as { groups: { id: string; projectId: string }[] };
  const conversation = overview.groups.find(group => group.projectId === project)!.id;
  const actor = ((await api(page, "GET", "/auth/me")).json as { id: string }).id;
  return { project, conversation, actor };
}

async function openGroup(page: Page, conversation: string) {
  if (!await page.locator('[data-testid="chat-nav-item"]:visible').count()) {
    const reveal = page.getByRole("button", { name: /Gezinme çubuğunu göster|Show navigation bar|Navigationsleiste anzeigen/ });
    if (await reveal.isVisible()) await reveal.click();
    await page.locator('header button[aria-controls="workspace-mobile-navigation"]').click();
  }
  await page.locator('[data-testid="chat-nav-item"]:visible').click();
  await page.locator(`[data-testid="chat-conversation-group"][data-conversation-id="${conversation}"]`).click();
  await expect(page.getByTestId("chat-composer")).toBeEnabled();
}

test("real full-history search pages, jumps to an unloaded old message and preserves send/delete behaviour", async ({ page }) => {
  test.setTimeout(180_000);
  const { project, conversation, actor } = await groupFixture(page);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  try {
    // TEST-ONLY own-conversation history seeding, then real PostgreSQL/API search and UI navigation.
    psql(`INSERT INTO chat_messages(id,conversation_id,sender_user_id,content,created_at)
      SELECT gen_random_uuid(),'${uuid(conversation)}','${uuid(actor)}','API İSTANBUL ışık ÇĞÖŞÜ history ' || i,
      timestamptz '2020-01-01 12:00:00+00' + i * interval '1 second' FROM generate_series(0,94) i`);
    const old = JSON.parse(psql(`SELECT row_to_json(t) FROM (SELECT id FROM chat_messages WHERE conversation_id='${uuid(conversation)}' ORDER BY created_at,id LIMIT 1) t`)) as { id: string };
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openGroup(page, conversation);
    await expect(page.locator(`[data-message-id="${old.id}"]`)).toHaveCount(0);
    await page.getByTestId("chat-composer").press("Control+f");
    await expect(page.getByTestId("chat-search-input")).toBeFocused();
    await page.getByTestId("chat-search-input").fill("api");
    await expect(page.getByTestId("chat-search-count")).toHaveText("0 / 95 sonuç");
    await expect(page.getByTestId("chat-search-result")).toHaveCount(20);
    await expect(page.getByRole("button", { name: tr.chat.search.previous, exact: true })).toBeDisabled();
    await page.getByTestId("chat-search-input").press("Enter");
    await expect(page.getByTestId("chat-search-count")).toHaveText("1 / 95 sonuç");
    await page.getByTestId("chat-search-input").press("Enter");
    await expect(page.getByTestId("chat-search-count")).toHaveText("2 / 95 sonuç");
    await page.getByTestId("chat-search-input").press("Shift+Enter");
    await expect(page.getByTestId("chat-search-count")).toHaveText("1 / 95 sonuç");
    for (const count of [40, 60, 80, 95]) {
      await page.getByRole("button", { name: tr.chat.search.more, exact: true }).click();
      await expect(page.getByTestId("chat-search-result")).toHaveCount(count);
    }
    await page.locator(`[data-result-id="${old.id}"]`).click();
    const row = page.locator(`[data-message-id="${old.id}"]`);
    await expect(row).toBeVisible(); await expect(row).toHaveAttribute("data-search-highlight", "true");
    await expect(page.getByTestId("chat-search-count")).toHaveText("95 / 95 sonuç");
    await expect(page.getByRole("button", { name: tr.chat.search.next, exact: true })).toBeDisabled();
    expect(await row.evaluate(element => { const scroll = element.closest('[data-testid="chat-messages"]')!.getBoundingClientRect(); const rect = element.getBoundingClientRect(); return rect.top >= scroll.top && rect.bottom <= scroll.bottom; })).toBe(true);
    await expect(page.getByTestId("chat-search-latest")).toBeVisible();
    await expect(page.getByTestId("chat-search-panel")).toBeVisible();
    mkdirSync(screenshots, { recursive: true }); await page.screenshot({ path: `${screenshots}/desktop-old-result.png` });
    await page.getByRole("button", { name: tr.chat.search.newer, exact: true }).click();
    await page.getByTestId("chat-message-text").filter({ hasText: "history 60" }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId("chat-message-text").filter({ hasText: "history 60" })).toBeVisible();
    const sent = `API sent ${Date.now()}`;
    await page.getByTestId("chat-composer").fill(sent); await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-message-text").filter({ hasText: sent })).toBeVisible();
    await expect(page.getByTestId("chat-search-count")).toContainText("96");
    const sentRow = page.getByTestId("chat-message").filter({ hasText: sent });
    const sentId = (await sentRow.getAttribute("data-message-id"))!;
    expect((await api(page, "DELETE", `/chat/conversations/${conversation}/messages/${sentId}`)).status).toBe(204);
    await expect(page.locator(`[data-result-id="${sentId}"]`)).toHaveCount(0);
    await expect(page.getByTestId("chat-search-count")).toContainText("95");
    await page.getByTestId("chat-search-input").press("Escape");
    await expect(page.getByTestId("chat-search-panel")).toHaveCount(0);
    await expect(page.getByTestId("chat-search-open")).toBeFocused();
    await expect(page.getByTestId("chat-panel")).toBeVisible();
    await page.getByTestId("chat-minimize").click(); await page.getByTestId("chat-bar-expand").click();
    await expect(page.getByTestId("chat-compact")).toBeVisible();
    await page.getByTestId("chat-search-open").click(); await page.getByTestId("chat-search-input").fill("api");
    await expect(page.getByTestId("chat-search-result")).toHaveCount(20);
    await page.getByTestId("chat-search-input").press("Escape");
    await expect(page.getByTestId("chat-compact")).toBeVisible(); await expect(page.getByTestId("chat-search-open")).toBeFocused();
    expect(errors).toEqual([]);
  } finally { await api(page, "POST", `/projects/${project}/archive`).catch(() => undefined); }
});

test("search handles empty/error/late responses, clear and conversation changes", async ({ page }) => {
  test.setTimeout(150_000);
  const { project, conversation } = await groupFixture(page);
  try {
    expect((await api(page, "POST", `/chat/conversations/${conversation}/messages`, { content: "İSTANBUL API integration" })).status).toBe(201);
    await openGroup(page, conversation); await page.getByTestId("chat-search-open").click();
    const input = page.getByTestId("chat-search-input");
    // TEST-ONLY delay of a real successful API response; normal successes remain actual backend/DB.
    await page.route("**/messages/search?**", async route => {
      const response = await route.fetch();
      if (new URL(route.request().url()).searchParams.get("q") === "istanbul") await new Promise(resolve => setTimeout(resolve, 900));
      await route.fulfill({ response }).catch(error => { if (!/already handled|closed/i.test(String(error))) throw error; });
    });
    await input.fill("istanbul");
    await page.waitForRequest(request => request.url().includes("/messages/search?") && request.url().includes("istanbul"));
    await input.fill("no-result-here");
    await expect(page.getByText(tr.chat.search.empty, { exact: true })).toBeVisible();
    await expect(page.getByTestId("chat-search-result")).toHaveCount(0);
    await page.unroute("**/messages/search?**");
    await input.fill("IŞIK"); await expect(page.getByText(tr.chat.search.empty, { exact: true })).toBeVisible();
    await input.fill("İstanbul"); await expect(page.getByTestId("chat-search-result")).toHaveCount(1);
    await expect(page.getByTestId("chat-search-result").locator("mark")).toHaveText("İSTANBUL");
    await page.getByRole("button", { name: tr.chat.search.clear }).click();
    await expect(page.getByTestId("chat-search-result")).toHaveCount(0); await expect(input).toBeFocused();
    await page.route("**/messages/search?**", route => route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ status: 503 }) }));
    await input.fill("failed-query"); await expect(page.getByText(tr.chat.search.failed, { exact: true })).toBeVisible();
    await page.unroute("**/messages/search?**"); await page.getByRole("button", { name: tr.chat.retry, exact: true }).click();
    await expect(page.getByText(tr.chat.search.empty, { exact: true })).toBeVisible();
    const other = (await api(page, "POST", "/projects", { name: `Search other ${Date.now()}` })).json as { id: string };
    await page.getByTestId("chat-search-close").click(); await page.getByTestId("chat-panel-close").click();
    const overview = (await api(page, "GET", "/chat/conversations")).json as { groups: { id: string; projectId: string }[] };
    await openGroup(page, overview.groups.find(group => group.projectId === other.id)!.id);
    await page.getByTestId("chat-search-open").click(); await expect(input).toHaveValue("");
    await api(page, "POST", `/projects/${other.id}/archive`);
  } finally { await api(page, "POST", `/projects/${project}/archive`).catch(() => undefined); }
});

test("mobile search returns to its result and back, and respects all locales/themes/reduced motion", async ({ page }) => {
  test.setTimeout(180_000);
  const { project, conversation } = await groupFixture(page);
  try {
    const message = (await api(page, "POST", `/chat/conversations/${conversation}/messages`, { content: "API mobil İSTANBUL " + "uzun ".repeat(80) })).json as { id: string };
    for (const [locale, messages] of [["tr", tr], ["en", en], ["de", de]] as const) {
      await page.goto(localizeHref("/dashboard", locale));
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await openGroup(page, conversation); await page.getByTestId("chat-search-open").click();
        await expect(page.getByRole("heading", { name: messages.chat.search.title })).toBeVisible();
        await page.getByTestId("chat-search-input").fill("api"); await expect(page.getByTestId("chat-search-result")).toHaveCount(1);
        await expect(page.getByTestId("chat-search-result")).toBeEnabled();
        if (locale === "tr" && width === 320) {
          // Short visible viewport approximates keyboard-open geometry without replacing real API data.
          await page.setViewportSize({ width, height: 420 });
          await expect(page.getByTestId("chat-search-input")).toBeVisible();
          await expect.poll(() => page.getByTestId("chat-search-panel").evaluate(element => element.getBoundingClientRect().bottom <= (window.visualViewport?.height ?? innerHeight) + 1)).toBe(true);
          await page.setViewportSize({ width, height: 900 });
        }
        for (const theme of ["light", "dark"]) {
          // TEST-ONLY theme style probe; uses the application's actual light/dark token definitions.
          await page.evaluate(value => document.documentElement.classList.toggle("dark", value === "dark"), theme);
          await page.evaluate(async () => {
            await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => undefined)));
          });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          expect(await page.getByTestId("chat-search-panel").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
          mkdirSync(screenshots, { recursive: true });
          if ((locale === "tr" && width === 390) || (locale === "de" && width === 1440)) await page.screenshot({ path: `${screenshots}/${locale}-${width}-${theme}.png` });
        }
        await page.getByTestId("chat-search-result").click(); await expect(page.locator(`[data-message-id="${message.id}"]`)).toBeVisible();
        const narrow = await page.getByTestId("chat-conversation").evaluate(element => element.clientWidth < 700);
        if (narrow) { await expect(page.getByTestId("chat-search-panel")).toBeHidden(); await page.getByRole("button", { name: messages.chat.search.returnResults }).click(); await expect(page.getByTestId("chat-search-input")).toHaveValue("api"); }
        else await expect(page.getByTestId("chat-search-panel")).toBeVisible();
        await page.emulateMedia({ reducedMotion: "reduce" });
        expect(await page.getByTestId("chat-search-panel").evaluate(element => parseFloat(getComputedStyle(element).animationDuration))).toBeLessThanOrEqual(0.00001);
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.getByTestId("chat-search-close").click(); await page.getByTestId("chat-panel-close").click();
      }
    }
  } finally { await api(page, "POST", `/projects/${project}/archive`).catch(() => undefined); }
});

test("a direct conversation search receives matching messages live from the other participant", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await signIn(page);
  const peerContext = await browser.newContext({ storageState: MEMBER_STORAGE }); const peer = await peerContext.newPage();
  try {
    await signIn(peer, MEMBER_USER_FILE);
    const peerId = ((await api(peer, "GET", "/auth/me")).json as { id: string }).id;
    const overview = (await api(page, "GET", "/chat/conversations")).json as { directs: { id: string; peer: { userId: string } }[] };
    let dm = overview.directs.find(item => item.peer.userId === peerId);
    if (!dm) { const opened = await api(page, "POST", `/chat/direct/${peerId}`); expect(opened.status).toBe(200); dm = opened.json as typeof dm; }
    expect(dm).toBeDefined();
    await page.setViewportSize({ width: 1600, height: 900 }); await page.getByTestId("chat-nav-item").click();
    await page.getByRole("button", { name: tr.chat.categories.direct, exact: true }).click(); await page.locator(`[data-peer-id="${peerId}"]`).click();
    await page.getByTestId("chat-search-open").click(); const term = `live${Date.now()}`;
    await page.getByTestId("chat-search-input").fill(term); await expect(page.getByText(tr.chat.search.empty, { exact: true })).toBeVisible();
    const sent = (await api(peer, "POST", `/chat/conversations/${dm!.id}/messages`, { content: term })).json as { id: string };
    await expect(page.locator(`[data-result-id="${sent.id}"]`)).toBeVisible();
    await page.locator(`[data-result-id="${sent.id}"]`).click(); await expect(page.locator(`[data-message-id="${sent.id}"]`)).toBeVisible();
    expect((await api(peer, "DELETE", `/chat/conversations/${dm!.id}/messages/${sent.id}`)).status).toBe(204);
    await expect(page.locator(`[data-result-id="${sent.id}"]`)).toHaveCount(0);
  } finally { await peerContext.close(); }
});
