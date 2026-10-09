import { test, expect, type Page } from "@playwright/test";
import { api, chooseDate as choose, createProject } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE, timezoneId: "Europe/Istanbul" });

async function fixture(page: Page, taskMode: "SIMPLE" | "ADVANCED" = "SIMPLE") {
  const slug = await createProject(page, `Date picker ${Date.now()}`, { taskMode });
  const project = (await api(page, "GET", `/projects/by-slug/${slug}`)).json as { id: string };
  await page.goto(`/projects/${slug}/tasks/new`);
  await expect(page.locator("#task-title")).toBeVisible();
  return { slug, id: project.id };
}

test("simple task dates validate, persist, and reopen on the selected month when editing", async ({ page }) => {
  const project = await fixture(page);
  await page.locator("#task-title").fill("Calendar persistence");
  await choose(page, "task-start", "2030-03-20");
  await choose(page, "task-deadline-date", "2030-03-19");
  await expect(page.locator("#task-deadline-date")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator('p[role="alert"]')).toContainText("başlangıç tarihinden önce olamaz");
  await choose(page, "task-deadline-date", "2030-03-25");
  await expect(page.locator("#task-deadline-date")).not.toHaveAttribute("aria-invalid", "true");
  const response = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/projects/${project.id}/tasks`));
  await page.getByRole("button", { name: "Görevi oluştur", exact: true }).click();
  const task = await (await response).json() as { id: string; startDate: string; deadlineAt: string };
  expect(task.startDate).toBe("2030-03-20");
  // Deadline semantics remain local end-of-day, never a date-only UTC midnight.
  const local = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(task.deadlineAt));
  expect(local).toBe("2030-03-25");
  await page.goto(`/projects/${project.slug}/tasks/${task.id}/edit`);
  await page.locator("#task-start").click();
  await expect(page.getByRole("grid", { name: "Mart 2030" })).toBeVisible();
  await expect(page.locator('[data-date="2030-03-20"]')).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#task-start")).toBeFocused();
});

test("keyboard navigation crosses months and leap day; Escape and outside click restore dismissal", async ({ page }) => {
  await fixture(page);
  await choose(page, "task-start", "2028-02-28");
  await page.locator("#task-start").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-date="2028-02-28"]')).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-date="2028-02-29"]')).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("grid", { name: "Mart 2028" })).toBeVisible();
  await expect(page.locator('[data-date="2028-03-01"]')).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect(page.locator('[data-date="2028-04-01"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#task-start")).toContainText("2028");
  await expect(page.locator("#task-start")).toBeFocused();
  await page.locator("#task-start").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#task-start-calendar")).toHaveCount(0);
  await page.locator("#task-start").click();
  await page.locator("#task-title").click();
  await expect(page.locator("#task-start-calendar")).toHaveCount(0);
});

test("today, clear, quick deadlines and advanced time keep their existing payload semantics", async ({ page }) => {
  const project = await fixture(page, "ADVANCED");
  await page.locator("#task-title").fill("Advanced calendar");
  await page.locator("#task-start").click();
  await page.locator("#task-start-calendar").getByRole("button", { name: "Bugün", exact: true }).click();
  await page.locator("#task-start").click();
  await expect(page.locator('[aria-current="date"]')).toBeFocused();
  await page.locator("#task-start-calendar").getByRole("button", { name: "Temizle" }).click();
  await expect(page.locator("#task-start")).toContainText("Tarih seçin");
  await page.getByRole("group", { name: "Hızlı son tarih seçimi" }).getByRole("button", { name: /^Yarın/ }).click();
  const time = page.getByLabel("Son tarih saati", { exact: true });
  await time.fill("14:30");
  await page.locator("#task-deadline-date").click();
  await page.locator("#task-deadline-date-calendar").getByRole("button", { name: "Temizle" }).click();
  await expect(time).toHaveValue("");
  await choose(page, "task-deadline-date", "2032-12-10");
  await time.fill("14:30");
  const request = page.waitForRequest(r => r.method() === "POST" && r.url().endsWith(`/projects/${project.id}/tasks`));
  await page.getByRole("button", { name: "Görevi oluştur", exact: true }).click();
  const payload = (await request).postDataJSON();
  expect(payload.startDate).toBeNull();
  expect(new Date(payload.deadlineAt).toISOString()).toBe("2032-12-10T11:30:00.000Z");
  await expect(page).toHaveURL(/gorevler\/(?!yeni-gorev$)[^/]+$/);
});

test("custom month and year menus support selection, keyboard and nested Escape", async ({ page }) => {
  await fixture(page);
  await choose(page, "task-start", "2030-01-31");
  await page.locator("#task-start").click();
  const calendar = page.locator("#task-start-calendar");
  const month = calendar.getByRole("combobox", { name: "Ay", exact: true });
  const year = calendar.getByRole("combobox", { name: "Yıl", exact: true });
  await expect(calendar.locator("select")).toHaveCount(0);
  await month.click();
  await expect(page.getByRole("listbox", { name: "Ay", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "Ocak", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(calendar).toBeVisible();
  await expect(month).toBeFocused();
  await month.click();
  await page.getByRole("option", { name: "Şubat", exact: true }).click();
  await expect(page.getByRole("grid", { name: "Şubat 2030" })).toBeVisible();
  await expect(calendar.locator('[data-date="2030-02-28"]')).toHaveAttribute("tabindex", "0");
  await year.click();
  await expect(page.getByRole("option", { name: "2030", exact: true })).toBeInViewport();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("grid", { name: "Şubat 2031" })).toBeVisible();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(year).toBeFocused();
  await year.click();
  await expect(page.getByRole("listbox", { name: "Yıl", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(calendar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(calendar).toHaveCount(0);
  await expect(page.locator("#task-start")).toBeFocused();
});

test("localized calendar fits mobile and desktop in light and dark without runtime errors", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const project = await fixture(page, "ADVANCED");
  for (const [locale, path, monthLabel, yearLabel, closeLabel, nextLabel] of [
    ["tr", `/tr/projeler/${project.slug}/gorevler/yeni`, "Ay", "Yıl", "Takvimi kapat", "Sonraki ay"],
    ["en", `/en/projects/${project.slug}/tasks/new`, "Month", "Year", "Close calendar", "Next month"],
    ["de", `/de/projekte/${project.slug}/aufgaben/neu`, "Monat", "Jahr", "Kalender schließen", "Nächster Monat"],
  ]) {
    await page.goto(path);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.evaluate(theme => document.documentElement.classList.toggle("dark", theme === "dark"), theme);
        await page.locator("#task-deadline-date").click();
        const popup = page.getByRole("dialog");
        await expect(popup).toBeVisible();
        await expect(popup.getByRole("combobox", { name: monthLabel, exact: true })).toBeVisible();
        await expect(popup.getByRole("combobox", { name: yearLabel, exact: true })).toBeVisible();
        await expect(popup.getByRole("button", { name: locale === "tr" ? "Bugün" : locale === "en" ? "Today" : "Heute", exact: true })).toBeInViewport();
        await popup.getByRole("button", { name: nextLabel, exact: true }).click();
        const box = await popup.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        for (const [label, kind] of [[monthLabel, "month"], [yearLabel, "year"]]) {
          await popup.getByRole("combobox", { name: label, exact: true }).click();
          const menu = page.getByRole("listbox", { name: label, exact: true });
          await expect(menu).toBeVisible();
          await expect(page.locator('[data-slot="select-content"][data-open]')).toHaveCSS("opacity", "1");
          const menuBox = await menu.boundingBox();
          expect(menuBox!.x).toBeGreaterThanOrEqual(0);
          expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width);
          await expect(menu.locator('[role="option"][aria-selected="true"]')).toBeInViewport();
          if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath(`${locale}-${theme}-${width}-${kind}.png`) });
          await page.keyboard.press("Escape");
          await expect(menu).toHaveCount(0);
          await expect(popup).toBeVisible();
        }
        const layout = await page.evaluate(() => ({
          viewport: innerWidth, width: document.documentElement.scrollWidth, scrollX,
          overflow: [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right + scrollX > innerWidth + 1).slice(0, 12).map(el => ({ tag: el.tagName, id: el.id, class: el.className, right: el.getBoundingClientRect().right + scrollX })),
        }));
        expect(layout.width, JSON.stringify({ locale, theme, layout })).toBeLessThanOrEqual(width);
        if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath(`${locale}-${theme}-${width}.png`) });
        await popup.getByRole("button", { name: closeLabel, exact: true }).click();
      }
    }
  }
  expect(errors).toEqual([]);
});
