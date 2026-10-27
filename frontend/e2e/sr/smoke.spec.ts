import { test } from "@playwright/test";
import path from "node:path";
import { Nvda } from "./nvda";

// Does the reader start, hear the browser and write what it says to its log? No operating-system key presses are sent: the focus is moved by the
// browser's own keyboard (Playwright), NVDA only listens to the focus and live-region events the browser raises and writes down what it would say.
test("NVDA starts and its speech can be read back", async ({ page }) => {
  const dir = process.env.NVDA_PORTABLE ?? ""; test.skip(!Nvda.available(dir), "NVDA_PORTABLE does not point at a portable NVDA");
  const nvda = new Nvda(dir, path.join(__dirname, "../../test-results/screenreader/nvda"));
  await nvda.start();
  try {
    await page.goto("/tr/giris"); await page.bringToFront(); await page.waitForTimeout(2500);
    for (const key of ["Tab", "Tab", "Tab", "Shift+Tab"]) {
      const mark = nvda.mark(); await page.keyboard.press(key); await page.waitForTimeout(900);
      console.log(`KEY ${key} -> ${JSON.stringify(nvda.said(mark))}`);
    }
    console.log(`NVDA version: ${nvda.version()}`); console.log(`LOG TAIL:\n${nvda.log().slice(-1800)}`);
  } finally { await nvda.stop(); }
});
