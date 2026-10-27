import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { meetingFinalFixture, FINAL_PERSON } from "./meeting-final-fixture";
import { localizeHref } from "../src/i18n/routing";
import tr from "../src/i18n/meetings/tr.json";
import en from "../src/i18n/meetings/en.json";
import de from "../src/i18n/meetings/de.json";
import commonTr from "../src/i18n/messages/tr.json";
import commonEn from "../src/i18n/messages/en.json";
import commonDe from "../src/i18n/messages/de.json";

const widths = [320, 390, 768, 1024, 1440];
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
async function axe(page: Page, scope: string) {
  const result = await new AxeBuilder({ page }).include(scope).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) }))).toEqual([]);
}

for (const locale of ["tr", "en", "de"] as const) {
  const t = { tr, en, de }[locale];
  test(`${locale}: pagination targets, list filters and responsive sidebar`, async ({ page, context, baseURL }) => {
    const fixture = await meetingFinalFixture(page, context, baseURL!, locale, 121);
    try {
      await page.goto(localizeHref("/meetings", locale));
      await expect(page.locator("[data-meeting-card]")).toHaveCount(10);
      const pagination = page.getByRole("navigation", { name: { tr: commonTr, en: commonEn, de: commonDe }[locale].common.pagination.navLabel, exact: true });
      await expect(pagination).toBeVisible();
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme: theme });
          await expect.poll(() => page.locator("html").evaluate(node => node.classList.contains("dark"))).toBe(theme === "dark");
          const sizes = await pagination.locator("button:visible").evaluateAll(buttons => buttons.map(button => { const r = button.getBoundingClientRect(); return { width: r.width, height: r.height }; }));
          expect(sizes.length).toBeGreaterThanOrEqual(2);
          expect(sizes.every(size => size.width >= 44 && size.height >= 44), `${width}px ${theme}: 44px meeting targets ${JSON.stringify(sizes)}`).toBe(true);
          expect(await noOverflow(page), `${width}px ${theme}: no horizontal overflow`).toBe(true);
          if (locale === "de" && [320, 1440].includes(width)) await page.screenshot({ path: test.info().outputPath(`list-${width}-${theme}.png`), fullPage: true });
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      const headingNames = await page.locator("[data-meeting-card] h3").allTextContents();
      const listUrl = page.url();
      await page.getByTestId("project-switcher-trigger").first().click();
      await page.locator(`[data-project-choice="${fixture.otherProject.id}"]`).click();
      await expect(page.getByTestId("project-switcher-popup")).toBeHidden();
      expect(page.url()).toBe(listUrl);
      await expect(page.locator("[data-meeting-card]")).toHaveCount(10);
      expect(await page.locator("[data-meeting-card] h3").allTextContents()).toEqual(headingNames);
      await expect(page.getByRole("group", { name: t.group, exact: true }).getByRole("link", { name: t.myMeetings, exact: true })).toHaveAttribute("aria-current", "page");
      const next = pagination.locator("button").last(); await next.focus(); await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/page=2/); await expect(next).toBeFocused();
      expect(await next.evaluate(node => getComputedStyle(node).boxShadow !== "none" || getComputedStyle(node).outlineStyle !== "none")).toBe(true);
      await page.reload(); await expect(page).toHaveURL(/page=2/); await expect(page.locator("[data-meeting-card]")).toHaveCount(10);
      const kind = page.getByRole("combobox", { name: t.filterKind, exact: true });
      await kind.click(); await page.getByRole("option", { name: t.kindProjects, exact: true }).click();
      await expect(page).toHaveURL(/type=project/);
      await expect(page.locator('[data-meeting-card] [data-meeting-kind="INDEPENDENT"]')).toHaveCount(0);
      await page.getByRole("combobox", { name: t.filterProject, exact: true }).click();
      await page.getByRole("option", { name: fixture.project.name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`project=${fixture.project.id}`));
      await expect(page.locator("[data-meeting-card] [data-meeting-project-name]").first()).toHaveText(fixture.project.name);
      await expect.poll(() => page.locator("[data-meeting-card] [data-logo-frame] img").first().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await kind.click(); await page.getByRole("option", { name: t.kindIndependents, exact: true }).click();
      await expect(page).toHaveURL(/type=independent/);
      await expect(page.locator('[data-meeting-card] [data-meeting-kind="PROJECT"]')).toHaveCount(0);
      await kind.click(); await page.getByRole("option", { name: t.kindAll, exact: true }).click();
      await expect(page).not.toHaveURL(/type=|project=/);
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        await expect.poll(() => page.locator("html").evaluate(node => node.classList.contains("dark"))).toBe(theme === "dark");
        await axe(page, "main");
      }
      await page.setViewportSize({ width: 390, height: 844 });
      const drawerTrigger = page.locator('button[aria-controls="workspace-mobile-navigation"]');
      await drawerTrigger.click();
      const drawer = page.locator("#workspace-mobile-navigation"); await expect(drawer).toBeVisible();
      await expect(drawer.getByRole("group", { name: t.group, exact: true })).toBeVisible();
      await page.keyboard.press("Escape"); await expect(drawer).toBeHidden(); await expect(drawerTrigger).toBeFocused();
      expect(fixture.unexpected).toEqual([]);
    } finally { await fixture.dispose(); }
  });

  for (const kind of ["independent", "project"] as const) {
    test(`${locale}: ${kind} planning, validation and Start now auto-join`, async ({ page, context, baseURL }) => {
      const fixture = await meetingFinalFixture(page, context, baseURL!, locale, 1);
      try {
        for (const immediate of [false, true]) {
          await page.goto(localizeHref("/meetings", locale));
          await page.getByRole("group", { name: t.group, exact: true }).getByRole("link", { name: t.create, exact: true }).click();
          for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            await expect.poll(() => noOverflow(page)).toBe(true);
            await expect(page.locator(`[data-meeting-kind-choice="${kind}"]`)).toBeVisible();
          }
          await page.locator(`[data-meeting-kind-choice="${kind}"]`).click();
          if (kind === "project") {
            for (const width of widths) {
              await page.setViewportSize({ width, height: 900 });
              await expect.poll(() => noOverflow(page)).toBe(true);
              await expect(page.locator(`[data-meeting-project-choice="${fixture.project.id}"]`)).toBeVisible();
            }
            await page.locator(`[data-meeting-project-choice="${fixture.project.id}"]`).click();
          }
          await expect(page.locator("#meeting-title")).toBeVisible();
          await page.getByRole("button", { name: t.plan, exact: true }).click();
          await expect(page.locator("#meeting-title")).toHaveAttribute("aria-invalid", "true");
          expect(fixture.created).toHaveLength(immediate ? 1 : 0);
          await page.locator("#meeting-title").fill(`Final ${kind} ${immediate ? "instant" : "planned"}`);
          const search = page.getByRole("searchbox", { name: t.searchPeople, exact: true });
          await expect(search).toHaveAttribute("placeholder", t.searchPeopleHint.replace("{min}", "3"));
          await search.fill("Final");
          await page.getByRole("button", { name: t.addAttendee.replace("{name}", FINAL_PERSON.nickname), exact: true }).click();
          await expect(search).toBeFocused();
          for (const width of widths) {
            await page.setViewportSize({ width, height: 900 });
            const overflow = await page.locator("main *").evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().right > innerWidth + 0.5).slice(0, 8).map(node => ({ tag: node.tagName, className: node.className, text: node.textContent?.slice(0, 55), right: node.getBoundingClientRect().right })));
            await expect.poll(() => noOverflow(page), `${width}px: ${JSON.stringify(overflow)}`).toBe(true);
          }
          await page.setViewportSize({ width: 1440, height: 1000 });
          await page.getByRole("button", { name: immediate ? t.startNow : t.plan, exact: true }).click();
          const sent = fixture.created.at(-1)!;
          expect(sent.meetingType).toBe(kind === "project" ? "PROJECT" : "INDEPENDENT");
          expect(sent.projectId).toBe(kind === "project" ? fixture.project.id : null);
          expect(sent.attendeeIds).toEqual([FINAL_PERSON.userId]);
          if (immediate) {
            expect(sent.startNow).toBe(true);
            await expect(page).toHaveURL(/\/(?:oda|room|raum)$/);
            await expect(page.getByRole("status").filter({ hasText: new RegExp(`^${t.phase.connected}$`) })).toBeVisible({ timeout: 20_000 });
            expect(fixture.joinCalls).toBe(1);
            await expect(page.getByRole("button", { name: t.join, exact: true })).toHaveCount(0);
          } else {
            await expect(page.getByRole("heading", { level: 1 })).toContainText(`Final ${kind} planned`);
            await page.goBack(); await page.goForward();
            await expect(page.getByRole("heading", { level: 1 })).toContainText(`Final ${kind} planned`);
          }
        }
        expect(fixture.unexpected).toEqual([]);
      } finally { await fixture.dispose(); }
    });
  }

  test(`${locale}: chat send accessibility, duplicate guard, error retry and room controls`, async ({ page, context, baseURL }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    const fixture = await meetingFinalFixture(page, context, baseURL!, locale, 1);
    try {
      const meeting = fixture.openMeeting();
      await page.goto(localizeHref(`/meetings/${meeting.id}/room`, locale));
      await page.getByRole("button", { name: t.join, exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: new RegExp(`^${t.phase.connected}$`) })).toBeVisible({ timeout: 20_000 });
      const controls = page.locator("[data-room-controls]");
      await controls.getByRole("button", { name: t.micOn, exact: true }).focus(); await page.keyboard.press("Space");
      await expect(controls.getByRole("button", { name: t.micOff, exact: true })).toBeFocused();
      await expect(controls.getByRole("status")).toContainText(t.micIsOn);
      await controls.getByRole("button", { name: t.cameraOn, exact: true }).click();
      await expect(controls.getByRole("button", { name: t.cameraOff, exact: true })).toBeFocused();
      await expect(controls.getByRole("status")).toContainText(t.cameraIsOn);
      await controls.getByRole("button", { name: t.chat, exact: true }).click();
      const box = page.locator("#meeting-message"), send = page.getByRole("button", { name: t.send, exact: true });
      await box.fill("Final message"); fixture.holdSend();
      await box.evaluate(node => { const form = node.closest("form")!; form.requestSubmit(); form.requestSubmit(); });
      await expect.poll(() => fixture.sendCalls).toBe(1);
      await expect(box).toBeFocused(); await expect(box).toHaveAttribute("readonly", "");
      await expect(box).not.toHaveAttribute("aria-busy", "true");
      await page.keyboard.type("must not replace the pending draft"); await page.keyboard.press("Enter");
      await expect(box).toHaveValue("Final message"); expect(fixture.sendCalls).toBe(1); await expect(send).toBeDisabled();
      fixture.releaseSend(); await expect(box).toHaveValue(""); await expect(box).toBeFocused();
      await expect(page.getByRole("status").filter({ hasText: t.messageSent })).toHaveCount(1);
      await box.fill("Retained after failure"); fixture.holdSend(); await page.keyboard.press("Enter");
      await expect.poll(() => fixture.sendCalls).toBe(2); fixture.releaseSend(false);
      await expect(box).toHaveValue("Retained after failure"); await expect(box).toBeEditable(); await expect(box).toBeFocused();
      await expect(page.getByRole("alert").first()).toBeVisible();
      await page.keyboard.press("Enter"); await expect.poll(() => fixture.sendCalls).toBe(3); await expect(box).toHaveValue("");
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 }); expect(await noOverflow(page)).toBe(true);
        await expect(box).toBeVisible();
        const targetSizes = () => controls.locator("button:visible").evaluateAll(buttons => buttons.map(button => { const box = button.getBoundingClientRect(); return { name: button.getAttribute("aria-label"), width: box.width, height: box.height }; }));
        const initialTargets = await targetSizes();
        await expect.poll(async () => (await targetSizes()).every(target => target.width >= 44 && target.height >= 44), `${width}px: room controls are at least 44px; initial ${JSON.stringify(initialTargets)}`).toBe(true);
        await expect.poll(() => page.locator("[data-meeting-room] > header").evaluate(header => {
          const title = header.querySelector("h1")!.getBoundingClientRect(), bounds = header.getBoundingClientRect();
          return title.top >= bounds.top && title.bottom <= bounds.bottom;
        }), `${width}px: meeting title must stay inside the room header`).toBe(true);
        for (const theme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme: theme }); await axe(page, "[data-meeting-room]");
          if (locale === "de" && [320, 1440].includes(width)) await page.screenshot({ path: test.info().outputPath(`room-${width}-${theme}.png`) });
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await box.focus(); await page.keyboard.press("Escape");
      await expect(box).toHaveCount(0);
      await expect(controls.getByRole("button", { name: t.chat, exact: true })).toBeFocused();
      await controls.getByRole("button", { name: t.chat, exact: true }).click();
      await page.getByRole("button", { name: t.closePanel, exact: true }).click();
      await expect(controls.getByRole("button", { name: t.chat, exact: true })).toBeFocused();
      await controls.getByRole("button", { name: t.chat, exact: true }).click();
      await controls.getByRole("button", { name: t.leave, exact: true }).click();
      const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog")); await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape"); await expect(dialog).toBeHidden();
      await expect(controls.getByRole("button", { name: t.leave, exact: true })).toBeFocused();
      await controls.getByRole("button", { name: t.leave, exact: true }).click();
      await page.getByRole("button", { name: t.leaveConfirm, exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: new RegExp(`^${t.phase.left}$`) })).toBeVisible();
      await page.goto(localizeHref(`/meetings/${meeting.id}/room`, locale));
      await page.getByRole("button", { name: t.join, exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: new RegExp(`^${t.phase.connected}$`) })).toBeVisible({ timeout: 20_000 });
      await page.getByRole("button", { name: t.endForAll, exact: true }).click();
      await page.getByRole("button", { name: t.endConfirmLabel, exact: true }).click();
      await expect.poll(() => meeting.status).toBe("ENDED");
      expect(fixture.unexpected).toEqual([]);
      expect(pageErrors).toEqual([]);
    } finally { await fixture.dispose(); }
  });
}
