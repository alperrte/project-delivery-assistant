import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DEFAULT_THEME_COLORS, themePalette } from "../src/features/settings/theme-colors";
import { fixture } from "./theme-fixture";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

for (const dark of [false, true]) for (const gradient of [false, true]) test(`${gradient ? "gradient" : "solid"} surfaces follow the saved background checkbox in ${dark ? "dark" : "light"} appearance`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const api = await fixture(page, "tr", dark);
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/tr/ayarlar");
  const background = page.getByLabel(tr.preferences.colors.animatedBackground, { exact: true });
  await expect(background).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-user-theme", "solid");
  const save = page.getByRole("button", { name: tr.preferences.save.save, exact: true });
  const surfaces = async () => {
    await page.locator(".app-shell > aside").waitFor({ state: "attached" });
    return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const color = (name: string) => {
      const value = root.getPropertyValue(name).trim().toLowerCase();
      return /^#[\da-f]{3}$/.test(value) ? `#${[...value.slice(1)].map(c => c + c).join("")}` : value;
    };
    return { background: color("--background"), sidebar: color("--surface-2"),
      card: color("--card"), muted: color("--muted"),
      paint: getComputedStyle(document.querySelector(".app-shell")!).backgroundImage,
      sidebarPaint: getComputedStyle(document.querySelector(".app-shell > aside")!).backgroundImage,
      sidebarColor: getComputedStyle(document.querySelector(".app-shell > aside")!).backgroundColor };
    });
  };
  const commit = async () => {
    const response = page.waitForResponse(r => r.url().endsWith("/users/me/preferences") && r.request().method() === "PUT");
    await save.click();
    const { themeColors } = await (await response).json();
    const primary = themePalette(themeColors, dark)["--primary"];
    await expect.poll(() => page.evaluate(mode => document.documentElement.style.getPropertyValue(`--user-${mode}-primary`), dark ? "dark" : "light")).toBe(primary);
    if (themeColors.themeType.startsWith("ANIMATED")) await expect(page.locator("html")).toHaveAttribute("data-user-background", "animated");
    else await expect(page.locator("html")).not.toHaveAttribute("data-user-background");
  };
  const initial = await surfaces();
  if (gradient) {
    await page.getByRole("radio", { name: tr.preferences.colors.gradient, exact: true }).click();
    await page.getByLabel(tr.preferences.colors.start, { exact: true }).fill("#2457D6");
    await page.getByLabel(tr.preferences.colors.end, { exact: true }).fill("#DB3A75");
    await page.getByLabel(tr.preferences.colors.angle, { exact: true }).fill("90");
  } else await page.getByLabel(tr.preferences.colors.solidColor, { exact: true }).fill("#E04838");
  expect(await surfaces()).toEqual(initial); // Drafts never repaint the current workspace.
  await commit();
  const colored = await surfaces();
  expect(colored.background).not.toBe(initial.background);
  expect(colored.sidebar).not.toBe(initial.sidebar);
  expect(colored.muted).not.toBe(initial.muted);
  expect(colored.paint.includes("linear-gradient")).toBe(gradient);
  expect(colored.sidebarPaint.includes("linear-gradient")).toBe(gradient);
  if (gradient) {
    const before = colored;
    await page.getByLabel(tr.preferences.colors.end, { exact: true }).fill("#12B87A"); await commit();
    expect((await surfaces()).background).not.toBe(before.background);
    expect((await surfaces()).sidebarPaint).not.toBe(before.sidebarPaint);
    await page.getByLabel(tr.preferences.colors.end, { exact: true }).fill("#DB3A75"); await commit();
    expect(await surfaces()).toEqual(before);
  }
  const link = page.locator(".app-shell > aside nav a").first();
  await link.hover();
  expect(await link.evaluate(e => getComputedStyle(e).backgroundImage.includes("linear-gradient"))).toBe(gradient);
  expect((await new AxeBuilder({ page }).include("[data-theme-color-editor]").include(".app-shell > aside").analyze()).violations).toEqual([]);
  mkdirSync("../.local/theme-surfaces", { recursive: true });
  await page.goto("/tr/gorevlerim");
  await expect.poll(surfaces).toEqual(colored);
  await expect(page.getByText("Açık göreviniz yok", { exact: true })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `../.local/theme-surfaces/${gradient ? "gradient" : "solid"}-${dark ? "dark" : "light"}-${width}.png` });
  }
  await page.goto("/tr/ayarlar");
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(background).toBeVisible();
  await expect.poll(surfaces).toEqual(colored);
  await background.check();
  expect(await surfaces()).toEqual(colored);
  await commit();
  expect(await surfaces()).toEqual({ background: dark ? "#090a0b" : "#ffffff", sidebar: dark ? "#111214" : "#f9fafa", card: dark ? "#18191b" : "#ffffff", muted: dark ? "#222326" : "#f4f5f6", paint: "none", sidebarPaint: colored.sidebarPaint, sidebarColor: colored.sidebarColor });
  await link.hover();
  expect(await link.evaluate(e => getComputedStyle(e).backgroundImage.includes("linear-gradient"))).toBe(gradient);
  expect((await new AxeBuilder({ page }).include(".app-shell > aside").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `../.local/theme-surfaces/animated-sidebar-${gradient ? "gradient" : "solid"}-${dark ? "dark" : "light"}.png` });
  await page.setViewportSize({ width: 390, height: 960 });
  await page.getByRole("button", { name: tr.workspace.navigation, exact: true }).click();
  const drawer = page.locator("#workspace-mobile-navigation");
  await expect(drawer).toBeVisible();
  expect(await drawer.evaluate(e => ({ color: getComputedStyle(e).backgroundColor, paint: getComputedStyle(e).backgroundImage }))).toEqual({ color: colored.sidebarColor, paint: colored.sidebarPaint });
  expect((await new AxeBuilder({ page }).include("#workspace-mobile-navigation").analyze()).violations).toEqual([]);
  await page.screenshot({ path: `../.local/theme-surfaces/animated-sidebar-mobile-${gradient ? "gradient" : "solid"}-${dark ? "dark" : "light"}.png` });
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(page.locator("[data-theme-effects]")).toHaveCount(1);
  await background.uncheck(); await commit();
  expect(await surfaces()).toEqual(colored);
  await expect(page.locator("[data-theme-effects]")).toHaveCount(0);
  await page.reload();
  await expect(background).not.toBeChecked();
  await expect.poll(surfaces).toEqual(colored);
  expect(api.saved().themeColors.themeType).toBe(gradient ? "GRADIENT" : "SOLID");
  await page.emulateMedia({ forcedColors: "active" });
  expect((await surfaces()).paint).toBe("none");
  await page.emulateMedia({ forcedColors: "none" });
  await page.goto("/tr");
  await expect(page.locator("html")).not.toHaveAttribute("data-user-theme");
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--user-light-theme-surface-background"))).toBe("");
  expect(errors).toEqual([]);
});


