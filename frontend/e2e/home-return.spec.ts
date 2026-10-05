import { expect, test, type Page } from "@playwright/test";

type ReturnProbe = {
  snapshots: number;
  animations: { state: string; opacity: number[] }[];
};

async function installProbe(page: Page, motionOff = false, dark = false) {
  await page.addInitScript(({ motionOff, dark }) => {
    if (motionOff) localStorage.setItem("pda:motion", "off");
    localStorage.setItem("theme", dark ? "dark" : "light");
    const probe: ReturnProbe = { snapshots: 0, animations: [] };
    Object.assign(window, { __homeReturnProbe: probe });
    if (document.startViewTransition) {
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = (...args) => {
        probe.snapshots++;
        return original(...args);
      };
    }
    const original = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      const animation = original.call(this, frames, options);
      if (this.querySelector("#landing-heading")) {
        const entry = { state: "running", opacity: [] as number[] };
        probe.animations.push(entry);
        const sample = () => {
          entry.opacity.push(Number(getComputedStyle(this).opacity));
          if (animation.playState === "running") requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        void animation.finished.then(
          () => { entry.state = "finished"; },
          () => { entry.state = "cancelled"; },
        );
      }
      return animation;
    };
  }, { motionOff, dark });
}

async function readProbe(page: Page) {
  return page.evaluate(() => (window as typeof window & { __homeReturnProbe: ReturnProbe }).__homeReturnProbe);
}

test.use({ storageState: { cookies: [], origins: [] } });

for (const scenario of [
  { name: "desktop logo in light theme", logo: true, dark: false, mobile: false },
  { name: "return link in dark theme", logo: false, dark: true, mobile: false },
  { name: "mobile logo", logo: true, dark: false, mobile: true },
  { name: "device reduced motion with the enabled default", logo: true, dark: false, mobile: false, deviceReduce: true },
]) {
  test(`home return animates visibly without freezing a snapshot: ${scenario.name}`, async ({ page }) => {
    await page.setViewportSize(scenario.mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 });
    await page.emulateMedia({ reducedMotion: "deviceReduce" in scenario ? "reduce" : "no-preference" });
    await installProbe(page, false, scenario.dark);
    await page.goto("/tr/giris");
    await page.getByRole("link", { name: scenario.logo ? "PDA · Ana sayfa" : "Ana sayfaya dön", exact: true }).click();
    await expect(page).toHaveURL(/\/tr$/);
    await expect(page.locator("#landing-heading")).toBeVisible();
    await expect.poll(async () => (await readProbe(page)).animations.some(entry => entry.state === "finished")).toBe(true);
    const probe = await readProbe(page);
    const animation = probe.animations.find(entry => entry.state === "finished")!;
    expect(probe.snapshots).toBe(0);
    expect(animation.opacity.some(value => value > 0.3 && value < 0.99)).toBe(true);
    expect(animation.opacity.at(-1)).toBeCloseTo(1);
    await expect(page.getByRole("link", { name: "Giriş yap", exact: true }).first()).toBeEnabled();
  });
}

test("home return respects the saved off preference", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await installProbe(page, true);
  await page.goto("/tr/giris");
  await page.getByRole("link", { name: "Ana sayfaya dön", exact: true }).click();
  await expect(page.locator("#landing-heading")).toBeVisible();
  expect((await readProbe(page)).animations).toHaveLength(0);
  expect((await readProbe(page)).snapshots).toBe(0);
});

test("a direct landing visit does not play the return animation", async ({ page }) => {
  await installProbe(page);
  await page.goto("/tr");
  await expect(page.locator("#landing-heading")).toBeVisible();
  expect((await readProbe(page)).animations).toHaveLength(0);
});
