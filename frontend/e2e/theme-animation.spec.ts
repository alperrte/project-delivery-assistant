import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture } from "./theme-fixture";
import { DEFAULT_THEME_ANIMATION, ANIMATION_PRESETS, normalizeThemeAnimation } from "../src/features/settings/theme-animation";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";
import { mkdirSync } from "node:fs";

const t = tr.preferences.animation;
const save = (page: Page) => page.getByRole("button", { name: tr.preferences.save.save, exact: true });
const choose = (page: Page, preset: keyof typeof t.names) => page.getByRole("radio", { name: t.names[preset], exact: true }).check();
const scene = (page: Page) => page.locator("[data-theme-effects] .theme-scene");

async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const contexts: AudioContext[] = [], filters: BiquadFilterNode[] = [], gains: GainNode[] = [];
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      constructor() { super(); contexts.push(this); }
      createBiquadFilter() { const node = super.createBiquadFilter(); filters.push(node); return node; }
      createGain() { const node = super.createGain(); gains.push(node); return node; }
    };
    Object.assign(window, { audioProbe: { contexts, filters, gains } });
  });
}
const audio = (page: Page) => page.evaluate(() => {
  const probe = (window as typeof window & { audioProbe: { contexts: AudioContext[]; filters: BiquadFilterNode[]; gains: GainNode[] } }).audioProbe;
  return { states: probe.contexts.map(c => c.state), frequencies: probe.filters.map(f => f.frequency.value), gains: probe.gains.map(g => g.gain.value) };
});

test("animation contract rejects incomplete, injected, nonboolean and noninteger values", () => {
  for (const preset of ANIMATION_PRESETS) expect(normalizeThemeAnimation({ ...DEFAULT_THEME_ANIMATION, animation: preset })).toBeDefined();
  for (const bad of [null, {}, { ...DEFAULT_THEME_ANIMATION, animation: "url(x)" },
    { ...DEFAULT_THEME_ANIMATION, soundEnabled: "true" }, { ...DEFAULT_THEME_ANIMATION, animationEnabled: 1 },
    ...[-1, 101, 1.5, NaN].map(soundVolume => ({ ...DEFAULT_THEME_ANIMATION, soundVolume }))]) expect(normalizeThemeAnimation(bad)).toBeUndefined();
  for (const soundVolume of [0, 100]) expect(normalizeThemeAnimation({ ...DEFAULT_THEME_ANIMATION, soundVolume })?.soundVolume).toBe(soundVolume);
});

test("four local previews, valid controls, save/reload/discard and complete reset", async ({ page }) => {
  const api = await fixture(page);
  await page.goto("/tr/ayarlar");
  await page.getByRole("radio", { name: tr.preferences.colors.animated, exact: true }).click();
  await expect(page.locator("[data-animation-editor] input[type=radio]")).toHaveCount(4);
  for (const preset of ANIMATION_PRESETS) {
    await choose(page, preset);
    await expect(page.locator("[data-animation-editor] .theme-scene")).toHaveAttribute("data-preset", preset);
    await expect(page.locator("[data-theme-effects]")).toHaveCount(0);
  }
  await page.getByLabel(t.volume, { exact: true }).fill("101");
  await expect(save(page)).toBeDisabled();
  await expect(page.getByText(t.invalidVolume)).toBeVisible();
  await page.getByLabel(t.volume, { exact: true }).fill("0");
  await page.getByLabel(t.soundEnabled, { exact: true }).check();
  await save(page).click();
  await expect(scene(page)).toHaveAttribute("data-preset", "WATER");
  expect(api.saved().themeAnimation).toEqual({ animation: "WATER", soundEnabled: true, soundVolume: 0, animationEnabled: true });
  await page.reload();
  await expect(page.getByLabel(t.volume, { exact: true })).toHaveValue("0");
  await choose(page, "SNOW");
  await page.getByRole("button", { name: tr.preferences.save.discard, exact: true }).click();
  await expect(page.getByRole("radio", { name: t.names.WATER, exact: true })).toBeChecked();
  await page.getByRole("button", { name: tr.preferences.colors.reset, exact: true }).click();
  await expect(page.locator("[data-theme-effects]")).toHaveCount(0);
  expect(api.saved().themeAnimation).toEqual(DEFAULT_THEME_ANIMATION);
});

