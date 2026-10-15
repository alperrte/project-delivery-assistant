import { test, expect, type Page } from "@playwright/test";
import { api } from "./helpers";
import { MANAGER_STORAGE, MEMBER_STORAGE } from "./global-setup";
import { localizeHref } from "../src/i18n/routing";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
test.use({ storageState: MANAGER_STORAGE });
async function conversation(page: Page) {
  await page.goto("/dashboard");
  const response = await api(page, "POST", "/projects", { name: `Chat enhancements ${Date.now()}`, projectTypes: ["WEB"] });
  expect(response.status).toBe(201);
  const project = response.json as { id: string };
  const overview = (await api(page, "GET", "/chat/conversations")).json as { groups: { id: string; projectId: string }[] };
  const id = overview.groups.find(g => g.projectId === project.id)!.id;
  await page.getByTestId("chat-nav-item").click();
  await page.locator(`[data-conversation-id="${id}"]`).click();
  await expect(page.getByTestId("chat-composer")).toBeEnabled();
  return { id, project: project.id };
}
async function filesEvent(page: Page, type: "drop" | "paste", names: string[], bytes = png) {
  await page.evaluate(({ type, names, bytes }) => {
    const transfer = new DataTransfer();
    for (const name of names) transfer.items.add(new File([new Uint8Array(bytes)], name, { type: name.endsWith(".png") ? "image/png" : "application/octet-stream", lastModified: 1 }));
    const target = document.querySelector(type === "paste" ? '[data-testid="chat-composer"]' : '[data-testid="chat-conversation"] > div')!;
    if (type === "drop") {
      target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    } else target.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
  }, { type, names, bytes: Array.from(bytes) });
}

for (const format of [
  { extension: "env", chosen: ".env", dropped: "dropped.env", pasted: "pasted.ENV", invalid: ".env.dev", mime: "text/plain" },
  { extension: "md", chosen: "README.md", dropped: "notes.md", pasted: "pasted.MD", invalid: "README.md.exe", mime: "text/markdown" },
]) {
test(`${format.extension} chooser, drop and paste share the attachment queue and upload as text`, async ({ page }) => {
  const { id, project } = await conversation(page);
  try {
    const text = Buffer.from("# Example only\nAPP_MODE=demo\n", "utf8");
    const chooser = page.locator('input[type="file"][name="attachment"]');
    expect((await chooser.getAttribute("accept"))?.split(",")).toContain(`.${format.extension}`);
    await chooser.setInputFiles({ name: format.chosen, mimeType: format.mime, buffer: text });
    await filesEvent(page, "drop", [format.dropped, format.invalid], text);
    await filesEvent(page, "paste", [format.pasted], text);
    await expect(page.getByTestId("chat-file-preview")).toHaveCount(3);
    await expect(page.getByText(tr.chat.files.invalid, { exact: true })).toBeVisible();
    await page.getByTestId("chat-send").click();
    await expect(page.getByTestId("chat-file-preview")).toHaveCount(0);
    const history = (await api(page, "GET", `/chat/conversations/${id}/messages`)).json as { messages: { attachment: { filename: string; contentType: string } }[] };
    expect(history.messages.map(m => m.attachment.filename).sort()).toEqual([format.chosen, format.dropped, format.pasted].sort());
    expect(history.messages.every(m => m.attachment.contentType === "text/plain")).toBe(true);
  } finally { await api(page, "DELETE", `/projects/${project}`); }
});
}

test("file drag feedback stays inside active conversation and nested enter/leave does not flicker", async ({ page }) => {
  const { project } = await conversation(page);
  try {
    const transfer = await page.evaluateHandle(bytes => { const data = new DataTransfer(); data.items.add(new File([new Uint8Array(bytes)], "overlay.png", { type: "image/png" })); return data; }, Array.from(png));
    const area = page.locator('[data-testid="chat-conversation"] > div').first();
    await area.dispatchEvent("dragenter", { dataTransfer: transfer }); await expect(page.getByTestId("chat-drop-overlay")).toBeVisible();
    await page.getByTestId("chat-composer").dispatchEvent("dragenter", { dataTransfer: transfer });
    await page.getByTestId("chat-composer").dispatchEvent("dragleave", { dataTransfer: transfer }); await expect(page.getByTestId("chat-drop-overlay")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("drop-desktop.png") });
    await area.dispatchEvent("dragleave", { dataTransfer: transfer }); await expect(page.getByTestId("chat-drop-overlay")).toHaveCount(0);
    await page.locator(".app-shell > aside").dispatchEvent("drop", { dataTransfer: transfer }); await expect(page.getByTestId("chat-file-preview")).toHaveCount(0);
    await area.dispatchEvent("drop", { dataTransfer: transfer }); await expect(page.getByTestId("chat-file-preview")).toHaveCount(1);
    await transfer.dispose();
    await page.screenshot({ path: test.info().outputPath("files-desktop.png") });
  } finally { await api(page, "DELETE", `/projects/${project}`); }
});

