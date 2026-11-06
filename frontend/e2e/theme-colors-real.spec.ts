import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { api, login, revealWorkspaceHeader } from "./helpers";
import { REJECTED_STATE } from "./consent-state";
import { DEFAULT_THEME_COLORS } from "../src/features/settings/theme-colors";
import { DEFAULT_THEME_ANIMATION } from "../src/features/settings/theme-animation";
import tr from "../src/i18n/messages/tr.json";

const CONTAINER = "pda-theme-frontend-qa-postgres";
function sql(query: string) {
  // Refuse every DB except the disposable container specifically created for this test task.
  const label = execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "pda.qa"}}', CONTAINER], { encoding: "utf8" }).trim();
  if (label !== "theme-phase1-frontend") throw new Error("Not the disposable theme QA database");
  return execFileSync("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-d", "pda_theme_qa", "-qAtc", query], { encoding: "utf8" }).trim();
}

test("real animated preferences: database, new device, other account, audio logout cleanup and full reset", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const t = tr.preferences.animation;
  const prefix = randomUUID().replaceAll("-", "");
  const users = [0, 1].map(index => ({ id: randomUUID(), email: `animation-${prefix}-${index}@example.test`,
    nickname: `anim${prefix.slice(0, 12)}${index}`, password: `QaTheme2!${prefix}` }));
  sql("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  for (const user of users) sql(`INSERT INTO users(id,email,nickname,password_hash,account_status,email_verification_status,global_role,created_at,updated_at) VALUES('${user.id}','${user.email}','${user.nickname}',crypt('${user.password}',gen_salt('bf',10)),'ACTIVE','VERIFIED','USER',now(),now())`);
  await page.addInitScript(() => {
    const contexts: AudioContext[] = [], Base = window.AudioContext;
    window.AudioContext = class extends Base { constructor() { super(); contexts.push(this); } };
    Object.assign(window, { animationAudioContexts: contexts });
  });
  const device = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", storageState: REJECTED_STATE });
  const other = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", storageState: REJECTED_STATE });
  try {
    await login(page, users[0].email, users[0].password);
    await page.goto("/tr/ayarlar");
    await page.getByLabel(tr.preferences.colors.animatedBackground, { exact: true }).check();
    await page.getByRole("radio", { name: t.names.FIRE, exact: true }).check();
    await page.getByLabel(t.soundEnabled, { exact: true }).check();
    await page.getByLabel(t.volume, { exact: true }).fill("73");
    await page.getByLabel(t.animationEnabled, { exact: true }).uncheck();
    await page.getByRole("button", { name: tr.preferences.save.save, exact: true }).click();
    await expect(page.locator("[data-theme-effects] .theme-scene")).toHaveAttribute("data-running", "false");
    const stored = JSON.parse(sql(`SELECT row_to_json(p) FROM user_preferences p WHERE user_id='${users[0].id}'`));
    expect([stored.theme_type, stored.animation_preset, stored.theme_sound_enabled, stored.theme_sound_volume, stored.theme_animation_enabled]).toEqual(["ANIMATED", "FIRE", true, 73, false]);
    const expected = { animation: "FIRE", soundEnabled: true, soundVolume: 73, animationEnabled: false };
    expect(((await api(page, "GET", "/users/me/preferences")).json as { themeAnimation: unknown }).themeAnimation).toEqual(expected);
    await page.getByRole("radio", { name: tr.preferences.colors.gradient, exact: true }).click();
    await page.getByLabel(tr.preferences.colors.start, { exact: true }).fill("#123456");
    await page.getByLabel(tr.preferences.colors.end, { exact: true }).fill("#C0307A");
    await page.getByRole("button", { name: tr.preferences.save.save, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-user-theme", "gradient");
    await expect(page.locator("html")).toHaveAttribute("data-user-background", "animated");
    const combined = JSON.parse(sql(`SELECT row_to_json(p) FROM user_preferences p WHERE user_id='${users[0].id}'`));
    expect([combined.theme_type, combined.solid_color, combined.gradient_start_color, combined.gradient_end_color, combined.animation_preset, combined.theme_sound_volume]).toEqual(["ANIMATED_GRADIENT", DEFAULT_THEME_COLORS.solidColor, "#123456", "#C0307A", "FIRE", 73]);
    const devicePage = await device.newPage();
    await login(devicePage, users[0].email, users[0].password); await devicePage.goto("/tr/ayarlar");
    await expect(devicePage.getByLabel(t.volume, { exact: true })).toHaveValue("73");
    await expect(devicePage.getByLabel(tr.preferences.colors.end, { exact: true })).toHaveValue("#C0307A");
    await expect(devicePage.getByLabel(tr.preferences.colors.animatedBackground, { exact: true })).toBeChecked();
    await expect(devicePage.locator("html")).toHaveAttribute("data-user-theme", "gradient");
    await expect(devicePage.locator("html")).toHaveAttribute("data-user-background", "animated");
    await expect(devicePage.getByLabel(t.animationEnabled, { exact: true })).not.toBeChecked();
    await expect(devicePage.getByRole("button", { name: t.startSound, exact: true })).toBeVisible();
    const otherPage = await other.newPage();
    await login(otherPage, users[1].email, users[1].password); await otherPage.goto("/tr/ayarlar");
    await expect(otherPage.locator("[data-theme-effects]")).toHaveCount(0);
    expect(((await api(otherPage, "GET", "/users/me/preferences")).json as { themeAnimation: unknown }).themeAnimation).toEqual(DEFAULT_THEME_ANIMATION);
    await page.bringToFront();
    await page.getByRole("button", { name: t.startSound, exact: true }).click();
    await expect(page.getByRole("button", { name: t.stopSound, exact: true })).toBeVisible();
    await revealWorkspaceHeader(page);
    await page.getByRole("button", { name: /Hesap menüsü/ }).click();
    await page.getByRole("menuitem", { name: "Çıkış yap", exact: true }).click();
    await expect(page.locator("[data-theme-effects]")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute("data-user-background");
    await expect.poll(() => page.evaluate(() => (window as typeof window & { animationAudioContexts: AudioContext[] }).animationAudioContexts.map(c => c.state))).toEqual(["closed"]);
    await login(page, users[1].email, users[1].password);
    await expect(page.locator("[data-theme-effects]")).toHaveCount(0);
    await devicePage.getByRole("button", { name: tr.preferences.colors.reset, exact: true }).click();
    await expect(devicePage.locator("[data-theme-effects]")).toHaveCount(0);
    expect(((await api(devicePage, "GET", "/users/me/preferences")).json as { themeAnimation: unknown }).themeAnimation).toEqual(DEFAULT_THEME_ANIMATION);
  } finally { await device.close(); await other.close(); }
});

test("real cookie API/PostgreSQL: apply, independent colors, new device, account isolation, reset and logout cleanup", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const prefix = randomUUID().replaceAll("-", "");
  const users = [0, 1].map(index => ({ id: randomUUID(), email: `theme-${prefix}-${index}@example.test`,
    nickname: `theme${prefix.slice(0, 12)}${index}`, password: `QaTheme1!${prefix}` }));
  sql("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  for (const user of users) sql(`INSERT INTO users(id,email,nickname,password_hash,account_status,email_verification_status,global_role,created_at,updated_at) VALUES('${user.id}','${user.email}','${user.nickname}',crypt('${user.password}',gen_salt('bf',10)),'ACTIVE','VERIFIED','USER',now(),now())`);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.assign(window, { themeCspViolations: [] });
    document.addEventListener("securitypolicyviolation", event => {
      (window as typeof window & { themeCspViolations: string[] }).themeCspViolations.push(event.violatedDirective);
    });
  });
  const other = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", storageState: REJECTED_STATE });
  const device = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", storageState: REJECTED_STATE });
  try {
    await login(page, users[0].email, users[0].password);
    await page.goto("/tr/ayarlar");
    await page.getByLabel("Tema rengi", { exact: true }).fill("#123456");
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(page.getByText("Ayarlar kaydedildi.", { exact: true })).toBeVisible();
    const stored = JSON.parse(sql(`SELECT row_to_json(p) FROM user_preferences p WHERE user_id='${users[0].id}'`));
    expect(stored.solid_color).toBe("#123456");
    await page.getByRole("radiogroup", { name: "Tema türü" }).getByRole("radio", { name: "Gradyan", exact: true }).click();
    await page.getByLabel("Birinci renk", { exact: true }).fill("#112233");
    await page.getByLabel("İkinci renk", { exact: true }).fill("#ddeeFF");
    await page.getByLabel("Gradyan açısı (°)", { exact: true }).fill("270");
    await page.getByRole("radiogroup", { name: "Tema", exact: true }).getByRole("radio", { name: "Koyu", exact: true }).click();
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-user-theme", "gradient");
    await expect(page.locator("html")).toHaveClass(/dark/);
    const own = (await api(page, "GET", "/users/me/preferences")).json as { themeColors: typeof DEFAULT_THEME_COLORS; theme: string };
    expect(own.themeColors).toEqual({ themeType: "GRADIENT", solidColor: "#123456", gradientStartColor: "#112233", gradientEndColor: "#DDEEFF", gradientAngle: 270 });
    expect(own.theme).toBe("dark");
    const savedPrimary = await page.locator("html").evaluate(el => getComputedStyle(el).getPropertyValue("--primary"));
    // Common buttonVariants links, buttons, fields and focus tokens share the saved palette on other routes too.
    for (const route of ["/projects", "/tasks", "/dashboard", "/organizations", "/account"]) {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("data-user-theme", "gradient");
      await expect.poll(() => page.locator("html").evaluate(el => getComputedStyle(el).getPropertyValue("--primary"))).toBe(savedPrimary);
      if (["/projects", "/dashboard", "/organizations"].includes(route)) {
        const primary = page.locator(".theme-primary-action:visible").first();
        await expect(primary).toHaveCSS("background-image", /linear-gradient\(270deg/);
      }
    }
    await page.goto("/tr/ayarlar");
    const devicePage = await device.newPage();
    await login(devicePage, users[0].email, users[0].password);
    await devicePage.goto("/tr/ayarlar");
    await expect(devicePage.getByLabel("İkinci renk", { exact: true })).toHaveValue("#DDEEFF");
    await expect(devicePage.locator("html")).toHaveAttribute("data-user-theme", "gradient");
    const otherPage = await other.newPage();
    await login(otherPage, users[1].email, users[1].password);
    await otherPage.goto("/tr/ayarlar");
    await expect(otherPage.getByLabel("Tema rengi", { exact: true })).toHaveValue(DEFAULT_THEME_COLORS.solidColor);
    await otherPage.getByLabel("Tema rengi", { exact: true }).fill("#C8323A");
    await otherPage.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(otherPage.getByRole("button", { name: "Kaydet", exact: true })).toBeDisabled();
    await page.reload();
    await expect(page.getByLabel("Birinci renk", { exact: true })).toHaveValue("#112233");
    await page.getByRole("button", { name: tr.preferences.colors.reset, exact: true }).click();
    await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue(DEFAULT_THEME_COLORS.solidColor);
    await expect(page.locator("html")).toHaveClass(/dark/);
    const reset = (await api(page, "GET", "/users/me/preferences")).json as typeof own;
    expect(reset.theme).toBe("dark");
    expect(reset.themeColors).toEqual(DEFAULT_THEME_COLORS);
    expect(((await api(otherPage, "GET", "/users/me/preferences")).json as typeof own).themeColors.solidColor).toBe("#C8323A");
    expect(await page.evaluate(() => (window as typeof window & { themeCspViolations: string[] }).themeCspViolations)).toEqual([]);
    await page.bringToFront();
    await revealWorkspaceHeader(page);
    await page.getByRole("button", { name: /Hesap menüsü/ }).click();
    await page.getByRole("menuitem", { name: "Çıkış yap", exact: true }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-user-theme");
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue("--user-light-primary"))).toBe("");
    expect(errors).toEqual([]);
  } finally {
    await other.close();
    await device.close();
    // All records belong to this disposable database/run. The whole container is removed by task cleanup.
  }
});