test("gesture-owned real Web Audio: distinct presets, volume, tab stop, no reload autoplay and solid cleanup", async ({ page }) => {
  await observeAudio(page);
  await fixture(page, "tr", false, true);
  await page.goto("/tr/ayarlar");
  await page.getByLabel(t.soundEnabled, { exact: true }).check();
  await save(page).click();
  await expect(page.getByRole("button", { name: t.startSound, exact: true })).toBeVisible();
  expect((await audio(page)).states).toEqual([]);
  await page.getByRole("button", { name: t.startSound, exact: true }).click();
  await expect(page.getByRole("button", { name: t.stopSound, exact: true })).toBeVisible();
  for (const [preset, frequency] of [["RAIN", 6500], ["SNOW", 420], ["WATER", 650], ["THUNDERSTORM", 2600]] as const) {
    await choose(page, preset); await save(page).click();
    await expect.poll(async () => (await audio(page)).frequencies.at(-1)).toBe(frequency);
    expect((await audio(page)).states).toEqual(["running"]);
  }
  await page.getByLabel(t.volume, { exact: true }).fill("100"); await save(page).click();
  await expect.poll(async () => (await audio(page)).gains[0]).toBeCloseTo(.14, 3);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(async () => (await audio(page)).states).toEqual(["closed"]);
  await expect(scene(page)).toHaveAttribute("data-running", "false");
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(scene(page)).toHaveAttribute("data-running", "true");
  expect((await audio(page)).states).toEqual(["closed"]);
  await page.getByRole("button", { name: t.startSound, exact: true }).click();
  await expect.poll(async () => (await audio(page)).states).toEqual(["closed", "running"]);
  await page.reload();
  await expect(page.getByRole("button", { name: t.startSound, exact: true })).toBeVisible();
  expect((await audio(page)).states).toEqual([]);
  await page.getByRole("button", { name: t.startSound, exact: true }).click();
  await page.getByRole("radio", { name: tr.preferences.colors.solid, exact: true }).click(); await save(page).click();
  await expect.poll(async () => (await audio(page)).states).toEqual(["closed"]);
  await expect(page.locator("[data-theme-effects]")).toHaveCount(0);
});

test("reduced motion, explicit animation off and session pause use static fallback", async ({ page }) => {
  await fixture(page, "tr", false, true);
  await page.goto("/tr/ayarlar");
  await expect(scene(page)).toHaveAttribute("data-running", "true");
  await page.getByRole("button", { name: t.pause, exact: true }).click();
  await expect(scene(page)).toHaveAttribute("data-running", "false");
  await page.getByRole("button", { name: t.resume, exact: true }).click();
  await expect(scene(page)).toHaveAttribute("data-running", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(scene(page)).toHaveAttribute("data-running", "false");
  await expect(page.locator("[data-animation-editor] .theme-scene")).toHaveAttribute("data-running", "false");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByLabel(t.animationEnabled, { exact: true }).uncheck(); await save(page).click();
  await expect(scene(page)).toHaveAttribute("data-running", "false");
  await page.reload();
  await expect(scene(page)).toHaveAttribute("data-running", "false");
  await page.getByLabel(t.animationEnabled, { exact: true }).check(); await save(page).click();
  await expect(save(page)).toBeDisabled();
  await page.getByRole("radiogroup", { name: tr.preferences.motion.ui.label, exact: true }).getByRole("radio", { name: tr.preferences.motion.ui.off, exact: true }).click();
  await save(page).click();
  await expect(scene(page)).toHaveAttribute("data-running", "false");
  await expect(page.locator("[data-animation-editor] .theme-scene")).toHaveAttribute("data-running", "false");
});

test("unavailable audio is retryable and never breaks settings", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "AudioContext", { value: undefined, configurable: true }); });
  const api = await fixture(page, "tr", false, true);
  await page.goto("/tr/ayarlar");
  await page.getByLabel(t.soundEnabled, { exact: true }).check(); await save(page).click();
  await page.getByRole("button", { name: t.startSound, exact: true }).click();
  await expect(page.getByText(t.blocked, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: t.startSound, exact: true })).toBeEnabled();
  api.failSave();
  await choose(page, "SNOW"); await save(page).click();
  await expect(save(page)).toBeEnabled();
  await expect(page.getByRole("radio", { name: t.names.SNOW, exact: true })).toBeChecked();
  await expect(scene(page)).toHaveAttribute("data-preset", "THUNDERSTORM");
});

