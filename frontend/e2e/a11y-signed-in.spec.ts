import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MANAGER_STORAGE } from "./global-setup";
import { createProject } from "./helpers";

test.use({ storageState: MANAGER_STORAGE });

/**
 * Signed-in accessibility sweep. `a11y-public.spec.ts` covers the public pages; this covers the workspace: axe (WCAG 2.0-2.2 A/AA)
 * in both themes at phone and desktop width, the 24x24 CSS px minimum target size (WCAG 2.5.8) of every visible control, and a
 * Tab walk that proves the keyboard never gets trapped and always shows where it is (WCAG 2.1.1, 2.1.2, 2.4.7).
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const themes = ["light", "dark"] as const;
const viewports = [{ name: "mobile", width: 360, height: 800 }, { name: "desktop", width: 1440, height: 900 }] as const;

let slug = "";
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: MANAGER_STORAGE, baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", locale: "tr-TR" });
  const page = await context.newPage();
  slug = await createProject(page, `A11Y ${Date.now().toString(36)}`);
  await context.close();
});

const routes = () => ["/dashboard", `/projects/${slug}`, `/projects/${slug}/tasks`, `/projects/${slug}/tasks/board`, `/projects/${slug}/tasks/new`, `/projects/${slug}/teams`, `/projects/${slug}/calendar`, `/projects/${slug}/settings`, "/organizations", "/projects", "/account", "/settings", "/invitations"];

async function open(page: Page, path: string, theme: string) {
  await page.addInitScript(value => localStorage.setItem("theme", value), theme);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const theme of themes) {
  for (const viewport of viewports) {
    test(`axe: workspace screens, ${theme}, ${viewport.name}`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const problems: unknown[] = [];
      const undecided: string[] = [];
      for (const path of routes()) {
        await open(page, path, theme);
        const { violations, incomplete } = await new AxeBuilder({ page }).exclude("nextjs-portal").withTags(WCAG_TAGS).analyze();
        for (const violation of violations) {
          problems.push({ path, rule: violation.id, impact: violation.impact, targets: violation.nodes.map(node => node.target.join(" ")).slice(0, 6) });
        }
        for (const item of incomplete) undecided.push(`${path}: ${item.id} (${item.nodes.length})`);
      }
      test.info().annotations.push({ type: "axe-incomplete", description: undecided.join("; ") || "none" });
      expect(problems).toEqual([]);
    });
  }
}

test("every visible control on the workspace screens is at least 24x24 CSS px (WCAG 2.5.8)", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const small: string[] = [];
  for (const path of routes()) {
    await open(page, path, "light");
    const found = await page.evaluate(() => {
      const out: string[] = [];
      const selector = "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=menuitem], [role=tab], [role=checkbox], [role=radio], [role=switch], [role=combobox]";
      for (const element of document.querySelectorAll<HTMLElement>(selector)) {
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none" || element.closest("[aria-hidden=true], [hidden], nextjs-portal")) continue;
        // The target is the whole clickable row when a control sits inside a <label> (custom radio / checkbox indicators).
        const rect = (element.closest("label") ?? element).getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        // A visually hidden (sr-only, 1x1) input has a visible proxy that is measured itself (file pickers: their button).
        if (element.getBoundingClientRect().width <= 1 && element.getBoundingClientRect().height <= 1) continue;
        // Inline text links inside a sentence are exempt from 2.5.8 ("inline" exception).
        const inline = element.tagName === "A" && style.display === "inline";
        if (inline) continue;
        if (rect.width < 24 - 0.5 || rect.height < 24 - 0.5) {
          out.push(`${element.tagName.toLowerCase()} "${(element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 30)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`);
        }
      }
      return out;
    });
    small.push(...found.map(item => `${path}: ${item}`));
  }
  expect(small).toEqual([]);
});

test("the keyboard walks every workspace screen without getting trapped and always shows focus", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const problems: string[] = [];
  for (const path of routes()) {
    await open(page, path, "light");
    const seen = new Set<string>();
    let invisibleFocus = 0;
    let stuck = 0;
    let previous = "";
    for (let step = 0; step < 150; step += 1) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return { id: "body", visible: true };
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const ring = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 || style.boxShadow !== "none" || element.matches(":focus-visible");
        const path: string[] = [];
        for (let node: HTMLElement | null = element; node && path.length < 4; node = node.parentElement) path.push(node.tagName.toLowerCase() + (node.id ? `#${node.id}` : ""));
        return { id: path.join("<") + "|" + (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 24), visible: rect.width > 0 && rect.height > 0 && ring };
      });
      if (!state.visible) invisibleFocus += 1;
      if (state.id === previous) stuck += 1; else stuck = 0;
      previous = state.id;
      if (stuck >= 3) { problems.push(`${path}: focus did not move away from ${state.id}`); break; }
      if (seen.has(state.id) && state.id === "body") break;
      seen.add(state.id);
    }
    if (seen.size < 3) problems.push(`${path}: only ${seen.size} focus stop(s)`);
    if (invisibleFocus > 0) problems.push(`${path}: ${invisibleFocus} focus stop(s) without a visible indicator`);
  }
  expect(problems).toEqual([]);
});