test("main sidebar resizes, persists per account, follows chat and keeps collapsed rail", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/dashboard");
  await page.evaluate(() => localStorage.setItem("pda:sidebar-collapsed", "0")); await page.reload();
  const handle = page.getByTestId("workspace-sidebar-resize"); await expect(handle).toBeVisible();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 120); await page.mouse.down(); await page.mouse.move(356, box.y + 120, { steps: 12 }); await page.mouse.up();
  const width = Number(await handle.getAttribute("aria-valuenow")); expect(width).toBeGreaterThan(300);
  await page.reload(); await expect(handle).toHaveAttribute("aria-valuenow", String(width));
  await page.getByTestId("chat-nav-item").click(); await expect(page.getByTestId("chat-panel")).toHaveCSS("left", `${width}px`);
  await handle.focus(); await handle.press("End"); await expect(handle).toHaveAttribute("aria-valuenow", "420");
  await expect(page.getByTestId("chat-panel")).toHaveCSS("left", "420px");
  const sidebarGrip = handle.locator("span"), chatGrip = page.getByRole("separator", { name: tr.chat.panel.resize, exact: true }).locator("div");
  await expect.poll(async () => { const a = (await sidebarGrip.boundingBox())!, b = (await chatGrip.boundingBox())!; return Math.abs(a.y + a.height / 2 - b.y - b.height / 2); }).toBeLessThan(1);
  const gripBounds = (await sidebarGrip.boundingBox())!; expect(gripBounds.y + gripBounds.height / 2).toBeCloseTo(450, 0);
  await page.screenshot({ path: test.info().outputPath("sidebar-desktop.png") });
  await handle.press("Home"); await expect(handle).toHaveAttribute("aria-valuenow", "200");
  await page.getByRole("button", { name: tr.workspace.collapseSidebar, exact: true }).click(); await expect(handle).toHaveCount(0); await expect(page.getByTestId("chat-panel")).toHaveCSS("left", "64px");
  await page.getByRole("button", { name: tr.workspace.expandSidebar, exact: true }).click(); await expect(handle).toHaveAttribute("aria-valuenow", "200");
  const context = await browser.newContext({ storageState: MEMBER_STORAGE }); const other = await context.newPage();
  await other.goto("/dashboard"); await expect(other.getByTestId("workspace-sidebar-resize")).toHaveAttribute("aria-valuenow", "240"); await context.close();
  await page.setViewportSize({ width: 390, height: 844 }); await expect(handle).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("chooser, native drop and clipboard share previews; partial upload failure retries only remaining files", async ({ page }) => {
  const { id, project } = await conversation(page);
  try {
    let uploads = 0;
    page.on("request", request => { if (request.method() === "POST" && request.url().endsWith("/messages/attachment")) uploads++; });
    await page.getByTestId("chat-composer").fill("Attachment caption");
    await page.locator('input[type="file"][name="attachment"]').setInputFiles({ name: "chosen.png", mimeType: "image/png", buffer: png });
    await filesEvent(page, "drop", ["dropped.png", "invalid.exe"]);
    await filesEvent(page, "paste", ["pasted.png"]);
    await filesEvent(page, "drop", ["dropped.png"]);
    await expect(page.getByTestId("chat-file-preview")).toHaveCount(3); expect(uploads).toBe(0);
    await expect(page.getByTestId("chat-composer")).toHaveValue("Attachment caption");
    let attempts = 0;
    await page.route("**/messages/attachment", route => { attempts++; if (attempts === 2) return route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ code: "CHAT_ATTACHMENT_UNAVAILABLE" }) }); return route.continue(); });
    await page.getByTestId("chat-send").click(); await expect(page.getByTestId("chat-file-preview")).toHaveCount(2); await expect(page.getByTestId("chat-send")).toBeEnabled();
    await expect(page.getByTestId("chat-composer")).toHaveValue("");
    await page.getByTestId("chat-send").click(); await expect(page.getByTestId("chat-file-preview")).toHaveCount(0);
    const messages = (await api(page, "GET", `/chat/conversations/${id}/messages`)).json as { messages: { content: string; attachment: { filename: string } }[] };
    expect(messages.messages.map(m => m.attachment.filename).sort()).toEqual(["chosen.png", "dropped.png", "pasted.png"]);
    expect(messages.messages.filter(m => m.content === "Attachment caption")).toHaveLength(1);
    await filesEvent(page, "paste", ["unsent.png"]); await page.getByTestId("chat-file-preview").getByRole("button", { name: tr.chat.files.remove }).click(); await expect(page.getByTestId("chat-file-preview")).toHaveCount(0);
  } finally { await api(page, "DELETE", `/projects/${project}`); }
});

