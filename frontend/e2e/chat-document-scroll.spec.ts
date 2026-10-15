import { test, expect } from "@playwright/test";
import { api, createProject, revealWorkspaceHeader } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";
import tr from "../src/i18n/messages/tr.json";

test.use({ storageState: MANAGER_STORAGE });

test("full chat locks the long Tasks document while inner chat, dialogs and navigation keep working", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 500 });
  const slug = await createProject(page, `Chat scroll lock ${Date.now()}`);
  const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string };
  try {
    for (let i = 0; i < 9; i++) expect((await api(page, "POST", `/projects/${project.id}/tasks`, { title: `Background task ${i}`, creationMode: "SIMPLE" })).status).toBe(201);
    const overview = (await api(page, "GET", "/chat/conversations")).json as { groups: { id: string; projectId: string }[] };
    const conversation = overview.groups.find(group => group.projectId === project.id)!.id;
    for (let i = 0; i < 8; i++) expect((await api(page, "POST", `/chat/conversations/${conversation}/messages`, { content: `Scroll message ${i}\n` + "Readable sample line\n".repeat(8) })).status).toBe(201);
    await page.goto(`/projects/${slug}/tasks`);
    await page.getByRole("tab", { name: "Kart", exact: true }).click();
    await expect(page.locator("[data-task-card]")).toHaveCount(9);
    for (const mobile of [false, true]) {
      await page.setViewportSize({ width: mobile ? 390 : 1440, height: mobile ? 844 : 500 });
      await page.evaluate(() => window.scrollTo(0, 120));
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      const before = await page.evaluate(() => scrollY);
      if (mobile) {
        await revealWorkspaceHeader(page);
        await page.getByRole("button", { name: tr.workspace.navigation, exact: true }).click();
        await page.locator("#workspace-mobile-navigation").getByTestId("chat-nav-item").click();
      } else await page.getByTestId("chat-nav-item").click();
      const panel = page.getByTestId("chat-panel");
      await expect(panel).toBeVisible();
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe("hidden");
      await expect(page.locator("#main-content")).toHaveAttribute("inert", "");
      const lockedPosition = await page.evaluate(() => scrollY);
      expect(lockedPosition).toBe(before);
      await panel.focus();
      await panel.press("PageDown");
      await panel.press("Space");
      await page.mouse.move(mobile ? 180 : 900, 100);
      await page.mouse.wheel(0, 900);
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(lockedPosition);
      if (!mobile) { await page.mouse.move(20, 300); await page.mouse.wheel(0, 600); }
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(lockedPosition);
      await page.locator(`[data-conversation-id="${conversation}"]`).click();
      const messages = page.getByTestId("chat-messages");
      await expect(messages).toBeVisible();
      expect(await page.evaluate(() => scrollY), "after conversation selection").toBe(lockedPosition);
      const last = page.getByTestId("chat-message").last();
      await last.getByTestId("chat-message-actions").click();
      expect(await page.evaluate(() => scrollY), "after message menu").toBe(lockedPosition);
      const info = page.getByTestId("chat-message-info");
      await expect(info).toBeVisible();
      const infoBox = (await info.boundingBox())!;
      expect(infoBox.y).toBeGreaterThanOrEqual(0);
      expect(infoBox.y + infoBox.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      await page.mouse.click(infoBox.x + infoBox.width / 2, infoBox.y + infoBox.height / 2);
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await page.evaluate(() => scrollY), "after nested dialog opened").toBe(lockedPosition);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await page.evaluate(() => scrollY), "after nested dialog closed").toBe(lockedPosition);
      if (mobile) {
        await revealWorkspaceHeader(page);
        await page.getByRole("button", { name: tr.workspace.navigation, exact: true }).click();
        await expect(page.locator("#workspace-mobile-navigation")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator("#workspace-mobile-navigation")).toBeHidden();
        expect(await page.evaluate(() => scrollY)).toBe(lockedPosition);
      }
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe("hidden");
      await expect.poll(() => messages.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
      const bottom = await messages.evaluate(el => el.scrollTop);
      const bounds = (await messages.boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.wheel(0, -500);
      await expect.poll(() => messages.evaluate(el => el.scrollTop)).toBeLessThan(bottom);
      expect(await page.evaluate(() => scrollY)).toBe(lockedPosition);
      await page.screenshot({ path: test.info().outputPath(`full-chat-${mobile ? "mobile" : "desktop"}-scroll-lock.png`) });
      await page.getByTestId("chat-minimize").click();
      await expect(page.locator("[data-chat-full]")).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe("hidden");
      expect(await page.evaluate(() => scrollY)).toBe(lockedPosition);
      await page.getByTestId("chat-bar-expand").click();
      await expect(page.getByTestId("chat-compact")).toBeVisible();
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe("hidden");
      await page.getByTestId("chat-fullscreen").click();
      await expect(panel).toBeVisible();
      await page.getByTestId("chat-panel-close").click();
      await expect(page.locator("[data-chat-full]")).toHaveCount(0);
      expect(await page.evaluate(() => scrollY)).toBe(lockedPosition);
      await page.mouse.move(mobile ? 180 : 900, 300); await page.mouse.wheel(0, 300);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(lockedPosition);
    }
    await page.setViewportSize({ width: 1440, height: 500 });
    await page.getByTestId("chat-nav-item").click();
    await expect(page.getByTestId("chat-panel")).toBeVisible();
    await page.locator(".app-shell > aside").getByRole("link", { name: "Projeler", exact: true }).click();
    await expect(page.locator("[data-chat-full]")).toHaveCount(0);
    await expect(page.locator("#main-content")).not.toHaveAttribute("inert", "");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe("hidden");
  } finally { await api(page, "DELETE", `/projects/${project.id}`); }
});