test("thunder remains available with visual motion off and pending sounds are cleaned on stop", async ({ page }) => {
  await observeAudio(page); await fixture(page, "tr", false, true);
  await page.goto("/tr/ayarlar");
  await page.getByLabel(t.soundEnabled, { exact: true }).check();
  await page.getByLabel(t.animationEnabled, { exact: true }).uncheck(); await save(page).click();
  await expect(scene(page)).toHaveAttribute("data-running", "false");
  await page.clock.install();
  await page.getByRole("button", { name: t.startSound, exact: true }).click();
  await expect(page.getByRole("button", { name: t.stopSound, exact: true })).toBeVisible();
  await page.clock.runFor(18_000);
  expect((await audio(page)).frequencies).toContain(140);
  await page.getByRole("button", { name: t.stopSound, exact: true }).click();
  const stopped = await audio(page);
  await page.clock.runFor(40_000);
  expect(await audio(page)).toEqual(stopped);
  expect(stopped.states).toEqual(["closed"]);
});

test("workspace canvas stays bounded at 30fps and stops drawing while paused", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { themeFrameCount: 0 });
    const original = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.parentElement?.closest("[data-theme-effects]")) (window as typeof window & { themeFrameCount: number }).themeFrameCount++;
      return original.apply(this, args);
    };
  });
  await fixture(page, "tr", false, true); await page.goto("/tr/ayarlar");
  await expect(scene(page)).toHaveAttribute("data-running", "true");
  const count = () => page.evaluate(() => (window as typeof window & { themeFrameCount: number }).themeFrameCount);
  const first = await count(); await page.waitForTimeout(1100); const frames = await count() - first;
  expect(frames).toBeGreaterThan(5); expect(frames).toBeLessThanOrEqual(35);
  await page.getByRole("button", { name: t.pause, exact: true }).click();
  await expect(scene(page)).toHaveAttribute("data-running", "false");
  const stopped = await count(); await page.waitForTimeout(150); expect(await count()).toBe(stopped);
});

for (const [locale, messages] of [["tr", tr], ["en", en], ["de", de]] as const) test(`${locale} mobile/dark: accessible cards and keyboard controls without overflow`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, locale, true, true);
  await page.goto(`/${locale}/${locale === "tr" ? "ayarlar" : locale === "de" ? "einstellungen" : "settings"}`);
  const radio = page.getByRole("radio", { name: messages.preferences.animation.names.SNOW, exact: true });
  await radio.focus(); await page.keyboard.press("Space"); await expect(radio).toBeChecked();
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const violations = await new AxeBuilder({ page }).include("[data-theme-color-editor]").analyze();
  expect(violations.violations).toEqual([]);
  if (locale === "tr") { mkdirSync("../.local/theme-phase2-frontend", { recursive: true }); await page.screenshot({ path: "../.local/theme-phase2-frontend/mobile-dark.png" }); }
});

for (const [locale, messages] of [["tr", tr], ["en", en], ["de", de]] as const) test(`${locale} desktop/light: controls, accessibility and all four presets`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await fixture(page, locale, false, true);
  await page.goto(`/${locale}/${locale === "tr" ? "ayarlar" : locale === "de" ? "einstellungen" : "settings"}`);
  for (const preset of ANIMATION_PRESETS) {
    await page.getByRole("radio", { name: messages.preferences.animation.names[preset], exact: true }).check();
    await expect(page.locator("[data-animation-editor] .theme-scene")).toHaveAttribute("data-preset", preset);
  }
  const violations = await new AxeBuilder({ page }).include("[data-theme-color-editor]").include("[data-theme-controls]").analyze();
  expect(violations.violations).toEqual([]);
  await page.getByText(messages.preferences.animation.presets, { exact: true }).scrollIntoViewIfNeeded();
  if (locale === "tr") await page.screenshot({ path: "../.local/theme-phase2-frontend/desktop-light.png" });
});