test("returning to a stale tab reloads account colors without replacing an unsaved local draft", async ({ page }) => {
  const api = await fixture(page);
  await page.clock.install();
  await page.goto("/tr/ayarlar");
  await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue("#1B5FE0");
  await page.getByLabel("Tema rengi", { exact: true }).fill("#ABCDEF");
  api.changeSavedColor("#C8323A");
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--user-light-primary"))).toBe(themePalette({ ...DEFAULT_THEME_COLORS, solidColor: "#C8323A" }, false)["--primary"]);
  await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue("#ABCDEF");
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue("#C8323A");
});

test("failed initial load offers retry without rendering writable fallback preferences", async ({ page }) => {
  const api = await fixture(page);
  api.failRead(true);
  await page.goto("/tr/ayarlar");
  await expect(page.getByText(tr.preferences.colors.loadError, { exact: true })).toBeVisible();
  await expect(page.locator("[data-theme-color-editor]")).toHaveCount(0);
  api.failRead(false);
  await page.getByRole("button", { name: tr.preferences.colors.retry, exact: true }).click();
  await expect(page.locator("[data-theme-color-editor]")).toBeVisible();
});

test("System appearance applies on save and follows subsequent device changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await fixture(page); // Stored light appearance overrides the device until Save.
  await page.goto("/tr/ayarlar");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("radiogroup", { name: "Tema", exact: true }).getByRole("radio", { name: "Sistem", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByLabel("Tema rengi", { exact: true }).fill("#ffffff");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const darkPrimary = await page.locator("html").evaluate(el => getComputedStyle(el).getPropertyValue("--primary"));
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  const lightPrimary = await page.locator("html").evaluate(el => getComputedStyle(el).getPropertyValue("--primary"));
  expect(lightPrimary).not.toBe(darkPrimary);
});

test("Solid and Gradient drafts validate, save, reload, discard and reset without losing other choices", async ({ page }) => {
  const api = await fixture(page);
  await page.goto("/tr/ayarlar");
  const root = page.locator("html"), editor = page.locator("[data-theme-color-editor]");
  const save = page.getByRole("button", { name: "Kaydet", exact: true });
  await expect(editor).toBeVisible();
  await expect(page.locator("fieldset > section").last().locator("[data-theme-color-editor]")).toHaveCount(1);
  await expect(page.locator("[data-theme-preview]")).toHaveCount(0);
  await expect(page.getByRole("group", { name: tr.preferences.colors.presets, exact: true })).toHaveCount(0);
  await page.getByLabel("Tema rengi", { exact: true }).fill("#abc");
  expect(api.saved().themeColors.solidColor).toBe("#1B5FE0");
  await expect(root).toHaveAttribute("data-user-theme", "solid");
  await save.click();
  expect(api.saved().themeColors.solidColor).toBe("#AABBCC");
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue("#AABBCC");
  await page.getByRole("radiogroup", { name: "Tema türü" }).getByRole("radio", { name: "Gradyan", exact: true }).click();
  await page.getByLabel("Birinci renk", { exact: true }).fill("#102030");
  await page.getByLabel("İkinci renk", { exact: true }).fill("#ffeedd");
  await page.getByLabel("Gradyan açısı (°)", { exact: true }).fill("360");
  await expect(root).toHaveAttribute("data-user-theme", "solid");
  await page.getByLabel("İkinci renk", { exact: true }).fill("bad-color");
  await expect(save).toBeDisabled();
  await expect(page.getByText(tr.preferences.colors.invalidHex, { exact: true })).toBeVisible();
  await page.getByLabel("İkinci renk", { exact: true }).fill("#ffeedd");
  await page.getByLabel("Gradyan açısı (°)", { exact: true }).fill("361");
  await expect(save).toBeDisabled();
  await page.locator('input[name="gradientAngle"]').fill("90");
  await save.click();
  await expect(root).toHaveAttribute("data-user-theme", "gradient");
  expect(api.saved().themeColors.gradientAngle).toBe(90);
  await page.getByLabel("Birinci renk", { exact: true }).fill("#000000");
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByLabel("Birinci renk", { exact: true })).toHaveValue("#102030");
  await page.getByRole("radiogroup", { name: "Arayüz animasyonları", exact: true }).getByRole("radio", { name: "Kapalı", exact: true }).click();
  await page.getByRole("button", { name: tr.preferences.colors.reset, exact: true }).click();
  await expect(root).toHaveAttribute("data-user-theme", "solid");
  expect(api.saved().themeColors).toEqual(DEFAULT_THEME_COLORS);
  expect(api.saved().motion).toBe("on");
  await expect(save).toBeEnabled(); // Unsaved motion choice survived the color reset.
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(save).toBeDisabled();
});

