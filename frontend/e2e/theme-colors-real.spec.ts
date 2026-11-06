import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { api, login, revealWorkspaceHeader } from "./helpers";
import { REJECTED_STATE } from "./consent-state";
import { DEFAULT_THEME_COLORS } from "../src/features/settings/theme-colors";
import tr from "../src/i18n/messages/tr.json";

const CONTAINER = "pda-theme-frontend-qa-postgres";
function sql(query: string) {
  // Refuse every DB except the disposable container specifically created for this test task.
  const label = execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "pda.qa"}}', CONTAINER], { encoding: "utf8" }).trim();
  if (label !== "theme-phase1-frontend") throw new Error("Not the disposable theme QA database");
  return execFileSync("docker", ["exec", CONTAINER, "psql", "-U", "postgres", "-d", "pda_theme_qa", "-qAtc", query], { encoding: "utf8" }).trim();
}

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
