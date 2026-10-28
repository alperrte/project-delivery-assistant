import { test, expect } from "@playwright/test";
import { meetingFinalFixture } from "./meeting-final-fixture";
import { localizeHref } from "../src/i18n/routing";
import tr from "../src/i18n/meetings/tr.json";
import en from "../src/i18n/meetings/en.json";
import de from "../src/i18n/meetings/de.json";

for (const locale of ["tr", "en", "de"] as const) {
  const t = { tr, en, de }[locale];
  test(`${locale}: compact ordered toolbar, responsive themes and unchanged controls`, async ({ page, context, baseURL }) => {
    const fixture = await meetingFinalFixture(page, context, baseURL!, locale);
    fixture.meetings[0].status = "ENDED";
    try {
      await page.goto(localizeHref("/meetings", locale));
      await expect(page.locator("[data-meeting-card]")).toHaveCount(10);
      const toolbar = page.locator("[data-meeting-toolbar]");
      const search = toolbar.getByRole("searchbox", { name: t.searchMeetings, exact: true });
      const status = toolbar.getByRole("combobox", { name: t.filter, exact: true });
      const kind = toolbar.getByRole("combobox", { name: t.filterKind, exact: true });
      const calendar = toolbar.getByRole("link");
      const sort = toolbar.getByRole("combobox", { name: t.sortBy, exact: true });
      const controls = toolbar.locator('input[type="search"], button[role="combobox"], a');
      await expect(controls).toHaveCount(5);
      await expect(calendar).toHaveAttribute("href", localizeHref("/calendar", locale));
      const expectedNames = [t.searchMeetings, t.filter, t.filterKind, null, t.sortBy];
      expect(await controls.evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label")))).toEqual(expectedNames);
      await search.focus();
      for (const control of [status, kind, calendar, sort]) { await page.keyboard.press("Tab"); await expect(control).toBeFocused(); }
      for (const width of [320, 390, 480, 768, 1024, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme: theme });
          await expect.poll(() => page.locator("html").evaluate(node => node.classList.contains("dark"))).toBe(theme === "dark");
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: page fits`).toBe(true);
          const boxes = await controls.evaluateAll(nodes => nodes.map(node => {
            const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
          }));
          expect(boxes.every(box => box.height === (width < 768 ? 44 : 40)), `${width}px: equal control heights ${JSON.stringify(boxes)}`).toBe(true);
          for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], b = boxes[j];
            expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y, `${width}px: controls do not overlap`).toBe(true);
          }
          // All text remains readable in both themes, including German and the selected counts.
          expect(await toolbar.locator('[data-slot="select-value"]').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1)), `${width}px: selected text not clipped`).toBe(true);
          if (width >= 1280) {
            if (locale === "tr") {
              const description = page.getByText(t.listDescription, { exact: true });
              expect(await description.evaluate(node => node.getBoundingClientRect().height <= parseFloat(getComputedStyle(node).lineHeight) + 1), `${width}px: Turkish description stays on one line`).toBe(true);
            }
            expect(new Set(boxes.map(box => Math.round(box.y))).size, `${width}px: five controls share one row`).toBe(1);
            expect(boxes[0].width).toBeGreaterThanOrEqual(280); expect(boxes[0].width).toBeLessThanOrEqual(350);
            expect(boxes.every((box, index) => index === 0 || box.x > boxes[index - 1].x)).toBe(true);
          }
          if (width < 768) expect(boxes.slice(1).every(box => box.y >= boxes[0].bottom)).toBe(true);
          if (locale !== "en" && [320, 1440].includes(width)) await page.screenshot({ path: test.info().outputPath(`toolbar-${width}-${theme}.png`) });
        }
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await search.fill("Final Meeting 003"); await expect(page).toHaveURL(/q=Final\+Meeting\+003/);
      await expect(page.locator("[data-meeting-card]")).toHaveCount(1);
      await search.fill(""); await expect(page).not.toHaveURL(/q=/);
      await status.click(); await page.getByRole("option", { name: `${t.status.SCHEDULED} (25)`, exact: true }).click();
      await expect(page).toHaveURL(/status=SCHEDULED/);
      await status.click(); await page.getByRole("option", { name: `${t.all} (25)`, exact: true }).click();
      await expect(page).not.toHaveURL(/status=/);
      await kind.click(); await page.getByRole("option", { name: t.kindProjects, exact: true }).click();
      await expect(page).toHaveURL(/type=project/);
      await page.getByRole("combobox", { name: t.filterProject, exact: true }).click();
      await page.getByRole("option", { name: fixture.project.name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`project=${fixture.project.id}`));
      await kind.click(); await page.getByRole("option", { name: t.kindAll, exact: true }).click();
      await sort.click(); await page.getByRole("option", { name: t.sort.oldest, exact: true }).click(); await expect(page).toHaveURL(/sort=oldest/);
      const history = page.getByRole("checkbox", { name: t.showHistory, exact: true });
      await history.click(); await expect(page).toHaveURL(/history=1/); await expect(history).toBeChecked();
      const clear = page.getByRole("button", { name: t.clearHistory, exact: true });
      await expect(clear).toBeVisible(); expect(await clear.evaluate(node => !!node.closest("[data-meeting-toolbar]"))).toBe(false);
      await clear.click();
      const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog")); await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: t.cancel, exact: true }).click(); await expect(dialog).toBeHidden();
      await calendar.click(); await expect(page).toHaveURL(localizeHref("/calendar", locale));
      expect(fixture.unexpected).toEqual([]);
    } finally { await fixture.dispose(); }
  });
}