test("failed saves and resets preserve the draft and the last applied colors", async ({ page }) => {
  const api = await fixture(page);
  await page.goto("/tr/ayarlar");
  await page.getByLabel("Tema rengi", { exact: true }).fill("#C8323A");
  api.failSave();
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue("#C8323A");
  await expect(page.getByRole("button", { name: "Kaydet", exact: true })).toBeEnabled();
  expect(api.saved().themeColors.solidColor).toBe(DEFAULT_THEME_COLORS.solidColor);
  api.failReset();
  await page.getByRole("button", { name: tr.preferences.colors.reset, exact: true }).click();
  await expect(page.getByRole("button", { name: tr.preferences.colors.reset, exact: true })).toBeEnabled();
  await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue("#C8323A");
});

for (const [locale, messages, route] of [["tr", tr, "/tr/ayarlar"], ["en", en, "/en/settings"], ["de", de, "/de/einstellungen"]] as const) {
  for (const dark of [false, true]) test(`${locale} ${dark ? "dark" : "light"}: responsive, keyboard, reduced motion and scoped accessibility`, async ({ page }) => {
    await fixture(page, locale, dark);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    const t = messages.preferences.colors;
    await expect(page.getByLabel(t.solidColor, { exact: true })).toBeVisible();
    await page.getByLabel(t.solidColor, { exact: true }).focus();
    await expect(page.getByLabel(t.solidColor, { exact: true })).toBeFocused();
    await page.getByRole("radiogroup", { name: t.type }).getByRole("radio", { name: t.gradient, exact: true }).click();
    await page.getByLabel(t.angleSlider, { exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByLabel(t.angle, { exact: true })).toHaveValue("136");
    const folder = path.resolve("../.local/theme-phase1-frontend/captures");
    mkdirSync(folder, { recursive: true });
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 950 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByLabel(t.start, { exact: true })).toBeVisible();
      if (process.env.THEME_CAPTURE !== "0" && (width === 1440 || width === 320)) await page.locator("[data-theme-color-editor]").screenshot({ path: path.join(folder, `${locale}-${dark ? "dark" : "light"}-${width}.png`) });
    }
    const audit = await new AxeBuilder({ page }).include("[data-theme-color-editor]").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(audit.violations).toEqual([]);
  });
}