test("reactions show real users and all tabs; own removal, picker and responsive focus work", async ({ page }) => {
  test.setTimeout(180000);
  const { id, project } = await conversation(page);
  try {
    const result = await api(page, "POST", `/chat/conversations/${id}/messages`, { content: "Reaction detail example" });
    const message = result.json as { id: string }; const row = page.locator(`[data-message-id="${message.id}"]`);
    await api(page, "PUT", `/chat/conversations/${id}/messages/${message.id}/reactions/HEART`);
    await api(page, "PUT", `/chat/conversations/${id}/messages/${message.id}/reactions/THUMBS_UP`);
    const self = (await api(page, "GET", "/auth/me")).json as { nickname: string };
    for (const [locale, dictionary] of [["tr", tr], ["en", en], ["de", de]] as const) {
      await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
      await page.goto(localizeHref("/dashboard", locale)); await page.getByTestId("chat-nav-item").click(); await page.locator(`[data-conversation-id="${id}"]`).click();
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        if (width === 320 && !await row.isVisible()) await page.locator(`[data-conversation-id="${id}"]`).click();
        for (const dark of [false, true]) {
          // TEST-ONLY theme presentation; all user data and reactions use the real API.
          await page.evaluate(value => document.documentElement.classList.toggle("dark", value), dark);
          await row.getByTestId("chat-reaction-HEART").click(); const panel = page.getByTestId("chat-reaction-details");
          await expect(panel).toContainText(self.nickname); await expect(panel).toContainText(dictionary.chat.reactions.you);
          await panel.getByRole("button", { name: `${dictionary.chat.reactions.all} (2)`, exact: true }).click();
          await expect(panel.locator("li")).toHaveCount(2);
          const bounds = (await panel.boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
          if (locale === "tr" && dark && (width === 320 || width === 1440)) await page.screenshot({ path: test.info().outputPath(`reactions-${width}.png`) });
          await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0); await expect(row.getByTestId("chat-reaction-HEART")).toBeFocused(); await expect(page.getByTestId("chat-panel")).toBeVisible();
        }
      }
    }
    await row.getByTestId("chat-reaction-HEART").click(); await page.getByTestId("chat-reaction-details").getByRole("button", { name: de.chat.reactions.remove }).click();
    await expect(row.getByTestId("chat-reaction-HEART")).toHaveCount(0); await page.keyboard.press("Escape");
  } finally { await api(page, "DELETE", `/projects/${project}`); }
});

test("text paste and drag stay native; drafts cannot cross conversations and large files remain rejected", async ({ page }) => {
  const { id, project } = await conversation(page);
  try {
    const input = page.getByTestId("chat-composer"); await input.fill("Keep ");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(() => navigator.clipboard.writeText("text")); await input.focus(); await input.press("Control+V");
    await expect(input).toHaveValue("Keep text");
    await expect(page.getByTestId("chat-file-preview")).toHaveCount(0);
    await page.getByTestId("chat-conversation").dispatchEvent("dragenter", { dataTransfer: await page.evaluateHandle(() => { const data = new DataTransfer(); data.setData("text/plain", "text"); return data; }) }); await expect(page.getByTestId("chat-drop-overlay")).toHaveCount(0);
    await page.locator('input[name="attachment"]').setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(2097153) }); await expect(page.getByText(tr.chat.files.tooLarge)).toBeVisible();
    await filesEvent(page, "drop", ["draft.png"]); await expect(page.getByTestId("chat-file-preview")).toHaveCount(1);
    const other = (await api(page, "GET", "/chat/conversations")).json as { groups: { id: string }[] }; const second = other.groups.find(g => g.id !== id);
    if (second) { await page.locator(`[data-conversation-id="${second.id}"]`).click(); await expect(page.getByTestId("chat-file-preview")).toHaveCount(0); }
    await page.getByTestId("chat-panel-close").click(); await page.getByTestId("chat-nav-item").click(); await expect(page.getByTestId("chat-file-preview")).toHaveCount(0);
  } finally { await api(page, "DELETE", `/projects/${project}`); }
});
